import test from "node:test";
import assert from "node:assert/strict";
import worker, { TARGETS, inspectTarget, runCheck } from "./worker.mjs";

class MemoryKV {
  value = null;
  async get(_key, type) {
    if (this.value === null) return null;
    return type === "json" ? JSON.parse(this.value) : this.value;
  }
  async put(_key, value) {
    this.value = value;
  }
}

function streamUrl(host, channel) {
  return "https://" + host + "/" + channel.toUpperCase() + "/index.m3u8?token=SECRET_TOKEN";
}

test("inspectTarget returns only the stream host and never the token", async () => {
  const response = Response.json({
    ok: true,
    url: streamUrl("edge.amazingtier.top", "cmtvpt"),
    checkedAt: "2026-09-24T10:00:00.000Z",
  });
  const result = await inspectTarget(TARGETS[0], async () => response);
  assert.deepEqual(result, { host: "edge.amazingtier.top", checkedAt: "2026-09-24T10:00:00.000Z" });
  assert.equal(JSON.stringify(result).includes("SECRET_TOKEN"), false);
});

test("monitor records a changed host and delivers only redacted domain data", async () => {
  const kv = new MemoryKV();
  let webhookPayload;
  const env = { MONITOR_STATE: kv, ALERT_WEBHOOK_URL: "https://alerts.example.test/hook" };
  const fetcher = async (input, options = {}) => {
    if (String(input) === env.ALERT_WEBHOOK_URL) {
      webhookPayload = JSON.parse(options.body);
      return Response.json({ ok: true });
    }
    const target = TARGETS.find((item) => item.endpoint === String(input));
    const host = target.id === TARGETS[0].id ? "edge.amazingtier.top" : "ds164.bluetier.top";
    return Response.json({ ok: true, url: streamUrl(host, target.channel) });
  };
  const result = await runCheck(env, fetcher, () => new Date("2026-09-24T10:05:00.000Z"));

  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].previousHost, "simple.amazingtier.top");
  assert.equal(result.changes[0].currentHost, "edge.amazingtier.top");
  assert.equal(result.state.pendingAlerts.length, 0);
  assert.equal(JSON.stringify(webhookPayload).includes("SECRET_TOKEN"), false);
  assert.equal(kv.value.includes("SECRET_TOKEN"), false);
});

test("monitor does not repeat an already observed host change", async () => {
  const kv = new MemoryKV();
  const fetcher = async (input) => {
    const target = TARGETS.find((item) => item.endpoint === String(input));
    const host = target.id === TARGETS[0].id ? "edge.amazingtier.top" : "ds164.bluetier.top";
    return Response.json({ ok: true, url: streamUrl(host, target.channel) });
  };
  await runCheck({ MONITOR_STATE: kv }, fetcher, () => new Date("2026-09-24T10:05:00.000Z"));
  const second = await runCheck({ MONITOR_STATE: kv }, fetcher, () => new Date("2026-09-24T10:10:00.000Z"));
  assert.equal(second.changes.length, 0);
});

test("rejects non-HTTPS or malformed stream URLs", async () => {
  await assert.rejects(
    inspectTarget(TARGETS[0], async () => Response.json({ ok: true, url: "http://edge.amazingtier.top/cmtvpt/index.m3u8?token=x" })),
    /unexpected stream URL shape/,
  );
  await assert.rejects(
    inspectTarget(TARGETS[0], async () => Response.json({ ok: true, url: "https://edge.amazingtier.top/other/index.m3u8?token=x" })),
    /unexpected stream URL shape/,
  );
});

test("status endpoint exposes monitoring state without stream tokens", async () => {
  const kv = new MemoryKV();
  const env = { MONITOR_STATE: kv };
  await runCheck(env, async (input) => {
    const target = TARGETS.find((item) => item.endpoint === String(input));
    return Response.json({ ok: true, url: streamUrl(target.expectedHost, target.channel) });
  });
  const response = await worker.fetch(new Request("https://monitor.test/status"), env);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.hosts[TARGETS[0].id], "simple.amazingtier.top");
  assert.equal(JSON.stringify(body).includes("SECRET_TOKEN"), false);
});

