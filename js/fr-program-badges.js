/* js/fr-program-badges.js
   Programme / Infos FR.
   Priorite: panneau natif GuideTNT via /api/guidetnt-epg, fallback iframe officiel.
*/

(() => {
  "use strict";

  const PROGRAM_GRID_URL =
    "https://www.guidetnt.com/program/content/1/1/0/0/21/25/00111C/031B2B/00D6FF/EAF7FF";

  const state = {
    previousOverlayVisible: false,
    opener: null,
    requestId: 0
  };

  function isFrTabActive() {
    const btn = document.querySelector(".tab-btn.active");
    return btn && btn.getAttribute("data-tab") === "fr";
  }

  function normalizeGuideTntId(value) {
    const id = String(value || "").trim();
    return /^\d{1,4}$/.test(id) ? id : "";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function overlayIsVisible(overlay) {
    return !!overlay && !overlay.classList.contains("hidden");
  }

  function openFallbackIframe() {
    const overlay = document.getElementById("iframeOverlay");
    const iframe = document.getElementById("iframeEl");
    if (!overlay || !iframe) {
      window.open(PROGRAM_GRID_URL, "_blank", "noopener,noreferrer");
      return;
    }

    const panel = document.getElementById("frGuideTntProgramPanel");
    if (panel) panel.hidden = true;
    overlay.classList.remove("fr-guidetnt-program-active");
    iframe.removeAttribute("sandbox");
    iframe.setAttribute("referrerpolicy", "origin");
    iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture; encrypted-media");
    iframe.src = PROGRAM_GRID_URL;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  }

  function ensurePanel() {
    const overlay = document.getElementById("iframeOverlay");
    if (!overlay) return null;

    let panel = overlay.querySelector("#frGuideTntProgramPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "frGuideTntProgramPanel";
      panel.className = "fr-guide-panel";
      panel.setAttribute("aria-label", "Programme TV France");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.hidden = true;
      overlay.appendChild(panel);
    }
    return panel;
  }

  function closeGuidePanel() {
    const overlay = document.getElementById("iframeOverlay");
    const panel = document.getElementById("frGuideTntProgramPanel");
    state.requestId += 1;
    if (panel) panel.hidden = true;
    if (overlay) {
      overlay.classList.remove("fr-guidetnt-program-active");
      overlay.setAttribute("aria-hidden", state.previousOverlayVisible ? "false" : "true");
      if (!state.previousOverlayVisible) overlay.classList.add("hidden");
    }
    if (state.opener && typeof state.opener.focus === "function") {
      try { state.opener.focus({ preventScroll: true }); } catch {
        try { state.opener.focus(); } catch {}
      }
    }
  }

  function statusLabel(program) {
    if (!program) return "";
    if (program.status === "now") return "Live";
    if (program.status === "past") return "Passe";
    return "Ensuite";
  }

  function renderLoading(panel, context) {
    panel.innerHTML = `
      <div class="fr-guide-shell">
        <header class="fr-guide-head">
          <div>
            <p class="fr-guide-kicker">Programme / Infos GuideTNT</p>
            <h2>${escapeHtml(context.name || "Chaine FR")}</h2>
          </div>
          <button type="button" class="fr-guide-close" title="Fermer">x</button>
        </header>
        <div class="fr-guide-loading">
          <div class="fr-guide-logo">${context.logo ? `<img src="${escapeHtml(context.logo)}" alt="">` : "TV"}</div>
          <div>
            <strong>Chargement du programme...</strong>
            <span>Lecture de la grille GuideTNT.</span>
          </div>
        </div>
      </div>
    `;
    panel.querySelector(".fr-guide-close")?.addEventListener("click", closeGuidePanel);
  }

  function renderError(panel, context, message) {
    panel.innerHTML = `
      <div class="fr-guide-shell">
        <header class="fr-guide-head">
          <div>
            <p class="fr-guide-kicker">Programme / Infos GuideTNT</p>
            <h2>${escapeHtml(context.name || "Chaine FR")}</h2>
          </div>
          <button type="button" class="fr-guide-close" title="Fermer">x</button>
        </header>
        <div class="fr-guide-error">
          <strong>Programme indisponible</strong>
          <span>${escapeHtml(message || "GuideTNT ne repond pas pour cette chaine.")}</span>
          <button type="button" class="fr-guide-fallback">Ouvrir la grille GuideTNT</button>
        </div>
      </div>
    `;
    panel.querySelector(".fr-guide-close")?.addEventListener("click", closeGuidePanel);
    panel.querySelector(".fr-guide-fallback")?.addEventListener("click", openFallbackIframe);
  }

  function renderPanel(panel, context, data) {
    const programs = Array.isArray(data.programs) ? data.programs : [];
    const current = data.current || programs.find((program) => program.status === "now") || programs[0] || null;
    const next = data.next || programs.find((program) => program.status === "next") || null;
    const progress = Math.max(0, Math.min(100, Number(current?.progressPct || 0)));
    const logo = context.logo || "";

    const rows = programs.map((program) => `
      <article class="fr-guide-item ${program.status === "now" ? "is-now" : ""}">
        <span class="fr-guide-time">${escapeHtml(program.startTime || "--:--")}${program.endTime ? ` - ${escapeHtml(program.endTime)}` : ""}</span>
        <div class="fr-guide-item-copy">
          <h4>${escapeHtml(program.title || "Programme")}</h4>
          <p>${escapeHtml(program.category || "Programme")}</p>
        </div>
        <span class="fr-guide-tag">${escapeHtml(statusLabel(program))}</span>
      </article>
    `).join("");

    panel.innerHTML = `
      <div class="fr-guide-shell">
        <header class="fr-guide-head">
          <div>
            <p class="fr-guide-kicker">Programme / Infos GuideTNT</p>
            <h2>${escapeHtml(context.name || data.channelName || "Chaine FR")}</h2>
          </div>
          <div class="fr-guide-head-actions">
            <button type="button" class="fr-guide-open">Grille</button>
            <button type="button" class="fr-guide-refresh" title="Actualiser">R</button>
            <button type="button" class="fr-guide-close" title="Fermer">x</button>
          </div>
        </header>

        <div class="fr-guide-grid">
          <section class="fr-guide-now">
            <div class="fr-guide-lockup">
              <div class="fr-guide-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : "TV"}</div>
              <div>
                <p class="fr-guide-kicker">${escapeHtml(data.channelName || context.name || "FR")} - maintenant</p>
                <h3>${escapeHtml(current?.title || "Programme indisponible")}</h3>
              </div>
            </div>

            <div class="fr-guide-timeband">
              <span>${escapeHtml(current?.startTime || "--:--")}</span>
              <span>${escapeHtml(current?.endTime || "--:--")}</span>
            </div>
            <div class="fr-guide-progress"><span style="width:${progress}%"></span></div>

            <p class="fr-guide-summary">
              ${escapeHtml(current?.category || "Programme")}
              ${current?.detailUrl ? ` - Detail disponible sur GuideTNT.` : ""}
            </p>

            <div class="fr-guide-next">
              <strong>A suivre</strong>
              <span>${escapeHtml(next?.title || "Programme suivant indisponible")}</span>
            </div>
          </section>

          <section class="fr-guide-day">
            <div class="fr-guide-day-head">
              <h3>Tranche actuelle</h3>
              <span>${programs.length} programmes</span>
            </div>
            <div class="fr-guide-list">
              ${rows || '<div class="fr-guide-empty">Aucun programme disponible.</div>'}
            </div>
          </section>
        </div>
      </div>
    `;

    panel.querySelector(".fr-guide-close")?.addEventListener("click", closeGuidePanel);
    panel.querySelector(".fr-guide-open")?.addEventListener("click", openFallbackIframe);
    panel.querySelector(".fr-guide-refresh")?.addEventListener("click", () => openGuidePanel(context, state.opener, true));
  }

  async function openGuidePanel(context, opener, forceRefresh) {
    if (!context.guideTntId) {
      openFallbackIframe();
      return;
    }

    const overlay = document.getElementById("iframeOverlay");
    const panel = ensurePanel();
    if (!overlay || !panel) return;

    const panelWasOpen = !panel.hidden && overlay.classList.contains("fr-guidetnt-program-active");
    if (!panelWasOpen) state.previousOverlayVisible = overlayIsVisible(overlay);
    state.opener = opener || document.activeElement;
    const requestId = ++state.requestId;

    overlay.classList.add("fr-guidetnt-program-active");
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    panel.hidden = false;
    renderLoading(panel, context);

    const apiUrl = `/api/guidetnt-epg?channelId=${encodeURIComponent(context.guideTntId)}${forceRefresh ? `&_=${Date.now()}` : ""}`;
    try {
      const response = await fetch(apiUrl, { cache: forceRefresh ? "no-store" : "default" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !data.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${response.status}`);
      }
      if (requestId !== state.requestId) return;
      renderPanel(panel, context, data);
    } catch (error) {
      if (requestId !== state.requestId) return;
      console.warn("[ARES] GuideTNT natif indisponible, fallback iframe", error);
      openFallbackIframe();
    }
  }

  function contextFromItem(itemEl) {
    const guideTntId = normalizeGuideTntId(itemEl.dataset.guideTntId);
    const titleEl = itemEl.querySelector(".channel-title");
    const logoEl = itemEl.querySelector(".channel-logo img");
    return {
      guideTntId,
      name: itemEl.title || titleEl?.textContent || "Chaine FR",
      logo: logoEl?.currentSrc || logoEl?.src || ""
    };
  }

  function buildBadge(context) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn fr-program-badge";
    btn.title = context.guideTntId ? "Programme / Infos GuideTNT" : "Grille GuideTNT";
    btn.setAttribute("aria-label", btn.title);

    const icon = document.createElement("span");
    icon.textContent = "i";
    icon.setAttribute("aria-hidden", "true");
    icon.className = "fr-program-badge-icon";
    btn.appendChild(icon);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openGuidePanel(context, btn, false);
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
      #iframeOverlay.fr-guidetnt-program-active {
        display: block !important;
        background:
          radial-gradient(circle at top left, rgba(0,229,255,.14), transparent 36%),
          radial-gradient(circle at bottom right, rgba(255,145,0,.12), transparent 34%),
          rgba(2,4,10,.96) !important;
      }
      #iframeOverlay.fr-guidetnt-program-active #iframeEl {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      #iframeOverlay.fr-guidetnt-program-active #iframeOverlayBoostCurtain {
        display: none !important;
        pointer-events: none !important;
      }
      .fr-guide-panel {
        position: absolute;
        inset: 14px;
        z-index: 60;
        color: #e0f7ff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .fr-guide-panel[hidden] { display: none !important; }
      .fr-guide-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(0,229,255,.28);
        background: rgba(2,6,13,.94);
        box-shadow: 0 0 36px rgba(0,229,255,.16), 0 0 28px rgba(255,145,0,.1);
        overflow: hidden;
      }
      .fr-guide-head {
        min-height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0,229,255,.16);
        background: rgba(4,12,24,.86);
      }
      .fr-guide-head h2,
      .fr-guide-day-head h3,
      .fr-guide-lockup h3,
      .fr-guide-item h4 {
        margin: 0;
      }
      .fr-guide-head h2 {
        color: #fff;
        font-size: 18px;
        line-height: 1.1;
      }
      .fr-guide-kicker {
        margin: 0 0 4px;
        color: #ffb74d;
        font-size: 11px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .fr-guide-head-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .fr-guide-open,
      .fr-guide-fallback,
      .fr-guide-refresh,
      .fr-guide-close {
        min-width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0,229,255,.35);
        border-radius: 999px;
        background: rgba(0,0,0,.38);
        color: #e0f7ff;
        text-decoration: none;
        cursor: pointer;
        font-weight: 800;
        font-size: 12px;
      }
      .fr-guide-open,
      .fr-guide-fallback {
        padding: 0 10px;
        color: #ffb74d;
      }
      .fr-guide-grid {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(250px, 360px) minmax(0, 1fr);
        gap: 14px;
        padding: 14px;
      }
      .fr-guide-now,
      .fr-guide-day {
        min-width: 0;
        min-height: 0;
        border: 1px solid rgba(0,229,255,.18);
        background: linear-gradient(180deg, rgba(7,19,32,.92), rgba(0,0,0,.52));
        overflow: hidden;
      }
      .fr-guide-now { padding: 16px; }
      .fr-guide-lockup {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .fr-guide-logo {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        overflow: hidden;
        background: #fff;
        border: 1px solid rgba(0,229,255,.56);
        box-shadow: 0 0 18px rgba(0,229,255,.38);
        color: #02040a;
        font-weight: 900;
      }
      .fr-guide-logo img {
        width: 86%;
        height: 86%;
        object-fit: contain;
      }
      .fr-guide-lockup h3 {
        color: #fff;
        font-size: clamp(22px, 3vw, 34px);
        line-height: 1.05;
      }
      .fr-guide-timeband {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin: 14px 0 9px;
        color: #e0f7ff;
        font-size: 13px;
        font-weight: 800;
      }
      .fr-guide-progress {
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid rgba(0,229,255,.16);
        background: rgba(0,229,255,.14);
      }
      .fr-guide-progress span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #00e5ff, #ffb74d);
        box-shadow: 0 0 14px rgba(0,229,255,.5);
      }
      .fr-guide-summary {
        margin: 16px 0 0;
        color: #c9e8f2;
        font-size: 14px;
        line-height: 1.45;
      }
      .fr-guide-next {
        margin-top: 18px;
        padding: 12px;
        border: 1px solid rgba(255,183,77,.32);
        background: rgba(255,145,0,.06);
      }
      .fr-guide-next strong {
        display: block;
        margin-bottom: 4px;
        color: #ffb74d;
        font-size: 12px;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .fr-guide-next span {
        display: block;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
      }
      .fr-guide-day {
        display: flex;
        flex-direction: column;
      }
      .fr-guide-day-head {
        min-height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(0,229,255,.14);
      }
      .fr-guide-day-head h3 {
        color: #ffb74d;
        font-size: 13px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .fr-guide-day-head span,
      .fr-guide-tag {
        border: 1px solid rgba(0,229,255,.28);
        border-radius: 999px;
        color: #00e5ff;
        padding: 4px 7px;
        font-size: 10px;
        letter-spacing: .08em;
        text-transform: uppercase;
        background: rgba(0,229,255,.06);
        white-space: nowrap;
      }
      .fr-guide-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 8px;
        scrollbar-width: thin;
        scrollbar-color: #00e5ff rgba(0,0,0,.5);
      }
      .fr-guide-item {
        display: grid;
        grid-template-columns: 88px minmax(0, 1fr) 72px;
        align-items: center;
        gap: 12px;
        min-height: 70px;
        margin-bottom: 8px;
        padding: 10px;
        border: 1px solid rgba(0,229,255,.15);
        background: rgba(0,0,0,.22);
      }
      .fr-guide-item.is-now {
        border-color: rgba(255,183,77,.64);
        background: linear-gradient(90deg, rgba(255,145,0,.12), rgba(0,229,255,.08));
      }
      .fr-guide-time {
        color: #ffb74d;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }
      .fr-guide-item-copy { min-width: 0; }
      .fr-guide-item h4 {
        color: #fff;
        font-size: 14px;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fr-guide-item p {
        margin: 4px 0 0;
        color: #82a7b9;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fr-guide-tag { justify-self: end; }
      .fr-guide-loading,
      .fr-guide-error,
      .fr-guide-empty {
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 24px;
        color: #c9e8f2;
        text-align: left;
      }
      .fr-guide-loading strong,
      .fr-guide-error strong {
        display: block;
        color: #fff;
        margin-bottom: 4px;
      }
      .fr-guide-loading span,
      .fr-guide-error span {
        display: block;
        color: #82a7b9;
        font-size: 13px;
      }
      .fr-guide-error {
        flex-direction: column;
        text-align: center;
      }
      @media (max-width: 820px) {
        .fr-guide-panel { inset: 8px; }
        .fr-guide-head {
          min-height: 52px;
          padding: 9px 10px;
        }
        .fr-guide-head h2 { font-size: 15px; }
        .fr-guide-grid {
          grid-template-columns: 1fr;
          overflow: auto;
          padding: 8px;
        }
        .fr-guide-day { min-height: 360px; }
        .fr-guide-lockup h3 { font-size: 24px; }
        .fr-guide-logo {
          width: 58px;
          height: 58px;
        }
        .fr-guide-item {
          grid-template-columns: 74px minmax(0, 1fr);
        }
        .fr-guide-tag {
          grid-column: 2;
          justify-self: start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function injectBadgesIntoFrList() {
    if (!isFrTabActive()) return;

    const frRoot = document.getElementById("channelFrList");
    if (!frRoot) return;

    injectStylesOnce();

    frRoot.querySelectorAll(".channel-item").forEach((itemEl) => {
      const actionsDiv = itemEl.querySelector(".channel-actions");
      if (!actionsDiv) return;
      if (actionsDiv.querySelector(".fr-program-badge")) return;

      const favBtn = actionsDiv.querySelector("button.icon-btn.fav-btn");
      const badge = buildBadge(contextFromItem(itemEl));
      if (favBtn) actionsDiv.insertBefore(badge, favBtn);
      else actionsDiv.prepend(badge);
    });
  }

  function setup() {
    injectStylesOnce();
    injectBadgesIntoFrList();

    const frRoot = document.getElementById("channelFrList");
    const mo = new MutationObserver(() => injectBadgesIntoFrList());
    mo.observe(frRoot || document.body, { childList: true, subtree: true });

    document.addEventListener("click", (event) => {
      if (event.target && event.target.closest && event.target.closest(".tab-btn")) {
        setTimeout(injectBadgesIntoFrList, 0);
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      const panel = document.getElementById("frGuideTntProgramPanel");
      if (event.key === "Escape" && panel && !panel.hidden) closeGuidePanel();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
