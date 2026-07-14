/* js/fr-program-badges.js
   Ajoute un badge "info programme" dans la liste FR (#channelFrList),
   juste avant le bouton favoris (.icon-btn.fav-btn), et ouvre la grille TV
   officielle GuideTNT dans l'overlay iframe interne (#iframeOverlay/#iframeEl).
*/

(() => {
  "use strict";

  const PROGRAM_GRID_URL =
    "https://www.guidetnt.com/program/content/1/1/0/0/21/25/00111C/031B2B/00D6FF/EAF7FF";

  function isFrTabActive() {
    const btn = document.querySelector(".tab-btn.active");
    return btn && btn.getAttribute("data-tab") === "fr";
  }

  function openInInternalOverlay(url) {
    const overlay = document.getElementById("iframeOverlay");
    const iframe = document.getElementById("iframeEl");
    if (!overlay || !iframe) {
      window.location.href = url;
      return;
    }

    iframe.removeAttribute("sandbox");
    iframe.setAttribute("referrerpolicy", "origin");
    iframe.src = url;
    overlay.classList.remove("hidden");
  }

  function buildBadge() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn fr-program-badge";
    btn.title = "Programme / Infos";
    btn.setAttribute("aria-label", "Programme / Infos");

    const icon = document.createElement("span");
    icon.textContent = "i";
    icon.setAttribute("aria-hidden", "true");
    icon.className = "fr-program-badge-icon";

    btn.appendChild(icon);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openInInternalOverlay(PROGRAM_GRID_URL);
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

      actionsDiv.insertBefore(buildBadge(), favBtn);
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
