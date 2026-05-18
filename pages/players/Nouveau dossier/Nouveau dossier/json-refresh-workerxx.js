export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") || "CM TV";
    const countriesParam = url.searchParams.get("countries") || "pt";
    const countries = countriesParam.endsWith(".json")
      ? countriesParam
      : countriesParam + ".json";

    const targetUrl =
      "https://livewatch.top/api/tvvoo/stream?channel=" +
      encodeURIComponent(channel) +
      "&countries=" +
      encodeURIComponent(countries);

    try {
      const upstream = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
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
      return new Response(
        JSON.stringify({
          error: true,
          message: error.message
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          }
        }
      );
    }
  }
};
