const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function normalizeLogo(value) {
  const logo = String(value || '').trim();
  if (!logo) return '';
  if (/^(?:https?:)?\/\//i.test(logo) || logo.startsWith('/')) return logo;
  return `/${logo.replace(/^\/+/, '')}`;
}

function channelFromUrl(rawUrl, pageName) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  try {
    const parsed = new URL(url, 'https://player-engine.com');
    const pathname = parsed.pathname.toLowerCase();
    if (pathname === `/pages/${pageName}` || pathname === `/pages/${pageName.replace(/\.html$/, '')}`) {
      return String(parsed.searchParams.get('channel') || '').trim().toLowerCase();
    }
    if (pageName === 'worker-iptv3.html') {
      const match = pathname.match(/\/api\/iptv\/live\/([^/]+)\/master\.m3u8$/i);
      if (match) return decodeURIComponent(match[1]).trim().toLowerCase();
    }
  } catch (_) {
    return '';
  }

  return '';
}

function collectLogos(pageName) {
  const files = ['media/misc/chaines-pt.json', 'media/misc/chaines-fr.json'];
  const logos = new Map();

  for (const file of files) {
    const data = readJson(file);
    for (const item of data.items || []) {
      const channel = channelFromUrl(item.url, pageName);
      const logo = normalizeLogo(item.logo && item.logo.value);
      if (channel && logo && !logos.has(channel)) logos.set(channel, logo);
    }
  }

  return Object.fromEntries([...logos.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function jsString(value) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function formatMap(logos, indent = '    ') {
  const entries = Object.entries(logos);
  const lines = entries.map(([key, value]) => {
    const printableKey = /^[a-zA-Z_$][\w$]*$/.test(key) ? key : jsString(key);
    return `${indent}  ${printableKey}: ${jsString(value)}`;
  });
  return `${indent}const channelLogos = {\n${lines.join(',\n')}\n${indent}};`;
}

function replaceLogoMap(file, pageName) {
  const fullPath = path.join(root, file);
  const source = fs.readFileSync(fullPath, 'utf8');
  const logos = collectLogos(pageName);
  const nextMap = formatMap(logos);
  const mapPattern = /    const channelLogos = \{[\s\S]*?\n    \};/;
  if (!mapPattern.test(source)) throw new Error(`channelLogos map not found in ${file}`);
  const next = source.replace(mapPattern, nextMap);
  fs.writeFileSync(fullPath, next, 'utf8');
  const status = next === source ? 'deja synchronise' : 'synchronise';
  console.log(`${file}: ${Object.keys(logos).length} logos ${status}`);
}

replaceLogoMap('pages/worker-iptv.html', 'worker-iptv.html');
replaceLogoMap('pages/worker-iptv3.html', 'worker-iptv3.html');
