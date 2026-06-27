const CMTVPT_UPSTREAM_HOST = 'clouding.wideiptv.top';
const CMTVPT_PROXY_PATH = '/api/cmtvpt/proxy';
const ALLOWED_UPSTREAM_PATHS = [
  '/CMTVPT/',
  '/RTP1/',
  '/RTP2/',
  '/SIC/'
];

function isAllowedCmtvptUrl(url) {
  return url.protocol === 'https:' &&
    url.hostname === CMTVPT_UPSTREAM_HOST &&
    ALLOWED_UPSTREAM_PATHS.some(path => url.pathname.startsWith(path)) &&
    !url.username &&
    !url.password;
}

function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedCmtvptUrl(upstream)) return value;
    return `${publicOrigin}${CMTVPT_PROXY_PATH}?url=${encodeURIComponent(upstream.href)}`;
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

async function proxyCmtvpt(request, requestUrl) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range'
      }
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  if (!rawUrl || rawUrl.length > 4096) {
    return new Response('Missing or invalid upstream URL', { status: 400 });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response('Invalid upstream URL', { status: 400 });
  }
  if (!isAllowedCmtvptUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', { status: 403 });
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
    (contentType.includes('mpegurl') || upstreamUrl.pathname.endsWith('.m3u8'));
  const headers = new Headers({
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store'
  });

  for (const name of ['Accept-Ranges', 'Content-Range']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (isPlaylist) {
    const rewritten = rewritePlaylist(
      await upstream.text(),
      upstreamUrl,
      requestUrl.origin
    );
    return new Response(rewritten, { status: upstream.status, headers });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === CMTVPT_PROXY_PATH) {
      return proxyCmtvpt(request, url);
    }

    const response = await env.ASSETS.fetch(request);

    if (/^\/pages\/(?:cmtvpt|rtp1|rtp2|sic)(?:\.html)?$/i.test(url.pathname)) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return response;
  }
};
