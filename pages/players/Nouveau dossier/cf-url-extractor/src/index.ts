import puppeteer from "@cloudflare/puppeteer";

interface Env {
  MYBROWSER: Fetcher;
  MAX_WAIT_MS?: string;
  DEFAULT_CONTAINS?: string;
  ALLOW_HOSTS?: string;
}

type FoundSource = "console" | "request" | "response" | "page";

type FoundUrl = {
  source: FoundSource;
  url: string;
  text?: string;
  status?: number;
};

type ExtractResult = {
  ok: boolean;
  inputUrl: string;
  contains: string;
  found: FoundUrl[];
  firstMatch: FoundUrl | null;
  pageTitle?: string;
  finalUrl?: string;
  error?: string;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

function getAllowedHosts(env: Env): string[] {
  return (env.ALLOW_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function validateTarget(rawUrl: string | null, env: Env): string | null {
  if (!rawUrl) return "Paramètre manquant : ajoute ?url=https://exemple.com";

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "URL invalide. Utilise une URL complète commençant par http:// ou https://";
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "Protocole refusé. Seuls http:// et https:// sont acceptés.";
  }

  const allowedHosts = getAllowedHosts(env);
  if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    return `Domaine refusé par ALLOW_HOSTS : ${parsed.hostname}`;
  }

  return null;
}

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>`)]+/gi);
  return matches ? [...new Set(matches)] : [];
}

function addMatch(found: FoundUrl[], item: FoundUrl, contains: string) {
  const haystack = `${item.url} ${item.text || ""}`;
  if (!haystack.includes(contains)) return;
  if (found.some((existing) => existing.source === item.source && existing.url === item.url)) return;
  found.push(item);
}

async function parseRequest(request: Request, env: Env) {
  const current = new URL(request.url);

  if (request.method === "GET") {
    return {
      targetUrl: current.searchParams.get("url"),
      contains: current.searchParams.get("contains") || env.DEFAULT_CONTAINS || "https://",
      waitMs: Number(current.searchParams.get("waitMs") || env.MAX_WAIT_MS || "12000")
    };
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as null | {
      url?: string;
      contains?: string;
      waitMs?: number;
    };

    return {
      targetUrl: body?.url || null,
      contains: body?.contains || env.DEFAULT_CONTAINS || "https://",
      waitMs: Number(body?.waitMs || env.MAX_WAIT_MS || "12000")
    };
  }

  return {
    targetUrl: null,
    contains: env.DEFAULT_CONTAINS || "https://",
    waitMs: Number(env.MAX_WAIT_MS || "12000")
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const route = new URL(request.url).pathname;

    if (route === "/" || route === "/health") {
      return json({
        ok: true,
        service: "cf-url-extractor",
        usage: {
          get: "/extract?url=https://example.com&contains=token",
          post: "POST /extract avec JSON { url, contains, waitMs }"
        }
      });
    }

    if (route !== "/extract") {
      return json({ ok: false, error: "Route inconnue. Utilise /extract" }, 404);
    }

    if (!["GET", "POST"].includes(request.method)) {
      return json({ ok: false, error: "Méthode non autorisée. Utilise GET ou POST." }, 405);
    }

    const { targetUrl, contains, waitMs } = await parseRequest(request, env);
    const validationError = validateTarget(targetUrl, env);
    if (validationError) return json({ ok: false, error: validationError }, 400);

    const safeWaitMs = Math.max(1000, Math.min(waitMs, 30000));
    const found: FoundUrl[] = [];
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

    try {
      browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(safeWaitMs + 10000);

      page.on("console", (message) => {
        const text = message.text();
        for (const url of extractUrlsFromText(text)) {
          addMatch(found, { source: "console", url, text }, contains);
        }
      });

      page.on("request", (req) => {
        addMatch(found, { source: "request", url: req.url() }, contains);
      });

      page.on("response", (res) => {
        addMatch(found, { source: "response", url: res.url(), status: res.status() }, contains);
      });

      await page.goto(targetUrl as string, {
        waitUntil: "networkidle2",
        timeout: safeWaitMs + 10000
      });

      await new Promise((resolve) => setTimeout(resolve, safeWaitMs));

      const pageUrls = await page.evaluate(() => {
        const values = new Set<string>();
        const attributes = ["href", "src", "action", "data-url"];

        for (const element of Array.from(document.querySelectorAll("*"))) {
          for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) {
              try {
                values.add(new URL(value, location.href).href);
              } catch {
                // Ignore invalid URLs
              }
            }
          }
        }

        return Array.from(values);
      });

      for (const url of pageUrls) {
        addMatch(found, { source: "page", url }, contains);
      }

      const result: ExtractResult = {
        ok: true,
        inputUrl: targetUrl as string,
        contains,
        found,
        firstMatch: found[0] || null,
        pageTitle: await page.title().catch(() => undefined),
        finalUrl: page.url()
      };

      return json(result);
    } catch (error) {
      return json({
        ok: false,
        inputUrl: targetUrl,
        contains,
        found,
        firstMatch: found[0] || null,
        error: error instanceof Error ? error.message : String(error)
      }, 500);
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
  }
};
