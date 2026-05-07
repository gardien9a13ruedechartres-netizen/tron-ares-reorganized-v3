/**
 * js/tmdb-integration.js — Playlist-aware (ultra optimisé)
 *
 * Hypothèse: ta playlist M3U est enrichie avec tmdb-id / tvg-content-id=tmdb:XXXX
 * => On privilégie tmdbId (pas de search) et on évite credits (souvent déjà en tvg-cast / tvg-director)
 *
 * Prérequis (ordre dans index.html, en defer):
 * 1) tmdb-cache-manager.stable.js
 * 2) js/tron-ares.js
 * 3) js/tmdb-integration.js
 */

(function () {
  'use strict';

  // =========================
  // Réglages
  // =========================
  const DEBUG = false;
  const LOG_PREFIX = '[TMDb cache]';

  const log = (...a) => { if (DEBUG) console.log(LOG_PREFIX, ...a); };
  const warn = (...a) => { console.warn(LOG_PREFIX, ...a); };

  if (typeof window === 'undefined') return;

  // TMDbCacheManager doit être exposé (stable)
  if (typeof window.TMDbCacheManager !== 'function') {
    warn('TMDbCacheManager introuvable. Vérifie tmdb-cache-manager.stable.js + ordre des scripts.');
    return;
  }

  // =========================
  // API Key TMDb
  // =========================
  function getTmdbApiKey() {
    try {
      if (typeof TMDB_API_KEY !== 'undefined' && TMDB_API_KEY) return TMDB_API_KEY;
    } catch (e) {}
    if (window.TMDB_API_KEY) return window.TMDB_API_KEY;
    if (window.__TMDB_API_KEY) return window.__TMDB_API_KEY;
    return '';
  }

  // =========================
  // Cache manager
  // =========================
  const tmdbCache = new window.TMDbCacheManager({
    prefix: 'ares_tmdb_',
    maxAge: 14 * 24 * 60 * 60 * 1000, // défaut 14j (si TTL non fourni)
    maxSize: 5 * 1024 * 1024,        // 5MB
    maxEntries: 500
  });

  // =========================
  // TTL adaptatifs (ms)
  // =========================
  const TTL = {
    bundle_default: 14 * 24 * 60 * 60 * 1000,
    bundle_recent: 3 * 24 * 60 * 60 * 1000,     // films récents: rafraîchir plus souvent
    details_default: 14 * 24 * 60 * 60 * 1000,
    details_recent: 3 * 24 * 60 * 60 * 1000,
    videos_default: 30 * 24 * 60 * 60 * 1000,
    videos_recent: 7 * 24 * 60 * 60 * 1000,
    search: 12 * 60 * 60 * 1000,                // fallback rare
    negative: 45 * 60 * 1000
  };

  function nowYear() {
    try { return new Date().getFullYear(); } catch (e) { return 2026; }
  }

  function pickTTLByYear(baseDefault, baseRecent, year) {
    // Si l’année est récente (>= année courante - 1), TTL plus court
    const y = Number(year);
    if (Number.isFinite(y) && y >= (nowYear() - 1)) return baseRecent;
    return baseDefault;
  }

  // =========================
  // Helpers: normalisation / extraction
  // =========================
  function normSpaces(s) {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
  }

  function stableKey(...parts) {
    return parts.map(p => normSpaces(String(p ?? '')).toLowerCase()).join('|');
  }

  function extractYear(entryName) {
    // helper tron-ares si dispo
    if (typeof window.__extractYearFromName === 'function') {
      try { return window.__extractYearFromName(entryName); } catch (e) {}
    }
    const m = String(entryName || '').match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : null;
  }

  function extractTmdbIdFromEntry(entry) {
    // playlist enrichie: tmdb-id="1195631", tvg-content-id="tmdb:1195631"
    const candidates = [];

    // formes classiques
    candidates.push(entry?.tmdbId);
    candidates.push(entry?.tmdb_id);
    candidates.push(entry?.tmdbID);

    // attributs raw possibles
    candidates.push(entry?.['tmdb-id']);
    candidates.push(entry?.['tmdb_id']);
    candidates.push(entry?.['tvg-content-id']);
    candidates.push(entry?.['tvg-content_id']);
    candidates.push(entry?.['tvgContentId']);

    // d’autres champs fréquents
    candidates.push(entry?.['tvg-id']);
    candidates.push(entry?.tvgId);

    for (const c of candidates) {
      const s = String(c ?? '').trim();
      if (!s) continue;

      // tvg-content-id="tmdb:1195631"
      if (s.toLowerCase().startsWith('tmdb:')) {
        const id = s.slice(5).trim();
        if (/^\d+$/.test(id)) return id;
      }

      // tmdb-id="1195631"
      if (/^\d+$/.test(s)) return s;
    }

    return '';
  }

  function hasPlaylistCredits(entry) {
    const cast = String(entry?.cast || entry?.['tvg-cast'] || entry?.tvg_cast || '').trim();
    const director = String(entry?.director || entry?.['tvg-director'] || entry?.tvg_director || '').trim();
    // S’il y a au moins un cast/director, on considère que credits TMDb brut n’est pas nécessaire
    return Boolean(cast || director);
  }

  function getPlaylistCredits(entry) {
    // On normalise au format proche de TMDb (light)
    const castRaw = String(entry?.cast || entry?.['tvg-cast'] || entry?.tvg_cast || '').trim();
    const directorRaw = String(entry?.director || entry?.['tvg-director'] || entry?.tvg_director || '').trim();
    const writerRaw = String(entry?.writer || entry?.['tvg-writer'] || entry?.tvg_writer || '').trim();

    const castArr = castRaw
      ? castRaw.split('|').map(s => normSpaces(s)).filter(Boolean)
      : [];

    const directorArr = directorRaw
      ? directorRaw.split('|').map(s => normSpaces(s)).filter(Boolean)
      : [];

    const writerArr = writerRaw
      ? writerRaw.split('|').map(s => normSpaces(s)).filter(Boolean)
      : [];

    // Format "light" (suffisant pour UI)
    return {
      source: 'playlist',
      cast: castArr,
      director: directorArr,
      writer: writerArr
    };
  }

  // =========================
  // TMDb URL + Fetch cache
  // =========================
  function tmdbUrl(path, paramsObj) {
    const apiKey = getTmdbApiKey();
    const p = new URLSearchParams();
    p.set('api_key', apiKey);

    for (const [k, v] of Object.entries(paramsObj || {})) {
      if (v === undefined || v === null || v === '') continue;
      p.set(k, String(v));
    }
    return `https://api.themoviedb.org/3${path}?${p.toString()}`;
  }

  async function tmdbFetchWithCache(url, type, paramsKey, ttlMs) {
    const cached = tmdbCache.get(type, paramsKey);
    if (cached) {
      log('HIT', type, paramsKey);
      return cached;
    }

    const apiKey = getTmdbApiKey();
    if (!apiKey) throw new Error('TMDB_API_KEY manquant');

    log('MISS', type, paramsKey);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`TMDb API Error: ${r.status} ${r.statusText}`);

    const data = await r.json();
    tmdbCache.set(type, paramsKey, data, ttlMs);
    return data;
  }

  async function tmdbGetMovieDetails(movieId, language, yearHint) {
    const url = tmdbUrl(`/movie/${movieId}`, { language });
    const k = stableKey('id', movieId, 'lang', language);
    const ttl = pickTTLByYear(TTL.details_default, TTL.details_recent, yearHint);
    return await tmdbFetchWithCache(url, 'details', k, ttl);
  }

  async function tmdbGetMovieVideos(movieId, language, yearHint) {
    const url = tmdbUrl(`/movie/${movieId}/videos`, { language });
    const k = stableKey('id', movieId, 'lang', language);
    const ttl = pickTTLByYear(TTL.videos_default, TTL.videos_recent, yearHint);
    return await tmdbFetchWithCache(url, 'videos', k, ttl);
  }

  // Fallback search (rare, si entrée sans tmdb-id)
  async function tmdbSearchMovie(query, year, language) {
    const url = tmdbUrl('/search/movie', { query, language, year: year || '' });
    const k = stableKey('q', query, 'y', year || '', 'lang', language);
    return await tmdbFetchWithCache(url, 'search', k, TTL.search);
  }

  // Cache négatif (rare, fallback)
  function negKey(query, year, lang) {
    return stableKey('q', query, 'y', year || '', 'lang', lang);
  }
  function negGet(query, year, lang) {
    return tmdbCache.get('neg', negKey(query, year, lang));
  }
  function negSet(query, year, lang) {
    tmdbCache.set('neg', negKey(query, year, lang), { ok: false, reason: 'no-results' }, TTL.negative);
  }

  // =========================
  // Cache bundle (par ID uniquement)
  // =========================
  function bundleKeyById(movieId) {
    return stableKey('id', movieId);
  }

  function bundleGetById(movieId) {
    return tmdbCache.get('bundle_id', bundleKeyById(movieId));
  }

  function bundleSetById(movieId, data, yearHint) {
    const ttl = pickTTLByYear(TTL.bundle_default, TTL.bundle_recent, yearHint);
    tmdbCache.set('bundle_id', bundleKeyById(movieId), data, ttl);
  }

  // =========================
  // Résolution synopsis (playlist-aware)
  // =========================
  async function resolveSynopsisWithCache(entry) {
    const rawName = String(entry?.name || entry?.['tvg-name'] || '').trim();
    const year = extractYear(rawName);
    const playlistHasCred = hasPlaylistCredits(entry);
    const playlistCred = playlistHasCred ? getPlaylistCredits(entry) : null;

    // 1) ID direct depuis playlist (chemin principal)
    const directId = extractTmdbIdFromEntry(entry);

    if (directId && /^\d+$/.test(directId)) {
      // a) bundle direct
      const bundle = bundleGetById(directId);
      if (bundle) return bundle;

      // b) fetch details (fr-FR puis fallback en-US si overview vide)
      try {
        let detailsLangUsed = 'fr-FR';
        let details = await tmdbGetMovieDetails(directId, 'fr-FR', year);

        if (!details || !details.overview) {
          const en = await tmdbGetMovieDetails(directId, 'en-US', year);
          if (en && en.overview) {
            details = Object.assign({}, details || {}, en);
            detailsLangUsed = 'en-US';
          }
        }

        // c) videos (best effort) — utile pour trailer; on garde
        let videos = null;
        try { videos = await tmdbGetMovieVideos(directId, detailsLangUsed, year); } catch (e) { videos = null; }

        // d) credits: on n’appelle PAS TMDb si la playlist fournit cast/director
        const credits = playlistCred ? playlistCred : null;

        const out = {
          ok: true,
          movieId: String(directId),
          query: rawName ? normSpaces(rawName.replace(/\s*\(\d{4}\)\s*$/, '')) : '',
          searchLangUsed: 'direct-id',
          detailsLangUsed,
          title: details?.title || (rawName || ''),
          overview: details?.overview || '',
          poster_path: details?.poster_path || '',
          backdrop_path: details?.backdrop_path || '',
          release_date: details?.release_date || '',
          vote_average: details?.vote_average ?? null,
          vote_count: details?.vote_count ?? null,
          genres: Array.isArray(details?.genres) ? details.genres : [],
          runtime: details?.runtime ?? null,
          videos,
          credits
        };

        bundleSetById(String(directId), out, year);
        return out;
      } catch (err) {
        return {
          ok: false,
          movieId: String(directId),
          query: rawName || '',
          year,
          err: String(err?.message || err)
        };
      }
    }

    // 2) Fallback rare: pas d'id => search (à garder pour robustesse)
    //    On essaie d’utiliser le nettoyage tron-ares si dispo
    const qTitle = (() => {
      if (typeof window.__tmdbCleanTitleForSearch === 'function') {
        try {
          const t = window.__tmdbCleanTitleForSearch(rawName);
          if (t && typeof t === 'string') return normSpaces(t);
        } catch (e) {}
      }
      return normSpaces(rawName);
    })();

    try {
      // cache négatif FR ?
      if (negGet(qTitle, year, 'fr-FR')) {
        return { ok: false, query: qTitle, year, err: 'Aucun résultat (cache négatif FR)' };
      }

      let search = await tmdbSearchMovie(qTitle, year, 'fr-FR');
      let results = Array.isArray(search?.results) ? search.results : [];
      let searchLangUsed = 'fr-FR';

      if (!results.length) {
        negSet(qTitle, year, 'fr-FR');

        if (negGet(qTitle, year, 'en-US')) {
          return { ok: false, query: qTitle, year, err: 'Aucun résultat (cache négatif EN)' };
        }

        search = await tmdbSearchMovie(qTitle, year, 'en-US');
        results = Array.isArray(search?.results) ? search.results : [];
        searchLangUsed = 'en-US';

        if (!results.length) {
          negSet(qTitle, year, 'en-US');
          return { ok: false, query: qTitle, year, err: 'Aucun résultat' };
        }
      }

      const best = results[0];
      const movieId = String(best?.id || '');
      if (!movieId) return { ok: false, query: qTitle, year, err: 'ID TMDb introuvable' };

      // bundle direct si déjà là
      const bundle = bundleGetById(movieId);
      if (bundle) return bundle;

      // details + videos (pas credits)
      let detailsLangUsed = 'fr-FR';
      let details = await tmdbGetMovieDetails(movieId, 'fr-FR', year);

      if (!details || !details.overview) {
        const en = await tmdbGetMovieDetails(movieId, 'en-US', year);
        if (en && en.overview) {
          details = Object.assign({}, details || {}, en);
          detailsLangUsed = 'en-US';
        }
      }

      let videos = null;
      try { videos = await tmdbGetMovieVideos(movieId, detailsLangUsed, year); } catch (e) { videos = null; }

      const out = {
        ok: true,
        movieId,
        query: qTitle,
        searchLangUsed,
        detailsLangUsed,
        title: details?.title || best?.title || qTitle,
        overview: details?.overview || '',
        poster_path: details?.poster_path || best?.poster_path || '',
        backdrop_path: details?.backdrop_path || best?.backdrop_path || '',
        release_date: details?.release_date || best?.release_date || '',
        vote_average: details?.vote_average ?? best?.vote_average ?? null,
        vote_count: details?.vote_count ?? best?.vote_count ?? null,
        genres: Array.isArray(details?.genres) ? details.genres : [],
        runtime: details?.runtime ?? null,
        videos,
        credits: playlistCred ? playlistCred : null
      };

      bundleSetById(movieId, out, year);
      return out;
    } catch (err) {
      return { ok: false, query: qTitle, year, err: String(err?.message || err) };
    }
  }

  // =========================
  // Override robuste + exports globaux
  // =========================
  function installOverride() {
    window.tmdbCache = tmdbCache;
    window.resolveSynopsisWithCache = resolveSynopsisWithCache;

    if (typeof window.__tmdbResolveSynopsis === 'function' && !window.__tmdbResolveSynopsis_original) {
      window.__tmdbResolveSynopsis_original = window.__tmdbResolveSynopsis;
    }

    window.__tmdbResolveSynopsis = async function __tmdbResolveSynopsis(entry) {
      return await window.resolveSynopsisWithCache(entry);
    };
  }

  installOverride();

  // Debug helper (optionnel)
  window.__tmdbCacheDebug = function () {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ares_tmdb_'));
    return { stats: tmdbCache.getStats(), keys };
  };

  console.log(`${LOG_PREFIX} integration playlist-aware chargée ✅`);

})();
