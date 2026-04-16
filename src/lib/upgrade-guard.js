(function initUpgradeGuard(global) {
  "use strict";

  const STYLE_ID = "gmk-hide-upgrade-style";

  function applyHidden(selectors) {
    const selectorList = Array.isArray(selectors) ? selectors.filter(Boolean).join(",") : "";
    if (!selectorList) {
      return;
    }

    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.documentElement.appendChild(styleEl);
    }

    const css = selectorList + " { display: none !important; }";
    if (styleEl.textContent === css) {
      return;
    }

    styleEl.textContent = css;
  }

  function removeHidden() {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
  }

  global.GPE_UpgradeGuard = {
    applyHidden,
    removeHidden
  };
})(globalThis);
