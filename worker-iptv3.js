const LIVEWATCH_ORIGIN = 'https://livewatch.top';
const PROXY_PATH = '/api/iptv/proxy';

const LIVE_CHANNELS = new Map([
  ['6ter', { search: '6TER', exact: '6TER', country: 'France', prefer: ['FHD', 'HD', null] }],
  ['cstar', { search: 'C STAR', exact: 'C STAR', country: 'France', prefer: ['FHD', 'HD', null] }],
  ['w9', { search: 'W9', exact: 'W9', country: 'France', prefer: ['HD', 'FHD', null] }],
  ['cmtv', { search: 'CM TV', exact: 'CM TV', country: 'Portugal', prefer: [null, 'HD', 'FHD'] }],
  ['m6', { search: 'M6', exact: 'M6', country: 'France', prefer: ['FHD', 'HD', null] }]
]);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Ares-Channel, X-Ares-Source-Id'
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

function qualityRank(channel, item) {
  const quality = item?.quality ?? null;
  const source = String(item?.source || '').toLowerCase();
  const preferred = channel.prefer.indexOf(quality);
  const qualityScore = preferred >= 0 ? (100 - preferred) : 0;
  const sourceScore = source === 'basic' ? 20 : source === 'satellite' ? 10 : source === 'cable' ? 5 : 0;
  return qualityScore + sourceScore;
}

async function findChannel(channel) {
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

  if (!matches.length) throw new Error('channel not found');
  return matches[0];
}

async function resolveIptvLive(request, requestUrl, channelKey) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const channel = LIVE_CHANNELS.get(channelKey);
  if (!channel) return new Response('Unknown channel', { status: 404, headers: corsHeaders() });

  let selected;
  let streamData;
  try {
    selected = await findChannel(channel);
    const streamUrl = new URL(`/api/stream/${encodeURIComponent(selected.id)}`, LIVEWATCH_ORIGIN);
    const streamResponse = await fetch(streamUrl, {
      headers: livewatchHeaders('application/json,text/plain,*/*'),
      redirect: 'follow'
    });
    if (!streamResponse.ok) throw new Error(`stream ${streamResponse.status}`);
    streamData = await streamResponse.json();
  } catch (error) {
    return new Response(`Dynamic stream URL unavailable (${error.message})`, { status: 502, headers: corsHeaders() });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  } catch (_) {
    return new Response('Invalid dynamic stream URL', { status: 502, headers: corsHeaders() });
  }

  if (!isAllowedLivewatchUrl(upstreamUrl)) {
    return new Response('Dynamic stream URL refused', { status: 502, headers: corsHeaders() });
  }

  const master = await fetch(upstreamUrl, {
    headers: livewatchHeaders('application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    return new Response(`Master validation failed (${master.status})`, { status: 502, headers: corsHeaders() });
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', 'application/vnd.apple.mpegurl');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Ares-Channel', channelKey);
  headers.set('X-Ares-Source-Id', selected.id);
  headers.set('X-Ares-Resolved-At', new Date().toISOString());
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(rewritePlaylist(masterText, upstreamUrl, requestUrl.origin), { status: 200, headers });
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