(function initPopupSettings() {
  "use strict";

  const PREFERRED_MODE_KEY = "preferredMode";

  const DEFAULT_SETTINGS = {
    enableModelCheck: true,
    showCorrectionNotification: true,
    hideUpgradeButton: true,
    enableEnterNewline: true
  };

  const modeFastInput = document.getElementById("modeFast");
  const modeThinkingInput = document.getElementById("modeThinking");
  const modeProInput = document.getElementById("modePro");
  const enableModelCheckInput = document.getElementById("enableModelCheck");
  const showCorrectionNotificationInput = document.getElementById("showCorrectionNotification");
  const hideUpgradeButtonInput = document.getElementById("hideUpgradeButton");
  const enableEnterNewlineInput = document.getElementById("enableEnterNewline");
  const notificationRow = document.getElementById("notificationRow");
  const notificationGroup = document.getElementById("notificationGroup");

  function readBool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function getCheckedMode() {
    if (modeFastInput.checked) {
      return "fast";
    }
    if (modeThinkingInput.checked) {
      return "thinking";
    }
    if (modeProInput.checked) {
      return "pro";
    }
    return null;
  }

  function setCheckedMode(mode) {
    modeFastInput.checked = mode === "fast";
    modeThinkingInput.checked = mode === "thinking";
    modeProInput.checked = mode === "pro";
    syncModeLabels();
  }

  function syncModeLabels() {
    const modeLabels = [
      { label: document.getElementById("modeFastLabel"), input: modeFastInput },
      { label: document.getElementById("modeThinkingLabel"), input: modeThinkingInput },
      { label: document.getElementById("modeProLabel"), input: modeProInput }
    ];
    modeLabels.forEach(function updateLabel(item) {
      item.label.classList.toggle("mode-option-selected", item.input.checked);
    });
  }

  function loadSettings() {
    const keys = Object.keys(DEFAULT_SETTINGS).concat([PREFERRED_MODE_KEY]);
    chrome.storage.local.get(keys, function onGet(items) {
      const settings = {
        enableModelCheck: readBool(items.enableModelCheck, DEFAULT_SETTINGS.enableModelCheck),
        showCorrectionNotification: readBool(items.showCorrectionNotification, DEFAULT_SETTINGS.showCorrectionNotification),
        hideUpgradeButton: readBool(items.hideUpgradeButton, DEFAULT_SETTINGS.hideUpgradeButton),
        enableEnterNewline: readBool(items.enableEnterNewline, DEFAULT_SETTINGS.enableEnterNewline)
      };

      enableModelCheckInput.checked = settings.enableModelCheck;
      showCorrectionNotificationInput.checked = settings.showCorrectionNotification;
      hideUpgradeButtonInput.checked = settings.hideUpgradeButton;
      enableEnterNewlineInput.checked = settings.enableEnterNewline;

      const storedMode = items[PREFERRED_MODE_KEY];
      if (storedMode === "fast" || storedMode === "thinking" || storedMode === "pro") {
        setCheckedMode(storedMode);
      } else {
        setCheckedMode("pro");
        chrome.storage.local.set({ [PREFERRED_MODE_KEY]: "pro" });
      }

      syncDependentOptions();
    });
  }

  function syncDependentOptions() {
    const notificationEnabled = enableModelCheckInput.checked;
    showCorrectionNotificationInput.disabled = !notificationEnabled;
    notificationRow.classList.toggle("setting-row-disabled", !notificationEnabled);
    notificationGroup.classList.toggle("setting-subtree-disabled", !notificationEnabled);
    notificationGroup.classList.toggle("setting-subtree-unselected", !showCorrectionNotificationInput.checked);
  }

  function persistSettings() {
    const settings = {
      enableModelCheck: enableModelCheckInput.checked,
      showCorrectionNotification: showCorrectionNotificationInput.checked,
      hideUpgradeButton: hideUpgradeButtonInput.checked,
      enableEnterNewline: enableEnterNewlineInput.checked
    };

    chrome.storage.local.set(settings);
  }

  function persistMode() {
    const mode = getCheckedMode();
    if (mode) {
      chrome.storage.local.set({ [PREFERRED_MODE_KEY]: mode });
    }
  }

  function installAutoSave() {
    const modeInputs = [modeFastInput, modeThinkingInput, modeProInput];
    modeInputs.forEach(function addModeHandler(input) {
      input.addEventListener("change", function onModeChange() {
        syncModeLabels();
        persistMode();
      });
    });

    const settingInputs = [enableModelCheckInput, showCorrectionNotificationInput, hideUpgradeButtonInput, enableEnterNewlineInput];
    settingInputs.forEach(function addChangeHandler(input) {
      input.addEventListener("change", function onChange() {
        syncDependentOptions();
        persistSettings();
      });
    });
  }

  installAutoSave();
  loadSettings();
})();
