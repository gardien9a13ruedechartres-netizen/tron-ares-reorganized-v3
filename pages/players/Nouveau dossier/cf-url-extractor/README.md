# cf-url-extractor

Worker Cloudflare avec navigateur headless pour repérer une URL précise exposée par une page.

Le Worker écoute trois sources :

- les messages `console.log()` de la page ;
- les requêtes réseau ;
- les réponses réseau ;
- les URLs présentes dans le DOM après chargement.

Il renvoie ensuite les URLs trouvées au format JSON.

---

## 1. Prérequis

Installe Node.js 20+ puis vérifie :

```bash
node -v
npm -v
```

Connecte-toi à Cloudflare :

```bash
npx wrangler login
```

---

## 2. Installation

Dézippe le projet puis entre dans le dossier :

```bash
cd cf-url-extractor
npm install
```

---

## 3. Configuration Cloudflare

Le fichier `wrangler.jsonc` contient déjà le binding Browser Rendering :

```jsonc
"browser": {
  "binding": "MYBROWSER"
}
```

Il contient aussi :

```jsonc
"compatibility_flags": ["nodejs_compat"]
```

Cloudflare recommande ce flag pour utiliser Browser Run avec Puppeteer.

Option de sécurité facultative : tu peux limiter les domaines autorisés avec `ALLOW_HOSTS`.

Exemple :

```jsonc
"vars": {
  "MAX_WAIT_MS": "12000",
  "DEFAULT_CONTAINS": "https://",
  "ALLOW_HOSTS": "example.com,www.example.com"
}
```

Si `ALLOW_HOSTS` est vide, le Worker accepte les URLs HTTP/HTTPS envoyées en paramètre.

---

## 4. Tester en local distant

Browser Rendering nécessite généralement le mode distant :

```bash
npm run dev
```

Wrangler affichera une URL locale du type :

```text
http://localhost:8787
```

Teste la santé du Worker :

```bash
curl "http://localhost:8787/health"
```

---

## 5. Extraire une URL avec GET

Exemple simple :

```bash
curl "http://localhost:8787/extract?url=https://example.com&contains=https://"
```

`contains` sert de filtre. Le Worker garde seulement les URLs qui contiennent cette valeur.

Exemples :

```bash
curl "http://localhost:8787/extract?url=https://example.com&contains=.mp4"
```

```bash
curl "http://localhost:8787/extract?url=https://example.com&contains=api"
```

```bash
curl "http://localhost:8787/extract?url=https://example.com&contains=token"
```

Tu peux aussi augmenter le temps d'attente :

```bash
curl "http://localhost:8787/extract?url=https://example.com&contains=.m3u8&waitMs=20000"
```

---

## 6. Extraire une URL avec POST

```bash
curl -X POST "http://localhost:8787/extract" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://example.com",
    "contains": "https://",
    "waitMs": 12000
  }'
```

---

## 7. Déploiement

```bash
npm run deploy
```

Après déploiement, Cloudflare donnera une URL du type :

```text
https://cf-url-extractor.<ton-subdomain>.workers.dev
```

Tu pourras tester :

```bash
curl "https://cf-url-extractor.<ton-subdomain>.workers.dev/extract?url=https://example.com&contains=https://"
```

---

## 8. Format de réponse

Exemple :

```json
{
  "ok": true,
  "inputUrl": "https://example.com",
  "contains": "https://",
  "found": [
    {
      "source": "request",
      "url": "https://example.com/image.png"
    }
  ],
  "firstMatch": {
    "source": "request",
    "url": "https://example.com/image.png"
  },
  "pageTitle": "Example Domain",
  "finalUrl": "https://example.com/"
}
```

Sources possibles :

- `console` : URL trouvée dans un message de console ;
- `request` : URL vue dans une requête réseau ;
- `response` : URL vue dans une réponse réseau ;
- `page` : URL trouvée dans le DOM après chargement.

---

## 9. Limites importantes

- Le Worker ne lit pas la console de ton vrai navigateur.
- Il lance son propre navigateur headless.
- Certaines pages bloquent les navigateurs automatisés.
- Certaines URLs apparaissent seulement après connexion, cookie, captcha ou action utilisateur.
- Le plan gratuit Cloudflare peut avoir des limites d'utilisation Browser Rendering.

---

## 10. Dépannage

### `429` ou limite atteinte

Tu as probablement atteint une limite Browser Rendering de ton compte.

### `Navigation timeout`

Augmente `waitMs`, par exemple :

```bash
curl "http://localhost:8787/extract?url=https://example.com&contains=.m3u8&waitMs=25000"
```

### Aucune URL trouvée

Essaie un filtre plus large :

```bash
contains=https://
```

Puis affine avec `.mp4`, `.m3u8`, `api`, `cdn`, etc.

### Erreur de domaine refusé

Vérifie `ALLOW_HOSTS` dans `wrangler.jsonc`.

---

## 11. Structure du projet

```text
cf-url-extractor/
├── package.json
├── README.md
├── tsconfig.json
├── wrangler.jsonc
└── src/
    └── index.ts
```
