/* js/subtitle-lang-dropdown.js
   Ajoute une UI "liste déroulante" pour choisir des codes de langue / locale
   et remplir automatiquement #subtitleSearchLangInput (séparés par virgule).

   - Basé sur Intl.supportedValuesOf('language'|'region') quand dispo
   - Fallback minimal si le navigateur est ancien
   - Format par défaut: minuscules (ex: pt-br). Tu peux basculer en BCP47 (pt-BR).
*/
(() => {
  "use strict";

  const CONFIG = {
    inputId: "subtitleSearchLangInput",
    anchorAfterId: "subtitleSearchLangInput", // insérer juste après l'input
    storageKey: "subtitle_lang_dropdown:last",
    // Par défaut, garde le style que tu utilises déjà (minuscules).
    defaultCase: "lower", // "lower" ou "bcp47"
    // Quand "bcp47": langue en minuscules + région en MAJ (pt-BR)
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function safeSupportedValuesOf(kind) {
    try {
      if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
        return Intl.supportedValuesOf(kind) || [];
      }
    } catch (_) {}
    return [];
  }

  function makeDisplayNames(locale, type) {
    try {
      if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
        return new Intl.DisplayNames([locale], { type });
      }
    } catch (_) {}
    return null;
  }

  function normalizeCsv(inputValue) {
    return inputValue
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function uniquePreserveOrder(arr) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const k = x.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(x);
      }
    }
    return out;
  }

  function formatLocale(lang, region, casing) {
    if (!lang) return "";
    if (!region) return lang;
    if (casing === "bcp47") return `${lang.toLowerCase()}-${region.toUpperCase()}`;
    // lower
    return `${lang.toLowerCase()}-${region.toLowerCase()}`;
  }

  function tryParseLocaleTag(tag) {
    // accepte fr, pt-br, pt-BR, zh-Hant, zh-Hant-TW (on prend region si trouvée en fin)
    const t = String(tag || "").trim();
    if (!t) return { lang: "", region: "" };
    const parts = t.replace("_", "-").split("-").filter(Boolean);
    const lang = (parts[0] || "").toLowerCase();
    let region = "";
    // region ISO3166-1 alpha-2 ou UN M49 (3 chiffres)
    const last = parts[parts.length - 1] || "";
    if (/^[A-Za-z]{2}$/.test(last)) region = last.toUpperCase();
    if (/^\d{3}$/.test(last)) region = last;
    return { lang, region };
  }

  function buildUI(inputEl) {
    const wrapper = document.createElement("div");
    wrapper.className = "subsearch-row";
    wrapper.style.marginTop = "10px";

    const label = document.createElement("div");
    label.className = "subsearch-label";
    label.textContent = "Ajouter une langue (liste déroulante)";
    wrapper.appendChild(label);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr auto";
    grid.style.gap = "8px";
    wrapper.appendChild(grid);

    const langSelect = document.createElement("select");
    langSelect.className = "subsearch-select";
    langSelect.title = "Langue (ISO / BCP-47)";
    langSelect.id = "subtitleLangDropdown_lang";
    grid.appendChild(langSelect);

    const regionSelect = document.createElement("select");
    regionSelect.className = "subsearch-select";
    regionSelect.title = "Pays / région (ISO 3166)";
    regionSelect.id = "subtitleLangDropdown_region";
    grid.appendChild(regionSelect);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-ghost";
    addBtn.textContent = "Ajouter";
    addBtn.id = "subtitleLangDropdown_add";
    grid.appendChild(addBtn);

    // Ligne outils (casing + clear)
    const tools = document.createElement("div");
    tools.style.display = "flex";
    tools.style.gap = "8px";
    tools.style.alignItems = "center";
    tools.style.marginTop = "8px";
    wrapper.appendChild(tools);

    const casingWrap = document.createElement("label");
    casingWrap.style.display = "inline-flex";
    casingWrap.style.alignItems = "center";
    casingWrap.style.gap = "6px";
    casingWrap.style.opacity = "0.9";
    casingWrap.style.userSelect = "none";
    tools.appendChild(casingWrap);

    const casingCheckbox = document.createElement("input");
    casingCheckbox.type = "checkbox";
    casingCheckbox.id = "subtitleLangDropdown_case";
    casingCheckbox.checked = CONFIG.defaultCase === "bcp47";
    casingCheckbox.style.accentColor = "#ff9100";
    casingWrap.appendChild(casingCheckbox);

    const casingText = document.createElement("span");
    casingText.style.fontSize = "11px";
    casingText.style.color = "rgba(255,255,255,.78)";
    casingText.textContent = "Format BCP47 (pt-BR) au lieu de pt-br";
    casingWrap.appendChild(casingText);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn-ghost";
    clearBtn.textContent = "Vider";
    clearBtn.title = "Vider le champ des langues";
    clearBtn.id = "subtitleLangDropdown_clear";
    tools.appendChild(clearBtn);

    // Aperçu / chips
    const chips = document.createElement("div");
    chips.id = "subtitleLangDropdown_chips";
    chips.style.display = "flex";
    chips.style.flexWrap = "wrap";
    chips.style.gap = "6px";
    chips.style.marginTop = "10px";
    wrapper.appendChild(chips);

    const hint = document.createElement("div");
    hint.className = "subsearch-hint";
    hint.style.marginTop = "8px";
    hint.innerHTML = 'Astuce : sélectionne une <span>langue</span> + un <span>pays</span> (optionnel), puis clique "Ajouter".';
    wrapper.appendChild(hint);

    // insère juste après l'input existant (dans la même card)
    const parentRow = inputEl.closest(".subsearch-row");
    if (parentRow && parentRow.parentNode) {
      parentRow.parentNode.insertBefore(wrapper, parentRow.nextSibling);
    } else {
      inputEl.insertAdjacentElement("afterend", wrapper);
    }

    return { wrapper, langSelect, regionSelect, addBtn, clearBtn, chips, casingCheckbox };
  }

  function fillSelect(select, items, formatter) {
    select.innerHTML = "";
    const frag = document.createDocumentFragment();

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = formatter ? formatter("") : "—";
    frag.appendChild(optEmpty);

    for (const v of items) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = formatter ? formatter(v) : v;
      frag.appendChild(opt);
    }
    select.appendChild(frag);
  }

  function createChip(code, onRemove) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = code + " ✕";
    chip.title = "Retirer " + code;
    chip.style.border = "1px solid rgba(0,229,255,.22)";
    chip.style.background = "rgba(0,0,0,.25)";
    chip.style.color = "rgba(255,255,255,.92)";
    chip.style.borderRadius = "999px";
    chip.style.padding = "6px 10px";
    chip.style.cursor = "pointer";
    chip.style.fontSize = "12px";
    chip.addEventListener("click", () => onRemove(code));
    return chip;
  }

  function renderChips(chipsEl, codes, onRemove) {
    chipsEl.innerHTML = "";
    if (!codes.length) return;

    const frag = document.createDocumentFragment();
    for (const c of codes) frag.appendChild(createChip(c, onRemove));
    chipsEl.appendChild(frag);
  }

  function init() {
    const inputEl = document.getElementById(CONFIG.inputId);
    if (!inputEl) return;

    const ui = buildUI(inputEl);

    // Data sources
    const languages = safeSupportedValuesOf("language");
    const regions = safeSupportedValuesOf("region");

    // Fallbacks (si Intl.supportedValuesOf n'existe pas)
    const fallbackLanguages = [
      "fr","en","es","pt","pt-pt","pt-br","de","it","nl","pl","ru","uk","tr","ar","ja","ko","zh","hi"
    ];
    const fallbackRegions = [
      "FR","US","GB","BR","PT","ES","DE","IT","CA","AU","MX","AR","BE","CH"
    ];

    const langDN = makeDisplayNames("fr", "language");
    const regDN  = makeDisplayNames("fr", "region");

    // Pour la liste langue: on veut des codes courts si possible.
    // supportedValuesOf('language') peut contenir des tags (en, fr, pt, pt-PT, zh-Hant…)
    const langList = (languages.length ? languages : fallbackLanguages)
      .slice()
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    const regionList = (regions.length ? regions : fallbackRegions)
      .slice()
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    fillSelect(ui.langSelect, langList, (code) => {
      if (!code) return "Langue…";
      const nice = langDN ? langDN.of(code) : null;
      return nice ? `${nice} — ${code}` : code;
    });

    fillSelect(ui.regionSelect, regionList, (code) => {
      if (!code) return "Pays / région… (optionnel)";
      const nice = regDN ? regDN.of(code) : null;
      return nice ? `${nice} — ${code}` : code;
    });

    // Restore last selection
    try {
      const last = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "null");
      if (last && typeof last === "object") {
        if (last.lang) ui.langSelect.value = last.lang;
        if (last.region) ui.regionSelect.value = last.region;
        if (last.case === "bcp47") ui.casingCheckbox.checked = true;
      } else {
        // essaie de déduire depuis le champ actuel (1ère langue)
        const current = normalizeCsv(inputEl.value);
        if (current[0]) {
          const parsed = tryParseLocaleTag(current[0]);
          if (parsed.lang) ui.langSelect.value = parsed.lang;
          if (parsed.region) ui.regionSelect.value = parsed.region;
        }
      }
    } catch (_) {}

    function getCasing() {
      return ui.casingCheckbox.checked ? "bcp47" : "lower";
    }

    function readCodes() {
      return normalizeCsv(inputEl.value);
    }

    function writeCodes(codes) {
      const clean = uniquePreserveOrder(codes);
      inputEl.value = clean.join(",");
      renderChips(ui.chips, clean, removeCode);
    }

    function persistSelection() {
      try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify({
          lang: ui.langSelect.value || "",
          region: ui.regionSelect.value || "",
          case: getCasing()
        }));
      } catch (_) {}
    }

    function addCurrent() {
      const langRaw = (ui.langSelect.value || "").trim();
      const regionRaw = (ui.regionSelect.value || "").trim();

      if (!langRaw) {
        // petit feedback visuel: focus
        ui.langSelect.focus();
        return;
      }

      // Si l'utilisateur choisit déjà un tag complet côté langue (ex: pt-PT),
      // on respecte. Sinon on combine langue + région.
      let out = "";
      if (langRaw.includes("-")) {
        // Normalize casing if it's language-region
        const parts = langRaw.split("-");
        const lang = parts[0] || langRaw;
        const maybeRegion = parts[1] || "";
        if (maybeRegion && /^[A-Za-z]{2}$/.test(maybeRegion)) {
          out = formatLocale(lang, maybeRegion, getCasing());
        } else {
          // tags plus complexes (zh-Hant…) on garde tel quel
          out = langRaw;
        }
      } else {
        out = formatLocale(langRaw, regionRaw, getCasing());
      }

      const codes = readCodes();
      codes.push(out);
      writeCodes(codes);
      persistSelection();
    }

    function removeCode(code) {
      const codes = readCodes().filter(c => c.toLowerCase() !== code.toLowerCase());
      writeCodes(codes);
    }

    function clearAll() {
      writeCodes([]);
    }

    // init chips
    writeCodes(readCodes());

    ui.addBtn.addEventListener("click", addCurrent);
    ui.clearBtn.addEventListener("click", clearAll);
    ui.langSelect.addEventListener("change", persistSelection);
    ui.regionSelect.addEventListener("change", persistSelection);
    ui.casingCheckbox.addEventListener("change", () => {
      persistSelection();
      // Optionnel: normaliser les entrées déjà présentes quand on change de format
      // (on laisse l'utilisateur maître; pas d'auto-modification agressive)
    });

    // Bonus: Enter = ajouter (si focus sur selects)
    ui.wrapper.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const t = e.target;
        if (t === ui.langSelect || t === ui.regionSelect) {
          e.preventDefault();
          addCurrent();
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();