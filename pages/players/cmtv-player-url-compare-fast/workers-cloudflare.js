const UPSTREAM_ORIGIN = "https://livewatch.top";

const WORKER_ORIGINS = [
  "https://multi-chaines1.victor-salema-53d.workers.dev",
  "https://multi-chaines2.victor-salema-53d.workers.dev",
  "https://multi-chaines3.victor-salema-53d.workers.dev",
  "https://multi-chaines4.victor-salema-53d.workers.dev"
];

const CACHE_JSON = "no-store";
const CACHE_PLAYLIST = "no-store";
const CACHE_SEGMENT = "public, max-age=12, s-maxage=12";
const CACHE_KEY = "public, max-age=300, s-maxage=300";
const CACHE_OTHER = "public, max-age=10, s-maxage=10";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    try {
      if (url.pathname === "/hls") {
        return await handleHlsProxy(request, url);
      }

      return await handleJsonProxy(request, url);
    } catch (error) {
      return textResponse("Worker error: " + error.message, 502);
    }
  }
};

async function handleJsonProxy(request, url) {
  const channel = url.searchParams.get("channel");
  const countries = url.searchParams.get("countries");

  if (!channel || !countries) {
    return textResponse("Missing parameters", 400);
  }

  const targetUrl =
    UPSTREAM_ORIGIN +
    "/api/tvvoo/stream?channel=" +
    encodeURIComponent(channel) +
    "&countries=" +
    encodeURIComponent(countries);

  const upstream = await fetch(targetUrl, {
    method: "GET",
    headers: buildHeaders(request),
    cf: {
      cacheEverything: false,
      cacheTtl: 0
    }
  });

  const text = await upstream.text();
  let body = text;

  try {
    const json = JSON.parse(text);
    body = JSON.stringify(rewriteJsonUrls(json, targetUrl, url.origin), null, 2);
  } catch (error) {
    body = text;
  }

  return new Response(body, {
    status: upstream.status,
    headers: corsHeaders("application/json; charset=utf-8", CACHE_JSON)
  });
}

async function handleHlsProxy(request, url) {
  const target = url.searchParams.get("url");

  if (!target) {
    return textResponse("Missing HLS url", 400);
  }

  const fixedTarget = normalizeToLivewatchProxy(target, UPSTREAM_ORIGIN + "/");
  let targetUrl;

  try {
    targetUrl = new URL(fixedTarget);
  } catch (error) {
    return textResponse("Invalid HLS url", 400);
  }

  if (targetUrl.hostname !== "livewatch.top") {
    return textResponse("Forbidden host", 403);
  }

  const contentKind = detectContentKind(targetUrl.pathname, targetUrl.search);
  const upstream = await fetch(targetUrl.toString(), {
    method: "GET",
    headers: buildHeaders(request),
    cf: {
      cacheEverything: contentKind === "segment" || contentKind === "key",
      cacheTtl: contentKind === "segment" ? 12 : contentKind === "key" ? 300 : 0,
      tieredCache: contentKind === "segment" || contentKind === "key"
    }
  });

  const contentType = upstream.headers.get("Content-Type") || guessContentType(targetUrl.pathname, targetUrl.search);

  if (contentKind === "playlist" || contentType.toLowerCase().includes("mpegurl")) {
    const playlist = await upstream.text();

    return new Response(rewriteM3u8Playlist(playlist, targetUrl.toString(), url.origin), {
      status: upstream.status,
      headers: corsHeaders("application/vnd.apple.mpegurl; charset=utf-8", CACHE_PLAYLIST)
    });
  }

  const responseHeaders = corsHeaders(contentType, getCacheControlForKind(contentKind));
  copyHeader(upstream.headers, responseHeaders, "Content-Length");
  copyHeader(upstream.headers, responseHeaders, "Content-Range");
  copyHeader(upstream.headers, responseHeaders, "Accept-Ranges");
  copyHeader(upstream.headers, responseHeaders, "ETag");
  copyHeader(upstream.headers, responseHeaders, "Last-Modified");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
}

function rewriteJsonUrls(value, baseUrl, workerOrigin) {
  if (typeof value === "string") {
    if (value.includes(".m3u8")) {
      const normalized = normalizeToLivewatchProxy(value, baseUrl);
      return proxifyWorkerUrl(normalized, baseUrl, workerOrigin, "playlist");
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(function (item) {
      return rewriteJsonUrls(item, baseUrl, workerOrigin);
    });
  }

  if (value && typeof value === "object") {
    const output = {};

    Object.keys(value).forEach(function (key) {
      output[key] = rewriteJsonUrls(value[key], baseUrl, workerOrigin);
    });

    return output;
  }

  return value;
}

function rewriteM3u8Playlist(content, playlistUrl, workerOrigin) {
  const originalPlaylist = extractDeepestUrl(playlistUrl);

  return content
    .split("\n")
    .map(function (line) {
      const trimmed = line.trim();

      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, function (_, uri) {
          const fixedUri = buildResourceProxyUrl(uri, originalPlaylist);
          return 'URI="' + proxifyWorkerUrl(fixedUri, playlistUrl, workerOrigin, "key") + '"';
        });
      }

      const fixedUrl = buildResourceProxyUrl(trimmed, originalPlaylist);
      const kind = detectContentKindFromUrl(fixedUrl);

      return proxifyWorkerUrl(fixedUrl, playlistUrl, workerOrigin, kind);
    })
    .join("\n");
}

function buildResourceProxyUrl(resourceUrl, originalPlaylistUrl) {
  const cleanResource = extractDeepestUrl(resourceUrl);
  let absoluteResourceUrl;

  if (cleanResource.startsWith("http://") || cleanResource.startsWith("https://")) {
    absoluteResourceUrl = cleanResource;
  } else if (cleanResource.startsWith("//")) {
    absoluteResourceUrl = "https:" + cleanResource;
  } else {
    absoluteResourceUrl = new URL(cleanResource, originalPlaylistUrl).toString();
  }

  return normalizeToLivewatchProxy(absoluteResourceUrl, originalPlaylistUrl);
}

function normalizeToLivewatchProxy(value, baseUrl) {
  const deepest = extractDeepestUrl(value);
  let absoluteUrl;

  if (deepest.startsWith("//")) {
    absoluteUrl = "https:" + deepest;
  } else if (deepest.startsWith("http://") || deepest.startsWith("https://")) {
    absoluteUrl = deepest;
  } else {
    absoluteUrl = new URL(deepest, baseUrl || UPSTREAM_ORIGIN + "/").toString();
  }

  const parsed = new URL(absoluteUrl);

  if (parsed.hostname === "livewatch.top") {
    return parsed.toString();
  }

  return UPSTREAM_ORIGIN + "/api/proxy?url=" + encodeURIComponent(parsed.toString());
}

function extractDeepestUrl(value) {
  let current = String(value || "").trim();

  for (let index = 0; index < 10; index += 1) {
    try {
      const parsed = new URL(current);
      const nested = parsed.searchParams.get("url");

      if (nested) {
        current = nested;
        continue;
      }

      return current;
    } catch (error) {
      return current;
    }
  }

  return current;
}

function proxifyWorkerUrl(resourceUrl, baseUrl, workerOrigin, kind) {
  const absoluteUrl = new URL(resourceUrl, baseUrl).toString();
  const selectedWorkerOrigin = selectWorkerOrigin(absoluteUrl, workerOrigin, kind);

  return selectedWorkerOrigin + "/hls?url=" + encodeURIComponent(absoluteUrl);
}

function selectWorkerOrigin(resourceUrl, fallbackOrigin, kind) {
  const origins = WORKER_ORIGINS.length ? WORKER_ORIGINS : [fallbackOrigin];

  if (kind === "playlist" || kind === "key") {
    return fallbackOrigin || origins[0];
  }

  const index = hashString(resourceUrl) % origins.length;
  return origins[index] || fallbackOrigin;
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildHeaders(request) {
  const headers = new Headers();

  headers.set("Accept", "*/*");
  headers.set("Referer", UPSTREAM_ORIGIN + "/");
  headers.set("Origin", UPSTREAM_ORIGIN);
  headers.set("User-Agent", "Mozilla/5.0");

  if (request) {
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);
  }

  return headers;
}

function detectContentKind(pathname, search) {
  const full = (pathname + "?" + search).toLowerCase();

  if (full.includes(".m3u8")) return "playlist";
  if (full.includes(".key")) return "key";

  if (
    full.includes(".ts") ||
    full.includes(".m4s") ||
    full.includes(".mp4") ||
    full.includes(".aac") ||
    full.includes(".vtt")
  ) {
    return "segment";
  }

  return "other";
}

function detectContentKindFromUrl(value) {
  try {
    const parsed = new URL(value);
    return detectContentKind(parsed.pathname, parsed.search);
  } catch (error) {
    return "other";
  }
}

function getCacheControlForKind(kind) {
  if (kind === "playlist") return CACHE_PLAYLIST;
  if (kind === "segment") return CACHE_SEGMENT;
  if (kind === "key") return CACHE_KEY;
  return CACHE_OTHER;
}

function guessContentType(pathname, search) {
  const path = (pathname + "?" + search).toLowerCase();

  if (path.includes(".m3u8")) return "application/vnd.apple.mpegurl";
  if (path.includes(".ts")) return "video/mp2t";
  if (path.includes(".m4s")) return "video/iso.segment";
  if (path.includes(".mp4")) return "video/mp4";
  if (path.includes(".aac")) return "audio/aac";
  if (path.includes(".key")) return "application/octet-stream";
  if (path.includes(".vtt")) return "text/vtt";

  return "application/octet-stream";
}

function copyHeader(fromHeaders, toHeaders, name) {
  const value = fromHeaders.get(name);
  if (value) toHeaders.set(name, value);
}

function corsHeaders(contentType, cacheControl) {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified",
    "Content-Type": contentType || "application/octet-stream",
    "Cache-Control": cacheControl || "no-store"
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders("text/plain", "no-store")
  });
}

function textResponse(message, status) {
  return new Response(message, {
    status: status,
    headers: corsHeaders("text/plain; charset=utf-8", "no-store")
  });
}
