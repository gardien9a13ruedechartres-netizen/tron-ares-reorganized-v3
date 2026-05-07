/**
 * TMDb Cache Manager (Stable)
 * - Clés déterministes (pas de suffixe aléatoire)
 * - localStorage + stats
 * - Expose explicitement window.TMDbCacheManager
 */

(function (global) {
  'use strict';

  // Petit hash stable (FNV-1a) pour fabriquer des clés courtes et déterministes
  function fnv1a(str) {
    str = String(str);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // h *= 16777619 (version optimisée)
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    // uint32 -> base36
    return (h >>> 0).toString(36);
  }

  function safeJsonStringify(value) {
    try {
      if (value === undefined) return 'undefined';
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  class TMDbCacheManager {
    constructor(options = {}) {
      this.options = {
        prefix: options.prefix || 'tmdb_cache_',
        maxAge: options.maxAge ?? (7 * 24 * 60 * 60 * 1000),
        maxSize: options.maxSize ?? (5 * 1024 * 1024),
        maxEntries: options.maxEntries ?? 500
      };

      this.statsKey = `${this.options.prefix}stats`;
      this._stats = this._loadStats();
      this._memory = new Map(); // fallback mémoire si localStorage indispo
    }

    // -----------------------------
    // Stats
    // -----------------------------
    _loadStats() {
      const base = { hits: 0, misses: 0, evictions: 0, errors: 0 };
      try {
        const raw = localStorage.getItem(this.statsKey);
        if (!raw) return base;
        const parsed = JSON.parse(raw);
        return Object.assign(base, parsed || {});
      } catch (e) {
        return base;
      }
    }

    _saveStats() {
      try {
        localStorage.setItem(this.statsKey, JSON.stringify(this._stats));
      } catch (e) {
        // ignore
      }
    }

    resetStats() {
      this._stats = { hits: 0, misses: 0, evictions: 0, errors: 0 };
      this._saveStats();
    }

    getStats() {
      const keys = this._listKeys();
      const sizes = keys.map(k => this._getItemSize(k));
      const totalSize = sizes.reduce((a, b) => a + b, 0);

      const hits = this._stats.hits || 0;
      const misses = this._stats.misses || 0;
      const hitRate = (hits + misses) > 0 ? (hits / (hits + misses)) : 0;

      return {
        hits,
        misses,
        evictions: this._stats.evictions || 0,
        errors: this._stats.errors || 0,
        hitRate,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        entryCount: keys.length,
        maxSize: this.options.maxSize,
        maxSizeMB: (this.options.maxSize / (1024 * 1024)).toFixed(2),
        maxEntries: this.options.maxEntries
      };
    }

    // -----------------------------
    // Clés / stockage
    // -----------------------------
    _listKeys() {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(this.options.prefix) && k !== this.statsKey) out.push(k);
        }
      } catch (e) {
        // fallback mémoire
        for (const k of this._memory.keys()) {
          if (k.startsWith(this.options.prefix) && k !== this.statsKey) out.push(k);
        }
      }
      return out;
    }

    _getItemSize(key) {
      try {
        const v = localStorage.getItem(key);
        return v ? v.length : 0;
      } catch (e) {
        const v = this._memory.get(key);
        return v ? String(v).length : 0;
      }
    }

    _storageGet(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return this._memory.get(key) || null;
      }
    }

    _storageSet(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        // fallback mémoire si quota / interdit
        this._memory.set(key, value);
        return false;
      }
    }

    _storageRemove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        this._memory.delete(key);
      }
    }

    _generateKey(type, params) {
      // Clé DÉTERMINISTE: prefix + type + hash(stableString)
      const stable = `${type}::${safeJsonStringify(params)}`;
      const h = fnv1a(stable);
      return `${this.options.prefix}${type}:${h}`;
    }

    // -----------------------------
    // API publique
    // -----------------------------
    get(type, params) {
      const key = this._generateKey(type, params);
      const raw = this._storageGet(key);

      if (!raw) {
        this._stats.misses++;
        this._saveStats();
        return null;
      }

      try {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const expiresAt = parsed?.expiresAt ?? 0;

        if (expiresAt && now > expiresAt) {
          this._storageRemove(key);
          this._stats.misses++;
          this._saveStats();
          return null;
        }

        this._stats.hits++;
        this._saveStats();
        return parsed?.data ?? null;
      } catch (e) {
        this._stats.errors++;
        this._saveStats();
        return null;
      }
    }

    set(type, params, data, ttlMs = null) {
      const key = this._generateKey(type, params);
      const now = Date.now();
      const ttl = (ttlMs === null || ttlMs === undefined) ? this.options.maxAge : ttlMs;
      const expiresAt = ttl ? (now + ttl) : 0;

      const payload = JSON.stringify({ createdAt: now, expiresAt, data });
      this._storageSet(key, payload);

      // Respect limites (best effort)
      this._enforceLimits();
      return true;
    }

    delete(type, params) {
      const key = this._generateKey(type, params);
      this._storageRemove(key);
    }

    clear() {
      const keys = this._listKeys();
      keys.forEach(k => this._storageRemove(k));
      this.resetStats();
      return keys.length;
    }

    cleanup() {
      const keys = this._listKeys();
      const now = Date.now();
      let removed = 0;

      for (const key of keys) {
        const raw = this._storageGet(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const expiresAt = parsed?.expiresAt ?? 0;
          if (expiresAt && now > expiresAt) {
            this._storageRemove(key);
            removed++;
          }
        } catch (e) {
          // entrée corrompue
          this._storageRemove(key);
          removed++;
        }
      }

      return removed;
    }

    _enforceLimits() {
      const keys = this._listKeys();
      if (!keys.length) return;

      // 1) Max entries
      if (keys.length > this.options.maxEntries) {
        // evict oldest
        const items = keys.map(k => {
          const raw = this._storageGet(k);
          let createdAt = 0;
          try { createdAt = JSON.parse(raw)?.createdAt ?? 0; } catch(e) {}
          return { k, createdAt };
        }).sort((a, b) => a.createdAt - b.createdAt);

        const toRemove = items.slice(0, keys.length - this.options.maxEntries);
        toRemove.forEach(it => this._storageRemove(it.k));
        this._stats.evictions += toRemove.length;
        this._saveStats();
      }

      // 2) Max size
      const keys2 = this._listKeys();
      let total = keys2.reduce((sum, k) => sum + this._getItemSize(k), 0);

      if (total > this.options.maxSize) {
        const items = keys2.map(k => {
          const raw = this._storageGet(k);
          let createdAt = 0;
          let size = this._getItemSize(k);
          try { createdAt = JSON.parse(raw)?.createdAt ?? 0; } catch(e) {}
          return { k, createdAt, size };
        }).sort((a, b) => a.createdAt - b.createdAt);

        let idx = 0;
        let evicted = 0;
        while (total > this.options.maxSize && idx < items.length) {
          this._storageRemove(items[idx].k);
          total -= items[idx].size;
          idx++;
          evicted++;
        }
        if (evicted) {
          this._stats.evictions += evicted;
          this._saveStats();
        }
      }
    }
  }

  // ✅ Exposition explicite (la clé de ton problème)
  global.TMDbCacheManager = TMDbCacheManager;

})(typeof window !== 'undefined' ? window : globalThis);
