/*
  Ares PT Exclusive Iframes v1.0
  Indépendant du JS principal.

  Objectif : éviter de lancer plusieurs players HLS en iframe en même temps.
  Quand un player PT est sélectionné, les autres sont désactivés avec about:blank.

  Cibles :
  - /pages/cmtvpt.html ou /pages/cmtvpt
  - /pages/rtp1.html   ou /pages/rtp1
  - /pages/rtp2.html   ou /pages/rtp2

  Installation :
  <script defer src="js/ares-pt-exclusive-iframes.js?v=1"></script>
*/
(function () {
  'use strict';

  if (window.__ARES_PT_EXCLUSIVE_IFRAMES_LOADED__) {
    return;
  }
  window.__ARES_PT_EXCLUSIVE_IFRAMES_LOADED__ = true;

  const CONFIG = {
    debug: true,
    autoStart: true,
    startTarget: 'cmtvpt',
    createFloatingPanel: true,
    panelTitle: 'Players PT',
    iframeAllow: 'autoplay; fullscreen; picture-in-picture; encrypted-media',
    targets: [
      {
        id: 'cmtvpt',
        label: 'CMTVPT',
        urls: ['/pages/cmtvpt.html', '/pages/cmtvpt'],
        preferredSrc: '/pages/cmtvpt.html'
      },
      {
        id: 'rtp1',
        label: 'RTP1',
        urls: ['/pages/rtp1.html', '/pages/rtp1'],
        preferredSrc: '/pages/rtp1.html'
      },
      {
        id: 'rtp2',
        label: 'RTP2',
        urls: ['/pages/rtp2.html', '/pages/rtp2'],
        preferredSrc: '/pages/rtp2.html'
      }
    ]
  };

  const state = {
    activeId: '',
    records: new Map(),
    panel: null,
    scanTimer: 0,
    isApplying: false
  };

  function log() {
    if (!CONFIG.debug) return;
    try {
      console.log.apply(console, ['[Ares PT Exclusive]'].concat(Array.from(arguments)));
    } catch (e) {}
  }

  function normalizeUrl(value) {
    try {
      return new URL(String(value || ''), window.location.href).pathname.toLowerCase();
    } catch (e) {
      return String(value || '').toLowerCase();
    }
  }

  function targetFromUrl(value) {
    const raw = String(value || '').toLowerCase();
    const path = normalizeUrl(value);

    for (const target of CONFIG.targets) {
      for (const url of target.urls) {
        const wanted = String(url).toLowerCase();
        if (raw.includes(wanted) || path === wanted || path.endsWith(wanted)) {
          return target;
        }
      }
    }

    return null;
  }

  function getTarget(id) {
    return CONFIG.targets.find(target => target.id === id) || null;
  }

  function absoluteSrc(src) {
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return src;
    }
  }

  function makeIframeSafe(iframe) {
    try {
      iframe.setAttribute('allow', CONFIG.iframeAllow);
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'origin');
      iframe.loading = iframe.loading || 'lazy';
    } catch (e) {}
  }

  function createOverlay(record) {
    const iframe = record.iframe;
    const parent = iframe.parentElement;
    if (!parent || record.overlay) return;

    const computed = window.getComputedStyle(parent);
    if (computed.position === 'static') {
      parent.style.position = 'relative';
    }

    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'ares-pt-exclusive-overlay';
    overlay.textContent = record.label + ' en pause — cliquer pour activer';
    overlay.setAttribute('aria-label', 'Activer ' + record.label);
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:20',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'border:1px solid rgba(0,229,255,.35)',
      'background:rgba(2,4,10,.82)',
      'color:#00e5ff',
      'font-family:Orbitron,Arial,sans-serif',
      'font-size:14px',
      'font-weight:700',
      'letter-spacing:.04em',
      'cursor:pointer',
      'backdrop-filter:blur(4px)'
    ].join(';');

    overlay.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      activate(record.id, 'overlay-click');
    });

    parent.appendChild(overlay);
    record.overlay = overlay;
  }

  function registerIframe(iframe, target) {
    if (!iframe || !target) return null;

    const current = state.records.get(target.id);
    if (current && current.iframe === iframe) {
      makeIframeSafe(iframe);
      createOverlay(current);
      return current;
    }

    const detectedSrc = iframe.getAttribute('src') || iframe.src || target.preferredSrc;
    const originalSrc = iframe.dataset.aresPtOriginalSrc || detectedSrc || target.preferredSrc;

    iframe.dataset.aresPtTarget = target.id;
    iframe.dataset.aresPtOriginalSrc = originalSrc;

    const record = {
      id: target.id,
      label: target.label,
      target: target,
      iframe: iframe,
      originalSrc: originalSrc,
      overlay: null
    };

    state.records.set(target.id, record);
    makeIframeSafe(iframe);
    createOverlay(record);

    iframe.addEventListener('pointerdown', function () {
      activate(target.id, 'iframe-pointerdown');
    }, true);

    iframe.addEventListener('focus', function () {
      activate(target.id, 'iframe-focus');
    }, true);

    log('Iframe enregistrée:', target.id, originalSrc);
    return record;
  }

  function scanIframes() {
    if (state.isApplying) return;

    document.querySelectorAll('iframe').forEach(function (iframe) {
      const explicitId = iframe.dataset && iframe.dataset.aresPtTarget;
      const explicitTarget = explicitId ? getTarget(explicitId) : null;
      const srcTarget = targetFromUrl(iframe.getAttribute('src') || iframe.src || '');
      const originalTarget = targetFromUrl(iframe.dataset ? iframe.dataset.aresPtOriginalSrc : '');
      const target = explicitTarget || srcTarget || originalTarget;

      if (target) {
        registerIframe(iframe, target);
      }
    });

    ensureVirtualIframesIfNeeded();
    updatePanel();
  }

  function ensureVirtualIframesIfNeeded() {
    // Si la page contient un conteneur dédié, ce script peut créer lui-même les 3 slots.
    // Conteneur optionnel : <div id="aresPtExclusivePlayers"></div>
    const holder = document.getElementById('aresPtExclusivePlayers');
    if (!holder) return;

    if (!holder.dataset.aresPtReady) {
      holder.dataset.aresPtReady = '1';
      holder.style.display = holder.style.display || 'grid';
      holder.style.gridTemplateColumns = holder.style.gridTemplateColumns || 'repeat(3, minmax(0, 1fr))';
      holder.style.gap = holder.style.gap || '10px';
    }

    CONFIG.targets.forEach(function (target) {
      if (state.records.has(target.id)) return;

      const wrap = document.createElement('div');
      wrap.className = 'ares-pt-exclusive-slot';
      wrap.style.cssText = 'position:relative;min-height:220px;background:#02040a;border:1px solid rgba(0,229,255,.25);border-radius:12px;overflow:hidden';

      const iframe = document.createElement('iframe');
      iframe.dataset.aresPtTarget = target.id;
      iframe.dataset.aresPtOriginalSrc = target.preferredSrc;
      iframe.title = target.label;
      iframe.style.cssText = 'width:100%;height:100%;min-height:220px;border:0;display:block;background:#000';
      iframe.src = 'about:blank';
      makeIframeSafe(iframe);

      wrap.appendChild(iframe);
      holder.appendChild(wrap);
      registerIframe(iframe, target);
    });
  }

  function setRecordActive(record, active) {
    if (!record || !record.iframe) return;

    state.isApplying = true;

    try {
      makeIframeSafe(record.iframe);

      if (active) {
        const wantedSrc = record.originalSrc || record.target.preferredSrc;
        const currentSrc = record.iframe.getAttribute('src') || '';

        if (!currentSrc || currentSrc === 'about:blank') {
          record.iframe.src = absoluteSrc(wantedSrc);
        }

        record.iframe.dataset.aresPtActive = '1';
        if (record.overlay) record.overlay.style.display = 'none';
        record.iframe.style.visibility = '';
        record.iframe.style.pointerEvents = '';
      } else {
        const currentSrc = record.iframe.getAttribute('src') || record.iframe.src || '';
        if (currentSrc && currentSrc !== 'about:blank') {
          record.iframe.dataset.aresPtOriginalSrc = record.originalSrc || currentSrc;
          record.originalSrc = record.iframe.dataset.aresPtOriginalSrc;
        }

        record.iframe.src = 'about:blank';
        record.iframe.dataset.aresPtActive = '0';
        if (record.overlay) record.overlay.style.display = 'flex';
      }
    } catch (e) {
      console.warn('[Ares PT Exclusive] Erreur activation iframe:', e);
    }

    state.isApplying = false;
  }

  function activate(id, reason) {
    const target = getTarget(id);
    if (!target) return;

    scanIframes();
    state.activeId = id;

    CONFIG.targets.forEach(function (item) {
      const record = state.records.get(item.id);
      if (!record) return;
      setRecordActive(record, item.id === id);
    });

    updatePanel();
    log('Actif:', id, 'raison:', reason || 'manual');
  }

  function createPanel() {
    if (!CONFIG.createFloatingPanel || state.panel) return;

    const panel = document.createElement('div');
    panel.id = 'aresPtExclusivePanel';
    panel.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:999999',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'padding:8px',
      'border-radius:14px',
      'background:rgba(2,4,10,.88)',
      'border:1px solid rgba(0,229,255,.35)',
      'box-shadow:0 10px 30px rgba(0,0,0,.45)',
      'backdrop-filter:blur(8px)',
      'font-family:Orbitron,Arial,sans-serif'
    ].join(';');

    const title = document.createElement('span');
    title.textContent = CONFIG.panelTitle;
    title.style.cssText = 'color:#ff9100;font-size:11px;font-weight:800;margin-right:4px;white-space:nowrap';
    panel.appendChild(title);

    CONFIG.targets.forEach(function (target) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.aresPtButton = target.id;
      btn.textContent = target.label;
      btn.style.cssText = [
        'border:1px solid rgba(0,229,255,.35)',
        'border-radius:10px',
        'padding:7px 9px',
        'background:rgba(0,229,255,.08)',
        'color:#00e5ff',
        'font-size:11px',
        'font-weight:800',
        'cursor:pointer'
      ].join(';');
      btn.addEventListener('click', function () {
        activate(target.id, 'panel-click');
      });
      panel.appendChild(btn);
    });

    document.body.appendChild(panel);
    state.panel = panel;
    updatePanel();
  }

  function updatePanel() {
    if (!state.panel) return;

    state.panel.querySelectorAll('[data-ares-pt-button]').forEach(function (btn) {
      const id = btn.dataset.aresPtButton;
      const active = id === state.activeId;
      btn.style.background = active ? 'linear-gradient(135deg,#00e5ff,#ff9100)' : 'rgba(0,229,255,.08)';
      btn.style.color = active ? '#02040a' : '#00e5ff';
      btn.style.borderColor = active ? 'rgba(255,255,255,.6)' : 'rgba(0,229,255,.35)';
    });
  }

  function boot() {
    scanIframes();
    createPanel();

    if (CONFIG.autoStart) {
      window.setTimeout(function () {
        const startId = state.records.has(CONFIG.startTarget) ? CONFIG.startTarget : (state.records.keys().next().value || CONFIG.startTarget);
        if (startId) activate(startId, 'auto-start');
      }, 600);
    }

    const observer = new MutationObserver(function () {
      window.clearTimeout(state.scanTimer);
      state.scanTimer = window.setTimeout(scanIframes, 150);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-ares-pt-target', 'data-ares-pt-original-src']
    });

    window.AresPtExclusiveIframes = {
      activate: activate,
      scan: scanIframes,
      state: state,
      config: CONFIG
    };

    log('Actif. API: window.AresPtExclusiveIframes.activate("cmtvpt" | "rtp1" | "rtp2")');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
