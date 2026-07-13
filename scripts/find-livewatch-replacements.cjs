const fs = require('fs');

const LIVEWATCH_ORIGIN = 'https://livewatch.top';
const SOURCE_TEST_TIMEOUT_MS = 7000;

const aliases = new Map([
  ['ligue-1', ['LIGUE 1+', 'CANAL+ LIGUE 1']],
  ['golf', ['GOLF+', 'GOLF +']],
  ['auto-moto', ['AUTO MOTO']],
  ['motorracing', ['MOTOR RACING', 'MOTORRACING']],
  ['l-equipe-fr', ["L'EQUIPE", "L'ÉQUIPE", 'EQUIPE']],
  ['ocs-max', ['OCS MAX']],
  ['warner-tv', ['WARNER TV']],
  ['cine-family', ['CINE+ FAMILY', 'CINÉ+ FAMILY']],
  ['cine-frisson', ['CINE+ FRISSON', 'CINÉ+ FRISSON']],
  ['cine-emotion', ['CINE+ EMOTION', 'CINÉ+ EMOTION']],
  ['cine-classic', ['CINE+ CLASSIC', 'CINÉ+ CLASSIC']],
  ['cine-club', ['CINE+ CLUB', 'CINÉ+ CLUB']],
  ['serie-club', ['SERIE CLUB', 'SÉRIE CLUB']],
  ['tcm-cinema', ['TCM CINEMA', 'TCM CINÉMA']],
  ['disney-junior', ['DISNEY JUNIOR']],
  ['dreamworks', ['DREAMWORKS']],
  ['cartoon-network', ['CARTOON NETWORK']],
  ['teletoon', ['TELETOON', 'TÉLÉTOON']],
  ['mangas', ['MANGAS']],
  ['xilam-tv', ['XILAM TV', 'XILAM']],
  ['j-one', ['J-ONE', 'J ONE']],
  ['tiji', ['TIJI']],
  ['nickelodeon', ['NICKELODEON']],
  ['boing', ['BOING']],
  ['game-one', ['GAME ONE']],
  ['toonami', ['TOONAMI']],
  ['toute-l-histoire', ["TOUTE L'HISTOIRE", 'TOUTE L HISTOIRE']],
  ['nat-geo', ['NAT GEO', 'NATIONAL GEOGRAPHIC']],
  ['nat-geo-wild', ['NAT GEO WILD', 'NATIONAL GEOGRAPHIC WILD']],
  ['discovery-science', ['DISCOVERY SCIENCE']],
  ['ushuaia-tv', ['USHUAIA TV', 'USHUAÏA TV']],
  ['science-vie', ['SCIENCE & VIE', 'SCIENCE VIE']],
  ['planete-a-e', ['PLANETE+ A&E', 'PLANÈTE+ A&E', 'PLANETE A&E']],
  ['planete-crime', ['PLANETE+ CRIME', 'PLANÈTE+ CRIME', 'PLANETE CRIME']],
  ['animaux', ['ANIMAUX']],
  ['rmc-decouverte-2', ['RMC DECOUVERTE', 'RMC DÉCOUVERTE']],
  ['investigation-discovery', ['INVESTIGATION DISCOVERY']],
  ['chasse-peche', ['CHASSE & PECHE', 'CHASSE & PÊCHE', 'CHASSE PECHE']],
  ['crime-district', ['CRIME DISTRICT']],
  ['mcm', ['MCM']],
  ['m6-music', ['M6 MUSIC']],
  ['mtv', ['MTV']],
  ['mtv-hits', ['MTV HITS']],
  ['nrj-hits', ['NRJ HITS']],
  ['bfm-business', ['BFM BUSINESS']]
]);

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

function livewatchHeaders(accept = '*/*') {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    'User-Agent': 'Mozilla/5.0'
  };
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function fetchWithTimeout(url, options = {}, ms = SOURCE_TEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(ms);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.cancel();
  }
}

async function searchLivewatch(term) {
  const apiUrl = new URL('/api/channels', LIVEWATCH_ORIGIN);
  apiUrl.searchParams.set('country', 'France');
  apiUrl.searchParams.set('limit', '50');
  apiUrl.searchParams.set('search', term);
  const response = await fetchWithTimeout(apiUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.channels || [];
}

async function validateCandidate(candidate) {
  const streamUrl = new URL(`/api/stream/${encodeURIComponent(candidate.id)}`, LIVEWATCH_ORIGIN);
  const streamResponse = await fetchWithTimeout(streamUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!streamResponse.ok) throw new Error(`stream ${streamResponse.status}`);
  const streamData = await streamResponse.json();
  if (!streamData.proxy_url) throw new Error('missing proxy_url');

  const master = await fetchWithTimeout(new URL(streamData.proxy_url, LIVEWATCH_ORIGIN), {
    headers: livewatchHeaders('application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const text = await master.text();
  if (!master.ok || !text.trimStart().startsWith('#EXTM3U')) throw new Error(`master ${master.status}`);
  return true;
}

function scoreCandidate(wantedNames, item) {
  const n = normalize(item.name);
  const wanted = wantedNames.map(normalize);
  if (wanted.includes(n)) return 100;
  if (wanted.some(w => n === w.replace(/ PLUS /g, ' '))) return 90;
  if (wanted.some(w => n.includes(w) || w.includes(n))) return 65;
  return 0;
}

function sourceScore(source) {
  const s = String(source || '').toLowerCase();
  if (s === 'cable') return 30;
  if (s === 'satellite') return 20;
  if (s === 'basic') return 10;
  return 0;
}

(async () => {
  const audit = JSON.parse(fs.readFileSync('tmp-fr-channel-audit.json', 'utf8'));
  const down = audit.results.filter(item => !item.ok);
  const replacements = [];
  const missing = [];

  for (const item of down) {
    const terms = aliases.get(item.id) || [item.name];
    const seen = new Map();

    for (const term of terms) {
      for (const candidate of await searchLivewatch(term)) {
        const score = scoreCandidate(terms, candidate);
        if (score > 0 && !seen.has(candidate.id)) seen.set(candidate.id, { ...candidate, matchScore: score });
      }
    }

    const candidates = [...seen.values()]
      .sort((a, b) => (b.matchScore + sourceScore(b.source)) - (a.matchScore + sourceScore(a.source)))
      .slice(0, 8);

    const valid = [];
    for (const candidate of candidates) {
      try {
        await validateCandidate(candidate);
        valid.push(candidate);
      } catch (_) {}
      if (valid.length >= 4) break;
    }

    if (valid.length) {
      replacements.push({ item, terms, candidates: valid });
      console.log(`OK\t${item.id}\t${item.name}\t=>\t${valid.map(c => `${c.name}/${c.source}/${c.quality || 'auto'}/${c.id}`).join(' | ')}`);
    } else {
      missing.push({ item, terms, candidates });
      console.log(`MISS\t${item.id}\t${item.name}\tterms=${terms.join('|')}`);
    }
  }

  fs.writeFileSync('tmp-livewatch-replacements.json', JSON.stringify({ replacements, missing }, null, 2));
  console.log(`Valid replacements: ${replacements.length}`);
  console.log(`Missing: ${missing.length}`);
})();
