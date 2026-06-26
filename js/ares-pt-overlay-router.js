/*
  Ares PT Overlay Router v1.2 ASCII
  Purpose: keep the main app behavior, then force selected PT channels
  into the existing iframe overlay.
  No accents, no special chars, no floating UI.
*/
(function () {
  'use strict';

  var ROUTES = [
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

  var LOG_PREFIX = '[AresPtOverlayRouter]';
  var pendingTimer = null;
  var lastAppliedKey = '';

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(LOG_PREFIX);
      console.log.apply(console, args);
    } catch (e) {}
  }

  function warn() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(LOG_PREFIX);
      console.warn.apply(console, args);
    } catch (e) {}
  }

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
      videoEl: document.getElementById('videoEl'),
      showcaseOverlay: document.getElementById('showcaseOverlay')
    };
  }

  function makeUrl(href, id) {
    var sep = href.indexOf('?') >= 0 ? '&' : '?';
    return href + sep + 'arespt=' + encodeURIComponent(id) + '&t=' + Date.now();
  }

  function hideElement(el) {
    if (!el) return;
    try { el.classList.add('hidden'); } catch (e) {}
    try { el.setAttribute('aria-hidden', 'true'); } catch (e) {}
    try { el.style.display = 'none'; } catch (e) {}
  }

  function showElement(el) {
    if (!el) return;
    try { el.classList.remove('hidden'); } catch (e) {}
    try { el.setAttribute('aria-hidden', 'false'); } catch (e) {}
    try { el.style.display = ''; } catch (e) {}
  }

  function stopMainVideo(videoEl) {
    if (!videoEl) return;
    try { videoEl.pause(); } catch (e) {}
    try { videoEl.removeAttribute('src'); } catch (e) {}
    try { videoEl.src = ''; } catch (e) {}
    try { videoEl.load(); } catch (e) {}
  }

  function ensureIframePermissions(iframeEl) {
    if (!iframeEl) return;
    try {
      iframeEl.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
      iframeEl.setAttribute('allowfullscreen', '');
      iframeEl.setAttribute('referrerpolicy', 'origin');
    } catch (e) {}
  }

  function applyRoute(route) {
    if (!route) return false;

    var parts = getIframeParts();
    var iframeOverlay = parts.iframeOverlay;
    var iframeEl = parts.iframeEl;
    var videoEl = parts.videoEl;
    var showcaseOverlay = parts.showcaseOverlay;

    if (!iframeOverlay || !iframeEl) {
      warn('Missing iframeOverlay or iframeEl', { iframeOverlay: !!iframeOverlay, iframeEl: !!iframeEl });
      return false;
    }

    var targetUrl = makeUrl(route.href, route.id);
    lastAppliedKey = route.id + ':' + targetUrl;

    hideElement(showcaseOverlay);
    stopMainVideo(videoEl);
    showElement(iframeOverlay);
    ensureIframePermissions(iframeEl);

    try {
      iframeEl.src = targetUrl;
    } catch (e) {
      try { iframeEl.setAttribute('src', targetUrl); } catch (e2) {}
    }

    try {
      iframeEl.focus({ preventScroll: true });
    } catch (e) {
      try { iframeEl.focus(); } catch (e2) {}
    }

    log('Opened route', route.id, targetUrl);
    return true;
  }

  function open(id) {
    var key = norm(id);
    var route = null;

    for (var i = 0; i < ROUTES.length; i++) {
      if (norm(ROUTES[i].id) === key) {
        route = ROUTES[i];
        break;
      }
      for (var j = 0; j < ROUTES[i].labels.length; j++) {
        if (norm(ROUTES[i].labels[j]) === key) {
          route = ROUTES[i];
          break;
        }
      }
      if (route) break;
    }

    if (!route) {
      warn('Unknown route', id);
      return false;
    }

    return applyRoute(route);
  }

  function routeFromText(text) {
    var n = norm(text);
    if (!n) return null;

    for (var i = 0; i < ROUTES.length; i++) {
      var route = ROUTES[i];
      for (var j = 0; j < route.labels.length; j++) {
        var label = norm(route.labels[j]);
        if (n === label || n.indexOf(label) >= 0) {
          return route;
        }
      }
    }
    return null;
  }

  function findRouteFromEventTarget(target) {
    var node = target;
    var maxDepth = 8;

    while (node && node !== document && maxDepth-- > 0) {
      var text = '';
      try { text += ' ' + (node.textContent || ''); } catch (e) {}
      try { text += ' ' + (node.getAttribute && node.getAttribute('title') || ''); } catch (e) {}
      try { text += ' ' + (node.getAttribute && node.getAttribute('aria-label') || ''); } catch (e) {}
      try { text += ' ' + (node.dataset ? JSON.stringify(node.dataset) : ''); } catch (e) {}

      var route = routeFromText(text);
      if (route) return route;

      node = node.parentElement;
    }

    return null;
  }

  function scheduleRoute(route) {
    if (!route) return;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }

    log('Click detected for route', route.id, 'waiting for main app');

    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      applyRoute(route);
    }, 350);
  }

  function onDocumentClick(event) {
    var route = findRouteFromEventTarget(event.target);
    if (!route) return;
    scheduleRoute(route);
  }

  function init() {
    document.addEventListener('click', onDocumentClick, true);
    window.AresPtOverlayRouter = {
      version: '1.2.0-ascii',
      routes: ROUTES.slice(),
      open: open,
      applyRoute: applyRoute,
      debug: function () {
        var parts = getIframeParts();
        return {
          version: '1.2.0-ascii',
          iframeOverlay: !!parts.iframeOverlay,
          iframeEl: !!parts.iframeEl,
          videoEl: !!parts.videoEl,
          iframeSrc: parts.iframeEl ? parts.iframeEl.getAttribute('src') : null,
          overlayClass: parts.iframeOverlay ? parts.iframeOverlay.className : null,
          lastAppliedKey: lastAppliedKey
        };
      }
    };
    log('Ready v1.2 ASCII');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
