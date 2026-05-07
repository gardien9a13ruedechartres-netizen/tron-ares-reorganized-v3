/* js/overlay-ttl-adapter.js
   Applique OverlayTTL UNIQUEMENT quand:
   - l'overlay iframe est visible (#iframeOverlay sans .hidden)
   - ET l'onglet actif est FR (data-tab="fr") ou IFRAMES (data-tab="iframes")
   => Ne touche pas à channelList (films/video).
*/

(() => {
  "use strict";

  function $(id) { return document.getElementById(id); }

  const overlayEl = $("iframeOverlay");
  const iframeEl  = $("iframeEl");

  if (!overlayEl || !iframeEl) return;

  function getActiveTab() {
    const btn = document.querySelector(".tab-btn.active");
    return btn ? (btn.getAttribute("data-tab") || "") : "";
  }

  function isOverlayVisible() {
    return !overlayEl.classList.contains("hidden");
  }

  function isTabEligible(tab) {
    return tab === "fr" || tab === "iframes";
  }

  function stripCacheBust(url) {
    // enlève ?_=... ou &_=... ajouté par cacheBust
    try {
      const u = String(url || "");
      return u.replace(/([?&])_=\d+(&)?/g, (m, p1, p2) => (p2 ? p1 : ""));
    } catch {
      return url;
    }
  }

  function ttlMsForUrl(url) {
    const s = String(url || "");
    // TTL mesuré ~4m16 pour M6FR -> refresh à 3m50
    if (/popcdn\.day\/go\.php\?stream=M6FR/i.test(s)) return 3 * 60 * 1000 + 50 * 1000;
    // défaut raisonnable
    return 5 * 60 * 1000 + 30 * 1000;
  }

  let lastBaseUrl = "";
  let running = false;

  function startTTLIfNeeded() {
    const tab = getActiveTab();
    if (!window.OverlayTTL) return;

    // conditions strictes: overlay visible + tab FR/IFRAMES
    if (!isOverlayVisible() || !isTabEligible(tab)) {
      if (running) {
        try { window.OverlayTTL.stop(); } catch {}
        running = false;
      }
      return;
    }

    const raw = iframeEl.getAttribute("src") || "";
    if (!raw || raw === "about:blank") return;

    const baseUrl = stripCacheBust(raw);

    // anti-pub (sans allow-same-origin)
    try { iframeEl.setAttribute("referrerpolicy", "no-referrer"); } catch {}
    try { iframeEl.setAttribute("sandbox", "allow-scripts allow-forms"); } catch {}

    // si URL inchangée et TTL déjà actif => rien
    if (running && baseUrl === lastBaseUrl) return;

    lastBaseUrl = baseUrl;

    try {
      window.OverlayTTL.start(iframeEl, () => lastBaseUrl, {
        refreshEveryMs: ttlMsForUrl(lastBaseUrl),
        loadTimeoutMs: 10000,
        jitterMaxMs: 2000,
        reloadOnReturnIfHiddenLongerThanMs: 20000,
        reloadOnReturnIfLastLoadOlderThanMs: 90000
      });
      running = true;
    } catch (e) {
      // si jamais OverlayTTL n'est pas dispo ou autre souci
      running = false;
      console.warn("OverlayTTL adapter start failed", e);
    }
  }

  // Observe les changements de classe (hidden) et de src
  const mo = new MutationObserver(() => startTTLIfNeeded());
  mo.observe(overlayEl, { attributes: true, attributeFilter: ["class"] });
  mo.observe(iframeEl,  { attributes: true, attributeFilter: ["src"] });

  // Observe les changements d’onglet (classe active)
  const tabsWrap = document.querySelector(".tabs");
  if (tabsWrap) {
    mo.observe(tabsWrap, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTTLIfNeeded);
  } else {
    startTTLIfNeeded();
  }
})();