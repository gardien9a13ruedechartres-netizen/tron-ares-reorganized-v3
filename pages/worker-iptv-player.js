(() => {
  const config = document.body.dataset;
  const channel = String(config.channel || '');
  const title = String(config.title || channel);
  const upstreamUrl = `https://deviantart.lovetier.bz/${channel}/index.fmp4.m3u8`;
  const proxyUrl = `/api/iptv/proxy?url=${encodeURIComponent(upstreamUrl)}`;
  const video = document.getElementById('video');
  const status = document.getElementById('status');
  const playButton = document.getElementById('play');
  let hls;

  document.title = title;

  function setStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  async function play() {
    try {
      video.muted = false;
      video.volume = 1;
      await video.play();
      setStatus('');
    } catch (_) {
      setStatus('Clique sur Lecture pour activer le son.');
    }
  }

  function load() {
    setStatus(`Chargement de ${title}...`);

    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 8,
        fragLoadingMaxRetry: 8
      });
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data || !data.fatal) return;
        setStatus('Flux temporairement indisponible. Nouvelle tentative...');
        setTimeout(() => {
          if (hls) hls.startLoad();
        }, 3000);
      });
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl;
      video.addEventListener('loadedmetadata', play, { once: true });
      return;
    }

    setStatus('La lecture HLS n’est pas prise en charge par ce navigateur.');
  }

  playButton.addEventListener('click', play);
  load();
})();
