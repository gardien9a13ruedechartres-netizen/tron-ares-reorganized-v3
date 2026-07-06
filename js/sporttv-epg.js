(() => {
  'use strict';

  const CONFIG = {
    enabled: true,
    endpoint: '/api/sporttv-epg',
    refreshMs: 5 * 60 * 1000
  };

  const CHANNEL_KEYS = {
    'SPORT TV 1': 'sport-tv-1',
    'SPORT TV 2': 'sport-tv-2',
    'SPORT TV 3': 'sport-tv-3',
    'SPORT TV 4': 'sport-tv-4',
    'SPORT TV 5': 'sport-tv-5'
  };

  let guide = null;
  let refreshTimer = null;
  let renderQueued = false;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderGuide();
    });
  }

  function renderGuide() {
    if (!CONFIG.enabled || !guide) return;
    const root = document.getElementById('iframeList');
    if (!root) return;

    root.querySelectorAll('.channel-item').forEach(item => {
      const title = item.querySelector('.channel-title');
      const sub = item.querySelector('.channel-sub');
      if (!title || !sub) return;

      const key = CHANNEL_KEYS[normalize(title.textContent)];
      const schedule = key && guide.channels ? guide.channels[key] : null;
      if (!schedule) return;

      let epg = sub.querySelector('.sporttv-epg');
      if (!epg) {
        epg = document.createElement('span');
        epg.className = 'sporttv-epg';
        sub.textContent = '';
        sub.appendChild(epg);
      }

      const current = schedule.current;
      const next = schedule.next;
      if (!current) {
        epg.textContent = 'Programme indisponible';
        epg.title = '';
        return;
      }

      const live = current.live ? 'DIRECT - ' : '';
      epg.textContent = `${live}${formatTime(current.startsAt)}  ${current.title}`;
      epg.title = next
        ? `Ensuite ${formatTime(next.startsAt)} : ${next.title}`
        : current.subtitle;
    });
  }

  async function refreshGuide() {
    if (!CONFIG.enabled) return;
    try {
      const response = await fetch(CONFIG.endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-cache'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || !payload.channels) throw new Error('Invalid guide');
      guide = payload;
      scheduleRender();
    } catch (error) {
      console.warn('Sport TV EPG unavailable', error);
    }
  }

  function injectStyles() {
    if (document.getElementById('sporttvEpgStyles')) return;
    const style = document.createElement('style');
    style.id = 'sporttvEpgStyles';
    style.textContent = `
      .sporttv-epg {
        display: block;
        min-width: 0;
        overflow: hidden;
        color: #f3f4f6;
        font-size: 11px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .channel-item.active .sporttv-epg { color: #fff; }
    `;
    document.head.appendChild(style);
  }

  function setup() {
    if (!CONFIG.enabled) return;
    injectStyles();

    const root = document.getElementById('iframeList');
    if (root) {
      new MutationObserver(scheduleRender).observe(root, { childList: true, subtree: true });
    }

    refreshGuide();
    refreshTimer = window.setInterval(refreshGuide, CONFIG.refreshMs);
    window.addEventListener('beforeunload', () => clearInterval(refreshTimer), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
