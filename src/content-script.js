(function initGeminiProEnforcer(global) {
  "use strict";

  if (global.__GPE_INSTALLED__) {
    return;
  }
  global.__GPE_INSTALLED__ = true;

  const CONFIG = {
    debug: false,
    debounceMs: 350,
    verifyDelayMs: 300,
    menuOpenDelayMs: 180,
    clickCooldownMs: 900,
    duplicateActionWindowMs: 1600,
    maxAttemptsPerCycle: 3,
    retryBackoffMs: [450, 1000, 2200, 4000],
    newChatFollowUpMs: 2000,
    proRegex: /\bpro\b/i,
    fastRegex: /\bfast\b/i,
    thinkingRegex: /\bthink/i,
    modelControlHints: /(model|gemini|2\.5|flash|pro|fast|think)/i
  };

  const DEFAULT_SETTINGS = {
    enableModelCheck: true,
    showCorrectionNotification: true,
    hideUpgradeButton: true,
    enableEnterNewline: true
  };

  const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
  const PREFERRED_MODE_KEY = "preferredMode";

  const log = CONFIG.debug
    ? function debugLog() {
        const args = Array.from(arguments);
        args.unshift("[Gemini Pro Enforcer]");
        console.log.apply(console, args);
      }
    : function noop() {};

  const guards = global.GPE_SafetyGuards;
  const retryHandler = global.GPE_RetryHandler;
  const selectorStrategy = global.GPE_SelectorStrategy;
  const modelSetter = global.GPE_ModelSetter;
  const notification = global.GPE_Notification || { show: function noop() {} };
  const upgradeGuard = global.GPE_UpgradeGuard || {
    applyHidden: function noop() {},
    removeHidden: function noop() {}
  };

  if (!guards || !retryHandler || !selectorStrategy || !modelSetter) {
    return;
  }

  const retryController = retryHandler.createRetryController(CONFIG);

  let isRunning = false;
  let preferredMode = null;
  let hasLoadedPreference = false;
  let hasLoadedSettings = false;
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let newChatFollowUpTimer = null;
  let lastObservedUrl = "";

  function normalizeMode(mode) {
    if (mode === "pro" || mode === "fast" || mode === "thinking") {
      return mode;
    }

    return null;
  }

  function readBool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function getStorageArea() {
    if (!global.chrome || !chrome.storage || !chrome.storage.local) {
      return null;
    }

    return chrome.storage.local;
  }

  function loadPreferredMode() {
    const storage = getStorageArea();
    if (!storage) {
      return Promise.resolve(null);
    }

    return new Promise(function onLoad(resolve) {
      storage.get([PREFERRED_MODE_KEY], function onGet(items) {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(normalizeMode(items[PREFERRED_MODE_KEY]));
      });
    });
  }

  function loadSettings() {
    const storage = getStorageArea();
    if (!storage) {
      return Promise.resolve(Object.assign({}, DEFAULT_SETTINGS));
    }

    return new Promise(function onLoad(resolve) {
      storage.get(SETTINGS_KEYS, function onGet(items) {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(Object.assign({}, DEFAULT_SETTINGS));
          return;
        }

        resolve({
          enableModelCheck: readBool(items.enableModelCheck, DEFAULT_SETTINGS.enableModelCheck),
          showCorrectionNotification: readBool(items.showCorrectionNotification, DEFAULT_SETTINGS.showCorrectionNotification),
          hideUpgradeButton: readBool(items.hideUpgradeButton, DEFAULT_SETTINGS.hideUpgradeButton),
          enableEnterNewline: readBool(items.enableEnterNewline, DEFAULT_SETTINGS.enableEnterNewline)
        });
      });
    });
  }

  function savePreferredMode(mode, source) {
    const normalized = normalizeMode(mode);
    if (!normalized) {
      return Promise.resolve();
    }

    preferredMode = normalized;
    log("Updated preferred mode", normalized, "source:", source);

    const storage = getStorageArea();
    if (!storage) {
      return Promise.resolve();
    }

    return new Promise(function onSave(resolve) {
      const data = {};
      data[PREFERRED_MODE_KEY] = normalized;
      storage.set(data, function onSet() {
        resolve();
      });
    });
  }

  function ensurePreferenceLoaded() {
    if (hasLoadedPreference) {
      return Promise.resolve();
    }

    return loadPreferredMode().then(function onLoaded(mode) {
      preferredMode = mode;
      hasLoadedPreference = true;
    });
  }

  function ensureSettingsLoaded() {
    if (hasLoadedSettings) {
      return Promise.resolve();
    }

    return loadSettings().then(function onLoaded(nextSettings) {
      settings = nextSettings;
      hasLoadedSettings = true;
    });
  }

  function syncPreferenceFromCurrentIfMissing() {
    if (preferredMode) {
      return Promise.resolve();
    }

    const current = modelSetter.detectModelState(CONFIG, selectorStrategy);
    if (current.state === "pro" || current.state === "fast" || current.state === "thinking") {
      return savePreferredMode(current.state, "initial-detect");
    }

    return Promise.resolve();
  }

  function applyUpgradeButtonSetting() {
    if (settings.hideUpgradeButton) {
      upgradeGuard.applyHidden(selectorStrategy.getUpgradeButtonSelectors());
      return;
    }

    upgradeGuard.removeHidden();
  }

  function showCorrectionToast(targetMode) {
    if (!settings.showCorrectionNotification) {
      return;
    }

    const label = targetMode === "fast" ? "Fast" : targetMode === "thinking" ? "Thinking" : "Pro";
    notification.show("Gemini switched mode by itself. Restored your preferred mode: " + label + ".");
  }

  function isFocusable(el) {
    if (!(el instanceof HTMLElement)) {
      return false;
    }

    if (el.matches("input, textarea, select, button") && !el.hasAttribute("disabled")) {
      return true;
    }

    if (el.hasAttribute("contenteditable") && el.getAttribute("contenteditable") !== "false") {
      return true;
    }

    return typeof el.focus === "function" && el.tabIndex >= 0;
  }

  function captureFocusedElement() {
    const active = document.activeElement;
    if (!isFocusable(active)) {
      return null;
    }

    return active;
  }

  function restoreFocusedElement(el) {
    if (el && document.contains(el) && isFocusable(el)) {
      try {
        el.focus({ preventScroll: true });
        return;
      } catch (err) {
        log("Focus restore failed on original element", err && err.message ? err.message : err);
      }
    }

    const fallback = document.querySelector("textarea, input[type='text'], [contenteditable='true']");
    if (!fallback || !(fallback instanceof HTMLElement)) {
      return;
    }

    try {
      fallback.focus({ preventScroll: true });
    } catch (err) {
      log("Focus restore failed on fallback element", err && err.message ? err.message : err);
    }
  }

  function runEnforcement(reason) {
    if (isRunning) {
      return;
    }

    isRunning = true;

    Promise.all([ensurePreferenceLoaded(), ensureSettingsLoaded()])
      .then(function onPreferenceReady() {
        return syncPreferenceFromCurrentIfMissing();
      })
      .then(function onPreferenceInitialized() {
        const now = Date.now();
        const current = modelSetter.detectModelState(CONFIG, selectorStrategy);
        const targetMode = normalizeMode(preferredMode);

        if (!settings.enableModelCheck) {
          log("Model check disabled, skipping", reason);
          isRunning = false;
          return;
        }

        if (!targetMode) {
          log("Preferred mode unavailable yet, skipping", reason);
          isRunning = false;
          return;
        }

        if (current.state === targetMode) {
          log("No action needed, already on preferred mode", reason, targetMode);
          retryController.reset();
          isRunning = false;
          return;
        }

        if (!guards.canAttempt(now, CONFIG)) {
          log("Attempt blocked by guardrail", reason, current.state, "->", targetMode);
          retryController.scheduleRetry(function onGuardRetry() {
            runEnforcement("guard-retry");
          });
          isRunning = false;
          return;
        }

        const focusedBeforeCorrection = captureFocusedElement();

        modelSetter.ensureModeSelected(CONFIG, selectorStrategy, targetMode).then(function onEnsure(result) {
          const ts = Date.now();
          if (guards.isDuplicateAction(ts, result.actionKey, CONFIG)) {
            log("Duplicate action suppressed", result.reason);
            isRunning = false;
            return;
          }

          guards.registerAttempt(ts, result.actionKey);

          if (result.changed || result.reason === "already-target") {
            log("Preferred mode restored", reason, targetMode, result.reason);
            if (result.changed) {
              showCorrectionToast(targetMode);
              restoreFocusedElement(focusedBeforeCorrection);
            }
            retryController.reset();
            isRunning = false;
            return;
          }

          log("Preferred mode restore did not stick, scheduling retry", reason, result.reason);
          retryController.scheduleRetry(function onEnsureRetry() {
            runEnforcement("retry");
          });
          isRunning = false;
        });
      })
      .catch(function onEnforcementError(err) {
        log("Runtime error", err && err.message ? err.message : err);
        isRunning = false;
      });
  }

  const runDebounced = retryHandler.createDebouncedRunner(CONFIG.debounceMs, function onDebouncedRun() {
    runEnforcement("debounced");
  });

  const runMutationDebounced = retryHandler.createDebouncedRunner(CONFIG.debounceMs, function onMutationDebounced() {
    applyUpgradeButtonSetting();
    runEnforcement("mutation");
  });

  function handleRouteChange() {
    guards.resetCycle(Date.now());
    retryController.reset();

    if (newChatFollowUpTimer !== null) {
      global.clearTimeout(newChatFollowUpTimer);
      newChatFollowUpTimer = null;
    }

    applyUpgradeButtonSetting();
    runDebounced();

    newChatFollowUpTimer = global.setTimeout(function onNewChatFollowUp() {
      newChatFollowUpTimer = null;
      guards.resetCycle(Date.now());
      runEnforcement("new-chat-followup");
    }, CONFIG.newChatFollowUpMs);
  }

  function installHistoryHooks() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function patchedPushState() {
      const result = originalPushState.apply(this, arguments);
      lastObservedUrl = global.location ? global.location.href : "";
      handleRouteChange();
      return result;
    };

    history.replaceState = function patchedReplaceState() {
      const result = originalReplaceState.apply(this, arguments);
      lastObservedUrl = global.location ? global.location.href : "";
      handleRouteChange();
      return result;
    };

    global.addEventListener("popstate", function onPopState() {
      lastObservedUrl = global.location ? global.location.href : "";
      handleRouteChange();
    });
  }

  function installMutationObserver() {
    lastObservedUrl = global.location ? global.location.href : "";

    const observer = new MutationObserver(function onMutation() {
      const currentUrl = global.location ? global.location.href : "";
      if (currentUrl && currentUrl !== lastObservedUrl) {
        lastObservedUrl = currentUrl;
        handleRouteChange();
        return;
      }
      runMutationDebounced();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  function installStorageSync() {
    if (!global.chrome || !chrome.storage || !chrome.storage.onChanged) {
      return;
    }

    chrome.storage.onChanged.addListener(function onStorageChanged(changes, areaName) {
      if (areaName !== "local") {
        return;
      }

      if (changes[PREFERRED_MODE_KEY]) {
        preferredMode = normalizeMode(changes[PREFERRED_MODE_KEY].newValue);
      }

      let hasSettingsChange = false;
      for (const key of SETTINGS_KEYS) {
        if (changes[key]) {
          settings[key] = readBool(changes[key].newValue, DEFAULT_SETTINGS[key]);
          hasSettingsChange = true;
        }
      }

      if (hasSettingsChange) {
        applyUpgradeButtonSetting();
        if (!settings.enableModelCheck) {
          retryController.reset();
          guards.resetCycle(Date.now());
        }
      }

      runDebounced();
    });
  }

  function isEditableComposerCandidate(el) {
    if (!(el instanceof HTMLElement)) {
      return null;
    }

    const direct = el.closest("[contenteditable]:not([contenteditable='false'])");
    if (!(direct instanceof HTMLElement) || !direct.isContentEditable) {
      return null;
    }

    if (!direct.closest("main,[role='main']")) {
      return null;
    }

    const semantics = selectorStrategy.textFrom(direct);
    const hasTextboxRole = /textbox|prompt|message/i.test(direct.getAttribute("role") || "");
    const hasMultilineFlag = direct.getAttribute("aria-multiline") === "true";
    const hasAriaSignals = /type|message|prompt|chat|gemini/i.test(semantics);
    const hasComposerContainer = Boolean(
      direct.closest("rich-textarea,[class*='composer'],[class*='prompt'],[class*='input'],[class*='editor']")
    );
    const hasNearbySend = Boolean(findSendButton(direct));

    if (!hasTextboxRole && !hasMultilineFlag && !hasAriaSignals && !hasComposerContainer && !hasNearbySend) {
      return null;
    }

    return direct;
  }

  function getDeepActiveElement(root) {
    let current = root && root.activeElement ? root.activeElement : null;
    while (current && current.shadowRoot && current.shadowRoot.activeElement) {
      current = current.shadowRoot.activeElement;
    }

    return current;
  }

  function findComposerFromEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      const candidate = isEditableComposerCandidate(node);
      if (candidate) {
        return candidate;
      }
    }

    return isEditableComposerCandidate(getDeepActiveElement(document));
  }

  function isActionButtonDisabled(el) {
    if (!(el instanceof HTMLElement)) {
      return true;
    }

    if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") {
      return true;
    }

    return false;
  }

  function isVisibleElement(el) {
    if (!(el instanceof HTMLElement)) {
      return false;
    }

    const style = global.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findSendButton(composerEl) {
    const selectors = [
      "button[aria-label*='send' i]",
      "button[data-test-id*='send' i]",
      "button[mattooltip*='send' i]",
      "div[role='button'][aria-label*='send' i]"
    ];

    const scopes = [];
    const composerForm = composerEl.closest("form");
    if (composerForm) {
      scopes.push(composerForm);
    }

    const composerMain = composerEl.closest("main,[role='main']");
    if (composerMain) {
      scopes.push(composerMain);
    }

    scopes.push(document);

    for (const scope of scopes) {
      for (const selector of selectors) {
        const buttons = Array.from(scope.querySelectorAll(selector));
        const target = buttons.find(function findTarget(btn) {
          return isVisibleElement(btn) && !isActionButtonDisabled(btn);
        });

        if (target) {
          return target;
        }
      }
    }

    return null;
  }

  function dispatchSendShortcut(composerEl) {
    const target = composerEl instanceof HTMLElement ? composerEl : document.activeElement;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: "Enter",
      code: "Enter",
      location: 0,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    };

    const keydown = new KeyboardEvent("keydown", eventInit);
    const keyup = new KeyboardEvent("keyup", eventInit);
    target.dispatchEvent(keydown);
    target.dispatchEvent(keyup);
    return true;
  }

  function insertComposerLineBreak(composerEl) {
    try {
      if (document.activeElement !== composerEl) {
        composerEl.focus();
      }

      return document.execCommand("insertLineBreak", false, null);
    } catch (err) {
      log("insertLineBreak execCommand failed:", err && err.message ? err.message : err);
      return false;
    }
  }

  function handleComposerKeydown(event) {
    if (!settings.enableEnterNewline || event.defaultPrevented || event.key !== "Enter") {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const composerEl = findComposerFromEvent(event);
    if (!composerEl) {
      return;
    }

    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (dispatchSendShortcut(composerEl)) {
        return;
      }

      const sendButton = findSendButton(composerEl);
      if (sendButton) {
        sendButton.click();
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    if (insertComposerLineBreak(composerEl)) {
      return;
    }

    if (document.execCommand) {
      document.execCommand("insertLineBreak");
    }
  }

  function installComposerKeymap() {
    document.addEventListener("keydown", handleComposerKeydown, true);
  }

  function start() {
    guards.resetCycle(Date.now());
    ensureSettingsLoaded().then(function onSettingsLoaded() {
      applyUpgradeButtonSetting();
    });
    installHistoryHooks();
    installMutationObserver();
    installComposerKeymap();
    installStorageSync();
    runEnforcement("startup");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(globalThis);
