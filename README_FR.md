# Auto Git → GitHub → Cloudflare Pages teste

Ce dossier contient un petit automatisme local :

1. il surveille ton dossier Git ;
2. il détecte les changements ;
3. il lance un shell de déploiement ;
4. il fait `git add`, `git commit`, puis `git push` ;
5. Cloudflare Pages déploie automatiquement grâce à l’intégration GitHub.

## Pré-requis

- Node.js 20 ou plus récent
- Git installé
- Ton projet doit déjà être un dépôt Git
- Ton dépôt doit déjà avoir un remote GitHub nommé `origin`
- Cloudflare Pages doit être connecté à ton dépôt GitHub

## Installation

Copie ces fichiers à la racine de ton projet, puis lance :

```bash
npm install
```

Copie ensuite le fichier d’exemple :

```bash
cp .env.example .env
```

Sur Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

## Configuration

Ouvre `.env` et adapte si besoin :

```env
GIT_BRANCH=main
COMMIT_PREFIX=auto deploy
DEBOUNCE_MS=2500
OPEN_NEW_SHELL=true
IGNORE_PATTERNS=node_modules,.git,dist,build,.next,.nuxt,.wrangler,.cache
```

- `GIT_BRANCH` : la branche qui déclenche Cloudflare Pages, souvent `main`.
- `OPEN_NEW_SHELL=true` : ouvre un nouveau terminal pour le déploiement.
- `OPEN_NEW_SHELL=false` : exécute le déploiement dans le terminal actuel.

## Lancement

Depuis la racine du projet :

```bash
npm run start
```

Ensuite, dès qu’un fichier change, le script attend quelques secondes, puis déploie.

## Tester une seule fois

```bash
npm run deploy:once
```

## Important

Cloudflare Pages déploie automatiquement seulement si ton projet Pages est connecté au dépôt GitHub et à la bonne branche.

Si tu as configuré Cloudflare Pages sur `main`, alors `GIT_BRANCH=main`.
Si tu as configuré Cloudflare Pages sur `master`, alors `GIT_BRANCH=master`.
