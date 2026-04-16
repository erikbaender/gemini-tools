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
    userSelectionSettleMs: 260,
    userSelectionGraceMs: 1200,
    clickCooldownMs: 900,
    duplicateActionWindowMs: 1600,
    maxAttemptsPerCycle: 3,
    retryBackoffMs: [450, 1000, 2200, 4000],
    proRegex: /\bpro\b/i,
    fastRegex: /\bfast\b/i,
    modelControlHints: /(model|gemini|2\.5|flash|pro|fast)/i
  };

  const DEFAULT_SETTINGS = {
    enableModelCheck: true,
    showCorrectionNotification: true,
    hideUpgradeButton: true
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

  const userSelectionState = {
    pendingMode: null,
    lastUserActionTs: 0
  };

  function normalizeMode(mode) {
    if (mode === "pro" || mode === "fast") {
      return mode;
    }

    return null;
  }

  function readBool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function modeFromText(text) {
    if (CONFIG.proRegex.test(text) && !CONFIG.fastRegex.test(text)) {
      return "pro";
    }
    if (CONFIG.fastRegex.test(text)) {
      return "fast";
    }
    return null;
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
          hideUpgradeButton: readBool(items.hideUpgradeButton, DEFAULT_SETTINGS.hideUpgradeButton)
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
    if (current.state === "pro" || current.state === "fast") {
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

    const label = targetMode === "fast" ? "Fast" : "Pro";
    notification.show("Gemini switched mode by itself. Restored your preferred mode: " + label + ".");
  }

  function maybeCaptureUserSelection() {
    const now = Date.now();
    if (!userSelectionState.pendingMode) {
      return Promise.resolve(false);
    }
    if (now - userSelectionState.lastUserActionTs > CONFIG.userSelectionGraceMs) {
      userSelectionState.pendingMode = null;
      return Promise.resolve(false);
    }

    const current = modelSetter.detectModelState(CONFIG, selectorStrategy);
    const selected = normalizeMode(current.state) || userSelectionState.pendingMode;
    userSelectionState.pendingMode = null;

    if (!selected) {
      return Promise.resolve(false);
    }

    return savePreferredMode(selected, "user-selection").then(function onSaved() {
      retryController.reset();
      guards.resetCycle(Date.now());
      return true;
    });
  }

  function onTrustedUserClick(event) {
    if (!event.isTrusted) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const option = target.closest("[role='option'],[role='menuitem'],button,div[role='button']");
    if (!option) {
      return;
    }

    const text = selectorStrategy.textFrom(option);
    const mode = modeFromText(text);
    if (!mode) {
      return;
    }

    userSelectionState.pendingMode = mode;
    userSelectionState.lastUserActionTs = Date.now();

    global.setTimeout(function onSelectionSettled() {
      maybeCaptureUserSelection();
    }, CONFIG.userSelectionSettleMs);
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
        return maybeCaptureUserSelection();
      })
      .then(function onUserSelectionHandled(userSelectionCaptured) {
        if (userSelectionCaptured) {
          log("User selection captured, skipping enforcement", reason);
          isRunning = false;
          return;
        }

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
    applyUpgradeButtonSetting();
    runDebounced();
  }

  function installHistoryHooks() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function patchedPushState() {
      const result = originalPushState.apply(this, arguments);
      handleRouteChange();
      return result;
    };

    history.replaceState = function patchedReplaceState() {
      const result = originalReplaceState.apply(this, arguments);
      handleRouteChange();
      return result;
    };

    global.addEventListener("popstate", handleRouteChange);
  }

  function installMutationObserver() {
    const observer = new MutationObserver(function onMutation() {
      runMutationDebounced();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
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

  function installUserSelectionTracking() {
    document.addEventListener("click", onTrustedUserClick, true);
  }

  function start() {
    guards.resetCycle(Date.now());
    ensureSettingsLoaded().then(function onSettingsLoaded() {
      applyUpgradeButtonSetting();
    });
    installHistoryHooks();
    installMutationObserver();
    installUserSelectionTracking();
    installStorageSync();
    runEnforcement("startup");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(globalThis);
