import { parse } from 'devalue';

const CMTVPT_UPSTREAM_HOST = 'clouding.wideiptv.top';
const CMTVPT_PROXY_PATH = '/api/cmtvpt/proxy';
const WORKER_LIVE_PREFIX = '/api/worker-live/';
const SPORTTV_EPG_PATH = '/api/sporttv-epg';
const SPORTTV_GUIDE_URL = 'https://www.sporttv.pt/guia';
const WAVEWATCH_ORIGIN = 'https://lecteur-wavewatch-universal-stable.victor-salema-53d.workers.dev';
const WAVEWATCH_PROXY_PATHS = new Set([
  '/api/search',
  '/api/timeline',
  '/api/next',
  '/api/tmdb/browse',
  '/sse'
]);
const SPORTTV_CHANNELS = new Map([
  [727, 'sport-tv-1'],
  [728, 'sport-tv-2'],
  [729, 'sport-tv-3'],
  [5406, 'sport-tv-4'],
  [5422, 'sport-tv-5']
]);
const LIVE_CHANNELS = new Map([
  ['cmtvpt', 'CMTVPT'],
  ['rtp1', 'RTP1'],
  ['rtp2', 'RTP2'],
  ['rtp3', 'RTP3'],
  ['sic', 'SIC'],
  ['porto-canal', 'PortoCanal'],
  ['rtp-africa', 'RTPAfrica'],
  ['record-europa', 'RecordEuropa'],
  ['tvi', 'TVI'],
  ['tvi-reality', 'TVIReality'],
  ['tvi-ficcao', 'TVI_Ficcao'],
  ['v-plus-tvi', 'VPlusTVI'],
  ['cnn-portugal', 'CNN-PT'],
  ['tvi-internacional', 'TVI-INT'],
  ['sic-noticias', 'SIC-NOTICIAS']
]);
const ALLOWED_UPSTREAM_PATHS = [
  '/CMTVPT/',
  '/RTP1/',
  '/RTP2/',
  '/RTP3/',
  '/SIC/',
  '/PortoCanal/',
  '/RTPAfrica/',
  '/RecordEuropa/',
  '/TVI/',
  '/TVIReality/',
  '/TVI_Ficcao/',
  '/VPlusTVI/',
  '/CNN-PT/',
  '/TVI-INT/',
  '/SIC-NOTICIAS/'
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

function programSummary(item) {
  const startsAt = Number(item.data);
  const duration = Number(item.duracao);
  if (!Number.isFinite(startsAt) || !Number.isFinite(duration)) return null;

  return {
    title: String(item.descricao || item.evento?.nome || '').trim(),
    subtitle: String(item.agregador2?.nome || item.evento?.nome || '').trim(),
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + duration).toISOString(),
    live: String(item.tipoEmissao || '').toUpperCase() === 'DIRETO',
    image: typeof item.imagem === 'string' ? item.imagem : ''
  };
}

async function resolveSportTvEpg(request) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, stale-if-error=86400'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }

  try {
    const guide = await fetch(SPORTTV_GUIDE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0'
      },
      cf: { cacheEverything: true, cacheTtl: 300 }
    });
    if (!guide.ok) throw new Error(`Guide unavailable (${guide.status})`);

    const html = await guide.text();
    const payloadMatch = html.match(
      /<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!payloadMatch) throw new Error('Nuxt guide payload unavailable');

    const identity = value => value;
    const payload = parse(payloadMatch[1], {
      Reactive: identity,
      Ref: identity,
      ShallowReactive: identity,
      ShallowRef: identity,
      EmptyRef: () => undefined,
      NuxtError: identity
    });

    const schedules = Object.values(payload?.data || {}).find(value =>
      Array.isArray(value) &&
      value.length > 100 &&
      value.some(item => item?.canal?.id && item?.data && item?.duracao)
    );
    if (!schedules) throw new Error('Sport TV schedules unavailable');

    const now = Date.now();
    const channels = {};

    for (const [channelId, key] of SPORTTV_CHANNELS) {
      const items = schedules
        .filter(item => Number(item?.canal?.id) === channelId)
        .sort((a, b) => Number(a.data) - Number(b.data));
      const current = items.find(item =>
        Number(item.data) <= now && now < Number(item.data) + Number(item.duracao)
      );
      const next = items.find(item => Number(item.data) > now);

      channels[key] = {
        name: String(current?.canal?.nome || next?.canal?.nome || key),
        current: current ? programSummary(current) : null,
        next: next ? programSummary(next) : null
      };
    }

    const body = JSON.stringify({
      source: SPORTTV_GUIDE_URL,
      updatedAt: new Date().toISOString(),
      channels
    });
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: cors });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Sport TV guide unavailable', detail: String(error?.message || error) }),
      { status: 502, headers: { ...cors, 'Cache-Control': 'no-store' } }
    );
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

async function resolveWorkerLive(request, requestUrl, channelKey) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
      }
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const channel = LIVE_CHANNELS.get(channelKey);
  if (!channel) return new Response('Unknown channel', { status: 404 });

  const sourceUrl = `https://popcdn.day/player.php?stream=${channel}`;
  const source = await fetch(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  });
  if (!source.ok) {
    return new Response(`Source unavailable (${source.status})`, { status: 502 });
  }

  const sourceHtml = await source.text();
  const pattern = new RegExp(
    `https://clouding\\.wideiptv\\.top/${channel}/embed\\.html\\?token=([^"'\\s<>&]+)`,
    'i'
  );
  const match = sourceHtml.match(pattern);
  if (!match || !match[1]) {
    return new Response('Dynamic token unavailable', { status: 502 });
  }

  const embedUrl = match[0];
  const embed = await fetch(embedUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow'
  });
  if (!embed.ok) {
    return new Response(`Embed activation failed (${embed.status})`, { status: 502 });
  }
  await embed.arrayBuffer();

  const upstreamPath = `/${channel}/index.fmp4.m3u8`;
  const upstreamUrl = new URL(`https://${CMTVPT_UPSTREAM_HOST}${upstreamPath}`);
  upstreamUrl.searchParams.set('token', match[1]);
  const master = await fetch(upstreamUrl, {
    headers: { Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*' },
    redirect: 'follow'
  });
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    return new Response(`Master validation failed (${master.status})`, { status: 502 });
  }

  const headers = new Headers({
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Ares-Channel': channel,
    'X-Ares-Resolved-At': new Date().toISOString()
  });
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(
    rewritePlaylist(masterText, upstreamUrl, requestUrl.origin),
    { status: 200, headers }
  );
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

async function resolveSerieFilmPage(request, url) {
  const upstreamUrl = new URL('/', WAVEWATCH_ORIGIN);
  upstreamUrl.search = url.search;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
    }
  });

  let html = await upstream.text();
  html = html
    .replace(/href="\/style\.css"/g, `href="${WAVEWATCH_ORIGIN}/style.css"`)
    .replace(/src="\/app\.js"/g, `src="${WAVEWATCH_ORIGIN}/app.js"`)
    .replace('</head>', `<style>
.search-panel::before{display:none!important;opacity:0!important;pointer-events:none!important}
.search-panel .search-row,.search-panel .search-info,.search-panel .search-results{
  opacity:1!important;
  transform:none!important;
  pointer-events:auto!important;
}
.search-input{
  user-select:text!important;
  -webkit-user-select:text!important;
  pointer-events:auto!important;
}
body.ares-playback-active .search-panel:not(:hover):not(:focus-within)::before{
  display:flex!important;
  opacity:.42!important;
  transform:none!important;
}
body.ares-playback-active .search-panel:not(:hover):not(:focus-within) .search-row,
body.ares-playback-active .search-panel:not(:hover):not(:focus-within) .search-info,
body.ares-playback-active .search-panel:not(:hover):not(:focus-within) .search-results{
  opacity:0!important;
  transform:translateY(-8px)!important;
  pointer-events:none!important;
}
</style><script>
(function(){
  function updateSearchPanelMode(){
    var video = document.getElementById('videoEl');
    var embed = document.getElementById('embedFrame');
    var videoActive = !!(video && video.style.display !== 'none' && video.currentTime > 0 && !video.paused);
    var embedActive = !!(embed && embed.style.display !== 'none' && embed.src && embed.src !== 'about:blank');
    document.body.classList.toggle('ares-playback-active', videoActive || embedActive);
  }
  document.addEventListener('play', updateSearchPanelMode, true);
  document.addEventListener('pause', updateSearchPanelMode, true);
  document.addEventListener('timeupdate', updateSearchPanelMode, true);
  setInterval(updateSearchPanelMode, 700);
})();
</script>
</head>`);

  return new Response(html, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

async function proxyWavewatchRequest(request, url) {
  const upstreamUrl = new URL(url.pathname + url.search, WAVEWATCH_ORIGIN);
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(WAVEWATCH_ORIGIN).host);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow'
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  responseHeaders.set('CDN-Cache-Control', 'no-store');
  responseHeaders.set('Cloudflare-CDN-Cache-Control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (/^\/pages\/serie-film(?:\.html)?$/i.test(url.pathname)) {
      return resolveSerieFilmPage(request, url);
    }

    if (WAVEWATCH_PROXY_PATHS.has(url.pathname)) {
      return proxyWavewatchRequest(request, url);
    }

    if (url.pathname === SPORTTV_EPG_PATH) {
      return resolveSportTvEpg(request);
    }

    if (url.pathname === CMTVPT_PROXY_PATH) {
      return proxyCmtvpt(request, url);
    }

    const liveMatch = url.pathname.match(/^\/api\/worker-live\/([a-z0-9-]+)\/master\.m3u8$/i);
    if (liveMatch) {
      return resolveWorkerLive(request, url, liveMatch[1].toLowerCase());
    }

    const response = await env.ASSETS.fetch(request);

    if (/^\/pages\/(?:worker-)?(?:cmtvpt|rtp1|rtp2|sic)(?:\.html)?$/i.test(url.pathname)) {
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
