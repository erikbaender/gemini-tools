(function initSelectorStrategy(global) {
  "use strict";

  function textFrom(el) {
    if (!el) {
      return "";
    }

    const aria = el.getAttribute("aria-label") || "";
    const text = el.textContent || "";
    return (aria + " " + text).replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) {
      return false;
    }

    const style = global.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function queryAll(selector, root) {
    const scope = root || document;
    return Array.from(scope.querySelectorAll(selector));
  }

  function findModelTrigger(config) {
    const preferred = queryAll("button[aria-haspopup='listbox'],button[aria-haspopup='menu'],div[role='button'][aria-haspopup='listbox'],div[role='button'][aria-haspopup='menu']");
    const byText = preferred.find(function findByText(el) {
      if (!isVisible(el)) {
        return false;
      }
      return config.modelControlHints.test(textFrom(el));
    });

    if (byText) {
      return byText;
    }

    const genericButtons = queryAll("button,div[role='button']");
    return (
      genericButtons.find(function findFallback(el) {
        if (!isVisible(el)) {
          return false;
        }
        const txt = textFrom(el);
        return config.modelControlHints.test(txt) && (config.fastRegex.test(txt) || config.proRegex.test(txt));
      }) || null
    );
  }

  function findOpenPopupRoot() {
    const candidates = queryAll("[role='listbox'],[role='menu'],[data-floating-ui-portal],cdk-overlay-container,.cdk-overlay-container");
    return candidates.find(isVisible) || document.body;
  }

  function findModeOption(config, targetMode) {
    const wanted = targetMode === "fast" ? config.fastRegex : config.proRegex;
    const blocked = targetMode === "fast" ? config.proRegex : config.fastRegex;
    const root = findOpenPopupRoot();
    const optionCandidates = queryAll("[role='option'],[role='menuitem'],button,div[role='button']", root);

    return (
      optionCandidates.find(function findTarget(el) {
        if (!isVisible(el)) {
          return false;
        }
        const txt = textFrom(el);
        if (!wanted.test(txt)) {
          return false;
        }

        return !blocked.test(txt);
      }) || null
    );
  }

  function findProOption(config) {
    return findModeOption(config, "pro");
  }

  function readCurrentModelText(triggerEl) {
    return textFrom(triggerEl);
  }

  global.GPE_SelectorStrategy = {
    findModelTrigger,
    findModeOption,
    findProOption,
    readCurrentModelText,
    textFrom
  };
})(globalThis);
