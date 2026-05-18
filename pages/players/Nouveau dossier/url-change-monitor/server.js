'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_TARGET_URL = process.env.TARGET_URL || 'https://cm-tv-refresh.victor-salema-53d.workers.dev/';

let monitor = {
  targetUrl: DEFAULT_TARGET_URL,
  intervalMs: 5000,
  running: false,
  timer: null,
  lastSignature: null,
  lastChangedAt: null,
  lastCheckedAt: null,
  currentUrls: [],
  history: [],
  errors: []
};

function nowIso() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isLikelyUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function extractUrlsDeep(input, found = []) {
  if (isLikelyUrl(input)) {
    found.push(input.trim());
    return found;
  }

  if (Array.isArray(input)) {
    for (const item of input) extractUrlsDeep(item, found);
    return found;
  }

  if (input && typeof input === 'object') {
    for (const value of Object.values(input)) extractUrlsDeep(value, found);
  }

  return found;
}

function normalizeUrls(urls) {
  return [...new Set(urls)].sort();
}

function pushError(message) {
  monitor.errors.unshift({ at: nowIso(), message });
  monitor.errors = monitor.errors.slice(0, 30);
}

async function fetchJson(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'user-agent': 'url-change-monitor/1.0'
      }
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Réponse non JSON: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function checkNow() {
  const checkedAt = nowIso();
  monitor.lastCheckedAt = checkedAt;

  try {
    const json = await fetchJson(monitor.targetUrl);
    const urls = normalizeUrls(extractUrlsDeep(json));
    const signature = sha256(JSON.stringify(urls));

    if (monitor.lastSignature === null) {
      monitor.lastSignature = signature;
      monitor.lastChangedAt = checkedAt;
      monitor.currentUrls = urls;
      monitor.history.unshift({
        changedAt: checkedAt,
        secondsSincePreviousChange: null,
        urls,
        type: 'initial'
      });
      return;
    }

    if (signature !== monitor.lastSignature) {
      const previousChangedAt = monitor.lastChangedAt ? new Date(monitor.lastChangedAt).getTime() : null;
      const currentChangedAt = new Date(checkedAt).getTime();
      const secondsSincePreviousChange = previousChangedAt === null
        ? null
        : Math.round((currentChangedAt - previousChangedAt) / 1000);

      monitor.lastSignature = signature;
      monitor.lastChangedAt = checkedAt;
      monitor.currentUrls = urls;
      monitor.history.unshift({
        changedAt: checkedAt,
        secondsSincePreviousChange,
        urls,
        type: 'change'
      });
      monitor.history = monitor.history.slice(0, 100);
    } else {
      monitor.currentUrls = urls;
    }
  } catch (error) {
    pushError(error.message || String(error));
  }
}

function startMonitor() {
  if (monitor.running) return;
  monitor.running = true;
  checkNow();
  monitor.timer = setInterval(checkNow, monitor.intervalMs);
}

function stopMonitor() {
  if (monitor.timer) clearInterval(monitor.timer);
  monitor.timer = null;
  monitor.running = false;
}

function resetMonitor() {
  stopMonitor();
  monitor.lastSignature = null;
  monitor.lastChangedAt = null;
  monitor.lastCheckedAt = null;
  monitor.currentUrls = [];
  monitor.history = [];
  monitor.errors = [];
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function serveStatic(req, res) {
  const requestedPath = new URL(req.url, 'http://localhost').pathname;
  const safePath = requestedPath === '/' ? '/index.html' : requestedPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/status' && req.method === 'GET') {
    sendJson(res, 200, {
      ...monitor,
      timer: undefined
    });
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const targetUrl = String(data.targetUrl || '').trim();
        const intervalMs = Number(data.intervalMs || 5000);

        if (!/^https?:\/\//i.test(targetUrl)) {
          sendJson(res, 400, { error: 'L’URL doit commencer par http:// ou https://.' });
          return;
        }

        if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
          sendJson(res, 400, { error: 'L’intervalle minimum est 1000 ms.' });
          return;
        }

        const wasRunning = monitor.running;
        resetMonitor();
        monitor.targetUrl = targetUrl;
        monitor.intervalMs = Math.round(intervalMs);
        if (wasRunning) startMonitor();

        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 400, { error: 'JSON invalide.' });
      }
    });
    return;
  }

  if (url.pathname === '/api/start' && req.method === 'POST') {
    startMonitor();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/stop' && req.method === 'POST') {
    stopMonitor();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/reset' && req.method === 'POST') {
    const targetUrl = monitor.targetUrl;
    const intervalMs = monitor.intervalMs;
    resetMonitor();
    monitor.targetUrl = targetUrl;
    monitor.intervalMs = intervalMs;
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/check' && req.method === 'POST') {
    await checkNow();
    sendJson(res, 200, { ok: true });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Application lancée: http://localhost:${PORT}`);
  console.log(`Endpoint surveillé par défaut: ${DEFAULT_TARGET_URL}`);
});
