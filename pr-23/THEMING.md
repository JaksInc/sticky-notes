# Quarterboard — Theming Guide

## App Identity

| Property | Value |
|---|---|
| **Name** | Quarterboard |
| **Short name** (home screen label) | Quarterboard |
| **Primary color** | `#f96302` — Home Depot orange |
| **Background color** | `#e0e0e0` (splash/loading) |

---

## Color Palette

### Primary
| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#f96302` | Toolbars, buttons, focus rings, today highlight, active states |
| `--color-primary-light` | `rgba(249,99,2,.12)` | Hover backgrounds, focus shadows, subtle tints |
| `--color-primary-dark` | `#d4540a` | Hover state on primary buttons |

### Semantic
| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#2e7d32` | Completed states, save confirmations |
| `--color-success-light` | `rgba(46,125,50,.12)` | Success backgrounds |
| `--color-danger` | `#c62828` | Delete buttons, error states, destructive actions |
| `--color-danger-light` | `rgba(198,40,40,.08)` | Danger hover backgrounds |
| `--color-info` | `#1565c0` | Links, informational states |
| `--color-info-light` | `rgba(21,101,192,.12)` | Info backgrounds |

### Neutrals
| Token | Value | Usage |
|---|---|---|
| `--color-text` | `#333` | Primary body text |
| `--color-text-secondary` | `#666` | Labels, metadata, secondary copy |
| `--color-text-muted` | `#aaa` | Placeholders, disabled, empty states |
| `--color-border` | `rgba(0,0,0,.12)` | Dividers, widget borders, input borders |
| `--color-border-strong` | `rgba(0,0,0,.22)` | Input fields, interactive border |
| `--color-surface` | `#fff` | Cards, widgets, modals |
| `--color-bg` | `#f5f5f5` | Page background |

### Note Swatches
These are the seven user-selectable note colors. They must remain pastel and legible on white and on the orange toolbar.

| Name | Hex |
|---|---|
| Yellow (default) | `#FFF9C4` |
| Pink | `#F8BBD0` |
| Blue | `#BBDEFB` |
| Green | `#C8E6C9` |
| Orange | `#FFE0B2` |
| Purple | `#E1BEE7` |
| White | `#FFFFFF` |

---

## Dark Mode

Dark mode is toggled manually by the user (stored in `localStorage['qb-theme']`; values `'light'` or `'dark'`).

### Dark palette (planned)
| Light token | Dark equivalent |
|---|---|
| `--color-surface` `#fff` | `#1e1e1e` |
| `--color-bg` `#f5f5f5` | `#121212` |
| `--color-text` `#333` | `#e8e8e8` |
| `--color-text-secondary` `#666` | `#aaa` |
| `--color-border` `rgba(0,0,0,.12)` | `rgba(255,255,255,.1)` |
| Toolbar | `#2a2a2a` (keep orange logo/icon, not orange bg) |
| Primary `#f96302` | Unchanged — orange stays orange in dark mode |

Implementation: add `data-theme="dark"` to `<html>` and use CSS custom properties throughout. The toggle button lives in the toolbar on every page.

---

## Typography

The app uses the system font stack — no web font loading.

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Scale
| Name | Size | Weight | Usage |
|---|---|---|---|
| `--text-xs` | `11px` | 600 | Column headers, tiny labels |
| `--text-sm` | `12px` | 400/600 | Badges, footer counts, timestamps |
| `--text-base` | `14px` | 400 | Body, inputs, todo items, note previews |
| `--text-md` | `15px` | 400 | Modal body text |
| `--text-toolbar` | `18px` | 700 | Toolbar `h1` |

Line height: `1.5` for body, `1.4` for compact list items, `1.6` for note textarea.

---

## Spacing

All spacing is based on a **4px grid**. Only multiples of 4 should be used, with the exceptions of fine-tuning borders and shadows.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Icon gaps, tight inline spacing |
| `--space-2` | `8px` | Button padding (vertical), list item gaps |
| `--space-3` | `12px` | Input padding, widget body padding |
| `--space-4` | `16px` | Widget grid gap, widget body padding (horizontal) |
| `--space-5` | `20px` | Section separation |
| `--space-6` | `24px` | Card padding |
| `--space-8` | `32px` | Large section gaps |

Button padding formula: `(--space-2) (--space-3)` → `8px 12px`; small buttons: `5px 11px`.

---

## Border Radius

| Context | Value |
|---|---|
| Widgets / cards / modals | `10px` |
| Buttons | `6px` |
| Inputs | `6px` |
| Color swatches (round) | `50%` |
| Note picker items | `6px` |
| Tiny badges | `4px` |

---

## Elevation / Shadow

| Level | Value | Usage |
|---|---|---|
| 0 — flat | none | Inline elements, toolbar |
| 1 — raised | `0 1px 3px rgba(0,0,0,.1)` | Buttons on hover |
| 2 — card | `0 2px 8px rgba(0,0,0,.12)` | Widgets, cards |
| 3 — floating | `0 4px 16px rgba(0,0,0,.16)` | Modals, dropdowns |

---

## Iconography

### Style: Filled SVG
All icons everywhere — action buttons, status indicators, widget header titles — must be **filled SVG**. No emoji anywhere in the UI. Emoji render differently across OS and browser, creating visual inconsistency.

### Sources
- All icons: inline SVG via `js/icons.js`. No external icon CDN. No emoji.
- Widget headers: use filled SVG icons (calendar, bookmark, checklist, document) via `data-icon` attribute on a `.widget-icon` span, populated by `icon()` on page load.
- Action icons: filled SVG (edit pencil, trash, arrow-left, share, pin, swap, etc.).

### Icon sizes
| Context | Size |
|---|---|
| Inline button icon | `14–16px` |
| Card action button | `16px` |
| Toolbar button icon | `18px` |
| Empty-state illustration | `48px` |

---

## App Icon & Favicon

### Source of truth
**`icons/icon.svg`** — always edit this file first. All raster formats are derived from it.

```
icons/
  icon.svg        ← source (any size, vector)
  icon-192.png    ← PWA / Android home screen
  icon-512.png    ← PWA splash / store listing
```

### Current icon spec
Orange (`#f96302`) rounded square background (`rx="18"` on a 100×100 viewBox), four white rounded rectangles in a 2×2 grid — representing the widget dashboard layout. White rectangles decrease in opacity bottom-right to suggest depth.

### Favicon (browser tab)
The browser tab icon is the SVG directly:
```html
<link rel="icon" type="image/svg+xml" href="icons/icon.svg">
```
SVG favicons render crisply at all sizes. No `.ico` file is needed for modern browsers.

### PWA icon (home screen / splash)
Both PNGs are listed in `manifest.json` with `"purpose": "any maskable"`. The orange background extends to the full bleed area, so the icon looks correct in both square and circle masks (Android adaptive, iOS rounded square).

```json
{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
{ "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
```

### Apple touch icon (iOS Add to Home Screen)
```html
<link rel="apple-touch-icon" href="icons/icon-192.png">
```
iOS does not use the manifest; it reads this tag. Use the 192px PNG.

### Regenerating PNG icons after SVG changes
Requires Playwright (available at `/opt/node22/lib/node_modules/playwright`):

```js
// scripts/gen-icons.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'fs';

const svg = readFileSync('icons/icon.svg', 'utf8');
const b = await chromium.launch();
const page = await b.newPage();

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html style="margin:0;padding:0"><body style="margin:0;padding:0">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: `icons/icon-${size}.png` });
}
await b.close();
```

Run with: `node scripts/gen-icons.mjs`

### Checklist when updating the icon
- [ ] Edit `icons/icon.svg`
- [ ] Run `node scripts/gen-icons.mjs`
- [ ] Verify `icons/icon-192.png` and `icons/icon-512.png` are updated
- [ ] Bump the service worker cache version in `sw.js` (so devices re-fetch the new icon)

---

## Component Reference

### Buttons
```css
/* Primary */
background: #f96302; color: #fff;
/* Secondary */
background: rgba(255,255,255,.92); color: #333;
/* Danger */
background: none; color: #c62828;
/* On orange toolbar — primary becomes inverted */
.toolbar .btn-primary { background: #fff; color: #f96302; }
.toolbar .btn-secondary { background: rgba(255,255,255,.92); color: #333; }
```

### Focus ring
```css
outline: none;
box-shadow: 0 0 0 3px rgba(249,99,2,.25);
```
All interactive elements must show this focus ring on keyboard focus.

### Inputs
```css
border: 1px solid rgba(0,0,0,.22);
border-radius: 6px;
padding: 7px 12px;
font-size: 14px;
/* focused */
border-color: #f96302;
box-shadow: 0 0 0 3px rgba(249,99,2,.15);
```

---

## Service Worker Cache

When adding new pages or assets, update the `ASSETS` array in `sw.js` and increment the cache version key (`CACHE` constant). The icon PNG files are cached; regenerating them requires a cache bump so installed PWAs pick up the new images.
