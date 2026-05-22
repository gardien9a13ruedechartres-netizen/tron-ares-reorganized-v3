# Worker iframe

Ce Worker Cloudflare sert une page HTML contenant une iframe.

URL intégrée par défaut :
https://livewatch.top/?action=embed&id=3860888136d301b247640b

## Utilisation

1. Crée un Worker Cloudflare.
2. Colle le contenu de `worker.js`.
3. Déploie.
4. Ouvre l’URL du Worker.

Tu peux aussi passer une autre URL HTTPS :

https://ton-worker.workers.dev/?src=https://exemple.com/embed

Important :
ce Worker ne contourne pas les protections du site cible.
Si le site bloque l’affichage en iframe avec CSP ou X-Frame-Options, le navigateur le bloquera quand même.
