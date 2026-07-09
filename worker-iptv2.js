const UPSTREAM_HOST = 'https://helpfullive.info';
const PROXY_PATH = '/api/iptv/proxy';
const LIVE_PREFIX = '/api/iptv/live/';
const LIVE_CHANNELS = new Map([
  ['6ter', {
    stream: '6ter',
    upstreamPath: '/6ter/index.m3u8',
    referer: 'https://endirecttv.com/yayin/?kanal=196&yayin=2'
  }],
  ['cstar', {
    stream: 'cstar',
    upstreamPath: '/cstar/index.m3u8',
    referer: 'https://endirecttv.com/yayin/?kanal=193&yayin='
  }],
  ['w9', {
    stream: 'w9',
    upstreamPath: '/w9/index.m3u8',
    referer: 'https://endirecttv.com/yayin/?kanal=187&yayin='
  }],
  ['m6', {
    stream: 'm6',
    upstreamPath: '/m6/index.m3u8',
    referer: 'https://endirecttv.com/yayin/?kanal=185&yayin='  
}]
]);
const ALLOWED_UPSTREAM_PATHS = [
  '/6ter/',
  '/cstar/',
  '/w9/',
  '/m6/'
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

  const sourceUrl = `https://endirecttv.com/token.php?stream=${channel.stream}`;
  const source = await fetch(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      Referer: channel.referer,
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
  const match = sourceHtml.match(/file\s*:\s*"([^"]+)"/i);
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
    upstreamUrl.pathname !== channel.upstreamPath ||
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
  headers.set('X-Ares-Channel', channel.stream);
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
