(function initPopupSettings() {
  "use strict";

  const DEFAULT_SETTINGS = {
    enableModelCheck: true,
    showCorrectionNotification: true,
    hideUpgradeButton: true,
    hidePromptSuggestions: false,
    enableEnterNewline: true
  };

  const enableModelCheckInput = document.getElementById("enableModelCheck");
  const showCorrectionNotificationInput = document.getElementById("showCorrectionNotification");
  const hideUpgradeButtonInput = document.getElementById("hideUpgradeButton");
  const hidePromptSuggestionsInput = document.getElementById("hidePromptSuggestions");
  const enableEnterNewlineInput = document.getElementById("enableEnterNewline");
  const notificationRow = document.getElementById("notificationRow");
  const notificationGroup = document.getElementById("notificationGroup");

  function readBool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function loadSettings() {
    chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), function onGet(items) {
      const settings = {
        enableModelCheck: readBool(items.enableModelCheck, DEFAULT_SETTINGS.enableModelCheck),
        showCorrectionNotification: readBool(items.showCorrectionNotification, DEFAULT_SETTINGS.showCorrectionNotification),
        hideUpgradeButton: readBool(items.hideUpgradeButton, DEFAULT_SETTINGS.hideUpgradeButton),
        hidePromptSuggestions: readBool(items.hidePromptSuggestions, DEFAULT_SETTINGS.hidePromptSuggestions),
        enableEnterNewline: readBool(items.enableEnterNewline, DEFAULT_SETTINGS.enableEnterNewline)
      };

      enableModelCheckInput.checked = settings.enableModelCheck;
      showCorrectionNotificationInput.checked = settings.showCorrectionNotification;
      hideUpgradeButtonInput.checked = settings.hideUpgradeButton;
      hidePromptSuggestionsInput.checked = settings.hidePromptSuggestions;
      enableEnterNewlineInput.checked = settings.enableEnterNewline;
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
      hidePromptSuggestions: hidePromptSuggestionsInput.checked,
      enableEnterNewline: enableEnterNewlineInput.checked
    };

    chrome.storage.local.set(settings);
  }

  function installAutoSave() {
    const inputs = [enableModelCheckInput, showCorrectionNotificationInput, hideUpgradeButtonInput, hidePromptSuggestionsInput, enableEnterNewlineInput];
    inputs.forEach(function addChangeHandler(input) {
      input.addEventListener("change", function onChange() {
        syncDependentOptions();
        persistSettings();
      });
    });
  }

  installAutoSave();
  loadSettings();
})();
