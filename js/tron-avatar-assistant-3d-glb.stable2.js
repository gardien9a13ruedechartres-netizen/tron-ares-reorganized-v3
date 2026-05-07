import * as THREE from "https://esm.sh/three@0.160.0";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

document.addEventListener("DOMContentLoaded", () => {
  if (window.__ARES_GLB_ASSISTANT_BOOTED__) return;
  window.__ARES_GLB_ASSISTANT_BOOTED__ = true;

  const MODEL_URL = "3d/source/futuristic_flying_animated_robot_-_low_poly.glb";

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
        welcome: {
          title: "Bienvenue",
          text: "Bienvenue sur A R E S. Je peux te guider dans les principales fonctions du lecteur."
        },
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
          text: "Cet outil permet de coller une URL de stream pour lire directement un flux vidéo, audio, H L S ou Dash."
        },
        streamurl_open: {
          title: "Fenêtre Stream URL",
          text: "Cette fenêtre permet de coller une URL, donner un titre, lancer la lecture et copier le lien."
        },
        subtitles: {
          title: "Sous-titres en ligne",
          text: "Tu peux rechercher des sous-titres en ligne, choisir une langue, ou importer un fichier SRT ou VTT."
        },
        subtitles_open: {
          title: "Panneau sous-titres",
          text: "Ici, tu peux rechercher un titre, définir les langues, lancer la recherche et récupérer des sous-titres en ligne."
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
        },
        tab_fr: {
          title: "Onglet Chaînes FR",
          text: "Tu es dans l’onglet des chaînes françaises."
        },
        tab_channels: {
          title: "Onglet Films",
          text: "Tu es dans l’onglet films. Tu peux y parcourir les contenus et la vitrine."
        },
        tab_iframes: {
          title: "Onglet Chaînes PT",
          text: "Tu es dans l’onglet des chaînes portugaises."
        },
        tab_favorites: {
          title: "Onglet Favoris",
          text: "Ici, tu retrouves les contenus enregistrés en favoris."
        },
        tab_torrents: {
          title: "Onglet Torrents",
          text: "Ici, tu peux accéder aux contenus liés à la section torrents."
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
        welcome: {
          title: "Bem-vindo",
          text: "Bem-vindo ao A R E S. Posso guiá-lo pelas principais funções do leitor."
        },
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
          text: "Esta ferramenta permite colar uma URL de stream para reproduzir diretamente um fluxo vídeo, áudio, H L S ou Dash."
        },
        streamurl_open: {
          title: "Janela Stream URL",
          text: "Esta janela permite colar uma URL, definir um título, iniciar a reprodução e copiar o link."
        },
        subtitles: {
          title: "Legendas online",
          text: "Você pode procurar legendas online, escolher um idioma, ou importar um ficheiro SRT ou VTT."
        },
        subtitles_open: {
          title: "Painel de legendas",
          text: "Aqui, você pode pesquisar um título, definir idiomas, iniciar a pesquisa e recuperar legendas online."
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
        },
        tab_fr: {
          title: "Aba Canais FR",
          text: "Você está na aba dos canais franceses."
        },
        tab_channels: {
          title: "Aba Filmes",
          text: "Você está na aba filmes. Pode navegar pelos conteúdos e pela vitrine."
        },
        tab_iframes: {
          title: "Aba Canais PT",
          text: "Você está na aba dos canais portugueses."
        },
        tab_favorites: {
          title: "Aba Favoritos",
          text: "Aqui, você encontra os conteúdos guardados como favoritos."
        },
        tab_torrents: {
          title: "Aba Torrents",
          text: "Aqui, você pode aceder aos conteúdos ligados à secção torrents."
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
        welcome: {
          title: "Welcome",
          text: "Welcome to A R E S. I can guide you through the main player features."
        },
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
          text: "This tool lets you paste a stream URL to directly play a video, audio, H L S or Dash stream."
        },
        streamurl_open: {
          title: "Stream URL window",
          text: "This window lets you paste a URL, set a title, start playback and copy the link."
        },
        subtitles: {
          title: "Online subtitles",
          text: "You can search subtitles online, choose a language, or import an SRT or VTT file."
        },
        subtitles_open: {
          title: "Subtitles panel",
          text: "Here, you can search a title, define languages, start the search and fetch subtitles online."
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
        },
        tab_fr: {
          title: "FR Channels tab",
          text: "You are in the French channels tab."
        },
        tab_channels: {
          title: "Movies tab",
          text: "You are in the movies tab. You can browse its content and showcase."
        },
        tab_iframes: {
          title: "PT Channels tab",
          text: "You are in the Portuguese channels tab."
        },
        tab_favorites: {
          title: "Favorites tab",
          text: "Here, you can find your saved favorites."
        },
        tab_torrents: {
          title: "Torrents tab",
          text: "Here, you can access content related to the torrents section."
        }
      }
    }
  };

  const STEP_SELECTORS = {
    welcome: ".player-shell, #playerContainer",
    search: ".search-row, .search-bar, #globalSearchInput",
    tabs: ".tabs",
    verify: "#verifyLinksBtn",
    loader: ".loader-panel, [data-section='playlist'], #urlInput, #openFileBtn",
    streamurl: "#openStreamUrlBtn, #streamUrlInput",
    streamurl_open: "#streamUrlOverlay .streamurl-card, #streamUrlInput",
    subtitles: "#subtitleTrackBtn, #subtitleSearchBtn, #subtitleSearchTitleInput",
    subtitles_open: "#subtitleSearchOverlay .subsearch-card, #subtitleSearchTitleInput, #subtitleSearchLangInput",
    radio: "#miniRadioPlayer",
    list: ".lists-container",
    player: ".player-shell, #playerContainer, #videoEl",
    overlay: "#toggleOverlayBtn",
    navigation: "#prevBtn, #nextBtn, .bottom-bar",
    tab_fr: ".tabs .tab-btn[data-tab='fr'], #channelFrList",
    tab_channels: "#tabFilmBtn, #channelList, #filmsActionsRow",
    tab_iframes: ".tabs .tab-btn[data-tab='iframes'], #iframeList",
    tab_favorites: ".tabs .tab-btn[data-tab='favorites'], #favoriteList",
    tab_torrents: ".tabs .tab-btn[data-tab='torrents'], #torrentList"
  };

  const orderedKeys = [
    "welcome",
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

  const contextToBaseStep = {
    streamurl_open: "streamurl",
    subtitles_open: "subtitles",
    tab_fr: "list",
    tab_channels: "list",
    tab_iframes: "list",
    tab_favorites: "list",
    tab_torrents: "list"
  };

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
      <h3 id="aresGlbAssistantTitle">Bienvenue</h3>
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
  let currentStepKey = "welcome";

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
      .replace(/\bDASH\b/g, "dash");
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

        console.log("Animations détectées :", gltf.animations.map(a => a.name));
          
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

  function getRectForKey(stepKey) {
    const selector = STEP_SELECTORS[stepKey];
    if (!selector) return null;
    const target = document.querySelector(selector);
    if (!target) return null;
    return target.getBoundingClientRect();
  }

  function getActiveTabKey() {
    const active = document.querySelector(".tab-btn.active");
    const tab = active?.dataset?.tab || "";

    if (tab === "fr") return "tab_fr";
    if (tab === "channels") return "tab_channels";
    if (tab === "iframes") return "tab_iframes";
    if (tab === "favorites") return "tab_favorites";
    if (tab === "torrents") return "tab_torrents";
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    return !el.hidden;
  }

  function placeAssistant(rect, stepKey) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const stageWidth = stage.offsetWidth || 220;
    const stageHeight = stage.offsetHeight || 280;
    const bubbleWidth = Math.min(340, vw - 24);
    const bubbleHeight = 190;

    let stageLeft;
    let stageTop;
    let bubbleLeft;
    let bubbleTop;

    if ((stepKey === "welcome" || stepKey === "player") && rect) {
      stageLeft = Math.max(12, rect.left + 10);
      stageTop = Math.max(12, rect.top + 10);

      bubbleLeft = Math.min(
        vw - bubbleWidth - 12,
        stageLeft + stageWidth - 10
      );
      bubbleTop = Math.max(12, stageTop + 8);
    } else if (rect) {
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

      const bubbleRightSideFits = stageLeft + stageWidth + bubbleWidth + 14 < vw;
      bubbleLeft = bubbleRightSideFits
        ? stageLeft + stageWidth + 10
        : Math.max(12, stageLeft - bubbleWidth - 10);

      bubbleTop = Math.max(10, Math.min(vh - bubbleHeight - 12, stageTop + 30));
    } else {
      stageLeft = vw - stageWidth - 18;
      stageTop = vh - stageHeight - 84;
      bubbleLeft = Math.max(12, stageLeft - bubbleWidth - 10);
      bubbleTop = Math.max(10, stageTop + 30);
    }

    stage.style.left = `${stageLeft}px`;
    stage.style.top = `${stageTop}px`;
    stage.style.right = "auto";
    stage.style.bottom = "auto";

    bubble.style.left = `${bubbleLeft}px`;
    bubble.style.top = `${bubbleTop}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
  }

  function updateHighlight(rect, stepKey) {
    if (!rect || stepKey === "welcome") {
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

  function stepDisplayIndex(stepKey) {
    const base = contextToBaseStep[stepKey] || stepKey;
    const idx = orderedKeys.indexOf(base);
    return idx === -1 ? currentIndex + 1 : idx + 1;
  }

  function updateUi(stepKey, rect) {
    const strings = getStrings();
    const step = strings.steps[stepKey];
    if (!step) return;

    badgeEl.textContent = strings.badge;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    stepEl.textContent = `${stepDisplayIndex(stepKey)}/${orderedKeys.length}`;
    autoBtn.textContent = autoMode ? strings.autoOn : strings.autoOff;
    prevBtn.textContent = strings.prev;
    nextBtn.textContent = strings.next;
    closeBtn.textContent = strings.close;

    placeAssistant(rect, stepKey);
    updateHighlight(rect, stepKey);
  }

  function showStep(stepOrIndex, { speakNow = true } = {}) {
    let stepKey;

    if (typeof stepOrIndex === "number") {
      currentIndex = (stepOrIndex + orderedKeys.length) % orderedKeys.length;
      stepKey = orderedKeys[currentIndex];
    } else {
      stepKey = stepOrIndex;
      const baseKey = contextToBaseStep[stepKey] || stepKey;
      const idx = orderedKeys.indexOf(baseKey);
      if (idx !== -1) currentIndex = idx;
    }

    if (!stepKey) return;

    currentStepKey = stepKey;
    const rect = getRectForKey(stepKey);
    updateUi(stepKey, rect);

    if (speakNow) {
      const strings = getStrings();
      const step = strings.steps[stepKey];
      if (step) speak(`${step.title}. ${step.text}`);
    }
  }

  function nextStep() {
    showStep(currentIndex + 1, { speakNow: true });
  }

  function prevStep() {
    showStep(currentIndex - 1, { speakNow: true });
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
    showStep(currentStepKey || currentIndex, { speakNow: true });
  }

  function repositionOnly() {
    const rect = getRectForKey(currentStepKey);
    placeAssistant(rect, currentStepKey);
    updateHighlight(rect, currentStepKey);
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
    showStep(currentStepKey || currentIndex, { speakNow: true });
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!enabled) return;
      stopAuto();
      const tabKey = getActiveTabKey();
      if (tabKey) {
        window.setTimeout(() => {
          showStep(tabKey, { speakNow: true });
        }, 140);
      }
    });
  });

  const searchInput = document.getElementById("globalSearchInput");
  if (searchInput) {
    searchInput.addEventListener("focus", () => {
      if (!enabled) return;
      stopAuto();
      showStep("search", { speakNow: true });
    });
  }

  const streamBtn = document.getElementById("openStreamUrlBtn");
  if (streamBtn) {
    streamBtn.addEventListener("click", () => {
      if (!enabled) return;
      stopAuto();
      window.setTimeout(() => {
        const overlay = document.getElementById("streamUrlOverlay");
        if (overlay && !overlay.classList.contains("hidden") && isVisible(overlay)) {
          showStep("streamurl_open", { speakNow: true });
        } else {
          showStep("streamurl", { speakNow: true });
        }
      }, 120);
    });
  }

  const streamClose = document.getElementById("streamUrlCloseBtn");
  if (streamClose) {
    streamClose.addEventListener("click", () => {
      if (!enabled) return;
      window.setTimeout(() => {
        repositionOnly();
      }, 120);
    });
  }

  const subtitleBtn = document.getElementById("subtitleSearchBtn");
  if (subtitleBtn) {
    subtitleBtn.addEventListener("click", () => {
      if (!enabled) return;
      stopAuto();
      window.setTimeout(() => {
        const overlay = document.getElementById("subtitleSearchOverlay");
        if (overlay && !overlay.classList.contains("hidden") && isVisible(overlay)) {
          showStep("subtitles_open", { speakNow: true });
        } else {
          showStep("subtitles", { speakNow: true });
        }
      }, 120);
    });
  }

  const subtitleClose = document.getElementById("subtitleSearchCloseBtn");
  if (subtitleClose) {
    subtitleClose.addEventListener("click", () => {
      if (!enabled) return;
      window.setTimeout(() => {
        repositionOnly();
      }, 120);
    });
  }

  const subtitleTrackBtn = document.getElementById("subtitleTrackBtn");
  if (subtitleTrackBtn) {
    subtitleTrackBtn.addEventListener("click", () => {
      if (!enabled) return;
      stopAuto();
      window.setTimeout(() => {
        const overlay = document.getElementById("subtitleSearchOverlay");
        if (overlay && !overlay.classList.contains("hidden") && isVisible(overlay)) {
          showStep("subtitles_open", { speakNow: true });
        } else {
          showStep("subtitles", { speakNow: true });
        }
      }, 140);
    });
  }

  const overlayBtn = document.getElementById("toggleOverlayBtn");
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      if (!enabled) return;
      stopAuto();
      window.setTimeout(() => {
        showStep("overlay", { speakNow: false });
      }, 140);
    });
  }

  const prevRealBtn = document.getElementById("prevBtn");
  const nextRealBtn = document.getElementById("nextBtn");

  if (prevRealBtn) {
    prevRealBtn.addEventListener("click", () => {
      if (!enabled) return;
      window.setTimeout(() => {
        showStep("navigation", { speakNow: true });
      }, 120);
    });
  }

  if (nextRealBtn) {
    nextRealBtn.addEventListener("click", () => {
      if (!enabled) return;
      window.setTimeout(() => {
        showStep("navigation", { speakNow: true });
      }, 120);
    });
  }

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeRenderer();
      if (!enabled) return;
      repositionOnly();
    }, 120);
  });

  window.addEventListener("scroll", () => {
    if (!enabled) return;
    clearTimeout(window.__aresGlbScrollTimer);
    window.__aresGlbScrollTimer = setTimeout(() => {
      repositionOnly();
    }, 60);
  }, { passive: true });

  resizeRenderer();
  loadAvatar();
  animate();
  showStep("welcome", { speakNow: true });

  window.addEventListener("beforeunload", () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    renderer.dispose();
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  });
});