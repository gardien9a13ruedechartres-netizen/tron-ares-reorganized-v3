import { parse } from 'devalue';

const CMTVPT_UPSTREAM_HOST = 'clouding.wideiptv.top';
const CMTVPT_PROXY_PATH = '/api/cmtvpt/proxy';
const WORKER_LIVE_PREFIX = '/api/worker-live/';
const SPORTTV_EPG_PATH = '/api/sporttv-epg';
const SPORTTV_GUIDE_URL = 'https://www.sporttv.pt/guia';
const MEO_EPG_PATH = '/api/meo-epg';
const MEO_GUIDE_URL = 'https://www.meo.pt/tv/canais-programacao/guia-tv';
const MEO_GRIDTV_BASE = 'https://meogouser.apps.meo.pt/Services/GridTv/GridTv.svc';
const GUIDETNT_EPG_PATH = '/api/guidetnt-epg';
const GUIDETNT_PROGRAM_URL = 'https://www.guidetnt.com/mobile/programme-tv';
const GUIDETNT_WIDGET_URL = 'https://www.guidetnt.com/program/content/1/1/0/0/21/25/00111C/031B2B/00D6FF/EAF7FF';
const WAVEWATCH_ORIGIN = 'https://lecteur-wavewatch-universal-stable.victor-salema-53d.workers.dev';
const WAVEWATCH_PROXY_PATHS = new Set([
  '/api/search',
  '/api/timeline',
  '/api/next',
  '/api/tmdb/browse',
  '/sse'
]);
const SPORTTV_CHANNELS = new Map([
  [727, 'sport-tv-1'],
  [728, 'sport-tv-2'],
  [729, 'sport-tv-3'],
  [5406, 'sport-tv-4'],
  [5422, 'sport-tv-5']
]);
const LIVE_CHANNELS = new Map([
  ['cmtvpt', 'CMTVPT'],
  ['rtp1', 'RTP1'],
  ['rtp2', 'RTP2'],
  ['rtp3', 'RTP3'],
  ['sic', 'SIC'],
  ['porto-canal', 'PortoCanal'],
  ['rtp-africa', 'RTPAfrica'],
  ['record-europa', 'RecordEuropa'],
  ['odisseia-pt', 'OdisseiaPT'],
  ['national-geographic-pt', 'NationalGeographicPT'],
  ['historia-pt', 'HISTORIAPT'],
  ['discovery-pt', 'DiscoveryPT'],
  ['tcv-int', 'TCV-INT'],
  ['tvi', 'TVI'],
  ['tvi-reality', 'TVIReality'],
  ['tvi-ficcao', 'TVI_Ficcao'],
  ['v-plus-tvi', 'VPlusTVI'],
  ['cnn-portugal', 'CNN-PT'],
  ['tvi-internacional', 'TVI-INT'],
  ['sic-noticias', 'SIC-NOTICIAS']
]);
const ALLOWED_UPSTREAM_PATHS = [
  '/CMTVPT/',
  '/RTP1/',
  '/RTP2/',
  '/RTP3/',
  '/SIC/',
  '/PortoCanal/',
  '/RTPAfrica/',
  '/RecordEuropa/',
  '/OdisseiaPT/',
  '/NationalGeographicPT/',
  '/HISTORIAPT/',
  '/DiscoveryPT/',
  '/TCV-INT/',
  '/TVI/',
  '/TVIReality/',
  '/TVI_Ficcao/',
  '/VPlusTVI/',
  '/CNN-PT/',
  '/TVI-INT/',
  '/SIC-NOTICIAS/'
];

function isAllowedCmtvptUrl(url) {
  return url.protocol === 'https:' &&
    url.hostname === CMTVPT_UPSTREAM_HOST &&
    ALLOWED_UPSTREAM_PATHS.some(path => url.pathname.startsWith(path)) &&
    !url.username &&
    !url.password;
}

function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedCmtvptUrl(upstream)) return value;
    return `${publicOrigin}${CMTVPT_PROXY_PATH}?url=${encodeURIComponent(upstream.href)}`;
  } catch (_) {
    return value;
  }
}

function programSummary(item) {
  const startsAt = Number(item.data);
  const duration = Number(item.duracao);
  if (!Number.isFinite(startsAt) || !Number.isFinite(duration)) return null;

  return {
    title: String(item.descricao || item.evento?.nome || '').trim(),
    subtitle: String(item.agregador2?.nome || item.evento?.nome || '').trim(),
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + duration).toISOString(),
    live: String(item.tipoEmissao || '').toUpperCase() === 'DIRETO',
    image: typeof item.imagem === 'string' ? item.imagem : ''
  };
}

function streamCorsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Ares-Channel, X-Ares-Resolved-At',
    ...extra
  };
}

function jsonCorsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    ...extra
  };
}

function meoRequestHeaders() {
  return {
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.meo.pt',
    Referer: MEO_GUIDE_URL,
    'User-Agent': 'Mozilla/5.0'
  };
}

function currentLisbonIsoLocal() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function safeMeoDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return currentLisbonIsoLocal().slice(0, 10);
}

function safeMeoCallLetter(value) {
  const raw = String(value || '').trim();
  if (!/^[A-Za-z0-9 _-]{1,32}$/.test(raw)) return '';
  return raw;
}

function meoTime(value) {
  const raw = String(value || '');
  const match = raw.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function meoProgramStatus(program, nowLocal) {
  const start = String(program?.StartDate || '');
  const end = String(program?.EndDate || '');
  if (start && end && start <= nowLocal && nowLocal < end) return 'now';
  if (end && end <= nowLocal) return 'past';
  return 'next';
}

function meoProgressPct(program, nowLocal) {
  const start = Date.parse(String(program?.StartDate || ''));
  const end = Date.parse(String(program?.EndDate || ''));
  const now = Date.parse(nowLocal);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || end <= start) return 0;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

function normalizeMeoProgram(program, nowLocal) {
  const status = meoProgramStatus(program, nowLocal);
  return {
    id: program?.Id ?? null,
    programId: program?.ProgramId ?? null,
    title: String(program?.Title || '').trim() || 'Programme',
    synopsis: String(program?.Synopsis || '').trim(),
    startDate: String(program?.StartDate || ''),
    endDate: String(program?.EndDate || ''),
    startTime: meoTime(program?.StartDate),
    endTime: meoTime(program?.EndDate),
    status,
    progressPct: status === 'now' ? meoProgressPct(program, nowLocal) : 0
  };
}

async function resolveMeoEpg(request, requestUrl) {
  const cors = jsonCorsHeaders({
    'Cache-Control': 'public, max-age=300, stale-if-error=3600'
  });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }

  const callLetter = safeMeoCallLetter(requestUrl.searchParams.get('callLetter'));
  if (!callLetter) {
    return new Response(JSON.stringify({ error: 'Missing or invalid callLetter' }), {
      status: 400,
      headers: { ...cors, 'Cache-Control': 'no-store' }
    });
  }

  const date = safeMeoDate(requestUrl.searchParams.get('date'));
  const endpoint = `${MEO_GRIDTV_BASE}/GetLiveChannelProgramsByDate?callLetter=${encodeURIComponent(callLetter)}&date=${encodeURIComponent(date)}&userAgent=IPTV_OFR_GTV`;

  try {
    const upstream = await fetch(endpoint, {
      headers: meoRequestHeaders(),
      cf: { cacheEverything: true, cacheTtl: 300 },
      redirect: 'follow'
    });

    if (!upstream.ok) throw new Error(`MEO EPG unavailable (${upstream.status})`);
    const data = await upstream.json();
    if (data?.Status !== 'OK' || !Array.isArray(data?.Result)) {
      throw new Error(`MEO EPG bad payload (${data?.Status || 'unknown'})`);
    }

    const nowLocal = currentLisbonIsoLocal();
    const programs = data.Result
      .map(program => normalizeMeoProgram(program, nowLocal))
      .filter(program => program.title && program.startDate && program.endDate);

    const current = programs.find(program => program.status === 'now') || null;
    const next = programs.find(program => program.status === 'next') || null;
    const body = JSON.stringify({
      ok: true,
      source: MEO_GUIDE_URL,
      callLetter,
      date,
      updatedAt: new Date().toISOString(),
      timezone: 'Europe/Lisbon',
      logoUrl: `https://cdn-er-images.online.meo.pt/api/Channels/logos/image?callLetter=${encodeURIComponent(callLetter)}&profile=corner_transparent_positive&width=120`,
      current,
      next,
      programs
    });

    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: cors });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'MEO EPG unavailable', detail: String(error?.message || error), callLetter, date }),
      { status: 502, headers: { ...cors, 'Cache-Control': 'no-store' } }
    );
  }
}

function guideTntRequestHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml',
    Referer: 'https://www.guidetnt.com/',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0'
  };
}

function safeGuideTntChannelId(value) {
  const raw = String(value || '').trim();
  if (!/^\d{1,4}$/.test(raw)) return '';
  return raw;
}

function currentParisIsoLocal() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function decodeGuideTntText(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    eacute: 'é',
    egrave: 'è',
    ecirc: 'ê',
    agrave: 'à',
    ugrave: 'ù',
    ccedil: 'ç',
    ocirc: 'ô',
    icirc: 'î',
    Eacute: 'É'
  };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
}

function stripGuideTntHtml(value) {
  return decodeGuideTntText(
    String(value || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function guideTntCategory(className) {
  const cls = String(className || '').toLowerCase();
  if (cls.includes('film')) return 'Film';
  if (cls.includes('serie')) return 'Serie';
  if (cls.includes('sport')) return 'Sport';
  if (cls.includes('jeunesse')) return 'Jeunesse';
  if (cls.includes('divertissement')) return 'Divertissement';
  if (cls.includes('magazine')) return 'Mag/docu';
  if (cls.includes('info')) return 'Info';
  if (cls.includes('spectacle')) return 'Spectacle';
  if (cls.includes('music')) return 'Musique';
  if (cls.includes('reality')) return 'Telerealite';
  return 'Programme';
}

function guideTntImage(inner) {
  const match = String(inner || '').match(/\s(?:data-src|src)=["']([^"']+)["']/i);
  if (!match) return '';
  try {
    return new URL(decodeGuideTntText(match[1]), 'https://www.guidetnt.com').href;
  } catch (_) {
    return '';
  }
}

function parseGuideTntDateFromHref(href, fallbackDate) {
  const match = String(href || '').match(/\/(\d{1,2})\/(\d{1,2})\/(\d{1,2})\/(\d{1,2})\/(\d+)(?:[/?#"]|$)/);
  if (!match) return null;
  const fallbackYear = Number(fallbackDate.slice(0, 4));
  const month = String(match[1]).padStart(2, '0');
  const day = String(match[2]).padStart(2, '0');
  const hour = String(match[3]).padStart(2, '0');
  const minute = String(match[4]).padStart(2, '0');
  const channelId = match[5];
  return {
    channelId,
    startDate: `${fallbackYear}-${month}-${day}T${hour}:${minute}:00`,
    startTime: `${hour}:${minute}`
  };
}

function extractGuideTntChannelBlock(html, channelId) {
  const startPattern = new RegExp(`<div id=['"]channel-${channelId}['"]>`, 'i');
  const startMatch = startPattern.exec(html);
  if (!startMatch) return '';
  const start = startMatch.index;
  const nextMatch = /<div id=['"]channel-\d+['"]>/i.exec(html.slice(start + startMatch[0].length));
  const end = nextMatch ? start + startMatch[0].length + nextMatch.index : html.length;
  return html.slice(start, end);
}

function parseGuideTntPrograms(html, channelId) {
  const nowLocal = currentParisIsoLocal();
  const fallbackDate = nowLocal.slice(0, 10);
  const block = extractGuideTntChannelBlock(html, channelId);
  if (!block) return { channelName: '', programs: [] };

  const channelName = decodeGuideTntText((block.match(/alt=["']([^"']+)["']/i) || [])[1] || '');
  const programs = [];
  const itemPattern = /<a\b[^>]*href=["']([^"']*\/television\/[^"']+)["'][^>]*>\s*<div\b[^>]*class=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>\s*<\/a>/gi;
  let match;
  while ((match = itemPattern.exec(block))) {
    const href = decodeGuideTntText(match[1]);
    const className = match[2];
    const inner = match[3];
    const parsed = parseGuideTntDateFromHref(href, fallbackDate);
    if (!parsed || parsed.channelId !== String(channelId)) continue;

    const text = stripGuideTntHtml(inner)
      .replace(/^\+$/, '')
      .replace(/^\d{1,2}:\d{2}\s*/, '')
      .replace(/^\+\s*/, '')
      .trim();
    if (!text || text === '+') continue;

    programs.push({
      title: text,
      synopsis: '',
      image: guideTntImage(inner),
      category: guideTntCategory(className),
      detailUrl: new URL(href, 'https://www.guidetnt.com').href,
      startDate: parsed.startDate,
      endDate: '',
      startTime: parsed.startTime,
      endTime: '',
      status: 'next',
      progressPct: 0
    });
  }

  programs.sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let i = 0; i < programs.length; i += 1) {
    const current = programs[i];
    const next = programs[i + 1];
    current.endDate = next?.startDate || '';
    current.endTime = next?.startTime || '';
    if (current.startDate <= nowLocal && (!current.endDate || nowLocal < current.endDate)) {
      current.status = 'now';
      const start = Date.parse(current.startDate);
      const end = Date.parse(current.endDate || current.startDate);
      const now = Date.parse(nowLocal);
      current.progressPct = Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
        : 0;
    } else if (current.endDate && current.endDate <= nowLocal) {
      current.status = 'past';
    }
  }

  return { channelName, programs };
}

async function resolveGuideTntEpg(request, requestUrl) {
  const cors = jsonCorsHeaders({
    'Cache-Control': 'public, max-age=300, stale-if-error=1800'
  });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }

  const channelId = safeGuideTntChannelId(requestUrl.searchParams.get('channelId'));
  if (!channelId) {
    return new Response(JSON.stringify({ error: 'Missing or invalid channelId' }), {
      status: 400,
      headers: { ...cors, 'Cache-Control': 'no-store' }
    });
  }

  try {
    const upstream = await fetch(GUIDETNT_PROGRAM_URL, {
      headers: guideTntRequestHeaders(),
      cf: { cacheEverything: true, cacheTtl: 300 },
      redirect: 'follow'
    });
    if (!upstream.ok) throw new Error(`GuideTNT unavailable (${upstream.status})`);

    const html = await upstream.text();
    const parsed = parseGuideTntPrograms(html, channelId);
    if (!parsed.programs.length) throw new Error(`GuideTNT channel ${channelId} unavailable in current grid`);

    const current = parsed.programs.find(program => program.status === 'now') || parsed.programs[0] || null;
    const next = parsed.programs.find(program => program.status === 'next') || null;
    const body = JSON.stringify({
      ok: true,
      source: GUIDETNT_PROGRAM_URL,
      fallbackUrl: GUIDETNT_WIDGET_URL,
      channelId,
      channelName: parsed.channelName,
      updatedAt: new Date().toISOString(),
      timezone: 'Europe/Paris',
      current,
      next,
      programs: parsed.programs
    });

    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: cors });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'GuideTNT EPG unavailable', detail: String(error?.message || error), channelId, fallbackUrl: GUIDETNT_WIDGET_URL }),
      { status: 502, headers: { ...cors, 'Cache-Control': 'no-store' } }
    );
  }
}

async function resolveSportTvEpg(request) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, stale-if-error=86400'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }

  try {
    const guide = await fetch(SPORTTV_GUIDE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0'
      },
      cf: { cacheEverything: true, cacheTtl: 300 }
    });
    if (!guide.ok) throw new Error(`Guide unavailable (${guide.status})`);

    const html = await guide.text();
    const payloadMatch = html.match(
      /<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!payloadMatch) throw new Error('Nuxt guide payload unavailable');

    const identity = value => value;
    const payload = parse(payloadMatch[1], {
      Reactive: identity,
      Ref: identity,
      ShallowReactive: identity,
      ShallowRef: identity,
      EmptyRef: () => undefined,
      NuxtError: identity
    });

    const schedules = Object.values(payload?.data || {}).find(value =>
      Array.isArray(value) &&
      value.length > 100 &&
      value.some(item => item?.canal?.id && item?.data && item?.duracao)
    );
    if (!schedules) throw new Error('Sport TV schedules unavailable');

    const now = Date.now();
    const channels = {};

    for (const [channelId, key] of SPORTTV_CHANNELS) {
      const items = schedules
        .filter(item => Number(item?.canal?.id) === channelId)
        .sort((a, b) => Number(a.data) - Number(b.data));
      const current = items.find(item =>
        Number(item.data) <= now && now < Number(item.data) + Number(item.duracao)
      );
      const next = items.find(item => Number(item.data) > now);

      channels[key] = {
        name: String(current?.canal?.nome || next?.canal?.nome || key),
        current: current ? programSummary(current) : null,
        next: next ? programSummary(next) : null
      };
    }

    const body = JSON.stringify({
      source: SPORTTV_GUIDE_URL,
      updatedAt: new Date().toISOString(),
      channels
    });
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: cors });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Sport TV guide unavailable', detail: String(error?.message || error) }),
      { status: 502, headers: { ...cors, 'Cache-Control': 'no-store' } }
    );
  }
}

function rewritePlaylist(text, upstreamUrl, publicOrigin) {
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith('#')) {
      return makeProxyUrl(trimmed, upstreamUrl, publicOrigin);
    }
    return line.replace(/URI="([^"]+)"/g, (match, value) => {
      return `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`;
    });
  }).join('\n');
}

async function resolveWorkerLive(request, requestUrl, channelKey) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: streamCorsHeaders()
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: streamCorsHeaders() });
  }

  const channel = LIVE_CHANNELS.get(channelKey);
  if (!channel) return new Response('Unknown channel', { status: 404, headers: streamCorsHeaders() });

  const sourceUrl = `https://popcdn.day/player.php?stream=${channel}`;
  const source = await fetch(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  });
  if (!source.ok) {
    return new Response(`Source unavailable (${source.status})`, { status: 502, headers: streamCorsHeaders() });
  }

  const sourceHtml = await source.text();
  const pattern = new RegExp(
    `https://clouding\\.wideiptv\\.top/${channel}/embed\\.html\\?token=([^"'\\s<>&]+)`,
    'i'
  );
  const match = sourceHtml.match(pattern);
  if (!match || !match[1]) {
    return new Response('Dynamic token unavailable', { status: 502, headers: streamCorsHeaders() });
  }

  const embedUrl = match[0];
  const embed = await fetch(embedUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow'
  });
  if (!embed.ok) {
    return new Response(`Embed activation failed (${embed.status})`, { status: 502, headers: streamCorsHeaders() });
  }
  await embed.arrayBuffer();

  const upstreamPath = `/${channel}/index.fmp4.m3u8`;
  const upstreamUrl = new URL(`https://${CMTVPT_UPSTREAM_HOST}${upstreamPath}`);
  upstreamUrl.searchParams.set('token', match[1]);
  const master = await fetch(upstreamUrl, {
    headers: { Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*' },
    redirect: 'follow'
  });
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    return new Response(`Master validation failed (${master.status})`, { status: 502, headers: streamCorsHeaders() });
  }

  const headers = new Headers(streamCorsHeaders({
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Ares-Channel': channel,
    'X-Ares-Resolved-At': new Date().toISOString()
  }));
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(
    rewritePlaylist(masterText, upstreamUrl, requestUrl.origin),
    { status: 200, headers }
  );
}

async function proxyCmtvpt(request, requestUrl) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: streamCorsHeaders()
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: streamCorsHeaders() });
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  if (!rawUrl || rawUrl.length > 4096) {
    return new Response('Missing or invalid upstream URL', { status: 400, headers: streamCorsHeaders() });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response('Invalid upstream URL', { status: 400, headers: streamCorsHeaders() });
  }
  if (!isAllowedCmtvptUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', { status: 403, headers: streamCorsHeaders() });
  }

  const upstreamHeaders = new Headers({
    Accept: request.headers.get('Accept') || '*/*'
  });
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow'
    });
  } catch (error) {
    return new Response(`Upstream fetch failed: ${error?.message || 'network error'}`, {
      status: 502,
      headers: streamCorsHeaders({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store'
      })
    });
  }

  const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
  const isPlaylist = request.method === 'GET' &&
    (contentType.includes('mpegurl') || upstreamUrl.pathname.endsWith('.m3u8'));
  const headers = new Headers(streamCorsHeaders({
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store'
  }));

  for (const name of ['Accept-Ranges', 'Content-Range']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (isPlaylist) {
    const rewritten = rewritePlaylist(
      await upstream.text(),
      upstreamUrl,
      requestUrl.origin
    );
    return new Response(rewritten, { status: upstream.status, headers });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

async function resolveSerieFilmPage(request, url) {
  const upstreamUrl = new URL('/', WAVEWATCH_ORIGIN);
  upstreamUrl.search = url.search;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
    }
  });

  let html = await upstream.text();
  html = html
    .replace(/href="\/style\.css"/g, `href="${WAVEWATCH_ORIGIN}/style.css"`)
    .replace(/src="\/app\.js"/g, `src="${WAVEWATCH_ORIGIN}/app.js"`)
    .replace('</head>', `<style>
.search-panel::before{display:none!important;opacity:0!important;pointer-events:none!important}
.search-panel .search-row,.search-panel .search-info,.search-panel .search-results{
  opacity:1!important;
  transform:none!important;
  pointer-events:auto!important;
}
.search-input{
  user-select:text!important;
  -webkit-user-select:text!important;
  pointer-events:auto!important;
}
body.ares-playback-active .search-panel:not(:hover):not(:focus-within)::before{
  display:flex!important;
  opacity:.42!important;
  transform:none!important;
}
body.ares-playback-active .search-panel:not(:hover):not(:focus-within) .search-row,
body.ares-playback-active .search-panel:not(:hover):not(:focus-within) .search-info,
body.ares-playback-active .search-panel:not(:hover):not(:focus-within) .search-results{
  opacity:0!important;
  transform:translateY(-8px)!important;
  pointer-events:none!important;
}
</style><script>
(function(){
  function updateSearchPanelMode(){
    var video = document.getElementById('videoEl');
    var embed = document.getElementById('embedFrame');
    var videoActive = !!(video && video.style.display !== 'none' && video.currentTime > 0 && !video.paused);
    var embedActive = !!(embed && embed.style.display !== 'none' && embed.src && embed.src !== 'about:blank');
    document.body.classList.toggle('ares-playback-active', videoActive || embedActive);
  }
  document.addEventListener('play', updateSearchPanelMode, true);
  document.addEventListener('pause', updateSearchPanelMode, true);
  document.addEventListener('timeupdate', updateSearchPanelMode, true);
  setInterval(updateSearchPanelMode, 700);
})();
</script>
</head>`);

  return new Response(html, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

async function proxyWavewatchRequest(request, url) {
  const upstreamUrl = new URL(url.pathname + url.search, WAVEWATCH_ORIGIN);
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(WAVEWATCH_ORIGIN).host);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow'
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  responseHeaders.set('CDN-Cache-Control', 'no-store');
  responseHeaders.set('Cloudflare-CDN-Cache-Control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (/^\/pages\/serie-film(?:\.html)?$/i.test(url.pathname)) {
      return resolveSerieFilmPage(request, url);
    }

    if (WAVEWATCH_PROXY_PATHS.has(url.pathname)) {
      return proxyWavewatchRequest(request, url);
    }

    if (url.pathname === SPORTTV_EPG_PATH) {
      return resolveSportTvEpg(request);
    }

    if (url.pathname === MEO_EPG_PATH) {
      return resolveMeoEpg(request, url);
    }

    if (url.pathname === GUIDETNT_EPG_PATH) {
      return resolveGuideTntEpg(request, url);
    }

    if (url.pathname === CMTVPT_PROXY_PATH) {
      return proxyCmtvpt(request, url);
    }

    const liveMatch = url.pathname.match(/^\/api\/worker-live\/([a-z0-9-]+)\/master\.m3u8$/i);
    if (liveMatch) {
      return resolveWorkerLive(request, url, liveMatch[1].toLowerCase());
    }

    const response = await env.ASSETS.fetch(request);

    if (/^\/js\/(?:fr|pt)-program-badges\.js$/i.test(url.pathname) ||
        /^\/pages\/(?:worker-)?(?:cmtvpt|rtp1|rtp2|sic)(?:\.html)?$/i.test(url.pathname)) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return response;
  }
};
