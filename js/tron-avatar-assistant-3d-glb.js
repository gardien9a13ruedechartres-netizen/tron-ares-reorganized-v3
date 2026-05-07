import * as THREE from "https://esm.sh/three@0.160.0";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

document.addEventListener("DOMContentLoaded", () => {
  if (window.__ARES_GLB_ASSISTANT_BOOTED__) return;
  window.__ARES_GLB_ASSISTANT_BOOTED__ = true;

  const MODEL_URL = "3d/source/friendly_robot.glb";

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
          text: "Bienvenue sur ARÉS ENGINE. Je peux te guider dans les principales fonctions du lecteur."
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
  title: "Radio interactive",
  text: "Ici, tu peux lancer la radio intégrée A R É S. Le lecteur propose un visualizer dynamique, un contrôle du volume circulaire, un réglage du pitch audio, ainsi qu’un accès à la playlist. Le système gère les flux audio en direct, y compris H L S, et optimise la lecture selon la compatibilité du navigateur."
},        list: {
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
          text: "Bem-vindo ao ARÉS ENGINE. Posso guiá-lo pelas principais funções do leitor."
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
  title: "Rádio interativa",
  text: "Aqui você pode iniciar a rádio integrada A R É S. O leitor inclui um visualizador dinâmico, controlo de volume circular, ajuste de pitch e acesso à playlist. O sistema suporta fluxos de áudio ao vivo, incluindo H L S, e adapta a reprodução conforme a compatibilidade do navegador."
},        list: {
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
          text: "Welcome to ARÉS ENGINE. I can guide you through the main player features."
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
  title: "Interactive radio",
  text: "Here you can start the integrated A R É S radio. The player features a dynamic visualizer, circular volume control, pitch adjustment, and playlist access. The system supports live audio streams including H L S and adapts playback depending on browser compatibility."
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
      <p id="aresGlbAssistantText">Bienvenue sur ARÉS ENGINE.</p>

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
  let currentStepKey = "welcome";
  let autoMode = false;
  let autoTimer = null;
  let enabled = true;
  let resizeTimer = null;

  let avatarRoot = null;
  let avatarModel = null;

  const clock = new THREE.Clock();
  let animationFrameId = null;

  // animation simulée
  let simState = "idle"; // idle | wave | point | talk
  let simStateStart = performance.now();
  let simPointSide = 1;
  let simLookYaw = 0;
  let simLookPitch = 0;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0x7cefff, 2.4);
  keyLight.position.set(2.5, 3.5, 3);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x4be1ff, 1.8);
  rimLight.position.set(-2.5, 2.2, -2);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xffa340, 1.0, 10);
  fillLight.position.set(0.8, 1.5, 1.5);
  scene.add(fillLight);

  function getStrings() {
    return STRINGS[currentLang] || STRINGS.fr;
  }

  function normalizeSpeech(text) {
  return text
    .replace(/\bARES\b/gi, "A R É S E")
    .replace(/\bAres\b/g, "A R É S E")
    .replace(/\bHLS\b/g, "H L S")
    .replace(/\bDASH\b/g, "dash");
}
  function setSimState(nextState, options = {}) {
    simState = nextState;
    simStateStart = performance.now();
    if (typeof options.pointSide === "number") {
      simPointSide = options.pointSide;
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    setSimState("talk");

    const utterance = new SpeechSynthesisUtterance(normalizeSpeech(text));
    if (currentLang === "fr") utterance.lang = "fr-FR";
    if (currentLang === "pt") utterance.lang = "pt-PT";
    if (currentLang === "en") utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      if (simState === "talk") setSimState("idle");
    };
    utterance.onerror = () => {
      if (simState === "talk") setSimState("idle");
    };

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
        console.log("Animations détectées :", gltf.animations.map((a) => a.name));

        avatarRoot = new THREE.Group();
        avatarModel = gltf.scene;

        avatarModel.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
        });

        avatarRoot.add(avatarModel);
        scene.add(avatarRoot);

        frameModel(avatarRoot);
        statusEl.textContent = getStrings().ready;

        // salut d’ouverture simulé
        setSimState("wave");
        setTimeout(() => {
          if (simState === "wave") setSimState("idle");
        }, 1600);
      },
      undefined,
      (err) => {
        console.error("Erreur chargement modèle :", err);
        statusEl.textContent = getStrings().error;
      }
    );
  }

  function frameModel(object3D) {
    const box = new THREE.Box3().setFromObject(object3D);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    object3D.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 1.55;
    const scale = targetSize / maxDim;
    object3D.scale.setScalar(scale);

    const fittedBox = new THREE.Box3().setFromObject(object3D);
    const fittedSize = new THREE.Vector3();
    fittedBox.getSize(fittedSize);

    const fittedMaxDim = Math.max(fittedSize.x, fittedSize.y, fittedSize.z) || 1;
    const distance = fittedMaxDim * 2.2;

    camera.position.set(0, fittedSize.y * 0.12, distance);
    camera.near = 0.01;
    camera.far = Math.max(100, distance * 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function stepNeedsPoint(stepKey) {
    return [
      "search",
      "tabs",
      "verify",
      "loader",
      "streamurl",
      "streamurl_open",
      "subtitles",
      "subtitles_open",
      "radio",
      "list",
      "player",
      "overlay",
      "navigation",
      "tab_fr",
      "tab_channels",
      "tab_iframes",
      "tab_favorites",
      "tab_torrents"
    ].includes(stepKey);
  }

  function stepPointSide(stepKey) {
    if (["search", "tabs", "verify", "loader", "streamurl", "subtitles"].includes(stepKey)) return 1;
    if (["radio", "navigation", "tab_fr", "tab_channels", "tab_iframes", "tab_favorites", "tab_torrents"].includes(stepKey)) return -1;
    return 1;
  }

  function updateSimTargetLook(rect) {
    if (!rect) {
      simLookYaw = 0;
      simLookPitch = 0;
      return;
    }

    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    const stageRect = stage.getBoundingClientRect();
    const selfX = stageRect.left + stageRect.width / 2;
    const selfY = stageRect.top + stageRect.height / 2;

    const dx = (targetX - selfX) / Math.max(window.innerWidth, 1);
    const dy = (targetY - selfY) / Math.max(window.innerHeight, 1);

    simLookYaw = THREE.MathUtils.clamp(dx * 1.8, -0.45, 0.45);
    simLookPitch = THREE.MathUtils.clamp(-dy * 1.2, -0.25, 0.25);
  }

  function applySimulatedAnimation(t) {
    if (!avatarRoot) return;

    const elapsed = (t - simStateStart) / 1000;
    const idleFloat = Math.sin(t * 0.0022) * 0.05;
    const idleYaw = Math.sin(t * 0.0012) * 0.08;
    const idleRoll = Math.sin(t * 0.0017) * 0.04;

    let posY = idleFloat;
    let rotY = idleYaw + simLookYaw * 0.55;
    let rotX = simLookPitch * 0.35;
    let rotZ = idleRoll;

    if (simState === "wave") {
      const wave = Math.sin(elapsed * 8.8) * Math.exp(-elapsed * 0.45);
      posY += 0.03 + Math.sin(elapsed * 5.2) * 0.03;
      rotY += 0.22 + wave * 0.18;
      rotZ += wave * 0.12;
      rotX += Math.sin(elapsed * 6.5) * 0.06;
      if (elapsed > 1.5) setSimState("idle");
    } else if (simState === "point") {
      const settle = 1 - Math.exp(-elapsed * 5.5);
      rotY += simPointSide * (0.22 * settle);
      rotX += 0.04 * settle;
      rotZ += simPointSide * 0.05 * settle;
      posY += Math.sin(t * 0.0032) * 0.02;
    } else if (simState === "talk") {
      const talk = Math.sin(elapsed * 18) * 0.04;
      posY += Math.abs(Math.sin(elapsed * 7.2)) * 0.02;
      rotY += talk + simLookYaw * 0.7;
      rotX += Math.sin(elapsed * 11.4) * 0.025;
      rotZ += Math.sin(elapsed * 9.7) * 0.015;
    }

    avatarRoot.position.y = posY;
    avatarRoot.rotation.x = rotX;
    avatarRoot.rotation.y = rotY;
    avatarRoot.rotation.z = rotZ;
  }

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    clock.getDelta();
    applySimulatedAnimation(performance.now());
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
    const bubbleWidth = Math.min(350, vw - 24);
    const bubbleHeight = 200;

    let stageLeft;
    let stageTop;
    let bubbleLeft;
    let bubbleTop;

    if ((stepKey === "welcome" || stepKey === "player") && rect) {
      const playerLeftPadding = 34;
      const playerTopPadding = 54;
      const bubbleGap = 18;
      const bubbleTopOffset = 34;

      stageLeft = Math.max(12, rect.left + playerLeftPadding);
      stageTop = Math.max(12, rect.top + playerTopPadding);

      bubbleLeft = Math.min(
        vw - bubbleWidth - 12,
        stageLeft + stageWidth + bubbleGap
      );

      bubbleTop = Math.max(
        rect.top + 18,
        stageTop + bubbleTopOffset
      );

      const playerBottomLimit = rect.bottom - stageHeight - 18;
      stageTop = Math.min(stageTop, Math.max(rect.top + 18, playerBottomLimit));

      const bubbleBottomLimit = rect.bottom - bubbleHeight - 18;
      bubbleTop = Math.min(bubbleTop, Math.max(rect.top + 18, bubbleBottomLimit));
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
    updateSimTargetLook(rect);
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

    if (stepNeedsPoint(stepKey)) {
      setSimState("point", { pointSide: stepPointSide(stepKey) });
    } else if (simState !== "talk") {
      setSimState("idle");
    }

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
    updateSimTargetLook(rect);
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
    statusEl.textContent = avatarRoot ? getStrings().ready : getStrings().loading;
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
        if (simState !== "talk") setSimState("idle");
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
        if (simState !== "talk") setSimState("idle");
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