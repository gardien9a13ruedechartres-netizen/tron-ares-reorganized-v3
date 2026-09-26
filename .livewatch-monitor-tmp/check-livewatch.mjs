const base = 'https://tron-ares-livewatch-smart.victor-salema-53d.workers.dev';
const channels = ['cmtv','rtp1','rtp2','tvi','w9','btv','tf1','tf1sf'];

function classify(error) {
  const message = String(error?.cause?.message || error?.message || error);
  if (/abort|timeout/i.test(message)) return 'timeout';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|name.*resolved/i.test(message)) return 'DNS';
  if (/certificate|TLS|SSL/i.test(message)) return 'TLS';
  return 'network';
}

async function probe(label, url, hls = false) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: {'user-agent': 'livewatch-monitor/1.0'}
    });
    const body = await response.text();
    return {
      label,
      status: response.status,
      class: response.status === 403 ? '403' : response.status >= 500 ? '5xx' : 'HTTP',
      contentType: response.headers.get('content-type') || '',
      extm3u: hls ? body.slice(0, 512).includes('#EXTM3U') : null,
      source: response.headers.get('x-livewatch-smart-source') || '',
      detection: response.headers.get('x-livewatch-smart-detection') || '',
      latency: response.headers.get('x-livewatch-smart-latency') || '',
      elapsedMs: Date.now() - started
    };
  } catch (error) {
    return {label, status: null, class: classify(error), contentType: '', extm3u: hls ? false : null, source: '', detection: '', latency: '', elapsedMs: Date.now() - started};
  }
}

const targets = [
  ['root', `${base}/`, false],
  ['channels', `${base}/api/channels`, false],
  ...channels.flatMap(channel => [
    [`${channel}-health`, `${base}/api/live/${channel}/health`, false],
    [`${channel}-master`, `${base}/api/live/${channel}/master.m3u8`, true]
  ])
];

const results = await Promise.all(targets.map(([label, url, hls]) => probe(label, url, hls)));
const externals = [
  ['livewatch.top/api/channels', 'https://livewatch.top/api/channels', false],
  ['clouding.wideiptv.top', 'https://clouding.wideiptv.top/', false],
  ['wideiptv.top', 'https://wideiptv.top/', false],
  ['TF1-TVRADIOZAP', 'https://tvradiozap.eu/tools/m3u-m3u8.php/para/tf1.m3u8', true]
];
for (const [label, url, hls] of externals) {
  const first = await probe(label, url, hls);
  results.push(first);
  if (first.status === null || first.status === 403 || first.status >= 500) {
    results.push(await probe(`${label}-retry`, url, hls));
  }
}
console.log(JSON.stringify(results, null, 2));
