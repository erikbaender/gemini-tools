# Gemini Mode Keeper (Chrome Extension)

Keeps Google Gemini on the model you selected manually, and corrects only app-driven switches.

## What it does

- Runs on Gemini web hosts matched in `manifest.json`.
- Detects trusted manual model changes from dropdown clicks.
- Stores your manual selection as preferred mode in `chrome.storage.local`.
- On load, route changes, and rerenders, compares current mode to preferred mode.
- If Gemini changed it by itself, opens model picker and restores your preferred mode.
- Re-checks after SPA route changes and DOM rerenders.
- Includes guardrails to prevent runaway click loops.

## Install (unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `gemini-chrome-extension`.

## Files

- `manifest.json`: Extension metadata and content script registration.
- `src/content-script.js`: Runtime orchestration.
- `src/lib/selector-strategy.js`: DOM selector fallbacks.
- `src/lib/model-setter.js`: Model detection and switching.
- `src/lib/retry-handler.js`: Debounce and retry control.
- `src/lib/safety-guards.js`: Cooldown and duplicate suppression.

## Known limits

- Gemini UI changes can break selectors.
- If account permissions do not allow a selected mode, extension cannot force it.
- Localized labels may require regex tuning if attributes are insufficient.

## Debugging

Set `debug: true` in `src/content-script.js` to enable console logs.
