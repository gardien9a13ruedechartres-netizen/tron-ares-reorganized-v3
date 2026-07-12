const LIVEWATCH_ORIGIN = 'https://livewatch.top';
const PROXY_PATH = '/api/iptv/proxy';
const SOURCE_CACHE_TTL_MS = 120000;
const SOURCE_TEST_TIMEOUT_MS = 5000;
const sourceCache = new Map();

const LIVE_CHANNELS = new Map([
  ['6ter', { search: '6TER', exact: '6TER', country: 'France', prefer: ['FHD', 'HD', null] }],
  ['cstar', { search: 'C STAR', exact: 'C STAR', country: 'France', prefer: ['FHD', 'HD', null], fallbackIds: [
    { id: '3480426017c3f2b3e10a98-4eb0ab5a31ab6c', name: 'C STAR', quality: 'FHD', source: 'satellite' },
    { id: '3166346130b6b8b30bb9d2-eda28228a50465', name: 'C STAR', quality: null, source: 'cable' }
  ] }],
  ['w9', { search: 'W9', exact: 'W9', country: 'France', prefer: ['HD', 'FHD', null] }],
  ['cmtv', { search: 'CM TV', exact: 'CM TV', country: 'Portugal', prefer: [null, 'HD', 'FHD'], fallbackIds: [
    { id: '384601660517fa3552a29f-6816b5893e5bcc', name: 'CM TV', quality: null, source: 'basic' },
    { id: '805844173b05e1a81e31d-579768661fe265', name: 'CM TV', quality: null, source: 'cable' }
  ] }],
  ["disney+ pixar", { search: "DISNEY+ PIXAR", exact: "DISNEY+ PIXAR", country: "Portugal", prefer: [null, "HD", "FHD"], fallbackIds: [
    { id: "1616464273e04bb68a8a1c-ed3fcb510db31f", name: "CM TV", quality: null, source: "cable" },
    { id: "1616464273e04bb68a8a1c-ed3fcb510db31f", name: "CM TV", quality: null, source: "cable" }
  ] }],
  ['canal-panda', { search: 'CANAL PANDA', exact: 'CANAL PANDA', country: 'Portugal', prefer: [null, 'HD', 'FHD'], fallbackIds: [
    { id: '4002241315e5ee10f4b753-97c7a8325393c2', name: 'CANAL PANDA', quality: null, source: 'basic' },
    { id: '26958390437906a5f4ba97-d22b5eb462d646', name: 'CANAL PANDA', quality: null, source: 'cable' }
  ] }],
  ['m6', { search: 'M6', exact: 'M6', country: 'France', prefer: ['FHD', 'HD', null] }]
]);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Ares-Channel, X-Ares-Source-Id, X-Ares-Source-Type, X-Ares-Source-Quality, X-Ares-Detection'
  };
}

function livewatchHeaders(accept = '*/*') {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    'User-Agent': 'Mozilla/5.0'
  };
}

function isAllowedLivewatchUrl(url) {
  return url.origin === LIVEWATCH_ORIGIN &&
    url.pathname === '/api/hls' &&
    url.searchParams.has('t') &&
    !url.username &&
    !url.password;
}

function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedLivewatchUrl(upstream)) return value;
    return `${publicOrigin}${PROXY_PATH}?url=${encodeURIComponent(upstream.href)}`;
  } catch (_) {
    return value;
  }
}

function rewritePlaylist(text, upstreamUrl, publicOrigin) {
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (!trimmed.startsWith('#')) {
      return makeProxyUrl(trimmed, upstreamUrl, publicOrigin);
    }

    return line
      .replace(/URI="([^"]+)"/g, (match, value) => `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`)
      .replace(/URI='([^']+)'/g, (match, value) => `URI='${makeProxyUrl(value, upstreamUrl, publicOrigin)}'`);
  }).join('\n');
}

function hlsContentType(pathname, fallback) {
  const type = String(fallback || '').split(';')[0].trim().toLowerCase();
  if (type.includes('mpegurl') || type.includes('x-mpegurl')) return 'application/vnd.apple.mpegurl';
  if (type.includes('mp2t')) return 'video/mp2t';
  if (type.includes('iso.segment')) return 'video/iso.segment';
  if (type.includes('mp4')) return 'video/mp4';
  if (type.includes('aac')) return 'audio/aac';

  const lower = pathname.toLowerCase();
  if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (lower.endsWith('.ts')) return 'video/mp2t';
  if (lower.endsWith('.m4s')) return 'video/iso.segment';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return fallback || 'application/octet-stream';
}

function sourcePreferenceScore(source) {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'basic') return 20;
  if (normalized === 'satellite') return 10;
  if (normalized === 'cable') return 5;
  return 0;
}

function qualityRank(channel, item) {
  const quality = item?.quality ?? null;
  const preferred = channel.prefer.indexOf(quality);
  const qualityScore = preferred >= 0 ? (100 - preferred) : 0;
  return qualityScore + sourcePreferenceScore(item?.source);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = SOURCE_TEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.cancel();
  }
}

async function findChannelMatches(channel) {
  const apiUrl = new URL('/api/channels', LIVEWATCH_ORIGIN);
  apiUrl.searchParams.set('country', channel.country);
  apiUrl.searchParams.set('limit', '20');
  apiUrl.searchParams.set('search', channel.search);

  const response = await fetch(apiUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`channels ${response.status}`);

  const data = await response.json();
  const matches = (data.channels || [])
    .filter(item => String(item.name || '').toLowerCase() === channel.exact.toLowerCase())
    .sort((a, b) => qualityRank(channel, b) - qualityRank(channel, a));

  if (!matches.length && Array.isArray(channel.fallbackIds)) {
    return [...channel.fallbackIds].sort((a, b) => qualityRank(channel, b) - qualityRank(channel, a));
  }

  if (!matches.length) throw new Error('channel not found');
  return matches;
}

function prioritizeCandidates(channelKey, matches) {
  const cached = sourceCache.get(channelKey);
  if (!cached || cached.expiresAt <= Date.now()) return matches;

  return [...matches].sort((a, b) => {
    if (a.id === cached.id) return -1;
    if (b.id === cached.id) return 1;
    return 0;
  });
}

async function resolveCandidate(candidate) {
  const streamUrl = new URL(`/api/stream/${encodeURIComponent(candidate.id)}`, LIVEWATCH_ORIGIN);
  const streamResponse = await fetchTextWithTimeout(streamUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!streamResponse.ok) throw new Error(`stream ${streamResponse.status}`);

  const streamData = await streamResponse.json();
  const upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  if (!isAllowedLivewatchUrl(upstreamUrl)) throw new Error('dynamic stream URL refused');

  const startedAt = Date.now();
  const master = await fetchTextWithTimeout(upstreamUrl, {
    headers: livewatchHeaders('application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(`master ${master.status}`);
  }

  return { candidate, upstreamUrl, masterText, latencyMs };
}

async function selectWorkingSource(channelKey, channel) {
  const matches = prioritizeCandidates(channelKey, await findChannelMatches(channel));
  const failures = [];

  for (const candidate of matches.slice(0, 5)) {
    try {
      const resolved = await resolveCandidate(candidate);
      sourceCache.set(channelKey, {
        id: candidate.id,
        expiresAt: Date.now() + SOURCE_CACHE_TTL_MS
      });
      return {
        ...resolved,
        detection: failures.length ? `fallback-after-${failures.length}-failure` : 'validated-primary'
      };
    } catch (error) {
      failures.push(`${candidate.id}:${error.message}`);
    }
  }

  sourceCache.delete(channelKey);
  throw new Error(`no valid source (${failures.join(', ')})`);
}

async function resolveIptvLive(request, requestUrl, channelKey) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const channel = LIVE_CHANNELS.get(channelKey);
  if (!channel) return new Response('Unknown channel', { status: 404, headers: corsHeaders() });

  let selected;
  try {
    selected = await selectWorkingSource(channelKey, channel);
  } catch (error) {
    return new Response(`Dynamic stream URL unavailable (${error.message})`, { status: 502, headers: corsHeaders() });
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', 'application/vnd.apple.mpegurl');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Ares-Channel', channelKey);
  headers.set('X-Ares-Source-Id', selected.candidate.id);
  headers.set('X-Ares-Source-Type', String(selected.candidate.source || 'unknown'));
  headers.set('X-Ares-Source-Quality', String(selected.candidate.quality || 'auto'));
  headers.set('X-Ares-Detection', `${selected.detection}; latency=${selected.latencyMs}ms`);
  headers.set('X-Ares-Resolved-At', new Date().toISOString());
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(rewritePlaylist(selected.masterText, selected.upstreamUrl, requestUrl.origin), { status: 200, headers });
}

async function proxyIptv(request, requestUrl) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  if (!rawUrl || rawUrl.length > 8192) {
    return new Response('Missing or invalid upstream URL', { status: 400, headers: corsHeaders() });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response('Invalid upstream URL', { status: 400, headers: corsHeaders() });
  }

  if (!isAllowedLivewatchUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', { status: 403, headers: corsHeaders() });
  }

  const upstreamHeaders = new Headers(livewatchHeaders(request.headers.get('Accept') || '*/*'));
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: 'follow'
  });

  const contentType = hlsContentType(upstreamUrl.pathname, upstream.headers.get('Content-Type'));
  const isPlaylist = request.method === 'GET' && contentType.toLowerCase().includes('mpegurl');

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');

  for (const name of ['Accept-Ranges', 'Content-Length', 'Content-Range']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (isPlaylist) {
    headers.delete('Content-Length');
    return new Response(rewritePlaylist(await upstream.text(), upstreamUrl, requestUrl.origin), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === PROXY_PATH) return proxyIptv(request, url);

    const liveMatch = url.pathname.match(/^\/api\/iptv\/live\/([a-z0-9-]+)\/master\.m3u8$/i);
    if (liveMatch) return resolveIptvLive(request, url, liveMatch[1].toLowerCase());

    if (url.pathname === '/api/iptv/channels') {
      return new Response(JSON.stringify(Array.from(LIVE_CHANNELS.keys())), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  }
};