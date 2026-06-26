/*
  Ares PT Overlay Router v1.1 Light
  Objectif : ne PAS créer de boutons, ne PAS remplacer l'app principale.
  Il laisse tron-ares.js gérer le clic, puis remplace seulement l'URL de l'iframe overlay
  pour les trois chaînes PT locales générées par l'extension.
*/
(function () {
  'use strict';

  const ROUTES = [
    {
      id: 'cmtvpt',
      labels: ['CMTV', 'CMTVPT'],
      href: '/pages/cmtvpt.html'
    },
    {
      id: 'rtp1',
      labels: ['RTP1'],
      href: '/pages/rtp1.html'
    },
    {
      id: 'rtp2',
      labels: ['RTP2'],
      href: '/pages/rtp2.html'
    }
  ];

  const LOG_PREFIX = '[AresPtOverlayRouter]';
  let pendingTimer = null;
  let lastAppliedKey = '';

  function norm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getIframeParts() {
    return {
      iframeOverlay: document.getElementById('iframeOverlay'),
      iframeEl: document.getElementById('iframeEl'),
      videoEl: document.getElementById('videoEl')
    };
  }

  function findChannelItemFromClick(event) {
    const target = event && event.target;
    if (!target || !target.closest) return null;

    const item = target.closest('.channel-item, [data-url], [data-title], [data-name]');
    if (!item) return null;

    const iframeList = document.getElementById('iframeList');
    if (iframeList && !iframeList.contains(item)) return null;

    return item;
  }

  function detectRouteFromItem(item) {
    if (!item) return null;

    const pieces = [
      item.getAttribute('data-title'),
      item.getAttribute('data-name'),
      item.getAttribute('data-url'),
      item.textContent
    ].filter(Boolean);

    const haystack = norm(pieces.join(' '));

    return ROUTES.find(route =>
      route.labels.some(label => {
        const n = norm(label);
        // mot exact ou présence simple, assez strict pour RTP1/RTP2/CMTV
        return haystack === n || haystack.includes(n);
      })
    ) || null;
  }

  function ensureOverlayVisible() {
    const { iframeOverlay, videoEl } = getIframeParts();

    try { iframeOverlay && iframeOverlay.classList.remove('hidden'); } catch {}
    try { videoEl && videoEl.pause && videoEl.pause(); } catch {}
    try { if (videoEl) videoEl.style.visibility = 'hidden'; } catch {}

    try {
      const statusPill = document.getElementById('statusPill');
      if (statusPill) statusPill.textContent = 'Overlay iFrame actif';
    } catch {}
  }

  function applyIframePolicy(iframeEl) {
    if (!iframeEl) return;

    try {
      iframeEl.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    } catch {}

    try {
      iframeEl.setAttribute('allowfullscreen', '');
    } catch {}

    try {
      iframeEl.setAttribute('referrerpolicy', 'origin');
    } catch {}

    // IMPORTANT : pour les pages locales /pages/*.html, pas de sandbox restrictive.
    try {
      iframeEl.removeAttribute('sandbox');
    } catch {}
  }

  function buildUrl(route) {
    // Cache-bust pour forcer le dernier fichier HTML généré/déployé.
    const sep = route.href.includes('?') ? '&' : '?';
    return route.href + sep + 'arespt=' + encodeURIComponent(route.id) + '&t=' + Date.now();
  }

  function routeOverlay(route, reason) {
    if (!route) return;

    const { iframeEl } = getIframeParts();
    if (!iframeEl) {
      console.warn(LOG_PREFIX, 'iframeEl introuvable');
      return;
    }

    const key = route.id + ':' + Math.floor(Date.now() / 300);
    if (lastAppliedKey === key) return;
    lastAppliedKey = key;

    const finalUrl = buildUrl(route);

    ensureOverlayVisible();
    applyIframePolicy(iframeEl);

    // Stoppe l'ancien player avant d'ouvrir le nouveau.
    try { iframeEl.src = 'about:blank'; } catch {}

    window.setTimeout(function () {
      try {
        applyIframePolicy(iframeEl);
        iframeEl.src = finalUrl;
        console.log(LOG_PREFIX, 'Overlay routé:', route.id, finalUrl, reason || '');
      } catch (err) {
        console.error(LOG_PREFIX, 'Erreur route overlay:', err);
      }
    }, 60);
  }

  function scheduleRoute(route, reason) {
    if (!route) return;
    if (pendingTimer) window.clearTimeout(pendingTimer);

    // On laisse d'abord tron-ares.js gérer l'UI, l'état actif et le Now Playing.
    pendingTimer = window.setTimeout(function () {
      pendingTimer = null;
      routeOverlay(route, reason);
    }, 140);
  }

  function onDocumentClick(event) {
    const item = findChannelItemFromClick(event);
    if (!item) return;

    const route = detectRouteFromItem(item);
    if (!route) return;

    // Ne bloque pas le clic principal : on corrige seulement l'iframe juste après.
    scheduleRoute(route, 'click liste PT');
  }

  function open(id) {
    const route = ROUTES.find(r => r.id === String(id || '').toLowerCase());
    if (!route) {
      console.warn(LOG_PREFIX, 'Route inconnue:', id);
      return;
    }
    routeOverlay(route, 'appel manuel');
  }

  document.addEventListener('click', onDocumentClick, false);

  window.AresPtOverlayRouter = {
    version: '1.1-light',
    routes: ROUTES.map(r => ({ id: r.id, href: r.href, labels: r.labels.slice() })),
    open
  };

  console.log(LOG_PREFIX, 'v1.1 Light actif');
})();
