# Surveillance des hôtes de flux

Ce Worker séparé contrôle toutes les cinq minutes les deux API JSON du lecteur Vercel :

- `api/stream?channel=cmtvpt` (base actuelle : `simple.amazingtier.top`)
- `api/wideiptv?channel=btv1` (base actuelle : `ds164.bluetier.top`)

Il compare uniquement le hostname de `url`. Les jetons de lecture ne sont ni conservés dans KV, ni inclus dans les journaux ou les alertes. Les erreurs de l’API Vercel créent aussi une alerte de diagnostic, mais ne permettent pas de connaître un nouvel hôte si l’API refuse déjà de le renvoyer.

Le Worker ne modifie aucun fichier, dépôt GitHub, configuration Vercel ou Worker de lecture. Les changements détectés restent dans l’état KV et sont inscrits dans les journaux Cloudflare. Si `ALERT_WEBHOOK_URL` est configuré comme secret, les alertes en attente sont envoyées en JSON à cette destination; sinon elles restent visibles sur `/status` et dans les journaux.

## Mise en service

1. Se connecter au bon compte Cloudflare, celui qui héberge `tron-ares-livewatch-smart.victor-salema-53d.workers.dev`.
2. Créer un namespace Workers KV et remplacer `REPLACE_WITH_KV_NAMESPACE_ID` dans `wrangler-monitor.toml` par son identifiant.
3. Configurer `ALERT_WEBHOOK_URL` comme secret si une notification externe est souhaitée.
4. Lancer les tests avec `node --test monitor/worker.test.mjs`.
5. Déployer le Worker séparé avec Wrangler et vérifier `/healthz`, `/status` ainsi que la présence du déclencheur cron dans le tableau Cloudflare.

L’archive de restauration préalable à ce brouillon est dans `C:\Users\victo\Documents\Codex\backups\tron-ares-reorganized-v3-20260924-115624\source-main-1d8292d.zip`. Aucun déploiement n’a encore été fait. Le compte Cloudflare actuellement connecté ne montre aucun Worker et son sous-domaine ne correspond pas au Worker cible; Wrangler n’est pas authentifié.
