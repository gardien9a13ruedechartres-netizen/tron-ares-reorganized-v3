const fs = require("fs");
const path = require("path");

console.log("Script démarré...");

const ROOT_DIR = "D:\\UsersData\\victo\\Downloads\\tron-ares-reorganized-v3";
const LOG_FILE = path.join(ROOT_DIR, "log.txt");

fs.appendFileSync(
  LOG_FILE,
  "[" + new Date().toLocaleString() + "] Script exécuté\n"
);

const JSON_URL = "https://livewatch.top/api/tvvoo/stream?channel=CM%20TV&countries=pt.json";
const BASE_DOMAIN = "https://livewatch.top";
const OUTPUT_HTML = path.join(ROOT_DIR, "pages", "player-hls.html");

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

function createHtml(streamUrl) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Player HLS</title>
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
  </style>
</head>
<body>

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
});

video.addEventListener("stalled", function () {
  console.warn("Flux bloqué/stalled.");
  invisibleReload("stalled");
});

video.addEventListener("error", function () {
  console.error("Erreur vidéo native :", video.error);
  invisibleReload("video-error");
});

video.addEventListener("playing", function () {
  lastProgressAt = Date.now();
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

async function main() {
  try {
    console.log("Récupération du JSON...");

    const response = await fetch(JSON_URL, {
      cache: "no-store"
    });

    console.log("Statut HTTP :", response.status);

    if (!response.ok) {
      throw new Error("Erreur HTTP " + response.status);
    }

    const json = await response.json();

    console.log("JSON reçu.");

    const extractedUrl = findStreamUrl(json);

    if (!extractedUrl) {
      console.log(JSON.stringify(json, null, 2));
      throw new Error("Aucune URL .m3u8 trouvée dans le JSON.");
    }

    const finalUrl = normalizeUrl(extractedUrl);

    console.log("URL extraite :", extractedUrl);
    console.log("URL finale :", finalUrl);

    const outputDir = path.dirname(OUTPUT_HTML);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_HTML, createHtml(finalUrl), "utf8");

    console.log("Fichier HTML remplacé avec succès :");
    console.log(OUTPUT_HTML);

  } catch (error) {
    console.error("Erreur :", error);

    fs.appendFileSync(
      LOG_FILE,
      "[" + new Date().toLocaleString() + "] Erreur : " + error.message + "\n"
    );
  }
}

main();
