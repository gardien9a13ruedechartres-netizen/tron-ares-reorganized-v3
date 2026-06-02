/*
  Ares Multi-View Module
  Module autonome : ne modifie pas tron-ares.js et fonctionne par lecture du DOM.
*/
(function () {
  'use strict';

  var STORAGE_KEY = 'ares.multiView.v1';
  var DEFAULT_LAYOUT = 6;
  var MAX_SLOTS = 6;

  var state = {
    enabled: false,
    layout: DEFAULT_LAYOUT,
    slots: []
  };

  var refs = {};
  var hlsBySlot = new Map();
  var pickerSlot = 0;
  var externalJsonChannels = [];
  var externalJsonLoaded = false;
  var externalJsonLoading = false;
  var externalPlaybackSnapshot = null;

  /*
    Sources JSON externes lues par le module Multi-View.
    Chemins relatifs uniquement : le module reste indépendant de tron-ares.js.
  */
  var EXTERNAL_JSON_SOURCES = [
    'media/misc/chaines-pt.json',
    'chaines-pt.json'
  ];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function safeJsonParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }

  function loadState() {
    var saved = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
    if (!saved || typeof saved !== 'object') return;
    if (saved.layout === 2 || saved.layout === 4 || saved.layout === 6) state.layout = saved.layout;
    if (Array.isArray(saved.slots)) state.slots = saved.slots.slice(0, MAX_SLOTS);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        layout: state.layout,
        slots: state.slots.slice(0, MAX_SLOTS)
      }));
    } catch (e) {}
  }

  function htmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeText(value, fallback) {
    var txt = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return txt || fallback || '';
  }

  function isYoutubeUrl(url) {
    return /(^|\.)youtube\.com|(^|\.)youtu\.be/i.test(String(url || ''));
  }


  function isIframeFriendlyUrl(url) {
    var value = String(url || '').trim();
    if (!value) return false;
    if (isYoutubeUrl(value)) return true;
    return /(^|\.)dailymotion\.com|(^|\.)twitch\.tv|(^|\.)vimeo\.com|(^|\.)odysee\.com|(^|\.)rumble\.com/i.test(value);
  }

  function isDirectMediaUrl(url) {
    var value = String(url || '').split('#')[0].split('?')[0].toLowerCase();
    return /\.(m3u8|mpd|mp4|m4v|webm|ogv|mov|ts|mp3|aac|m4a|ogg|wav|flac)$/i.test(value);
  }

  function guessTypeFromUrl(url) {
    var value = String(url || '').trim();
    if (!value) return 'stream';
    if (isDirectMediaUrl(value)) return 'stream';
    if (isIframeFriendlyUrl(value)) return 'iframe';
    /*
      Beaucoup de chaînes PT sont des lecteurs web/overlays et non des fichiers vidéo directs.
      Dans ce cas, on les ouvre en iframe dans les mini players.
    */
    return 'iframe';
  }

  function normalizeLogo(raw, fallbackText) {
    if (!raw) return { src: '', text: fallbackText || '?' };
    if (typeof raw === 'string') return { src: raw, text: fallbackText || '?' };
    if (typeof raw === 'object') {
      if (raw.type === 'image' && raw.value) return { src: String(raw.value), text: fallbackText || '?' };
      if (raw.value) return { src: '', text: String(raw.value).slice(0, 2) };
    }
    return { src: '', text: fallbackText || '?' };
  }

  function normalizeJsonItems(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.channels)) return payload.channels;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function normalizeJsonChannel(item, sourceLabel) {
    if (!item || typeof item !== 'object') return null;
    var url = normalizeText(item.url || item.src || item.link || item.href || item.stream || item.iframe, '');
    if (!url) return null;
    var title = normalizeText(item.name || item.title || item.label || item.tvgName, 'Chaîne sans titre');
    var group = normalizeText(item.group || item.category || item.country || sourceLabel || 'chaines-pt.json', 'chaines-pt.json');
    var logo = normalizeLogo(item.logo || item.tvgLogo || item.image || item.icon, title.slice(0, 2));
    var explicitIframe = item.isIframe === true || item.type === 'iframe' || item.kind === 'iframe' || item.listType === 'iframe';
    var explicitStream = item.isIframe === false && (item.type === 'stream' || item.kind === 'stream' || isDirectMediaUrl(url));
    var type = explicitIframe ? 'iframe' : (explicitStream ? 'stream' : guessTypeFromUrl(url));
    return {
      title: title,
      group: group,
      url: url,
      type: type,
      logo: logo.src,
      logoText: logo.text || title.slice(0, 2),
      source: sourceLabel || 'chaines-pt.json'
    };
  }

  async function loadExternalJsonChannels() {
    if (externalJsonLoaded || externalJsonLoading) return externalJsonChannels;
    externalJsonLoading = true;

    var found = false;
    for (var i = 0; i < EXTERNAL_JSON_SOURCES.length; i += 1) {
      var source = EXTERNAL_JSON_SOURCES[i];
      try {
        var res = await fetch(source, { cache: 'no-store' });
        if (!res.ok) continue;
        var payload = await res.json();
        var items = normalizeJsonItems(payload);
        if (!items.length) continue;
        externalJsonChannels = items
          .map(function (item) { return normalizeJsonChannel(item, 'chaines-pt.json'); })
          .filter(Boolean);
        found = true;
        break;
      } catch (e) {}
    }

    externalJsonLoaded = true;
    externalJsonLoading = false;

    if (!found) externalJsonChannels = [];
    return externalJsonChannels;
  }

  function youtubeToEmbed(url) {
    try {
      var u = new URL(url, window.location.href);
      var id = '';
      if (/youtu\.be$/i.test(u.hostname)) id = u.pathname.replace(/^\//, '').split('/')[0];
      else if (u.pathname.indexOf('/shorts/') === 0) id = u.pathname.split('/')[2] || '';
      else if (u.pathname.indexOf('/embed/') === 0) id = u.pathname.split('/')[2] || '';
      else id = u.searchParams.get('v') || '';
      if (!id) return url;
      return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1';
    } catch (e) {
      return url;
    }
  }

  function isHls(url) {
    return /\.m3u8(\?|#|$)/i.test(String(url || '')) || /application\/x-mpegurl/i.test(String(url || ''));
  }

  function isDash(url) {
    return /\.mpd(\?|#|$)/i.test(String(url || ''));
  }

  function destroySlotPlayer(slotIndex) {
    var existing = hlsBySlot.get(slotIndex);
    if (existing) {
      try { existing.destroy(); } catch (e) {}
      hlsBySlot.delete(slotIndex);
    }
  }

  function destroyAllPlayers() {
    Array.from(hlsBySlot.keys()).forEach(destroySlotPlayer);
    if (refs.grid) {
      refs.grid.querySelectorAll('video').forEach(function (video) {
        try { video.pause(); } catch (e) {}
        try { video.removeAttribute('src'); video.load(); } catch (e) {}
      });
      refs.grid.querySelectorAll('iframe').forEach(function (frame) {
        try { frame.src = 'about:blank'; } catch (e) {}
      });
    }
  }

  function ensureSlots() {
    while (state.slots.length < MAX_SLOTS) state.slots.push(null);
    if (state.slots.length > MAX_SLOTS) state.slots = state.slots.slice(0, MAX_SLOTS);
  }

  function buildShell() {
    var main = document.querySelector('main.main');
    var player = document.getElementById('playerContainer');
    if (!main || !player) return false;

    var topRight = document.querySelector('.top-bar-right');
    if (topRight && !document.getElementById('multiViewToggleBtn')) {
      var btn = document.createElement('button');
      btn.className = 'btn btn-ghost ares-mv-toggle';
      btn.id = 'multiViewToggleBtn';
      btn.type = 'button';
      btn.textContent = 'MULTI-VIEW';
      btn.title = 'Ouvrir / fermer le mode multi-view';
      topRight.insertBefore(btn, topRight.firstChild);
      refs.toggleBtn = btn;
    } else {
      refs.toggleBtn = document.getElementById('multiViewToggleBtn');
    }

    var section = document.getElementById('aresMultiView');
    if (!section) {
      section = document.createElement('section');
      section.id = 'aresMultiView';
      section.className = 'ares-multiview';
      section.setAttribute('aria-label', 'Multi-view');
      section.innerHTML =
        '<div class="ares-mv-header">' +
          '<div class="ares-mv-title-wrap">' +
            '<h2 class="ares-mv-title">MULTI-VIEW</h2>' +
            '<div class="ares-mv-subtitle" id="aresMvSubtitle">Theater mode: watching 6 channels simultaneously</div>' +
          '</div>' +
          '<div class="ares-mv-layout" role="group" aria-label="Choisir le nombre de vues">' +
            '<span class="ares-mv-layout-label">Layout</span>' +
            '<button class="ares-mv-layout-btn" type="button" data-layout="2">2</button>' +
            '<button class="ares-mv-layout-btn" type="button" data-layout="4">4</button>' +
            '<button class="ares-mv-layout-btn" type="button" data-layout="6">6</button>' +
          '</div>' +
        '</div>' +
        '<div class="ares-mv-grid" id="aresMvGrid" data-layout="6"></div>';
      player.insertAdjacentElement('afterend', section);
    }

    var picker = document.getElementById('aresMvPicker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'aresMvPicker';
      picker.className = 'ares-mv-picker';
      picker.setAttribute('aria-hidden', 'true');
      picker.innerHTML =
        '<div class="ares-mv-picker-card" role="dialog" aria-modal="true" aria-label="Ajouter une chaîne au multi-view">' +
          '<div class="ares-mv-picker-head">' +
            '<div class="ares-mv-picker-title">Ajouter une chaîne</div>' +
            '<input id="aresMvPickerSearch" class="ares-mv-picker-search" type="text" placeholder="Rechercher chaînes FR, PT, iFrames, favoris…" autocomplete="off" spellcheck="false">' +
            '<button id="aresMvPickerClose" class="ares-mv-picker-close" type="button" title="Fermer">✕</button>' +
          '</div>' +
          '<div id="aresMvList" class="ares-mv-list"></div>' +
        '</div>';
      document.body.appendChild(picker);
    }

    refs.main = main;
    refs.section = section;
    refs.grid = document.getElementById('aresMvGrid');
    refs.subtitle = document.getElementById('aresMvSubtitle');
    refs.layoutButtons = Array.prototype.slice.call(section.querySelectorAll('.ares-mv-layout-btn'));
    refs.picker = picker;
    refs.pickerSearch = document.getElementById('aresMvPickerSearch');
    refs.pickerClose = document.getElementById('aresMvPickerClose');
    refs.list = document.getElementById('aresMvList');

    return true;
  }


  function isInsideMultiViewNode(node) {
    if (!node || !node.closest) return false;
    return !!node.closest('#aresMultiView, #aresMvPicker');
  }

  function snapshotExternalPlayback() {
    if (externalPlaybackSnapshot) return;

    externalPlaybackSnapshot = {
      media: [],
      frames: []
    };

    document.querySelectorAll('video,audio').forEach(function (media) {
      if (isInsideMultiViewNode(media)) return;

      externalPlaybackSnapshot.media.push({
        el: media,
        muted: !!media.muted,
        volume: typeof media.volume === 'number' ? media.volume : 1
      });

      try { media.muted = true; } catch (e) {}
      try { media.volume = 0; } catch (e2) {}
    });

    /*
      Le son d'une iframe externe ne peut pas être coupé proprement par JavaScript
      quand le lecteur vient d'un autre domaine. Pour éviter le son en arrière-plan,
      on suspend temporairement l'iframe externe, puis on restaure son URL à la sortie.
      Les iframes des mini players Multi-View sont exclues.
    */
    document.querySelectorAll('iframe').forEach(function (frame) {
      if (isInsideMultiViewNode(frame)) return;

      var src = frame.getAttribute('src') || '';
      if (!src || src === 'about:blank') return;

      externalPlaybackSnapshot.frames.push({
        el: frame,
        src: src
      });

      try { frame.src = 'about:blank'; } catch (e) {}
    });
  }

  function restoreExternalPlayback() {
    if (!externalPlaybackSnapshot) return;

    externalPlaybackSnapshot.media.forEach(function (item) {
      var media = item.el;
      if (!media || !media.isConnected) return;
      try { media.muted = item.muted; } catch (e) {}
      try { media.volume = item.volume; } catch (e2) {}
    });

    externalPlaybackSnapshot.frames.forEach(function (item) {
      var frame = item.el;
      if (!frame || !frame.isConnected) return;
      try { frame.src = item.src; } catch (e) {}
    });

    externalPlaybackSnapshot = null;
  }

  function bindEvents() {
    if (refs.toggleBtn) {
      refs.toggleBtn.addEventListener('click', function () {
        setEnabled(!state.enabled);
      });
    }

    refs.layoutButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLayout(Number(btn.getAttribute('data-layout')) || DEFAULT_LAYOUT);
      });
    });

    refs.pickerClose.addEventListener('click', closePicker);
    refs.picker.addEventListener('click', function (ev) {
      if (ev.target === refs.picker) closePicker();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && refs.picker.classList.contains('is-open')) closePicker();
    });
    refs.pickerSearch.addEventListener('input', renderPickerList);
  }

  function setEnabled(enabled) {
    state.enabled = !!enabled;
    refs.main.classList.toggle('multi-view-active', state.enabled);
    if (refs.toggleBtn) refs.toggleBtn.classList.toggle('is-active', state.enabled);
    if (state.enabled) {
      snapshotExternalPlayback();
      renderGrid();
    } else {
      closePicker();
      destroyAllPlayers();
      restoreExternalPlayback();
    }
  }

  function setLayout(layout) {
    if (layout !== 2 && layout !== 4 && layout !== 6) layout = DEFAULT_LAYOUT;
    state.layout = layout;
    saveState();
    updateLayoutUi();
    renderGrid();
  }

  function updateLayoutUi() {
    if (refs.grid) refs.grid.setAttribute('data-layout', String(state.layout));
    if (refs.subtitle) refs.subtitle.textContent = 'Theater mode: watching ' + state.layout + ' channels simultaneously';
    refs.layoutButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.getAttribute('data-layout')) === state.layout);
    });
  }

  function renderGrid() {
    ensureSlots();
    updateLayoutUi();
    if (!refs.grid) return;

    destroyAllPlayers();
    refs.grid.innerHTML = '';

    for (var i = 0; i < state.layout; i += 1) {
      refs.grid.appendChild(renderSlot(i));
    }
  }

  function renderSlot(index) {
    var entry = state.slots[index];
    var slot = document.createElement('div');
    slot.className = 'ares-mv-slot' + (entry ? '' : ' is-empty');
    slot.setAttribute('data-slot', String(index));

    if (!entry) {
      slot.innerHTML =
        '<div class="ares-mv-empty-inner">' +
          '<button class="ares-mv-add-btn" type="button" aria-label="Ajouter une chaîne">+</button>' +
          '<div class="ares-mv-empty-text">Add Channel</div>' +
        '</div>';
      slot.querySelector('.ares-mv-add-btn').addEventListener('click', function () { openPicker(index); });
      return slot;
    }

    var player = document.createElement('div');
    player.className = 'ares-mv-player';
    slot.appendChild(player);

    createMediaForSlot(index, entry, player);

    var bar = document.createElement('div');
    bar.className = 'ares-mv-tile-bar';
    var isIframeEntry = entry.type === 'iframe' || guessTypeFromUrl(entry.url) === 'iframe' || isYoutubeUrl(entry.url);
    bar.innerHTML =
      '<div class="ares-mv-tile-title" title="' + htmlEscape(entry.title) + '">' + htmlEscape(entry.title) + '</div>' +
      (isIframeEntry ? '' : '<button class="ares-mv-action" type="button" data-action="mute" title="Son / muet">🔇</button>') +
      '<button class="ares-mv-action" type="button" data-action="replace" title="Remplacer">＋</button>' +
      '<button class="ares-mv-action" type="button" data-action="full" title="Plein écran">⛶</button>' +
      '<button class="ares-mv-action is-danger" type="button" data-action="remove" title="Retirer">✕</button>';
    slot.appendChild(bar);

    bar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'remove') removeSlot(index);
      if (action === 'replace') openPicker(index);
      if (action === 'full') requestSlotFullscreen(slot);
      if (action === 'mute') toggleSlotAudio(slot, btn);
    });

    return slot;
  }

  function createMediaForSlot(index, entry, holder) {
    var url = String(entry.url || '');
    if (!url) return;

    if (entry.type === 'iframe' || guessTypeFromUrl(url) === 'iframe' || isYoutubeUrl(url)) {
      var frame = document.createElement('iframe');
      frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'origin';
      frame.src = isYoutubeUrl(url) ? youtubeToEmbed(url) : url;
      holder.appendChild(frame);
      return;
    }

    var video = document.createElement('video');
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    holder.appendChild(video);

    if (isHls(url) && window.Hls && window.Hls.isSupported()) {
      try {
        var hls = new window.Hls({ lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hlsBySlot.set(index, hls);
      } catch (e) {
        video.src = url;
      }
    } else if (isDash(url) && window.dashjs) {
      try {
        var dash = window.dashjs.MediaPlayer().create();
        dash.initialize(video, url, true);
      } catch (e2) {
        video.src = url;
      }
    } else {
      video.src = url;
    }

    video.play().catch(function () {});
  }

  function toggleSlotAudio(slot, btn) {
    var video = slot.querySelector('video');
    if (!video) return;
    var nextMuted = !video.muted ? true : false;

    if (!nextMuted) {
      refs.grid.querySelectorAll('video').forEach(function (other) {
        if (other !== video) other.muted = true;
      });
      refs.grid.querySelectorAll('[data-action="mute"]').forEach(function (otherBtn) {
        otherBtn.textContent = '🔇';
      });
    }

    video.muted = nextMuted;
    btn.textContent = video.muted ? '🔇' : '🔊';
  }

  function requestSlotFullscreen(slot) {
    var target = slot.querySelector('video') || slot.querySelector('iframe') || slot;
    try {
      if (target.requestFullscreen) target.requestFullscreen();
      else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    } catch (e) {}
  }

  function removeSlot(index) {
    destroySlotPlayer(index);
    state.slots[index] = null;
    saveState();
    renderGrid();
  }

  function openPicker(index) {
    pickerSlot = index;
    refs.picker.classList.add('is-open');
    refs.picker.setAttribute('aria-hidden', 'false');
    refs.pickerSearch.value = '';
    renderPickerList();
    loadExternalJsonChannels().then(function () {
      if (refs.picker.classList.contains('is-open')) renderPickerList();
    });
    setTimeout(function () { refs.pickerSearch.focus(); }, 30);
  }

  function closePicker() {
    refs.picker.classList.remove('is-open');
    refs.picker.setAttribute('aria-hidden', 'true');
  }

  function collectChannels() {
    var map = new Map();
    var selectors = [
      '#channelFrList .channel-item[data-url]',
      '#channelList .channel-item[data-url]',
      '#iframeList .channel-item[data-url]',
      '#favoriteList .channel-item[data-url]',
      '#torrentList .channel-item[data-url]'
    ];

    function addEntry(entry) {
      if (!entry || !entry.url) return;
      var key = String(entry.url) + '|' + String(entry.title || '');
      if (map.has(key)) return;
      map.set(key, entry);
    }

    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (item) {
        var url = item.dataset.url || '';
        if (!url) return;

        var rawType = item.dataset.type || '';
        var title = normalizeText(
          item.querySelector('.channel-title') && item.querySelector('.channel-title').textContent,
          'Chaîne sans titre'
        );
        var group = normalizeText(
          item.querySelector('.channel-sub') && item.querySelector('.channel-sub').textContent,
          rawType || 'Flux'
        );
        var logoImg = item.querySelector('.channel-logo img');
        var logoText = normalizeText(item.querySelector('.channel-logo') && item.querySelector('.channel-logo').textContent, title.slice(0, 1));
        var hasIframeChip = !!item.querySelector('.tag-chip--iframe, [data-type="iframe"], [data-iframe="true"]');
        var isIframeList = !!item.closest('#iframeList');
        var type = (rawType === 'iframe' || hasIframeChip || isIframeList) ? 'iframe' : guessTypeFromUrl(url);

        addEntry({
          title: title,
          group: group,
          url: url,
          type: type,
          logo: logoImg ? logoImg.src : '',
          logoText: logoText || title.slice(0, 1),
          source: isIframeList ? 'Onglet PT / iFrame' : 'Page'
        });
      });
    });

    externalJsonChannels.forEach(addEntry);

    return Array.from(map.values());
  }

  function renderPickerList() {
    var q = normalizeText(refs.pickerSearch.value, '').toLowerCase();
    var channels = collectChannels().filter(function (entry) {
      if (!q) return true;
      return (entry.title + ' ' + entry.group + ' ' + entry.url).toLowerCase().indexOf(q) !== -1;
    });

    refs.list.innerHTML = '';
    if (!channels.length) {
      refs.list.innerHTML = '<div class="ares-mv-empty-picker">Aucune chaîne disponible. Le module cherche dans les listes visibles et dans media/misc/chaines-pt.json.</div>';
      return;
    }

    channels.slice(0, 250).forEach(function (entry) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ares-mv-list-item';
      var logo = entry.logo
        ? '<img src="' + htmlEscape(entry.logo) + '" alt="">'
        : htmlEscape((entry.logoText || entry.title || '?').slice(0, 2).toUpperCase());
      btn.innerHTML =
        '<span class="ares-mv-list-logo">' + logo + '</span>' +
        '<span class="ares-mv-list-meta">' +
          '<span class="ares-mv-list-title">' + htmlEscape(entry.title) + '</span>' +
          '<span class="ares-mv-list-sub">' + htmlEscape(entry.group + ' • ' + (entry.type === 'iframe' ? 'IFRAME' : 'STREAM')) + '</span>' +
        '</span>';
      btn.addEventListener('click', function () {
        state.slots[pickerSlot] = entry;
        saveState();
        closePicker();
        renderGrid();
      });
      refs.list.appendChild(btn);
    });
  }

  ready(function () {
    loadState();
    ensureSlots();
    if (!buildShell()) return;
    bindEvents();
    updateLayoutUi();
    renderGrid();
    loadExternalJsonChannels();
  });
})();
