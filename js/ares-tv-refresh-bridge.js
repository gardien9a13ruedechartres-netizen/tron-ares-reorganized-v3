/*
  Ares TV Refresh Bridge - JSON Watchdog Mode v2
  À charger après tron-ares.js.

  Utilisation recommandée dans tes chaînes :
  {
    "name": "CM TV",
    "type": "tv-refresh",
    "jsonUrl": "https://tv-channel-refresh.victor-salema-53d.workers.dev/?channel=CM%20TV&countries=pt.json"
  }

  Important :
  - Ne pas utiliser /hls.m3u8 dans le JSON des chaînes.
  - Le bridge fait fetch(jsonUrl), trouve le .m3u8, puis lance seulement le .m3u8.
*/

(function () {
  "use strict";

  const DEFAULT_DOMAIN = "https://livewatch.top";
  const REFRESH_INTERVAL_MINUTES = 30;
  const STARTUP_WATCHDOG_MS = 12000;
  const MAX_AUTO_RECOVERY_ATTEMPTS = 3;

  let refreshTimer = null;
  let currentChannel = null;
  let currentHls = null;
  let lastPlayedUrl = "";
  let isRefreshing = false;

  let startupWatchdog = null;
  let streamStarted = false;
  let autoRecoveryAttempts = 0;
  let bufferingTimer = null;

  function log() {
    console.log.apply(console, ["[Ares TV Refresh]"].concat(Array.from(arguments)));
  }

  function normalizeUrl(url) {
    let cleanUrl = String(url || "").trim();

    if (!cleanUrl) return "";

    if (cleanUrl.startsWith("//")) {
      cleanUrl = "https:" + cleanUrl;
    }

    if (cleanUrl.startsWith("/")) {
      cleanUrl = DEFAULT_DOMAIN + cleanUrl;
    }

    return cleanUrl;
  }

  function getJsonUrl(channel) {
    if (!channel) return "";

    if (channel.jsonUrl) {
      return normalizeUrl(channel.jsonUrl);
    }

    if (channel.refreshUrl) {
      return normalizeUrl(channel.refreshUrl);
    }

    if (
      channel.url &&
      String(channel.url).includes("tv-channel-refresh") &&
      !String(channel.url).includes("/hls.m3u8")
    ) {
      return normalizeUrl(channel.url);
    }

    return "";
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

  function getVideoElement() {
    return (
      document.querySelector("#videoEl") ||
      document.querySelector("#videoPlayer") ||
      document.querySelector("video")
    );
  }

  function setStatus(message) {
    log(message);

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
  }

  function ensureBufferingIndicator() {
    let indicator = document.querySelector("#aresTvRefreshBuffering");

    if (indicator) return indicator;

    indicator = document.createElement("div");
    indicator.id = "aresTvRefreshBuffering";
    indicator.className = "hidden";
    indicator.innerHTML = '<span class="ares-tv-refresh-spinner"></span><span>Flux instable wait<span class="ares-tv-refresh-dots"></span></span>';

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
        background: rgba(0,0,0,.84);
        color: #f3f4f6;
        border: 1px solid rgba(255,255,255,.14);
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
        border: 3px solid rgba(255,255,255,.18);
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

  function clearPlaybackWatchdog() {
    if (startupWatchdog) {
      clearTimeout(startupWatchdog);
      startupWatchdog = null;
    }
  }

  function markStreamStarted() {
    streamStarted = true;
    autoRecoveryAttempts = 0;
    clearPlaybackWatchdog();
    hideBufferingMessage();
    setStatus("Live");
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

  async function refreshCurrentChannel(forceReplay) {
    if (!currentChannel || isRefreshing) return;

    isRefreshing = true;

    try {
      setStatus("Recherche flux...");

      const directUrl = await fetchJsonAndFindM3u8(currentChannel);

      if (forceReplay || directUrl !== lastPlayedUrl) {
        lastPlayedUrl = directUrl;
        playHls(directUrl);
      }

      setStatus("Flux chargé");
    } catch (error) {
      console.error("[Ares TV Refresh]", error);

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

  function playHls(url) {
    const directUrl = normalizeUrl(url);
    const video = getVideoElement();

    if (!video || !directUrl) {
      setStatus("Player introuvable");
      return;
    }

    hideIframeOverlayIfPresent();
    hideBufferingMessage();
    startPlaybackWatchdog();

    if (currentHls) {
      currentHls.destroy();
      currentHls = null;
    }

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

      if (autoRecoveryAttempts < MAX_AUTO_RECOVERY_ATTEMPTS) {
        autoRecoveryAttempts += 1;
        refreshCurrentChannel(true);
      }
    });
  }

  window.TVRefreshBridge = {
    async open(channel) {
      currentChannel = channel;
      lastPlayedUrl = "";
      autoRecoveryAttempts = 0;

      attachVideoWatchers();

      await refreshCurrentChannel(true);
      startAutoRefresh();
    },

    refresh() {
      autoRecoveryAttempts = 0;
      return refreshCurrentChannel(true);
    },

    stop() {
      stopAutoRefresh();

      if (currentHls) {
        currentHls.destroy();
        currentHls = null;
      }

      currentHls = null;
      currentChannel = null;
      lastPlayedUrl = "";
      hideBufferingMessage();
    }
  };

  document.addEventListener("click", function (event) {
    const item = event.target.closest("[data-tv-refresh='1']");

    if (!item) return;

    event.preventDefault();
    event.stopPropagation();

    const channel = {
      name: item.dataset.name || item.textContent.trim() || "Chaîne",
      jsonUrl: item.dataset.jsonUrl || item.dataset.url || ""
    };

    window.TVRefreshBridge.open(channel);
  }, true);

  window.addEventListener("load", attachVideoWatchers);

  log("Bridge JSON watchdog v2 chargé");
})();
