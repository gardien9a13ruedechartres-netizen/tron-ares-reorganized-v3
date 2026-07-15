const LIVEWATCH_ORIGIN = 'https://livewatch.top';
const LOVETIER_ORIGIN = 'https://deviantart.lovetier.bz';
const LOVETIER_PLAYER_ORIGIN = 'https://lovetier.bz';
const PROXY_PATH = '/api/proxy';
const LIVE_PATH = '/api/live/btv/master.m3u8';
const HEALTH_PATH = '/api/live/btv/health';
const SOURCE_TEST_TIMEOUT_MS = 7000;
const SOURCE_CACHE_TTL_MS = 30000;

const BTV_SOURCES = {
  basic: {
    kind: 'livewatch',
    id: '419434034c29c7a3c7b07-c30c1297e6e5ce',
    label: 'BTV basic HD'
  },
  cable: {
    kind: 'livewatch',
    id: '2434383426cedb9a7f8182-853d5b7284c58b',
    label: 'BTV Benfica cable'
  },
  stable: {
    kind: 'lovetier',
    id: 'legacy-lovetier-btv',
    channel: 'BTV1',
    label: 'BTV Lovetier stable'
  }
};

const DEFAULT_AUTO_ORDER = ['basic', 'cable', 'stable'];
const sourceCache = new Map();

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
    'Access-Control-Expose-Headers': [
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'X-BTV-Mode',
      'X-BTV-Source',
      'X-BTV-Source-Id',
      'X-BTV-Detection',
      'X-BTV-Latency',
      'X-BTV-Failures'
    ].join(', ')
  };
}

function upstreamHeaders(url, accept = '*/*') {
  const headers = {
    Accept: accept,
    'User-Agent': 'Mozilla/5.0'
  };
  if (url.origin === LIVEWATCH_ORIGIN) headers.Referer = `${LIVEWATCH_ORIGIN}/`;
  if (url.origin === LOVETIER_ORIGIN) headers.Referer = `${LOVETIER_ORIGIN}/`;
  return headers;
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = SOURCE_TEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.cancel();
  }
}

function isAllowedLivewatchUrl(url) {
  return url.origin === LIVEWATCH_ORIGIN &&
    url.pathname === '/api/hls' &&
    url.searchParams.has('t') &&
    !url.username &&
    !url.password;
}

function isAllowedLovetierUrl(url) {
  return url.origin === LOVETIER_ORIGIN &&
    url.pathname.toLowerCase().startsWith('/btv1/') &&
    !url.username &&
    !url.password;
}

function isAllowedProxyUrl(url) {
  return isAllowedLivewatchUrl(url) || isAllowedLovetierUrl(url);
}

function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedProxyUrl(upstream)) return value;
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

function parseOrder(requestUrl) {
  const skip = new Set(String(requestUrl.searchParams.get('skip') || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean));

  const raw = String(requestUrl.searchParams.get('order') || '').trim();
  const order = (raw ? raw.split(',') : DEFAULT_AUTO_ORDER)
    .map(value => value.trim().toLowerCase())
    .filter(value => BTV_SOURCES[value])
    .filter(value => !skip.has(value));

  return order.length ? order : DEFAULT_AUTO_ORDER.filter(value => !skip.has(value));
}

function cacheKey(mode, requestUrl) {
  if (mode !== 'auto') return '';
  return `auto:${parseOrder(requestUrl).join(',')}`;
}

function readCache(mode, requestUrl) {
  const key = cacheKey(mode, requestUrl);
  if (!key) return null;

  const cached = sourceCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    sourceCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(mode, requestUrl, value) {
  const key = cacheKey(mode, requestUrl);
  if (!key) return;

  sourceCache.set(key, {
    value,
    expiresAt: Date.now() + SOURCE_CACHE_TTL_MS
  });
}

function friendlySourceError(error) {
  let message = String(error?.message || error || 'network error');
  const suffix = ' ; source indisponible cote Cloudflare/TLS';
  while (message.includes(`${suffix}${suffix}`)) {
    message = message.replace(`${suffix}${suffix}`, suffix);
  }
  if (message.includes(suffix.trim())) return message;
  if (/526|certificate|certificat|ssl|tls|fetch failed|network/i.test(message)) {
    return `${message}${suffix}`;
  }
  return message;
}

async function resolveLivewatchSource(sourceName) {
  const source = BTV_SOURCES[sourceName];
  if (!source || source.kind !== 'livewatch') throw new Error(`unknown BTV source ${sourceName}`);

  const streamUrl = new URL(`/api/stream/${encodeURIComponent(source.id)}`, LIVEWATCH_ORIGIN);
  let streamResponse;
  try {
    streamResponse = await fetchWithTimeout(streamUrl, {
      headers: upstreamHeaders(new URL(LIVEWATCH_ORIGIN), 'application/json,text/plain,*/*'),
      redirect: 'follow'
    });
  } catch (error) {
    throw new Error(friendlySourceError(error));
  }

  if (!streamResponse.ok) {
    throw new Error(friendlySourceError(new Error(`stream ${streamResponse.status}`)));
  }

  const streamData = await streamResponse.json();
  const upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  if (!isAllowedLivewatchUrl(upstreamUrl)) throw new Error('livewatch URL refused');

  return fetchMaster(sourceName, source, upstreamUrl);
}

async function resolveLovetierSource(sourceName) {
  const source = BTV_SOURCES[sourceName];
  if (!source || source.kind !== 'lovetier') throw new Error(`unknown BTV source ${sourceName}`);

  const channel = source.channel;
  const playerUrl = new URL(`/player/${channel}`, LOVETIER_PLAYER_ORIGIN);
  const player = await fetchWithTimeout(playerUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  });
  if (!player.ok) throw new Error(`lovetier source ${player.status}`);

  const html = await player.text();
  const match = html.match(/streamUrl:\s*"([^"]+)"/i);
  if (!match || !match[1]) throw new Error('lovetier stream URL unavailable');

  const upstreamUrl = new URL(
    match[1]
      .replace(/\\\//g, '/')
      .replace(/\\u0026/gi, '&')
  );
  if (
    !isAllowedLovetierUrl(upstreamUrl) ||
    upstreamUrl.pathname.toLowerCase() !== `/${channel}/index.m3u8`.toLowerCase() ||
    !upstreamUrl.searchParams.has('token')
  ) {
    throw new Error('lovetier stream URL refused');
  }

  return fetchMaster(sourceName, source, upstreamUrl);
}

async function fetchMaster(sourceName, source, upstreamUrl) {
  const startedAt = Date.now();
  let master;
  try {
    master = await fetchWithTimeout(upstreamUrl, {
      headers: upstreamHeaders(upstreamUrl, 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
      redirect: 'follow'
    });
  } catch (error) {
    throw new Error(friendlySourceError(error));
  }

  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(friendlySourceError(new Error(`master ${master.status}`)));
  }

  return {
    mode: sourceName,
    source: sourceName,
    sourceId: source.id,
    label: source.label,
    upstreamUrl,
    masterText,
    latencyMs
  };
}

async function resolveSource(sourceName) {
  const source = BTV_SOURCES[sourceName];
  if (!source) throw new Error(`unknown BTV source ${sourceName}`);
  if (source.kind === 'lovetier') return resolveLovetierSource(sourceName);
  return resolveLivewatchSource(sourceName);
}

async function selectSource(mode, requestUrl) {
  const failures = [];
  const wanted = BTV_SOURCES[mode] ? mode : 'auto';

  if (wanted !== 'auto') {
    try {
      return {
        ...(await resolveSource(wanted)),
        detection: 'manual'
      };
    } catch (error) {
      throw new Error(`${wanted}:${friendlySourceError(error)}`);
    }
  }

  const cached = readCache(wanted, requestUrl);
  if (cached && BTV_SOURCES[cached.source]) {
    try {
      return {
        ...(await resolveSource(cached.source)),
        detection: 'cache'
      };
    } catch (error) {
      failures.push(`${cached.source}:${friendlySourceError(error)}`);
    }
  }

  for (const sourceName of parseOrder(requestUrl)) {
    try {
      const resolved = await resolveSource(sourceName);
      writeCache(wanted, requestUrl, { source: sourceName });
      return {
        ...resolved,
        detection: failures.length ? `auto-after-${failures.length}-failure` : 'auto'
      };
    } catch (error) {
      failures.push(`${sourceName}:${friendlySourceError(error)}`);
    }
  }

  throw new Error(failures.join(' | ') || 'no BTV source available');
}

async function handleLive(request, requestUrl) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const mode = String(requestUrl.searchParams.get('source') || 'auto').toLowerCase();
  let selected;
  try {
    selected = await selectSource(mode, requestUrl);
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('X-BTV-Mode', mode || 'auto');
    headers.set('X-BTV-Failures', String(error?.message || error).slice(0, 900));
    return new Response(
      `BTV unavailable: ${String(error?.message || error)}\n\n` +
      'Si cela mentionne TLS/certificate/526, Cloudflare ne peut pas fetch la source tant que le certificat source n est pas repare.',
      { status: 503, headers }
    );
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', 'application/vnd.apple.mpegurl');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-BTV-Mode', mode || 'auto');
  headers.set('X-BTV-Source', selected.source);
  headers.set('X-BTV-Source-Id', selected.sourceId);
  headers.set('X-BTV-Detection', selected.detection);
  headers.set('X-BTV-Latency', `${selected.latencyMs}ms`);

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(
    rewritePlaylist(selected.masterText, selected.upstreamUrl, requestUrl.origin),
    { status: 200, headers }
  );
}

async function handleProxy(request, requestUrl) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  if (!rawUrl || rawUrl.length > 4096) {
    return new Response('Missing or invalid upstream URL', { status: 400, headers: corsHeaders() });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response('Invalid upstream URL', { status: 400, headers: corsHeaders() });
  }

  if (!isAllowedProxyUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', { status: 403, headers: corsHeaders() });
  }

  const headersForUpstream = new Headers(upstreamHeaders(upstreamUrl, request.headers.get('Accept') || '*/*'));
  const range = request.headers.get('Range');
  if (range) headersForUpstream.set('Range', range);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: headersForUpstream,
      redirect: 'follow'
    });
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return new Response(`Upstream fetch failed: ${friendlySourceError(error)}`, {
      status: 502,
      headers
    });
  }

  const contentType = hlsContentType(upstreamUrl.pathname, upstream.headers.get('Content-Type'));
  const isPlaylist = request.method === 'GET' &&
    (contentType.toLowerCase().includes('mpegurl') || upstreamUrl.pathname.toLowerCase().endsWith('.m3u8'));

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
    const rewritten = rewritePlaylist(await upstream.text(), upstreamUrl, requestUrl.origin);
    return new Response(rewritten, { status: upstream.status, statusText: upstream.statusText, headers });
  }

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

async function handleHealth(requestUrl) {
  const results = {};
  for (const sourceName of Object.keys(BTV_SOURCES)) {
    try {
      const resolved = await resolveSource(sourceName);
      results[sourceName] = {
        ok: true,
        id: resolved.sourceId,
        label: resolved.label,
        latencyMs: resolved.latencyMs
      };
    } catch (error) {
      results[sourceName] = {
        ok: false,
        id: BTV_SOURCES[sourceName].id,
        label: BTV_SOURCES[sourceName].label,
        error: friendlySourceError(error)
      };
    }
  }

  return new Response(JSON.stringify({
    channel: 'btv',
    checkedAt: new Date().toISOString(),
    live: `${requestUrl.origin}${LIVE_PATH}`,
    results
  }, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function renderPlayer() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BTV LiveWatch Target</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js"></script>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;width:100%;height:100%;background:#000;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
    video{position:fixed;inset:0;width:100vw;height:100vh;object-fit:fill;background:#000}
    #toggle{position:fixed;top:10px;right:10px;z-index:20;width:42px;height:36px;border:1px solid rgba(255,255,255,.28);border-radius:8px;background:rgba(0,0,0,.46);color:#fff;font-size:20px;cursor:pointer}
    #panel{position:fixed;top:54px;right:10px;z-index:20;width:min(340px,calc(100vw - 20px));padding:12px;border:1px solid rgba(255,255,255,.22);border-radius:8px;background:rgba(8,12,18,.88);backdrop-filter:blur(10px);box-shadow:0 16px 50px rgba(0,0,0,.45)}
    #panel.hidden{display:none}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    button.mode{min-height:38px;border:1px solid rgba(255,255,255,.24);border-radius:7px;background:#111827;color:#e5e7eb;font-weight:700;cursor:pointer}
    button.mode.active{background:#dc2626;color:#fff;border-color:#fecaca}
    #status{position:fixed;left:12px;bottom:12px;z-index:15;max-width:min(760px,calc(100vw - 24px));padding:9px 11px;border-radius:7px;background:rgba(0,0,0,.55);font-size:13px;line-height:1.35;color:#fee2e2}
    #log{margin-top:10px;max-height:160px;overflow:auto;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#cbd5e1;white-space:pre-wrap}
    .copy{margin-top:8px;width:100%;min-height:34px;border:0;border-radius:7px;background:#334155;color:#fff;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  <video id="video" controls autoplay playsinline></video>
  <button id="toggle" title="Sources">=</button>
  <section id="panel" class="hidden">
    <div class="grid">
      <button class="mode active" data-source="auto">Auto</button>
      <button class="mode" data-source="basic">Basic HD</button>
      <button class="mode" data-source="cable">Cable</button>
      <button class="mode" data-source="stable">Stable</button>
    </div>
    <button id="copy" class="copy">Copier log</button>
    <div id="log"></div>
  </section>
  <div id="status">Pret</div>
  <script>
    const video = document.getElementById('video');
    const panel = document.getElementById('panel');
    const toggle = document.getElementById('toggle');
    const statusBox = document.getElementById('status');
    const logBox = document.getElementById('log');
    const copyButton = document.getElementById('copy');
    const buttons = Array.from(document.querySelectorAll('.mode'));
    const clientOrder = ['basic', 'cable', 'stable'];
    let hls = null;
    let mode = new URLSearchParams(location.search).get('source') || 'auto';
    let autoIndex = -1;

    function log(message) {
      const line = '[' + new Date().toLocaleTimeString('fr-FR') + '] ' + message;
      logBox.textContent = line + '\\n' + logBox.textContent;
      statusBox.textContent = message;
    }

    function setActive(value) {
      buttons.forEach(button => button.classList.toggle('active', button.dataset.source === value));
    }

    function destroyHls() {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.removeAttribute('src');
      video.load();
    }

    function streamUrl(source) {
      const params = new URLSearchParams();
      params.set('source', source);
      params.set('v', Date.now().toString());
      return '/api/live/btv/master.m3u8?' + params.toString();
    }

    function load(source, reason) {
      mode = source || 'auto';
      setActive(mode);
      destroyHls();
      const url = streamUrl(mode);
      log('Chargement BTV ' + mode + (reason ? ' (' + reason + ')' : ''));

      if (window.Hls && Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 10,
          maxBufferLength: 24,
          manifestLoadingTimeOut: 12000,
          levelLoadingTimeOut: 12000,
          fragLoadingTimeOut: 16000
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          log('Erreur HLS ' + data.details + (data.fatal ? ' fatal' : ''));
          if (data.fatal) handleFatal();
        });
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          log('Manifest OK ' + mode + ' niveaux=' + (data.levels ? data.levels.length : 0));
          video.play().catch(() => {});
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => {});
      } else {
        log('HLS non supporte par ce navigateur');
      }
    }

    function handleFatal() {
      if (mode !== 'auto' && !clientOrder.includes(mode)) {
        log('Source manuelle bloquee: ' + mode);
        return;
      }
      autoIndex += 1;
      if (autoIndex >= clientOrder.length) {
        log('Toutes les sources BTV ont echoue.');
        return;
      }
      load(clientOrder[autoIndex], 'secours manuel auto');
    }

    toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        autoIndex = -1;
        load(button.dataset.source, 'selection menu');
      });
    });
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(logBox.textContent || '');
        log('Log copie');
      } catch (_) {
        log('Copie impossible');
      }
    });

    video.addEventListener('playing', () => log('Lecture active ' + mode));
    video.addEventListener('waiting', () => log('Buffering ' + mode));
    video.addEventListener('error', () => {
      log('Erreur video native');
      handleFatal();
    });

    load(mode, 'demarrage');
  </script>
</body>
</html>`;
}

async function handleRequest(request) {
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname.toLowerCase();

  if (path === PROXY_PATH) return handleProxy(request, requestUrl);
  if (path === LIVE_PATH) return handleLive(request, requestUrl);
  if (path === HEALTH_PATH) return handleHealth(requestUrl);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  });
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(renderPlayer(), { status: 200, headers });
}
