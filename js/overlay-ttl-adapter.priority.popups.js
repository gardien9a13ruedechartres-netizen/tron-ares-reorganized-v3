/* js/overlay-ttl-adapter.js - livewatch exception v12-player-engine-hls-priority
   Applique OverlayTTL UNIQUEMENT quand:
   - l'overlay iframe est visible (#iframeOverlay sans .hidden)
   - ET l'onglet actif est FR (data-tab="fr") ou IFRAMES (data-tab="iframes")
   => Ne touche pas à channelList (films/video).

   IMPORTANT :
   - YouTube / youtube-nocookie doit être traité à part :
     * referrerpolicy="origin"
     * PAS de sandbox restrictif
   - /pages/cmlive1.html, /pages/cmlive2.html et https://livewatch.top/channels/Portugal + France :
     * referrerpolicy="origin"
     * PAS de sandbox restrictif
   - /pages/test6.html :
     * referrerpolicy="no-referrer"
     * sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
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

  function isLivewatchChannelAllowed(url) {
    try {
      const u = new URL(String(url || ""), window.location.href);

      if (
        u.protocol !== "https:" ||
        u.hostname !== "livewatch.top"
      ) {
        return false;
      }

      const path = u.pathname.replace(/\/+$/, "");

      return (
        path === "/channels/Portugal" ||
        path === "/channels/France"   ||
        path === "/channels/CM-vavoo"
    );
    } catch {
      return false;
    }
  }

  function isLivewatchPlayerUrl(url) {
    try {
      const u = new URL(String(url || ""), window.location.href);
      return (
        u.protocol === "https:" &&
        u.hostname === "livewatch.top" &&
        u.pathname.replace(/\/+$/, "") === "/player"
      );
    } catch {
      return false;
    }
  }

  function isCMLivePortugalPageUrl(url) {
    try {
      const u = new URL(String(url || ""), window.location.href);
      const path = u.pathname.replace(/\/+$/, "");

      return (
        path === "/pages/cmlive1.html" ||
        path === "/pages/cmlive2.html" ||
        path === "/pages/CM-vavoo.html"
    );
    } catch {
      return false;
    }
  }

  function isNoSandboxExceptionUrl(url) {
    return (
      isLivewatchChannelAllowed(url) ||
      isLivewatchPlayerUrl(url) ||
      isCMLivePortugalPageUrl(url)
    );
  }

  function isPopupSandboxExceptionUrl(url) {
    try {
      const u = new URL(String(url || ""), window.location.href);
      const path = u.pathname.replace(/\/+$/, "");

      return path === "/pages/test6.html";
    } catch {
      return false;
    }
  }

  function applyIframeSecurityPolicy(url) {
    const s = String(url || "");

    if (!s || s === "about:blank") return;

    if (isYouTubeUrl(s) || isNoSandboxExceptionUrl(s)) {
      // ✅ Cas autorisés sans sandbox : YouTube + exception Livewatch Portugal.
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
      // on retire le sandbox strict uniquement pour ces URLs.
      try {
        iframeEl.removeAttribute("sandbox");
      } catch {}

      return;
    }

    // ✅ Cas iframes qui restent sandboxées mais peuvent ouvrir un nouvel onglet
    if (isPopupSandboxExceptionUrl(s)) {
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
        iframeEl.setAttribute(
          "sandbox",
          "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        );
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

  function installIframeSrcPolicyHook() {
    if (iframeEl.__overlayTtlSrcPolicyHookInstalled) return;
    iframeEl.__overlayTtlSrcPolicyHookInstalled = true;

    // setAttribute("src", url) : applique la politique avant navigation
    try {
      const nativeSetAttribute = iframeEl.setAttribute.bind(iframeEl);

      iframeEl.setAttribute = function (name, value) {
        if (String(name || "").toLowerCase() === "src") {
          try { applyIframeSecurityPolicy(value); } catch {}
        }

        return nativeSetAttribute(name, value);
      };
    } catch {}

    // iframe.src = url : applique la politique avant navigation
    try {
      const proto = HTMLIFrameElement && HTMLIFrameElement.prototype;
      const desc = proto ? Object.getOwnPropertyDescriptor(proto, "src") : null;

      if (desc && desc.set && desc.get) {
        Object.defineProperty(iframeEl, "src", {
          configurable: true,
          enumerable: true,
          get: function () {
            return desc.get.call(this);
          },
          set: function (value) {
            try { applyIframeSecurityPolicy(value); } catch {}
            return desc.set.call(this, value);
          }
        });
      }
    } catch {}
  }

  let lastBaseUrl = "";
  let running = false;

  function startTTLIfNeeded() {
    const tab = getActiveTab();

    const raw = iframeEl.getAttribute("src") || "";
    const baseUrl = stripCacheBust(raw);

    /*
     * IMPORTANT player-engine :
     * La politique iframe doit être appliquée même hors onglets FR / IFRAMES.
     * Exemple : onglet Films = data-tab="channels".
     * Par contre, le TTL reste limité à FR / IFRAMES pour ne pas toucher aux films.
     */
    if (baseUrl && baseUrl !== "about:blank") {
      applyIframeSecurityPolicy(baseUrl);
    }

    if (!window.OverlayTTL) return;

    /*
     * IMPORTANT HLS prioritaire :
     * Les pages locales cmlive et les exceptions LiveWatch ont leur propre logique interne
     * HLS -> iframe fallback. OverlayTTL ne doit pas remettre iframe.src dessus,
     * sinon il peut relancer la page et faire tomber trop vite sur l'iframe fallback.
     */
    if (baseUrl && baseUrl !== "about:blank" && isNoSandboxExceptionUrl(baseUrl)) {
      if (running) {
        try { window.OverlayTTL.stop(); } catch {}
        running = false;
      }
      lastBaseUrl = baseUrl;
      return;
    }

    // conditions strictes pour le TTL uniquement : overlay visible + tab FR/IFRAMES
    if (!isOverlayVisible() || !isTabEligible(tab)) {
      if (running) {
        try { window.OverlayTTL.stop(); } catch {}
        running = false;
      }
      return;
    }

    if (!baseUrl || baseUrl === "about:blank") return;

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

  installIframeSrcPolicyHook();

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