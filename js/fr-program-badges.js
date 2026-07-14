/* js/fr-program-badges.js
   Ajoute un badge "info programme" dans la liste FR (#channelFrList),
   juste avant le bouton favoris (.icon-btn.fav-btn),
   et ouvre le guide dans l'overlay iframe interne (#iframeOverlay/#iframeEl).
*/

(() => {
  "use strict";

  const GUIDE_BASE = "https://www.guidetnt.com";

  // URL par chaine. Les cles sont normalisees par normalizeName().
  const PROGRAM_URLS = {
    "TF1": `${GUIDE_BASE}/tv/programme-tf1`,
    "TF1 SERIES & FILM": `${GUIDE_BASE}/tv/programme-tf1-series-films`,
    "TF1 SERIES FILM": `${GUIDE_BASE}/tv/programme-tf1-series-films`,
    "FRANCE 2": `${GUIDE_BASE}/tv/programme-france-2`,
    "FRANCE 3": `${GUIDE_BASE}/tv/programme-france-3`,
    "FRANCE 4": `${GUIDE_BASE}/tv/programme-france-4`,
    "FRANCE 5": `${GUIDE_BASE}/tv/programme-france-5`,
    "M6": `${GUIDE_BASE}/tv/programme-m6`,
    "ARTE": `${GUIDE_BASE}/tv/programme-arte`,
    "W9": `${GUIDE_BASE}/tv/programme-w9`,
    "CSTAR": `${GUIDE_BASE}/tv/programme-cstar`,
    "TMC": `${GUIDE_BASE}/tv/programme-tmc`,
    "TFX": `${GUIDE_BASE}/tv/programme-tfx`,
    "RMC STORY": `${GUIDE_BASE}/tv/programme-rmc-story`,
    "RMC DECOUVERTE": `${GUIDE_BASE}/tv/programme-rmc-decouverte`,
    "T18": `${GUIDE_BASE}/tv/programme-t18`,
    "NOVO19": `${GUIDE_BASE}/tv/programme-novo19`,
    "6TER": `${GUIDE_BASE}/tv/programme-6ter`,
    "CANAL+": `${GUIDE_BASE}/tv/programme-canalplus`,
    "CANAL+ SPORT 360": `${GUIDE_BASE}/tv/programme-canalplus-sport-360`,
    "CANAL+ FOOT": `${GUIDE_BASE}/tv/programme-canalplus-foot`,
    "CANAL+ SPORT": `${GUIDE_BASE}/tv/programme-canalplus-sport`,
    "CANAL+ GR. ECRAN": `${GUIDE_BASE}/tv/programme-canalplus-grand-ecran`,
    "CANAL+ GRAND ECRAN": `${GUIDE_BASE}/tv/programme-canalplus-grand-ecran`,
    "CANAL+ CINEMA": `${GUIDE_BASE}/tv/programme-canalplus-cinema`,
    "CANAL+ SERIES": `${GUIDE_BASE}/tv/programme-canalplus-series`,
    "CANAL+ DOCS": `${GUIDE_BASE}/tv/programme-canalplus-docs`,
    "CANAL+ KIDS": `${GUIDE_BASE}/tv/programme-canalplus-kids`,
    "CINE+ FAMILY": `${GUIDE_BASE}/tv/programme-cineplus-family`,
    "CINE+ FRISSON": `${GUIDE_BASE}/tv/programme-cineplus-frisson`,
    "CINE+ EMOTION": `${GUIDE_BASE}/tv/programme-cineplus-emotion`,
    "CINE+ CLASSIC": `${GUIDE_BASE}/tv/programme-cineplus-classic`,
    "CINE+ CLUB": `${GUIDE_BASE}/tv/programme-cineplus-club`,
    "EUROSPORT 1": `${GUIDE_BASE}/tv/programme-eurosport-1`,
    "EUROSPORT 2": `${GUIDE_BASE}/tv/programme-eurosport-2`,
    "L'EQUIPE FR": `${GUIDE_BASE}/tv/programme-lequipe`,
    "L'EQUIPE": `${GUIDE_BASE}/tv/programme-lequipe`,
    "OCS MAX": `${GUIDE_BASE}/tv/programme-ocs`,
    "WARNER TV": `${GUIDE_BASE}/tv/programme-warner-tv`,
    "DISNEY CHANNEL": `${GUIDE_BASE}/tv/programme-disney-channel`,
    "GULLI": `${GUIDE_BASE}/tv/programme-gulli`,
    "CANAL J": `${GUIDE_BASE}/tv/programme-canal-j`,
    "MANGAS": `${GUIDE_BASE}/tv/programme-mangas`,
    "GAME ONE": `${GUIDE_BASE}/tv/programme-game-one`,
    "TOONAMI": `${GUIDE_BASE}/tv/programme-toonami`,
    "ANIMAUX": `${GUIDE_BASE}/tv/programme-animaux`,
    "TOUTE L'HISTOIRE": `${GUIDE_BASE}/tv/programme-toute-l-histoire`,
    "TOUTE L HISTOIRE": `${GUIDE_BASE}/tv/programme-toute-l-histoire`,
    "NAT GEO": `${GUIDE_BASE}/tv/programme-national-geographic`,
    "NATIONAL GEOGRAPHIC": `${GUIDE_BASE}/tv/programme-national-geographic`,
    "DISCOVERY SCIENCE": `${GUIDE_BASE}/tv/programme-discovery-channel`,
    "USHUAIA TV": `${GUIDE_BASE}/tv/programme-ushuaia-tv`,
    "SCIENCE & VIE": `${GUIDE_BASE}/tv/programme-science-vie-tv`,
    "PLANETE+ CRIME": `${GUIDE_BASE}/tv/programme-planeteplus-crime`,
    "CRIME DISTRICT": `${GUIDE_BASE}/tv/programme-crime-district`,
    "MTV": `${GUIDE_BASE}/tv/programme-mtv`,
    "TCM CINEMA": `${GUIDE_BASE}/tv/programme-tcm`,
    "SYFY HD": `${GUIDE_BASE}/tv/programme-syfy`,
    "SYFY": `${GUIDE_BASE}/tv/programme-syfy`
  };

  const FALLBACK_GUIDE_URL = GUIDE_BASE;

  function normalizeName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’`´]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function isFrTabActive() {
    const btn = document.querySelector(".tab-btn.active");
    return btn && (btn.getAttribute("data-tab") === "fr");
  }

  function openInInternalOverlay(url) {
    const overlay = document.getElementById("iframeOverlay");
    const iframe = document.getElementById("iframeEl");
    if (!overlay || !iframe) {
      window.location.href = url;
      return;
    }

    iframe.setAttribute("sandbox", "allow-scripts allow-forms");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.src = url;
    overlay.classList.remove("hidden");
  }

  function buildBadge(url) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn fr-program-badge";
    btn.title = "Programme / Infos";
    btn.setAttribute("aria-label", "Programme / Infos");

    const img = document.createElement("span");
    img.textContent = "i";
    img.setAttribute("aria-hidden", "true");
    img.className = "fr-program-badge-icon";

    btn.appendChild(img);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openInInternalOverlay(url);
    });

    return btn;
  }

  function injectStylesOnce() {
    if (document.getElementById("frProgramBadgeStyle")) return;
    const style = document.createElement("style");
    style.id = "frProgramBadgeStyle";
    style.textContent = `
      .fr-program-badge { margin-right: 8px; }
      .fr-program-badge-icon {
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font: 700 12px/1 Arial, sans-serif;
        color: currentColor;
      }
    `;
    document.head.appendChild(style);
  }

  function injectBadgesIntoFrList() {
    if (!isFrTabActive()) return;

    const frRoot = document.getElementById("channelFrList");
    if (!frRoot) return;

    injectStylesOnce();

    const actionBars = frRoot.querySelectorAll(".channel-actions");
    actionBars.forEach((actionsDiv) => {
      const favBtn = actionsDiv.querySelector("button.icon-btn.fav-btn");
      if (!favBtn) return;
      if (actionsDiv.querySelector(".fr-program-badge")) return;

      const item = actionsDiv.closest(".channel-item") || actionsDiv.parentElement;
      if (!item) return;

      const title = item.querySelector(".channel-title");
      const name = normalizeName(title ? title.textContent : "");
      const url = PROGRAM_URLS[name] || FALLBACK_GUIDE_URL;
      const badge = buildBadge(url);

      actionsDiv.insertBefore(badge, favBtn);
    });
  }

  function setup() {
    injectStylesOnce();
    injectBadgesIntoFrList();

    const frRoot = document.getElementById("channelFrList");
    const target = frRoot || document.body;

    const mo = new MutationObserver(() => {
      injectBadgesIntoFrList();
    });

    mo.observe(target, { childList: true, subtree: true });

    if (!frRoot) {
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
