# Gemini Tools

Gemini Tools gives you more control over how Gemini behaves in your browser.

It helps preserve the model you intentionally selected and only intervenes when Gemini appears to switch models on its own. The extension is designed to stay out of your way and respect manual user choices.

## Features

- Detects trusted manual model changes and saves your preference locally.
- Re-applies your saved model when Gemini switches models automatically.
- Works across page load, route transitions, and rerenders in Gemini's SPA UI.
- Shows an optional in-page notification when a correction is applied.
- Optionally hides the Gemini upgrade button.
- Includes retry and cooldown guardrails to avoid runaway click loops.

## Settings

Click the extension icon in the Chrome toolbar to open the popup.

Available toggles:
- Enable model check and auto-correction
- Show correction notification
- Hide upgrade button

Settings are saved automatically.

## Permissions and Why They Are Needed

- `storage`
	- Used to persist local preferences (enabled toggles and last manually selected model).

- Gemini host access via content script match patterns in `manifest.json`
	- Needed to read Gemini's current model state and apply correction only on Gemini pages.
	- The extension does not run on unrelated websites.

## Privacy

- Data is processed locally in the browser.
- No analytics, telemetry, or advertising trackers.
- No sale or transfer of user data to third parties.
- No remote executable code.

See full policy: [PRIVACY.md](PRIVACY.md)

## Installation

### Chrome Web Store

Install from the Chrome Web Store listing (add URL after publication).

### Unpacked (Development)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

## Release Checklist

1. Update `version` in `manifest.json`.
2. Verify extension behavior on Gemini (`model correction`, `notification toggle`, `upgrade hide toggle`).
3. If icon SVG changed, regenerate `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, and `icons/icon128.png`.
4. Package and publish through your Web Store process (manual or CI).

## Project Structure

- `manifest.json`: Extension metadata, permissions, and content script registration.
- `src/popup/options.html`, `src/popup/options.js`, `src/popup/options.css`: Toolbar popup settings UI.
- `src/content-script.js`: Runtime orchestration.
- `src/lib/selector-strategy.js`: Selector discovery and fallback strategy.
- `src/lib/model-setter.js`: Model detection and switching logic.
- `src/lib/retry-handler.js`: Retry/debounce control.
- `src/lib/safety-guards.js`: Cooldown and duplicate suppression.
- `src/lib/notification.js`: In-page correction toast.
- `src/lib/upgrade-guard.js`: Upgrade button hiding.
- `PRIVACY.md`: Privacy policy used for Web Store disclosures.

## Known Limitations

- Gemini UI changes may require selector updates.
- If an account lacks access to a model, the extension cannot force selection.
- Localized UI text may require fallback regex adjustments when stable attributes are unavailable.

## Debugging

Set `debug: true` in `src/content-script.js` to enable console logs.
