const fs = require("fs");
const path = require("path");

console.log("Générateur multi-chaînes démarré...");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_FILE = path.join(ROOT_DIR, "config", "channels.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "pages", "players");
const LOG_FILE = path.join(ROOT_DIR, "log.txt");
const BASE_DOMAIN = "https://livewatch.top";

function writeLog(message) {
  const line = "[" + new Date().toLocaleString() + "] " + message + "\n";
  fs.appendFileSync(LOG_FILE, line, "utf8");
}

function normalizeUrl(url) {
  const cleanUrl = String(url || "").trim();

  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    return cleanUrl;
  }

  if (cleanUrl.startsWith("/")) {
    return BASE_DOMAIN + cleanUrl;
  }

  return BASE_DOMAIN + "/" + cleanUrl;
}

function findStreamUrl(data) {
  if (typeof data === "string") {
    if (data.includes(".m3u8") || data.includes("api/proxy")) {
      return data;
    }
    return null;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findStreamUrl(item);
      if (found) return found;
    }
  }

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      const found = findStreamUrl(value);
      if (found) return found;
    }
  }

  return null;
}

function sanitizeSlug(slug) {
  return String(slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createHtml(channel, streamUrl) {
  const title = escapeHtml(channel.name || channel.slug || "Player HLS");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }

    #video {
      width: 100vw;
      height: 100vh;
      object-fit: fill;
      background: #000;
    }
  
      #loadingOverlay {
        position: fixed;
        inset: 0;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        transition: opacity 0.35s ease;
      }

      #loadingOverlay.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .premiumLoader {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: 4px solid rgba(255,255,255,0.12);
        border-top: 4px solid #ffffff;
        border-right: 4px solid rgba(255,255,255,0.7);
        animation: premiumSpin 0.9s linear infinite;
        box-shadow:
          0 0 12px rgba(255,255,255,0.08),
          0 0 30px rgba(255,255,255,0.05);
      }

      @keyframes premiumSpin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

    </style>
</head>
<body>

<div id="loadingOverlay">
  <div class="premiumLoader"></div>
</div>


<video id="video" autoplay playsinline controls></video>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<script>
const streamUrl = ${JSON.stringify(streamUrl)};

const video = document.getElementById("video");

video.muted = false;
video.volume = 1;

let hls = null;
let reloadTimer = null;
let healthTimer = null;
let lastTime = 0;
let lastProgressAt = Date.now();
let reloadCount = 0;

const HEALTH_CHECK_INTERVAL = 5000;
const NO_PROGRESS_LIMIT = 18000;
const RELOAD_COOLDOWN = 7000;
const HARD_REFRESH_AFTER = 5;

function safePlay() {
  video.play().catch(function (error) {
    console.error("Autoplay bloqué :", error);
  });
}

function destroyHls() {
  if (hls) {
    try {
      hls.destroy();
    } catch (error) {
      console.error("Erreur destruction HLS :", error);
    }
    hls = null;
  }
}

function attachNativePlayer() {
  video.src = streamUrl;
  video.load();

  video.addEventListener("loadedmetadata", function () {
    safePlay();
  }, { once: true });
}


function getHlsResponseStatus(data) {
  if (!data) {
    return 0;
  }

  if (data.response && typeof data.response.code === "number") {
    return data.response.code;
  }

  if (data.networkDetails && typeof data.networkDetails.status === "number") {
    return data.networkDetails.status;
  }

  return 0;
}

function isExpiredStreamError(data) {
  const status = getHlsResponseStatus(data);
  return status === 410 || status === 403 || status === 404;
}

function attachHlsPlayer() {
  destroyHls();

  hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 8,
    maxBufferLength: 20,
    maxMaxBufferLength: 30,
    backBufferLength: 30,
    fragLoadingTimeOut: 20000,
    manifestLoadingTimeOut: 20000,
    levelLoadingTimeOut: 20000
  });

  hls.loadSource(streamUrl);
  hls.attachMedia(video);

  hls.on(Hls.Events.MANIFEST_PARSED, function () {
    safePlay();
  });

  hls.on(Hls.Events.FRAG_LOADED, function () {
    lastProgressAt = Date.now();
  });

  hls.on(Hls.Events.LEVEL_LOADED, function () {
    lastProgressAt = Date.now();
  });

  hls.on(Hls.Events.ERROR, function (event, data) {
    console.error("Erreur HLS :", data);

    try {
      logEvent(
        "HLS_ERROR",
        JSON.stringify({
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          status: getHlsResponseStatus(data)
        })
      );
    } catch (error) {
      console.error("Erreur monitoring HLS :", error);
    }

    if (isExpiredStreamError(data)) {
      logEvent(
        "EXPIRED_STREAM_HTTP",
        "status=" + getHlsResponseStatus(data)
      );
      hardReloadPage("expired-http-" + getHlsResponseStatus(data));
      return;
    }

    if (!data || !data.fatal) {
      return;
    }

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      invisibleReload("network-error");
      return;
    }

    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      try {
        hls.recoverMediaError();
      } catch (error) {
        invisibleReload("media-error");
      }
      return;
    }

    invisibleReload("fatal-error");
  });
}


function logEvent(type, details = "") {
  const timestamp = new Date().toISOString();

  console.log(
    "[" + timestamp + "]",
    "[" + ${JSON.stringify(channel.slug || "unknown")} + "]",
    type,
    details
  );
}

let bufferingStartedAt = null;
let bufferingCount = 0;
let reloadStats = 0;

function saveMonitoringStats() {
  try {
    const stats = {
      bufferingCount,
      reloadStats,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(
      "player-monitor-" + ${JSON.stringify(channel.slug || "unknown")},
      JSON.stringify(stats)
    );
  } catch (error) {
    console.error("Impossible de sauvegarder les stats :", error);
  }
}


    function hideLoadingOverlay() {
      const overlay = document.getElementById("loadingOverlay");

      if (!overlay) {
        return;
      }

      overlay.classList.add("hidden");

      setTimeout(function () {
        overlay.remove();
      }, 400);
    }


    function initPlayer() {
  lastTime = 0;
  lastProgressAt = Date.now();

  if (Hls.isSupported()) {
    attachHlsPlayer();
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    attachNativePlayer();
  } else {
    console.error("HLS non supporté.");
  }
}

function invisibleReload(reason) {
  if (reloadTimer) {
    return;
  }

  console.warn("Reload invisible du player :", reason);

  reloadTimer = setTimeout(function () {
    reloadTimer = null;
    reloadCount += 1;
    reloadStats += 1;
    saveMonitoringStats();

    const currentMuted = video.muted;
    const currentVolume = video.volume;

    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch (error) {
      console.error("Erreur reset vidéo :", error);
    }

    destroyHls();

    video.muted = currentMuted;
    video.volume = currentVolume;

    initPlayer();

    if (reloadCount >= HARD_REFRESH_AFTER) {
      reloadCount = 0;
      setTimeout(function () {
        window.location.reload();
      }, 2000);
    }
  }, RELOAD_COOLDOWN);
}

function startHealthMonitor() {
  clearInterval(healthTimer);

  healthTimer = setInterval(function () {
    const currentTime = video.currentTime || 0;
    const now = Date.now();

    if (!video.paused && !video.ended && currentTime > lastTime) {
      lastTime = currentTime;
      lastProgressAt = now;
      return;
    }

    const noProgressFor = now - lastProgressAt;

    const seemsStuck =
      !video.paused &&
      !video.ended &&
      noProgressFor > NO_PROGRESS_LIMIT;

    const noEnoughData =
      video.readyState < 2 &&
      noProgressFor > NO_PROGRESS_LIMIT;

    if (seemsStuck || noEnoughData) {
      invisibleReload("absence-flux-ou-moulinage");
    }
  }, HEALTH_CHECK_INTERVAL);
}

video.addEventListener("waiting", function () {
  console.warn("Vidéo en attente de données...");
  bufferingStartedAt = Date.now();
  bufferingCount += 1;
  saveMonitoringStats();
  logEvent("BUFFERING_START");
});

video.addEventListener("stalled", function () {
  console.warn("Flux bloqué/stalled.");
  logEvent("STALLED");
  invisibleReload("stalled");
});

video.addEventListener("error", function () {
  console.error("Erreur vidéo native :", video.error);
  logEvent("VIDEO_ERROR");
  invisibleReload("video-error");
});

video.addEventListener("canplay", function () {
      hideLoadingOverlay();
    });

    video.addEventListener("playing", function () {
  lastProgressAt = Date.now();

  if (bufferingStartedAt) {
    const duration = Math.round(
      (Date.now() - bufferingStartedAt) / 1000
    );

    logEvent(
      "BUFFERING_END",
      duration + "s"
    );

    bufferingStartedAt = null;
  }

  logEvent("PLAYING");

      hideLoadingOverlay();
});

video.addEventListener("timeupdate", function () {
  lastProgressAt = Date.now();
  lastTime = video.currentTime || 0;
});

initPlayer();
startHealthMonitor();

window.addEventListener("beforeunload", function () {
  clearInterval(healthTimer);
  clearTimeout(reloadTimer);
  destroyHls();
});
</script>

</body>
</html>`;
}

async function generateChannel(channel) {
  const slug = sanitizeSlug(channel.slug);

  if (!slug) {
    throw new Error("Chaîne sans slug valide : " + JSON.stringify(channel));
  }

  if (!channel.jsonUrl) {
    throw new Error("Chaîne sans jsonUrl : " + slug);
  }

  console.log("");
  console.log("Chaîne :", channel.name || slug);
  console.log("Slug :", slug);
  console.log("JSON :", channel.jsonUrl);

  const response = await fetch(channel.jsonUrl, {
    cache: "no-store"
  });

  console.log("Statut HTTP :", response.status);

  if (!response.ok) {
    throw new Error("Erreur HTTP " + response.status + " pour " + slug);
  }

  const json = await response.json();
  const extractedUrl = findStreamUrl(json);

  if (!extractedUrl) {
    throw new Error("Aucune URL .m3u8 trouvée pour " + slug);
  }

  const finalUrl = normalizeUrl(extractedUrl);
  const outputFile = path.join(OUTPUT_DIR, slug + ".html");

  fs.writeFileSync(outputFile, createHtml(channel, finalUrl), "utf8");

  console.log("URL finale :", finalUrl);
  console.log("Player généré :", outputFile);

  writeLog("Player généré : " + slug);
}

async function main() {
  try {
    writeLog("Générateur multi-chaînes exécuté");

    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error("Fichier introuvable : " + CONFIG_FILE);
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const channels = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));

    if (!Array.isArray(channels)) {
      throw new Error("channels.json doit contenir un tableau JSON.");
    }

    console.log("Nombre de chaînes :", channels.length);

    let successCount = 0;
    let errorCount = 0;

    for (const channel of channels) {
      try {
        await generateChannel(channel);
        successCount += 1;
      } catch (error) {
        errorCount += 1;
        console.error("Erreur chaîne :", error.message);
        writeLog("Erreur chaîne : " + error.message);
      }
    }

    console.log("");
    console.log("Génération terminée.");
    console.log("Succès :", successCount);
    console.log("Erreurs :", errorCount);

    writeLog("Génération terminée. Succès=" + successCount + " Erreurs=" + errorCount);

  } catch (error) {
    console.error("Erreur générale :", error.message);
    writeLog("Erreur générale : " + error.message);
    process.exitCode = 1;
  }
}

main();
