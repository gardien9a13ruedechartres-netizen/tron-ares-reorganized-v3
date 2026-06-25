'use strict';

require('dotenv').config();

const { spawnSync } = require('child_process');

const PROJECT_DIR = process.cwd();
const GIT_BRANCH = process.env.GIT_BRANCH || 'main';
const COMMIT_PREFIX = process.env.COMMIT_PREFIX || 'auto deploy';
const DEPLOY_MODE = process.env.DEPLOY_MODE || 'git';
const CLOUDFLARE_COMMAND = process.env.CLOUDFLARE_COMMAND || 'npm run deploy';
const reason = process.argv.slice(2).join(' ') || 'changement détecté';

const SENSITIVE_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production'
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...options
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

function runShell(commandLine) {
  const result = spawnSync(commandLine, {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    shell: true,
    windowsHide: true
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

function gitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });

  return {
    code: result.status || 0,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function getStatus() {
  return gitOutput(['status', '--porcelain']).stdout.trim();
}

function getStagedFiles() {
  const output = gitOutput(['diff', '--cached', '--name-only']).stdout.trim();
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function unstageSensitiveFiles() {
  const staged = getStagedFiles();
  const sensitiveStaged = staged.filter((file) => SENSITIVE_FILES.has(file));

  if (sensitiveStaged.length === 0) return true;

  console.log('Fichiers sensibles retirés du commit :');
  sensitiveStaged.forEach((file) => console.log(`- ${file}`));

  const result = run('git', ['restore', '--staged', '--', ...sensitiveStaged]);
  return result.status === 0;
}

function nowForCommit() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

console.log('--- Auto deploy GitHub -> Cloudflare Pages ---');
console.log(`Projet : ${PROJECT_DIR}`);
console.log(`Branche : ${GIT_BRANCH}`);
console.log(`Raison : ${reason}\n`);

const beforeStatus = getStatus();

if (!beforeStatus) {
  console.log('Aucun changement Git à déployer.');
  process.exit(0);
}

console.log('Changements détectés :');
console.log(beforeStatus);
console.log('');

if (DEPLOY_MODE === 'cloudflare') {
  console.log(`Mode Cloudflare direct : ${CLOUDFLARE_COMMAND}`);
  const deployResult = runShell(CLOUDFLARE_COMMAND);
  process.exit(deployResult.status || 0);
}

const addResult = run('git', ['add', '-A', '--', '.']);

if (addResult.status !== 0) {
  console.error('Erreur pendant git add.');
  process.exit(addResult.status || 1);
}

if (!unstageSensitiveFiles()) {
  console.error('Erreur pendant le retrait des fichiers sensibles.');
  process.exit(1);
}

const stagedFiles = getStagedFiles();

if (stagedFiles.length === 0) {
  console.log('Aucun changement à committer après filtrage.');
  process.exit(0);
}

const commitMessage = `${COMMIT_PREFIX}: ${nowForCommit()}`;
const commitResult = run('git', ['commit', '-m', commitMessage]);

if (commitResult.status !== 0) {
  console.error('Erreur pendant git commit.');
  process.exit(commitResult.status || 1);
}

const pushResult = run('git', ['push', 'origin', GIT_BRANCH]);

if (pushResult.status !== 0) {
  console.error('Erreur pendant git push.');
  process.exit(pushResult.status || 1);
}

console.log('\nPush terminé. Cloudflare Pages devrait démarrer le déploiement via GitHub.');
