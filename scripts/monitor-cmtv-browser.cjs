const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FIREFOX = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const TARGET_URL = process.env.ARES_MONITOR_URL || 'https://player-engine.com/';
const DURATION_MS = Number(process.env.ARES_MONITOR_MS || 10 * 60 * 1000);
const POLL_MS = Number(process.env.ARES_MONITOR_POLL_MS || 10000);
const CDP_PORT = Number(process.env.ARES_MONITOR_CDP_PORT || 9333);
const OPEN_FIREFOX = process.env.ARES_MONITOR_FIREFOX !== '0';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tempProfile(name) {
  const dir = path.join(ROOT, '.tmp', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();
  return child;
}

async function waitForJson(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (_) {}
    await sleep(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
      else resolve(data.result);
      return;
    }
    if (data.method) handleEvent(data);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  function send(method, params = {}) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
    });
  }

  return { ws, ready, send };
}

const recentEvents = [];
function remember(type, message) {
  const line = `[${new Date().toLocaleTimeString()}] ${type}: ${message}`;
  recentEvents.push(line);
  while (recentEvents.length > 30) recentEvents.shift();
  console.log(line);
}

function handleEvent(event) {
  if (event.method === 'Runtime.consoleAPICalled') {
    const args = event.params.args || [];
    const text = args.map(arg => {
      if (arg.value !== undefined) return arg.value;
      if (arg.preview?.properties?.length) {
        const details = arg.preview.properties
          .slice(0, 12)
          .map(prop => `${prop.name}=${prop.value ?? prop.description ?? prop.type}`)
          .join(' ');
        return `${arg.description || arg.type}{${details}}`;
      }
      return arg.description ?? arg.type;
    }).join(' ');
    if (/ARES|HLS|LiveWatch|Erreur|error|fatal|bascule|secours|Rafraichissement/i.test(text)) {
      remember('console', text);
    }
  }

  if (event.method === 'Log.entryAdded') {
    const entry = event.params.entry || {};
    if (entry.level === 'error' || /HLS|CORS|network/i.test(entry.text || '')) {
      remember('log', `${entry.level || 'log'} ${entry.text || ''}`);
    }
  }

  if (event.method === 'Network.loadingFailed') {
    remember('network-failed', `${event.params.errorText || ''} ${event.params.blockedReason || ''}`.trim());
  }

  if (event.method === 'Network.responseReceived') {
    const response = event.params.response || {};
    const status = Number(response.status || 0);
    if (status >= 400 && /iptv|worker|m3u8|hls|proxy/i.test(response.url || '')) {
      remember('network-status', `${status} ${response.url}`);
    }
  }
}

async function evaluate(client, expression) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Runtime exception');
      }
      return result.result?.value;
    } catch (error) {
      lastError = error;
      if (!/context was destroyed|Cannot find context|Target closed/i.test(String(error?.message || error))) {
        throw error;
      }
      await sleep(1500);
    }
  }
  throw lastError;
}

async function clickByText(client, selector, pattern) {
  const target = await evaluate(client, `
    (() => {
      const re = new RegExp(${JSON.stringify(pattern)}, 'i');
      const normalize = value => String(value || '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/\\s+/g, ' ')
        .trim();
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find(node => re.test(normalize(node.textContent)));
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      return {
        text: normalize(el.textContent),
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    })()
  `);

  if (!target) return null;
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: target.x,
    y: target.y,
    button: 'left',
    clickCount: 1
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: target.x,
    y: target.y,
    button: 'left',
    clickCount: 1
  });
  return target;
}

async function waitForText(client, selector, pattern, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await evaluate(client, `
      (() => {
        const re = new RegExp(${JSON.stringify(pattern)}, 'i');
        const normalize = value => String(value || '')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/\\s+/g, ' ')
          .trim();
        return [...document.querySelectorAll(${JSON.stringify(selector)})]
          .some(node => re.test(normalize(node.textContent)));
      })()
    `);
    if (found) return true;
    await sleep(500);
  }
  return false;
}

async function selectCmtv(client) {
  await waitForText(client, 'button,.tab-btn,[role="tab"]', 'CHAINES\\s+PT|PORTUGAL');
  const ptTab = await clickByText(client, 'button,.tab-btn,[role="tab"]', 'CHAINES\\s+PT|PORTUGAL');
  await sleep(1500);
  const cmtv = await clickByText(client, '.channel-item,button,[role="button"],a', 'CMTV');
  remember('selection', `pt=${ptTab?.text || 'not-found'} cmtv=${cmtv?.text || 'not-found'}`);
}

async function clickVideoAndPlay(client) {
  const rect = await evaluate(client, `
    (() => {
      const video = document.querySelector('video');
      const target = video || document.querySelector('#playerContainer,.player,main');
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    })()
  `);

  if (rect && Number.isFinite(rect.x) && Number.isFinite(rect.y)) {
    await client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1
    });
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1
    });
  }

  await sleep(800);
  const playResult = await evaluate(client, `
    (async () => {
      const video = document.querySelector('video');
      if (!video) return 'no-video';
      try {
        video.muted = false;
        video.volume = 1;
        await Promise.race([
          video.play(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('play-timeout')), 4000))
        ]);
        return 'play-ok';
      } catch (error) {
        return 'play-failed:' + (error && (error.name || error.message) || error);
      }
    })()
  `);
  remember('interaction', playResult);
}

async function snapshot(client) {
  return evaluate(client, `
    (() => {
      const video = document.querySelector('video');
      const bufferedAhead = (() => {
        if (!video || !video.buffered) return 0;
        for (let i = 0; i < video.buffered.length; i += 1) {
          if (video.currentTime >= video.buffered.start(i) - 0.15 && video.currentTime <= video.buffered.end(i) + 0.15) {
            return Math.max(0, video.buffered.end(i) - video.currentTime);
          }
        }
        return 0;
      })();
      const textOf = selectors => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          const text = (el && el.textContent || '').trim();
          if (text) return text.replace(/\\s+/g, ' ');
        }
        return '';
      };
      const active = [...document.querySelectorAll('.channel-item.active,.active')]
        .map(el => (el.textContent || '').trim().replace(/\\s+/g, ' '))
        .find(text => /CMTV|RTP|TF1|Sport|CANAL|SIC|TVI/i.test(text)) || '';
      return {
        at: new Date().toISOString(),
        title: document.title,
        status: textOf(['#statusText', '.status', '[data-status]', '#playerStatus']),
        nowPlaying: textOf(['#nowTitle', '.now-title', '.now-playing', '#npTitle']),
        active,
        video: video ? {
          currentTime: Number(video.currentTime || 0),
          paused: !!video.paused,
          muted: !!video.muted,
          volume: Number(video.volume),
          readyState: video.readyState,
          networkState: video.networkState,
          bufferedAhead,
          error: video.error ? { code: video.error.code, message: video.error.message } : null,
          src: video.currentSrc || video.src || ''
        } : null
      };
    })()
  `);
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);

  const chromeProfile = tempProfile(`chrome-cmtv-monitor-${CDP_PORT}-${Date.now()}`);
  spawnDetached(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${chromeProfile}`,
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--new-window',
    TARGET_URL
  ]);

  if (OPEN_FIREFOX && fs.existsSync(FIREFOX)) {
    const firefoxProfile = tempProfile(`firefox-cmtv-monitor-${Date.now()}`);
    spawnDetached(FIREFOX, ['-no-remote', '-profile', firefoxProfile, TARGET_URL]);
  }

  await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const targets = await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pageTarget =
    targets.find(target => target.type === 'page' && String(target.url || '').startsWith('http')) ||
    targets.find(target => target.type === 'page');
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('No debuggable page target found');
  }
  const client = connect(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');

  await sleep(3000);
  if (/cmtv/i.test(TARGET_URL)) {
    remember('selection', 'direct-cmtv-url');
  } else {
    await selectCmtv(client);
  }
  await sleep(1500);
  await clickVideoAndPlay(client);

  let previous = null;
  const started = Date.now();
  while (Date.now() - started < DURATION_MS) {
    const snap = await snapshot(client);
    const video = snap.video;
    const delta = previous?.video && video ? video.currentTime - previous.video.currentTime : 0;
    const flags = [];
    if (!video) flags.push('NO_VIDEO');
    if (video?.error) flags.push(`VIDEO_ERROR_${video.error.code}`);
    if (video && !video.paused && delta < 0.2 && previous) flags.push('TIME_NOT_ADVANCING');
    if (video && video.bufferedAhead < 1.5 && !video.paused) flags.push('LOW_BUFFER');
    if (video && (video.muted || video.volume <= 0)) flags.push('AUDIO_MUTED_OR_ZERO');

    console.log(JSON.stringify({
      elapsedSec: Math.round((Date.now() - started) / 1000),
      status: snap.status,
      nowPlaying: snap.nowPlaying,
      active: snap.active.slice(0, 120),
      video: video && {
        t: Number(video.currentTime.toFixed(1)),
        delta: Number(delta.toFixed(2)),
        paused: video.paused,
        muted: video.muted,
        volume: video.volume,
        readyState: video.readyState,
        networkState: video.networkState,
        bufferedAhead: Number(video.bufferedAhead.toFixed(1)),
        error: video.error,
        srcKind: /worker-iptv3/.test(video.src) ? 'iptv3' : /worker-live/.test(video.src) ? 'worker-live' : /blob:/.test(video.src) ? 'blob' : 'other'
      },
      flags
    }));

    previous = snap;
    await sleep(POLL_MS);
  }

  console.log('Recent important events:');
  console.log(recentEvents.join('\n') || '(none)');
  client.ws.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
