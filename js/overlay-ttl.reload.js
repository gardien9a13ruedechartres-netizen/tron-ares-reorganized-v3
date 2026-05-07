/* js/overlay-ttl.js
   Gestion TTL (expiration token) pour un overlay <iframe>.
   - Recharge l'iframe périodiquement (avant expiration)
   - Watchdog si le chargement ne finit pas
   - Retour onglet/focus intelligent (évite la coupure de 1–2s si tu reviens vite)
   Usage:
     OverlayTTL.start(iframeElement, () => baseUrl, { ...options })
     OverlayTTL.stop()
*/

(() => {
  "use strict";

  let state = null;

  function cacheBust(url) {
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + "_=" + Date.now();
  }

  function safeClear(t) {
    if (t) clearTimeout(t);
  }

  function start(iframe, getUrl, options = {}) {
    if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
      throw new Error("OverlayTTL.start: iframe invalide.");
    }
    if (typeof getUrl !== "function") {
      throw new Error("OverlayTTL.start: getUrl doit être une fonction.");
    }

    stop();

    const refreshEveryMs = Number.isFinite(options.refreshEveryMs)
      ? options.refreshEveryMs
      : (3 * 60 * 1000 + 50 * 1000);

    const loadTimeoutMs = Number.isFinite(options.loadTimeoutMs)
      ? options.loadTimeoutMs
      : 10 * 1000;

    const jitterMaxMs = Number.isFinite(options.jitterMaxMs)
      ? options.jitterMaxMs
      : 2000;

    const reloadOnReturnIfHiddenLongerThanMs = Number.isFinite(options.reloadOnReturnIfHiddenLongerThanMs)
      ? options.reloadOnReturnIfHiddenLongerThanMs
      : 20 * 1000;

    const reloadOnReturnIfLastLoadOlderThanMs = Number.isFinite(options.reloadOnReturnIfLastLoadOlderThanMs)
      ? options.reloadOnReturnIfLastLoadOlderThanMs
      : 90 * 1000;

    state = {
      iframe,
      getUrl,
      refreshEveryMs,
      loadTimeoutMs,
      jitterMaxMs,
      reloadOnReturnIfHiddenLongerThanMs,
      reloadOnReturnIfLastLoadOlderThanMs,
      loadTimer: null,
      refreshTimer: null,
      loadSeq: 0,
      lastLoadAt: 0,
      hiddenSince: null,
      onLoad: null,
      onVisibility: null,
      onFocus: null,
    };

    function loadStream(reason = "manual") {
      if (!state) return;
      const base = state.getUrl();
      if (!base) return;

      state.loadSeq += 1;
      const mySeq = state.loadSeq;

      safeClear(state.loadTimer);

      state.iframe.src = cacheBust(base);
      state.lastLoadAt = Date.now();

      state.loadTimer = setTimeout(() => {
        if (!state) return;
        if (mySeq !== state.loadSeq) return;
        loadStream("timeout");
      }, state.loadTimeoutMs);
    }

    function scheduleNextRefresh() {
      if (!state) return;
      safeClear(state.refreshTimer);

      const jitter = state.jitterMaxMs ? Math.floor(Math.random() * state.jitterMaxMs) : 0;
      state.refreshTimer = setTimeout(() => {
        loadStream("periodic");
        scheduleNextRefresh();
      }, state.refreshEveryMs + jitter);
    }

    function maybeReloadOnReturn(trigger) {
      if (!state) return;

      const now = Date.now();
      const hiddenDuration = state.hiddenSince ? (now - state.hiddenSince) : 0;
      const ageSinceLastLoad = state.lastLoadAt ? (now - state.lastLoadAt) : Infinity;

      const shouldReload =
        hiddenDuration >= state.reloadOnReturnIfHiddenLongerThanMs ||
        ageSinceLastLoad >= state.reloadOnReturnIfLastLoadOlderThanMs;

      if (shouldReload) loadStream(trigger);
    }

    state.onLoad = () => {
      if (!state) return;
      safeClear(state.loadTimer);
    };

    state.onVisibility = () => {
      if (!state) return;
      if (document.hidden) {
        state.hiddenSince = Date.now();
      } else {
        maybeReloadOnReturn("visible");
        state.hiddenSince = null;
      }
    };

    state.onFocus = () => {
      if (!state) return;
      if (!document.hidden) maybeReloadOnReturn("focus");
    };

    state.iframe.addEventListener("load", state.onLoad);
    document.addEventListener("visibilitychange", state.onVisibility);
    window.addEventListener("focus", state.onFocus);

    loadStream("init");
    scheduleNextRefresh();

    return { reload: () => loadStream("manual") };
  }

  function stop() {
    if (!state) return;

    safeClear(state.loadTimer);
    safeClear(state.refreshTimer);

    try { state.iframe.removeEventListener("load", state.onLoad); } catch {}
    try { document.removeEventListener("visibilitychange", state.onVisibility); } catch {}
    try { window.removeEventListener("focus", state.onFocus); } catch {}

    state = null;
  }

  window.OverlayTTL = { start, stop };
})();
