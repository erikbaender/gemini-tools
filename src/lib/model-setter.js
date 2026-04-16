(function initModelSetter(global) {
  "use strict";

  function clickElement(el) {
    if (!el) {
      return false;
    }

    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.click();
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return true;
  }

  function detectModelState(config, selectorStrategy) {
    const trigger = selectorStrategy.findModelTrigger(config);

    if (!trigger) {
      return {
        state: "unknown",
        trigger: null,
        text: ""
      };
    }

    const text = selectorStrategy.readCurrentModelText(trigger);

    if (config.proRegex.test(text) && !config.fastRegex.test(text)) {
      return {
        state: "pro",
        trigger,
        text
      };
    }

    if (config.fastRegex.test(text)) {
      return {
        state: "fast",
        trigger,
        text
      };
    }

    return {
      state: "unknown",
      trigger,
      text
    };
  }

  function ensureModeSelected(config, selectorStrategy, targetMode) {
    if (targetMode !== "pro" && targetMode !== "fast") {
      return Promise.resolve({
        changed: false,
        reason: "invalid-target",
        actionKey: "invalid-target"
      });
    }

    const before = detectModelState(config, selectorStrategy);
    if (before.state === targetMode) {
      return Promise.resolve({
        changed: false,
        reason: "already-target",
        actionKey: "already-target"
      });
    }

    if (!before.trigger) {
      return Promise.resolve({
        changed: false,
        reason: "trigger-not-found",
        actionKey: "trigger-not-found"
      });
    }

    clickElement(before.trigger);

    return new Promise(function attemptSelect(resolve) {
      global.setTimeout(function delayedSelect() {
        const targetOption = selectorStrategy.findModeOption(config, targetMode);
        if (!targetOption) {
          resolve({
            changed: false,
            reason: "target-option-not-found",
            actionKey: "target-option-not-found"
          });
          return;
        }

        clickElement(targetOption);

        global.setTimeout(function verifySelection() {
          const after = detectModelState(config, selectorStrategy);
          resolve({
            changed: after.state === targetMode,
            reason: after.state === targetMode ? "switched" : "verify-failed",
            actionKey: "select-" + targetMode
          });
        }, config.verifyDelayMs);
      }, config.menuOpenDelayMs);
    });
  }

  global.GPE_ModelSetter = {
    detectModelState,
    ensureModeSelected
  };
})(globalThis);
