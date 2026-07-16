/* js/pt-program-badges.js
   Programme / Infos pour les chaines PT.
   Priorite: panneau natif MEO via /api/meo-epg, puis ancien fallback NOS si fourni.
*/

(() => {
  "use strict";

  const MEO_GUIDE_URL = "https://www.meo.pt/tv/canais-programacao/guia-tv";
  const state = {
    previousOverlayVisible: false,
    opener: null,
    requestId: 0
  };

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

  function normalizeMeoCallLetter(value) {
    const callLetter = String(value || "").trim();
    if (!/^[A-Za-z0-9 _-]{1,32}$/.test(callLetter)) return "";
    return callLetter;
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

  function todayLisbon() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Lisbon",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function overlayIsVisible(overlay) {
    return !!overlay && !overlay.classList.contains("hidden");
  }

  function ensurePanel() {
    const overlay = document.getElementById("iframeOverlay");
    if (!overlay) return null;

    let panel = overlay.querySelector("#ptMeoProgramPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "ptMeoProgramPanel";
      panel.className = "pt-meo-panel";
      panel.setAttribute("aria-label", "Programme TV Portugal");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.hidden = true;
      overlay.appendChild(panel);
    }
    return panel;
  }

  function closeMeoPanel() {
    const overlay = document.getElementById("iframeOverlay");
    const panel = document.getElementById("ptMeoProgramPanel");
    state.requestId += 1;
    if (panel) panel.hidden = true;
    if (overlay) {
      overlay.classList.remove("pt-meo-program-active");
      overlay.setAttribute("aria-hidden", state.previousOverlayVisible ? "false" : "true");
      if (!state.previousOverlayVisible) overlay.classList.add("hidden");
    }
    if (state.opener && typeof state.opener.focus === "function") {
      try { state.opener.focus({ preventScroll: true }); } catch {
        try { state.opener.focus(); } catch {}
      }
    }
  }

  function makeStatusLabel(program) {
    if (!program) return "";
    if (program.status === "now") return "Live";
    if (program.status === "past") return "Passe";
    return "Ensuite";
  }

  function renderLoading(panel, context) {
    panel.innerHTML = `
      <div class="pt-meo-shell">
        <header class="pt-meo-head">
          <div>
            <p class="pt-meo-kicker">Programme / Infos MEO</p>
            <h2>${escapeHtml(context.name || context.callLetter)}</h2>
          </div>
          <button type="button" class="pt-meo-close" title="Fermer">x</button>
        </header>
        <div class="pt-meo-loading">
          <div class="pt-meo-logo-ring">${context.logo ? `<img src="${escapeHtml(context.logo)}" alt="">` : "TV"}</div>
          <div>
            <strong>Chargement du programme...</strong>
            <span>Lecture du guide MEO pour ${escapeHtml(context.callLetter)}</span>
          </div>
        </div>
      </div>
    `;
    panel.querySelector(".pt-meo-close")?.addEventListener("click", closeMeoPanel);
  }

  function renderError(panel, context, message) {
    panel.innerHTML = `
      <div class="pt-meo-shell">
        <header class="pt-meo-head">
          <div>
            <p class="pt-meo-kicker">Programme / Infos MEO</p>
            <h2>${escapeHtml(context.name || context.callLetter)}</h2>
          </div>
          <button type="button" class="pt-meo-close" title="Fermer">x</button>
        </header>
        <div class="pt-meo-error">
          <strong>Programme indisponible</strong>
          <span>${escapeHtml(message || "MEO ne repond pas pour cette chaine.")}</span>
          <a class="pt-meo-link" href="${MEO_GUIDE_URL}" target="_blank" rel="noopener noreferrer">Ouvrir MEO</a>
        </div>
      </div>
    `;
    panel.querySelector(".pt-meo-close")?.addEventListener("click", closeMeoPanel);
  }

  function renderProgramPanel(panel, context, data) {
    const programs = Array.isArray(data.programs) ? data.programs : [];
    const current = data.current || programs.find((program) => program.status === "now") || programs[0] || null;
    const next = data.next || programs.find((program) => program.status === "next") || null;
    const progress = Math.max(0, Math.min(100, Number(current?.progressPct || 0)));
    const logo = context.logo || data.logoUrl || "";

    const rows = programs.map((program) => `
      <article class="pt-meo-item ${program.status === "now" ? "is-now" : ""}">
        <span class="pt-meo-time">${escapeHtml(program.startTime || "--:--")} - ${escapeHtml(program.endTime || "--:--")}</span>
        <div class="pt-meo-item-copy">
          <h4>${escapeHtml(program.title || "Programme")}</h4>
          <p>${escapeHtml(program.synopsis || "Informations non disponibles.")}</p>
        </div>
        <span class="pt-meo-tag">${escapeHtml(makeStatusLabel(program))}</span>
      </article>
    `).join("");

    panel.innerHTML = `
      <div class="pt-meo-shell">
        <header class="pt-meo-head">
          <div>
            <p class="pt-meo-kicker">Programme / Infos MEO</p>
            <h2>${escapeHtml(context.name || context.callLetter)}</h2>
          </div>
          <div class="pt-meo-head-actions">
            <a href="${MEO_GUIDE_URL}" target="_blank" rel="noopener noreferrer" class="pt-meo-open">MEO</a>
            <button type="button" class="pt-meo-refresh" title="Actualiser">R</button>
            <button type="button" class="pt-meo-close" title="Fermer">x</button>
          </div>
        </header>

        <div class="pt-meo-grid">
          <section class="pt-meo-now">
            <div class="pt-meo-lockup">
              <div class="pt-meo-logo-ring">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : "TV"}</div>
              <div>
                <p class="pt-meo-kicker">${escapeHtml(context.callLetter)} - maintenant</p>
                <h3>${escapeHtml(current?.title || "Programme indisponible")}</h3>
              </div>
            </div>

            <div class="pt-meo-timeband">
              <span>${escapeHtml(current?.startTime || "--:--")}</span>
              <span>${escapeHtml(current?.endTime || "--:--")}</span>
            </div>
            <div class="pt-meo-progress"><span style="width:${progress}%"></span></div>

            <p class="pt-meo-summary">${escapeHtml(current?.synopsis || "MEO ne fournit pas de resume pour ce programme.")}</p>

            <div class="pt-meo-next">
              <strong>A suivre</strong>
              <span>${escapeHtml(next?.title || "Programme suivant indisponible")}</span>
            </div>
          </section>

          <section class="pt-meo-day">
            <div class="pt-meo-day-head">
              <h3>Aujourd'hui</h3>
              <span>${programs.length} programmes</span>
            </div>
            <div class="pt-meo-list">
              ${rows || '<div class="pt-meo-empty">Aucun programme disponible.</div>'}
            </div>
          </section>
        </div>
      </div>
    `;

    panel.querySelector(".pt-meo-close")?.addEventListener("click", closeMeoPanel);
    panel.querySelector(".pt-meo-refresh")?.addEventListener("click", () => {
      openMeoPanel(context, state.opener, true);
    });
  }

  async function openMeoPanel(context, opener, forceRefresh) {
    const overlay = document.getElementById("iframeOverlay");
    const panel = ensurePanel();
    if (!overlay || !panel) return;

    const panelWasOpen = !panel.hidden && overlay.classList.contains("pt-meo-program-active");
    if (!panelWasOpen) state.previousOverlayVisible = overlayIsVisible(overlay);
    state.opener = opener || document.activeElement;
    const requestId = ++state.requestId;

    overlay.classList.add("pt-meo-program-active");
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    panel.hidden = false;
    renderLoading(panel, context);

    const date = todayLisbon();
    const apiUrl = `/api/meo-epg?callLetter=${encodeURIComponent(context.callLetter)}&date=${encodeURIComponent(date)}${forceRefresh ? `&_=${Date.now()}` : ""}`;

    try {
      const response = await fetch(apiUrl, { cache: forceRefresh ? "no-store" : "default" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !data.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${response.status}`);
      }
      if (requestId !== state.requestId) return;
      renderProgramPanel(panel, context, data);
    } catch (error) {
      if (requestId !== state.requestId) return;
      renderError(panel, context, String(error?.message || error));
    }
  }

  function openNosFallback(url) {
    const overlay = document.getElementById("iframeOverlay");
    const iframe = document.getElementById("iframeEl");
    if (!overlay || !iframe) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    overlay.classList.remove("pt-meo-program-active");
    const panel = document.getElementById("ptMeoProgramPanel");
    if (panel) panel.hidden = true;
    iframe.removeAttribute("sandbox");
    iframe.setAttribute("referrerpolicy", "origin");
    iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture; encrypted-media");
    iframe.src = url;
    overlay.classList.add("pt-program-guide-active");
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    ensureExternalFallback(url);
  }

  function ensureExternalFallback(url) {
    const controls = document.querySelector("#iframeOverlay .iframe-overlay-controls");
    if (!controls) return;

    let link = controls.querySelector(".pt-program-open-external");
    if (!link) {
      link = document.createElement("a");
      link.className = "btn pt-program-open-external";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Ouvrir NOS";
      controls.appendChild(link);
    }
    link.href = url;
    link.hidden = false;
  }

  function buildBadge(context) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn pt-program-badge";
    btn.title = context.callLetter ? "Programme / Infos MEO" : "Programme / Infos NOS TV";
    btn.setAttribute("aria-label", btn.title);

    const icon = document.createElement("span");
    icon.textContent = "i";
    icon.setAttribute("aria-hidden", "true");
    icon.className = "pt-program-badge-icon";
    btn.appendChild(icon);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (context.callLetter) openMeoPanel(context, btn, false);
      else if (context.programUrl) openNosFallback(context.programUrl);
    });

    return btn;
  }

  function contextFromItem(itemEl) {
    const programUrl = normalizeProgramUrl(itemEl.dataset.programUrl);
    const callLetter = normalizeMeoCallLetter(itemEl.dataset.meoCallLetter);
    if (!callLetter && !programUrl) return null;

    const titleEl = itemEl.querySelector(".channel-title");
    const logoEl = itemEl.querySelector(".channel-logo img");
    return {
      callLetter,
      programUrl,
      name: itemEl.title || titleEl?.textContent || callLetter || "Chaine PT",
      logo: logoEl?.currentSrc || logoEl?.src || ""
    };
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
      .pt-program-open-external {
        margin-left: 8px;
        text-decoration: none;
      }
      #iframeOverlay.pt-meo-program-active {
        display: block !important;
        background:
          radial-gradient(circle at top left, rgba(0,229,255,.14), transparent 36%),
          radial-gradient(circle at bottom right, rgba(255,145,0,.12), transparent 34%),
          rgba(2,4,10,.96) !important;
      }
      #iframeOverlay.pt-meo-program-active #iframeOverlayBoostCurtain {
        display: none !important;
        pointer-events: none !important;
      }
      .pt-meo-panel {
        position: absolute;
        inset: 14px;
        z-index: 60;
        color: #e0f7ff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .pt-meo-panel[hidden] { display: none !important; }
      .pt-meo-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(0,229,255,.28);
        background: rgba(2,6,13,.94);
        box-shadow: 0 0 36px rgba(0,229,255,.16), 0 0 28px rgba(255,145,0,.1);
        overflow: hidden;
      }
      .pt-meo-head {
        min-height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0,229,255,.16);
        background: rgba(4,12,24,.86);
      }
      .pt-meo-head h2,
      .pt-meo-day-head h3,
      .pt-meo-lockup h3,
      .pt-meo-item h4 {
        margin: 0;
      }
      .pt-meo-head h2 {
        color: #fff;
        font-size: 18px;
        line-height: 1.1;
      }
      .pt-meo-kicker {
        margin: 0 0 4px;
        color: #ffb74d;
        font-size: 11px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .pt-meo-head-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .pt-meo-open,
      .pt-meo-refresh,
      .pt-meo-close {
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
      .pt-meo-open {
        padding: 0 10px;
        color: #ffb74d;
      }
      .pt-meo-grid {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(250px, 360px) minmax(0, 1fr);
        gap: 14px;
        padding: 14px;
      }
      .pt-meo-now,
      .pt-meo-day {
        min-width: 0;
        min-height: 0;
        border: 1px solid rgba(0,229,255,.18);
        background: linear-gradient(180deg, rgba(7,19,32,.92), rgba(0,0,0,.52));
        overflow: hidden;
      }
      .pt-meo-now {
        padding: 16px;
      }
      .pt-meo-lockup {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .pt-meo-logo-ring {
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
      .pt-meo-logo-ring img {
        width: 86%;
        height: 86%;
        object-fit: contain;
      }
      .pt-meo-lockup h3 {
        color: #fff;
        font-size: clamp(22px, 3vw, 34px);
        line-height: 1.05;
      }
      .pt-meo-timeband {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 14px 0 9px;
        color: #e0f7ff;
        font-size: 13px;
        font-weight: 800;
      }
      .pt-meo-progress {
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid rgba(0,229,255,.16);
        background: rgba(0,229,255,.14);
      }
      .pt-meo-progress span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #00e5ff, #ffb74d);
        box-shadow: 0 0 14px rgba(0,229,255,.5);
      }
      .pt-meo-summary {
        margin: 16px 0 0;
        color: #c9e8f2;
        font-size: 14px;
        line-height: 1.45;
      }
      .pt-meo-next {
        margin-top: 18px;
        padding: 12px;
        border: 1px solid rgba(255,183,77,.32);
        background: rgba(255,145,0,.06);
      }
      .pt-meo-next strong {
        display: block;
        margin-bottom: 4px;
        color: #ffb74d;
        font-size: 12px;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .pt-meo-next span {
        display: block;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
      }
      .pt-meo-day {
        display: flex;
        flex-direction: column;
      }
      .pt-meo-day-head {
        min-height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(0,229,255,.14);
      }
      .pt-meo-day-head h3 {
        color: #ffb74d;
        font-size: 13px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .pt-meo-day-head span,
      .pt-meo-tag {
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
      .pt-meo-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 8px;
        scrollbar-width: thin;
        scrollbar-color: #00e5ff rgba(0,0,0,.5);
      }
      .pt-meo-item {
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
      .pt-meo-item.is-now {
        border-color: rgba(255,183,77,.64);
        background: linear-gradient(90deg, rgba(255,145,0,.12), rgba(0,229,255,.08));
      }
      .pt-meo-time {
        color: #ffb74d;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }
      .pt-meo-item-copy {
        min-width: 0;
      }
      .pt-meo-item h4 {
        color: #fff;
        font-size: 14px;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pt-meo-item p {
        margin: 4px 0 0;
        color: #82a7b9;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pt-meo-tag {
        justify-self: end;
      }
      .pt-meo-loading,
      .pt-meo-error,
      .pt-meo-empty {
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 24px;
        color: #c9e8f2;
        text-align: left;
      }
      .pt-meo-loading strong,
      .pt-meo-error strong {
        display: block;
        color: #fff;
        margin-bottom: 4px;
      }
      .pt-meo-loading span,
      .pt-meo-error span {
        display: block;
        color: #82a7b9;
        font-size: 13px;
      }
      .pt-meo-error {
        flex-direction: column;
        text-align: center;
      }
      .pt-meo-link {
        color: #ffb74d;
        text-decoration: none;
        border: 1px solid rgba(255,183,77,.35);
        border-radius: 999px;
        padding: 7px 12px;
      }
      @media (max-width: 820px) {
        .pt-meo-panel { inset: 8px; }
        .pt-meo-head {
          min-height: 52px;
          padding: 9px 10px;
        }
        .pt-meo-head h2 { font-size: 15px; }
        .pt-meo-grid {
          grid-template-columns: 1fr;
          overflow: auto;
          padding: 8px;
        }
        .pt-meo-now { min-height: auto; }
        .pt-meo-day { min-height: 360px; }
        .pt-meo-lockup h3 { font-size: 24px; }
        .pt-meo-logo-ring {
          width: 58px;
          height: 58px;
        }
        .pt-meo-item {
          grid-template-columns: 74px minmax(0, 1fr);
        }
        .pt-meo-tag {
          grid-column: 2;
          justify-self: start;
        }
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
      const context = contextFromItem(itemEl);
      if (!context) return;

      const actionsDiv = itemEl.querySelector(".channel-actions");
      if (!actionsDiv) return;
      if (actionsDiv.querySelector(".pt-program-badge")) return;

      const favBtn = actionsDiv.querySelector("button.icon-btn.fav-btn");
      const badge = buildBadge(context);
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

    document.addEventListener("keydown", (event) => {
      const panel = document.getElementById("ptMeoProgramPanel");
      if (event.key === "Escape" && panel && !panel.hidden) closeMeoPanel();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
