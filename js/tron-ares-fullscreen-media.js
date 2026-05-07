(function () {
  const toggleOverlayBtn = document.getElementById('toggleOverlayBtn');
  const fullPageBtn = document.getElementById('fullPageBtn');
  const playerContainer = document.getElementById('playerContainer');
  const appShell = document.getElementById('appShell');

  const videoEl = document.getElementById('videoEl');
  const iframeEl = document.getElementById('iframeEl');
  const iframeOverlay = document.getElementById('iframeOverlay');
  const pipBtn = document.getElementById('pipBtn');

  if (!playerContainer || !fullPageBtn) return;

  // -----------------------------
  // SUPPRIME / MASQUE LE BOUTON PIP
  // -----------------------------
  if (pipBtn) {
    pipBtn.remove();
  } else {
    const pipByText = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent && btn.textContent.trim().toUpperCase() === 'PIP'
    );
    if (pipByText) pipByText.remove();
  }

  // -----------------------------
  // AJOUT DU BOUTON FULLSCREEN MEDIA
  // -----------------------------
  const mediaFsBtn = document.createElement('button');
  mediaFsBtn.id = 'mediaFullscreenBtn';
  mediaFsBtn.type = 'button';
  mediaFsBtn.textContent = 'FULLSCREEN MEDIA';
  mediaFsBtn.className = fullPageBtn.className;

  fullPageBtn.parentNode.insertBefore(mediaFsBtn, fullPageBtn);

  // -----------------------------
  // HELPERS FULLSCREEN
  // -----------------------------
  function getFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function requestFs(el) {
    if (!el) return Promise.reject(new Error('Aucun élément fullscreen'));
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return Promise.resolve();
    }
    if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
      return Promise.resolve();
    }
    if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      return Promise.resolve();
    }
    return Promise.reject(new Error('Fullscreen non supporté'));
  }

  function exitFs() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return Promise.resolve();
    }
    if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
      return Promise.resolve();
    }
    if (document.msExitFullscreen) {
      document.msExitFullscreen();
      return Promise.resolve();
    }
    return Promise.reject(new Error('Sortie fullscreen non supportée'));
  }

  // -----------------------------
  // DETECTION MEDIA ACTIF
  // -----------------------------
  function isIframeOverlayActive() {
    return !!(
      iframeOverlay &&
      !iframeOverlay.classList.contains('hidden') &&
      iframeEl &&
      iframeEl.src
    );
  }

  function hasUsableVideo() {
    return !!(
      videoEl &&
      ((videoEl.currentSrc && videoEl.currentSrc.trim()) ||
        (videoEl.src && videoEl.src.trim()))
    );
  }

  function getMediaFullscreenTarget() {
    if (isIframeOverlayActive()) {
      return iframeEl || playerContainer;
    }

    if (hasUsableVideo()) {
      return videoEl;
    }

    return playerContainer;
  }

  function getAppFullscreenTarget() {
    return appShell || playerContainer || document.documentElement;
  }

  // -----------------------------
  // TOGGLE FULLSCREEN MEDIA
  // -----------------------------
  async function toggleMediaFullscreen() {
    try {
      if (getFullscreenElement()) {
        await exitFs();
        return;
      }

      const target = getMediaFullscreenTarget();
      await requestFs(target);
    } catch (err) {
      console.warn('Fullscreen media impossible', err);

      // fallback propre
      try {
        const fallback = playerContainer || getAppFullscreenTarget();
        await requestFs(fallback);
      } catch (fallbackErr) {
        console.warn('Fallback fullscreen impossible', fallbackErr);
      }
    }
  }

  // -----------------------------
  // CONSERVE TON BOUTON PLEIN ÉCRAN
  // -----------------------------
  async function toggleAppFullscreen() {
    try {
      if (getFullscreenElement()) {
        await exitFs();
        return;
      }

      const target = getAppFullscreenTarget();
      await requestFs(target);
    } catch (err) {
      console.warn('Fullscreen app impossible', err);
    }
  }

  // -----------------------------
  // BIND EVENTS
  // -----------------------------
  mediaFsBtn.addEventListener('click', toggleMediaFullscreen);

  fullPageBtn.addEventListener('click', function (e) {
    e.preventDefault();
    toggleAppFullscreen();
  });

  // -----------------------------
  // MAJ TEXTE BOUTON MEDIA
  // -----------------------------
  function updateMediaFsBtnLabel() {
    mediaFsBtn.textContent = getFullscreenElement()
      ? 'QUITTER FULLSCREEN'
      : 'FULLSCREEN MEDIA';
  }

  document.addEventListener('fullscreenchange', updateMediaFsBtnLabel);
  document.addEventListener('webkitfullscreenchange', updateMediaFsBtnLabel);
  document.addEventListener('mozfullscreenchange', updateMediaFsBtnLabel);
  document.addEventListener('MSFullscreenChange', updateMediaFsBtnLabel);

  updateMediaFsBtnLabel();
})();