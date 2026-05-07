(function () {
  "use strict";

  class CleanVideoPlayer {
    constructor(options = {}) {
      if (!options.video || !(options.video instanceof HTMLVideoElement)) {
        throw new Error("CleanVideoPlayer: options.video doit être une balise <video> valide.");
      }

      this.video = options.video;
      this.source = options.source || "";
      this.poster = options.poster || "";
      this.autoplay = Boolean(options.autoplay);
      this.muted = Boolean(options.muted);
      this.loop = Boolean(options.loop);
      this.preload = options.preload || "metadata";
      this.tracks = Array.isArray(options.tracks) ? options.tracks : [];
      this.onReady = typeof options.onReady === "function" ? options.onReady : null;
      this.onError = typeof options.onError === "function" ? options.onError : null;

      this.hls = null;
      this.isHls = false;
      this.controls = {};
      this.qualityLevels = [];
      this.currentQuality = -1;

      this.storageKey = options.storageKey || "clean-video-player-settings";
      this.resumeKey = options.resumeKey || "clean-video-player-resume";

      this._init();
    }

    _init() {
      this._applyVideoDefaults();
      this._restoreSettings();
      this._createUI();
      this._attachBaseEvents();
      this._loadTracks(this.tracks);

      if (this.source) {
        this.load(this.source);
      } else if (this.video.currentSrc || this.video.src) {
        this._finalizeReady();
      }
    }

    _applyVideoDefaults() {
      this.video.poster = this.poster;
      this.video.autoplay = this.autoplay;
      this.video.muted = this.muted;
      this.video.loop = this.loop;
      this.video.preload = this.preload;
      this.video.controls = false;
      this.video.playsInline = true;
      this.video.setAttribute("playsinline", "");
      this.video.setAttribute("webkit-playsinline", "");
    }

    _createUI() {
      const wrapper = document.createElement("div");
      wrapper.className = "cvp-wrapper";
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      wrapper.style.maxWidth = "100%";
      wrapper.style.background = "#000";
      wrapper.style.overflow = "hidden";
      wrapper.style.userSelect = "none";

      const parent = this.video.parentNode;
      parent.insertBefore(wrapper, this.video);
      wrapper.appendChild(this.video);

      this.video.style.width = "100%";
      this.video.style.display = "block";
      this.video.style.background = "#000";

      const controls = document.createElement("div");
      controls.className = "cvp-controls";
      controls.style.position = "absolute";
      controls.style.left = "0";
      controls.style.right = "0";
      controls.style.bottom = "0";
      controls.style.display = "flex";
      controls.style.flexDirection = "column";
      controls.style.gap = "8px";
      controls.style.padding = "10px";
      controls.style.background = "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))";
      controls.style.transition = "opacity 0.2s ease";
      controls.style.opacity = "1";

      const progressRow = document.createElement("div");
      progressRow.style.display = "flex";
      progressRow.style.alignItems = "center";
      progressRow.style.width = "100%";

      const progress = document.createElement("input");
      progress.type = "range";
      progress.min = "0";
      progress.max = "100";
      progress.step = "0.1";
      progress.value = "0";
      progress.style.width = "100%";
      progress.style.cursor = "pointer";

      progressRow.appendChild(progress);

      const mainRow = document.createElement("div");
      mainRow.style.display = "flex";
      mainRow.style.alignItems = "center";
      mainRow.style.justifyContent = "space-between";
      mainRow.style.gap = "10px";
      mainRow.style.flexWrap = "wrap";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      left.style.flexWrap = "wrap";

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";
      right.style.flexWrap = "wrap";

      const playBtn = this._makeButton("▶");
      const muteBtn = this._makeButton("🔊");
      const pipBtn = this._makeButton("PiP");
      const fullBtn = this._makeButton("⛶");

      const timeLabel = document.createElement("span");
      timeLabel.textContent = "00:00 / 00:00";
      timeLabel.style.color = "#fff";
      timeLabel.style.fontSize = "13px";
      timeLabel.style.fontFamily = "sans-serif";

      const volume = document.createElement("input");
      volume.type = "range";
      volume.min = "0";
      volume.max = "1";
      volume.step = "0.01";
      volume.value = String(this.video.volume ?? 1);
      volume.style.cursor = "pointer";

      const qualitySelect = document.createElement("select");
      qualitySelect.style.padding = "4px 6px";
      qualitySelect.style.fontSize = "13px";

      const subtitleSelect = document.createElement("select");
      subtitleSelect.style.padding = "4px 6px";
      subtitleSelect.style.fontSize = "13px";

      left.appendChild(playBtn);
      left.appendChild(muteBtn);
      left.appendChild(volume);
      left.appendChild(timeLabel);

      right.appendChild(subtitleSelect);
      right.appendChild(qualitySelect);
      right.appendChild(pipBtn);
      right.appendChild(fullBtn);

      mainRow.appendChild(left);
      mainRow.appendChild(right);

      controls.appendChild(progressRow);
      controls.appendChild(mainRow);
      wrapper.appendChild(controls);

      const centerPlay = this._makeButton("▶");
      centerPlay.style.position = "absolute";
      centerPlay.style.top = "50%";
      centerPlay.style.left = "50%";
      centerPlay.style.transform = "translate(-50%, -50%)";
      centerPlay.style.fontSize = "28px";
      centerPlay.style.padding = "14px 18px";
      centerPlay.style.borderRadius = "999px";
      centerPlay.style.background = "rgba(0,0,0,0.65)";
      centerPlay.style.display = "none";

      wrapper.appendChild(centerPlay);

      this.controls = {
        wrapper,
        controls,
        progress,
        playBtn,
        centerPlay,
        muteBtn,
        volume,
        timeLabel,
        qualitySelect,
        subtitleSelect,
        pipBtn,
        fullBtn
      };

      playBtn.addEventListener("click", () => this.togglePlay());
      centerPlay.addEventListener("click", () => this.togglePlay());
      muteBtn.addEventListener("click", () => this.toggleMute());
      volume.addEventListener("input", () => this.setVolume(parseFloat(volume.value)));
      progress.addEventListener("input", () => this._seekFromRange());
      pipBtn.addEventListener("click", () => this.togglePiP());
      fullBtn.addEventListener("click", () => this.toggleFullscreen());
      qualitySelect.addEventListener("change", () => this._onQualityChange());
      subtitleSelect.addEventListener("change", () => this._onSubtitleChange());

      let hideTimer = null;
      const showControls = () => {
        controls.style.opacity = "1";
        if (this.video.paused) return;
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          controls.style.opacity = "0";
        }, 2000);
      };

      wrapper.addEventListener("mousemove", showControls);
      wrapper.addEventListener("mouseenter", showControls);
      wrapper.addEventListener("mouseleave", () => {
        if (!this.video.paused) controls.style.opacity = "0";
      });
      wrapper.addEventListener("click", (event) => {
        if (event.target === this.video) this.togglePlay();
      });

      this.video.addEventListener("play", () => {
        playBtn.textContent = "❚❚";
        centerPlay.style.display = "none";
      });

      this.video.addEventListener("pause", () => {
        playBtn.textContent = "▶";
        centerPlay.style.display = "inline-flex";
      });

      this.video.addEventListener("loadedmetadata", () => {
        this._updateTime();
        centerPlay.style.display = this.video.paused ? "inline-flex" : "none";
      });
    }

    _makeButton(label) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.style.cursor = "pointer";
      btn.style.border = "0";
      btn.style.padding = "6px 10px";
      btn.style.borderRadius = "6px";
      btn.style.background = "rgba(255,255,255,0.15)";
      btn.style.color = "#fff";
      btn.style.fontFamily = "sans-serif";
      btn.style.fontSize = "13px";
      return btn;
    }

    _attachBaseEvents() {
      this.video.addEventListener("timeupdate", () => {
        this._updateProgress();
        this._updateTime();
        this._storeResumePosition();
      });

      this.video.addEventListener("durationchange", () => {
        this._updateTime();
      });

      this.video.addEventListener("volumechange", () => {
        this._updateVolumeUI();
        this._storeSettings();
      });

      this.video.addEventListener("error", () => {
        const err = this.video.error;
        const message = err ? `Erreur vidéo code ${err.code}` : "Erreur vidéo inconnue";
        if (this.onError) this.onError(message, err);
      });
    }

    async load(src) {
      if (!src || typeof src !== "string") {
        throw new Error("CleanVideoPlayer.load: source invalide.");
      }

      this.destroyStreamBackend();
      this.source = src;
      this.isHls = /\.m3u8($|\?)/i.test(src);

      try {
        if (this.isHls) {
          await this._loadHls(src);
        } else {
          this.video.src = src;
          this.video.load();
          this._finalizeReady();
        }
      } catch (error) {
        if (this.onError) this.onError(error.message || "Erreur de chargement", error);
        throw error;
      }
    }

    async _loadHls(src) {
      if (this.video.canPlayType("application/vnd.apple.mpegurl")) {
        this.video.src = src;
        this.video.load();
        this._populateQualitySelect([]);
        this._finalizeReady();
        return;
      }

      if (typeof window.Hls === "undefined") {
        throw new Error("HLS non supporté nativement et Hls.js absent.");
      }

      if (!window.Hls.isSupported()) {
        throw new Error("Hls.js présent mais non supporté par ce navigateur.");
      }

      this.hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      this.hls.loadSource(src);
      this.hls.attachMedia(this.video);

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        const levels = (this.hls.levels || []).map((level, index) => ({
          index,
          label: this._formatLevelLabel(level)
        }));
        this.qualityLevels = levels;
        this._populateQualitySelect(levels);
        this._finalizeReady();
      });

      this.hls.on(window.Hls.Events.LEVEL_SWITCHED, (_, data) => {
        this.currentQuality = typeof data.level === "number" ? data.level : -1;
        this._syncQualitySelect();
      });

      this.hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data && data.fatal) {
          let message = "Erreur HLS fatale";
          if (data.details) message += `: ${data.details}`;
          if (this.onError) this.onError(message, data);

          switch (data.type) {
            case "networkError":
              this.hls.startLoad();
              break;
            case "mediaError":
              this.hls.recoverMediaError();
              break;
            default:
              this.destroyStreamBackend();
              break;
          }
        }
      });
    }

    _finalizeReady() {
      this._restoreResumePosition();
      if (this.autoplay) {
        this.video.play().catch(() => {});
      }
      if (this.onReady) this.onReady(this);
    }

    destroyStreamBackend() {
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
      this.qualityLevels = [];
      this.currentQuality = -1;
      this._populateQualitySelect([]);
    }

    play() {
      return this.video.play();
    }

    pause() {
      this.video.pause();
    }

    togglePlay() {
      if (this.video.paused) {
        this.play().catch(() => {});
      } else {
        this.pause();
      }
    }

    setVolume(value) {
      const v = Math.max(0, Math.min(1, Number(value)));
      this.video.volume = v;
      this.video.muted = v === 0;
      this._updateVolumeUI();
      this._storeSettings();
    }

    toggleMute() {
      this.video.muted = !this.video.muted;
      this._updateVolumeUI();
      this._storeSettings();
    }

    seek(seconds) {
      if (!Number.isFinite(seconds)) return;
      const duration = this.video.duration || 0;
      this.video.currentTime = Math.max(0, Math.min(duration, seconds));
    }

    toggleFullscreen() {
      const el = this.controls.wrapper;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        }
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }

    async togglePiP() {
      try {
        if (!document.pictureInPictureEnabled || this.video.disablePictureInPicture) return;
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await this.video.requestPictureInPicture();
        }
      } catch (_) {}
    }

    setSubtitle(index) {
      const tracks = Array.from(this.video.textTracks || []);
      tracks.forEach((track, i) => {
        track.mode = i === index ? "showing" : "disabled";
      });
      this._syncSubtitleSelect();
    }

    setQuality(levelIndex) {
      if (!this.hls) return;
      if (levelIndex === -1) {
        this.hls.currentLevel = -1;
        this.hls.nextLevel = -1;
      } else if (Number.isInteger(levelIndex) && levelIndex >= 0) {
        this.hls.currentLevel = levelIndex;
        this.hls.nextLevel = levelIndex;
      }
      this.currentQuality = levelIndex;
      this._syncQualitySelect();
    }

    _seekFromRange() {
      const duration = this.video.duration || 0;
      const ratio = parseFloat(this.controls.progress.value) / 100;
      this.seek(duration * ratio);
    }

    _updateProgress() {
      const duration = this.video.duration || 0;
      const current = this.video.currentTime || 0;
      const percent = duration > 0 ? (current / duration) * 100 : 0;
      this.controls.progress.value = String(percent);
    }

    _updateTime() {
      const current = this._formatTime(this.video.currentTime || 0);
      const duration = this._formatTime(this.video.duration || 0);
      this.controls.timeLabel.textContent = `${current} / ${duration}`;
    }

    _updateVolumeUI() {
      const vol = this.video.muted ? 0 : this.video.volume;
      this.controls.volume.value = String(vol);
      this.controls.muteBtn.textContent = (this.video.muted || vol === 0) ? "🔇" : "🔊";
    }

    _formatTime(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
      const s = Math.floor(seconds % 60);
      const m = Math.floor((seconds / 60) % 60);
      const h = Math.floor(seconds / 3600);

      if (h > 0) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    _loadTracks(tracks) {
      Array.from(this.video.querySelectorAll("track")).forEach((track) => track.remove());

      tracks.forEach((trackInfo) => {
        if (!trackInfo || !trackInfo.src) return;
        const track = document.createElement("track");
        track.kind = trackInfo.kind || "subtitles";
        track.label = trackInfo.label || "Sous-titres";
        track.srclang = trackInfo.srclang || "fr";
        track.src = trackInfo.src;
        if (trackInfo.default) track.default = true;
        this.video.appendChild(track);
      });

      this.video.addEventListener("loadedmetadata", () => {
        this._populateSubtitleSelect();
      }, { once: true });

      setTimeout(() => this._populateSubtitleSelect(), 300);
    }

    _populateSubtitleSelect() {
      const select = this.controls.subtitleSelect;
      select.innerHTML = "";

      const noneOption = document.createElement("option");
      noneOption.value = "-1";
      noneOption.textContent = "Sous-titres: off";
      select.appendChild(noneOption);

      const tracks = Array.from(this.video.textTracks || []);
      tracks.forEach((track, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `Sous-titres: ${track.label || track.language || index + 1}`;
        select.appendChild(option);
      });

      this._syncSubtitleSelect();
    }

    _syncSubtitleSelect() {
      const tracks = Array.from(this.video.textTracks || []);
      const activeIndex = tracks.findIndex((track) => track.mode === "showing");
      this.controls.subtitleSelect.value = String(activeIndex >= 0 ? activeIndex : -1);
    }

    _onSubtitleChange() {
      const value = parseInt(this.controls.subtitleSelect.value, 10);
      if (value === -1) {
        Array.from(this.video.textTracks || []).forEach((track) => {
          track.mode = "disabled";
        });
        this._syncSubtitleSelect();
        return;
      }
      this.setSubtitle(value);
    }

    _formatLevelLabel(level) {
      if (!level) return "Qualité";
      const height = level.height ? `${level.height}p` : "";
      const bitrate = level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : "";
      return [height, bitrate].filter(Boolean).join(" - ") || "Qualité";
    }

    _populateQualitySelect(levels) {
      const select = this.controls.qualitySelect;
      select.innerHTML = "";

      const auto = document.createElement("option");
      auto.value = "-1";
      auto.textContent = "Qualité auto";
      select.appendChild(auto);

      levels.forEach((level) => {
        const option = document.createElement("option");
        option.value = String(level.index);
        option.textContent = level.label;
        select.appendChild(option);
      });

      select.disabled = levels.length === 0;
      this._syncQualitySelect();
    }

    _syncQualitySelect() {
      this.controls.qualitySelect.value = String(
        Number.isInteger(this.currentQuality) ? this.currentQuality : -1
      );
    }

    _onQualityChange() {
      const value = parseInt(this.controls.qualitySelect.value, 10);
      this.setQuality(value);
    }

    _storeSettings() {
      try {
        const data = {
          volume: this.video.volume,
          muted: this.video.muted
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (_) {}
    }

    _restoreSettings() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.volume === "number") this.video.volume = Math.max(0, Math.min(1, data.volume));
        if (typeof data.muted === "boolean") this.video.muted = data.muted;
      } catch (_) {}
    }

    _storeResumePosition() {
      try {
        if (!this.source) return;
        const data = JSON.parse(localStorage.getItem(this.resumeKey) || "{}");
        data[this.source] = {
          time: this.video.currentTime || 0,
          updatedAt: Date.now()
        };
        localStorage.setItem(this.resumeKey, JSON.stringify(data));
      } catch (_) {}
    }

    _restoreResumePosition() {
      try {
        if (!this.source) return;
        const data = JSON.parse(localStorage.getItem(this.resumeKey) || "{}");
        const entry = data[this.source];
        if (!entry || typeof entry.time !== "number") return;

        const applyResume = () => {
          if (this.video.duration && entry.time < this.video.duration - 5) {
            this.video.currentTime = entry.time;
          }
        };

        if (this.video.readyState >= 1) {
          applyResume();
        } else {
          this.video.addEventListener("loadedmetadata", applyResume, { once: true });
        }
      } catch (_) {}
    }

    destroy() {
      this.destroyStreamBackend();
      this.pause();

      const { wrapper } = this.controls;
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.insertBefore(this.video, wrapper);
        wrapper.remove();
      }

      this.video.controls = true;
    }
  }

  window.CleanVideoPlayer = CleanVideoPlayer;
})();