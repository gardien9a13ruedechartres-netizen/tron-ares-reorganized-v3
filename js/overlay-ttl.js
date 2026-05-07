/* js/overlay-ttl.js
   Version SANS RELOAD.

   - Charge l'iframe UNE seule fois
   - Aucun refresh périodique
   - Aucun reload quand on revient sur l'onglet
   - Aucun watchdog
   - Compatible avec overlay-ttl-adapter.js

   Usage:
     OverlayTTL.start(iframeElement, () => baseUrl)
     OverlayTTL.stop()
*/

(() => {
  "use strict";

  let state = null;

  function start(iframe, getUrl) {
    if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
      throw new Error("OverlayTTL.start: iframe invalide.");
    }

    if (typeof getUrl !== "function") {
      throw new Error("OverlayTTL.start: getUrl doit être une fonction.");
    }

    stop();

    const base = getUrl();
    if (!base) return;

    state = {
      iframe,
      getUrl
    };

    try {
      iframe.src = base;
    } catch (e) {
      console.warn("OverlayTTL load failed", e);
    }

    return {
      reload: () => {
        if (!state) return;
        try {
          iframe.src = state.getUrl();
        } catch {}
      }
    };
  }

  function stop() {
    if (!state) return;
    state = null;
  }

  window.OverlayTTL = { start, stop };
})();