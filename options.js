(function initPopupSettings() {
  "use strict";

  const DEFAULT_SETTINGS = {
    enableModelCheck: true,
    showCorrectionNotification: true,
    hideUpgradeButton: true
  };

  const form = document.getElementById("settings-form");
  const statusText = document.getElementById("statusText");
  const enableModelCheckInput = document.getElementById("enableModelCheck");
  const showCorrectionNotificationInput = document.getElementById("showCorrectionNotification");
  const hideUpgradeButtonInput = document.getElementById("hideUpgradeButton");

  function readBool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function loadSettings() {
    chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), function onGet(items) {
      const settings = {
        enableModelCheck: readBool(items.enableModelCheck, DEFAULT_SETTINGS.enableModelCheck),
        showCorrectionNotification: readBool(items.showCorrectionNotification, DEFAULT_SETTINGS.showCorrectionNotification),
        hideUpgradeButton: readBool(items.hideUpgradeButton, DEFAULT_SETTINGS.hideUpgradeButton)
      };

      enableModelCheckInput.checked = settings.enableModelCheck;
      showCorrectionNotificationInput.checked = settings.showCorrectionNotification;
      hideUpgradeButtonInput.checked = settings.hideUpgradeButton;
      statusText.textContent = "";
    });
  }

  function saveSettings(event) {
    event.preventDefault();

    const settings = {
      enableModelCheck: enableModelCheckInput.checked,
      showCorrectionNotification: showCorrectionNotificationInput.checked,
      hideUpgradeButton: hideUpgradeButtonInput.checked
    };

    chrome.storage.local.set(settings, function onSet() {
      statusText.textContent = "Saved";
      window.setTimeout(function clearSavedText() {
        statusText.textContent = "";
      }, 1400);
    });
  }

  form.addEventListener("submit", saveSettings);
  loadSettings();
})();
