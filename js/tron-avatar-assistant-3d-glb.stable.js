import * as THREE from "https://esm.sh/three@0.160.0";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

document.addEventListener("DOMContentLoaded", () => {
  if (window.__ARES_GLB_ASSISTANT_BOOTED__) return;
  window.__ARES_GLB_ASSISTANT_BOOTED__ = true;

  const MODEL_URL = "3d/source/readyplayerme_cyberpunk.glb";

  const STRINGS = {
    fr: {
      badge: "Assistant ARES",
      prev: "Précédent",
      next: "Suivant",
      autoOn: "Auto ON",
      autoOff: "Auto OFF",
      close: "X Désactiver",
      loading: "Chargement du modèle 3D…",
      ready: "Avatar 3D prêt.",
      error: "Impossible de charger le modèle 3D.",
      steps: {
        search: {
          title: "Recherche globale",
          text: "Ici, tu peux rechercher rapidement dans les listes visibles."
        },
        tabs: {
          title: "Navigation par onglets",
          text: "Ces onglets te permettent de changer immédiatement de section."
        },
        verify: {
          title: "Vérification des liens",
          text: "Ce bouton sert à vérifier les liens de la liste active."
        },
        loader: {
          title: "Chargement playlist ou fichier",
          text: "Dans cette zone, tu peux charger une playlist, un flux ou un fichier local."
        },
        streamurl: {
          title: "Stream URL",
          text: "Cet outil permet de coller une URL de stream pour lire directement un flux vidéo, audio, HLS ou DASH."
        },
        subtitles: {
          title: "Sous-titres en ligne",
          text: "Tu peux rechercher des sous-titres en ligne, choisir une langue, ou importer un fichier SRT ou VTT."
        },
        radio: {
          title: "Mini player radio",
          text: "Ici, tu peux ouvrir rapidement la radio intégrée."
        },
        list: {
          title: "Liste des contenus",
          text: "Cette zone affiche les chaînes, films ou contenus de l’onglet actif."
        },
        player: {
          title: "Lecteur principal",
          text: "Ici, tu regardes la vidéo active ou un overlay iFrame."
        },
        overlay: {
          title: "Vidéo ou iFrame",
          text: "Ce bouton permet de basculer entre la vidéo et l’overlay iFrame."
        },
        navigation: {
          title: "Navigation suivante et précédente",
          text: "Ces boutons permettent de passer rapidement au contenu suivant ou précédent de la liste active."
        }
      }
    },
    pt: {
      badge: "Assistente ARES",
      prev: "Anterior",
      next: "Seguinte",
      autoOn: "Auto ON",
      autoOff: "Auto OFF",
      close: "X Desativar",
      loading: "A carregar o modelo 3D…",
      ready: "Avatar 3D pronto.",
      error: "Não foi possível carregar o modelo 3D.",
      steps: {
        search: {
          title: "Pesquisa global",
          text: "Aqui, você pode pesquisar rapidamente nas listas visíveis."
        },
        tabs: {
          title: "Navegação por abas",
          text: "Essas abas permitem mudar de secção imediatamente."
        },
        verify: {
          title: "Verificação de links",
          text: "Este botão serve para verificar os links da lista ativa."
        },
        loader: {
          title: "Carregar playlist ou ficheiro",
          text: "Nesta zona, você pode carregar uma playlist, um fluxo ou um ficheiro local."
        },
        streamurl: {
          title: "Stream URL",
          text: "Esta ferramenta permite colar uma URL de stream para reproduzir diretamente um fluxo vídeo, áudio, HLS ou DASH."
        },
        subtitles: {
          title: "Legendas online",
          text: "Você pode procurar legendas online, escolher um idioma, ou importar um ficheiro SRT ou VTT."
        },
        radio: {
          title: "Mini player rádio",
          text: "Aqui, você pode abrir rapidamente a rádio integrada."
        },
        list: {
          title: "Lista de conteúdos",
          text: "Esta zona mostra os canais, filmes ou conteúdos da aba ativa."
        },
        player: {
          title: "Leitor principal",
          text: "Aqui, você vê o vídeo ativo ou um overlay iFrame."
        },
        overlay: {
          title: "Vídeo ou iFrame",
          text: "Este botão permite alternar entre o vídeo e o overlay iFrame."
        },
        navigation: {
          title: "Navegação seguinte e anterior",
          text: "Esses botões permitem passar rapidamente ao conteúdo seguinte ou anterior da lista ativa."
        }
      }
    },
    en: {
      badge: "ARES Assistant",
      prev: "Previous",
      next: "Next",
      autoOn: "Auto ON",
      autoOff: "Auto OFF",
      close: "X Disable",
      loading: "Loading 3D model…",
      ready: "3D avatar ready.",
      error: "Unable to load the 3D model.",
      steps: {
        search: {
          title: "Global search",
          text: "Here, you can quickly search through the visible lists."
        },
        tabs: {
          title: "Tab navigation",
          text: "These tabs let you switch section immediately."
        },
        verify: {
          title: "Link verification",
          text: "This button is used to verify links from the active list."
        },
        loader: {
          title: "Playlist or file loader",
          text: "In this area, you can load a playlist, a stream or a local file."
        },
        streamurl: {
          title: "Stream URL",
          text: "This tool lets you paste a stream URL to directly play a video, audio, HLS or DASH stream."
        },
        subtitles: {
          title: "Online subtitles",
          text: "You can search subtitles online, choose a language, or import an SRT or VTT file."
        },
        radio: {
          title: "Mini radio player",
          text: "Here, you can quickly open the integrated radio."
        },
        list: {
          title: "Content list",
          text: "This area displays channels, movies or content from the active tab."
        },
        player: {
          title: "Main player",
          text: "Here, you watch the active video or an iFrame overlay."
        },
        overlay: {
          title: "Video or iFrame",
          text: "This button lets you switch between the video and the iFrame overlay."
        },
        navigation: {
          title: "Next and previous navigation",
          text: "These buttons let you quickly move to the next or previous item in the active list."
        }
      }
    }
  };

  const SELECTORS = {
    search: ".search-row, .search-bar, #globalSearchInput",
    tabs: ".tabs",
    verify: "#verifyLinksBtn",
    loader: ".loader-panel, [data-section='playlist'], #urlInput, #openFileBtn",
    streamurl: "#openStreamUrlBtn, #streamUrlOverlay, #streamUrlInput",
    subtitles: "#subtitleSearchOverlay, #subtitleSearchBtn, #subtitleSearchTitleInput, #subtitleSearchLangInput, #subtitleTrackBtn",
    radio: "#miniRadioPlayer",
    list: ".lists-container",
    player: ".player-shell, #playerContainer, #videoEl",
    overlay: "#toggleOverlayBtn, #iframeOverlay, #iframeEl",
    navigation: "#prevBtn, #nextBtn, .bottom-bar"
  };

  const orderedKeys = [
    "search",
    "tabs",
    "verify",
    "loader",
    "streamurl",
    "subtitles",
    "radio",
    "list",
    "player",
    "overlay",
    "navigation"
  ];

  const root = document.createElement("div");
  root.id = "aresGlbAssistantRoot";
  root.innerHTML = `
    <div id="aresGlbAssistantStage" aria-hidden="false">
      <canvas id="aresGlbAssistantCanvas"></canvas>
    </div>

    <div id="aresGlbAssistantBubble">
      <div class="ares-glb-bubble-top">
        <span id="aresGlbAssistantBadge" class="ares-glb-badge">Assistant ARES</span>
        <span id="aresGlbAssistantStep" class="ares-glb-step">1/${orderedKeys.length}</span>
      </div>
      <h3 id="aresGlbAssistantTitle">Recherche globale</h3>
      <p id="aresGlbAssistantText">Bienvenue sur A R E S.</p>

      <div class="ares-glb-actions">
        <select id="aresGlbAssistantLang" class="ares-glb-select" aria-label="Langue">
          <option value="fr">Français</option>
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
        <button id="aresGlbAssistantAuto" class="ares-glb-btn is-accent" type="button">Auto OFF</button>
        <button id="aresGlbAssistantPrev" class="ares-glb-btn" type="button">Précédent</button>
        <button id="aresGlbAssistantNext" class="ares-glb-btn" type="button">Suivant</button>
        <button id="aresGlbAssistantClose" class="ares-glb-btn" type="button">X Désactiver</button>
      </div>

      <div id="aresGlbAssistantStatus">Chargement du modèle 3D…</div>
    </div>

    <div id="aresGlbAssistantHighlight" aria-hidden="true"></div>
    <button id="aresGlbAssistantToggle" type="button" aria-label="Relancer l'assistant">AI</button>
  `;
  document.body.appendChild(root);

  const stage = document.getElementById("aresGlbAssistantStage");
  const canvas = document.getElementById("aresGlbAssistantCanvas");
  const bubble = document.getElementById("aresGlbAssistantBubble");
  const highlight = document.getElementById("aresGlbAssistantHighlight");
  const toggleBtn = document.getElementById("aresGlbAssistantToggle");
  const langSelect = document.getElementById("aresGlbAssistantLang");
  const autoBtn = document.getElementById("aresGlbAssistantAuto");
  const prevBtn = document.getElementById("aresGlbAssistantPrev");
  const nextBtn = document.getElementById("aresGlbAssistantNext");
  const closeBtn = document.getElementById("aresGlbAssistantClose");
  const badgeEl = document.getElementById("aresGlbAssistantBadge");
  const stepEl = document.getElementById("aresGlbAssistantStep");
  const titleEl = document.getElementById("aresGlbAssistantTitle");
  const textEl = document.getElementById("aresGlbAssistantText");
  const statusEl = document.getElementById("aresGlbAssistantStatus");

  let currentLang = "fr";
  let currentIndex = 0;
  let autoMode = false;
  let autoTimer = null;
  let enabled = true;
  let resizeTimer = null;
  let mixer = null;
  let avatar = null;
  const clock = new THREE.Clock();
  let animationFrameId = null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 1.45, 2.8);

  const ambient = new THREE.AmbientLight(0xffffff, 1.3);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0x7cefff, 2.2);
  keyLight.position.set(2.2, 3.5, 2.4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x4be1ff, 1.6);
  rimLight.position.set(-2.5, 2.2, -1.8);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xffa340, 0.9, 8);
  fillLight.position.set(0.4, 1.5, 1.2);
  scene.add(fillLight);

  function getStrings() {
    return STRINGS[currentLang] || STRINGS.fr;
  }

  function normalizeSpeech(text) {
    return text
      .replace(/\bARES\b/gi, "A R E S")
      .replace(/\bAres\b/g, "A R E S")
      .replace(/\bHLS\b/g, "H L S")
      .replace(/\bDASH\b/g, "DASH");
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(normalizeSpeech(text));
    if (currentLang === "fr") utterance.lang = "fr-FR";
    if (currentLang === "pt") utterance.lang = "pt-PT";
    if (currentLang === "en") utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  function resizeRenderer() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function loadAvatar() {
    const loader = new GLTFLoader();
    statusEl.textContent = getStrings().loading;

    loader.load(
      MODEL_URL,
      (gltf) => {
        avatar = gltf.scene;
        avatar.position.set(0, -1.05, 0);
        avatar.rotation.y = 0.18;
        avatar.scale.setScalar(1.45);

        avatar.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
        });

        scene.add(avatar);

        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(avatar);
          const firstClip = gltf.animations[0];
          if (firstClip) {
            const action = mixer.clipAction(firstClip);
            action.play();
          }
        }

        statusEl.textContent = getStrings().ready;
      },
      undefined,
      () => {
        statusEl.textContent = getStrings().error;
      }
    );
  }

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (mixer) {
      mixer.update(delta);
    } else if (avatar) {
      avatar.rotation.y = 0.14 + Math.sin(performance.now() * 0.001) * 0.08;
    }

    renderer.render(scene, camera);
  }

  function getRectForStep(stepKey) {
    const target = document.querySelector(SELECTORS[stepKey]);
    if (!target) return null;
    return target.getBoundingClientRect();
  }

  function inferStepFromContext() {
    const active = document.querySelector(".tab-btn.active");
    const dataTab = active?.dataset?.tab || "";

    if (dataTab === "fr" || dataTab === "channels" || dataTab === "iframes" || dataTab === "favorites" || dataTab === "torrents") {
      return "list";
    }

    return orderedKeys[currentIndex];
  }

  function placeAssistant(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const stageWidth = stage.offsetWidth || 220;
    const stageHeight = stage.offsetHeight || 280;
    const bubbleWidth = Math.min(340, vw - 24);
    const bubbleHeight = 190;

    let stageLeft;
    let stageTop;

    if (rect) {
      const rightSide = rect.right + 14;
      const leftSide = rect.left - stageWidth - 14;
      const midY = rect.top + rect.height / 2 - stageHeight / 2;

      if (rightSide + stageWidth < vw - 12) {
        stageLeft = rightSide;
      } else if (leftSide > 12) {
        stageLeft = leftSide;
      } else {
        stageLeft = Math.max(12, Math.min(vw - stageWidth - 12, rect.left));
      }

      stageTop = Math.max(10, Math.min(vh - stageHeight - 88, midY));
    } else {
      stageLeft = vw - stageWidth - 18;
      stageTop = vh - stageHeight - 84;
    }

    stage.style.left = `${stageLeft}px`;
    stage.style.top = `${stageTop}px`;
    stage.style.right = "auto";
    stage.style.bottom = "auto";

    const bubbleRightSideFits = stageLeft + stageWidth + bubbleWidth + 14 < vw;
    const bubbleLeft = bubbleRightSideFits
      ? stageLeft + stageWidth + 10
      : Math.max(12, stageLeft - bubbleWidth - 10);

    const bubbleTop = Math.max(10, Math.min(vh - bubbleHeight - 12, stageTop + 30));

    bubble.style.left = `${bubbleLeft}px`;
    bubble.style.top = `${bubbleTop}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
  }

  function updateHighlight(rect) {
    if (!rect) {
      highlight.classList.remove("is-visible");
      return;
    }

    const pad = 8;
    highlight.style.left = `${Math.max(0, rect.left - pad)}px`;
    highlight.style.top = `${Math.max(0, rect.top - pad)}px`;
    highlight.style.width = `${Math.max(0, rect.width + pad * 2)}px`;
    highlight.style.height = `${Math.max(0, rect.height + pad * 2)}px`;
    highlight.classList.add("is-visible");
  }

  function updateUi(stepKey, rect) {
    const strings = getStrings();
    const step = strings.steps[stepKey];

    badgeEl.textContent = strings.badge;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    stepEl.textContent = `${currentIndex + 1}/${orderedKeys.length}`;
    autoBtn.textContent = autoMode ? strings.autoOn : strings.autoOff;
    prevBtn.textContent = strings.prev;
    nextBtn.textContent = strings.next;
    closeBtn.textContent = strings.close;

    placeAssistant(rect);
    updateHighlight(rect);
  }

  function showStep(index, { speakNow = true, forcedStepKey = null } = {}) {
    currentIndex = (index + orderedKeys.length) % orderedKeys.length;
    const stepKey = forcedStepKey || orderedKeys[currentIndex];
    const rect = getRectForStep(stepKey);

    updateUi(stepKey, rect);

    if (speakNow) {
      const strings = getStrings();
      speak(`${strings.steps[stepKey].title}. ${strings.steps[stepKey].text}`);
    }
  }

  function nextStep() {
    showStep(currentIndex + 1);
  }

  function prevStep() {
    showStep(currentIndex - 1);
  }

  function stopAuto() {
    autoMode = false;
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    autoBtn.textContent = getStrings().autoOff;
  }

  function startAuto() {
    stopAuto();
    autoMode = true;
    autoBtn.textContent = getStrings().autoOn;
    autoTimer = window.setInterval(() => {
      if (!enabled) return;
      nextStep();
    }, 7000);
  }

  function hideAssistant() {
    enabled = false;
    stopAuto();
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    stage.classList.add("is-hidden");
    bubble.classList.add("is-hidden");
    highlight.classList.remove("is-visible");
  }

  function showAssistant() {
    enabled = true;
    stage.classList.remove("is-hidden");
    bubble.classList.remove("is-hidden");
    showStep(currentIndex, { speakNow: true });
  }

  autoBtn.addEventListener("click", () => {
    if (!enabled) return;
    if (autoMode) stopAuto();
    else startAuto();
  });

  nextBtn.addEventListener("click", () => {
    if (!enabled) return;
    stopAuto();
    nextStep();
  });

  prevBtn.addEventListener("click", () => {
    if (!enabled) return;
    stopAuto();
    prevStep();
  });

  closeBtn.addEventListener("click", () => {
    hideAssistant();
  });

  toggleBtn.addEventListener("click", () => {
    if (enabled) hideAssistant();
    else showAssistant();
  });

  langSelect.addEventListener("change", () => {
    currentLang = langSelect.value;
    if (!enabled) return;
    statusEl.textContent = avatar ? getStrings().ready : getStrings().loading;
    showStep(currentIndex, { speakNow: true });
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!enabled) return;
      setTimeout(() => {
        const forcedKey = inferStepFromContext();
        const idx = orderedKeys.indexOf(forcedKey);
        showStep(idx === -1 ? currentIndex : idx, {
          speakNow: true,
          forcedStepKey: forcedKey
        });
      }, 120);
    });
  });

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeRenderer();
      if (!enabled) return;
      showStep(currentIndex, { speakNow: false });
    }, 120);
  });

  window.addEventListener("scroll", () => {
    if (!enabled) return;
    clearTimeout(window.__aresGlbScrollTimer);
    window.__aresGlbScrollTimer = setTimeout(() => {
      showStep(currentIndex, { speakNow: false });
    }, 60);
  }, { passive: true });

  resizeRenderer();
  loadAvatar();
  animate();
  showStep(0, { speakNow: true });

  window.addEventListener("beforeunload", () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    renderer.dispose();
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  });
});