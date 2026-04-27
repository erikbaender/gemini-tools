# Manual Test Cases

## 1) Load and startup

1. Load extension unpacked in Chrome.
2. Open Gemini home page.
3. Confirm no manifest/runtime errors in Extensions page.
4. Open extension popup from toolbar icon and confirm all four toggles are enabled by default.

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
- If notification toggle is enabled, a toast appears confirming the preferred mode has been updated to Fast.

## 4) App-driven correction

1. Ensure preferred mode is Pro via manual selection.
2. Trigger a Gemini flow where it flips to Fast by itself.

Expected:
- Extension restores Pro within retry window.
- If notification toggle is enabled, a toast appears after successful correction.

## 5) Disable model check

1. Open extension popup and disable model check.
2. Trigger Gemini model drift or reload into a state where current mode differs from preference.

Expected:
- Extension does not auto-correct while model check is disabled.

## 6) Notification toggle behavior

1. Disable correction notification in popup.
2. Re-enable model check if needed and trigger app-driven correction.

Expected:
- Mode is corrected but no toast is shown.
- Manually switching modes also produces no toast while the notification toggle is disabled.

## 7) Upgrade button hide toggle

1. Keep "Hide Gemini upgrade button" enabled.
2. Verify top-right upgrade button is hidden.
3. Disable the toggle and verify button reappears without reloading extension.

Expected:
- Button is hidden when enabled and visible when disabled.

## 8) SPA rerender stability

1. Navigate between chats and Gemini sections.
2. Trigger UI rerenders (open/close side panels, new chat, etc.).

Expected:
- Stored preferred mode remains selected or is quickly reasserted.

## 9) Enter newline behavior

1. Open extension popup and ensure "Enter inserts newline" is enabled.
2. Click into Gemini message composer and press Enter.

Expected:
- A new line is inserted.
- Message is not sent.

3. Press Shift+Enter.

Expected:
- Message is sent.

4. Disable "Enter inserts newline" and test Enter/Shift+Enter again.

Expected:
- Gemini default keyboard behavior is restored.

## 10) Multi-tab behavior

1. Open two Gemini tabs.
1. Switch one tab to Fast manually.

Expected:
- Preferred mode updates from manual change and is honored in both tabs.

## 11) Performance and safety

1. Leave Gemini open for several minutes.
2. Watch DevTools console (with debug enabled) and page responsiveness.

Expected:
- No continuous click loop when Pro is active.
- No obvious UI lag from observers.

## 12) Mode correction after new chat

1. Ensure preferred mode is Pro via manual selection.
2. Open a new chat using the "New Chat" button or similar navigation.
3. Observe whether Gemini switches to Fast mode during new chat initialization.

Expected:
- Extension detects the mode drift within ~2 seconds and restores Pro.
- If notification toggle is enabled, a toast appears after successful correction.
- No correction occurs if Gemini stays on Pro after navigation.

## 13) Mode correction after new chat via keyboard shortcut

1. Ensure preferred mode is Pro via manual selection.
2. Open a new chat using the keyboard shortcut (e.g. Ctrl+Shift+O or the platform equivalent).
3. Observe whether Gemini switches to Fast mode during new chat initialization.

Expected:
- Extension detects the mode drift within ~2 seconds and restores Pro, same as when using the New Chat button.
- If notification toggle is enabled, a toast appears after successful correction.
- No correction occurs if Gemini stays on Pro after navigation.
