// Worker Player v14 - Adaptive Headers Stable HLS Gateway
// Objectif : garder la stabilité v11, décoder les tokens en mode passif, éviter le direct m3u8 agressif, et fallback automatique.

const MAX_BYTES = 80 * 1024 * 1024;
const TIMEOUT_MS = 18000;
const PLAYLIST_STALE_MS = 90000;
const PLAYLIST_GRACE_MS = 5 * 60 * 1000;
const PLAYLIST_CACHE_MAX = 180;
const MASTER_REFRESH_COOLDOWN_MS = 1100;
const MASTER_REFRESH_ERROR_COOLDOWN_MS = 3500;
const TOKEN_RENEW_MARGIN_MS = 90000;
const STREAM_STATE_CACHE_MAX = 80;
const DIRECT_M3U8_PREFER = false; // v13: ne force plus le .m3u8 final direct, car certaines sources refusent hors route playlist
const INLINE_SINGLE_VARIANT = false; // v13: évite de court-circuiter la master playlist, fallback plus sûr
const UPSTREAM_RETRY_BASE_MS = 260;

const playlistMemoryCache = new Map();
const streamStateCache = new Map();

function pruneOldest(map, maxSize) {
  while (map.size > maxSize) {
    const firstKey = map.keys().next().value;
    if (!firstKey) break;
    map.delete(firstKey);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "pragma": "no-cache",
      "expires": "0"
    }
  });
}

function noCacheHeaders(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  return headers;
}

function corsHeaders(headers = new Headers()) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "*");
  headers.set("access-control-expose-headers", "content-length, content-range, accept-ranges, content-type, x-stable-mode, x-stable-fallback, x-source-status");
  headers.set("x-content-type-options", "nosniff");
  return noCacheHeaders(headers);
}

function isBlockedHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(h)) return true;
  if (/^10[.]/.test(h)) return true;
  if (/^192[.]168[.]/.test(h)) return true;
  if (/^172[.](1[6-9]|2[0-9]|3[0-1])[.]/.test(h)) return true;
  return false;
}

function safeUrl(value) {
  if (!value) throw new Error("URL manquante");
  let u;
  try { u = new URL(value); } catch { throw new Error("URL invalide"); }
  if (u.protocol !== "https:") throw new Error("HTTPS uniquement");
  if (isBlockedHost(u.hostname)) throw new Error("Hôte bloqué");
  return u;
}

function withTimeout(ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(id) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isExpiredStatus(status) {
  return status === 401 || status === 403 || status === 410;
}


function base64UrlToString(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  try {
    return atob(padded);
  } catch (_e) {
    return "";
  }
}

function decodeTokenPayloadFromUrl(value) {
  try {
    const u = new URL(value);
    const token = u.searchParams.get("token") || "";
    if (!token) return null;
    const decoded = base64UrlToString(token);
    if (!decoded || decoded[0] !== "{") return null;
    return JSON.parse(decoded);
  } catch (_e) {
    return null;
  }
}

function expiresFromM3u8Url(value) {
  try {
    const u = new URL(value);
    const raw = u.searchParams.get("expires") || u.searchParams.get("expire") || u.searchParams.get("e") || "";
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n < 1000000000000 ? n * 1000 : n;
  } catch (_e) {
    return 0;
  }
}

function profileFromPayload(payload, tokenUrl = "") {
  const profile = { tokenUrl, referer: "", origin: "", channelId: "", directM3u8: "", expiresAt: 0, ts: 0 };
  if (!payload || typeof payload !== "object") return profile;
  const ref = payload.referrer || payload.referer || payload.originUrl || "";
  if (ref) {
    profile.referer = String(ref);
    try { profile.origin = new URL(profile.referer).origin; } catch (_e) {}
  }
  if (payload.channelId) profile.channelId = String(payload.channelId);
  if (payload.m3u8) {
    profile.directM3u8 = String(payload.m3u8);
    profile.expiresAt = expiresFromM3u8Url(profile.directM3u8);
  }
  if (payload.expires || payload.expire) {
    const exp = Number(payload.expires || payload.expire);
    if (Number.isFinite(exp) && exp > 0) profile.expiresAt = exp < 1000000000000 ? exp * 1000 : exp;
  }
  if (payload.ts) {
    const ts = Number(payload.ts);
    if (Number.isFinite(ts)) profile.ts = ts;
  }
  return profile;
}

function profileFromTokenUrl(value) {
  return profileFromPayload(decodeTokenPayloadFromUrl(value), value || "");
}

function mergeStateProfile(state, profile) {
  if (!state || !profile) return;
  if (profile.tokenUrl) state.lastEnrichedTokenUrl = profile.tokenUrl;
  if (profile.referer) state.referrer = profile.referer;
  if (profile.origin) state.origin = profile.origin;
  if (profile.channelId) state.channelId = profile.channelId;
  if (profile.directM3u8) state.directM3u8 = profile.directM3u8;
  if (profile.expiresAt) state.expiresAt = profile.expiresAt;
  state.profileUpdatedAt = Date.now();
}

function stateUpstreamContext(state) {
  if (!state) return null;
  return {
    referer: state.referrer || "",
    origin: state.origin || "",
    channelId: state.channelId || "",
    directM3u8: state.directM3u8 || ""
  };
}

function isDirectM3u8Fresh(state) {
  if (!state || !state.directM3u8) return false;
  if (!state.expiresAt) return true;
  return Date.now() < state.expiresAt - TOKEN_RENEW_MARGIN_MS;
}

function upstreamContextFromRequest(request, targetUrl, explicitContext = null) {
  const context = { referer: "", origin: "", channelId: "", directM3u8: "" };

  function applyFromPayload(payload) {
    if (!payload || typeof payload !== "object") return;
    const ref = payload.referrer || payload.referer || payload.originUrl || "";
    if (ref && !context.referer) {
      context.referer = String(ref);
      try { context.origin = new URL(context.referer).origin; } catch (_e) {}
    }
    if (payload.channelId && !context.channelId) context.channelId = String(payload.channelId);
    if (payload.m3u8 && !context.directM3u8) context.directM3u8 = String(payload.m3u8);
  }

  function applyContext(extra) {
    if (!extra) return;
    if (extra.referer && !context.referer) context.referer = String(extra.referer);
    if (extra.origin && !context.origin) context.origin = String(extra.origin);
    if (extra.channelId && !context.channelId) context.channelId = String(extra.channelId);
    if (extra.directM3u8 && !context.directM3u8) context.directM3u8 = String(extra.directM3u8);
    if (context.referer && !context.origin) {
      try { context.origin = new URL(context.referer).origin; } catch (_e) {}
    }
  }

  applyContext(explicitContext);
  applyFromPayload(decodeTokenPayloadFromUrl(targetUrl));

  try {
    const reqUrl = new URL(request.url);
    const src = reqUrl.searchParams.get("src") || "";
    const parent = reqUrl.searchParams.get("parent") || "";
    applyFromPayload(decodeTokenPayloadFromUrl(src));
    applyFromPayload(decodeTokenPayloadFromUrl(parent));
    const srcState = src ? streamStateCache.get(src) : null;
    applyContext(stateUpstreamContext(srcState));
  } catch (_e) {}

  return context;
}

function applyUpstreamVideoHeaders(headers, request, targetUrl, explicitContext = null) {
  const context = upstreamContextFromRequest(request, targetUrl, explicitContext);
  let host = "";
  let path = "";
  try {
    const u = new URL(targetUrl);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch (_e) {}

  const isChatPlaylist = host === "chat.cfbu247.sbs" && path.includes("/api/proxy/playlist");
  const isFinalHls = /[.]m3u8($|[?#])/i.test(String(targetUrl || ""));

  if (isChatPlaylist) {
    // Important : l'endpoint master chat.cfbu247.sbs est plus stable avec un profil navigateur.
    // Le profil VLC est gardé pour les vraies playlists/segments HLS, mais il peut provoquer des 520 sur le master API.
    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0");
    headers.set("accept", "application/vnd.apple.mpegurl, application/x-mpegURL, text/plain, */*");
    headers.set("accept-language", "fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7");
    headers.set("cache-control", "no-cache");
    headers.set("pragma", "no-cache");
    return context;
  }

  if (isFinalHls) {
    headers.set("user-agent", "VLC/3.0.20 LibVLC/3.0.20");
  } else {
    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0");
  }

  headers.set("accept", "application/vnd.apple.mpegurl, application/x-mpegURL, video/mp2t, video/*, audio/*, application/octet-stream, */*");
  headers.set("accept-language", "fr-FR,fr;q=0.9,en;q=0.8");
  headers.set("cache-control", "no-cache");
  headers.set("pragma", "no-cache");
  if (context.referer) headers.set("referer", context.referer);
  if (context.origin) headers.set("origin", context.origin);
  return context;
}

async function fetchRemoteOnce(url, request, method = "GET", explicitContext = null) {
  const timeout = withTimeout();
  const headers = new Headers();
  applyUpstreamVideoHeaders(headers, request, url.toString(), explicitContext);
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  try {
    return await fetch(url.toString(), {
      method,
      redirect: "follow",
      signal: timeout.controller.signal,
      headers
    });
  } finally {
    timeout.done();
  }
}

async function fetchRemote(url, request, method = "GET", tries = 3, explicitContext = null) {
  let lastError = null;
  let lastResponse = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetchRemoteOnce(url, request, method, explicitContext);
      if (!isRetryableStatus(response.status) || attempt === tries) return response;
      lastResponse = response;
      try { if (response.body) await response.body.cancel(); } catch (_e) {}
      await sleep(UPSTREAM_RETRY_BASE_MS * attempt + Math.floor(Math.random() * 120));
    } catch (e) {
      lastError = e;
      if (attempt === tries) throw e;
      await sleep(UPSTREAM_RETRY_BASE_MS * attempt + Math.floor(Math.random() * 120));
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error("Fetch distant impossible");
}

function absoluteUrl(value, base) {
  try { return new URL(value, base).toString(); } catch { return value; }
}

function looksLikeHlsUrl(value) {
  const s = String(value || "");
  try {
    const u = new URL(s);
    const path = u.pathname.toLowerCase();
    return /[.]m3u8($|[?#])/.test(s.toLowerCase()) || /(^|\/)playlist($|[/?#])/.test(path);
  } catch {
    return /[.]m3u8($|[?#])/i.test(s) || /\/playlist([/?#]|$)/i.test(s);
  }
}

function looksLikeManifestText(text) {
  const t = String(text || "").trimStart();
  return t.startsWith("#EXTM3U") || t.includes("#EXT-X-STREAM-INF") || t.includes("#EXTINF:");
}

function isProbablyManifestResponse(response, finalUrl, text) {
  const ct = response.headers.get("content-type") || "";
  return ct.includes("application/vnd.apple.mpegurl") || ct.includes("mpegurl") || looksLikeHlsUrl(finalUrl) || looksLikeManifestText(text || "");
}

function getState(src) {
  const key = String(src || "");
  let state = streamStateCache.get(key);
  if (!state) {
    state = {
      src: key,
      lastMasterText: "",
      lastMasterUrl: "",
      lastMasterAt: 0,
      lastChildUrl: "",
      lastResolveAt: 0,
      lastResolveErrorAt: 0,
      consecutiveErrors: 0,
      lastFailureAt: 0,
      lastFailureStatus: 0,
      lastGoodPlaylistText: "",
      lastGoodPlaylistUrl: "",
      lastGoodPlaylistAt: 0,
      lastEnrichedTokenUrl: "",
      directM3u8: "",
      referrer: "",
      origin: "",
      channelId: "",
      expiresAt: 0,
      profileUpdatedAt: 0
    };
    streamStateCache.set(key, state);
    pruneOldest(streamStateCache, STREAM_STATE_CACHE_MAX);
  }
  return state;
}

function memoryKey(src, target) {
  return String(src || "") + "\n" + String(target || "");
}

function rememberPlaylist(key, text, finalUrl) {
  if (!key || !looksLikeManifestText(text)) return;
  playlistMemoryCache.set(key, { text, finalUrl, savedAt: Date.now() });
  pruneOldest(playlistMemoryCache, PLAYLIST_CACHE_MAX);
}

function rememberStatePlaylist(state, text, finalUrl) {
  if (!state || !looksLikeManifestText(text)) return;
  state.lastGoodPlaylistText = text;
  state.lastGoodPlaylistUrl = finalUrl || "";
  state.lastGoodPlaylistAt = Date.now();
}

function getFreshPlaylistFromMemory(key, maxAgeMs = PLAYLIST_STALE_MS) {
  const item = playlistMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.savedAt > maxAgeMs) {
    playlistMemoryCache.delete(key);
    return null;
  }
  playlistMemoryCache.delete(key);
  playlistMemoryCache.set(key, item);
  return item;
}

function getStatePlaylistFallback(state, maxAgeMs = PLAYLIST_GRACE_MS) {
  if (!state || !state.lastGoodPlaylistText || !looksLikeManifestText(state.lastGoodPlaylistText)) return null;
  if (Date.now() - state.lastGoodPlaylistAt > maxAgeMs) return null;
  return { text: state.lastGoodPlaylistText, finalUrl: state.lastGoodPlaylistUrl || state.lastChildUrl || state.lastMasterUrl };
}

function assetUrl(origin, target, src = "") {
  const u = new URL(origin + "/");
  u.searchParams.set("action", "asset");
  u.searchParams.set("url", target);
  if (src) u.searchParams.set("src", src);
  return u.toString();
}

function stableUrl(origin, src, target) {
  const u = new URL(origin + "/");
  u.searchParams.set("action", "stable");
  u.searchParams.set("src", src);
  if (target) u.searchParams.set("u", target);
  return u.toString();
}

function proxyUrl(origin, target) {
  return origin + "/?action=proxy&url=" + encodeURIComponent(target);
}

function routeManifestUri(origin, src, abs) {
  return looksLikeHlsUrl(abs) ? stableUrl(origin, src, abs) : assetUrl(origin, abs, src);
}

function rewriteStableManifest(text, sourceUrl, origin, src) {
  const base = sourceUrl.toString();
  const lines = String(text || "").split(/\r?\n/);

  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (
      trimmed.startsWith("#EXT-X-KEY") ||
      trimmed.startsWith("#EXT-X-MAP") ||
      trimmed.startsWith("#EXT-X-MEDIA") ||
      trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF")
    ) {
      return line.replace(/URI="([^"]+)"/g, function (_m, uri) {
        const abs = absoluteUrl(uri, base);
        return "URI=\"" + routeManifestUri(origin, src, abs) + "\"";
      });
    }

    if (trimmed.startsWith("#")) return line;

    const abs = absoluteUrl(trimmed, base);
    return routeManifestUri(origin, src, abs);
  }).join("\n");
}

function rewriteProxyManifest(text, sourceUrl, origin) {
  const base = sourceUrl.toString();
  const lines = String(text || "").split(/\r?\n/);
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (
      trimmed.startsWith("#EXT-X-KEY") ||
      trimmed.startsWith("#EXT-X-MAP") ||
      trimmed.startsWith("#EXT-X-MEDIA") ||
      trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF")
    ) {
      return line.replace(/URI="([^"]+)"/g, function (_m, uri) {
        const abs = absoluteUrl(uri, base);
        return "URI=\"" + proxyUrl(origin, abs) + "\"";
      });
    }
    if (trimmed.startsWith("#")) return line;
    return proxyUrl(origin, absoluteUrl(trimmed, base));
  }).join("\n");
}


function isMasterVariantPlaylist(text) {
  return String(text || "").includes("#EXT-X-STREAM-INF");
}

function isMediaPlaylist(text) {
  const t = String(text || "");
  return t.includes("#EXTINF:") || t.includes("#EXT-X-TARGETDURATION") || t.includes("#EXT-X-MEDIA-SEQUENCE");
}

function extractManifestCandidates(text, baseUrl) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const uriMatches = [...trimmed.matchAll(/URI="([^"]+)"/g)];
    for (const m of uriMatches) {
      const abs = absoluteUrl(m[1], baseUrl);
      if (looksLikeHlsUrl(abs)) out.push(abs);
    }
    if (!trimmed.startsWith("#")) {
      const abs = absoluteUrl(trimmed, baseUrl);
      if (looksLikeHlsUrl(abs)) out.push(abs);
    }
  }
  return [...new Set(out)];
}

function extractTokenProfilesFromManifest(text, baseUrl) {
  const profiles = [];
  const candidates = extractManifestCandidates(text, baseUrl);
  for (const candidate of candidates) {
    const profile = profileFromTokenUrl(candidate);
    if (profile.directM3u8 || profile.referer || profile.channelId) profiles.push(profile);
  }
  return profiles;
}

function chooseBestProfile(profiles, oldTarget = "") {
  if (!profiles || !profiles.length) return null;
  if (oldTarget) {
    try {
      const oldUrl = new URL(oldTarget);
      const sameChannel = profiles.find((p) => p.channelId && oldTarget.includes('"channelId":"' + p.channelId + '"'));
      if (sameChannel) return sameChannel;
      const sameHost = profiles.find((p) => {
        try { return p.directM3u8 && new URL(p.directM3u8).hostname === oldUrl.hostname; } catch (_e) { return false; }
      });
      if (sameHost) return sameHost;
    } catch (_e) {}
  }
  return profiles.find((p) => p.directM3u8) || profiles[0];
}

function selectFetchTargetForState(srcUrl, targetUrl, state) {
  const targetProfile = profileFromTokenUrl(targetUrl);
  mergeStateProfile(state, targetProfile);
  if (DIRECT_M3U8_PREFER && targetProfile.directM3u8) return { url: targetProfile.directM3u8, via: "token-direct", context: stateUpstreamContext(state) };
  if (DIRECT_M3U8_PREFER && targetUrl === srcUrl && isDirectM3u8Fresh(state)) return { url: state.directM3u8, via: "state-direct", context: stateUpstreamContext(state) };
  return { url: targetUrl, via: "normal", context: stateUpstreamContext(state) };
}

function chooseReplacementCandidate(candidates, oldTarget) {
  if (!candidates.length) return "";
  if (!oldTarget) return candidates[0];
  try {
    const oldUrl = new URL(oldTarget);
    const samePath = candidates.find((c) => {
      try { return new URL(c).pathname === oldUrl.pathname; } catch { return false; }
    });
    if (samePath) return samePath;
    const sameHost = candidates.find((c) => {
      try { return new URL(c).hostname === oldUrl.hostname; } catch { return false; }
    });
    if (sameHost) return sameHost;
  } catch (_e) {}
  return candidates[0];
}

async function fetchMasterForState(srcUrl, request, state) {
  const now = Date.now();
  const src = safeUrl(srcUrl);
  const response = await fetchRemote(src, request, "GET", 4);
  const finalUrl = response.url || src.toString();
  if (!response.ok) return { ok: false, status: response.status, finalUrl, text: "" };
  const text = await response.text();
  if (!looksLikeManifestText(text)) return { ok: false, status: 422, finalUrl, text };
  state.lastMasterText = text;
  state.lastMasterUrl = finalUrl;
  state.lastMasterAt = now;
  const profiles = extractTokenProfilesFromManifest(text, finalUrl);
  const bestProfile = chooseBestProfile(profiles);
  if (bestProfile) mergeStateProfile(state, bestProfile);
  rememberPlaylist(memoryKey(srcUrl, srcUrl), text, finalUrl);
  rememberPlaylist(memoryKey(srcUrl, finalUrl), text, finalUrl);
  if (isMediaPlaylist(text)) rememberStatePlaylist(state, text, finalUrl);
  return { ok: true, status: response.status, finalUrl, text, profiles };
}

async function tryRefreshChildFromMaster(srcUrl, oldTarget, request, state) {
  const now = Date.now();
  if (now - state.lastResolveAt < MASTER_REFRESH_COOLDOWN_MS && state.lastChildUrl) {
    return { ok: false, status: 429, reason: "cooldown" };
  }
  if (now - state.lastResolveErrorAt < MASTER_REFRESH_ERROR_COOLDOWN_MS && state.lastChildUrl) {
    return { ok: false, status: 429, reason: "error-cooldown" };
  }
  state.lastResolveAt = now;

  const master = await fetchMasterForState(srcUrl, request, state);
  if (!master.ok) {
    state.lastResolveErrorAt = Date.now();
    return { ok: false, status: master.status, reason: "master" };
  }

  const profiles = master.profiles || extractTokenProfilesFromManifest(master.text, master.finalUrl);
  const bestProfile = chooseBestProfile(profiles, oldTarget);
  if (bestProfile) mergeStateProfile(state, bestProfile);
  const candidates = extractManifestCandidates(master.text, master.finalUrl);
  let replacement = "";
  if (DIRECT_M3U8_PREFER && state.directM3u8) replacement = state.directM3u8;
  if (!replacement) replacement = chooseReplacementCandidate(candidates, oldTarget);
  if (!replacement) return { ok: false, status: 404, reason: "no-candidate" };

  const replacementUrl = safeUrl(replacement);
  const response = await fetchRemote(replacementUrl, request, "GET", 4, stateUpstreamContext(state));
  const finalUrl = response.url || replacementUrl.toString();
  if (!response.ok) {
    state.lastResolveErrorAt = Date.now();
    return { ok: false, status: response.status, reason: "replacement", finalUrl };
  }
  const text = await response.text();
  if (!looksLikeManifestText(text)) {
    state.lastResolveErrorAt = Date.now();
    return { ok: false, status: 422, reason: "replacement-not-hls", finalUrl };
  }

  state.lastChildUrl = finalUrl;
  rememberPlaylist(memoryKey(srcUrl, oldTarget || replacement), text, finalUrl);
  rememberPlaylist(memoryKey(srcUrl, replacement), text, finalUrl);
  rememberPlaylist(memoryKey(srcUrl, finalUrl), text, finalUrl);
  rememberStatePlaylist(state, text, finalUrl);
  return { ok: true, status: response.status, finalUrl, text, replacement };
}

function stablePlaylistResponse(text, finalUrl, request, src, extraHeaders = {}) {
  const origin = new URL(request.url).origin;
  const rewritten = rewriteStableManifest(text, new URL(finalUrl), origin, src);
  const headers = corsHeaders(new Headers({
    "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
    "x-stable-mode": "1",
    ...extraHeaders
  }));
  headers.delete("content-length");
  return new Response(rewritten, { status: 200, headers });
}

async function stableManifest(request, srcValue, targetValue) {
  let srcUrl;
  let targetUrl;
  try {
    srcUrl = safeUrl(srcValue).toString();
    targetUrl = targetValue ? safeUrl(targetValue).toString() : srcUrl;
  } catch (e) {
    return new Response(e.message, { status: 400, headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
  }

  const state = getState(srcUrl);
  const requestedTargetUrl = targetUrl;
  let selected = selectFetchTargetForState(srcUrl, targetUrl, state);
  targetUrl = selected.url;
  const key = memoryKey(srcUrl, requestedTargetUrl);

  try {
    if (requestedTargetUrl === srcUrl && !isDirectM3u8Fresh(state)) {
      try { await fetchMasterForState(srcUrl, request, state); } catch (_warmError) {}
      selected = selectFetchTargetForState(srcUrl, requestedTargetUrl, state);
      targetUrl = selected.url;
    }
    const target = safeUrl(targetUrl);
    let response = await fetchRemote(target, request, "GET", 4, selected.context || stateUpstreamContext(state));
    let finalUrl = response.url || target.toString();
    let sourceStatus = response.status;

    if (!response.ok && targetUrl !== srcUrl && (isExpiredStatus(response.status) || isRetryableStatus(response.status))) {
      const refreshed = await tryRefreshChildFromMaster(srcUrl, targetUrl, request, state);
      if (refreshed.ok) {
        state.consecutiveErrors = 0;
        return stablePlaylistResponse(refreshed.text, refreshed.finalUrl, request, srcUrl, {
          "x-stable-fallback": "refresh-master",
          "x-source-status": String(sourceStatus)
        });
      }
    }

    if (!response.ok && (isRetryableStatus(response.status) || isExpiredStatus(response.status))) {
      state.consecutiveErrors += 1;
      state.lastFailureAt = Date.now();
      state.lastFailureStatus = response.status;
      const stale = getFreshPlaylistFromMemory(key)
        || getFreshPlaylistFromMemory(memoryKey(srcUrl, state.lastChildUrl), PLAYLIST_GRACE_MS)
        || getStatePlaylistFallback(state);
      if (stale) {
        return stablePlaylistResponse(stale.text, stale.finalUrl, request, srcUrl, {
          "x-stable-fallback": "stale-playlist",
          "x-source-status": String(response.status)
        });
      }
    }

    if (!response.ok) {
      state.consecutiveErrors += 1;
      state.lastFailureAt = Date.now();
      state.lastFailureStatus = response.status;
      return new Response("Source distante HTTP " + response.status, {
        status: response.status,
        headers: corsHeaders(new Headers({
          "content-type": "text/plain; charset=utf-8",
          "x-stable-mode": "1",
          "x-source-status": String(response.status)
        }))
      });
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return new Response("Fichier trop volumineux", { status: 413, headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
    }

    const text = await response.text();
    if (!isProbablyManifestResponse(response, finalUrl, text)) {
      const headers = corsHeaders(new Headers(response.headers));
      headers.delete("content-length");
      return new Response(text, { status: response.status, headers });
    }

    if (!looksLikeManifestText(text)) {
      const stale = getFreshPlaylistFromMemory(key)
        || getFreshPlaylistFromMemory(memoryKey(srcUrl, state.lastChildUrl), PLAYLIST_GRACE_MS)
        || getStatePlaylistFallback(state);
      if (stale) {
        return stablePlaylistResponse(stale.text, stale.finalUrl, request, srcUrl, {
          "x-stable-fallback": "invalid-body-stale",
          "x-source-status": String(sourceStatus)
        });
      }
      return new Response(text, { status: response.status, headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
    }

    state.consecutiveErrors = 0;
    const profiles = extractTokenProfilesFromManifest(text, finalUrl);
    const bestProfile = chooseBestProfile(profiles, requestedTargetUrl);
    if (bestProfile) mergeStateProfile(state, bestProfile);

    if (INLINE_SINGLE_VARIANT && requestedTargetUrl === srcUrl && isMasterVariantPlaylist(text)) {
      const candidates = extractManifestCandidates(text, finalUrl);
      if (candidates.length === 1 || state.directM3u8) {
        const candidateProfile = candidates.length ? profileFromTokenUrl(candidates[0]) : null;
        if (candidateProfile) mergeStateProfile(state, candidateProfile);
        const childTarget = (DIRECT_M3U8_PREFER && state.directM3u8) ? state.directM3u8 : candidates[0];
        const childKey = memoryKey(srcUrl, childTarget);
        try {
          const childUrl = safeUrl(childTarget);
          const childResponse = await fetchRemote(childUrl, request, "GET", 5, stateUpstreamContext(state));
          const childFinalUrl = childResponse.url || childUrl.toString();
          const childStatus = childResponse.status;
          if (childResponse.ok) {
            const childText = await childResponse.text();
            if (looksLikeManifestText(childText)) {
              state.lastMasterText = text;
              state.lastMasterUrl = finalUrl;
              state.lastMasterAt = Date.now();
              state.lastChildUrl = childFinalUrl;
              rememberPlaylist(memoryKey(srcUrl, srcUrl), text, finalUrl);
              rememberPlaylist(childKey, childText, childFinalUrl);
              rememberPlaylist(memoryKey(srcUrl, childFinalUrl), childText, childFinalUrl);
              rememberStatePlaylist(state, childText, childFinalUrl);
              return stablePlaylistResponse(childText, childFinalUrl, request, srcUrl, {
                "x-stable-fallback": "inline-single-variant",
                "x-source-status": String(childStatus)
              });
            }
          }

          if (isRetryableStatus(childStatus) || isExpiredStatus(childStatus)) {
            const staleChild = getFreshPlaylistFromMemory(childKey)
              || getFreshPlaylistFromMemory(memoryKey(srcUrl, state.lastChildUrl), PLAYLIST_GRACE_MS)
              || getStatePlaylistFallback(state);
            if (staleChild) {
              return stablePlaylistResponse(staleChild.text, staleChild.finalUrl, request, srcUrl, {
                "x-stable-fallback": "inline-stale-child",
                "x-source-status": String(childStatus)
              });
            }
          }
        } catch (_childError) {
          const staleChild = getFreshPlaylistFromMemory(childKey)
            || getFreshPlaylistFromMemory(memoryKey(srcUrl, state.lastChildUrl), PLAYLIST_GRACE_MS)
            || getStatePlaylistFallback(state);
          if (staleChild) {
            return stablePlaylistResponse(staleChild.text, staleChild.finalUrl, request, srcUrl, {
              "x-stable-fallback": "inline-exception-stale-child",
              "x-source-status": "0"
            });
          }
        }
      }
    }

    if (requestedTargetUrl === srcUrl) {
      state.lastMasterText = text;
      state.lastMasterUrl = finalUrl;
      state.lastMasterAt = Date.now();
    } else {
      state.lastChildUrl = finalUrl;
    }
    rememberPlaylist(key, text, finalUrl);
    rememberPlaylist(memoryKey(srcUrl, finalUrl), text, finalUrl);
    rememberStatePlaylist(state, text, finalUrl);
    return stablePlaylistResponse(text, finalUrl, request, srcUrl, {
      "x-stable-fallback": "0",
      "x-source-status": String(sourceStatus)
    });
  } catch (e) {
    state.consecutiveErrors += 1;
    state.lastFailureAt = Date.now();
    state.lastFailureStatus = 0;
    const stale = getFreshPlaylistFromMemory(key)
      || getFreshPlaylistFromMemory(memoryKey(srcUrl, state.lastChildUrl), PLAYLIST_GRACE_MS)
      || getStatePlaylistFallback(state);
    if (stale) {
      return stablePlaylistResponse(stale.text, stale.finalUrl, request, srcUrl, {
        "x-stable-fallback": "exception-stale",
        "x-source-status": "0"
      });
    }
    return new Response("Stable gateway error: " + e.message, {
      status: 500,
      headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8", "x-stable-mode": "1" }))
    });
  }
}

function findM3u8InHtml(html, baseUrl) {
  const decoded = String(html || "").replace(/&amp;/g, "&");
  const direct = decoded.match(/https?:\/\/[^'"<>\s]+[.]m3u8[^'"<>\s]*/i);
  if (direct && direct[0]) return direct[0];
  const relative = decoded.match(/["']([^"']+[.]m3u8[^"']*)["']/i);
  if (relative && relative[1]) return absoluteUrl(relative[1], baseUrl);
  return "";
}

async function resolveTarget(request, target) {
  let targetUrl;
  try { targetUrl = safeUrl(target); } catch (e) { return json({ ok: false, error: e.message }, 400); }

  try {
    const response = await fetchRemote(targetUrl, request, "GET", 4);
    const contentType = response.headers.get("content-type") || "";
    const finalUrl = response.url || targetUrl.toString();
    const origin = new URL(request.url).origin;

    if (!response.ok) {
      return json({ ok: false, error: "Source distante indisponible: HTTP " + response.status, status: response.status, contentType, finalUrl }, 502);
    }

    if (contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("mpegurl") || looksLikeHlsUrl(finalUrl)) {
      return json({ ok: true, type: "hls", url: finalUrl, proxiedUrl: stableUrl(origin, targetUrl.toString(), finalUrl), stableUrl: stableUrl(origin, targetUrl.toString(), finalUrl), contentType: contentType || "application/vnd.apple.mpegurl" });
    }

    if (contentType.startsWith("video/") || contentType.startsWith("audio/") || /[.](mp4|webm|mp3|aac|m4a)([?]|$)/i.test(finalUrl)) {
      return json({ ok: true, type: "direct", url: finalUrl, proxiedUrl: assetUrl(origin, finalUrl), contentType });
    }

    const html = await response.text();
    if (looksLikeManifestText(html)) {
      return json({ ok: true, type: "hls", url: finalUrl, proxiedUrl: stableUrl(origin, targetUrl.toString(), finalUrl), stableUrl: stableUrl(origin, targetUrl.toString(), finalUrl), contentType: "application/vnd.apple.mpegurl", detectedByBody: true });
    }

    const found = findM3u8InHtml(html, finalUrl);
    if (found) {
      return json({ ok: true, type: "hls", url: found, proxiedUrl: stableUrl(origin, targetUrl.toString(), found), stableUrl: stableUrl(origin, targetUrl.toString(), found), contentType: "application/vnd.apple.mpegurl", foundInHtml: true });
    }

    return json({ ok: false, error: "La source renvoie du HTML, mais aucune URL .m3u8 n'a été trouvée dans la page.", contentType, finalUrl }, 422);
  } catch (e) {
    return json({ ok: false, error: "Erreur resolve: " + e.message }, 500);
  }
}

async function proxy(request, target, stableRewrite = false, tries = 4) {
  let targetUrl;
  try { targetUrl = safeUrl(target); } catch (e) {
    return new Response(e.message, { status: 400, headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
  }

  try {
    const response = await fetchRemote(targetUrl, request, "GET", tries);
    const contentType = response.headers.get("content-type") || "";
    const finalUrl = response.url || targetUrl.toString();
    const contentLength = response.headers.get("content-length");

    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return new Response("Fichier trop volumineux", { status: 413, headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
    }

    const headers = corsHeaders(new Headers(response.headers));

    if (contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("mpegurl") || looksLikeHlsUrl(finalUrl)) {
      const text = await response.text();
      if (looksLikeManifestText(text)) {
        const origin = new URL(request.url).origin;
        const rewritten = stableRewrite ? rewriteStableManifest(text, new URL(finalUrl), origin, targetUrl.toString()) : rewriteProxyManifest(text, new URL(finalUrl), origin);
        headers.set("content-type", "application/vnd.apple.mpegurl; charset=utf-8");
        headers.delete("content-length");
        return new Response(rewritten, { status: response.status, headers });
      }
      headers.delete("content-length");
      return new Response(text, { status: response.status, headers });
    }

    return new Response(response.body, { status: response.status, headers });
  } catch (e) {
    return new Response("Proxy error: " + e.message, { status: 500, headers: corsHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const DEFAULT_STREAM_URL = "https://chat.cfbu247.sbs/api/proxy/playlist?token=eyJjaGFubmVsSWQiOiI0NjkiLCJ0cyI6MTc4MDQxNTc1MDc0Mn0";
const DEFAULT_LOGO_URL = "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/tf1-fr.png";

function page(defaultUrl = DEFAULT_STREAM_URL, logoUrl = DEFAULT_LOGO_URL) {
  const escaped = escapeHtml(defaultUrl || DEFAULT_STREAM_URL);
  const escapedLogo = escapeHtml(logoUrl || DEFAULT_LOGO_URL);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Player Stable v12</title>
  <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
    body{position:fixed;inset:0;font-family:Arial,Helvetica,sans-serif}
    video{position:fixed;inset:0;width:100vw;height:100vh;background:#000;object-fit:fill}
    #bootScreen{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;transition:opacity .35s ease,visibility .35s ease}
    #bootScreen.boot-hidden{opacity:0;visibility:hidden;pointer-events:none}
    .boot-card{width:min(520px,90vw);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;transform:translateY(-2vh)}
    .channel-logo{width:min(230px,58vw);max-height:95px;object-fit:contain;display:block;margin-bottom:8px;user-select:none;box-sizing:border-box;animation:logoPulse 1.6s ease-in-out infinite;transform-origin:center;will-change:transform,filter,opacity}
    @keyframes logoPulse{0%{transform:scale(1);opacity:1;filter:drop-shadow(0 0 0 rgba(255,255,255,0))}50%{transform:scale(1.06);opacity:.92;filter:drop-shadow(0 0 12px rgba(255,255,255,.65))}100%{transform:scale(1);opacity:1;filter:drop-shadow(0 0 0 rgba(255,255,255,0))}}
    .channel-logo.logo-error{display:none}
    .ring{width:62px;height:62px;border-radius:50%;border:8px solid rgba(255,255,255,.10);border-top-color:#3c82ff;animation:spin 1s linear infinite;box-sizing:border-box}
    @keyframes spin{to{transform:rotate(360deg)}}
    .progress-track{width:min(340px,72vw);height:6px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
    .progress-fill{width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#2f70ff,#9fd2ff);transition:width .25s ease}
    .progress-status{margin-top:-4px;font-size:13px;font-weight:700;color:#dcecff;text-shadow:0 0 6px rgba(55,132,255,.6)}
    .loading-title{margin-top:4px;font-size:16px;font-weight:800;color:#fff;text-shadow:0 2px 10px rgba(255,255,255,.18)}
    .retry-status{min-height:18px;font-size:12px;font-weight:700;color:rgba(255,255,255,.78);text-shadow:0 1px 8px rgba(0,0,0,.55)}
    .tiny-menu{position:fixed;top:16px;right:17px;z-index:21;color:rgba(255,255,255,.25);font-size:20px;line-height:1;font-weight:700}
  </style>
</head>
<body>
  <video id="video" autoplay controls playsinline webkit-playsinline></video>
  <div id="bootScreen" aria-live="polite">
    <div class="tiny-menu">☰</div>
    <div class="boot-card">
      <img id="channelLogo" class="channel-logo" src="${escapedLogo}" alt="Logo chaîne" referrerpolicy="no-referrer">
      <div class="ring"></div>
      <div class="progress-track"><div id="progressFill" class="progress-fill"></div></div>
      <div id="progressStatus" class="progress-status">Chargement du flux... 0%</div>
      <div class="loading-title">Chargement du flux..</div>
      <div id="retryStatus" class="retry-status"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.15/dist/hls.min.js"></script>
  <script>
    var DEFAULT_URL = "${escaped}";
    var video = document.getElementById("video");
    var channelLogo = document.getElementById("channelLogo");
    var bootScreen = document.getElementById("bootScreen");
    var progressFill = document.getElementById("progressFill");
    var progressStatus = document.getElementById("progressStatus");
    var retryStatus = document.getElementById("retryStatus");
    var hls = null;
    var activePlayId = 0;
    var playPromise = null;
    var progressValue = 0;
    var progressTimer = null;
    var watchdogTimer = null;
    var reloadTimer = null;
    var playStarted = false;
    var lastActivityAt = Date.now();
    var lastPlaybackProgressAt = Date.now();
    var lastVideoTime = 0;
    var lastReloadAt = 0;
    var lastFreezeRecoverAt = 0;
    var waitingStartedAt = 0;
    var reloadCount = 0;
    var hlsErrorCount = 0;
    var lastHlsErrorAt = 0;

    var WATCHDOG_INTERVAL_MS = 2500;
    var STARTUP_NO_FLUX_MS = 26000;
    var FREEZE_RECOVERY_MS = 7500;
    var HARD_FREEZE_MS = 17000;
    var AUTO_RELOAD_COOLDOWN_MS = 12000;
    var MAX_PAGE_RELOADS = 1;

    channelLogo.addEventListener("error", function () { channelLogo.classList.add("logo-error"); });
    video.autoplay = true;
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    function setProgress(value) {
      progressValue = Math.max(progressValue, Math.min(100, Math.round(value)));
      progressFill.style.width = progressValue + "%";
      progressStatus.textContent = "Chargement du flux... " + progressValue + "%";
    }
    function setRetryMessage(message) { retryStatus.textContent = message || ""; }
    function stablePlayerUrl() {
      var u = new URL(window.location.origin + "/");
      u.searchParams.set("action", "stable");
      u.searchParams.set("src", DEFAULT_URL);
      u.searchParams.set("_boot", Date.now().toString());
      return u.toString();
    }
    function noteFluxActivity() {
      lastActivityAt = Date.now();
    }
    function notePlaybackProgress() {
      var now = Date.now();
      lastActivityAt = now;
      lastPlaybackProgressAt = now;
      lastVideoTime = video.currentTime || lastVideoTime;
      waitingStartedAt = 0;
    }
    function recoverFreeze(reason) {
      var now = Date.now();
      if (now - lastFreezeRecoverAt < 7500) return;
      lastFreezeRecoverAt = now;
      setRetryMessage("Micro-coupure détectée, récupération du flux...");
      try { if (hls) hls.startLoad(); } catch (_e) {}
      try { if (hls) hls.recoverMediaError(); } catch (_e) {}
      console.warn("Récupération anti-freeze:", reason);
    }
    function stopWatchdog() {
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
      if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
    }
    function startWatchdog() {
      stopWatchdog();
      var nowStart = Date.now();
      lastActivityAt = nowStart;
      lastPlaybackProgressAt = nowStart;
      lastVideoTime = video.currentTime || 0;
      waitingStartedAt = 0;
      watchdogTimer = setInterval(function () {
        var now = Date.now();
        var ready = video.readyState || 0;
        var currentTime = video.currentTime || 0;
        var timeAdvanced = Math.abs(currentTime - lastVideoTime) > 0.2;

        if (!video.paused && !video.ended && timeAdvanced) {
          notePlaybackProgress();
          return;
        }

        var sinceMove = now - lastPlaybackProgressAt;
        var isWaiting = video.seeking || ready < 3 || waitingStartedAt > 0;
        var noStartupFlux = ready < 2 && sinceMove > STARTUP_NO_FLUX_MS;
        var softFreeze = !video.paused && !video.ended && sinceMove > FREEZE_RECOVERY_MS && isWaiting;
        var hardFreeze = !video.paused && !video.ended && sinceMove > HARD_FREEZE_MS;

        if (softFreeze) recoverFreeze("lecture figée depuis " + Math.round(sinceMove / 1000) + "s");
        if (noStartupFlux || hardFreeze) {
          softRestart(noStartupFlux ? "Aucun flux reçu au démarrage" : "Freeze long détecté", true);
        }
      }, WATCHDOG_INTERVAL_MS);
    }
    function startProgress() {
      stopProgress();
      setProgress(8);
      progressTimer = setInterval(function () {
        if (progressValue < 72) setProgress(progressValue + Math.floor(Math.random() * 6) + 2);
        else if (progressValue < 92) setProgress(progressValue + 1);
      }, 450);
    }
    function stopProgress() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }
    function hideBootScreen() {
      setProgress(100);
      stopProgress();
      setRetryMessage("");
      setTimeout(function () { bootScreen.classList.add("boot-hidden"); }, 180);
    }
    function showBootScreen() {
      bootScreen.classList.remove("boot-hidden");
      progressValue = 0;
      setProgress(0);
      startProgress();
    }
    function forceUnmute() {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      video.removeAttribute("muted");
    }
    function safePlay() {
      forceUnmute();
      var p = video.play();
      if (p && typeof p.catch === "function") p.catch(function () { forceUnmute(); });
    }
    function getHlsHttpStatus(err) {
      if (!err) return 0;
      var r = err.response || {};
      return Number(r.code || r.status || err.code || err.status || 0) || 0;
    }
    function stopPlayback(reason) {
      activePlayId += 1;
      stopWatchdog();
      try {
        if (hls) {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
          hls = null;
        }
      } catch (e) {
        console.warn("Nettoyage HLS incomplet:", reason || "", e);
        hls = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch (e) {
        console.warn("Nettoyage vidéo incomplet:", reason || "", e);
      }
    }
    function isCurrentPlay(playId) { return playId === activePlayId; }
    function hardReloadFrame(reason) {
      if (reloadCount >= MAX_PAGE_RELOADS) return;
      reloadCount += 1;
      setRetryMessage("Récupération forte du flux...");
      try { stopPlayback("hard-reload"); } catch (_e) {}
      setTimeout(function () {
        var u = new URL(window.location.href);
        u.searchParams.set("_hardReload", Date.now().toString());
        u.searchParams.set("_reason", String(reason || "flux").slice(0, 80));
        window.location.replace(u.toString());
      }, 700);
    }
    function softRestart(reason, silent) {
      var now = Date.now();
      if (now - lastReloadAt < AUTO_RELOAD_COOLDOWN_MS) return;
      lastReloadAt = now;
      console.warn("Redémarrage stable:", reason);
      play(reason || "restart", { force: true, silent: !!silent });
    }
    async function play(reason, options) {
      options = options || {};
      var force = !!options.force;
      var silent = !!options.silent;
      if (playPromise && !force) return playPromise;
      activePlayId += 1;
      var playId = activePlayId;
      var hadPlayback = video.readyState >= 2 && !video.paused && !video.ended;
      playPromise = (async function () {
        stopWatchdog();
        if (silent && hadPlayback) {
          stopProgress();
          setRetryMessage("Récupération discrète du flux...");
        } else {
          showBootScreen();
          if (reason) setRetryMessage("Connexion au flux stable...");
        }
        noteFluxActivity();
        try {
          try {
            if (hls) { hls.stopLoad(); hls.detachMedia(); hls.destroy(); hls = null; }
          } catch (_e) { hls = null; }
          video.pause();
          video.removeAttribute("src");
          video.load();
          forceUnmute();
          setProgress(38);
          var sourceUrl = stablePlayerUrl();
          if (window.Hls && Hls.isSupported()) {
            var thisHls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 30,
              maxBufferLength: 95,
              maxMaxBufferLength: 180,
              liveSyncDurationCount: 5,
              liveMaxLatencyDurationCount: 14,
              manifestLoadingTimeOut: 18000,
              levelLoadingTimeOut: 18000,
              fragLoadingTimeOut: 24000,
              manifestLoadingMaxRetry: 8,
              levelLoadingMaxRetry: 14,
              fragLoadingMaxRetry: 10,
              manifestLoadingRetryDelay: 800,
              levelLoadingRetryDelay: 800,
              fragLoadingRetryDelay: 900,
              manifestLoadingMaxRetryTimeout: 9000,
              levelLoadingMaxRetryTimeout: 9000,
              fragLoadingMaxRetryTimeout: 9000
            });
            hls = thisHls;
            thisHls.on(Hls.Events.ERROR, function (_event, err) {
              if (!err || !isCurrentPlay(playId) || hls !== thisHls) return;
              var status = getHlsHttpStatus(err);
              console.warn("Erreur HLS stable:", err.type, err.details, "status=", status, "fatal=", err.fatal);
              var now = Date.now();
              if (now - lastHlsErrorAt > 45000) hlsErrorCount = 0;
              lastHlsErrorAt = now;
              hlsErrorCount += 1;

              if (err.fatal && err.type === Hls.ErrorTypes.MEDIA_ERROR) {
                setRetryMessage("Correction automatique du buffer vidéo...");
                try { thisHls.recoverMediaError(); noteFluxActivity(); return; } catch (_e) {}
              }

              if (err.type === Hls.ErrorTypes.NETWORK_ERROR) {
                setRetryMessage("Passerelle HLS stable en récupération...");
                try { thisHls.startLoad(); noteFluxActivity(); } catch (_e) {}
                if (status === 401 || status === 403 || status === 410 || hlsErrorCount >= 12 || err.fatal) {
                  softRestart("Erreur réseau HLS stable " + (status || err.details || ""), true);
                }
                return;
              }

              if (err.fatal) softRestart("Erreur HLS fatale " + (err.details || err.type || ""), true);
            });
            thisHls.on(Hls.Events.MANIFEST_PARSED, function () {
              if (!isCurrentPlay(playId) || hls !== thisHls) return;
              setProgress(82);
              noteFluxActivity();
              safePlay();
            });
            thisHls.on(Hls.Events.LEVEL_LOADED, function () {
              if (!isCurrentPlay(playId) || hls !== thisHls) return;
              hlsErrorCount = 0;
              noteFluxActivity();
            });
            thisHls.on(Hls.Events.FRAG_LOADED, function () {
              if (!isCurrentPlay(playId) || hls !== thisHls) return;
              noteFluxActivity();
            });
            thisHls.on(Hls.Events.FRAG_BUFFERED, function () {
              if (!isCurrentPlay(playId) || hls !== thisHls) return;
              setProgress(96);
              noteFluxActivity();
            });
            thisHls.loadSource(sourceUrl);
            thisHls.attachMedia(video);
            startWatchdog();
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = sourceUrl;
            setProgress(82);
            safePlay();
            startWatchdog();
          } else {
            throw new Error("HLS non supporté et hls.js indisponible.");
          }
        } catch (e) {
          if (!isCurrentPlay(playId)) return;
          stopProgress();
          progressStatus.textContent = "Erreur de chargement du flux";
          setRetryMessage("Nouvelle tentative automatique...");
          console.error(e);
          softRestart("Erreur de chargement: " + e.message, false);
        } finally {
          if (isCurrentPlay(playId)) playPromise = null;
        }
      })();
      return playPromise;
    }
    video.addEventListener("playing", function () { notePlaybackProgress(); reloadCount = 0; hlsErrorCount = 0; hideBootScreen(); });
    video.addEventListener("canplay", function () { noteFluxActivity(); if (!video.paused) hideBootScreen(); });
    video.addEventListener("loadeddata", noteFluxActivity);
    video.addEventListener("progress", noteFluxActivity);
    video.addEventListener("timeupdate", notePlaybackProgress);
    video.addEventListener("waiting", function () {
      if (!waitingStartedAt) waitingStartedAt = Date.now();
      setRetryMessage("Flux en attente...");
      recoverFreeze("événement waiting");
    });
    video.addEventListener("stalled", function () {
      if (!waitingStartedAt) waitingStartedAt = Date.now();
      setRetryMessage("Flux momentanément ralenti...");
      recoverFreeze("événement stalled");
    });
    video.addEventListener("error", function () { setRetryMessage("Erreur vidéo détectée, récupération en cours..."); softRestart("Erreur vidéo", true); });
    function bootPlayer() { if (playStarted) return; playStarted = true; play(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPlayer, { once: true }); else bootPlayer();
    window.addEventListener("load", bootPlayer, { once: true });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && video.paused) safePlay(); });
  </script>
</body>
</html>`;
}

export default {
  async fetch(request) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(new Headers()) });
      }

      const reqUrl = new URL(request.url);
    const action = reqUrl.searchParams.get("action") || "player";
    const target = reqUrl.searchParams.get("url") || "";
    const src = reqUrl.searchParams.get("src") || DEFAULT_STREAM_URL;
    const u = reqUrl.searchParams.get("u") || "";
    const logo = reqUrl.searchParams.get("logo") || DEFAULT_LOGO_URL;

    if (reqUrl.pathname === "/api/daddy/proxy") return stableManifest(request, target || src, target || src);

    if (action === "resolve") return resolveTarget(request, target);
    if (action === "proxy") return proxy(request, target, false);
    if (action === "asset") return proxy(request, target, false, 6);
    if (action === "stable") return stableManifest(request, src, u);
    if (action === "health") return json({ ok: true, version: "v14-adaptive-headers-stable-hls-gateway", cachePlaylists: playlistMemoryCache.size, streamStates: streamStateCache.size, directM3u8Prefer: DIRECT_M3U8_PREFER, inlineSingleVariant: INLINE_SINGLE_VARIANT });

      return new Response(page(target || DEFAULT_STREAM_URL, logo), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-content-type-options": "nosniff",
          "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "pragma": "no-cache",
          "expires": "0"
        }
      });
    } catch (e) {
      return new Response("Worker v14 error: " + (e && e.message ? e.message : String(e)), {
        status: 500,
        headers: corsHeaders(new Headers({
          "content-type": "text/plain; charset=utf-8",
          "x-worker-error": "v14-caught"
        }))
      });
    }
  }
};




