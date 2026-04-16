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

  if (!guards || !retryHandler || !selectorStrategy || !modelSetter) {
    return;
  }

  const retryController = retryHandler.createRetryController(CONFIG);
  const STORAGE_KEY = "preferredMode";

  let isRunning = false;
  let preferredMode = null;
  let hasLoadedPreference = false;

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
      storage.get([STORAGE_KEY], function onGet(items) {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(normalizeMode(items[STORAGE_KEY]));
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
      data[STORAGE_KEY] = normalized;
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

    ensurePreferenceLoaded()
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

  function handleRouteChange() {
    guards.resetCycle(Date.now());
    retryController.reset();
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
      runDebounced();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "aria-selected", "data-testid", "class"]
    });
  }

  function installUserSelectionTracking() {
    document.addEventListener("click", onTrustedUserClick, true);
  }

  function start() {
    guards.resetCycle(Date.now());
    installHistoryHooks();
    installMutationObserver();
    installUserSelectionTracking();
    runEnforcement("startup");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(globalThis);
