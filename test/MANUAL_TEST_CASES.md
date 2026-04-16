# Manual Test Cases

## 1) Load and startup

1. Load extension unpacked in Chrome.
2. Open Gemini home page.
3. Confirm no manifest/runtime errors in Extensions page.

Expected:
- Extension installs cleanly.
- Content script runs only on Gemini hosts.

## 2) Manual selection persistence

1. Set model to Pro from the dropdown.
2. Refresh page.

Expected:
- Preferred mode remains Pro after reload.

## 3) Manual override updates preference

1. Switch from Pro to Fast manually.
2. Wait a moment, then navigate to a new Gemini chat.

Expected:
- Fast is treated as preferred mode and is not reverted immediately.

## 4) App-driven correction

1. Ensure preferred mode is Pro via manual selection.
2. Trigger a Gemini flow where it flips to Fast by itself.

Expected:
- Extension restores Pro within retry window.

## 5) SPA rerender stability

1. Navigate between chats and Gemini sections.
2. Trigger UI rerenders (open/close side panels, new chat, etc.).

Expected:
- Stored preferred mode remains selected or is quickly reasserted.

## 6) Multi-tab behavior

1. Open two Gemini tabs.
1. Switch one tab to Fast manually.

Expected:
- Preferred mode updates from manual change and is honored in both tabs.

## 7) Performance and safety

1. Leave Gemini open for several minutes.
2. Watch DevTools console (with debug enabled) and page responsiveness.

Expected:
- No continuous click loop when Pro is active.
- No obvious UI lag from observers.
