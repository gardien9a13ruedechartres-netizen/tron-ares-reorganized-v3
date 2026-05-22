export default {
  async fetch(request) {
    const url = new URL(request.url);

    // URL cible par défaut
    const defaultIframeUrl =
      "https://livewatch.top/?action=embed&id=3860888136d301b247640b";

    // Optionnel : tu peux passer ?src=https://...
    // Le Worker n'essaie pas de contourner les protections iframe du site cible.
    const src = url.searchParams.get("src") || defaultIframeUrl;

    if (!src.startsWith("https://")) {
      return new Response("URL invalide : seule une URL HTTPS est acceptée.", {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lecteur iframe</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }

    iframe {
      width: 100vw;
      height: 100vh;
      border: 0;
      display: block;
      background: #000;
    }
  </style>
</head>
<body>
  <iframe
    src="${escapeHtml(src)}"
    allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
    allowfullscreen
    referrerpolicy="no-referrer">
  </iframe>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
};

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
