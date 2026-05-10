const fs = require("fs");
const path = require("path");

console.log("Script démarré...");
const LOG_FILE =
  "D:\\UsersData\\victo\\Downloads\\tron-ares-reorganized-v3\\log.txt";

fs.appendFileSync(
  LOG_FILE,
  "[" + new Date().toLocaleString() + "] Script exécuté\n"
);

const JSON_URL = "https://livewatch.top/api/tvvoo/stream?channel=CM%20TV&countries=pt.json";
const BASE_DOMAIN = "https://livewatch.top";
const OUTPUT_HTML = "D:\\UsersData\\victo\\Downloads\\tron-ares-reorganized-v3\\pages\\player-hls.html";

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

video.setAttribute("src", streamUrl);
video.muted = false;
video.volume = 1;

if (Hls.isSupported()) {
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true
  });

  hls.loadSource(streamUrl);
  hls.attachMedia(video);

  hls.on(Hls.Events.MANIFEST_PARSED, function () {
    video.play().catch(function (error) {
      console.error("Autoplay bloqué :", error);
    });
  });

  hls.on(Hls.Events.ERROR, function (event, data) {
    console.error("Erreur HLS :", data);
  });

} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = streamUrl;

  video.addEventListener("loadedmetadata", function () {
    video.play().catch(function (error) {
      console.error("Autoplay bloqué :", error);
    });
  });
} else {
  console.error("HLS non supporté.");
}
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
  }
}

main();