(function initUpgradeGuard(global) {
  "use strict";

  function createGuard(styleId) {
    function applyHidden(selectors) {
      const selectorList = Array.isArray(selectors) ? selectors.filter(Boolean).join(",") : "";
      if (!selectorList) {
        return;
      }

      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.documentElement.appendChild(styleEl);
      }

      const css = selectorList + " { display: none !important; }";
      if (styleEl.textContent === css) {
        return;
      }

      styleEl.textContent = css;
    }

    function removeHidden() {
      const styleEl = document.getElementById(styleId);
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    }

    return { applyHidden, removeHidden };
  }

  global.GPE_CreateGuard = createGuard;
  global.GPE_UpgradeGuard = createGuard("gmk-hide-upgrade-style");
})(globalThis);
