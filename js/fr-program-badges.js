/* js/fr-program-badges.js
   Ajoute un badge "info programme" dans la liste FR (#channelFrList),
   juste avant le bouton favoris (.icon-btn.fav-btn),
   et ouvre le guide dans l’overlay iframe interne (#iframeOverlay/#iframeEl).
*/

(() => {
  "use strict";

  const BADGE_ICON_URL = "https://www.stream4free.tv/images/jtv/info.png";

  // URL par chaîne (optionnel). Si pas trouvé => fallback (guide général).
  const PROGRAM_URLS = {
    // Exemple (tu peux compléter au fur et à mesure)
    "M6": "https://www.guidetnt.com/program/content/2/1/0/0/21/5/FFFFFF/FFFFFF/313131/111111",
    "TF1": "https://www.guidetnt.com/program/content/1/1/0/0/21/5/FFFFFF/FFFFFF/313131/111111",
    "FRANCE 2": "https://www.guidetnt.com/program/content/3/1/0/0/21/5/FFFFFF/FFFFFF/313131/111111"
  };

  // Fallback si on n'a pas d’URL spécifique chaîne
  const FALLBACK_GUIDE_URL = "https://www.guidetnt.com/program/";

  function normalizeName(name) {
    return String(name || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function isFrTabActive() {
    const btn = document.querySelector(".tab-btn.active");
    return btn && (btn.getAttribute("data-tab") === "fr");
  }

  function openInInternalOverlay(url) {
    const overlay = document.getElementById("iframeOverlay");
    const iframe = document.getElementById("iframeEl");
    if (!overlay || !iframe) {
      // Si overlay absent, on fallback vers navigation normale
      window.location.href = url;
      return;
    }

    // Anti pub/compat (comme tu l’as validé)
    iframe.setAttribute("sandbox", "allow-scripts allow-forms");
    iframe.setAttribute("referrerpolicy", "no-referrer");

    // Ouvre dans TON overlay (modale interne)
    iframe.src = url;
    overlay.classList.remove("hidden");
  }

  function buildBadge(url) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn fr-program-badge";
    btn.title = "Programme / Infos";
    btn.setAttribute("aria-label", "Programme / Infos");

    const img = document.createElement("img");
    img.src = BADGE_ICON_URL;
    img.alt = "Info";
    img.decoding = "async";
    img.loading = "lazy";
    img.className = "fr-program-badge-icon";

    btn.appendChild(img);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // important: ne pas déclencher le clic de lecture de la chaîne
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
      .fr-program-badge-icon { width: 16px; height: 16px; display:block; }
    `;
    document.head.appendChild(style);
  }

  function injectBadgesIntoFrList() {
    if (!isFrTabActive()) return;

    const frRoot = document.getElementById("channelFrList");
    if (!frRoot) return;

    injectStylesOnce();

    // On cible les items rendus par ton script : ils contiennent .channel-actions + le bouton fav
    const actionBars = frRoot.querySelectorAll(".channel-actions");
    actionBars.forEach((actionsDiv) => {
      const favBtn = actionsDiv.querySelector("button.icon-btn.fav-btn");
      if (!favBtn) return;

      // éviter doublon
      if (actionsDiv.querySelector(".fr-program-badge")) return;

      // retrouver le nom de la chaîne dans le même item
      const item = actionsDiv.closest(".channel-item") || actionsDiv.parentElement;
      if (!item) return;

      const title = item.querySelector(".channel-title");
      const name = normalizeName(title ? title.textContent : "");

      const url = PROGRAM_URLS[name] || FALLBACK_GUIDE_URL;

      const badge = buildBadge(url);

      // insertion AVANT fav
      actionsDiv.insertBefore(badge, favBtn);
    });
  }

  // Observer : la liste FR est re-rendue, on ré-injecte à chaque changement
  function setup() {
    injectStylesOnce();
    injectBadgesIntoFrList();

    const frRoot = document.getElementById("channelFrList");
    const target = frRoot || document.body;

    const mo = new MutationObserver(() => {
      injectBadgesIntoFrList();
    });

    mo.observe(target, { childList: true, subtree: true });

    // Au changement d’onglet, la classe active change : on écoute aussi le body
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