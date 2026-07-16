var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var LIVEWATCH_ORIGIN = "https://livewatch.top";
var ENGINE_ORIGIN = "https://tron-ares-engine.victor-salema-53d.workers.dev";
var CLOUDING_ORIGIN = "https://clouding.wideiptv.top";
var CLOUDING_PLAYER_ORIGIN = "https://popcdn.day";
var CLOUDING_CHANNEL = "CMTVPT";
var PROXY_PATH = "/api/proxy";
var SOURCE_TEST_TIMEOUT_MS = 6500;
var SOURCE_CACHE_TTL_MS = 3e4;
var LIVEWATCH_SOURCES = {
  cable: {
    id: "805844173b05e1a81e31d-579768661fe265",
    label: "LiveWatch cable"
  },
  basic: {
    id: "384601660517fa3552a29f-6816b5893e5bcc",
    label: "LiveWatch basic"
  }
};
var DEFAULT_AUTO_ORDER = ["cable", "basic", "clouding"];
var sourceCache = /* @__PURE__ */ new Map();
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Accept, Content-Type",
    "Access-Control-Expose-Headers": [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "X-CMTV-Lab-Mode",
      "X-CMTV-Lab-Source",
      "X-CMTV-Lab-Source-Id",
      "X-CMTV-Lab-Detection",
      "X-CMTV-Lab-Latency"
    ].join(", ")
  };
}
__name(corsHeaders, "corsHeaders");
function livewatchHeaders(accept = "*/*") {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    "User-Agent": "Mozilla/5.0"
  };
}
__name(livewatchHeaders, "livewatchHeaders");
function upstreamHeaders(url, accept = "*/*") {
  const headers = {
    Accept: accept,
    "User-Agent": "Mozilla/5.0"
  };
  if (url.origin === LIVEWATCH_ORIGIN) headers.Referer = `${LIVEWATCH_ORIGIN}/`;
  if (url.origin === CLOUDING_ORIGIN) headers.Referer = `${CLOUDING_PLAYER_ORIGIN}/`;
  return headers;
}
__name(upstreamHeaders, "upstreamHeaders");
function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), ms);
  return { signal: controller.signal, cancel: /* @__PURE__ */ __name(() => clearTimeout(timer), "cancel") };
}
__name(timeoutSignal, "timeoutSignal");
async function fetchWithTimeout(url, options = {}, timeoutMs = SOURCE_TEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.cancel();
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
function isAllowedLivewatchUrl(url) {
  return url.origin === LIVEWATCH_ORIGIN && url.pathname === "/api/hls" && url.searchParams.has("t") && !url.username && !url.password;
}
__name(isAllowedLivewatchUrl, "isAllowedLivewatchUrl");
function isAllowedEngineUrl(url) {
  return url.origin === ENGINE_ORIGIN && url.pathname.startsWith("/api/worker-live/") && !url.username && !url.password;
}
__name(isAllowedEngineUrl, "isAllowedEngineUrl");
function isAllowedCloudingUrl(url) {
  return url.origin === CLOUDING_ORIGIN && url.pathname.toLowerCase().startsWith(`/${CLOUDING_CHANNEL.toLowerCase()}/`) && !url.username && !url.password;
}
__name(isAllowedCloudingUrl, "isAllowedCloudingUrl");
function isAllowedProxyUrl(url) {
  return isAllowedLivewatchUrl(url) || isAllowedEngineUrl(url) || isAllowedCloudingUrl(url);
}
__name(isAllowedProxyUrl, "isAllowedProxyUrl");
function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedProxyUrl(upstream)) return value;
    return `${publicOrigin}${PROXY_PATH}?url=${encodeURIComponent(upstream.href)}`;
  } catch (_) {
    return value;
  }
}
__name(makeProxyUrl, "makeProxyUrl");
function rewritePlaylist(text, upstreamUrl, publicOrigin) {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith("#")) {
      return makeProxyUrl(trimmed, upstreamUrl, publicOrigin);
    }
    return line.replace(/URI="([^"]+)"/g, (match, value) => `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`).replace(/URI='([^']+)'/g, (match, value) => `URI='${makeProxyUrl(value, upstreamUrl, publicOrigin)}'`);
  }).join("\n");
}
__name(rewritePlaylist, "rewritePlaylist");
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
__name(hlsContentType, "hlsContentType");
function parseOrderFor(requestUrl, defaultOrder, allowedSources) {
  const skip = new Set(String(requestUrl.searchParams.get("skip") || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  const raw = String(requestUrl.searchParams.get("order") || "").trim();
  const allowed = new Set(allowedSources);
  const order = (raw ? raw.split(",") : defaultOrder).map((value) => value.trim().toLowerCase()).filter((value) => allowed.has(value)).filter((value) => !skip.has(value));
  return order.length ? order : defaultOrder.filter((value) => !skip.has(value));
}
__name(parseOrderFor, "parseOrderFor");
function parseOrder(requestUrl) {
  return parseOrderFor(requestUrl, DEFAULT_AUTO_ORDER, ["cable", "basic", "clouding"]);
}
__name(parseOrder, "parseOrder");
function cacheKey(mode, requestUrl) {
  if (mode !== "auto") return "";
  return `auto:${parseOrder(requestUrl).join(",")}`;
}
__name(cacheKey, "cacheKey");
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
__name(readCache, "readCache");
function writeCache(mode, requestUrl, value) {
  const key = cacheKey(mode, requestUrl);
  if (!key) return;
  sourceCache.set(key, {
    value,
    expiresAt: Date.now() + SOURCE_CACHE_TTL_MS
  });
}
__name(writeCache, "writeCache");
async function resolveLivewatchSourceFromMap(sourceName, sources) {
  const source = sources[sourceName];
  if (!source) throw new Error(`unknown livewatch source ${sourceName}`);
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
    mode: sourceName,
    source: sourceName,
    sourceId: source.id,
    label: source.label,
    upstreamUrl,
    masterText,
    latencyMs
  };
}
__name(resolveLivewatchSourceFromMap, "resolveLivewatchSourceFromMap");
async function resolveLivewatchSource(sourceName) {
  return resolveLivewatchSourceFromMap(sourceName, LIVEWATCH_SOURCES);
}
__name(resolveLivewatchSource, "resolveLivewatchSource");
async function resolveCloudingSource() {
  const sourceUrl = new URL("/player.php", CLOUDING_PLAYER_ORIGIN);
  sourceUrl.searchParams.set("stream", CLOUDING_CHANNEL);
  const source = await fetchWithTimeout(sourceUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0"
    },
    redirect: "follow"
  });
  if (!source.ok) throw new Error(`clouding source ${source.status}`);
  const sourceHtml = await source.text();
  const pattern = new RegExp(
    `https://clouding\\.wideiptv\\.top/${CLOUDING_CHANNEL}/embed\\.html\\?token=([^"'\\s<>&]+)`,
    "i"
  );
  const match = sourceHtml.match(pattern);
  if (!match || !match[1]) throw new Error("clouding token unavailable");
  const embed = await fetchWithTimeout(match[0], {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0"
    },
    redirect: "follow"
  });
  if (!embed.ok) throw new Error(`clouding embed ${embed.status}`);
  await embed.arrayBuffer();
  const upstreamUrl = new URL(`${CLOUDING_ORIGIN}/${CLOUDING_CHANNEL}/index.fmp4.m3u8`);
  upstreamUrl.searchParams.set("token", match[1]);
  if (!isAllowedCloudingUrl(upstreamUrl)) throw new Error("clouding URL refused");
  const startedAt = Date.now();
  const master = await fetchWithTimeout(upstreamUrl, {
    headers: upstreamHeaders(upstreamUrl, "application/vnd.apple.mpegurl,application/x-mpegURL,*/*"),
    redirect: "follow"
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`clouding master ${master.status}`);
  }
  return {
    mode: "clouding",
    source: "clouding",
    sourceId: "cmtvpt",
    label: "Clouding engine",
    upstreamUrl,
    masterText,
    latencyMs
  };
}
__name(resolveCloudingSource, "resolveCloudingSource");
async function resolveNamedSource(sourceName) {
  if (sourceName === "clouding") return resolveCloudingSource();
  return resolveLivewatchSource(sourceName);
}
__name(resolveNamedSource, "resolveNamedSource");
async function resolveAutoSource(requestUrl) {
  const failures = [];
  const cached = readCache("auto", requestUrl);
  if (cached?.source) {
    try {
      const resolved = await resolveNamedSource(cached.source);
      return {
        ...resolved,
        detection: `cache-${cached.source}`
      };
    } catch (error) {
      failures.push(`${cached.source}:${error?.message || "error"}`);
    }
  }
  const order = parseOrder(requestUrl);
  for (const sourceName of order) {
    try {
      const resolved = await resolveNamedSource(sourceName);
      const value = {
        ...resolved,
        detection: failures.length ? `auto-${sourceName}-after-${failures.length}-failure` : `auto-${sourceName}`
      };
      writeCache("auto", requestUrl, { source: sourceName });
      return value;
    } catch (error) {
      failures.push(`${sourceName}:${error?.message || "error"}`);
    }
  }
  throw new Error(`no source (${failures.join(", ")})`);
}
__name(resolveAutoSource, "resolveAutoSource");
async function resolveMode(mode, requestUrl) {
  if (mode === "auto") return resolveAutoSource(requestUrl);
  if (mode === "cable" || mode === "basic" || mode === "clouding") {
    const resolved = await resolveNamedSource(mode);
    return { ...resolved, detection: `forced-${mode}` };
  }
  throw new Error(`unknown mode ${mode}`);
}
__name(resolveMode, "resolveMode");
function masterHeaders(selected, mode) {
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/vnd.apple.mpegurl");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-CMTV-Lab-Mode", mode);
  headers.set("X-CMTV-Lab-Source", selected.source);
  headers.set("X-CMTV-Lab-Source-Id", selected.sourceId);
  headers.set("X-CMTV-Lab-Detection", selected.detection);
  headers.set("X-CMTV-Lab-Latency", `${selected.latencyMs}ms`);
  return headers;
}
__name(masterHeaders, "masterHeaders");
async function handleMaster(request, requestUrl, mode) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }
  let selected;
  try {
    selected = await resolveMode(mode, requestUrl);
  } catch (error) {
    const headers2 = new Headers(corsHeaders());
    headers2.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(`CMTV source unavailable: ${error?.message || "unknown error"}`, {
      status: 502,
      headers: headers2
    });
  }
  const headers = masterHeaders(selected, mode);
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(rewritePlaylist(selected.masterText, selected.upstreamUrl, requestUrl.origin), {
    status: 200,
    headers
  });
}
__name(handleMaster, "handleMaster");
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
  if (!isAllowedProxyUrl(upstreamUrl)) {
    return new Response("Upstream not allowed", { status: 403, headers: corsHeaders() });
  }
  const headersForUpstream = new Headers(upstreamHeaders(upstreamUrl, request.headers.get("Accept") || "*/*"));
  const range = request.headers.get("Range");
  if (range) headersForUpstream.set("Range", range);
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: headersForUpstream,
      redirect: "follow"
    });
  } catch (error) {
    const headers2 = new Headers(corsHeaders());
    headers2.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(`Upstream fetch failed: ${error?.message || "network error"}`, {
      status: 502,
      headers: headers2
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
__name(handleProxy, "handleProxy");
async function sourceStatus(sourceName) {
  const startedAt = Date.now();
  try {
    const resolved = await resolveNamedSource(sourceName);
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
__name(sourceStatus, "sourceStatus");
async function handleStatus(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  const results = await Promise.all(DEFAULT_AUTO_ORDER.map(sourceStatus));
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify({
    ok: true,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    defaultOrder: DEFAULT_AUTO_ORDER,
    results
  }, null, 2), { status: 200, headers });
}
__name(handleStatus, "handleStatus");
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeHtml, "escapeHtml");
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
__name(scriptJson, "scriptJson");
function playerLabPage(config) {
  const sourceUrls = {};
  const sourceLabels = {};
  for (const [key, source] of Object.entries(config.sources)) {
    sourceUrls[key] = source.url;
    sourceLabels[key] = source.label;
  }
  const sequenceButtons = config.sequences.map(
    (sequence) => `<button data-sequence="${escapeHtml(sequence.keys.join(","))}">${escapeHtml(sequence.label)}</button>`
  ).join("\n      ");
  const sourceButtons = Object.entries(config.sources).map(
    ([key, source]) => `<button data-source="${escapeHtml(key)}">${escapeHtml(source.button || source.label)}</button>`
  ).join("\n      ");
  const workerButton = config.autoUrl ? `<button data-src="${escapeHtml(config.autoUrl)}">${escapeHtml(config.autoLabel || "Auto worker")}</button>` : "";
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CMTV</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #e5edf7; font-family: Arial, sans-serif; }
    main { position: fixed; inset: 0; width: 100vw; height: 100vh; background: #000; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; background: #000; display: block; }
    #menuToggle {
      position: fixed; top: 10px; right: 10px; z-index: 30; width: 38px; height: 38px; padding: 0;
      display: grid; place-items: center; color: rgba(255,255,255,.9); background: rgba(0,0,0,.12);
      border: 1px solid rgba(255,255,255,.18); border-radius: 10px; cursor: pointer; backdrop-filter: blur(4px);
    }
    #menuToggle:hover, #menuToggle:focus-visible { background: rgba(0,0,0,.42); outline: none; }
    #menuPanel {
      position: fixed; top: 56px; right: 10px; z-index: 29; width: min(430px, calc(100vw - 20px));
      max-height: calc(100vh - 66px); overflow: auto; padding: 14px; border: 1px solid rgba(255,255,255,.18);
      border-radius: 12px; background: rgba(5,7,11,.88); box-shadow: 0 14px 40px rgba(0,0,0,.4); backdrop-filter: blur(10px);
    }
    #menuPanel[hidden], #log[hidden] { display: none !important; }
    h1 { margin: 0 0 10px; font-size: 18px; }
    .info { margin: 0 0 10px; font-size: 12px; line-height: 1.45; color: #b8c7d9; }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
    button, a { color: #e5edf7; background: #0f2741; border: 1px solid #2d6f9f; border-radius: 7px; padding: 9px 11px; text-decoration: none; cursor: pointer; }
    button.secondary { background: #18202c; border-color: #52606f; }
    pre { margin: 10px 0 0; min-height: 140px; max-height: 42vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; background: #08111e; border: 1px solid #17324d; border-radius: 7px; font-size: 11px; }
    @media (max-width: 520px) {
      #menuPanel { top: 52px; right: 6px; width: calc(100vw - 12px); max-height: calc(100vh - 58px); }
      #menuToggle { top: 7px; right: 7px; }
    }
  </style>
</head>
<body>
  <main>
    <video id="video" controls autoplay playsinline></video>
    <button id="menuToggle" type="button" aria-label="Ouvrir le menu" aria-controls="menuPanel" aria-expanded="false">☰</button>
    <section id="menuPanel" hidden>
      <h1>${escapeHtml(config.title)}</h1>
      <p class="info">Lecture CMTV plein écran · source active : <strong id="activeSourceInfo">initialisation</strong></p>
      <div class="bar">
        ${sequenceButtons}
        ${workerButton}
        ${sourceButtons}
        <a href="${escapeHtml(config.statusUrl)}" target="_blank" rel="noreferrer">Status JSON</a>
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
    video.defaultMuted = false;
    video.muted = false;
    video.volume = 1;
    const SOURCE_URLS = ${scriptJson(sourceUrls)};
    const SOURCE_LABELS = ${scriptJson(sourceLabels)};
    const START_SEQUENCE = ${scriptJson(config.startSequence)};
    const START_LABEL = ${scriptJson(config.startLabel)};
    const CONSOLE_PREFIX = ${scriptJson(config.consoleLabel || config.title)};
    const LONG_STALL_MS = 3500;
    const BAD_EVENT_WINDOW_MS = 30000;
    const BAD_EVENT_LIMIT = 2;
    const SMART_PRIMARY_SOURCE = 'cable';
    const SMART_FALLBACK_SOURCE = 'basic';
    const SMART_SAFE_SOURCE = 'clouding';
    const SMART_RECOVERY_PROBE_MS = 25000;
    const SMART_RECOVERY_CONFIRM_MS = 12000;
    const SMART_RETURN_COOLDOWN_MS = 60000;
    const SMART_FAILURE_HISTORY_MS = 600000;
    const SMART_FAILURE_BACKOFF_MS = 35000;
    const SMART_MAX_RECOVERY_WAIT_MS = 180000;
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
    let smartProbeInFlight = false;
    let smartRecoveryEpoch = 0;
    let lastPrimaryFailureAt = 0;
    let lastPrimaryReturnAt = 0;
    let lastSourceFailureAt = {};
    let lastSourceReturnAt = {};
    let sourceFailureHistory = {};
    let lastFragUrl = '';
    let sameFragCount = 0;
    function safeJson(value) {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    function appendLog(event, details) {
      const suffix = details === undefined ? '' : ' ' + (typeof details === 'string' ? details : safeJson(details));
      const line = '[' + new Date().toISOString() + '] [' + activeLabel + '] ' + event + suffix;
      logs.push(line);
      if (logs.length > 700) logs.shift();
      log.textContent = logs.join('\\n');
      log.scrollTop = log.scrollHeight;
      console.log('[' + CONSOLE_PREFIX + ']', event, details || '');
    }
    function shouldIgnoreParentWheelBridgeTarget(target) {
      if (!target || typeof target.closest !== 'function') return false;
      return !!target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"], #menuPanel, #log');
    }
    function relayWheelToParent(event) {
      if (window.parent === window) return;
      if (!event || Math.abs(event.deltaY || 0) < 18) return;
      if (shouldIgnoreParentWheelBridgeTarget(event.target)) return;
      window.parent.postMessage({
        type: 'ARES_IFRAME_WHEEL_ZAP',
        deltaY: event.deltaY
      }, '*');
      event.preventDefault();
      event.stopPropagation();
    }
    window.addEventListener('wheel', relayWheelToParent, { passive: false });
    function attemptAutoplay(context) {
      video.defaultMuted = false;
      video.muted = false;
      video.volume = 1;
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(function(error) {
          appendLog('autoplay-unmute-blocked', {
            context: context || 'play',
            message: error.message
          });
        });
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
      smartProbeInFlight = false;
      if (smartRecoveryTimer) {
        clearTimeout(smartRecoveryTimer);
        smartRecoveryTimer = null;
      }
      if (smartReturnConfirmTimer) {
        clearTimeout(smartReturnConfirmTimer);
        smartReturnConfirmTimer = null;
      }
    }
    function isSmartSequence() {
      return activeSequence[0] === SMART_PRIMARY_SOURCE && activeSequence.indexOf(SMART_FALLBACK_SOURCE) === 1 && activeSequence.indexOf(SMART_SAFE_SOURCE) >= 2;
    }
    function hasBetterSource() {
      return isSmartSequence() && activeSequenceIndex > 0;
    }
    function betterSourceKeys() {
      if (!hasBetterSource()) return [];
      return activeSequence.slice(0, activeSequenceIndex).filter(function(key) {
        return SOURCE_URLS[key];
      });
    }
    function recentFailureTimes(key) {
      const now = Date.now();
      const history = sourceFailureHistory[key] || [];
      const recent = history.filter(function(time) {
        return now - time <= SMART_FAILURE_HISTORY_MS;
      });
      sourceFailureHistory[key] = recent;
      return recent;
    }
    function noteSourceFailureHistory(key, now) {
      const recent = recentFailureTimes(key);
      recent.push(now);
      sourceFailureHistory[key] = recent;
      return recent.length;
    }
    function sourceRecoveryDelayMs(key) {
      const count = recentFailureTimes(key).length;
      const backoff = Math.max(0, count - 1) * SMART_FAILURE_BACKOFF_MS;
      return Math.min(SMART_MAX_RECOVERY_WAIT_MS, SMART_RECOVERY_PROBE_MS + backoff);
    }
    function appendProbeParam(src) {
      return src + (src.indexOf('?') === -1 ? '?' : '&') + 'smartProbe=' + Date.now();
    }
    function firstPlayableUrlFromPlaylist(text, baseSrc) {
      const lines = String(text || '').split(/\\r?\\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!trimmed || trimmed.charAt(0) === '#') continue;
        try {
          return new URL(trimmed, baseSrc).href;
        } catch (_) {
          return trimmed;
        }
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
          appendLog('smart-probe-master-bad', {
            key: key,
            status: response.status,
            latencyMs: Date.now() - startedAt
          });
          return false;
        }
        const firstUrl = firstPlayableUrlFromPlaylist(text, response.url || src);
        if (firstUrl) {
          const mediaResponse = await fetch(appendProbeParam(firstUrl), {
            cache: 'no-store',
            headers: { Range: 'bytes=0-2047' }
          });
          if (mediaResponse.body && mediaResponse.body.cancel) mediaResponse.body.cancel();
          if (!mediaResponse.ok && mediaResponse.status !== 206) {
            appendLog('smart-probe-media-bad', {
              key: key,
              status: mediaResponse.status,
              latencyMs: Date.now() - startedAt
            });
            return false;
          }
        }
        appendLog('smart-probe-ok', {
          key: key,
          latencyMs: Date.now() - startedAt
        });
        return true;
      } catch (error) {
        appendLog('smart-probe-error', {
          key: key,
          message: error.message
        });
        return false;
      }
    }
    function markSourceFailure(key, reason) {
      if (!isSmartSequence() || !key) return;
      const now = Date.now();
      lastSourceFailureAt[key] = now;
      const recentFailures = noteSourceFailureHistory(key, now);
      if (key === SMART_PRIMARY_SOURCE) lastPrimaryFailureAt = now;
      clearSmartRecoveryTimers();
      appendLog('smart-source-failure', {
        key: key,
        reason: reason,
        recentFailures: recentFailures,
        retryAfterMs: sourceRecoveryDelayMs(key)
      });
    }
    async function attemptPrimaryReturn(reason) {
      smartRecoveryTimer = null;
      if (!hasBetterSource()) return;
      const attemptEpoch = smartRecoveryEpoch;
      const now = Date.now();
      const candidates = betterSourceKeys();
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const lastFailure = lastSourceFailureAt[candidate] || 0;
        const lastReturn = lastSourceReturnAt[candidate] || 0;
        const recoveryDelayMs = sourceRecoveryDelayMs(candidate);
        const recentFailures = recentFailureTimes(candidate).length;
        if (now - lastReturn < SMART_RETURN_COOLDOWN_MS) {
          appendLog('smart-better-candidate-cooldown', {
            candidate: candidate,
            recentFailures: recentFailures,
            remainingMs: SMART_RETURN_COOLDOWN_MS - (now - lastReturn)
          });
          continue;
        }
        if (now - lastFailure < recoveryDelayMs) {
          appendLog('smart-better-candidate-recent-failure', {
            candidate: candidate,
            recentFailures: recentFailures,
            remainingMs: recoveryDelayMs - (now - lastFailure)
          });
          continue;
        }
        appendLog('smart-better-probe-start', {
          candidate: candidate,
          current: activeKey,
          reason: reason
        });
        smartProbeInFlight = true;
        const firstProbeOk = await probeSourceKey(candidate);
        smartProbeInFlight = false;
        if (attemptEpoch !== smartRecoveryEpoch || !hasBetterSource()) return;
        if (!firstProbeOk) {
          lastSourceFailureAt[candidate] = Date.now();
          noteSourceFailureHistory(candidate, lastSourceFailureAt[candidate]);
          continue;
        }
        appendLog('smart-better-confirm-wait', {
          candidate: candidate,
          confirmMs: SMART_RECOVERY_CONFIRM_MS
        });
        const confirmEpoch = attemptEpoch;
        smartReturnConfirmTimer = setTimeout(async function() {
          smartReturnConfirmTimer = null;
          if (confirmEpoch !== smartRecoveryEpoch) return;
          if (!hasBetterSource() || activeSequence.indexOf(candidate) >= activeSequenceIndex) return;
          smartProbeInFlight = true;
          const secondProbeOk = await probeSourceKey(candidate);
          smartProbeInFlight = false;
          if (confirmEpoch !== smartRecoveryEpoch || !hasBetterSource()) return;
          if (!secondProbeOk) {
            lastSourceFailureAt[candidate] = Date.now();
            noteSourceFailureHistory(candidate, lastSourceFailureAt[candidate]);
            schedulePrimaryRecovery('better-confirm-failed-' + candidate);
            return;
          }
          lastSourceReturnAt[candidate] = Date.now();
          if (candidate === SMART_PRIMARY_SOURCE) lastPrimaryReturnAt = Date.now();
          loadSourceKey(
            candidate,
            'Smart return ' + SOURCE_LABELS[candidate],
            activeSequence,
            activeSequence.indexOf(candidate),
            'smart-return-' + reason
          );
        }, SMART_RECOVERY_CONFIRM_MS);
        return;
      }
      schedulePrimaryRecovery('no-better-ready-' + reason);
    }
    function recoveryWaitMs() {
      if (!hasBetterSource()) return 0;
      const now = Date.now();
      const candidates = betterSourceKeys();
      let waitMs = SMART_RECOVERY_PROBE_MS;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const lastFailure = lastSourceFailureAt[candidate] || 0;
        const lastReturn = lastSourceReturnAt[candidate] || 0;
        const recoveryDelayMs = sourceRecoveryDelayMs(candidate);
        const candidateWaitMs = Math.max(
          5000,
          recoveryDelayMs - Math.max(0, now - lastFailure),
          SMART_RETURN_COOLDOWN_MS - Math.max(0, now - lastReturn)
        );
        waitMs = Math.min(waitMs, candidateWaitMs);
      }
      return Math.max(5000, waitMs);
    }
    function schedulePrimaryRecovery(reason) {
      if (!hasBetterSource() || smartRecoveryTimer || smartReturnConfirmTimer || smartProbeInFlight) return;
      const waitMs = recoveryWaitMs();
      appendLog('smart-better-recovery-scheduled', {
        reason: reason,
        current: activeKey,
        candidates: betterSourceKeys(),
        waitMs: waitMs
      });
      smartRecoveryTimer = setTimeout(function() {
        attemptPrimaryReturn(reason || 'scheduled');
      }, waitMs);
    }
    function noteRecovered(eventName) {
      if (!stallStartedAt) return;
      appendLog('stall-recovered', {
        event: eventName,
        durationMs: Date.now() - stallStartedAt,
        currentTime: Number(video.currentTime.toFixed(2)),
        bufferedEnd: bufferedEnd()
      });
      stallStartedAt = 0;
      clearStallTimer();
    }
    function tryFailover(reason) {
      if (Date.now() < failoverLockUntil) return;
      if (!activeSequence.length || activeSequenceIndex >= activeSequence.length - 1) {
        appendLog('failover-unavailable', {
          reason: reason,
          activeKey: activeKey,
          sequence: activeSequence
        });
        return;
      }
      failoverLockUntil = Date.now() + 3000;
      const from = activeKey;
      markSourceFailure(from, reason);
      const nextIndex = activeSequenceIndex + 1;
      const nextKey = activeSequence[nextIndex];
      appendLog('failover-switch', {
        reason: reason,
        from: from,
        to: nextKey,
        sequence: activeSequence
      });
      loadSourceKey(nextKey, 'Auto failover ' + SOURCE_LABELS[nextKey], activeSequence, nextIndex, reason);
      schedulePrimaryRecovery('after-failover-' + reason);
    }
    function noteStall(eventName) {
      if (!stallStartedAt) {
        stallStartedAt = Date.now();
        appendLog('stall-start', {
          event: eventName,
          currentTime: Number(video.currentTime.toFixed(2)),
          bufferedEnd: bufferedEnd()
        });
      }
      clearStallTimer();
      stallTimer = setTimeout(function() {
        tryFailover('stall-timeout-' + eventName);
      }, LONG_STALL_MS);
    }
    function recordBadEvent(kind, details) {
      const now = Date.now();
      badEvents.push(now);
      badEvents = badEvents.filter(function(time) {
        return now - time <= BAD_EVENT_WINDOW_MS;
      });
      appendLog('bad-event-count', {
        kind: kind,
        count: badEvents.length,
        limit: BAD_EVENT_LIMIT,
        details: details || null
      });
      if (badEvents.length >= BAD_EVENT_LIMIT) {
        tryFailover('repeated-' + kind);
      }
    }
    async function inspectSource(src) {
      try {
        const response = await fetch(src, { method: 'HEAD', cache: 'no-store' });
        appendLog('source-head', {
          status: response.status,
          mode: response.headers.get('X-CMTV-Lab-Mode'),
          source: response.headers.get('X-CMTV-Lab-Source'),
          sourceId: response.headers.get('X-CMTV-Lab-Source-Id'),
          detection: response.headers.get('X-CMTV-Lab-Detection'),
          latency: response.headers.get('X-CMTV-Lab-Latency')
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
        navigator.clipboard.writeText(text).then(done).catch(function(error) {
          appendLog('copy-error', error.message);
        });
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
      lastFragUrl = '';
      sameFragCount = 0;
      clearStallTimer();
      appendLog('load-start', src);
      inspectSource(src);
      if (hls) { hls.destroy(); hls = null; }
      video.loop = false;
      video.removeAttribute('src');
      video.load();
      if (window.Hls && Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 7,
          maxBufferLength: 18,
          manifestLoadingTimeOut: 8000,
          levelLoadingTimeOut: 8000,
          fragLoadingTimeOut: 10000
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function(_, data) {
          appendLog('manifest-ok', {
            levels: data.levels ? data.levels.length : 0,
            heights: data.levels ? data.levels.map(function(level) { return level.height || 0; }) : []
          });
          attemptAutoplay('manifest-parsed');
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, function(_, data) {
          const level = hls && hls.levels ? hls.levels[data.level] : null;
          appendLog('level-switched', {
            level: data.level,
            height: level ? level.height : null,
            bitrate: level ? level.bitrate : null
          });
        });
        hls.on(Hls.Events.FRAG_CHANGED, function(_, data) {
          const frag = data.frag || {};
          const fragUrl = frag.url || frag.relurl || '';
          if (fragUrl && fragUrl === lastFragUrl) {
            sameFragCount += 1;
          } else {
            lastFragUrl = fragUrl;
            sameFragCount = 0;
          }
          if (sameFragCount >= 2) {
            recordBadEvent('sameFragRepeated', {
              frag: frag.sn || fragUrl,
              count: sameFragCount
            });
          }
        });
        hls.on(Hls.Events.ERROR, function(_, data) {
          const summary = {
            type: data.type,
            details: data.details,
            fatal: data.fatal,
            status: data.response ? data.response.code : null
          };
          appendLog('hls-error', {
            type: summary.type,
            details: summary.details,
            fatal: summary.fatal,
            status: summary.status
          });
          if (data.fatal) {
            tryFailover('fatal-hls-' + (data.details || data.type || 'error'));
            return;
          }
          if ([
            'bufferStalledError',
            'bufferNudgeOnStall',
            'fragLoadError',
            'fragLoadTimeOut',
            'levelLoadError',
            'levelLoadTimeOut'
          ].indexOf(data.details) !== -1) {
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
      smartRecoveryEpoch += 1;
      activeLabel = label || SOURCE_LABELS[key];
      activeKey = key;
      activeSequence = sequence && sequence.length ? sequence.slice() : [key];
      activeSequenceIndex = typeof index === 'number' ? index : activeSequence.indexOf(key);
      if (activeSequenceIndex < 0) activeSequenceIndex = 0;
      if (activeSourceInfo) activeSourceInfo.textContent = SOURCE_LABELS[key] + ' (' + key + ')';
      appendLog('source-selected', {
        key: key,
        label: SOURCE_LABELS[key],
        reason: reason || 'manual',
        sequence: activeSequence
      });
      if (key === SMART_PRIMARY_SOURCE) {
        clearSmartRecoveryTimers();
      } else if (hasBetterSource()) {
        schedulePrimaryRecovery('source-selected-' + (reason || 'manual'));
      } else {
        clearSmartRecoveryTimers();
      }
      load(SOURCE_URLS[key], label || SOURCE_LABELS[key]);
    }
    function startSequence(sequence, label) {
      const clean = sequence.filter(function(key) { return SOURCE_URLS[key]; });
      if (!clean.length) return;
      loadSourceKey(clean[0], label + ' -> ' + SOURCE_LABELS[clean[0]], clean, 0, 'sequence-start');
    }
    ['loadstart', 'loadedmetadata', 'playing', 'waiting', 'stalled', 'pause', 'ended', 'error'].forEach(function(name) {
      video.addEventListener(name, function() {
        appendLog('video-' + name, {
          currentTime: Number(video.currentTime.toFixed(2)),
          bufferedEnd: bufferedEnd(),
          paused: video.paused,
          muted: video.muted,
          volume: video.volume
        });
        if (name === 'waiting' || name === 'stalled') noteStall(name);
        if (name === 'playing' || name === 'loadedmetadata') {
          noteRecovered(name);
          if (hasBetterSource()) schedulePrimaryRecovery('fallback-' + name);
        }
        if (name === 'ended' || name === 'error') tryFailover('video-' + name);
      });
    });
    video.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastProgressLogAt < 10000) return;
      lastProgressLogAt = now;
      appendLog('progress', {
        currentTime: Number(video.currentTime.toFixed(2)),
        bufferedEnd: bufferedEnd(),
        source: activeSrc
      });
      noteRecovered('timeupdate');
      if (hasBetterSource()) schedulePrimaryRecovery('fallback-progress');
    });
    document.querySelectorAll('button[data-sequence]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        startSequence(btn.dataset.sequence.split(','), btn.textContent.trim());
      });
    });
    document.querySelectorAll('button[data-source]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        loadSourceKey(btn.dataset.source, btn.textContent.trim(), [btn.dataset.source], 0, 'manual');
      });
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
__name(playerLabPage, "playerLabPage");
function htmlPage(origin) {
  return playerLabPage({
    title: "CMTV Smart LiveWatch",
    consoleLabel: "CMTV Smart",
    autoUrl: `${origin}/api/cmtv/auto/master.m3u8`,
    autoLabel: "Auto worker",
    statusUrl: `${origin}/api/cmtv/status`,
    sources: {
      cable: {
        url: `${origin}/api/cmtv/cable/master.m3u8`,
        label: "LiveWatch cable",
        button: "Cable"
      },
      basic: {
        url: `${origin}/api/cmtv/basic/master.m3u8`,
        label: "LiveWatch basic",
        button: "Basic"
      },
      clouding: {
        url: `${origin}/api/cmtv/clouding/master.m3u8`,
        label: "Clouding",
        button: "Clouding"
      }
    },
    sequences: [
      { keys: ["cable", "basic", "clouding"], label: "Smart Cable -> Basic -> Clouding" }
    ],
    startSequence: ["cable", "basic", "clouding"],
    startLabel: "Smart Cable -> Basic -> Clouding"
  });
}
__name(htmlPage, "htmlPage");
var worker_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    if (path === "/" || path === "/index.html") {
      const headers = new Headers(corsHeaders());
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      return new Response(htmlPage(url.origin), { status: 200, headers });
    }
    if (path === PROXY_PATH) return handleProxy(request, url);
    if (path === "/api/cmtv/status") return handleStatus(request);
    if (path === "/api/live/cmtv/health") return handleStatus(request);
    if (path === "/api/live/cmtv/master.m3u8") return handleMaster(request, url, "auto");
    const match = path.match(/^\/api\/cmtv\/(auto|cable|basic|clouding)\/master\.m3u8$/);
    if (match) return handleMaster(request, url, match[1]);
    const liveMatch = path.match(/^\/api\/live\/cmtv\/(auto|cable|basic|clouding)\/master\.m3u8$/);
    if (liveMatch) return handleMaster(request, url, liveMatch[1]);
    return new Response("CMTV lab: not found", {
      status: 404,
      headers: corsHeaders()
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
