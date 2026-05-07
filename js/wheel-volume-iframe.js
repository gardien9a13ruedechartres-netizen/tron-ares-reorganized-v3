(function () {
  const DEFAULT_VOLUME = 0.5;
  const VOLUME_STEP = 0.05;
  const OVERLAY_HIDE_DELAY = 800;

  function clamp(v) {
    return Math.max(0, Math.min(1, v));
  }

  function applyDefaultVolume(video) {
    if (!video || video._defaultVolumeApplied) return;

    video._defaultVolumeApplied = true;

    try {
      video.volume = DEFAULT_VOLUME;
      video.muted = false;
    } catch (e) {}
  }

  function createOverlay(video) {
    if (video._volumeOverlay) return video._volumeOverlay;

    const overlay = document.createElement('div');
    overlay.className = 'video-volume-overlay';

    overlay.innerHTML = `
      <div class="video-volume-overlay-top">
        <span class="video-volume-overlay-label">Volume</span>
        <span class="video-volume-overlay-value">100%</span>
      </div>
      <div class="video-volume-overlay-bar">
        <div class="video-volume-overlay-fill"></div>
      </div>
    `;

    const parent = video.parentElement || video;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    parent.appendChild(overlay);

    video._volumeOverlay = overlay;
    video._overlayValue = overlay.querySelector('.video-volume-overlay-value');
    video._overlayFill = overlay.querySelector('.video-volume-overlay-fill');

    return overlay;
  }

  function showOverlay(video, force) {
    const overlay = createOverlay(video);

    const vol = video.muted ? 0 : clamp(Number(video.volume) || 0);
    const percent = Math.round(vol * 100);

    video._overlayValue.textContent = percent === 0 ? 'Muet' : percent + '%';
    video._overlayFill.style.width = percent + '%';

    overlay.classList.toggle('muted', percent === 0);

    if (force) {
      overlay.classList.add('show');

      clearTimeout(video._overlayTimer);
      video._overlayTimer = setTimeout(() => {
        overlay.classList.remove('show');
      }, OVERLAY_HIDE_DELAY);
    }
  }

  function attachToVideo(video) {
    if (!video || video._wheelBound) return;

    video._wheelBound = true;

    applyDefaultVolume(video);

    video.addEventListener('loadedmetadata', function () {
      applyDefaultVolume(video);
      showOverlay(video, false);
    });

    video.addEventListener('play', function () {
      applyDefaultVolume(video);
    });

    video.addEventListener('wheel', function (e) {
      e.preventDefault();

      let vol = video.muted ? 0 : (Number(video.volume) || 0);

      if (e.deltaY > 0) {
        vol -= VOLUME_STEP;
      } else {
        vol += VOLUME_STEP;
      }

      vol = clamp(vol);

      video.volume = vol;
      video.muted = vol === 0;

      showOverlay(video, true);
    }, { passive: false });

    video.addEventListener('volumechange', function () {
      showOverlay(video, false);
    });

    showOverlay(video, false);
  }

  function scanVideos() {
    document.querySelectorAll('video').forEach(attachToVideo);
  }

  function observe() {
    const obs = new MutationObserver(() => scanVideos());
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function injectStyle() {
    if (document.getElementById('wheelVolumeStyle')) return;

    const style = document.createElement('style');
    style.id = 'wheelVolumeStyle';

    style.textContent = `
      .video-volume-overlay{
        position:absolute;
        left:50%;
        bottom:22px;
        transform:translateX(-50%) translateY(8px);
        min-width:140px;
        max-width:min(70vw,260px);
        padding:10px 14px;
        border-radius:14px;
        border:1px solid rgba(0,229,255,.28);
        background:rgba(2,10,20,.78);
        color:rgba(255,255,255,.96);
        box-shadow:0 0 16px rgba(0,229,255,.16), inset 0 0 18px rgba(0,0,0,.45);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        pointer-events:none;
        opacity:0;
        transition:opacity 160ms ease, transform 160ms ease;
        z-index:9999;
      }

      .video-volume-overlay.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      .video-volume-overlay.muted{
        border-color:rgba(255,145,0,.35);
        box-shadow:0 0 18px rgba(255,145,0,.18), inset 0 0 18px rgba(0,0,0,.45);
      }

      .video-volume-overlay-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:8px;
        font-size:12px;
        line-height:1;
      }

      .video-volume-overlay-label{
        letter-spacing:.08em;
        text-transform:uppercase;
        color:rgba(255,255,255,.78);
      }

      .video-volume-overlay-value{
        font-weight:700;
        color:rgba(255,255,255,.98);
      }

      .video-volume-overlay-bar{
        height:8px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,255,255,.10);
        box-shadow:inset 0 0 10px rgba(0,0,0,.35);
        margin-top:6px;
      }

      .video-volume-overlay-fill{
        height:100%;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg, rgba(0,229,255,.85), rgba(255,145,0,.92));
        box-shadow:0 0 10px rgba(0,229,255,.22), 0 0 16px rgba(255,145,0,.18);
        transition:width 120ms ease;
      }
    `;

    document.head.appendChild(style);
  }

  function init() {
    injectStyle();
    scanVideos();
    observe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();