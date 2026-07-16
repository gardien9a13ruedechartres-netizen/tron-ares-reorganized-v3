/* js/pt-program-badges.js
   Ajoute un badge "Programme / Infos" dans la liste PT (#iframeList)
   uniquement pour les chaines qui exposent data-program-url depuis chaines-pt.json.
*/

(() => {
  "use strict";

  function isPtTabActive() {
    const btn = document.querySelector(".tab-btn.active");
    return btn && btn.getAttribute("data-tab") === "iframes";
  }

  function normalizeProgramUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^https:\/\/nostv\.pt\/guia\/\d+/i.test(url)) return url;
    return "";
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

  function buildBadge(programUrl) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn pt-program-badge";
    btn.title = "Programme / Infos NOS TV";
    btn.setAttribute("aria-label", "Programme / Infos NOS TV");

    const icon = document.createElement("span");
    icon.textContent = "i";
    icon.setAttribute("aria-hidden", "true");
    icon.className = "pt-program-badge-icon";

    btn.appendChild(icon);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openInInternalOverlay(programUrl);
    });

    return btn;
  }

  function injectStylesOnce() {
    if (document.getElementById("ptProgramBadgeStyle")) return;
    const style = document.createElement("style");
    style.id = "ptProgramBadgeStyle";
    style.textContent = `
      .pt-program-badge { margin-right: 8px; }
      .pt-program-badge-icon {
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

  function injectBadgesIntoPtList() {
    if (!isPtTabActive()) return;

    const ptRoot = document.getElementById("iframeList");
    if (!ptRoot) return;

    injectStylesOnce();

    ptRoot.querySelectorAll(".channel-item").forEach((itemEl) => {
      const programUrl = normalizeProgramUrl(itemEl.dataset.programUrl);
      if (!programUrl) return;

      const actionsDiv = itemEl.querySelector(".channel-actions");
      if (!actionsDiv) return;
      if (actionsDiv.querySelector(".pt-program-badge")) return;

      const favBtn = actionsDiv.querySelector("button.icon-btn.fav-btn");
      const badge = buildBadge(programUrl);
      if (favBtn) actionsDiv.insertBefore(badge, favBtn);
      else actionsDiv.prepend(badge);
    });
  }

  function setup() {
    injectStylesOnce();
    injectBadgesIntoPtList();

    const ptRoot = document.getElementById("iframeList");
    const mo = new MutationObserver(() => injectBadgesIntoPtList());
    mo.observe(ptRoot || document.body, { childList: true, subtree: true });

    document.addEventListener("click", (event) => {
      if (event.target && event.target.closest && event.target.closest(".tab-btn")) {
        setTimeout(injectBadgesIntoPtList, 0);
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
