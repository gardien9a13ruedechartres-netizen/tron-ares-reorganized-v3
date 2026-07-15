const LIVEWATCH_ORIGIN = 'https://livewatch.top';
const PROXY_PATH = '/api/proxy';
const LIVE_PATH = '/api/live/w9/master.m3u8';
const HEALTH_PATH = '/api/live/w9/health';
const SOURCE_TEST_TIMEOUT_MS = 7000;
const SOURCE_CACHE_TTL_MS = 30000;

const W9_SOURCES = {
  satellite: {
    id: '338554998683e8b650775f-03d803b21aa717',
    label: 'W9 basic HD'
  },
  basic: {
    id: '12804661554f36ca1095a-36724fff9f173c',
    label: 'W9 satellite HD'
  },
  cable: {
    id: '280062836403e9b757ac4c-427ac871825faa',
    label: 'W9 cable'
  }
};

const DEFAULT_AUTO_ORDER = ['satellite', 'basic', 'cable'];
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
      'X-W9-Mode',
      'X-W9-Source',
      'X-W9-Source-Id',
      'X-W9-Detection',
      'X-W9-Latency',
      'X-W9-Failures'
    ].join(', ')
  };
}

function livewatchHeaders(accept = '*/*') {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    'User-Agent': 'Mozilla/5.0'
  };
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

function parseOrder(requestUrl) {
  const skip = new Set(String(requestUrl.searchParams.get('skip') || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean));

  const raw = String(requestUrl.searchParams.get('order') || '').trim();
  const order = (raw ? raw.split(',') : DEFAULT_AUTO_ORDER)
    .map(value => value.trim().toLowerCase())
    .filter(value => W9_SOURCES[value])
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

function friendlyLivewatchError(error) {
  let message = String(error?.message || error || 'network error');
  const suffix = ' ; LiveWatch semble indisponible cote Cloudflare/TLS';
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
  const source = W9_SOURCES[sourceName];
  if (!source) throw new Error(`unknown W9 source ${sourceName}`);

  const streamUrl = new URL(`/api/stream/${encodeURIComponent(source.id)}`, LIVEWATCH_ORIGIN);
  let streamResponse;
  try {
    streamResponse = await fetchWithTimeout(streamUrl, {
      headers: livewatchHeaders('application/json,text/plain,*/*'),
      redirect: 'follow'
    });
  } catch (error) {
    throw new Error(friendlyLivewatchError(error));
  }

  if (!streamResponse.ok) {
    throw new Error(friendlyLivewatchError(new Error(`stream ${streamResponse.status}`)));
  }

  const streamData = await streamResponse.json();
  const upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  if (!isAllowedLivewatchUrl(upstreamUrl)) throw new Error('livewatch URL refused');

  const startedAt = Date.now();
  let master;
  try {
    master = await fetchWithTimeout(upstreamUrl, {
      headers: livewatchHeaders('application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
      redirect: 'follow'
    });
  } catch (error) {
    throw new Error(friendlyLivewatchError(error));
  }

  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(friendlyLivewatchError(new Error(`master ${master.status}`)));
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

async function selectSource(mode, requestUrl) {
  const failures = [];
  const wanted = W9_SOURCES[mode] ? mode : 'auto';

  if (wanted !== 'auto') {
    try {
      return {
        ...(await resolveLivewatchSource(wanted)),
        detection: 'manual'
      };
    } catch (error) {
      throw new Error(`${wanted}:${friendlyLivewatchError(error)}`);
    }
  }

  const cached = readCache(wanted, requestUrl);
  if (cached && W9_SOURCES[cached.source]) {
    try {
      return {
        ...(await resolveLivewatchSource(cached.source)),
        detection: 'cache'
      };
    } catch (error) {
      failures.push(`${cached.source}:${friendlyLivewatchError(error)}`);
    }
  }

  for (const sourceName of parseOrder(requestUrl)) {
    try {
      const resolved = await resolveLivewatchSource(sourceName);
      writeCache(wanted, requestUrl, { source: sourceName });
      return {
        ...resolved,
        detection: failures.length ? `auto-after-${failures.length}-failure` : 'auto'
      };
    } catch (error) {
      failures.push(`${sourceName}:${friendlyLivewatchError(error)}`);
    }
  }

  throw new Error(failures.join(' | ') || 'no W9 source available');
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
    headers.set('X-W9-Mode', mode || 'auto');
    headers.set('X-W9-Failures', String(error?.message || error).slice(0, 900));
    return new Response(
      `W9 LiveWatch unavailable: ${String(error?.message || error)}\n\n` +
      'If this mentions TLS/certificate/526, Cloudflare cannot fetch LiveWatch until the source certificate is fixed.',
      { status: 503, headers }
    );
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', 'application/vnd.apple.mpegurl');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-W9-Mode', mode || 'auto');
  headers.set('X-W9-Source', selected.source);
  headers.set('X-W9-Source-Id', selected.sourceId);
  headers.set('X-W9-Detection', selected.detection);
  headers.set('X-W9-Latency', `${selected.latencyMs}ms`);

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

  if (!isAllowedLivewatchUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', { status: 403, headers: corsHeaders() });
  }

  const upstreamHeaders = new Headers(livewatchHeaders(request.headers.get('Accept') || '*/*'));
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow'
    });
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return new Response(`Upstream fetch failed: ${friendlyLivewatchError(error)}`, {
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
  for (const sourceName of Object.keys(W9_SOURCES)) {
    try {
      const resolved = await resolveLivewatchSource(sourceName);
      results[sourceName] = {
        ok: true,
        id: resolved.sourceId,
        label: resolved.label,
        latencyMs: resolved.latencyMs
      };
    } catch (error) {
      results[sourceName] = {
        ok: false,
        id: W9_SOURCES[sourceName].id,
        label: W9_SOURCES[sourceName].label,
        error: friendlyLivewatchError(error)
      };
    }
  }

  return new Response(JSON.stringify({
    channel: 'w9',
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
  <title>W9 LiveWatch Target</title>
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
    button.mode.active{background:#0ea5e9;color:#001018;border-color:#7dd3fc}
    #status{position:fixed;left:12px;bottom:12px;z-index:15;max-width:min(760px,calc(100vw - 24px));padding:9px 11px;border-radius:7px;background:rgba(0,0,0,.55);font-size:13px;line-height:1.35;color:#dbeafe}
    #log{margin-top:10px;max-height:160px;overflow:auto;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#cbd5e1;white-space:pre-wrap}
    .copy{margin-top:8px;width:100%;min-height:34px;border:0;border-radius:7px;background:#334155;color:#fff;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  <video id="video" controls autoplay playsinline></video>
  <button id="toggle" title="Sources">☰</button>
  <section id="panel" class="hidden">
    <div class="grid">
      <button class="mode active" data-source="auto">Auto</button>
      <button class="mode" data-source="basic">Basic HD</button>
      <button class="mode" data-source="satellite">Satellite HD</button>
      <button class="mode" data-source="cable">Cable</button>
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
    const clientOrder = ['basic', 'satellite', 'cable'];
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
      return '/api/live/w9/master.m3u8?' + params.toString();
    }

    function load(source, reason) {
      mode = source || 'auto';
      setActive(mode);
      destroyHls();
      const url = streamUrl(mode);
      log('Chargement W9 ' + mode + (reason ? ' (' + reason + ')' : ''));

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
        log('Toutes les sources W9 ont echoue. Si le certificat LiveWatch est expire, Cloudflare ne peut pas contourner.');
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
