const UPSTREAM_HOST = 'https://deviantart.lovetier.bz';
const PROXY_PATH = '/api/iptv/proxy';
const LIVE_PREFIX = '/api/iptv/live/';
const LIVE_CHANNELS = new Map([
  ['btv', 'BTV1'],
  ['sport-tv-1', 'SPT1'],
  ['sport-tv-5', 'SPT5'],
  ['dazn-1', 'ELEVEN1'],
  ["dazn-5", "ELEVEN5"],
  ["canalplfr", "CANALPLFR"],
  ["m6fr", "M6FR"],
  ["tf1fr", "TF1FR"],
  ["sport-tv-2", "SPT2"],
  ["sport-tv-3", "SPT3"],
  ["sport-tv-4", "SPT4"],
  ["sport-tv-plus", "SPTPlus"],
  ["dazn-2", "ELEVEN2"],
  ["dazn-3", "ELEVEN3"],
  ["dazn-4", "ELEVEN4"],
  ["canal-11", "Canal11"],
  ["a-bola", "ABOLA"],
  ["sporting", "SPORTING"],
  ["bein-sports-1", "BEINSPORT1FR"],
  ["bein-sports-2", "BEINSPORT2FR"],
  ["bein-sports-3", "BEINSPORT3FR"],
  ["canal-foot", "FOOTPLUSFR"],
  ["canal-sport", "CANALSPORTFR"],
  ["canal-sport-360", "CANALS360"],
  ["canal-docs", "CANALPLDOCS"],
  ["eurosport-1", "Euro1FR"],
  ["eurosport-2", "Euro2FR"],
  ["l-equipe", "EQUIPEFR"],
  ["equidia", "ER1FR"],
  ["rmc-sport-1", "RMCSPORT1FR"],
  ["rmc-sport-2", "RMCSPORT2FR"]
]);
const ALLOWED_UPSTREAM_PATHS = [
  '/BTV1/',
  '/SPT5/',
  '/SPT1/',
  '/ELEVEN1/',
  '/ELEVEN5/',
  '/CANALPLFR/',
  '/M6FR/',
  '/TF1FR/',
  '/SPT2/',
  '/SPT3/',
  '/SPT4/',
  '/SPTPlus/',
  '/ELEVEN2/',
  '/ELEVEN3/',
  '/ELEVEN4/',
  '/Canal11/',
  '/ABOLA/',
  '/SPORTING/',
  '/BEINSPORT1FR/',
  '/BEINSPORT2FR/',
  '/BEINSPORT3FR/',
  '/FOOTPLUSFR/',
  '/CANALSPORTFR/',
  '/CANALS360/',
  '/CANALPLDOCS/',
  '/Euro1FR/',
  '/Euro2FR/',
  '/EQUIPEFR/',
  '/ER1FR/',
  '/RMCSPORT1FR/',
  '/RMCSPORT2FR/'
];

const UPSTREAM_ORIGIN = new URL(UPSTREAM_HOST).origin;

function isAllowedUpstreamUrl(url) {
  return url.origin === UPSTREAM_ORIGIN &&
    ALLOWED_UPSTREAM_PATHS.some(path => url.pathname.startsWith(path)) &&
    !url.username &&
    !url.password;
}

function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedUpstreamUrl(upstream)) return value;
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

    return line.replace(/URI="([^"]+)"/g, (match, value) => {
      return `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`;
    });
  }).join('\n');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range'
  };
}

async function resolveIptvLive(request, requestUrl, channelKey) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const channel = LIVE_CHANNELS.get(channelKey);
  if (!channel) {
    return new Response('Unknown channel', { status: 404, headers: corsHeaders() });
  }

  const sourceUrl = `https://lovetier.bz/player/${channel}`;
  const source = await fetch(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  });
  if (!source.ok) {
    return new Response(`Source unavailable (${source.status})`, {
      status: 502,
      headers: corsHeaders()
    });
  }

  const sourceHtml = await source.text();
  const match = sourceHtml.match(/streamUrl:\s*"([^"]+)"/i);
  if (!match || !match[1]) {
    return new Response('Dynamic stream URL unavailable', {
      status: 502,
      headers: corsHeaders()
    });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(
      match[1]
        .replace(/\\\//g, '/')
        .replace(/\\u0026/gi, '&')
    );
  } catch (_) {
    return new Response('Invalid dynamic stream URL', {
      status: 502,
      headers: corsHeaders()
    });
  }
  if (
    !isAllowedUpstreamUrl(upstreamUrl) ||
    upstreamUrl.pathname !== `/${channel}/index.m3u8` ||
    !upstreamUrl.searchParams.has('token')
  ) {
    return new Response('Dynamic stream URL refused', {
      status: 502,
      headers: corsHeaders()
    });
  }

  const master = await fetch(upstreamUrl, {
    headers: { Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*' },
    redirect: 'follow'
  });
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    return new Response(`Master validation failed (${master.status})`, {
      status: 502,
      headers: corsHeaders()
    });
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', 'application/vnd.apple.mpegurl');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Ares-Channel', channel);
  headers.set('X-Ares-Resolved-At', new Date().toISOString());
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(
    rewritePlaylist(masterText, upstreamUrl, requestUrl.origin),
    { status: 200, headers }
  );
}

async function proxyIptv(request, requestUrl) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders()
    });
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  if (!rawUrl || rawUrl.length > 4096) {
    return new Response('Missing or invalid upstream URL', {
      status: 400,
      headers: corsHeaders()
    });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response('Invalid upstream URL', {
      status: 400,
      headers: corsHeaders()
    });
  }

  if (!isAllowedUpstreamUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', {
      status: 403,
      headers: corsHeaders()
    });
  }

  const upstreamHeaders = new Headers({
    Accept: request.headers.get('Accept') || '*/*'
  });
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: 'follow'
  });

  const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
  const isPlaylist = request.method === 'GET' &&
    (contentType.toLowerCase().includes('mpegurl') ||
      upstreamUrl.pathname.toLowerCase().endsWith('.m3u8'));

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
    const rewritten = rewritePlaylist(
      await upstream.text(),
      upstreamUrl,
      requestUrl.origin
    );
    return new Response(rewritten, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === PROXY_PATH) {
      return proxyIptv(request, url);
    }

    const liveMatch = url.pathname.match(/^\/api\/iptv\/live\/([a-z0-9-]+)\/master\.m3u8$/i);
    if (liveMatch) {
      return resolveIptvLive(request, url, liveMatch[1].toLowerCase());
    }

    return new Response('Not found', { status: 404 });
  }
};
