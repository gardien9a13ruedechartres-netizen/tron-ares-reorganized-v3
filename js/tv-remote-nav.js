/* =========================================================
   tv-remote-nav.js
   Navigation TV / télécommande sans modifier tron-ares.js
   ========================================================= */

(function () {
  'use strict';

  if (window.__ARES_TV_REMOTE_NAV__) return;
  window.__ARES_TV_REMOTE_NAV__ = true;

  const SELECTORS = [
    '.tab-btn',
    '.tab-split-part',
    '.channel-item',
    '.showcase-card',
    '.nav-btn',
    '.btn',
    '.icon-btn',
    '.toggle-sidebar-btn',
    '.mini-radio-btn',
    '.streamurl-close',
    '.showcase-close',
    '.subsearch-close',
    '.radio-panel-close',
    '.np-track-item',
    '.showcase-info',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const STYLE_ID = 'tv-remote-nav-style';
  const FOCUS_CLASS = 'tv-focused';
  const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

  let focusables = [];
  let currentIndex = -1;
  let mutationQueued = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${FOCUS_CLASS}{
        outline: none !important;
        border-color: var(--tron-accent, #ff9100) !important;
        box-shadow:
          0 0 0 3px rgba(255,145,0,.30),
          0 0 18px rgba(255,145,0,.75) !important;
        transform: translateZ(0) scale(1.02);
        z-index: 20;
      }

      .channel-item.${FOCUS_CLASS}{
        background: radial-gradient(circle at left, rgba(255,145,0,.22), rgba(1,4,12,.98)) !important;
      }

      .channel-item.${FOCUS_CLASS} .channel-logo{
        border-color: var(--tron-accent, #ff9100) !important;
        box-shadow: 0 0 16px rgba(255,145,0,.75) !important;
      }

      .showcase-card.${FOCUS_CLASS}{
        border-color: var(--tron-accent, #ff9100) !important;
        box-shadow:
          0 0 0 2px rgba(255,145,0,.25),
          0 0 22px rgba(255,145,0,.72) !important;
      }

      .${FOCUS_CLASS}.np-track-item,
      .${FOCUS_CLASS}.btn,
      .${FOCUS_CLASS}.icon-btn,
      .${FOCUS_CLASS}.nav-btn,
      .${FOCUS_CLASS}.tab-btn,
      .${FOCUS_CLASS}.tab-split-part,
      .${FOCUS_CLASS}.toggle-sidebar-btn{
        color: var(--tron-text, #e0f7ff) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isElementVisible(el) {
    if (!el || !document.documentElement.contains(el)) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.hidden) return false;
    if (el.getAttribute('aria-hidden') === 'true' && !el.classList.contains('active')) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isActuallyFocusable(el) {
    if (!isElementVisible(el)) return false;
    if (el.matches('.hidden')) return false;
    if (el.closest('.hidden')) return false;

    const listParent = el.closest('.list');
    if (listParent && !listParent.classList.contains('active')) return false;

    return true;
  }

  function collectFocusableElements() {
    const nodes = Array.from(document.querySelectorAll(SELECTORS))
      .filter(isActuallyFocusable);

    const unique = [];
    const seen = new Set();

    for (const el of nodes) {
      if (seen.has(el)) continue;
      seen.add(el);

      if (!el.hasAttribute('tabindex') && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/i.test(el.tagName)) {
        el.setAttribute('tabindex', '0');
      }

      unique.push(el);
    }

    return unique;
  }

  function cleanupFocusClass() {
    document.querySelectorAll('.' + FOCUS_CLASS).forEach(el => {
      el.classList.remove(FOCUS_CLASS);
    });
  }

  function refreshFocusableElements(keepCurrent = true) {
    const previous = keepCurrent ? document.activeElement : null;
    focusables = collectFocusableElements();

    if (!focusables.length) {
      currentIndex = -1;
      cleanupFocusClass();
      return;
    }

    if (previous && focusables.includes(previous)) {
      currentIndex = focusables.indexOf(previous);
    } else if (currentIndex < 0 || currentIndex >= focusables.length) {
      currentIndex = 0;
    }
  }

  function focusElement(el, options = {}) {
    if (!el) return false;
    if (!focusables.includes(el)) refreshFocusableElements(false);
    if (!focusables.includes(el)) return false;

    cleanupFocusClass();

    currentIndex = focusables.indexOf(el);
    el.classList.add(FOCUS_CLASS);

    try {
      el.focus({ preventScroll: !!options.preventScroll });
    } catch (_) {
      el.focus();
    }

    if (!options.preventScroll) {
      try {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      } catch (_) {
        el.scrollIntoView();
      }
    }

    return true;
  }

  function focusByIndex(index) {
    refreshFocusableElements(true);
    if (!focusables.length) return false;

    const safeIndex = Math.max(0, Math.min(index, focusables.length - 1));
    return focusElement(focusables[safeIndex]);
  }

  function getRect(el) {
    return el.getBoundingClientRect();
  }

  function getDistance(a, b) {
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findBestCandidate(direction) {
    refreshFocusableElements(true);
    if (!focusables.length) return null;

    const current = focusables[currentIndex] || focusables[0];
    if (!current) return null;

    const currentRect = getRect(current);
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (const candidate of focusables) {
      if (candidate === current) continue;

      const rect = getRect(candidate);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = centerX - currentCenterX;
      const dy = centerY - currentCenterY;

      let valid = false;
      let axisPenalty = 0;

      if (direction === 'left' && dx < -4) {
        valid = true;
        axisPenalty = Math.abs(dy) * 1.8;
      } else if (direction === 'right' && dx > 4) {
        valid = true;
        axisPenalty = Math.abs(dy) * 1.8;
      } else if (direction === 'up' && dy < -4) {
        valid = true;
        axisPenalty = Math.abs(dx) * 1.8;
      } else if (direction === 'down' && dy > 4) {
        valid = true;
        axisPenalty = Math.abs(dx) * 1.8;
      }

      if (!valid) continue;

      const score = getDistance(currentRect, rect) + axisPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }

  function move(direction) {
    const candidate = findBestCandidate(direction);
    if (candidate) {
      focusElement(candidate);
      return true;
    }

    if (direction === 'down' || direction === 'right') {
      return focusByIndex(currentIndex + 1);
    }

    if (direction === 'up' || direction === 'left') {
      return focusByIndex(currentIndex - 1);
    }

    return false;
  }

  function clickFocused() {
    const el = focusables[currentIndex] || document.activeElement;
    if (!el) return false;

    if (typeof el.click === 'function') {
      el.click();
      return true;
    }

    return false;
  }

  function isTypingContext() {
    const el = document.activeElement;
    return !!(el && TYPING_TAGS.has(el.tagName));
  }

  function visibleById(id) {
    const el = document.getElementById(id);
    return isActuallyFocusable(el) ? el : null;
  }

  function closeTopLayer() {
    const closeTargets = [
      'streamUrlCloseBtn',
      'subtitleSearchCloseBtn',
      'showcaseCloseBtn',
      'radioPanelClose',
      'trailerBackBtn'
    ];

    for (const id of closeTargets) {
      const el = visibleById(id);
      if (el) {
        el.click();
        return true;
      }
    }

    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

    if (
      sidebar &&
      toggleSidebarBtn &&
      window.innerWidth <= 900 &&
      !sidebar.classList.contains('collapsed')
    ) {
      toggleSidebarBtn.click();
      return true;
    }

    return false;
  }

  function togglePlayPause() {
    const video = document.getElementById('videoEl');
    if (!video) return false;

    try {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function activateNextPrev(next = true) {
    const id = next ? 'nextBtn' : 'prevBtn';
    const btn = document.getElementById(id);
    if (!btn) return false;
    btn.click();
    return true;
  }

  function ensureInitialFocus() {
    refreshFocusableElements(false);
    if (!focusables.length) return;

    const preferred =
      document.querySelector('.tab-btn.active') ||
      document.querySelector('.channel-item.active') ||
      document.querySelector('.channel-item') ||
      document.querySelector('.btn') ||
      focusables[0];

    focusElement(preferred, { preventScroll: false });
  }

  function queueRefresh() {
    if (mutationQueued) return;
    mutationQueued = true;

    requestAnimationFrame(() => {
      mutationQueued = false;
      const activeStillValid =
        document.activeElement &&
        focusables.includes(document.activeElement) &&
        isActuallyFocusable(document.activeElement);

      refreshFocusableElements(true);

      if (!activeStillValid && focusables.length) {
        focusByIndex(Math.max(0, Math.min(currentIndex, focusables.length - 1)));
      }
    });
  }

  document.addEventListener('focusin', (event) => {
    const el = event.target;
    if (!el || !focusables.includes(el)) return;

    cleanupFocusClass();
    el.classList.add(FOCUS_CLASS);
    currentIndex = focusables.indexOf(el);
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key;

    if (isTypingContext()) {
      if (key === 'Escape' || key === 'Backspace' || key === 'BrowserBack') {
        event.preventDefault();
        closeTopLayer();
      }
      return;
    }

    switch (key) {
      case 'ArrowLeft':
        event.preventDefault();
        move('left');
        break;

      case 'ArrowRight':
        event.preventDefault();
        move('right');
        break;

      case 'ArrowUp':
        event.preventDefault();
        move('up');
        break;

      case 'ArrowDown':
        event.preventDefault();
        move('down');
        break;

      case 'Enter':
      case 'NumpadEnter':
        event.preventDefault();
        clickFocused();
        break;

      case 'Escape':
      case 'Backspace':
      case 'BrowserBack':
      case 'GoBack':
        event.preventDefault();
        closeTopLayer();
        break;

      case 'MediaPlayPause':
        event.preventDefault();
        togglePlayPause();
        break;

      case 'MediaTrackNext':
        event.preventDefault();
        activateNextPrev(true);
        break;

      case 'MediaTrackPrevious':
        event.preventDefault();
        activateNextPrev(false);
        break;

      default:
        break;
    }
  });

  const observer = new MutationObserver(queueRefresh);

  function boot() {
    injectStyle();
    refreshFocusableElements(false);
    ensureInitialFocus();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'tabindex']
    });

    window.addEventListener('resize', queueRefresh, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();