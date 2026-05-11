/*
  Ares TV Refresh Bridge - playUrl patch
  Ne modifie pas tron-ares.js.

  Il intercepte automatiquement les entrées :
  {
    "type": "tv-refresh",
    "url": "about:blank",
    "jsonUrl": "https://tv-channel-refresh.victor-salema-53d.workers.dev/?channel=TF1&countries=fr.json"
  }

  Placement exact dans index.html :
  <script defer src="js/tron-ares.js?v=0"></script>
  <script defer src="js/ares-tv-refresh-bridge.js?v=3"></script>
*/

(function () {
  "use strict";

  const DEFAULT_DOMAIN = "https://livewatch.top";
  const REFRESH_INTERVAL_MINUTES = 30;
  const STARTUP_WATCHDOG_MS = 12000;
  const MAX_AUTO_RECOVERY_ATTEMPTS = 3;

  let originalPlayUrl = null;
  let currentChannel = null;
  let currentHls = null;
  let refreshTimer = null;
  let startupWatchdog = null;
  let bufferingTimer = null;

  let lastPlayedUrl = "";
  let isRefreshing = false;
  let streamStarted = false;
  let autoRecoveryAttempts = 0;

  function log() {
    console.log.apply(console, ["[Ares TV Refresh Bridge]"].concat(Array.from(arguments)));
  }

  function normalizeUrl(url) {
    let clean = String(url || "").trim();

    if (!clean) return "";

    if (clean.startsWith("//")) {
      clean = "https:" + clean;
    }

    if (clean.startsWith("/")) {
      clean = DEFAULT_DOMAIN + clean;
    }

    return clean;
  }

  function getVideoElement() {
    return (
      document.querySelector("#videoEl") ||
      document.querySelector("#videoPlayer") ||
      document.querySelector("video")
    );
  }

  function getJsonUrl(channel) {
    if (!channel) return "";

    if (channel.jsonUrl) return normalizeUrl(channel.jsonUrl);
    if (channel.refreshUrl) return normalizeUrl(channel.refreshUrl);

    if (
      channel.url &&
      String(channel.url).includes("tv-channel-refresh") &&
      !String(channel.url).includes("/hls.m3u8")
    ) {
      return normalizeUrl(channel.url);
    }

    return "";
  }

  function isRefreshChannel(entry) {
    if (!entry) return false;

    if (entry.type === "tv-refresh") return true;
    if (entry.tvRefresh === true) return true;
    if (entry.jsonUrl || entry.refreshUrl) return true;

    return false;
  }

  function findM3u8Links(value) {
    const results = new Set();

    function scan(item) {
      if (typeof item === "string") {
        const directMatches = item.match(/https?:\/\/[^"' <>\n\r]+\.m3u8[^"' <>\n\r]*/g);
        const livewatchProxyMatches = item.match(/\/api\/proxy\?url=[^"' <>\n\r]+/g);
        const relativeMatches = item.match(/\/[^"' <>\n\r]+\.m3u8[^"' <>\n\r]*/g);

        if (directMatches) {
          directMatches.forEach(function (url) {
            results.add(normalizeUrl(url));
          });
        }

        if (livewatchProxyMatches) {
          livewatchProxyMatches.forEach(function (url) {
            results.add(normalizeUrl(url));
          });
        }

        if (relativeMatches) {
          relativeMatches.forEach(function (url) {
            results.add(normalizeUrl(url));
          });
        }

        if (
          item.includes(".m3u8") &&
          !directMatches &&
          !livewatchProxyMatches &&
          !relativeMatches
        ) {
          results.add(normalizeUrl(item));
        }

        return;
      }

      if (Array.isArray(item)) {
        item.forEach(scan);
        return;
      }

      if (item && typeof item === "object") {
        Object.values(item).forEach(scan);
      }
    }

    scan(value);
    return Array.from(results).filter(Boolean);
  }

  async function fetchJsonAndFindM3u8(channel) {
    const jsonUrl = getJsonUrl(channel);

    if (!jsonUrl) {
      throw new Error("URL JSON Worker manquante");
    }

    const response = await fetch(jsonUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();
    const links = findM3u8Links(data);

    if (!links.length) {
      throw new Error("Aucun lien .m3u8 trouvé dans le JSON");
    }

    return normalizeUrl(links[0]);
  }

  function setStatus(message) {
    log(message);

    try {
      if (typeof window.setStatus === "function") {
        window.setStatus(message);
      }
    } catch {}

    const statusPill = document.querySelector("#statusPill");

    if (statusPill) {
      statusPill.textContent = message;
    }
  }

  function hideIframeOverlayIfPresent() {
    const iframeOverlay = document.querySelector("#iframeOverlay");

    if (iframeOverlay) {
      iframeOverlay.classList.add("hidden");
    }

    const iframeEl = document.querySelector("#iframeEl");

    if (iframeEl) {
      iframeEl.removeAttribute("src");
    }
  }

  function destroyExistingMediaEngines() {
    try {
      if (typeof window.destroyHls === "function") window.destroyHls();
    } catch {}

    try {
      if (typeof window.destroyDash === "function") window.destroyDash();
    } catch {}

    if (currentHls) {
      try {
        currentHls.destroy();
      } catch {}

      currentHls = null;
    }
  }

  function ensureBufferingIndicator() {
    let indicator = document.querySelector("#aresTvRefreshBuffering");

    if (indicator) return indicator;

    const style = document.createElement("style");
    style.textContent = `
      #aresTvRefreshBuffering {
        position: fixed;
        left: 50%;
        bottom: 34px;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.84);
        color: #f3f4f6;
        border: 1px solid rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(12px);
        font: 600 14px Arial, sans-serif;
        transition: opacity .25s ease, visibility .25s ease, transform .25s ease;
      }

      #aresTvRefreshBuffering.hidden {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translateX(-50%) translateY(10px);
      }

      .ares-tv-refresh-spinner {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.18);
        border-top-color: #3b82f6;
        animation: aresTvRefreshSpin .8s linear infinite;
      }

      .ares-tv-refresh-dots::after {
        content: "";
        display: inline-block;
        width: 24px;
        text-align: left;
        animation: aresTvRefreshDots 1.4s infinite;
      }

      @keyframes aresTvRefreshSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes aresTvRefreshDots {
        0% { content: ""; }
        25% { content: "."; }
        50% { content: ".."; }
        75% { content: "..."; }
        100% { content: ""; }
      }
    `;

    indicator = document.createElement("div");
    indicator.id = "aresTvRefreshBuffering";
    indicator.className = "hidden";
    indicator.innerHTML =
      '<span class="ares-tv-refresh-spinner"></span>' +
      '<span>Flux instable wait<span class="ares-tv-refresh-dots"></span></span>';

    document.head.appendChild(style);
    document.body.appendChild(indicator);

    return indicator;
  }

  function showBufferingMessage() {
    const indicator = ensureBufferingIndicator();

    clearTimeout(bufferingTimer);

    bufferingTimer = setTimeout(function () {
      indicator.classList.remove("hidden");
    }, 400);
  }

  function hideBufferingMessage() {
    clearTimeout(bufferingTimer);

    const indicator = document.querySelector("#aresTvRefreshBuffering");

    if (indicator) {
      indicator.classList.add("hidden");
    }
  }

  function clearPlaybackWatchdog() {
    if (startupWatchdog) {
      clearTimeout(startupWatchdog);
      startupWatchdog = null;
    }
  }

  function startPlaybackWatchdog() {
    clearPlaybackWatchdog();

    streamStarted = false;

    startupWatchdog = setTimeout(function () {
      if (streamStarted) return;

      autoRecoveryAttempts += 1;

      setStatus(
        "Flux bloqué → récupération " +
        autoRecoveryAttempts +
        "/" +
        MAX_AUTO_RECOVERY_ATTEMPTS
      );

      showBufferingMessage();

      if (autoRecoveryAttempts <= MAX_AUTO_RECOVERY_ATTEMPTS) {
        refreshCurrentChannel(true);
      } else {
        setStatus("Flux indisponible");
      }
    }, STARTUP_WATCHDOG_MS);
  }

  function markStreamStarted() {
    streamStarted = true;
    autoRecoveryAttempts = 0;

    clearPlaybackWatchdog();
    hideBufferingMessage();
    setStatus("Live");
  }

  function playHlsDirect(url) {
    const directUrl = normalizeUrl(url);
    const video = getVideoElement();

    if (!video || !directUrl) {
      setStatus("Player introuvable");
      return;
    }

    hideIframeOverlayIfPresent();
    hideBufferingMessage();
    destroyExistingMediaEngines();
    startPlaybackWatchdog();

    video.pause();
    video.removeAttribute("src");
    video.load();

    video.muted = false;
    video.volume = 1;

    if (window.Hls && Hls.isSupported()) {
      currentHls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30
      });

      currentHls.loadSource(directUrl);
      currentHls.attachMedia(video);

      currentHls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(function () {
          setStatus("Autoplay bloqué");
        });
      });

      currentHls.on(Hls.Events.ERROR, function (event, data) {
        if (data && data.fatal) {
          showBufferingMessage();
          setStatus("Erreur HLS → nouvelle recherche");

          if (autoRecoveryAttempts < MAX_AUTO_RECOVERY_ATTEMPTS) {
            autoRecoveryAttempts += 1;
            refreshCurrentChannel(true);
          }
        }
      });

      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = directUrl;

      video.play().catch(function () {
        setStatus("Autoplay bloqué");
      });

      return;
    }

    clearPlaybackWatchdog();
    setStatus("HLS non supporté");
  }

  async function refreshCurrentChannel(forceReplay) {
    if (!currentChannel || isRefreshing) return;

    isRefreshing = true;

    try {
      setStatus("Recherche flux...");

      const directUrl = await fetchJsonAndFindM3u8(currentChannel);

      if (forceReplay || directUrl !== lastPlayedUrl) {
        lastPlayedUrl = directUrl;
        playHlsDirect(directUrl);
      }

      setStatus("Flux chargé");
    } catch (error) {
      console.error("[Ares TV Refresh Bridge]", error);

      if (autoRecoveryAttempts < MAX_AUTO_RECOVERY_ATTEMPTS) {
        autoRecoveryAttempts += 1;

        setTimeout(function () {
          refreshCurrentChannel(true);
        }, 1200);
      } else {
        setStatus("Erreur flux");
      }
    } finally {
      isRefreshing = false;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    refreshTimer = setInterval(function () {
      autoRecoveryAttempts = 0;
      refreshCurrentChannel(true);
    }, REFRESH_INTERVAL_MINUTES * 60 * 1000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }

    clearPlaybackWatchdog();
  }

  function attachVideoWatchers() {
    const video = getVideoElement();

    if (!video || video.dataset.aresTvRefreshAttached === "1") return;

    video.dataset.aresTvRefreshAttached = "1";

    video.addEventListener("playing", markStreamStarted);
    video.addEventListener("canplay", markStreamStarted);
    video.addEventListener("canplaythrough", markStreamStarted);
    video.addEventListener("loadeddata", markStreamStarted);

    video.addEventListener("waiting", showBufferingMessage);
    video.addEventListener("stalled", showBufferingMessage);
    video.addEventListener("seeking", showBufferingMessage);

    video.addEventListener("error", function () {
      showBufferingMessage();
      clearPlaybackWatchdog();

      if (currentChannel && autoRecoveryAttempts < MAX_AUTO_RECOVERY_ATTEMPTS) {
        autoRecoveryAttempts += 1;
        refreshCurrentChannel(true);
      }
    });
  }

  function openRefreshChannel(channel) {
    if (!channel) return;

    currentChannel = channel;
    lastPlayedUrl = "";
    autoRecoveryAttempts = 0;

    attachVideoWatchers();

    refreshCurrentChannel(true);
    startAutoRefresh();
  }

  function patchPlayUrl() {
    if (window.__aresTvRefreshBridgePatched) return;

    if (typeof window.playUrl !== "function") {
      setTimeout(patchPlayUrl, 200);
      return;
    }

    originalPlayUrl = window.playUrl;

    window.playUrl = function patchedPlayUrl(entry) {
      if (isRefreshChannel(entry)) {
        openRefreshChannel(entry);
        return;
      }

      if (currentChannel) {
        currentChannel = null;
        lastPlayedUrl = "";
        stopAutoRefresh();
        hideBufferingMessage();

        if (currentHls) {
          try { currentHls.destroy(); } catch {}
          currentHls = null;
        }
      }

      return originalPlayUrl.apply(this, arguments);
    };

    window.__aresTvRefreshBridgePatched = true;
    log("playUrl intercepté");
  }

  window.TVRefreshBridge = {
    open: openRefreshChannel,

    refresh: function () {
      autoRecoveryAttempts = 0;
      return refreshCurrentChannel(true);
    },

    stop: function () {
      stopAutoRefresh();

      if (currentHls) {
        try { currentHls.destroy(); } catch {}
        currentHls = null;
      }

      currentChannel = null;
      lastPlayedUrl = "";
      hideBufferingMessage();
    }
  };

  window.addEventListener("load", function () {
    attachVideoWatchers();
    patchPlayUrl();
  });

  patchPlayUrl();

  log("Bridge chargé");
})();
