const fs = require('fs');

const workerPath = 'worker-iptv3.js';
const playerPath = 'pages/worker-iptv3.html';
const jsonPath = 'media/misc/chaines-fr.json';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\+/g, ' PLUS ')
    .replace(/&/g, ' ET ')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function sourceOrder(source) {
  const value = String(source || '').toLowerCase();
  if (value === 'cable') return 0;
  if (value === 'satellite') return 1;
  if (value === 'basic') return 2;
  return 3;
}

function sortCandidates(terms, candidates) {
  const wanted = terms.map(normalize);
  return [...candidates]
    .map(candidate => ({
      ...candidate,
      exactScore: wanted.includes(normalize(candidate.name)) ? 1 : 0,
      variantPenalty: /\b(?:\+1|PLUS 1|BACKUP|LIVE)\b/i.test(normalize(candidate.name)) ? 1 : 0
    }))
    .sort((a, b) =>
      b.exactScore - a.exactScore ||
      a.variantPenalty - b.variantPenalty ||
      sourceOrder(a.source) - sourceOrder(b.source)
    )
    .slice(0, 4)
    .map(({ exactScore, variantPenalty, matchScore, ...candidate }) => candidate);
}

function jsString(value) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function formatWorkerEntry(replacement) {
  const key = replacement.item.id;
  const sorted = sortCandidates(replacement.terms, replacement.candidates);
  const exact = sorted[0].name;
  const search = replacement.terms[0];
  const fallback = sorted.map(candidate => {
    const quality = candidate.quality == null ? 'null' : jsString(candidate.quality);
    return `    { id: ${jsString(candidate.id)}, name: ${jsString(candidate.name)}, quality: ${quality}, source: ${jsString(candidate.source)} }`;
  }).join(',\n');

  return `  [${jsString(key)}, { search: ${jsString(search)}, exact: ${jsString(exact)}, country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [\n${fallback}\n  ] }],`;
}

function upsertWorkerEntries(replacements) {
  let source = fs.readFileSync(workerPath, 'utf8');
  for (const replacement of replacements) {
    const key = replacement.item.id;
    const entry = formatWorkerEntry(replacement);
    const pattern = new RegExp(`  \\[${jsString(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, \\{[\\s\\S]*?\\n  \\]\\],\\n?`);
    if (pattern.test(source)) {
      source = source.replace(pattern, `${entry}\n`);
    } else {
      source = source.replace("  ['m6', { search: 'M6', exact: 'M6', country: 'France', prefer: ['FHD', 'HD', null] }]\n]);", `${entry}\n  ['m6', { search: 'M6', exact: 'M6', country: 'France', prefer: ['FHD', 'HD', null] }]\n]);`);
    }
  }
  fs.writeFileSync(workerPath, source, 'utf8');
}

function upsertPlayerChannels(replacements) {
  let source = fs.readFileSync(playerPath, 'utf8');
  for (const replacement of replacements) {
    const key = replacement.item.id;
    const name = replacement.item.name;
    const line = `      ${jsString(key)}: ${jsString(name)},`;
    const keyPattern = new RegExp(`      ${jsString(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: [^\\n]+\\n?`);
    if (keyPattern.test(source)) {
      source = source.replace(keyPattern, `${line}\n`);
    } else {
      source = source.replace("      m6: 'M6'\n    };", `${line}\n      m6: 'M6'\n    };`);
    }
  }
  fs.writeFileSync(playerPath, source, 'utf8');
}

function updateJson(replacements) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const replacementIds = new Set(replacements.map(item => item.item.id));
  for (const item of data.items || []) {
    if (!replacementIds.has(item.id)) continue;
    item.url = `/pages/worker-iptv3.html?channel=${encodeURIComponent(item.id)}`;
    item.isIframe = true;
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const { replacements } = JSON.parse(fs.readFileSync('tmp-livewatch-replacements.json', 'utf8'));
upsertWorkerEntries(replacements);
upsertPlayerChannels(replacements);
updateJson(replacements);
console.log(`Applied ${replacements.length} Livewatch replacements`);
