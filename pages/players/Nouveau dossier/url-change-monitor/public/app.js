'use strict';

const targetUrlInput = document.getElementById('targetUrl');
const intervalMsSelect = document.getElementById('intervalMs');
const saveBtn = document.getElementById('saveBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const checkBtn = document.getElementById('checkBtn');
const resetBtn = document.getElementById('resetBtn');

const runningEl = document.getElementById('running');
const lastCheckedAtEl = document.getElementById('lastCheckedAt');
const lastChangedAtEl = document.getElementById('lastChangedAt');
const urlCountEl = document.getElementById('urlCount');
const currentUrlsEl = document.getElementById('currentUrls');
const historyBody = document.getElementById('historyBody');
const errorsEl = document.getElementById('errors');

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return 'Premier relevé';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  parts.push(`${s} s`);
  return parts.join(' ');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erreur inconnue.');
  }

  return data;
}

async function refreshStatus() {
  const status = await api('/api/status');

  targetUrlInput.value = status.targetUrl;
  intervalMsSelect.value = String(status.intervalMs);
  runningEl.textContent = status.running ? 'En cours' : 'Arrêté';
  lastCheckedAtEl.textContent = formatDate(status.lastCheckedAt);
  lastChangedAtEl.textContent = formatDate(status.lastChangedAt);
  urlCountEl.textContent = String(status.currentUrls.length);

  currentUrlsEl.textContent = status.currentUrls.length
    ? status.currentUrls.join('\n')
    : 'Aucune URL détectée pour le moment.';

  historyBody.innerHTML = '';
  for (const item of status.history) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(item.changedAt)}</td>
      <td>${formatDuration(item.secondsSincePreviousChange)}</td>
      <td>${item.urls.length}</td>
    `;
    historyBody.appendChild(tr);
  }

  if (!status.history.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3">Aucun changement enregistré.</td>';
    historyBody.appendChild(tr);
  }

  errorsEl.textContent = status.errors.length
    ? status.errors.map(error => `${formatDate(error.at)} — ${error.message}`).join('\n')
    : 'Aucune erreur.';
}

async function saveConfig() {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      targetUrl: targetUrlInput.value.trim(),
      intervalMs: Number(intervalMsSelect.value)
    })
  });
  await refreshStatus();
}

saveBtn.addEventListener('click', async () => {
  try {
    await saveConfig();
  } catch (error) {
    alert(error.message);
  }
});

startBtn.addEventListener('click', async () => {
  try {
    await saveConfig();
    await api('/api/start', { method: 'POST' });
    await refreshStatus();
  } catch (error) {
    alert(error.message);
  }
});

stopBtn.addEventListener('click', async () => {
  await api('/api/stop', { method: 'POST' });
  await refreshStatus();
});

checkBtn.addEventListener('click', async () => {
  try {
    await api('/api/check', { method: 'POST' });
    await refreshStatus();
  } catch (error) {
    alert(error.message);
  }
});

resetBtn.addEventListener('click', async () => {
  await api('/api/reset', { method: 'POST' });
  await refreshStatus();
});

refreshStatus();
setInterval(refreshStatus, 2000);
