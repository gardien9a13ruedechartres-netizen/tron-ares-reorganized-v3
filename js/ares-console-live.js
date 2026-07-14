/*
  Ares Media Engine — Console Live
  Module autonome : capture les logs sans modifier tron-ares.js ni ares-multi-view.js.
*/
(function () {
  'use strict';

  if (window.__ARES_CONSOLE_LIVE__) return;

  var MAX_ENTRIES = 5000;
  var entries = [];
  var nextId = 1;
  var activeFilter = 'all';
  var warningCount = 0;
  var errorCount = 0;
  var uiReady = false;
  var refs = {};
  var xhrMeta = new WeakMap();
  var consoleTimers = new Map();
  var consoleCounters = new Map();

  var originalConsole = {};
  [
    'log', 'info', 'warn', 'error', 'debug', 'dir', 'table', 'trace',
    'assert', 'count', 'countReset', 'time', 'timeLog', 'timeEnd',
    'group', 'groupCollapsed', 'groupEnd', 'clear'
  ].forEach(function (method) {
    if (typeof console[method] === 'function') {
      originalConsole[method] = console[method].bind(console);
    }
  });

  function nowTime() {
    var d = new Date();
    return [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      String(d.getSeconds()).padStart(2, '0')
    ].join(':') + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function typeOfValue(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function serializeObject(value) {
    var seen = new WeakSet();
    return JSON.stringify(value, function (key, item) {
      if (typeof item === 'bigint') return String(item) + 'n';
      if (typeof item === 'symbol') return item.toString();
      if (typeof item === 'function') return '[Function ' + (item.name || 'anonymous') + ']';
      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack || ''
        };
      }
      if (typeof Element !== 'undefined' && item instanceof Element) {
        var id = item.id ? '#' + item.id : '';
        var cls = item.className && typeof item.className === 'string'
          ? '.' + item.className.trim().replace(/\s+/g, '.')
          : '';
        return '<' + String(item.tagName || 'element').toLowerCase() + id + cls + '>';
      }
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
      }
      return item;
    }, 2);
  }

  function formatValue(value) {
    var type = typeOfValue(value);

    if (type === 'string') return value;
    if (type === 'undefined') return 'undefined';
    if (type === 'null') return 'null';
    if (type === 'number' || type === 'boolean') return String(value);
    if (type === 'bigint') return String(value) + 'n';
    if (type === 'symbol') return value.toString();
    if (type === 'function') return '[Function ' + (value.name || 'anonymous') + ']';

    if (value instanceof Error) {
      return value.stack || (value.name + ': ' + value.message);
    }

    try {
      var serialized = serializeObject(value);
      if (typeof serialized === 'string') return serialized;
    } catch (e) {}

    try {
      return String(value);
    } catch (e2) {
      return '[Valeur impossible à afficher]';
    }
  }

  function normalizeType(type) {
    var value = String(type || 'log').toLowerCase();
    if (value === 'warning') return 'warn';
    if (['log', 'info', 'warn', 'error', 'debug', 'network', 'system'].indexOf(value) !== -1) {
      return value;
    }
    return 'log';
  }

  function pushEntry(type, values, meta) {
    var normalizedType = normalizeType(type);
    var list = Array.isArray(values) ? values : [values];
    var message = list.map(formatValue).join(' ');
    var entry = {
      id: nextId++,
      time: nowTime(),
      date: new Date().toISOString(),
      type: normalizedType,
      message: message,
      source: meta && meta.source ? String(meta.source) : 'PAGE'
    };

    entries.push(entry);

    if (normalizedType === 'warn') warningCount += 1;
    if (normalizedType === 'error') errorCount += 1;

    if (entries.length > MAX_ENTRIES) {
      entries.shift();
      if (uiReady) rebuildOutput();
    } else if (uiReady) {
      appendEntry(entry);
    }

    updateBadge();
    return entry;
  }

  function callOriginal(method, args) {
    if (!originalConsole[method]) return;
    try {
      originalConsole[method].apply(null, args);
    } catch (e) {}
  }

  function installSimpleConsoleMethod(method, type) {
    if (!originalConsole[method]) return;
    console[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      callOriginal(method, args);
      pushEntry(type || method, args, { source: 'CONSOLE' });
    };
  }

  installSimpleConsoleMethod('log', 'log');
  installSimpleConsoleMethod('info', 'info');
  installSimpleConsoleMethod('warn', 'warn');
  installSimpleConsoleMethod('error', 'error');
  installSimpleConsoleMethod('debug', 'debug');
  installSimpleConsoleMethod('dir', 'log');
  installSimpleConsoleMethod('table', 'log');

  if (originalConsole.trace) {
    console.trace = function () {
      var args = Array.prototype.slice.call(arguments);
      callOriginal('trace', args);
      var stack = '';
      try { stack = new Error().stack || ''; } catch (e) {}
      pushEntry('debug', ['console.trace', args.length ? args : '', stack], { source: 'CONSOLE' });
    };
  }

  if (originalConsole.assert) {
    console.assert = function (condition) {
      var args = Array.prototype.slice.call(arguments, 1);
      callOriginal('assert', [condition].concat(args));
      if (!condition) {
        pushEntry('error', ['Assertion échouée:', args.length ? args : 'Aucun message'], { source: 'CONSOLE' });
      }
    };
  }

  if (originalConsole.count) {
    console.count = function (label) {
      var key = label == null ? 'default' : String(label);
      var count = (consoleCounters.get(key) || 0) + 1;
      consoleCounters.set(key, count);
      callOriginal('count', [label]);
      pushEntry('log', [key + ': ' + count], { source: 'CONSOLE' });
    };
  }

  if (originalConsole.countReset) {
    console.countReset = function (label) {
      var key = label == null ? 'default' : String(label);
      consoleCounters.delete(key);
      callOriginal('countReset', [label]);
      pushEntry('debug', ['Compteur réinitialisé:', key], { source: 'CONSOLE' });
    };
  }

  if (originalConsole.time) {
    console.time = function (label) {
      var key = label == null ? 'default' : String(label);
      consoleTimers.set(key, performance.now());
      callOriginal('time', [label]);
      pushEntry('debug', ['Timer démarré:', key], { source: 'CONSOLE' });
    };
  }

  if (originalConsole.timeLog) {
    console.timeLog = function (label) {
      var args = Array.prototype.slice.call(arguments, 1);
      var key = label == null ? 'default' : String(label);
      var start = consoleTimers.get(key);
      var elapsed = typeof start === 'number' ? (performance.now() - start).toFixed(2) + ' ms' : 'timer inconnu';
      callOriginal('timeLog', [label].concat(args));
      pushEntry('debug', [key + ': ' + elapsed].concat(args), { source: 'CONSOLE' });
    };
  }

  if (originalConsole.timeEnd) {
    console.timeEnd = function (label) {
      var key = label == null ? 'default' : String(label);
      var start = consoleTimers.get(key);
      var elapsed = typeof start === 'number' ? (performance.now() - start).toFixed(2) + ' ms' : 'timer inconnu';
      consoleTimers.delete(key);
      callOriginal('timeEnd', [label]);
      pushEntry('debug', [key + ': ' + elapsed], { source: 'CONSOLE' });
    };
  }

  ['group', 'groupCollapsed'].forEach(function (method) {
    if (!originalConsole[method]) return;
    console[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      callOriginal(method, args);
      pushEntry('debug', [(method === 'group' ? '▼ Groupe:' : '▶ Groupe réduit:')].concat(args), { source: 'CONSOLE' });
    };
  });

  if (originalConsole.groupEnd) {
    console.groupEnd = function () {
      callOriginal('groupEnd', []);
      pushEntry('debug', ['▲ Fin du groupe'], { source: 'CONSOLE' });
    };
  }

  if (originalConsole.clear) {
    console.clear = function () {
      callOriginal('clear', []);
      pushEntry('system', ['console.clear() appelé — historique Ares conservé'], { source: 'CONSOLE' });
    };
  }

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window && target.tagName) {
      var resourceUrl = target.src || target.href || '';
      pushEntry('error', [
        'Ressource impossible à charger:',
        String(target.tagName).toUpperCase(),
        resourceUrl || '(URL inconnue)'
      ], { source: 'RESOURCE' });
      return;
    }

    var parts = ['Erreur JavaScript non interceptée:', event.message || 'Erreur inconnue'];
    if (event.filename) parts.push('\nFichier: ' + event.filename);
    if (event.lineno) parts.push('\nLigne: ' + event.lineno);
    if (event.colno) parts.push('\nColonne: ' + event.colno);
    if (event.error && event.error.stack) parts.push('\n' + event.error.stack);
    pushEntry('error', parts, { source: 'WINDOW' });
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    pushEntry('error', ['Promesse rejetée non gérée:', event.reason], { source: 'PROMISE' });
  });

  var originalFetch = typeof window.fetch === 'function' ? window.fetch : null;
  if (originalFetch) {
    window.fetch = function () {
      var args = Array.prototype.slice.call(arguments);
      var request = args[0];
      var options = args[1] || {};
      var url = typeof request === 'string'
        ? request
        : (request && request.url ? request.url : String(request));
      var method = String(options.method || (request && request.method) || 'GET').toUpperCase();
      var started = performance.now();

      pushEntry('network', [method, url, '→ départ'], { source: 'FETCH' });

      return originalFetch.apply(this, args).then(function (response) {
        var elapsed = Math.round(performance.now() - started);
        pushEntry(response.ok ? 'network' : 'warn', [
          method,
          url,
          '→',
          response.status,
          response.statusText || '',
          '(' + elapsed + ' ms)'
        ], { source: 'FETCH' });
        return response;
      }).catch(function (error) {
        var elapsed = Math.round(performance.now() - started);
        pushEntry('error', [method, url, '→ ÉCHEC', '(' + elapsed + ' ms)', error], { source: 'FETCH' });
        throw error;
      });
    };
  }

  var originalXhrOpen = XMLHttpRequest.prototype.open;
  var originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    xhrMeta.set(this, {
      method: String(method || 'GET').toUpperCase(),
      url: String(url || ''),
      started: 0
    });
    return originalXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var meta = xhrMeta.get(xhr) || { method: 'GET', url: '(URL inconnue)', started: 0 };
    meta.started = performance.now();
    xhrMeta.set(xhr, meta);

    pushEntry('network', [meta.method, meta.url, '→ départ'], { source: 'XHR' });

    function onDone() {
      xhr.removeEventListener('loadend', onDone);
      var elapsed = Math.round(performance.now() - meta.started);
      var status = Number(xhr.status || 0);
      var type = status >= 200 && status < 400 ? 'network' : (status === 0 ? 'error' : 'warn');
      pushEntry(type, [
        meta.method,
        meta.url,
        '→',
        status || 'ÉCHEC',
        xhr.statusText || '',
        '(' + elapsed + ' ms)'
      ], { source: 'XHR' });
    }

    xhr.addEventListener('loadend', onDone);
    return originalXhrSend.apply(this, arguments);
  };

  if (navigator && typeof navigator.sendBeacon === 'function') {
    var originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      var ok = false;
      try {
        ok = originalSendBeacon(url, data);
        pushEntry(ok ? 'network' : 'warn', ['BEACON', String(url), '→', ok ? 'envoyé' : 'refusé'], { source: 'BEACON' });
        return ok;
      } catch (error) {
        pushEntry('error', ['BEACON', String(url), '→ ÉCHEC', error], { source: 'BEACON' });
        throw error;
      }
    };
  }

  function injectStyles() {
    if (document.getElementById('aresConsoleLiveStyles')) return;

    var style = document.createElement('style');
    style.id = 'aresConsoleLiveStyles';
    style.textContent = [
      '#aresConsoleToggleBtn{position:relative;min-width:auto!important;padding:5px 8px!important;font-size:9px!important;letter-spacing:.10em!important;opacity:.78;}',
      '#aresConsoleToggleBtn:hover,#aresConsoleToggleBtn.is-open{opacity:1;}',
      '#aresConsoleBadge{display:none;min-width:16px;height:16px;margin-left:5px;padding:0 4px;border-radius:999px;align-items:center;justify-content:center;font-size:8px;line-height:16px;color:#fff;background:rgba(255,82,82,.88);box-shadow:0 0 8px rgba(255,82,82,.55);}',
      '#aresConsoleBadge.is-visible{display:inline-flex;}',
      '#aresConsolePanel{position:fixed;top:54px;right:12px;z-index:100000;width:min(920px,calc(100vw - 24px));height:min(72vh,720px);display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(0,229,255,.55);border-radius:16px;background:linear-gradient(145deg,rgba(2,4,10,.985),rgba(3,13,25,.985));box-shadow:0 0 34px rgba(0,229,255,.28),0 0 30px rgba(255,145,0,.12);color:var(--tron-text,#e0f7ff);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '#aresConsolePanel.is-open{display:flex;}',
      '.ares-console-head{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid rgba(0,229,255,.22);background:rgba(0,0,0,.58);}',
      '.ares-console-title{margin-right:auto;font-family:"Orbitron",system-ui,sans-serif;font-size:11px;letter-spacing:.13em;color:var(--tron-accent-soft,#ffb74d);white-space:nowrap;}',
      '.ares-console-head button,.ares-console-filter{border:1px solid rgba(0,229,255,.3);border-radius:999px;background:rgba(0,0,0,.55);color:var(--tron-text,#e0f7ff);padding:5px 8px;font-size:9px;letter-spacing:.08em;cursor:pointer;}',
      '.ares-console-head button:hover,.ares-console-filter:hover,.ares-console-filter.is-active{border-color:var(--tron-accent,#ff9100);box-shadow:0 0 9px rgba(255,145,0,.35);}',
      '.ares-console-tools{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:7px 9px;border-bottom:1px solid rgba(0,229,255,.16);background:rgba(2,8,18,.82);}',
      '#aresConsoleSearch{flex:1 1 190px;min-width:150px;height:27px;border:1px solid rgba(0,229,255,.3);border-radius:999px;background:rgba(0,0,0,.55);color:var(--tron-text,#e0f7ff);padding:0 10px;font-size:10px;outline:none;}',
      '#aresConsoleSearch:focus{border-color:var(--tron-accent,#ff9100);box-shadow:0 0 9px rgba(255,145,0,.28);}',
      '#aresConsoleOutput{flex:1;min-height:0;overflow:auto;padding:5px 7px;background:rgba(0,0,0,.42);font-family:Consolas,Monaco,"Courier New",monospace;font-size:11px;line-height:1.45;scrollbar-width:thin;scrollbar-color:#00e5ff #050b18;}',
      '.ares-console-line{display:grid;grid-template-columns:92px 66px minmax(0,1fr);gap:6px;padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.045);white-space:pre-wrap;overflow-wrap:anywhere;}',
      '.ares-console-line.is-hidden{display:none;}',
      '.ares-console-meta{color:#64748b;white-space:nowrap;}',
      '.ares-console-type{font-weight:700;text-transform:uppercase;white-space:nowrap;}',
      '.ares-console-line[data-type="log"] .ares-console-type{color:#e5e7eb;}',
      '.ares-console-line[data-type="info"] .ares-console-type{color:#7dd3fc;}',
      '.ares-console-line[data-type="warn"] .ares-console-type{color:#fde047;}',
      '.ares-console-line[data-type="error"] .ares-console-type{color:#fca5a5;}',
      '.ares-console-line[data-type="debug"] .ares-console-type{color:#c4b5fd;}',
      '.ares-console-line[data-type="network"] .ares-console-type{color:#86efac;}',
      '.ares-console-line[data-type="system"] .ares-console-type{color:#fdba74;}',
      '.ares-console-message{color:#dbeafe;min-width:0;}',
      '.ares-console-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;padding:5px 9px;border-top:1px solid rgba(0,229,255,.16);background:rgba(0,0,0,.58);font-size:9px;color:var(--tron-muted,#7f9fb3);}',
      '#aresConsoleStatus{color:#86efac;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '@media(max-width:768px){#aresConsolePanel{top:52px;right:6px;width:calc(100vw - 12px);height:calc(100dvh - 64px);border-radius:12px}.ares-console-head{flex-wrap:wrap}.ares-console-title{width:100%;margin-right:0}.ares-console-line{grid-template-columns:74px 54px minmax(0,1fr);font-size:10px}.ares-console-head button,.ares-console-filter{padding:5px 7px;font-size:8px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createButton() {
    var btn = document.getElementById('aresConsoleToggleBtn');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'aresConsoleToggleBtn';
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.title = 'Ouvrir la console live de la page';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span>LOGS</span><span id="aresConsoleBadge" aria-hidden="true"></span>';
    return btn;
  }

  function placeToggleBeforeMultiView() {
    if (!refs.toggle) refs.toggle = createButton();
    var topRight = document.querySelector('.top-bar-right');
    if (!topRight) return false;

    var multi = document.getElementById('multiViewToggleBtn');
    if (multi) {
      if (multi.previousElementSibling !== refs.toggle) {
        topRight.insertBefore(refs.toggle, multi);
      }
    } else if (!refs.toggle.parentNode) {
      topRight.insertBefore(refs.toggle, topRight.firstChild);
    }
    return true;
  }

  function buildPanel() {
    var panel = document.getElementById('aresConsolePanel');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'aresConsolePanel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="ares-console-head">' +
        '<div class="ares-console-title">CONSOLE LIVE <span id="aresConsoleCount">0</span></div>' +
        '<button type="button" id="aresConsoleCopyBtn">COPIER</button>' +
        '<button type="button" id="aresConsoleDownloadBtn">TXT</button>' +
        '<button type="button" id="aresConsoleClearBtn">EFFACER</button>' +
        '<button type="button" id="aresConsoleCloseBtn">FERMER</button>' +
      '</div>' +
      '<div class="ares-console-tools">' +
        '<button type="button" class="ares-console-filter is-active" data-filter="all">TOUS</button>' +
        '<button type="button" class="ares-console-filter" data-filter="log">LOG</button>' +
        '<button type="button" class="ares-console-filter" data-filter="info">INFO</button>' +
        '<button type="button" class="ares-console-filter" data-filter="warn">WARN</button>' +
        '<button type="button" class="ares-console-filter" data-filter="error">ERREUR</button>' +
        '<button type="button" class="ares-console-filter" data-filter="debug">DEBUG</button>' +
        '<button type="button" class="ares-console-filter" data-filter="network">RÉSEAU</button>' +
        '<button type="button" class="ares-console-filter" data-filter="system">SYSTÈME</button>' +
        '<input id="aresConsoleSearch" type="search" placeholder="Rechercher dans les logs…" autocomplete="off" spellcheck="false">' +
      '</div>' +
      '<div id="aresConsoleOutput" aria-live="polite"></div>' +
      '<div class="ares-console-foot"><span id="aresConsoleStatus"></span><span>Maximum ' + MAX_ENTRIES + ' entrées</span></div>';

    document.body.appendChild(panel);
    return panel;
  }

  function cacheRefs() {
    refs.panel = document.getElementById('aresConsolePanel');
    refs.output = document.getElementById('aresConsoleOutput');
    refs.search = document.getElementById('aresConsoleSearch');
    refs.count = document.getElementById('aresConsoleCount');
    refs.badge = document.getElementById('aresConsoleBadge');
    refs.status = document.getElementById('aresConsoleStatus');
  }

  function matchesView(entry) {
    if (activeFilter !== 'all' && entry.type !== activeFilter) return false;
    var query = refs.search ? refs.search.value.trim().toLowerCase() : '';
    if (!query) return true;
    return (
      entry.message.toLowerCase().indexOf(query) !== -1 ||
      entry.type.toLowerCase().indexOf(query) !== -1 ||
      entry.source.toLowerCase().indexOf(query) !== -1
    );
  }

  function createEntryNode(entry) {
    var line = document.createElement('div');
    line.className = 'ares-console-line';
    line.dataset.type = entry.type;
    line.dataset.entryId = String(entry.id);

    var meta = document.createElement('span');
    meta.className = 'ares-console-meta';
    meta.textContent = entry.time + ' ' + entry.source;

    var type = document.createElement('span');
    type.className = 'ares-console-type';
    type.textContent = entry.type;

    var message = document.createElement('span');
    message.className = 'ares-console-message';
    message.textContent = entry.message;

    line.appendChild(meta);
    line.appendChild(type);
    line.appendChild(message);

    if (!matchesView(entry)) line.classList.add('is-hidden');
    return line;
  }

  function appendEntry(entry) {
    if (!refs.output) return;
    var shouldStick = refs.output.scrollTop + refs.output.clientHeight >= refs.output.scrollHeight - 40;
    refs.output.appendChild(createEntryNode(entry));
    if (shouldStick) refs.output.scrollTop = refs.output.scrollHeight;
    updateCount();
  }

  function rebuildOutput() {
    if (!refs.output) return;
    var fragment = document.createDocumentFragment();
    entries.forEach(function (entry) {
      fragment.appendChild(createEntryNode(entry));
    });
    refs.output.replaceChildren(fragment);
    refs.output.scrollTop = refs.output.scrollHeight;
    updateCount();
  }

  function refreshVisibility() {
    if (!refs.output) return;
    var byId = new Map();
    entries.forEach(function (entry) { byId.set(String(entry.id), entry); });
    refs.output.querySelectorAll('.ares-console-line').forEach(function (line) {
      var entry = byId.get(line.dataset.entryId);
      line.classList.toggle('is-hidden', !entry || !matchesView(entry));
    });
  }

  function updateCount() {
    if (refs.count) refs.count.textContent = '(' + entries.length + ')';
  }

  function updateBadge() {
    if (!refs.badge) return;
    var total = warningCount + errorCount;
    refs.badge.textContent = total > 99 ? '99+' : String(total);
    refs.badge.classList.toggle('is-visible', total > 0);
  }

  function setStatus(message, isError) {
    if (!refs.status) return;
    refs.status.textContent = message || '';
    refs.status.style.color = isError ? '#fca5a5' : '#86efac';
    if (message) {
      window.setTimeout(function () {
        if (refs.status && refs.status.textContent === message) refs.status.textContent = '';
      }, 2800);
    }
  }

  function openPanel() {
    refs.panel.classList.add('is-open');
    refs.panel.setAttribute('aria-hidden', 'false');
    refs.toggle.classList.add('is-open');
    refs.toggle.setAttribute('aria-expanded', 'true');
    refs.output.scrollTop = refs.output.scrollHeight;
  }

  function closePanel() {
    refs.panel.classList.remove('is-open');
    refs.panel.setAttribute('aria-hidden', 'true');
    refs.toggle.classList.remove('is-open');
    refs.toggle.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (refs.panel.classList.contains('is-open')) closePanel();
    else openPanel();
  }

  function allLogsAsText() {
    var header = [
      'ARES MEDIA ENGINE — CONSOLE LIVE',
      'Page: ' + location.href,
      'Export: ' + new Date().toISOString(),
      'Entrées: ' + entries.length,
      'Warnings: ' + warningCount,
      'Erreurs: ' + errorCount,
      '------------------------------------------------------------'
    ];

    var body = entries.map(function (entry) {
      return '[' + entry.date + '] [' + entry.source + '] [' + entry.type.toUpperCase() + '] ' + entry.message;
    });

    return header.concat(body).join('\n');
  }

  function copyLogs() {
    var text = allLogsAsText();

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(function () {
        setStatus(entries.length + ' log(s) copié(s).', false);
      }).catch(function () {
        fallbackCopy(text);
      });
      return;
    }

    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    textarea.remove();
    setStatus(ok ? entries.length + ' log(s) copié(s).' : 'Copie impossible.', !ok);
  }

  function downloadLogs() {
    var blob = new Blob([allLogsAsText()], { type: 'text/plain;charset=utf-8' });
    var objectUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + '_' +
      String(d.getHours()).padStart(2, '0') + '-' +
      String(d.getMinutes()).padStart(2, '0') + '-' +
      String(d.getSeconds()).padStart(2, '0');

    a.href = objectUrl;
    a.download = 'ares-console-' + stamp + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    setStatus('Fichier TXT généré.', false);
  }

  function clearLogs() {
    entries.length = 0;
    warningCount = 0;
    errorCount = 0;
    if (refs.output) refs.output.replaceChildren();
    updateCount();
    updateBadge();
    setStatus('Historique Ares effacé.', false);
  }

  function bindUi() {
    refs.toggle.addEventListener('click', togglePanel);
    document.getElementById('aresConsoleCloseBtn').addEventListener('click', closePanel);
    document.getElementById('aresConsoleCopyBtn').addEventListener('click', copyLogs);
    document.getElementById('aresConsoleDownloadBtn').addEventListener('click', downloadLogs);
    document.getElementById('aresConsoleClearBtn').addEventListener('click', clearLogs);
    refs.search.addEventListener('input', refreshVisibility);

    document.querySelectorAll('.ares-console-filter').forEach(function (button) {
      button.addEventListener('click', function () {
        activeFilter = button.dataset.filter || 'all';
        document.querySelectorAll('.ares-console-filter').forEach(function (item) {
          item.classList.toggle('is-active', item === button);
        });
        refreshVisibility();
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && refs.panel.classList.contains('is-open')) {
        closePanel();
      }
    });
  }

  function watchMultiViewButtonPosition() {
    var observer = new MutationObserver(function () {
      placeToggleBeforeMultiView();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function initUi() {
    injectStyles();
    refs.toggle = createButton();
    placeToggleBeforeMultiView();
    buildPanel();
    cacheRefs();
    bindUi();
    uiReady = true;
    rebuildOutput();
    updateBadge();
    watchMultiViewButtonPosition();
  }

  window.__ARES_CONSOLE_LIVE__ = {
    version: '1.0.0',
    getEntries: function () { return entries.slice(); },
    copy: copyLogs,
    clear: clearLogs,
    open: function () { if (uiReady) openPanel(); },
    close: function () { if (uiReady) closePanel(); }
  };

  pushEntry('system', ['Console Live initialisée. Capture active dès le début du chargement.'], { source: 'ARES' });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUi, { once: true });
  } else {
    initUi();
  }
})();
