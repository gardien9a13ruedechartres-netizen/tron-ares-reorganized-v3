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
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      object-fit: fill;
      background: #000;
      z-index: 1;
    }

    #loadingOverlay {
      position: fixed;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 18px;
      background: #000;
      color: #fff;
      font-family: Arial, Helvetica, sans-serif;
      opacity: 1;
      visibility: visible;
      transition: opacity 0.35s ease, visibility 0.35s ease;
      pointer-events: none;
    }

    #loadingOverlay.hidden {
      opacity: 0;
      visibility: hidden;
    }

    .loaderRing {
      position: relative;
      width: 118px;
      height: 118px;
      border-radius: 50%;
      background:
        conic-gradient(from 0deg, #00d8ff 0deg, #00a7ff 88deg, transparent 92deg, transparent 360deg);
      animation: spin 1.15s linear infinite;
    }

    .loaderRing::before {
      content: "";
      position: absolute;
      inset: 7px;
      border-radius: 50%;
      background: #000;
      box-shadow: inset 0 0 0 6px rgba(255,255,255,0.10);
    }

    .loaderBars {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }

    .loaderBars span {
      width: 7px;
      height: 34px;
      border-radius: 999px;
      background: #00d8ff;
      box-shadow: 0 0 14px rgba(0,216,255,0.55);
      animation: pulse 0.95s ease-in-out infinite;
    }

    .loaderBars span:nth-child(2) {
      animation-delay: 0.10s;
      height: 44px;
    }

    .loaderBars span:nth-child(3) {
      animation-delay: 0.20s;
      height: 54px;
    }

    .loaderBars span:nth-child(4) {
      animation-delay: 0.30s;
      height: 44px;
    }

    .loaderBars span:nth-child(5) {
      animation-delay: 0.40s;
      height: 34px;
    }

    #loadingText {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.2px;
      text-shadow: 0 0 18px rgba(0, 216, 255, 0.28);
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes pulse {
      0%, 100% {
        transform: scaleY(0.62);
        opacity: 0.55;
      }
      50% {
        transform: scaleY(1);
        opacity: 1;
      }
    }
  </style>
</head>
<body>

<video id="video" autoplay playsinline controls></video>

<div id="loadingOverlay" aria-live="polite">
  <div class="loaderRing">
    <div class="loaderBars">
      <span></span>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
  <div id="loadingText">Chargement du flux...</div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<script>
const streamUrl = ${JSON.stringify(streamUrl)};

const video = document.getElementById("video");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");

video.muted = false;
video.volume = 1;

function showLoader(message) {
  if (loadingText && message) {
    loadingText.textContent = message;
  }

  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden");
  }
}

function hideLoader() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }
}

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

function initPlayer() {
  lastTime = 0;
  lastProgressAt = Date.now();
  showLoader("Chargement du flux...");

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
  showLoader("Reconnexion au flux...");

  reloadTimer = setTimeout(function () {
    reloadTimer = null;
    reloadCount += 1;

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
      showLoader("Reconnexion au flux...");
      invisibleReload("absence-flux-ou-moulinage");
    }
  }, HEALTH_CHECK_INTERVAL);
}

video.addEventListener("waiting", function () {
  console.warn("Vidéo en attente de données...");
  showLoader("Chargement du flux...");
});

video.addEventListener("stalled", function () {
  console.warn("Flux bloqué/stalled.");
  showLoader("Reconnexion au flux...");
  invisibleReload("stalled");
});

video.addEventListener("error", function () {
  console.error("Erreur vidéo native :", video.error);
  showLoader("Reconnexion au flux...");
  invisibleReload("video-error");
});

video.addEventListener("playing", function () {
  lastProgressAt = Date.now();
  hideLoader();
});

video.addEventListener("canplay", function () {
  hideLoader();
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
