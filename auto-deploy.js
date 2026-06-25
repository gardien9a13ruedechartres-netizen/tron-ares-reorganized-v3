import chokidar from 'chokidar';
import { execFile } from 'node:child_process';
import process from 'node:process';
import 'dotenv/config';

const debounceMs = Number(process.env.DEBOUNCE_MS || 2500);
const openNewShell = String(process.env.OPEN_NEW_SHELL || 'true').toLowerCase() === 'true';
const ignorePatterns = String(process.env.IGNORE_PATTERNS || 'node_modules,.git,dist,build,.next,.nuxt,.wrangler,.cache')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

let timer = null;
let isRunning = false;
let pending = false;

function shouldIgnore(path) {
  return ignorePatterns.some((pattern) => path.includes(pattern));
}

function runDeploy() {
  if (isRunning) {
    pending = true;
    return;
  }

  isRunning = true;
  pending = false;

  const script = openNewShell ? 'deploy:shell' : 'deploy:once';

  console.log(`\nChangement détecté. Lancement de npm run ${script} ...`);

  const child = execFile('npm', ['run', script], {
    shell: process.platform === 'win32'
  });

  child.stdout?.on('data', (data) => process.stdout.write(data));
  child.stderr?.on('data', (data) => process.stderr.write(data));

  child.on('exit', (code) => {
    isRunning = false;

    if (code !== 0) {
      console.error(`Le déploiement s’est terminé avec le code ${code}.`);
    }

    if (pending) {
      console.log('Nouveaux changements reçus pendant le déploiement. Relance programmée.');
      scheduleDeploy();
    }
  });
}

function scheduleDeploy() {
  clearTimeout(timer);
  timer = setTimeout(runDeploy, debounceMs);
}

console.log('Surveillance du dossier Git en cours...');
console.log('Appuie sur Ctrl+C pour arrêter.');

const watcher = chokidar.watch('.', {
  ignored: shouldIgnore,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 800,
    pollInterval: 100
  }
});

watcher
  .on('add', scheduleDeploy)
  .on('change', scheduleDeploy)
  .on('unlink', scheduleDeploy)
  .on('addDir', scheduleDeploy)
  .on('unlinkDir', scheduleDeploy)
  .on('error', (error) => {
    console.error('Erreur de surveillance :', error);
  });
