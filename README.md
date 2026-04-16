# Gemini Tools (Chrome Extension)

Keeps Google Gemini on the model you selected manually, and corrects only app-driven switches.

## Options

Click the extension icon in Chrome toolbar to open the settings popup.
Changes are saved automatically when toggles are changed.

All options are enabled by default:

- Enable model check and auto-correction.
- Show notification when app-driven mode drift is corrected.
- Hide Gemini upgrade button in the top-right.

## What it does

- Runs on Gemini web hosts matched in `manifest.json`.
- Detects trusted manual model changes from dropdown clicks.
- Stores your manual selection as preferred mode in `chrome.storage.local`.
- On load, route changes, and rerenders, compares current mode to preferred mode.
- If Gemini changed it by itself, opens model picker and restores your preferred mode.
- Shows a small notification only when a mode correction was actually applied.
- Can hide the Gemini upgrade button using resilient selector fallbacks.
- Re-checks after SPA route changes and DOM rerenders.
- Includes guardrails to prevent runaway click loops.

## Install (unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `gemini-chrome-extension`.

## Files

- `manifest.json`: Extension metadata and content script registration.
- `options.html`, `options.js`, `options.css`: Extension toolbar popup settings UI with auto-save toggles.
- `src/content-script.js`: Runtime orchestration.
- `src/lib/selector-strategy.js`: DOM selector fallbacks.
- `src/lib/model-setter.js`: Model detection and switching.
- `src/lib/retry-handler.js`: Debounce and retry control.
- `src/lib/safety-guards.js`: Cooldown and duplicate suppression.
- `src/lib/notification.js`: In-page correction toast.
- `src/lib/upgrade-guard.js`: Upgrade button hide style injection.

## Known limits

- Gemini UI changes can break selectors.
- If account permissions do not allow a selected mode, extension cannot force it.
- Localized labels may require regex tuning if attributes are insufficient.

## Debugging

Set `debug: true` in `src/content-script.js` to enable console logs.
