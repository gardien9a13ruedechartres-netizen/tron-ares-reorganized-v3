const fs = require("fs");
const path = require("path");

console.log("Générateur multi-chaînes démarré...");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_FILE = path.join(ROOT_DIR, "config", "channels.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "pages", "players");
const LOG_FILE = path.join(ROOT_DIR, "log.txt");
const LAST_STREAMS_FILE = path.join(ROOT_DIR, "config", "last-streams.json");
const BASE_DOMAIN = "https://livewatch.top";

function writeLog(message) {
  const line = "[" + new Date().toLocaleString() + "] " + message + "\n";
  fs.appendFileSync(LOG_FILE, line, "utf8");
}

function readLastStreams() {
  try {
    if (!fs.existsSync(LAST_STREAMS_FILE)) {
      return {};
    }

    const raw = fs.readFileSync(LAST_STREAMS_FILE, "utf8").trim();

    if (!raw) {
      return {};
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Impossible de lire last-streams.json :", error.message);
    return {};
  }
}

function writeLastStreams(streams) {
  const directory = path.dirname(LAST_STREAMS_FILE);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(
    LAST_STREAMS_FILE,
    JSON.stringify(streams, null, 2) + "\n",
    "utf8"
  );
}

function writeChangedFlag(hasChanges) {
  const githubOutput = process.env.GITHUB_OUTPUT;

  if (githubOutput) {
    fs.appendFileSync(
      githubOutput,
      "changed=" + (hasChanges ? "true" : "false") + "\n",
      "utf8"
    );
  }
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
      background:
        radial-gradient(circle at center, rgba(255,255,255,0.045), rgba(0,0,0,0.94) 48%, #000 100%);
      opacity: 1;
      visibility: visible;
      transition: opacity 0.45s ease, visibility 0.45s ease;
      pointer-events: none;
    }

    #loadingOverlay.hidden {
      opacity: 0;
      visibility: hidden;
    }

    .premiumLoader {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.16);
      border-top-color: rgba(255, 255, 255, 0.95);
      border-right-color: rgba(255, 255, 255, 0.50);
      animation: premiumSpin 0.95s linear infinite;
      filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.16));
    }

    .premiumLoader::after {
      content: "";
      position: absolute;
      inset: 11px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.10);
    }

    @keyframes premiumSpin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
</head>
<body>

<video id="video" autoplay playsinline controls></video>

<div id="loadingOverlay" aria-hidden="true">
  <div class="premiumLoader"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<script>
const streamUrl = ${JSON.stringify(streamUrl)};

const video = document.getElementById("video");
const loadingOverlay = document.getElementById("loadingOverlay");

video.muted = false;
video.volume = 1;

function showLoader() {
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
  showLoader();

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
  showLoader();

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
      showLoader();
      invisibleReload("absence-flux-ou-moulinage");
    }
  }, HEALTH_CHECK_INTERVAL);
}

video.addEventListener("waiting", function () {
  console.warn("Vidéo en attente de données...");
  showLoader();
});

video.addEventListener("stalled", function () {
  console.warn("Flux bloqué/stalled.");
  showLoader();
  invisibleReload("stalled");
});

video.addEventListener("error", function () {
  console.error("Erreur vidéo native :", video.error);
  showLoader();
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

async function generateChannel(channel, lastStreams, nextStreams) {
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
  const previousUrl = lastStreams[slug] || null;
  const outputFile = path.join(OUTPUT_DIR, slug + ".html");
  const playerExists = fs.existsSync(outputFile);
  const hasChanged = previousUrl !== finalUrl || !playerExists;

  nextStreams[slug] = finalUrl;

  console.log("URL finale :", finalUrl);

  if (!hasChanged) {
    console.log("Aucun changement :", slug);
    writeLog("Aucun changement : " + slug);
    return false;
  }

  fs.writeFileSync(outputFile, createHtml(channel, finalUrl), "utf8");

  if (!playerExists) {
    console.log("Nouveau player généré :", outputFile);
    writeLog("Nouveau player généré : " + slug);
  } else {
    console.log("Player mis à jour :", outputFile);
    writeLog("Player mis à jour : " + slug);
  }

  return true;
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

    const lastStreams = readLastStreams();
    const nextStreams = {};

    let successCount = 0;
    let errorCount = 0;
    let changedCount = 0;

    for (const channel of channels) {
      try {
        const changed = await generateChannel(channel, lastStreams, nextStreams);
        successCount += 1;

        if (changed) {
          changedCount += 1;
        }
      } catch (error) {
        errorCount += 1;
        console.error("Erreur chaîne :", error.message);
        writeLog("Erreur chaîne : " + error.message);
      }
    }

    if (successCount > 0) {
      writeLastStreams(nextStreams);
    }

    const hasChanges = changedCount > 0;

    writeChangedFlag(hasChanges);

    console.log("");
    console.log("Génération terminée.");
    console.log("Succès :", successCount);
    console.log("Erreurs :", errorCount);
    console.log("Players modifiés :", changedCount);

    if (!hasChanges) {
      console.log("Aucun changement détecté. Déploiement Cloudflare inutile.");
    }

    writeLog(
      "Génération terminée. Succès=" +
      successCount +
      " Erreurs=" +
      errorCount +
      " Changements=" +
      changedCount
    );

  } catch (error) {
    writeChangedFlag(false);
    console.error("Erreur générale :", error.message);
    writeLog("Erreur générale : " + error.message);
    process.exitCode = 1;
  }
}

main();
