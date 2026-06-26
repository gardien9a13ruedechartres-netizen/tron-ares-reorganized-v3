/*
  Ares PT Overlay Router v1.0
  Indépendant du JS principal.
  But : quand tu cliques CMTV / RTP1 / RTP2 dans la liste PT,
  forcer le player dans l'overlay iframe principal (#iframeOverlay > #iframeEl),
  sans créer de panneau flottant et sans lancer 3 players en même temps.
*/
(function () {
  'use strict';

  const ROUTES = [
    {
      id: 'cmtvpt',
      labels: ['CMTV', 'CMTVPT'],
      src: '/pages/cmtvpt.html'
    },
    {
      id: 'rtp1',
      labels: ['RTP1'],
      src: '/pages/rtp1.html'
    },
    {
      id: 'rtp2',
      labels: ['RTP2'],
      src: '/pages/rtp2.html'
    }
  ];

  const LOG_PREFIX = '[Ares PT Overlay Router]';

  function norm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findTargetFromText(text) {
    const normalized = norm(text);
    return ROUTES.find(route => route.labels.some(label => normalized.includes(norm(label)))) || null;
  }

  function findClickableContext(start) {
    if (!start || !start.closest) return null;

    return start.closest(
      '#iframeList .channel-card, ' +
      '#iframeList .channel-item, ' +
      '#iframeList .list-item, ' +
      '#iframeList [data-url], ' +
      '#iframeList [data-src], ' +
      '#iframeList button, ' +
      '#iframeList a, ' +
      '#iframeList > *'
    );
  }

  function pauseMainVideo() {
    const video = document.getElementById('videoEl');
    if (!video) return;

    try { video.pause(); } catch (e) {}
    try { video.removeAttribute('src'); } catch (e) {}
    try { video.load(); } catch (e) {}
    try { video.classList.add('hidden'); } catch (e) {}
    try { video.style.display = 'none'; } catch (e) {}
  }

  function showIframeOverlay() {
    const overlay = document.getElementById('iframeOverlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    overlay.removeAttribute('aria-hidden');
    overlay.style.display = '';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
  }

  function prepareIframe(iframe) {
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    iframe.setAttribute('referrerpolicy', 'origin');

    // Important : pas de sandbox ici. Ton exception overlay gère déjà les routes /pages/*.html.
    // Si un autre script en remet un, on le retire pour ces players internes.
    try { iframe.removeAttribute('sandbox'); } catch (e) {}

    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
  }

  function setNowPlaying(route) {
    const title = document.getElementById('npTitle');
    const sub = document.getElementById('npSub');
    const badge = document.getElementById('npBadge');

    if (title) title.textContent = route.labels[0];
    if (sub) sub.textContent = 'Player PT interne';
    if (badge) badge.textContent = 'IFRAME';
  }

  function markSelected(route) {
    const list = document.getElementById('iframeList');
    if (!list) return;

    const wanted = route.labels.map(norm);

    list.querySelectorAll('.active, .selected, .is-active').forEach(el => {
      el.classList.remove('active', 'selected', 'is-active');
    });

    Array.from(list.children).forEach(item => {
      const text = norm(item.textContent || '');
      if (wanted.some(label => text.includes(label))) {
        item.classList.add('active', 'selected');
      }
    });
  }

  function activateRoute(route, reason) {
    const iframe = document.getElementById('iframeEl');
    if (!iframe) {
      console.warn(LOG_PREFIX, 'iframeEl introuvable. Impossible de charger', route.src);
      return;
    }

    pauseMainVideo();
    showIframeOverlay();
    prepareIframe(iframe);

    const absolute = new URL(route.src, location.origin).href;

    if (iframe.src !== absolute) {
      iframe.src = route.src;
    }

    setNowPlaying(route);
    markSelected(route);

    window.__ARES_PT_ACTIVE_PLAYER__ = {
      id: route.id,
      src: route.src,
      reason: reason || 'manual',
      at: new Date().toISOString()
    };

    console.log(LOG_PREFIX, 'Overlay chargé:', route.id, route.src, 'raison:', reason || 'manual');
  }

  function scheduleActivate(route, reason) {
    // Plusieurs passes pour gagner contre le JS principal s'il change iframeEl.src après le clic.
    activateRoute(route, reason);
    setTimeout(() => activateRoute(route, reason + ':80ms'), 80);
    setTimeout(() => activateRoute(route, reason + ':300ms'), 300);
  }

  function handleUserAction(event) {
    const context = findClickableContext(event.target);
    if (!context) return;

    const text = context.textContent || '';
    const data = [
      context.getAttribute('data-url'),
      context.getAttribute('data-src'),
      context.getAttribute('href'),
      text
    ].filter(Boolean).join(' ');

    const route = findTargetFromText(data);
    if (!route) return;

    // On ne bloque pas le JS principal : on le laisse mettre à jour son état,
    // puis on force simplement la bonne page player dans l'overlay.
    scheduleActivate(route, 'click');
  }

  function handleKeyboard(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    handleUserAction(event);
  }

  function protectIframeForPtPages() {
    const iframe = document.getElementById('iframeEl');
    if (!iframe || iframe.__aresPtRouterProtected) return;

    iframe.__aresPtRouterProtected = true;

    const observer = new MutationObserver(() => {
      const src = iframe.getAttribute('src') || '';
      const route = ROUTES.find(r => src.includes(r.src) || src.includes(r.src.replace('.html', '')));
      if (route) prepareIframe(iframe);
    });

    observer.observe(iframe, {
      attributes: true,
      attributeFilter: ['src', 'sandbox', 'allow']
    });
  }

  function boot() {
    document.addEventListener('click', handleUserAction, true);
    document.addEventListener('keydown', handleKeyboard, true);
    protectIframeForPtPages();

    // API manuelle dans la console si besoin :
    // AresPtOverlayRouter.open('rtp1')
    window.AresPtOverlayRouter = {
      routes: ROUTES.slice(),
      open(idOrLabel) {
        const key = norm(idOrLabel);
        const route = ROUTES.find(r => norm(r.id) === key || r.labels.some(label => norm(label) === key));
        if (!route) {
          console.warn(LOG_PREFIX, 'Route inconnue:', idOrLabel);
          return false;
        }
        scheduleActivate(route, 'api');
        return true;
      }
    };

    console.log(LOG_PREFIX, 'actif. Routes:', ROUTES.map(r => r.id).join(', '));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
