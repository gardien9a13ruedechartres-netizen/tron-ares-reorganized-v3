/* js/overlay-ttl-adapter.js
   Applique OverlayTTL UNIQUEMENT quand:
   - l'overlay iframe est visible (#iframeOverlay sans .hidden)
   - ET l'onglet actif est FR (data-tab="fr") ou IFRAMES (data-tab="iframes")
   => Ne touche pas à channelList (films/video).

   IMPORTANT :
   - YouTube / youtube-nocookie doit être traité à part :
     * referrerpolicy="origin"
     * PAS de sandbox restrictif
   - Les autres iframes pub / overlay gardent :
     * referrerpolicy="no-referrer"
     * sandbox="allow-scripts allow-forms"
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
    if (/popcdn\.day\/go\.php\?stream=M6FR/i.test(s)) {
      return 3 * 60 * 1000 + 50 * 1000;
    }

    // défaut raisonnable
    return 5 * 60 * 1000 + 30 * 1000;
  }

  function isYouTubeUrl(url) {
    const s = String(url || "");
    return /(?:youtube\.com|youtu\.be|youtube\-nocookie\.com)/i.test(s);
  }

  function applyIframeSecurityPolicy(url) {
    const s = String(url || "");

    if (!s || s === "about:blank") return;

    if (isYouTubeUrl(s)) {
      // ✅ Cas YouTube : ne surtout pas casser le referer
      try {
        iframeEl.setAttribute(
          "allow",
          "autoplay; encrypted-media; picture-in-picture; fullscreen"
        );
      } catch {}

      try {
        iframeEl.setAttribute("referrerpolicy", "origin");
      } catch {}

      // IMPORTANT :
      // on retire le sandbox strict, sinon YouTube peut dysfonctionner
      try {
        iframeEl.removeAttribute("sandbox");
      } catch {}

      return;
    }

    // ✅ Cas iframes externes / overlays pub / sources à restreindre
    try {
      iframeEl.setAttribute(
        "allow",
        "autoplay; encrypted-media; picture-in-picture; fullscreen"
      );
    } catch {}

    try {
      iframeEl.setAttribute("referrerpolicy", "no-referrer");
    } catch {}

    try {
      iframeEl.setAttribute("sandbox", "allow-scripts allow-forms");
    } catch {}
  }

  let lastBaseUrl = "";
  let running = false;

  function startTTLIfNeeded() {
    const tab = getActiveTab();
    if (!window.OverlayTTL) return;

    // conditions strictes : overlay visible + tab FR/IFRAMES
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

    // ✅ Applique la bonne politique suivant le type d'URL
    applyIframeSecurityPolicy(baseUrl);

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
      running = false;
      console.warn("OverlayTTL adapter start failed", e);
    }
  }

  const mo = new MutationObserver(() => startTTLIfNeeded());

  mo.observe(overlayEl, {
    attributes: true,
    attributeFilter: ["class"]
  });

  mo.observe(iframeEl, {
    attributes: true,
    attributeFilter: ["src"]
  });

  const tabsWrap = document.querySelector(".tabs");
  if (tabsWrap) {
    mo.observe(tabsWrap, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTTLIfNeeded);
  } else {
    startTTLIfNeeded();
  }
})();