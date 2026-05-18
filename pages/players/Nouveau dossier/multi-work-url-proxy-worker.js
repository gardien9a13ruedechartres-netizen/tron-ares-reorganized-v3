const STREAM_SERVERS = [
  "https://qmaalhy7acgxwhm.ngolpdkyoctjcddxshli469r.org",
  "https://shouurvki7jtfax.ngolpdkyoctjcddxshli469r.org"
];

export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, X-Stream-Server"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/") {
      return handleJson(url, corsHeaders);
    }

    if (url.pathname === "/hls") {
      return handleHls(request, url, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};

async function handleJson(url, corsHeaders) {
  const channel = url.searchParams.get("channel") || "CM TV";
  const countries = url.searchParams.get("countries") || "pt";
  const cleanCountries = countries.endsWith(".json") ? countries : countries + ".json";

  const targetUrl =
    "https://livewatch.top/api/tvvoo/stream?channel=" +
    encodeURIComponent(channel) +
    "&countries=" +
    encodeURIComponent(cleanCountries);

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 5,
          "404": 5,
          "500-599": 0
        }
      }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, max-age=5, s-maxage=5"
      }
    });
  } catch (error) {
    return jsonError(error.message, 500, corsHeaders);
  }
}

async function handleHls(request, url, corsHeaders) {
  const originalUrlParam = url.searchParams.get("url");
  const pathParam = url.searchParams.get("path");
  const forcedServer = Number(url.searchParams.get("server") || "0");

  if (originalUrlParam) {
    return proxyFullUrl(request, originalUrlParam, corsHeaders);
  }

  if (pathParam) {
    return proxyPathWithServerFallback(request, pathParam, forcedServer, corsHeaders);
  }

  return new Response("Missing url or path", { status: 400, headers: corsHeaders });
}

async function proxyFullUrl(request, originalUrl, corsHeaders) {
  let targetUrl;

  try {
    targetUrl = new URL(originalUrl);
  } catch (error) {
    return new Response("Invalid url", { status: 400, headers: corsHeaders });
  }

  if (!targetUrl.pathname.startsWith("/sunshine/")) {
    return new Response("Forbidden url", { status: 403, headers: corsHeaders });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "*/*",
        "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0"
      },
      cf: {
        cacheEverything: !isM3u8(targetUrl.pathname),
        cacheTtl: isM3u8(targetUrl.pathname) ? 0 : 30
      }
    });

    const contentType = upstream.headers.get("Content-Type") || guessContentType(targetUrl.pathname);

    if (isM3u8(targetUrl.pathname) || contentType.includes("mpegurl")) {
      const text = await upstream.text();

      if (!text.trim().startsWith("#EXTM3U")) {
        return new Response("Invalid playlist from upstream\n" + text.slice(0, 500), {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain",
            "Cache-Control": "no-store"
          }
        });
      }

      const rewritten = rewriteM3u8PlaylistByUrl(text, targetUrl.toString());

      return new Response(rewritten, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "X-Stream-Server": targetUrl.hostname
        }
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": isSegment(targetUrl.pathname) ? "public, max-age=30, s-maxage=30" : "no-store",
        "X-Stream-Server": targetUrl.hostname
      }
    });
  } catch (error) {
    return new Response("HLS URL ERROR: " + error.message, {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Cache-Control": "no-store"
      }
    });
  }
}

async function proxyPathWithServerFallback(request, path, forcedServer, corsHeaders) {
  if (!path || !path.startsWith("/sunshine/")) {
    return new Response("Missing or invalid path", { status: 400, headers: corsHeaders });
  }

  const servers = getServerOrder(forcedServer);
  let lastStatus = 0;
  let lastBody = "";

  for (const serverInfo of servers) {
    const targetUrl = serverInfo.origin + path;

    const response = await proxyFullUrl(request, targetUrl, corsHeaders);

    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set("X-Stream-Server", String(serverInfo.index));
      return new Response(response.body, { status: response.status, headers });
    }

    lastStatus = response.status;
    lastBody = await safeReadText(response);
  }

  return new Response("All stream servers failed. Last status: " + lastStatus + "\n" + lastBody, {
    status: 502,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain",
      "Cache-Control": "no-store"
    }
  });
}

function rewriteM3u8PlaylistByUrl(content, playlistUrl) {
  return content
    .split("\n")
    .map(function (line) {
      const trimmed = line.trim();

      if (!trimmed) return line;

      if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
        return line.replace(/URI="([^"]+)"/g, function (_, uri) {
          return 'URI="' + proxifyAbsoluteUrl(uri, playlistUrl) + '"';
        });
      }

      if (trimmed.startsWith("#")) {
        return line;
      }

      return proxifyAbsoluteUrl(trimmed, playlistUrl);
    })
    .join("\n");
}

function proxifyAbsoluteUrl(resource, baseUrl) {
  let absoluteUrl;

  try {
    absoluteUrl = new URL(resource, baseUrl).toString();
  } catch (error) {
    return resource;
  }

  return "/hls?url=" + encodeURIComponent(absoluteUrl);
}

function getServerOrder(forcedServer) {
  const list = STREAM_SERVERS.map(function (origin, index) {
    return { origin: origin, index: index + 1 };
  });

  if (!forcedServer) return list;

  const selected = list.find(function (item) {
    return item.index === forcedServer;
  });

  if (!selected) return list;

  return [
    selected,
    ...list.filter(function (item) {
      return item.index !== forcedServer;
    })
  ];
}

function isM3u8(path) {
  return path.toLowerCase().includes(".m3u8");
}

function isSegment(path) {
  const lower = path.toLowerCase();
  return lower.includes(".ts") || lower.includes(".m4s") || lower.includes(".aac") || lower.includes(".mp4");
}

function guessContentType(path) {
  const lower = path.toLowerCase();

  if (lower.includes(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.includes(".ts")) return "video/mp2t";
  if (lower.includes(".m4s")) return "video/iso.segment";
  if (lower.includes(".mp4")) return "video/mp4";
  if (lower.includes(".aac")) return "audio/aac";
  if (lower.includes(".key")) return "application/octet-stream";

  return "application/octet-stream";
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (error) {
    return "";
  }
}

function jsonError(message, status, corsHeaders) {
  return new Response(
    JSON.stringify({ error: true, message: message }),
    {
      status: status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}
