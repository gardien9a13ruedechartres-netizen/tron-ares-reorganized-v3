const fs = require('fs');

const PLAYER_ORIGIN = 'https://player-engine.com';
const LEGACY_WORKER = 'https://tron-ares-iptv.victor-salema-53d.workers.dev/api/iptv/live';
const WIDE_WORKER = 'https://player-engine.com/api/worker-live';
const IPTV3_WORKER = 'https://tron-ares-iptv3.victor-salema-53d.workers.dev/api/iptv/live';

const wideChannels = new Set([
  'cmtvpt',
  'rtp1',
  'rtp2',
  'rtp3',
  'sic',
  'porto-canal',
  'rtp-africa',
  'record-europa',
  'odisseia-pt',
  'national-geographic-pt',
  'historia-pt',
  'discovery-pt',
  'tcv-int',
  'tvi',
  'tvi-reality',
  'tvi-ficcao',
  'v-plus-tvi',
  'cnn-portugal',
  'tvi-internacional',
  'sic-noticias'
]);

function resolveItemUrl(item) {
  const raw = String(item.url || '').trim();
  if (!raw) return '';

  let parsed;
  try {
    parsed = new URL(raw, PLAYER_ORIGIN);
  } catch (_) {
    return raw;
  }

  if (parsed.origin === PLAYER_ORIGIN && parsed.pathname.toLowerCase() === '/pages/worker-iptv.html') {
    const channel = String(parsed.searchParams.get('channel') || '').trim().toLowerCase();
    if (!channel) return parsed.href;
    const base = wideChannels.has(channel) ? WIDE_WORKER : LEGACY_WORKER;
    return `${base}/${encodeURIComponent(channel)}/master.m3u8`;
  }

  if (parsed.origin === PLAYER_ORIGIN && parsed.pathname.toLowerCase() === '/pages/worker-iptv3.html') {
    const channel = String(parsed.searchParams.get('channel') || '').trim().toLowerCase();
    if (!channel) return parsed.href;
    return `${IPTV3_WORKER}/${encodeURIComponent(channel)}/master.m3u8`;
  }

  return parsed.href;
}

function looksLikePlaylist(url, contentType, text) {
  const lower = String(url || '').toLowerCase();
  const type = String(contentType || '').toLowerCase();
  if (lower.includes('.m3u8') || type.includes('mpegurl') || type.includes('x-mpegurl')) {
    return text.trimStart().startsWith('#EXTM3U');
  }
  return true;
}

async function checkItem(item) {
  const url = resolveItemUrl(item);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/vnd.apple.mpegurl,text/html,application/json,*/*'
      }
    });
    const type = response.headers.get('content-type') || '';
    const text = await response.text();
    const validBody = response.ok && looksLikePlaylist(url, type, text);
    return {
      id: item.id,
      name: item.name,
      group: item.group,
      url: item.url,
      resolvedUrl: url,
      status: response.status,
      ok: validBody,
      reason: validBody ? 'ok' : `bad-body/status-${response.status}`,
      ms: Date.now() - startedAt
    };
  } catch (error) {
    return {
      id: item.id,
      name: item.name,
      group: item.group,
      url: item.url,
      resolvedUrl: url,
      status: 0,
      ok: false,
      reason: error.name === 'AbortError' ? 'timeout' : error.message,
      ms: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    for (;;) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

(async () => {
  const data = JSON.parse(fs.readFileSync('media/misc/chaines-fr.json', 'utf8'));
  const results = await mapLimit(data.items || [], 8, checkItem);
  const down = results.filter(item => !item.ok);
  const report = { checkedAt: new Date().toISOString(), total: results.length, downCount: down.length, results };
  fs.writeFileSync('tmp-fr-channel-audit.json', JSON.stringify(report, null, 2));
  console.log(`Total: ${results.length}`);
  console.log(`HS: ${down.length}`);
  for (const item of down) {
    console.log(`${item.id}\t${item.name}\t${item.reason}\t${item.status}\t${item.resolvedUrl}`);
  }
})();
