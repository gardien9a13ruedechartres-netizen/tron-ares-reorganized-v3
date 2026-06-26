/*
  Ares PT Overlay Router v1.4 URL Driven
  ASCII only.
  Goal: do not guess all PT channels from a shared parent.
  It uses the real URL when available, and only falls back to exact names.
*/
(function () {
  'use strict';

  var LOG_PREFIX = '[AresPtOverlayRouter]';

  var ROUTES = [
    {
      id: 'cmtv',
      names: ['CMTV', 'CMTVPT'],
      urls: ['/pages/switchcm-3-iframes.html', '/pages/cmtvpt.html'],
      preferredUrl: '/pages/switchcm-3-iframes.html'
    },
    {
      id: 'rtp1',
      names: ['RTP1'],
      urls: ['/pages/rtp1.html'],
      preferredUrl: '/pages/rtp1.html'
    },
    {
      id: 'rtp2',
      names: ['RTP2'],
      urls: ['/pages/rtp2.html'],
      preferredUrl: '/pages/rtp2.html'
    }
  ];

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizePath(value) {
    try {
      return new URL(String(value || ''), window.location.origin).pathname.toLowerCase();
    } catch (e) {
      return String(value || '').split('?')[0].split('#')[0].toLowerCase();
    }
  }

  function routeById(id) {
    id = String(id || '').toLowerCase();
    return ROUTES.find(function (route) { return route.id === id; }) || null;
  }

  function routeByUrl(url) {
    var path = normalizePath(url);
    return ROUTES.find(function (route) {
      return route.urls.some(function (candidate) {
        return path === normalizePath(candidate);
      });
    }) || null;
  }

  function routeByName(text) {
    var clean = normalizeText(text);
    if (!clean) return null;

    /* Exact or strongly bounded matching only. */
    return ROUTES.find(function (route) {
      return route.names.some(function (name) {
        var n = normalizeText(name);
        if (clean === n) return true;
        return new RegExp('(^|[^A-Z0-9])' + n + '([^A-Z0-9]|$)').test(clean);
      });
    }) || null;
  }

  function getParts() {
    return {
      iframeOverlay: document.getElementById('iframeOverlay'),
      iframeEl: document.getElementById('iframeEl'),
      videoEl: document.getElementById('videoEl')
    };
  }

  function ensureIframePermissions(iframeEl) {
    if (!iframeEl) return;
    iframeEl.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    iframeEl.setAttribute('referrerpolicy', 'origin');
    iframeEl.setAttribute('allowfullscreen', '');
  }

  function showOverlay() {
    var parts = getParts();

    if (parts.videoEl) {
      try { parts.videoEl.pause(); } catch (e) {}
      try { parts.videoEl.removeAttribute('src'); } catch (e) {}
      try { parts.videoEl.load(); } catch (e) {}
      try { parts.videoEl.style.display = 'none'; } catch (e) {}
    }

    if (parts.iframeOverlay) {
      parts.iframeOverlay.classList.remove('hidden');
      parts.iframeOverlay.style.display = '';
      parts.iframeOverlay.setAttribute('aria-hidden', 'false');
    }

    if (parts.iframeEl) {
      ensureIframePermissions(parts.iframeEl);
      parts.iframeEl.style.display = '';
    }
  }

  function setIframeUrl(url, reason) {
    var parts = getParts();
    if (!parts.iframeEl) {
      console.warn(LOG_PREFIX, 'iframeEl not found');
      return false;
    }

    showOverlay();

    var absoluteUrl = new URL(url, window.location.origin).href;
    var currentPath = normalizePath(parts.iframeEl.getAttribute('src') || parts.iframeEl.src || '');
    var nextPath = normalizePath(absoluteUrl);

    if (currentPath !== nextPath) {
      parts.iframeEl.src = absoluteUrl;
      console.log(LOG_PREFIX, 'iframe src set:', absoluteUrl, 'reason:', reason || 'manual');
    } else {
      console.log(LOG_PREFIX, 'iframe already on:', absoluteUrl, 'reason:', reason || 'manual');
    }

    return true;
  }

  function open(idOrUrl) {
    var route = routeById(idOrUrl) || routeByUrl(idOrUrl) || routeByName(idOrUrl);
    if (!route) {
      console.warn(LOG_PREFIX, 'unknown target:', idOrUrl);
      return false;
    }
    return setIframeUrl(route.preferredUrl, 'open:' + route.id);
  }

  function readUrlFromElement(el) {
    if (!el || el.nodeType !== 1) return '';

    var names = [
      'data-url',
      'data-src',
      'data-href',
      'href',
      'src',
      'title',
      'aria-label'
    ];

    for (var i = 0; i < names.length; i++) {
      var value = el.getAttribute && el.getAttribute(names[i]);
      if (value && routeByUrl(value)) return value;
    }

    if (el.dataset) {
      for (var key in el.dataset) {
        if (Object.prototype.hasOwnProperty.call(el.dataset, key)) {
          var dataValue = el.dataset[key];
          if (dataValue && routeByUrl(dataValue)) return dataValue;
        }
      }
    }

    return '';
  }

  function findClickedRoute(event) {
    var iframeList = document.getElementById('iframeList');
    if (!iframeList || !event.target || !iframeList.contains(event.target)) {
      return null;
    }

    var node = event.target;
    var maxDepth = 10;

    while (node && node !== iframeList && maxDepth-- > 0) {
      if (node.nodeType === 1) {
        var url = readUrlFromElement(node);
        if (url) {
          var byUrl = routeByUrl(url);
          if (byUrl) {
            return { route: byUrl, source: 'url', value: url };
          }
        }

        var text = (node.textContent || '').trim();
        if (text) {
          var byName = routeByName(text);
          if (byName) {
            return { route: byName, source: 'text', value: text };
          }
        }
      }
      node = node.parentElement;
    }

    return null;
  }

  function onClick(event) {
    var hit = findClickedRoute(event);
    if (!hit || !hit.route) return;

    /* Let the main app process the click first, then correct only the iframe URL. */
    window.setTimeout(function () {
      var parts = getParts();
      var currentSrc = parts.iframeEl && (parts.iframeEl.getAttribute('src') || parts.iframeEl.src || '');
      var currentRoute = currentSrc ? routeByUrl(currentSrc) : null;

      if (currentRoute && currentRoute.id === hit.route.id) {
        showOverlay();
        console.log(LOG_PREFIX, 'main app already loaded correct target:', currentSrc);
        return;
      }

      setIframeUrl(hit.route.preferredUrl, 'click:' + hit.route.id + ':' + hit.source);
    }, 120);
  }

  function debug() {
    var parts = getParts();
    var iframeSrc = parts.iframeEl ? (parts.iframeEl.getAttribute('src') || parts.iframeEl.src || '') : '';
    var info = {
      version: '1.4-url-driven',
      iframeOverlayFound: !!parts.iframeOverlay,
      iframeElFound: !!parts.iframeEl,
      videoElFound: !!parts.videoEl,
      iframeSrc: iframeSrc,
      iframeRoute: routeByUrl(iframeSrc) ? routeByUrl(iframeSrc).id : null,
      routes: ROUTES.map(function (r) { return { id: r.id, preferredUrl: r.preferredUrl, urls: r.urls }; })
    };
    console.table(info.routes);
    console.log(LOG_PREFIX, info);
    return info;
  }

  document.addEventListener('click', onClick, true);

  window.AresPtOverlayRouter = {
    version: '1.4-url-driven',
    open: open,
    debug: debug,
    setIframeUrl: setIframeUrl
  };

  console.log(LOG_PREFIX, 'loaded v1.4 URL driven');
})();
