(function initSafetyGuards(global) {
  "use strict";

  const state = {
    cycleStartTs: 0,
    attemptsInCycle: 0,
    lastActionTs: 0,
    lastActionKey: ""
  };

  function startCycle(now) {
    state.cycleStartTs = now;
    state.attemptsInCycle = 0;
    state.lastActionTs = 0;
    state.lastActionKey = "";
  }

  function resetCycle(now) {
    startCycle(now);
  }

  function canAttempt(now, config) {
    if (!state.cycleStartTs) {
      startCycle(now);
    }

    if (state.attemptsInCycle >= config.maxAttemptsPerCycle) {
      return false;
    }

    if (now - state.lastActionTs < config.clickCooldownMs) {
      return false;
    }

    return true;
  }

  function registerAttempt(now, actionKey) {
    state.attemptsInCycle += 1;
    state.lastActionTs = now;
    state.lastActionKey = String(actionKey || "");
  }

  function isDuplicateAction(now, actionKey, config) {
    const key = String(actionKey || "");
    if (!key || !state.lastActionKey) {
      return false;
    }

    return (
      state.lastActionKey === key &&
      now - state.lastActionTs < config.duplicateActionWindowMs
    );
  }

  global.GPE_SafetyGuards = {
    resetCycle,
    canAttempt,
    registerAttempt,
    isDuplicateAction
  };
})(globalThis);
