const LIVEWATCH_ORIGIN = "https://livewatch.top";
const PROXY_PATH = "/api/proxy";
const SOURCE_TEST_TIMEOUT_MS = 7000;
const SOURCE_CACHE_TTL_MS = 30000;

const CHANNELS = {
  cmtv: {
    label: "CMTV",
    defaultOrder: ["cable", "basic"],
    sources: {
      cable: {
        id: "805844173b05e1a81e31d-579768661fe265",
        label: "LiveWatch cable"
      },
      basic: {
        id: "384601660517fa3552a29f-6816b5893e5bcc",
        label: "LiveWatch basic"
      }
    }
  },
  w9: {
    label: "W9",
    defaultOrder: ["satellite", "basic", "cable"],
    sources: {
      satellite: {
        id: "338554998683e8b650775f-03d803b21aa717",
        label: "LiveWatch satellite"
      },
      basic: {
        id: "12804661554f36ca1095a-36724fff9f173c",
        label: "LiveWatch basic"
      },
      cable: {
        id: "280062836403e9b757ac4c-427ac871825faa",
        label: "LiveWatch cable"
      }
    }
  },
  btv: {
    label: "BTV",
    defaultOrder: ["basic", "cable"],
    sources: {
      basic: {
        id: "419434034c29c7a3c7b07-c30c1297e6e5ce",
        label: "LiveWatch basic HD"
      },
      cable: {
        id: "2434383426cedb9a7f8182-853d5b7284c58b",
        label: "LiveWatch cable"
      }
    }
  },
  tf1: {
    label: "TF1",
    defaultOrder: ["satellite", "basic"],
    sources: {
      satellite: {
        id: "2913521200ae11151a1fc4-b5746bd2522e5c",
        label: "LiveWatch satellite"
      },
      basic: {
        id: "1334669376bf508b8ed995-e1dc32893923cf",
        label: "LiveWatch basic FHD"
      }
    }
  },
  tf1sf: {
    label: "TF1 Series & Film",
    defaultOrder: ["satellite", "satellite-hd"],
    sources: {
      satellite: {
        id: "1760063888f6e9e21d8039-e1c647aa24dff8",
        label: "LiveWatch satellite"
      },
      "satellite-hd": {
        id: "3049436856cd6a1575450a-d6ab2a40a54f7a",
        label: "LiveWatch satellite HD"
      }
    }
  },
  "canal-panda": {
    label: "Canal Panda",
    defaultOrder: ["cable", "basic"],
    sources: {
      cable: {
        id: "26958390437906a5f4ba97-d22b5eb462d646",
        label: "LiveWatch cable"
      },
      basic: {
        id: "4002241315e5ee10f4b753-97c7a8325393c2",
        label: "LiveWatch basic"
      }
    }
  },
  "canal-plus": {
    label: "CANAL+",
    defaultOrder: ["cable", "satellite", "basic-fhd", "basic-hd", "basic-4k"],
    sources: {
      cable: {
        id: "1839597702d549646f5393-2ac8f134e5cc3d",
        label: "LiveWatch cable"
      },
      satellite: {
        id: "6981957d8c5d6ef6ebe-00e248dcf7e873",
        label: "LiveWatch satellite"
      },
      "basic-fhd": {
        id: "298747715234a3a02669b8-699fafb82ad92d",
        label: "LiveWatch basic FHD"
      },
      "basic-hd": {
        id: "1860727909951701e97ea9-0552c051c6ab52",
        label: "LiveWatch basic HD"
      },
      "basic-4k": {
        id: "2421698062be5948a928f5-92450af7cf51c2",
        label: "LiveWatch basic 4K"
      }
    }
  }
};

const sourceCache = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Accept, Content-Type",
    "Access-Control-Expose-Headers": [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "X-Livewatch-Smart-Channel",
      "X-Livewatch-Smart-Mode",
      "X-Livewatch-Smart-Source",
      "X-Livewatch-Smart-Source-Id",
      "X-Livewatch-Smart-Detection",
      "X-Livewatch-Smart-Latency"
    ].join(", ")
  };
}

function livewatchHeaders(accept = "*/*") {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    "User-Agent": "Mozilla/5.0"
  };
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), ms);
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

function normalizeChannelKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function getChannel(channelKey) {
  const normalized = normalizeChannelKey(channelKey || "cmtv");
  return CHANNELS[normalized] ? { key: normalized, config: CHANNELS[normalized] } : null;
}

function isAllowedLivewatchUrl(url) {
  return url.origin === LIVEWATCH_ORIGIN &&
    url.pathname === "/api/hls" &&
    url.searchParams.has("t") &&
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
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith("#")) return makeProxyUrl(trimmed, upstreamUrl, publicOrigin);
    return line
      .replace(/URI="([^"]+)"/g, (match, value) => `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`)
      .replace(/URI='([^']+)'/g, (match, value) => `URI='${makeProxyUrl(value, upstreamUrl, publicOrigin)}'`);
  }).join("\n");
}

function hlsContentType(pathname, fallback) {
  const type = String(fallback || "").split(";")[0].trim().toLowerCase();
  if (type.includes("mpegurl") || type.includes("x-mpegurl")) return "application/vnd.apple.mpegurl";
  if (type.includes("mp2t")) return "video/mp2t";
  if (type.includes("iso.segment")) return "video/iso.segment";
  if (type.includes("mp4")) return "video/mp4";
  if (type.includes("aac")) return "audio/aac";
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".ts")) return "video/mp2t";
  if (lower.endsWith(".m4s")) return "video/iso.segment";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  return fallback || "application/octet-stream";
}

function parseOrder(requestUrl, channel) {
  const skip = new Set(String(requestUrl.searchParams.get("skip") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean));
  const raw = String(requestUrl.searchParams.get("order") || "").trim();
  const order = (raw ? raw.split(",") : channel.defaultOrder)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => channel.sources[value])
    .filter((value) => !skip.has(value));
  return order.length ? order : channel.defaultOrder.filter((value) => !skip.has(value));
}

function cacheKey(channelKey, mode, requestUrl, channel) {
  if (mode !== "auto") return "";
  return `${channelKey}:auto:${parseOrder(requestUrl, channel).join(",")}`;
}

function readCache(channelKey, mode, requestUrl, channel) {
  const key = cacheKey(channelKey, mode, requestUrl, channel);
  if (!key) return null;
  const cached = sourceCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    sourceCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(channelKey, mode, requestUrl, channel, value) {
  const key = cacheKey(channelKey, mode, requestUrl, channel);
  if (!key) return;
  sourceCache.set(key, { value, expiresAt: Date.now() + SOURCE_CACHE_TTL_MS });
}

async function resolveLivewatchSource(channelKey, channel, sourceName) {
  const source = channel.sources[sourceName];
  if (!source) throw new Error(`unknown source ${sourceName}`);
  const streamUrl = new URL(`/api/stream/${encodeURIComponent(source.id)}`, LIVEWATCH_ORIGIN);
  const streamResponse = await fetchWithTimeout(streamUrl, {
    headers: livewatchHeaders("application/json,text/plain,*/*"),
    redirect: "follow"
  });
  if (!streamResponse.ok) throw new Error(`stream ${streamResponse.status}`);
  const streamData = await streamResponse.json();
  const upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  if (!isAllowedLivewatchUrl(upstreamUrl)) throw new Error("livewatch URL refused");
  const startedAt = Date.now();
  const master = await fetchWithTimeout(upstreamUrl, {
    headers: livewatchHeaders("application/vnd.apple.mpegurl,application/x-mpegURL,*/*"),
    redirect: "follow"
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`master ${master.status}`);
  }
  return {
    channelKey,
    mode: sourceName,
    source: sourceName,
    sourceId: source.id,
    label: source.label,
    upstreamUrl,
    masterText,
    latencyMs
  };
}

async function resolveAutoSource(channelKey, channel, requestUrl) {
  const failures = [];
  const cached = readCache(channelKey, "auto", requestUrl, channel);
  if (cached?.source) {
    try {
      const resolved = await resolveLivewatchSource(channelKey, channel, cached.source);
      return { ...resolved, detection: `cache-${cached.source}` };
    } catch (error) {
      failures.push(`${cached.source}:${error?.message || "error"}`);
    }
  }
  const order = parseOrder(requestUrl, channel);
  for (const sourceName of order) {
    try {
      const resolved = await resolveLivewatchSource(channelKey, channel, sourceName);
      writeCache(channelKey, "auto", requestUrl, channel, { source: sourceName });
      return {
        ...resolved,
        detection: failures.length ? `auto-${sourceName}-after-${failures.length}-failure` : `auto-${sourceName}`
      };
    } catch (error) {
      failures.push(`${sourceName}:${error?.message || "error"}`);
    }
  }
  throw new Error(`no source (${failures.join(", ")})`);
}

async function resolveMode(channelKey, channel, mode, requestUrl) {
  if (mode === "auto") return resolveAutoSource(channelKey, channel, requestUrl);
  if (!channel.sources[mode]) throw new Error(`unknown mode ${mode}`);
  const resolved = await resolveLivewatchSource(channelKey, channel, mode);
  return { ...resolved, detection: `forced-${mode}` };
}

function masterHeaders(channelKey, selected, mode) {
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/vnd.apple.mpegurl");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-Livewatch-Smart-Channel", channelKey);
  headers.set("X-Livewatch-Smart-Mode", mode);
  headers.set("X-Livewatch-Smart-Source", selected.source);
  headers.set("X-Livewatch-Smart-Source-Id", selected.sourceId);
  headers.set("X-Livewatch-Smart-Detection", selected.detection);
  headers.set("X-Livewatch-Smart-Latency", `${selected.latencyMs}ms`);
  return headers;
}

async function handleMaster(request, requestUrl, channelKey, channel, mode) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }
  let selected;
  try {
    selected = await resolveMode(channelKey, channel, mode, requestUrl);
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(`${channel.label} source unavailable: ${error?.message || "unknown error"}`, {
      status: 502,
      headers
    });
  }
  const headers = masterHeaders(channelKey, selected, mode);
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(rewritePlaylist(selected.masterText, selected.upstreamUrl, requestUrl.origin), {
    status: 200,
    headers
  });
}

async function handleProxy(request, requestUrl) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }
  const rawUrl = requestUrl.searchParams.get("url") || "";
  if (!rawUrl || rawUrl.length > 8192) {
    return new Response("Missing or invalid upstream URL", { status: 400, headers: corsHeaders() });
  }
  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response("Invalid upstream URL", { status: 400, headers: corsHeaders() });
  }
  if (!isAllowedLivewatchUrl(upstreamUrl)) {
    return new Response("Upstream not allowed", { status: 403, headers: corsHeaders() });
  }
  const upstreamHeaders = new Headers(livewatchHeaders(request.headers.get("Accept") || "*/*"));
  const range = request.headers.get("Range");
  if (range) upstreamHeaders.set("Range", range);
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "follow"
    });
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(`Upstream fetch failed: ${error?.message || "network error"}`, {
      status: 502,
      headers
    });
  }
  const contentType = hlsContentType(upstreamUrl.pathname, upstream.headers.get("Content-Type"));
  const isPlaylist = request.method === "GET" && contentType.toLowerCase().includes("mpegurl");
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  for (const name of ["Accept-Ranges", "Content-Length", "Content-Range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (isPlaylist) {
    headers.delete("Content-Length");
    return new Response(rewritePlaylist(await upstream.text(), upstreamUrl, requestUrl.origin), {
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

async function sourceStatus(channelKey, channel, sourceName) {
  const startedAt = Date.now();
  try {
    const resolved = await resolveLivewatchSource(channelKey, channel, sourceName);
    return {
      source: sourceName,
      ok: true,
      sourceId: resolved.sourceId,
      latencyMs: Date.now() - startedAt,
      manifestLatencyMs: resolved.latencyMs,
      lines: resolved.masterText.split(/\r?\n/).length
    };
  } catch (error) {
    return {
      source: sourceName,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error?.message || "unknown error"
    };
  }
}

async function handleStatus(request, channelKey, channel) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  const sourceNames = Object.keys(channel.sources);
  const results = await Promise.all(sourceNames.map((sourceName) => sourceStatus(channelKey, channel, sourceName)));
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    channel: channelKey,
    label: channel.label,
    defaultOrder: channel.defaultOrder,
    availableSources: sourceNames,
    results
  }, null, 2), { status: 200, headers });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function playerPage(origin, channelKey, channel) {
  const sourceUrls = {};
  const sourceLabels = {};
  for (const [key, source] of Object.entries(channel.sources)) {
    sourceUrls[key] = `${origin}/api/live/${channelKey}/${key}/master.m3u8`;
    sourceLabels[key] = source.label;
  }
  const sourceButtons = Object.entries(channel.sources).map(([key, source]) => {
    return `<button data-source="${escapeHtml(key)}">${escapeHtml(source.button || source.label)}</button>`;
  }).join("\n        ");
  const channelOptions = Object.entries(CHANNELS).map(([key, value]) => {
    const selected = key === channelKey ? " selected" : "";
    return `<option value="${escapeHtml(key)}"${selected}>${escapeHtml(value.label)}</option>`;
  }).join("");
  const startLabel = `Smart ${channel.defaultOrder.join(" -> ")}`;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(channel.label)} Smart LiveWatch</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #e5edf7; font-family: Arial, sans-serif; }
    main { position: fixed; inset: 0; width: 100vw; height: 100vh; background: #000; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; background: #000; display: block; }
    #menuToggle { position: fixed; top: 10px; right: 10px; z-index: 30; width: 38px; height: 38px; padding: 0; display: grid; place-items: center; color: rgba(255,255,255,.9); background: rgba(0,0,0,.12); border: 1px solid rgba(255,255,255,.18); border-radius: 10px; cursor: pointer; backdrop-filter: blur(4px); }
    #menuPanel { position: fixed; top: 56px; right: 10px; z-index: 29; width: min(440px, calc(100vw - 20px)); max-height: calc(100vh - 66px); overflow: auto; padding: 14px; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: rgba(5,7,11,.88); box-shadow: 0 14px 40px rgba(0,0,0,.4); backdrop-filter: blur(10px); }
    #menuPanel[hidden], #log[hidden] { display: none !important; }
    h1 { margin: 0 0 10px; font-size: 18px; }
    .info { margin: 0 0 10px; font-size: 12px; line-height: 1.45; color: #b8c7d9; }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
    button, a, select { color: #e5edf7; background: #0f2741; border: 1px solid #2d6f9f; border-radius: 7px; padding: 9px 11px; text-decoration: none; cursor: pointer; }
    button.secondary { background: #18202c; border-color: #52606f; }
    select { width: 100%; margin: 6px 0 8px; }
    pre { margin: 10px 0 0; min-height: 140px; max-height: 42vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; background: #08111e; border: 1px solid #17324d; border-radius: 7px; font-size: 11px; }
  </style>
</head>
<body>
  <main>
    <video id="video" controls autoplay playsinline></video>
    <button id="menuToggle" type="button" aria-label="Ouvrir le menu" aria-controls="menuPanel" aria-expanded="false">☰</button>
    <section id="menuPanel" hidden>
      <h1>${escapeHtml(channel.label)} Smart LiveWatch</h1>
      <p class="info">Source active : <strong id="activeSourceInfo">initialisation</strong></p>
      <select id="channelSelect" aria-label="Chaine">${channelOptions}</select>
      <div class="bar">
        <button id="startSmart" type="button">${escapeHtml(startLabel)}</button>
        <button data-src="${escapeHtml(`${origin}/api/live/${channelKey}/master.m3u8`)}">Auto worker</button>
        ${sourceButtons}
        <a href="${escapeHtml(`${origin}/api/live/${channelKey}/health`)}" target="_blank" rel="noreferrer">Status JSON</a>
        <button id="toggleLog" class="secondary" type="button" aria-expanded="false">Afficher logs</button>
        <button id="copyLog" class="secondary" type="button">Copier logs</button>
        <button id="clearLog" class="secondary" type="button">Effacer logs</button>
      </div>
      <pre id="log" hidden></pre>
    </section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.16"><\/script>
  <script>
    const video = document.getElementById('video');
    const log = document.getElementById('log');
    const menuToggleButton = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');
    const toggleLogButton = document.getElementById('toggleLog');
    const copyLogButton = document.getElementById('copyLog');
    const clearLogButton = document.getElementById('clearLog');
    const activeSourceInfo = document.getElementById('activeSourceInfo');
    const channelSelect = document.getElementById('channelSelect');
    const startSmartButton = document.getElementById('startSmart');
    video.defaultMuted = false;
    video.muted = false;
    video.volume = 1;
    const SOURCE_URLS = ${scriptJson(sourceUrls)};
    const SOURCE_LABELS = ${scriptJson(sourceLabels)};
    const START_SEQUENCE = ${scriptJson(channel.defaultOrder)};
    const START_LABEL = ${scriptJson(startLabel)};
    const CONSOLE_PREFIX = ${scriptJson(`${channel.label} Smart`)};
    const LONG_STALL_MS = 4000;
    const BAD_EVENT_WINDOW_MS = 45000;
    const BAD_EVENT_LIMIT = 2;
    const SMART_RECOVERY_PROBE_MS = 45000;
    const SMART_RECOVERY_CONFIRM_MS = 15000;
    const SMART_RETURN_COOLDOWN_MS = 120000;
    const logs = [];
    let hls = null;
    let activeLabel = 'auto';
    let activeKey = '';
    let activeSrc = '';
    let activeSequence = [];
    let activeSequenceIndex = 0;
    let failoverLockUntil = 0;
    let lastProgressLogAt = 0;
    let stallStartedAt = 0;
    let stallTimer = null;
    let badEvents = [];
    let smartRecoveryTimer = null;
    let smartReturnConfirmTimer = null;
    let lastPrimaryFailureAt = 0;
    let lastPrimaryReturnAt = 0;
    function safeJson(value) { try { return JSON.stringify(value); } catch (_) { return String(value); } }
    function appendLog(event, details) {
      const suffix = details === undefined ? '' : ' ' + (typeof details === 'string' ? details : safeJson(details));
      const line = '[' + new Date().toISOString() + '] [' + activeLabel + '] ' + event + suffix;
      logs.push(line);
      if (logs.length > 900) logs.shift();
      log.textContent = logs.join('\\n');
      log.scrollTop = log.scrollHeight;
      console.log('[' + CONSOLE_PREFIX + ']', event, details || '');
    }
    function attemptAutoplay(context) {
      video.defaultMuted = false;
      video.muted = false;
      video.volume = 1;
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(function(error) { appendLog('autoplay-unmute-blocked', { context: context || 'play', message: error.message }); });
      }
    }
    function bufferedEnd() {
      try {
        if (!video.buffered || !video.buffered.length) return null;
        return Number(video.buffered.end(video.buffered.length - 1).toFixed(2));
      } catch (_) {
        return null;
      }
    }
    function clearStallTimer() {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    }
    function clearSmartRecoveryTimers() {
      if (smartRecoveryTimer) {
        clearTimeout(smartRecoveryTimer);
        smartRecoveryTimer = null;
      }
      if (smartReturnConfirmTimer) {
        clearTimeout(smartReturnConfirmTimer);
        smartReturnConfirmTimer = null;
      }
    }
    function hasPrimaryRecoveryPath() {
      return activeSequence.length > 1 && activeSequenceIndex > 0 && activeSequence[0] && SOURCE_URLS[activeSequence[0]];
    }
    function primaryKey() { return activeSequence[0] || ''; }
    function appendProbeParam(src) { return src + (src.indexOf('?') === -1 ? '?' : '&') + 'smartProbe=' + Date.now(); }
    function firstPlayableUrlFromPlaylist(text, baseSrc) {
      const lines = String(text || '').split(/\\r?\\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!trimmed || trimmed.charAt(0) === '#') continue;
        try { return new URL(trimmed, baseSrc).href; } catch (_) { return trimmed; }
      }
      return '';
    }
    async function probeSourceKey(key) {
      const source = SOURCE_URLS[key];
      if (!source) return false;
      const src = appendProbeParam(source);
      const startedAt = Date.now();
      try {
        const response = await fetch(src, { cache: 'no-store' });
        const text = await response.text();
        if (!response.ok || text.indexOf('#EXTM3U') === -1) {
          appendLog('smart-probe-master-bad', { key: key, status: response.status, latencyMs: Date.now() - startedAt });
          return false;
        }
        const firstUrl = firstPlayableUrlFromPlaylist(text, response.url || src);
        if (firstUrl) {
          const mediaResponse = await fetch(appendProbeParam(firstUrl), { cache: 'no-store', headers: { Range: 'bytes=0-2047' } });
          if (mediaResponse.body && mediaResponse.body.cancel) mediaResponse.body.cancel();
          if (!mediaResponse.ok && mediaResponse.status !== 206) {
            appendLog('smart-probe-media-bad', { key: key, status: mediaResponse.status, latencyMs: Date.now() - startedAt });
            return false;
          }
        }
        appendLog('smart-probe-ok', { key: key, latencyMs: Date.now() - startedAt });
        return true;
      } catch (error) {
        appendLog('smart-probe-error', { key: key, message: error.message });
        return false;
      }
    }
    function markPrimaryFailure(reason) {
      if (!activeSequence.length || activeSequenceIndex !== 0) return;
      lastPrimaryFailureAt = Date.now();
      clearSmartRecoveryTimers();
      appendLog('smart-primary-failure', { reason: reason, primary: primaryKey(), retryAfterMs: SMART_RECOVERY_PROBE_MS });
    }
    async function attemptPrimaryReturn(reason) {
      smartRecoveryTimer = null;
      if (!hasPrimaryRecoveryPath()) return;
      const now = Date.now();
      if (now - lastPrimaryReturnAt < SMART_RETURN_COOLDOWN_MS) {
        schedulePrimaryRecovery('cooldown-' + reason);
        return;
      }
      if (now - lastPrimaryFailureAt < SMART_RECOVERY_PROBE_MS) {
        schedulePrimaryRecovery('recent-failure-' + reason);
        return;
      }
      const key = primaryKey();
      appendLog('smart-primary-probe-start', { reason: reason, primary: key });
      const firstProbeOk = await probeSourceKey(key);
      if (!firstProbeOk) {
        schedulePrimaryRecovery('primary-still-bad');
        return;
      }
      appendLog('smart-primary-confirm-wait', { primary: key, confirmMs: SMART_RECOVERY_CONFIRM_MS });
      smartReturnConfirmTimer = setTimeout(async function() {
        smartReturnConfirmTimer = null;
        if (!hasPrimaryRecoveryPath()) return;
        const secondProbeOk = await probeSourceKey(key);
        if (!secondProbeOk) {
          schedulePrimaryRecovery('primary-confirm-failed');
          return;
        }
        lastPrimaryReturnAt = Date.now();
        loadSourceKey(key, 'Smart return ' + SOURCE_LABELS[key], activeSequence, 0, 'smart-return-' + reason);
      }, SMART_RECOVERY_CONFIRM_MS);
    }
    function schedulePrimaryRecovery(reason) {
      if (!hasPrimaryRecoveryPath() || smartRecoveryTimer || smartReturnConfirmTimer) return;
      const now = Date.now();
      const waitMs = Math.max(
        5000,
        SMART_RECOVERY_PROBE_MS - Math.max(0, now - lastPrimaryFailureAt),
        SMART_RETURN_COOLDOWN_MS - Math.max(0, now - lastPrimaryReturnAt)
      );
      appendLog('smart-primary-recovery-scheduled', { reason: reason, primary: primaryKey(), waitMs: waitMs });
      smartRecoveryTimer = setTimeout(function() { attemptPrimaryReturn(reason || 'scheduled'); }, waitMs);
    }
    function noteRecovered(eventName) {
      if (!stallStartedAt) return;
      appendLog('stall-recovered', { event: eventName, durationMs: Date.now() - stallStartedAt, currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd() });
      stallStartedAt = 0;
      clearStallTimer();
    }
    function tryFailover(reason) {
      if (Date.now() < failoverLockUntil) return;
      if (!activeSequence.length || activeSequenceIndex >= activeSequence.length - 1) {
        appendLog('failover-unavailable', { reason: reason, activeKey: activeKey, sequence: activeSequence });
        return;
      }
      failoverLockUntil = Date.now() + 3000;
      const from = activeKey;
      if (activeSequenceIndex === 0) markPrimaryFailure(reason);
      const nextIndex = activeSequenceIndex + 1;
      const nextKey = activeSequence[nextIndex];
      appendLog('failover-switch', { reason: reason, from: from, to: nextKey, sequence: activeSequence });
      loadSourceKey(nextKey, 'Auto failover ' + SOURCE_LABELS[nextKey], activeSequence, nextIndex, reason);
      if (nextIndex > 0) schedulePrimaryRecovery('after-failover-' + reason);
    }
    function noteStall(eventName) {
      if (!stallStartedAt) {
        stallStartedAt = Date.now();
        appendLog('stall-start', { event: eventName, currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd() });
      }
      clearStallTimer();
      stallTimer = setTimeout(function() { tryFailover('stall-timeout-' + eventName); }, LONG_STALL_MS);
    }
    function recordBadEvent(kind, details) {
      const now = Date.now();
      badEvents.push(now);
      badEvents = badEvents.filter(function(time) { return now - time <= BAD_EVENT_WINDOW_MS; });
      appendLog('bad-event-count', { kind: kind, count: badEvents.length, limit: BAD_EVENT_LIMIT, details: details || null });
      if (badEvents.length >= BAD_EVENT_LIMIT) tryFailover('repeated-' + kind);
    }
    async function inspectSource(src) {
      try {
        const response = await fetch(src, { method: 'HEAD', cache: 'no-store' });
        appendLog('source-head', {
          status: response.status,
          channel: response.headers.get('X-Livewatch-Smart-Channel'),
          mode: response.headers.get('X-Livewatch-Smart-Mode'),
          source: response.headers.get('X-Livewatch-Smart-Source'),
          sourceId: response.headers.get('X-Livewatch-Smart-Source-Id'),
          detection: response.headers.get('X-Livewatch-Smart-Detection'),
          latency: response.headers.get('X-Livewatch-Smart-Latency')
        });
      } catch (error) {
        appendLog('source-head-error', error.message);
      }
    }
    function copyLogs() {
      const text = logs.join('\\n') || 'Aucun log.';
      const done = function() {
        const previous = copyLogButton.textContent;
        copyLogButton.textContent = 'Copie OK';
        setTimeout(function() { copyLogButton.textContent = previous; }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function(error) { appendLog('copy-error', error.message); });
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        done();
      }
    }
    async function load(src, label) {
      activeLabel = label || 'source';
      activeSrc = src;
      lastProgressLogAt = 0;
      stallStartedAt = 0;
      badEvents = [];
      clearStallTimer();
      appendLog('load-start', src);
      inspectSource(src);
      if (hls) { hls.destroy(); hls = null; }
      video.loop = false;
      video.removeAttribute('src');
      video.load();
      if (window.Hls && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.on(Hls.Events.MANIFEST_PARSED, function(_, data) {
          appendLog('manifest-ok', { levels: data.levels ? data.levels.length : 0, heights: data.levels ? data.levels.map(function(level) { return level.height || 0; }) : [] });
          attemptAutoplay('manifest-parsed');
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, function(_, data) {
          const level = hls && hls.levels ? hls.levels[data.level] : null;
          appendLog('level-switched', { level: data.level, height: level ? level.height : null, bitrate: level ? level.bitrate : null });
        });
        hls.on(Hls.Events.ERROR, function(_, data) {
          const summary = { type: data.type, details: data.details, fatal: data.fatal, status: data.response ? data.response.code : null };
          appendLog('hls-error', summary);
          if (data.fatal) {
            tryFailover('fatal-hls-' + (data.details || data.type || 'error'));
            return;
          }
          if (['bufferStalledError', 'bufferNudgeOnStall', 'fragLoadError', 'fragLoadTimeOut', 'levelLoadError', 'levelLoadTimeOut'].indexOf(data.details) !== -1) {
            recordBadEvent(data.details, summary);
          }
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src;
        attemptAutoplay('native-source');
      }
    }
    function loadSourceKey(key, label, sequence, index, reason) {
      activeLabel = label || SOURCE_LABELS[key];
      activeKey = key;
      activeSequence = sequence && sequence.length ? sequence.slice() : [key];
      activeSequenceIndex = typeof index === 'number' ? index : activeSequence.indexOf(key);
      if (activeSequenceIndex < 0) activeSequenceIndex = 0;
      if (activeSourceInfo) activeSourceInfo.textContent = SOURCE_LABELS[key] + ' (' + key + ')';
      appendLog('source-selected', { key: key, label: SOURCE_LABELS[key], reason: reason || 'manual', sequence: activeSequence });
      if (activeSequenceIndex === 0) clearSmartRecoveryTimers();
      else schedulePrimaryRecovery('source-selected-' + (reason || 'manual'));
      load(SOURCE_URLS[key], label || SOURCE_LABELS[key]);
    }
    function startSequence(sequence, label) {
      const clean = sequence.filter(function(key) { return SOURCE_URLS[key]; });
      if (!clean.length) return;
      loadSourceKey(clean[0], label + ' -> ' + SOURCE_LABELS[clean[0]], clean, 0, 'sequence-start');
    }
    ['loadstart', 'loadedmetadata', 'playing', 'waiting', 'stalled', 'pause', 'ended', 'error'].forEach(function(name) {
      video.addEventListener(name, function() {
        appendLog('video-' + name, { currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd(), paused: video.paused, muted: video.muted, volume: video.volume });
        if (name === 'waiting' || name === 'stalled') noteStall(name);
        if (name === 'playing' || name === 'loadedmetadata') {
          noteRecovered(name);
          if (activeSequenceIndex > 0) schedulePrimaryRecovery('fallback-' + name);
        }
        if (name === 'ended' || name === 'error') tryFailover('video-' + name);
      });
    });
    video.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastProgressLogAt < 10000) return;
      lastProgressLogAt = now;
      appendLog('progress', { currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd(), source: activeSrc });
      noteRecovered('timeupdate');
      if (activeSequenceIndex > 0) schedulePrimaryRecovery('fallback-progress');
    });
    startSmartButton.addEventListener('click', function() { startSequence(START_SEQUENCE, START_LABEL); });
    document.querySelectorAll('button[data-source]').forEach(function(btn) {
      btn.addEventListener('click', function() { loadSourceKey(btn.dataset.source, btn.textContent.trim(), [btn.dataset.source], 0, 'manual'); });
    });
    document.querySelectorAll('button[data-src]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeKey = 'worker-auto';
        activeSequence = [];
        activeSequenceIndex = 0;
        if (activeSourceInfo) activeSourceInfo.textContent = btn.textContent.trim();
        load(btn.dataset.src, btn.textContent.trim());
      });
    });
    channelSelect.addEventListener('change', function() {
      location.href = '/?channel=' + encodeURIComponent(channelSelect.value);
    });
    menuToggleButton.addEventListener('click', function() {
      const willOpen = menuPanel.hidden;
      menuPanel.hidden = !willOpen;
      menuToggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      menuToggleButton.setAttribute('aria-label', willOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    toggleLogButton.addEventListener('click', function() {
      const willShow = log.hidden;
      log.hidden = !willShow;
      toggleLogButton.textContent = willShow ? 'Masquer logs' : 'Afficher logs';
      toggleLogButton.setAttribute('aria-expanded', willShow ? 'true' : 'false');
      if (willShow) log.scrollTop = log.scrollHeight;
    });
    document.addEventListener('pointerdown', function unlockPlayback() {
      if (video.paused) attemptAutoplay('first-user-gesture');
      document.removeEventListener('pointerdown', unlockPlayback);
    }, { once: true });
    copyLogButton.addEventListener('click', copyLogs);
    clearLogButton.addEventListener('click', function() {
      logs.length = 0;
      log.textContent = '';
      appendLog('log-cleared');
    });
    appendLog('lab-ready', location.href);
    startSequence(START_SEQUENCE, START_LABEL);
  <\/script>
</body>
</html>`;
}

function jsonResponse(value, status = 200) {
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value, null, 2), { status, headers });
}

function notFound(message) {
  return new Response(message, {
    status: 404,
    headers: corsHeaders()
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    if (path === PROXY_PATH) return handleProxy(request, url);
    if (path === "/api/channels") {
      return jsonResponse(Object.entries(CHANNELS).map(([key, channel]) => ({
        key,
        label: channel.label,
        defaultOrder: channel.defaultOrder,
        sources: Object.keys(channel.sources)
      })));
    }

    const route = path.match(/^\/api\/live\/([^/]+)(?:\/([^/]+))?(?:\/master\.m3u8|\/health)?$/);
    if (route) {
      const channelHit = getChannel(route[1]);
      if (!channelHit) return notFound("Unknown channel");
      const mode = route[2] || (path.endsWith("/health") ? "health" : "auto");
      if (mode === "health") return handleStatus(request, channelHit.key, channelHit.config);
      return handleMaster(request, url, channelHit.key, channelHit.config, mode === "master.m3u8" ? "auto" : mode);
    }

    if (path === "/" || path === "/index.html") {
      const channelHit = getChannel(url.searchParams.get("channel") || "cmtv") || getChannel("cmtv");
      const headers = new Headers(corsHeaders());
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      return new Response(playerPage(url.origin, channelHit.key, channelHit.config), { status: 200, headers });
    }

    return notFound("LiveWatch smart: not found");
  }
};
