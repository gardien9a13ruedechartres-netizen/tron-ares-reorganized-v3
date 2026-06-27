'use strict';

require('dotenv').config();

const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const chokidar = require('chokidar');

const PROJECT_DIR = process.cwd();
const GIT_BRANCH = process.env.GIT_BRANCH || 'main';
const DEPLOY_MODE = process.env.DEPLOY_MODE || 'git';
const OPEN_NEW_SHELL = String(process.env.OPEN_NEW_SHELL || 'false').toLowerCase() === 'true';
const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS || 3000);
const POLLING_INTERVAL_MS = Number(process.env.POLLING_INTERVAL_MS || 1000);
const GIT_CHECK_INTERVAL_MS = Number(process.env.GIT_CHECK_INTERVAL_MS || 30000);
const LOCAL_BRIDGE_HOST = '127.0.0.1';
const LOCAL_BRIDGE_PORT = Number(process.env.LOCAL_BRIDGE_PORT || 17383);
const LOCAL_BRIDGE_OUTPUTS = new Map([
  ['/cmtvpt', path.join(PROJECT_DIR, 'pages', 'cmtvpt.html')],
  ['/rtp1', path.join(PROJECT_DIR, 'pages', 'rtp1.html')],
  ['/rtp2', path.join(PROJECT_DIR, 'pages', 'rtp2.html')],
  ['/sic', path.join(PROJECT_DIR, 'pages', 'sic.html')]
]);
const ALLOWED_EXTENSION_ORIGIN = 'chrome-extension://mkgligjoedklgioceijbjiilfknkkfok';

const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  '.wrangler',
  '.cache',
  'dist',
  'build',
  '.next',
  '.nuxt'
];

const ENV_IGNORES = (process.env.IGNORE_PATTERNS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const IGNORE_PATTERNS = Array.from(new Set([...DEFAULT_IGNORES, ...ENV_IGNORES]));

let timer = null;
let deploying = false;

function sendBridgeResponse(response, status, payload, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (origin === ALLOWED_EXTENSION_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function startLocalBridge() {
  const server = http.createServer((request, response) => {
    const origin = String(request.headers.origin || '');

    if (request.method === 'OPTIONS') {
      if (origin !== ALLOWED_EXTENSION_ORIGIN) {
        sendBridgeResponse(response, 403, { ok: false, error: 'Origin refused.' });
        return;
      }
      response.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin'
      });
      response.end();
      return;
    }

    if (
      request.method !== 'POST' ||
      !LOCAL_BRIDGE_OUTPUTS.has(request.url) ||
      origin !== ALLOWED_EXTENSION_ORIGIN
    ) {
      sendBridgeResponse(response, 403, { ok: false, error: 'Request refused.' }, origin);
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) request.destroy();
    });
    request.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const html = typeof payload.html === 'string' ? payload.html : '';
        const outputFile = LOCAL_BRIDGE_OUTPUTS.get(request.url);
        const channel = path.basename(outputFile, '.html').toUpperCase();
        if (
          !html.startsWith('<!doctype html>') ||
          !html.includes('id="hls-data"') ||
          !html.includes('/api/cmtvpt/proxy?url=')
        ) {
          sendBridgeResponse(response, 400, { ok: false, error: `Invalid ${channel} HTML.` }, origin);
          return;
        }

        await fs.mkdir(path.dirname(outputFile), { recursive: true });
        await fs.writeFile(outputFile, html, 'utf8');
        sendBridgeResponse(response, 200, {
          ok: true,
          filename: `pages/${path.basename(outputFile)}`,
          bytes: Buffer.byteLength(html, 'utf8')
        }, origin);
      } catch (error) {
        sendBridgeResponse(response, 500, {
          ok: false,
          error: String(error && error.message || error)
        }, origin);
      }
    });
  });

  server.on('error', error => {
    console.error('Erreur pont local des lecteurs :', error.message);
    if (error && error.code === 'EADDRINUSE') {
      console.error(`Une instance est deja active sur le port ${LOCAL_BRIDGE_PORT}. Cette seconde instance va s'arreter.`);
      process.exit(1);
    }
  });
  server.listen(LOCAL_BRIDGE_PORT, LOCAL_BRIDGE_HOST, () => {
    console.log(`Pont local des lecteurs : http://${LOCAL_BRIDGE_HOST}:${LOCAL_BRIDGE_PORT}/{cmtvpt,rtp1,rtp2,sic}`);
  });
}

function runGitStatus() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.error) return '';
  return (result.stdout || '').trim();
}

function hasGitChanges() {
  return runGitStatus().length > 0;
}

function scheduleDeploy(reason) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    startDeploy(reason);
  }, DEBOUNCE_MS);
}

function startDeploy(reason) {
  if (deploying) {
    console.log('Déploiement déjà en cours, demande ignorée.');
    return;
  }

  const changes = runGitStatus();
  if (!changes) {
    console.log('Aucun changement Git à déployer.');
    return;
  }

  console.log('\nChangements détectés :');
  console.log(changes);
  console.log(`\nDéploiement demandé : ${reason}`);

  deploying = true;

  if (OPEN_NEW_SHELL) {
    openDeployShell(reason);
    setTimeout(() => {
      deploying = false;
    }, 5000);
    return;
  }

  const child = spawn(process.execPath, ['deploy-once.js', reason], {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
    shell: false,
    windowsHide: false
  });

  child.on('exit', () => {
    deploying = false;
  });

  child.on('error', (error) => {
    console.error('Erreur lancement déploiement :', error.message);
    deploying = false;
  });
}

function openDeployShell(reason) {
  const safeReason = String(reason || 'changement').replace(/"/g, '\\"');
  const command = `cd /d "${PROJECT_DIR}" && node deploy-once.js "${safeReason}" && pause`;

  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', command], {
      cwd: PROJECT_DIR,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    }).unref();
    return;
  }

  if (process.platform === 'darwin') {
    spawn('osascript', [
      '-e',
      `tell application "Terminal" to do script "cd ${PROJECT_DIR.replace(/ /g, '\\ ')} && node deploy-once.js '${safeReason}'"`
    ], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  spawn('sh', ['-c', `x-terminal-emulator -e 'cd "${PROJECT_DIR}" && node deploy-once.js "${safeReason}"; read -p "Appuie sur Entrée pour fermer"'`], {
    detached: true,
    stdio: 'ignore'
  }).unref();
}

function isIgnoredPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return IGNORE_PATTERNS.some((pattern) => {
    const p = pattern.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === p || normalized.startsWith(`${p}/`) || normalized.includes(`/${p}/`);
  });
}

const watcher = chokidar.watch('.', {
  cwd: PROJECT_DIR,
  ignored: (filePath) => isIgnoredPath(filePath),
  ignoreInitial: true,
  persistent: true,
  usePolling: true,
  interval: POLLING_INTERVAL_MS,
  awaitWriteFinish: {
    stabilityThreshold: 1200,
    pollInterval: 200
  }
});

watcher
  .on('add', (file) => scheduleDeploy(`fichier ajouté : ${file}`))
  .on('change', (file) => scheduleDeploy(`fichier modifié : ${file}`))
  .on('unlink', (file) => scheduleDeploy(`fichier supprimé : ${file}`))
  .on('addDir', (dir) => scheduleDeploy(`dossier ajouté : ${dir}`))
  .on('unlinkDir', (dir) => scheduleDeploy(`dossier supprimé : ${dir}`))
  .on('error', (error) => console.error('Erreur watcher :', error.message));

setInterval(() => {
  if (!deploying && hasGitChanges()) {
    scheduleDeploy('vérification périodique Git : changement non capté par le watcher');
  }
}, GIT_CHECK_INTERVAL_MS);

console.log('Surveillance du projet activée.');
console.log(`Dossier : ${PROJECT_DIR}`);
console.log(`Branche Git : ${GIT_BRANCH}`);
console.log(`Mode de déploiement : ${DEPLOY_MODE}`);
console.log(`Nouveau shell : ${OPEN_NEW_SHELL ? 'oui' : 'non'}`);
console.log(`Polling watcher : oui, toutes les ${POLLING_INTERVAL_MS} ms`);
console.log(`Vérification Git : toutes les ${GIT_CHECK_INTERVAL_MS} ms`);
console.log('.env est ignoré par le script pour éviter de publier tes variables locales.');
console.log('Appuie sur Ctrl+C pour arrêter.');
startLocalBridge();
