(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    const iframeOverlay = document.getElementById('iframeOverlay');
    const iframeEl = document.getElementById('iframeEl');
    const playerContainer = document.getElementById('playerContainer');
    if (!iframeOverlay || !iframeEl) return;

    try {
      iframeEl.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
      iframeEl.setAttribute('referrerpolicy', 'origin');
      iframeEl.setAttribute('allowfullscreen', '');
    } catch {}

    const style = document.createElement('style');
    style.id = 'iframe-overlay-boost-style';
    style.textContent = `
      #playerContainer, #playerContainer .player-inner{
        position:relative;
        overflow:hidden;
      }
      #iframeOverlay{
        position:absolute !important;
        inset:0 !important;
        width:100% !important;
        height:100% !important;
        display:block !important;
        overflow:hidden !important;
        padding:0 !important;
        margin:0 !important;
        background:#000 !important;
        z-index:8 !important;
      }
      #iframeOverlay.hidden{
        display:none !important;
      }
      #iframeOverlay .iframe-overlay-controls{
        position:absolute !important;
        top:10px !important;
        left:10px !important;
        right:10px !important;
        z-index:30 !important;
        pointer-events:none !important;
        display:flex !important;
        justify-content:flex-start !important;
      }
      #iframeOverlay .iframe-overlay-controls > *{
        pointer-events:auto !important;
      }
      #iframeEl{
        position:absolute !important;
        inset:0 !important;
        width:100% !important;
        height:100% !important;
        min-width:100% !important;
        min-height:100% !important;
        border:0 !important;
        display:block !important;
        background:#000 !important;
      }
      #iframeOverlayBoostCurtain{
        position:absolute;
        inset:0;
        z-index:25;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
        background:radial-gradient(circle at center, rgba(0,0,0,.10) 0%, rgba(0,0,0,.34) 45%, rgba(0,0,0,.58) 100%);
        opacity:0;
        pointer-events:none;
        transition:opacity .16s ease;
      }
      #iframeOverlayBoostCurtain.is-visible{
        opacity:1;
        pointer-events:auto;
      }
      .iframe-overlay-boost-card{
        min-width:min(92vw, 320px);
        max-width:min(92vw, 520px);
        border:1px solid rgba(255,255,255,.14);
        border-radius:18px;
        background:rgba(7,10,16,.82);
        backdrop-filter:blur(10px);
        box-shadow:0 18px 60px rgba(0,0,0,.38);
        padding:18px 18px 16px;
        text-align:center;
        color:#fff;
      }
      .iframe-overlay-boost-title{font-weight:700;font-size:18px;margin-bottom:8px;}
      .iframe-overlay-boost-sub{font-size:13px;line-height:1.45;color:rgba(255,255,255,.82);margin-bottom:14px;}
      .iframe-overlay-boost-btn{appearance:none;border:0;border-radius:999px;padding:12px 18px;min-width:200px;background:linear-gradient(90deg, #0cd3ff, #ff9800);color:#081018;font-weight:800;cursor:pointer;}
      .iframe-overlay-boost-btn:focus-visible{outline:2px solid rgba(255,255,255,.75);outline-offset:2px;}
      .iframe-overlay-boost-tip{margin-top:10px;font-size:11px;color:rgba(255,255,255,.58);}
    `;
    document.head.appendChild(style);

    const curtain = document.createElement('div');
    curtain.id = 'iframeOverlayBoostCurtain';
    curtain.className = 'hidden';
    curtain.innerHTML = `
      <div class="iframe-overlay-boost-card" role="group" aria-label="Interaction iframe">
        <div class="iframe-overlay-boost-title">Lecture externe</div>
        <div class="iframe-overlay-boost-sub">Certains players dans l’iframe ont besoin d’une interaction directe. Utilise ce bouton pour donner immédiatement le focus au player.</div>
        <button type="button" class="iframe-overlay-boost-btn" id="iframeOverlayBoostBtn">Ouvrir le player</button>
        <div class="iframe-overlay-boost-tip">Sur mobile, un simple appui suffit généralement.</div>
      </div>
    `;
    iframeOverlay.appendChild(curtain);
    const curtainBtn = curtain.querySelector('#iframeOverlayBoostBtn');

    let preopenArmed = false;
    let suppressNextClick = false;

    function isVisible(el) {
      return !!el && !el.classList.contains('hidden');
    }

    function likelyIframeListItem(item) {
      if (!item) return false;
      if (item.dataset.type === 'iframe') return true;
      if (item.querySelector('.tag-chip--iframe')) return true;
      return false;
    }

    function safeFocusIframe() {
      try { iframeEl.focus({ preventScroll: true }); } catch {
        try { iframeEl.focus(); } catch {}
      }
    }

    function nudgeFocus() {
      safeFocusIframe();
      setTimeout(safeFocusIframe, 80);
      setTimeout(safeFocusIframe, 180);
      setTimeout(safeFocusIframe, 320);
    }

    function hideCurtain() {
      curtain.classList.remove('is-visible');
      curtain.setAttribute('aria-hidden', 'true');
    }

    function showCurtain() {
      curtain.classList.add('is-visible');
      curtain.setAttribute('aria-hidden', 'false');
    }

    function armPreopen() {
      preopenArmed = true;
      window.setTimeout(function () { preopenArmed = false; }, 900);
    }

    function normalizeKnownEmbedUrl(url) {
      let next = (url || '').trim();
      if (!next) return next;
      try {
        const u = new URL(next, window.location.href);
        if (/lovetier\.bz$/i.test(u.hostname)) {
          if (!u.searchParams.has('embed')) u.searchParams.set('embed', '1');
          if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
          if (!u.searchParams.has('muted')) u.searchParams.set('muted', '1');
          next = u.toString();
        }
      } catch {}
      return next;
    }

    function maybeShowCurtain() {
      const src = (iframeEl.getAttribute('src') || '').trim();
      if (!isVisible(iframeOverlay) || !src || src === 'about:blank') {
        hideCurtain();
        return;
      }
      showCurtain();
      if (preopenArmed) {
        window.setTimeout(function () {
          hideCurtain();
          nudgeFocus();
        }, 120);
      }
    }

    curtainBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      hideCurtain();
      nudgeFocus();
    });

    curtain.addEventListener('pointerdown', function (ev) {
      if (ev.target === curtain) {
        hideCurtain();
        window.setTimeout(nudgeFocus, 0);
      }
    });

    document.addEventListener('pointerdown', function (ev) {
      const item = ev.target && ev.target.closest ? ev.target.closest('.channel-item') : null;
      if (!item || !likelyIframeListItem(item)) return;
      if (ev.target.closest('.fav-btn, .tmdb-trailer-btn')) return;

      const rawIndex = Number(item.dataset.index);
      const type = item.dataset.type;
      if (!Number.isFinite(rawIndex)) return;

      armPreopen();
      suppressNextClick = true;
      window.setTimeout(function () { suppressNextClick = false; }, 450);

      try {
        if (type === 'fr' && typeof window.playFrChannel === 'function') {
          window.playFrChannel(rawIndex);
        } else if (type === 'channels' && typeof window.playChannel === 'function') {
          window.playChannel(rawIndex);
        } else if (type === 'iframe' && typeof window.playIframe === 'function') {
          window.playIframe(rawIndex);
        }
      } catch {}

      window.setTimeout(function(){
        try {
          const src = iframeEl.getAttribute('src') || '';
          const normalized = normalizeKnownEmbedUrl(src);
          if (normalized && normalized !== src) iframeEl.src = normalized;
        } catch {}
      }, 10);

      window.setTimeout(maybeShowCurtain, 30);
      window.setTimeout(nudgeFocus, 120);
    }, true);

    document.addEventListener('click', function (ev) {
      if (!suppressNextClick) return;
      const item = ev.target && ev.target.closest ? ev.target.closest('.channel-item') : null;
      if (!item || !likelyIframeListItem(item)) return;
      if (ev.target.closest('.fav-btn, .tmdb-trailer-btn')) return;
      ev.preventDefault();
      ev.stopPropagation();
    }, true);

    const mo = new MutationObserver(function () {
      maybeShowCurtain();
    });
    mo.observe(iframeOverlay, { attributes: true, attributeFilter: ['class'] });
    mo.observe(iframeEl, { attributes: true, attributeFilter: ['src'] });

    iframeEl.addEventListener('load', function () {
      maybeShowCurtain();
      window.setTimeout(nudgeFocus, 90);
    });

    ['visibilitychange', 'focus'].forEach(function (evtName) {
      window.addEventListener(evtName, function () {
        if (document.visibilityState === 'hidden') return;
        if (isVisible(iframeOverlay)) maybeShowCurtain();
      });
    });
  });
})();


// ===============================
// LOVETIER RELOAD (PRO VERSION - DOUBLE IFRAME FIXE)
// ===============================

(function () {
  'use strict';

  const overlay = document.getElementById('iframeOverlay');
  const iframeA = document.getElementById('iframeEl');

  if (!overlay || !iframeA) return;

  // création iframe B (cachée)
  const iframeB = document.createElement('iframe');
  iframeB.id = 'iframeElB';

  Object.assign(iframeB.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    border: '0',
    background: '#000',
    opacity: '0',
    pointerEvents: 'none'
  });

  iframeB.setAttribute('allow', 'autoplay; fullscreen');
  iframeB.setAttribute('sandbox', 'allow-scripts allow-forms');
  iframeB.setAttribute('referrerpolicy', 'no-referrer');

  overlay.appendChild(iframeB);

  let activeFrame = iframeA;
  let standbyFrame = iframeB;

  let active = false;
  let currentUrl = '';
  let isReloading = false;
  let timer = null;
  let startedAt = 0;

  const PREVENTIVE = 4 * 60 * 1000 + 50 * 1000;
  const TIMEOUT = 15000;

  function isLovetier(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.hostname.includes('lovetier.bz');
    } catch {
      return false;
    }
  }

  function buildUrl(url) {
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + '_ts=' + Date.now();
  }

  function show(frame) {
    frame.style.opacity = '1';
    frame.style.pointerEvents = 'auto';
  }

  function hide(frame) {
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
  }

  function swap() {
    const old = activeFrame;

    show(standbyFrame);

    // ⚠️ couper l'ancien son IMMÉDIATEMENT
    try {
      old.src = 'about:blank';
    } catch {}

    hide(old);

    // swap références
    const tmp = activeFrame;
    activeFrame = standbyFrame;
    standbyFrame = tmp;
  }

  function schedule() {
    clearTimeout(timer);
    if (!active) return;

    timer = setTimeout(() => {
      reloadInvisible();
    }, PREVENTIVE);
  }

  function reloadInvisible() {
    if (!active || isReloading || !currentUrl) return;

    isReloading = true;

    standbyFrame.src = buildUrl(currentUrl);

    let done = false;

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;

      isReloading = false;
      schedule();
    }, TIMEOUT);

    standbyFrame.onload = () => {
      if (done) return;
      done = true;

      clearTimeout(timeout);

      swap();

      isReloading = false;
      startedAt = Date.now();
      schedule();
    };
  }

  function play(url) {
    if (!isLovetier(url)) return false;

    active = true;
    currentUrl = url;

    activeFrame.src = buildUrl(url);

    startedAt = Date.now();
    schedule();

    return true;
  }

  function stop() {
    active = false;
    currentUrl = '';
    isReloading = false;

    clearTimeout(timer);

    try {
      iframeA.src = 'about:blank';
      iframeB.src = 'about:blank';
    } catch {}
  }

  window.AresIframeReload = {
    isLovetierUrl: isLovetier,
    play,
    stop,
    reloadInvisible
  };

})();