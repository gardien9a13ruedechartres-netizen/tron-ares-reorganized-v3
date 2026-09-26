const STATE_KEY = "current";
const MAX_RESPONSE_BYTES = 100_000;
const MAX_PENDING_ALERTS = 20;

export const TARGETS = Object.freeze([
  {
    id: "amazingtier-cmtvpt",
    label: "AmazingTier / cmtvpt",
    endpoint: "https://cmtv-chrome-publish.vercel.app/api/stream?channel=cmtvpt",
    expectedHost: "simple.amazingtier.top",
    channel: "cmtvpt",
  },
  {
    id: "wideiptv-btv1",
    label: "WideIPTV / btv1",
    endpoint: "https://cmtv-chrome-publish.vercel.app/api/wideiptv?channel=btv1",
    expectedHost: "ds164.bluetier.top",
    channel: "btv1",
  },
]);

function normalizeHost(host) {
  return String(host || "").toLowerCase().replace(/\.$/, "");
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store, no-cache, must-revalidate" },
  });
}

function newState(now) {
  return {
    version: 1,
    hosts: Object.fromEntries(TARGETS.map((target) => [target.id, target.expectedHost])),
    lastCheckedAt: null,
    lastErrors: {},
    pendingAlerts: [],
    lastNotificationAt: null,
    createdAt: now,
  };
}

async function readState(env, now) {
  if (!env.MONITOR_STATE) throw new Error("MONITOR_STATE binding is missing.");
  const state = await env.MONITOR_STATE.get(STATE_KEY, "json");
  if (!state || state.version !== 1 || !state.hosts) return newState(now);
  for (const target of TARGETS) {
    if (!state.hosts[target.id]) state.hosts[target.id] = target.expectedHost;
  }
  if (!Array.isArray(state.pendingAlerts)) state.pendingAlerts = [];
  if (!state.lastErrors || typeof state.lastErrors !== "object") state.lastErrors = {};
  return state;
}

function safeStreamHost(rawUrl, channel) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("API JSON does not contain a valid stream URL.");
  }
  const expectedPath = "/" + channel + "/index.m3u8";
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname.toLowerCase() !== expectedPath ||
    !parsed.searchParams.has("token")
  ) {
    throw new Error("API returned an unexpected stream URL shape.");
  }
  return normalizeHost(parsed.hostname);
}

export async function inspectTarget(target, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(target.endpoint, {
      method: "GET",
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("API request failed.");
  }
  if (!response.ok) throw new Error("API returned HTTP " + response.status + ".");
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("API response exceeded the size limit.");
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("API returned invalid JSON.");
  }
  if (payload?.ok !== true || typeof payload.url !== "string") {
    throw new Error("API did not return a validated stream URL.");
  }
  return {
    host: safeStreamHost(payload.url, target.channel),
    checkedAt: typeof payload.checkedAt === "string" ? payload.checkedAt : null,
  };
}

function addPending(state, alert) {
  const key = [alert.type, alert.targetId, alert.previousHost || "", alert.currentHost || "", alert.error || ""].join("|");
  if (!state.pendingAlerts.some((item) => item.key === key)) {
    state.pendingAlerts.push({ ...alert, key });
  }
  if (state.pendingAlerts.length > MAX_PENDING_ALERTS) {
    state.pendingAlerts = state.pendingAlerts.slice(-MAX_PENDING_ALERTS);
  }
}

async function deliverPending(state, env, fetcher, now) {
  if (!state.pendingAlerts.length || !env.ALERT_WEBHOOK_URL) return;
  let response;
  try {
    response = await fetcher(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "stream_server_monitor",
        detectedAt: now,
        changes: state.pendingAlerts.map(({ key, ...alert }) => alert),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error(JSON.stringify({ event: "alert_delivery_failed", reason: "webhook request failed" }));
    return;
  }
  if (!response.ok) {
    console.error(JSON.stringify({ event: "alert_delivery_failed", status: response.status }));
    return;
  }
  state.pendingAlerts = [];
  state.lastNotificationAt = now;
}

export async function runCheck(env, fetcher = fetch, clock = () => new Date()) {
  const now = clock().toISOString();
  const state = await readState(env, now);
  const changes = [];
  const failures = [];

  const results = await Promise.all(TARGETS.map(async (target) => {
    try {
      return { target, result: await inspectTarget(target, fetcher) };
    } catch (error) {
      return { target, error: error instanceof Error ? error.message : "Unknown check error." };
    }
  }));

  for (const item of results) {
    const target = item.target;
    if (item.error) {
      failures.push({ targetId: target.id, error: item.error });
      if (state.lastErrors[target.id] !== item.error) {
        addPending(state, {
          type: "source_check_failed",
          targetId: target.id,
          label: target.label,
          error: item.error,
          detectedAt: now,
        });
      }
      state.lastErrors[target.id] = item.error;
      continue;
    }

    delete state.lastErrors[target.id];
    const previousHost = normalizeHost(state.hosts[target.id]);
    const currentHost = item.result.host;
    if (previousHost !== currentHost) {
      const change = {
        type: "server_host_changed",
        targetId: target.id,
        label: target.label,
        previousHost,
        currentHost,
        detectedAt: now,
      };
      changes.push(change);
      addPending(state, change);
      state.hosts[target.id] = currentHost;
    }
  }

  state.lastCheckedAt = now;
  await deliverPending(state, env, fetcher, now);
  await env.MONITOR_STATE.put(STATE_KEY, JSON.stringify(state));
  console.log(JSON.stringify({
    event: "server_monitor_check",
    checkedAt: now,
    changes: changes.map(({ targetId, previousHost, currentHost }) => ({ targetId, previousHost, currentHost })),
    failures,
    pendingAlerts: state.pendingAlerts.length,
  }));
  return { state, changes, failures };
}

export default {
  async scheduled(_controller, env, _ctx) {
    await runCheck(env);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return json({ ok: false, error: "Method not allowed." }, 405);
    if (url.pathname === "/healthz") {
      return json({ ok: true, service: "cmtv-server-change-monitor" });
    }
    if (url.pathname === "/status") {
      if (!env.MONITOR_STATE) return json({ ok: false, error: "State storage is not configured." }, 503);
      const state = await readState(env, new Date().toISOString());
      return json({
        ok: true,
        lastCheckedAt: state.lastCheckedAt,
        hosts: state.hosts,
        lastErrors: state.lastErrors,
        pendingAlerts: state.pendingAlerts.map(({ key, ...alert }) => alert),
        lastNotificationAt: state.lastNotificationAt,
      });
    }
    return json({ ok: false, error: "Not found." }, 404);
  },
};

