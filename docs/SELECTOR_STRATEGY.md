# Selector Strategy

This extension uses layered selector heuristics so it can survive Gemini UI updates better than a single hard-coded selector.

## Priority order

1. Attribute and ARIA-based controls:
   - `button[aria-haspopup='listbox']`
   - `button[aria-haspopup='menu']`
   - `div[role='button'][aria-haspopup='listbox']`
   - `div[role='button'][aria-haspopup='menu']`

2. Role-based popup option matching:
   - `[role='option']`
   - `[role='menuitem']`
   - fallback clickable controls in the active popup root

3. Text heuristics (last fallback):
   - Pro target pattern: `\bpro\b`
   - Fast pattern: `\bfast\b`
   - Model control hints: `model|gemini|2.5|flash|pro|fast`

4. Upgrade button hide targeting:
   - Primary: `[data-test-id='bard-g1-dynamic-upsell-menu-button']`
   - ARIA fallback: labels containing `upgrade` or `gemini 2`
   - Class fallback: class names containing `dynamic-upsell`, `upsell`, or `upgrade`
   - Final text fallback for clickable elements containing `upgrade`, `gemini 2`, or `pro+`

## Why this order

- Attributes and ARIA roles are usually more stable than text and less sensitive to localization.
- Text fallback keeps extension working when stable attributes are missing.
- Popup-root search helps avoid clicking unrelated buttons elsewhere on the page.
- Upgrade selectors prioritize stable test-id/ARIA attributes before class/text fallbacks.

## Maintenance tips

- If Gemini changes markup, first inspect model trigger and option nodes in DevTools.
- Update attribute selectors before changing text regex.
- Keep regex broad enough to catch naming variations, but specific enough to avoid false positives.
- Use debug logging mode to inspect why a switch attempt failed.
