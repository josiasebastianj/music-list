> **ARCHIVED — OBSOLETE.** This document describes "Song Structure Timeline v1.4.7", a
> single-song predecessor of the current app. It does not reflect the current codebase
> (`index.html`, now setlist.app v2.1.0+ with a multi-song Event → Songs → Song Details
> architecture). Kept for historical reference only — see `docs/v2.1.0_tech_documentation.md`
> for the current technical documentation.

# Technical Specification: Song Structure Timeline

| | |
|---|---|
| **Document** | Technical Specification |
| **Subject** | `index.html`, the Song Structure Timeline application |
| **Application version** | 1.4.7 (stable release: 1.4.7-STABLE) |
| **Document date** | 2026-09-27 |
| **Related documents** | [`../README.md`](../README.md) (user/project overview), [`AGENT_HANDOFF_v1.4.7.md`](AGENT_HANDOFF_v1.4.7.md) (feature history and preservation rules) |

This document describes how `index.html` is built: the technology stack, the web standards it relies on, its internal architecture, data formats, rendering algorithms, and its security, accessibility and compatibility characteristics. Line references (`index.html:NN`) point to the v1.4.7 source.

---

## Contents

1. [System overview](#1-system-overview)
2. [Technology stack](#2-technology-stack)
3. [Standards and specifications](#3-standards-and-specifications)
4. [Source file structure](#4-source-file-structure)
5. [Document (HTML) layer](#5-document-html-layer)
6. [Presentation (CSS) layer](#6-presentation-css-layer)
7. [Application (JavaScript) layer](#7-application-javascript-layer)
8. [State model](#8-state-model)
9. [Persistence layer](#9-persistence-layer)
10. [JSON interchange format](#10-json-interchange-format)
11. [PNG export engine](#11-png-export-engine)
12. [Security](#12-security)
13. [Accessibility](#13-accessibility)
14. [Internationalization](#14-internationalization)
15. [Browser compatibility](#15-browser-compatibility)
16. [Performance](#16-performance)
17. [Error handling](#17-error-handling)
18. [Coding conventions](#18-coding-conventions)
19. [Known technical issues](#19-known-technical-issues)
20. [Testing](#20-testing)
21. [Extension guidelines](#21-extension-guidelines)
22. [Glossary](#22-glossary)

---

## 1. System overview

Song Structure Timeline runs entirely in the browser as a single-page application (SPA). Everything the app needs is in one HTML file.

```
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                 │
│  index.html                                                     │
│  ├── <style>   Presentation layer (CSS)                         │
│  ├── <body>    Static shell: header, toolbar, #details          │
│  └── <script>  IIFE application                                 │
│        ├── state  ◄──── load() ◄──── localStorage               │
│        ├── render() ───► DOM (#details cards)                   │
│        ├── event delegation (click / input) ───► state          │
│        ├── persist() ───► localStorage                          │
│        ├── JSON export ───► Blob ───► download                  │
│        ├── JSON import ◄─── FileReader ◄─── <input type=file>   │
│        └── exportImage() ───► Canvas 2D ───► PNG ───► download  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          No network requests · No server · No third-party code
```

**Architectural properties**

| Property | Value |
|---|---|
| Deployment unit | One static file (`index.html`, ~21 KB) |
| Runtime dependencies | None |
| Build tooling | None, the source is what gets served |
| Backend | None |
| Network access | None at runtime |
| Data residency | The user's browser only (`localStorage`) |
| Rendering model | Imperative DOM rebuild from a single state object |

---

## 2. Technology stack

| Layer | Technology | Usage |
|---|---|---|
| Markup | HTML5 | Static app shell, form controls, hidden file input |
| Styling | CSS3 | Custom properties, Grid, Flexbox, `clamp()`/`min()`, media queries, gradients |
| Logic | Vanilla JavaScript (ES2020+) | State, rendering, events, export/import |
| Storage | Web Storage API (`localStorage`) | Auto-saving and migrating state |
| File input | File API (`FileReader`) | Reading imported JSON |
| File output | `Blob`, `URL.createObjectURL`, `<a download>` | Downloading JSON |
| Graphics | Canvas 2D API | Drawing the PNG export |
| Date formatting | ECMA-402 Intl (`toLocaleDateString`) | Indonesian date on the image |
| Scheduling | `requestAnimationFrame` | Focusing a new section after render |
| Dialogs | `window.confirm`, `window.alert` | Delete/reset confirmation, import errors |
| Cloning | `structuredClone` | Deep copies of the default and blank states |

**Explicitly not used:** UI frameworks (React, Vue, Angular, Svelte), CSS frameworks, bundlers or transpilers, package managers, web fonts or CDNs, service workers, IndexedDB, and any server or API.

---

## 3. Standards and specifications

The app is written against these standards:

| Area | Standard | Where it applies |
|---|---|---|
| Markup | WHATWG HTML Living Standard | `<!DOCTYPE html>`, form controls, `hidden`, `<a download>` |
| Character encoding | UTF-8 (WHATWG Encoding) | `<meta charset="UTF-8">` (`index.html:5`); UI glyphs `↑ ↓ 🗑 ＋ •` |
| Viewport | CSS Device Adaptation / HTML meta viewport | `width=device-width, initial-scale=1.0` (`index.html:6`) |
| Language tagging | BCP 47 | `<html lang="id">` (Indonesian), `toLocaleDateString("id-ID")` |
| CSS custom properties | CSS Custom Properties Level 1 | `:root` tokens (`index.html:9-13`) |
| Layout | CSS Grid Layout Level 1, CSS Flexbox Level 1 | Cards, header, toolbar, metadata grid |
| Math functions | CSS Values and Units Level 4 | `clamp()`, `min()` for fluid title sizing |
| Responsive | Media Queries Level 3/4 | `@media (max-width:850px)` |
| Box model | CSS Box Sizing Level 3 | `*{box-sizing:border-box}` |
| Colors | CSS Color Level 4 | 8-digit hex (`#RRGGBBAA`) made by appending alpha to accent colors |
| Scripting | ECMAScript 2020+ (ECMA-262) | Optional chaining, nullish coalescing, destructuring, template literals |
| Internationalization | ECMA-402 | `Date.prototype.toLocaleDateString` |
| Storage | WHATWG Web Storage | `localStorage.getItem/setItem` |
| Files | W3C File API | `FileReader.readAsText`, `Blob`, `URL.createObjectURL` |
| Cloning | HTML structured clone algorithm | `structuredClone()` |
| Graphics | HTML Canvas 2D Context | Paths, `arcTo`, gradients, `measureText` / `TextMetrics`, `toDataURL` |
| Data format | JSON (RFC 8259 / ECMA-404) | Import/export files, stored state |
| Image format | PNG (ISO/IEC 15948) | Export output |
| Date format | ISO 8601 (`YYYY-MM-DD`) | `<input type="date">` value stored in `serviceDate` |
| Accessibility | WAI-ARIA 1.2, WCAG 2.x (partial) | `aria-label`s, `<label for>`, `disabled` state |

---

## 4. Source file structure

`index.html` is one document with three logical sections.

| Lines | Section | Content |
|---|---|---|
| 1-7 | Document head | Doctype, `lang="id"`, version comment, meta tags, `<title>` |
| 8-61 | `<style>` | All CSS |
| 63-87 | `<body>` markup | Header, metadata inputs, toolbar, `#details` container |
| 89-495 | `<script>` | IIFE application |

**Script outline**

| Lines | Block |
|---|---|
| 91-95 | Constants: `APP_VERSION`, storage keys, color palette |
| 97-121 | `blankState` and `defaults` (the example song) |
| 123 | `let state = load()` |
| 125-147 | `load()`, `persist()`, `esc()` |
| 149-189 | `render()` |
| 191-220 | Mutations: `addSection()`, `moveSection()`, `deleteSection()` |
| 222-258 | Delegated `click` and `input` listeners |
| 261-275 | Canvas helpers: `wrapLines()`, `roundRect()` |
| 276-465 | `exportImage()` |
| 466-492 | Toolbar handlers: export JSON, export image, import, reset, file input |
| 493 | Initial `render()` |

The version is recorded in two places: the HTML comment `<!-- Song Structure Timeline v1.4.7 | Major.Minor.Release -->` (`index.html:3`) and `const APP_VERSION="1.4.7"` (`index.html:91`). `APP_VERSION` is not currently read anywhere.

---

## 5. Document (HTML) layer

### 5.1 Static elements and IDs

| ID | Element | Purpose |
|---|---|---|
| `songTitle` | `<input class="song-title">` | Song title, styled as a large heading |
| `baseKey` | `<input type="text">` | Base key |
| `serviceDate` | `<input type="date">` | Service date (ISO value) |
| `serviceTitle` | `<input type="text">` | Service title |
| `exportBtn` | `<button>` | Export JSON |
| `exportImageBtn` | `<button>` | Export PNG |
| `importBtn` | `<button>` | Opens the file picker |
| `resetBtn` | `<button class="btn danger">` | Reset to blank |
| `fileInput` | `<input type="file" accept=".json,application/json" hidden>` | Hidden JSON picker |
| `details` | `<div class="details">` | Container that `render()` fills |

### 5.2 Generated elements

`render()` produces one card per section (`index.html:166-179`):

```html
<div class="card" style="border-color: {color}55">
  <div class="accent" style="background:{color}"></div>
  <div class="card-main">
    <span class="dot" style="background:{color}"></span>
    <input class="card-name-input" data-name="{i}" value="{esc(name)}">
  </div>
  <div class="note">
    <div class="note-label">NOTES</div>          <!-- hidden via CSS -->
    <textarea class="note-input" data-note="{i}">{esc(note)}</textarea>
  </div>
  <div class="card-tools">
    <button class="move-btn"   data-up="{i}"     [disabled if i==0]>↑</button>
    <button class="delete-btn" data-delete="{i}">🗑</button>
    <button class="move-btn"   data-down="{i}"   [disabled if last]>↓</button>
  </div>
</div>
```

After the cards it appends `<button id="addDetail" class="btn primary add-detail">＋ Tambah Song Detail</button>`.

### 5.3 Data attributes

The `data-*` attributes let event delegation find the section index without keeping references to DOM nodes:

| Attribute | Element | Used by |
|---|---|---|
| `data-name="{i}"` | Section name input | `input` listener, focus after add |
| `data-note="{i}"` | Note textarea | `input` listener |
| `data-up="{i}"` | Move-up button | `click` listener → `moveSection(i,-1)` |
| `data-down="{i}"` | Move-down button | `click` listener → `moveSection(i,1)` |
| `data-delete="{i}"` | Delete button | `click` listener → `deleteSection(i)` |

The indices are positional and are regenerated on every `render()`.

---

## 6. Presentation (CSS) layer

### 6.1 Design tokens

```css
:root{
  --bg:#05090f; --panel:#0b1420; --panel2:#0e1926; --text:#f3f6fb;
  --muted:#9eacc0; --line:#26374c; --accent:#4da3ff; --danger:#ff5f7a;
  --green:#18d47b; --orange:#ff9b2f; --cyan:#14cbe6; --pink:#ef4e9b;
}
```

Only `--text`, `--muted`, `--line` and `--accent` are referenced through `var()`. Many other colors are written as literal hex values in individual rules.

### 6.2 Typography

- **Font stack:** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Inter is not bundled, so it is used only if it is installed on the device.
- `button, input, textarea { font: inherit }` keeps the form controls in the page font.
- The song title uses a fluid size of `clamp(30px, 5vw, 58px)`, weight 800 and `letter-spacing: -2px`.

| Element | Desktop | ≤ 850px |
|---|---|---|
| Song title | 30-58px (fluid) | 30-58px (fluid) |
| Section name (`.card-name-input`) | 22px / 800 | 22px / 800 |
| Notes (`.note-input`) | 18px / 500, line-height 1.4 | 17px |
| Section header label | 14px / 800, letter-spacing 1.4px | same |
| Meta labels | 10px / 800, letter-spacing 1px | same |

### 6.3 Layout system

| Component | Technique | Definition |
|---|---|---|
| `.app` | Centered block | `max-width:1180px; margin:auto; padding:34px 22px 50px` |
| `.header` | Flexbox (row, space-between) | Title area on the left, toolbar on the right |
| `.meta-grid` | CSS Grid, 2 columns | `minmax(180px,240px) minmax(220px,1fr)` |
| `.toolbar` | Flexbox with wrap | 8px gap |
| `.details` | Flexbox column | 10px gap between cards |
| `.card` | CSS Grid, 4 columns | `7px 250px minmax(0,1fr) 44px` |
| `.card-tools` | Flexbox column | Buttons stacked vertically and centered |

### 6.4 Responsive breakpoint

There is one breakpoint, `@media (max-width: 850px)` (`index.html:51-59`):

```
Desktop (> 850px)                     Narrow (≤ 850px)
┌─┬─────────┬──────────────┬──┐       ┌─┬──────────────────┬──┐
│ │ ● Name  │ Notes        │↑ │       │ │ ● Name           │↑ │
│ │         │              │🗑│       │ ├──────────────────┤🗑│
│ │         │              │↓ │       │ │ Notes            │↓ │
└─┴─────────┴──────────────┴──┘       └─┴──────────────────┴──┘
 7px  250px    1fr          44px        7px     1fr          42px
```

On narrow screens the header also switches to `flex-direction: column`.

### 6.5 Interaction styling

- **Inputs that look like text:** the section name and note fields have transparent borders and backgrounds. On `:hover` or `:focus` they get a border, a dark background and extra padding, with an equal negative margin so the layout doesn't shift.
- **Focus color:** focused inputs use `--accent` (`#4da3ff`) as the border color.
- **Disabled move buttons:** `opacity: .28; cursor: default`.
- **Per-section color:** the card border uses the accent color with alpha `55` (about 33%), set inline (`index.html:164`).

---

## 7. Application (JavaScript) layer

### 7.1 Module pattern

All logic sits inside an immediately invoked arrow function `(() => { ... })();`. This keeps everything out of the global scope, and nothing is exported to `window`. The script is at the end of `<body>`, so the DOM exists when it runs and no `DOMContentLoaded` handler is needed.

### 7.2 Constants

| Name | Value | Purpose |
|---|---|---|
| `APP_VERSION` | `"1.4.7"` | Version identifier (currently unused) |
| `KEY` | `"songStructureTimeline_v1_4_2"` | Current storage key |
| `PREVIOUS_KEY` | `"songStructureTimeline_v1_4_1"` | Migration source |
| `PREVIOUS_KEY_2` | `"songStructureTimeline_v1_3_0"` | Migration source |
| `colors` | 9 hex colors | Palette for new sections, cycled by index |
| `blankState` | Empty state | Target of Reset |
| `defaults` | 9-section example song | First-run and fallback state |

### 7.3 Function reference

| Function | Signature | Side effects | Description |
|---|---|---|---|
| `load` | `() → State` | May write migrated data to `localStorage` | Resolves state from storage, migrations or defaults (see §9) |
| `persist` | `() → void` | Writes `localStorage[KEY]` | Serializes the whole `state` |
| `esc` | `(s: any) → string` | None | Escapes `& < > " '` to HTML entities; `null`/`undefined` become `""` |
| `render` | `() → void` | Rebuilds the DOM | Syncs the header inputs and rebuilds `#details` |
| `addSection` | `() → void` | Changes state, saves, renders | Appends `{name:"New Section", color:colors[i%9], note:""}` and focuses and selects the new name field on the next frame |
| `moveSection` | `(i: number, direction: -1\|1) → void` | Changes state, saves, renders | Swaps with the neighbour using destructuring. Does nothing if out of bounds |
| `deleteSection` | `(i: number) → void` | Confirm dialog, then changes state, saves, renders | Removes the section with `splice` |
| `wrapLines` | `(ctx, text, maxWidth) → string[]` | None (uses `measureText`) | Canvas word wrapping (see §11.4) |
| `roundRect` | `(ctx, x, y, w, h, r) → void` | Builds a canvas path | Rounded rectangle from four `arcTo` calls, with the radius capped at half the width/height |
| `exportImage` | `() → void` | Triggers a download | Draws and downloads the PNG (see §11) |

### 7.4 Event model

The app uses **event delegation** on `document`, so listeners survive the complete DOM rebuild in `render()`.

**`click` listener** (`index.html:222-230`), checked in this order:

1. `closest("[data-up]")` → `moveSection(i, -1)`
2. `closest("[data-delete]")` → `deleteSection(i)`
3. `closest("[data-down]")` → `moveSection(i, 1)`
4. `target.id === "addDetail"` → `addSection()`

**`input` listener** (`index.html:232-258`):

| Target | State field |
|---|---|
| `#songTitle` | `state.title` |
| `#baseKey` | `state.baseKey` |
| `#serviceDate` | `state.serviceDate` |
| `#serviceTitle` | `state.serviceTitle` |
| `[data-name]` | `state.sections[i].name` |
| `[data-note]` | `state.sections[i].note` |

Each branch calls `persist()`. **It does not call `render()`**, which keeps focus, the caret and the IME composition state intact while the user types.

**Direct handlers** (`onclick`/`onchange`) are used on `#exportBtn`, `#exportImageBtn`, `#importBtn`, `#resetBtn` and `#fileInput`.

### 7.5 Render cycle

```
user action ──► mutate state ──► persist() ──► render()      (structural change)
user typing ──► mutate state ──► persist()                    (text change, no re-render)
```

`render()` clears `#details` with `innerHTML=""` and rebuilds every card from a template literal. The four header inputs are updated through `.value`. Lines 154-156 repeat lines 151-153, which is redundant but harmless.

---

## 8. State model

### 8.1 Shape

```ts
// TypeScript notation, for documentation only
interface Section {
  name: string;   // section label, e.g. "Chorus 1"
  color: string;  // CSS color, expected to be 6-digit hex "#RRGGBB"
  note: string;   // free text, may contain newlines
}

interface State {
  title: string;        // song title
  baseKey: string;      // free text, e.g. "G", "Bb"
  serviceDate: string;  // "" or ISO 8601 "YYYY-MM-DD"
  serviceTitle: string; // free text
  sections: Section[];  // ordered; order = performance order
}
```

### 8.2 Lifecycle

| Event | Resulting state |
|---|---|
| First run / no stored data | `structuredClone(defaults)`: title "Song Title" and 9 example sections |
| Page load with stored data | Stored state, with empty `title` replaced by "Song Title" |
| Reset | `structuredClone(blankState)`: everything empty, `sections: []` |
| Import | `{title, sections}` from the file (see §10.2) |

### 8.3 Invariants

- `state.sections` is always an array. Both `load()` and import require this.
- Every section has string `name` and `note` values and a truthy `color`.
- There is exactly one mutable binding for state (`let state`). Reset and import replace it, and the other operations change it in place.

---

## 9. Persistence layer

### 9.1 Storage scheme

| Aspect | Specification |
|---|---|
| Mechanism | `window.localStorage` (synchronous, origin-scoped, string values) |
| Key | `songStructureTimeline_v1_4_2` |
| Value | `JSON.stringify(state)` (compact, no indentation) |
| Write frequency | On every change, including each keystroke |
| Scope | Per origin. `file://`, `localhost` and each hosted domain have separate stores |
| Capacity | Browser quota, usually about 5 MB per origin, which is far more than typical use needs |

### 9.2 Load and migration algorithm

```
load():
  try:
    cur ← parse(localStorage[v1_4_2])
    if cur && cur.sections is Array:
        return cur with title defaulting to "Song Title", other metadata defaulting to ""
    prev ← parse(localStorage[v1_4_1])
    if prev?.sections:
        migrated ← {title, baseKey, serviceDate, serviceTitle, sections: normalize(prev.sections)}
        localStorage[v1_4_2] ← migrated
        return migrated
    prev2 ← parse(localStorage[v1_3_0])
    if prev2?.sections:
        migrated ← {title, baseKey:"", serviceDate:"", serviceTitle:"", sections: normalize(prev2.sections)}
        localStorage[v1_4_2] ← migrated
        return migrated
  catch: (ignore: corrupt JSON, storage disabled)
  return structuredClone(defaults)

normalize(s) = { name: String(s.name || "Untitled"),
                 color: s.color || "#3182f6",
                 note: String(s.note || "") }
```

Notes:

- The current-key branch returns stored sections **without** normalizing them. Extra fields, such as legacy `teamNotes`, are kept in memory and written back on the next save.
- Legacy keys are never deleted after migration.
- The key name `v1_4_2` is kept on purpose for backward compatibility. Changing it requires adding the old key to the migration chain.

---

## 10. JSON interchange format

### 10.1 Export

- **Trigger:** `#exportBtn`
- **Serialization:** `JSON.stringify(state, null, 2)` (2-space indentation)
- **MIME type:** `application/json`
- **File name:** `song-structure.json` (fixed)
- **Mechanism:** a `Blob`, then `URL.createObjectURL`, then a temporary `<a download>` that is clicked, then `URL.revokeObjectURL`

Example output:

```json
{
  "title": "Song Title",
  "baseKey": "G",
  "serviceDate": "2026-09-27",
  "serviceTitle": "Ibadah Minggu Pagi",
  "sections": [
    { "name": "Intro", "color": "#3182f6", "note": "Bangun ambience. Jangan terlalu penuh. " },
    { "name": "Verse 1", "color": "#18d47b", "note": "Jaga ruang untuk vocal. Jangan terlalu ramai." }
  ]
}
```

### 10.2 Import

- **Trigger:** `#importBtn` opens `#fileInput`
- **Accepted:** `.json`, `application/json`
- **Reading:** `FileReader.readAsText` (UTF-8)
- **Validation:** `JSON.parse` must succeed and `Array.isArray(x.sections)` must be true
- **Transformation:**

```js
state = {
  title: String(x.title || "Song Title"),
  sections: x.sections.map(s => ({
    name:  String(s.name || "Untitled"),
    color: s.color || "#3182f6",
    note:  String(s.note || "")
  }))
};
```

- **After import:** `persist()`, `render()`, and the file input is cleared (`e.target.value = ""`) so the same file can be imported again.
- **On failure:** `alert("File JSON tidak valid.")` and the state is left unchanged.

> ⚠ The import transformation leaves out `baseKey`, `serviceDate` and `serviceTitle` (see §19).

### 10.3 JSON Schema (descriptive)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Song Structure Timeline document",
  "type": "object",
  "required": ["sections"],
  "properties": {
    "title":        { "type": "string" },
    "baseKey":      { "type": "string" },
    "serviceDate":  { "type": "string", "pattern": "^(\\d{4}-\\d{2}-\\d{2})?$" },
    "serviceTitle": { "type": "string" },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":  { "type": "string" },
          "color": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
          "note":  { "type": "string" }
        }
      }
    }
  }
}
```

Only `sections` being an array is actually enforced. The other constraints describe the intended format.

---

## 11. PNG export engine

`exportImage()` (`index.html:276-465`) draws the song map on an off-screen canvas in two passes: it **measures** first and then **draws**.

### 11.1 Canvas parameters

| Parameter | Value |
|---|---|
| Logical width | 1200 px |
| Device scale | 2 (`ctx.scale(2,2)`) |
| Output width | 2400 px |
| Output height | `max(600, total) × 2` px |
| Padding (`pad`) | 60 px |
| Content width (`cw`) | 1080 px |
| Card gap | 14 px |
| Encoding | `canvas.toDataURL("image/png")` |
| File name | `{title}.png` |

### 11.2 Header layout

| Element | Position and size | Style |
|---|---|---|
| Title | Left, width `cw − 190 − 28 = 862`, at most 2 lines, 62px line height | `800 54px`, `#f3f6fb` |
| Service line | Below the title (`titleBottom + 4`), with a calendar icon at `pad` and text at `pad + 40` | `800 24px`, `#b8d0ee`; text is `serviceTitle • date`, or either one alone |
| Subtitle | Below the service line (+38 if present), with a document icon | `18px`, `#a9bdd7`, text "Peta lagu" |
| Key badge | Top-right, 190 × 112, radius 16 | Fill `#09121c`; border `#4da3ff` if a key is set, else `#26374c`; label "KUNCI DASAR" `800 12px`; key `900 52px`, centered, "—" if empty |
| Divider | At `headerBottom`, full content width | `#203044`, 1px |
| "SONG DETAILS" label | `headerBottom + 32` | `800 14px`, `#9fb5d6` |

The title's top edge lines up with the top of the key badge. Canvas text is placed by its baseline, so the code adds the measured `actualBoundingBoxAscent` of `"Hg"` (with a fallback of 50) to `headerTop`.

`headerBottom = max(pad + 112, subtitleTop + 24) + 28`

### 11.3 Section cards

```
x = pad                                    pad+240                               pad+1080
┌─┬──────────────────────────────────────┬─┬──────────────────────────────────────┐
│█│  ●  Section name (≤ 2 lines)         │ │  Note line 1                         │
│█│     700 24px, line step 29           │ │  500 22px, line step 32              │
│█│                                      │ │  ...                                 │
└─┴──────────────────────────────────────┴─┴──────────────────────────────────────┘
 7px accent bar      dot at (pad+34, y+36), r=7    divider from y+18 to y+h−18
```

| Property | Value |
|---|---|
| Left column width (`leftW`) | 240 px. The name wraps at `leftW − 54 = 186` px |
| Right column width (`rightW`) | `cw − 240 − 34 = 806` px. Notes wrap at `rightW − 34 = 772` px |
| Name baseline | `y + 42 + i × 29`, at `x = pad + 52` |
| Note baseline | `y + 42 + i × 32`, at `x = pad + 264` |
| Card height | `h = max(72, 64 + 28 × max(nameLines, noteLines or 1))` |
| Card fill and border | `#09121c`, border `{accent}88` (about 53% alpha), radius 12 |
| Name and note colors | `#f3f6fb` / `#dce7f5` |

### 11.4 Text wrapping algorithm (`wrapLines`)

1. Split the input on `\r?\n` into paragraphs.
2. An empty or whitespace-only paragraph becomes an empty line, which keeps intentional blank lines.
3. For each paragraph, split on whitespace and add words while `measureText(line).width ≤ maxWidth`.
4. If a single word is wider than `maxWidth`, break it character by character (iterating by Unicode code point with `for…of`).
5. Return at least `[""]`.

The caller truncates names with `.slice(0, 2)` and the title with `.slice(0, 2)`. Notes are not truncated.

### 11.5 Height calculation

```
total = songDetailsLabelY + 34
      + Σ (h_section + 14)
      + 34 + 60
canvas.height = max(600, total) × 2
```

Drawing starts the first card at `songDetailsLabelY + 58`, which is 24 px lower than the budget assumes. That still leaves a bottom margin of about 84 px.

### 11.6 Background

- A linear gradient from top to bottom: `#102033` at 0, `#05090f` at 0.34, `#03070c` at 1.
- A radial glow centered at `(pad + 250, headerTop + 70)` with radius 20→430, color `rgba(77,163,255,.10)` fading to 0, clipped to the header area.

### 11.7 Date formatting

```js
new Date(serviceDate + "T00:00:00")          // parsed as local midnight, so there is no UTC day shift
  .toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
// "2026-09-27" → "27 September 2026"
```

---

## 12. Security

| Topic | Status |
|---|---|
| Attack surface | Only user input, imported JSON and `localStorage`. There are no network inputs |
| Output encoding | Section `name` and `note` go through `esc()` before being put into `innerHTML` as attribute values and textarea content |
| Header inputs | Set through `.value`, so no HTML is parsed |
| Unescaped interpolation | `s.color` is inserted into inline `style` attributes (`index.html:166`, `168`) without `esc()`. A crafted import such as `"color": "red\"><img src=x onerror=alert(1)>"` can inject markup (see §19) |
| Index values | `data-*` indices are loop integers, so they are safe |
| Import validation | Structural only (`sections` is an array). Types are coerced with `String()` except `color` |
| Canvas | Text is drawn with `fillText`, which cannot execute markup, and no cross-origin images are used, so the canvas is never tainted |
| Third-party code | None, so there is no supply-chain risk |
| Content Security Policy | Not declared. Inline script and style would need `'unsafe-inline'` or hashes if a CSP were added |
| Privacy | All data stays on the device. Nothing is transmitted |

**Recommended hardening:** check `color` against `/^#[0-9a-f]{6}$/i` in both `load()` and import, fall back to `#3182f6`, and add a CSP `<meta>` tag with hashes for the inline blocks.

---

## 13. Accessibility

**Implemented**

- Every metadata input has a `<label for>` and an `aria-label`.
- Section name, note and tool controls have `aria-label`s, and the tool buttons also have `title` tooltips (in Indonesian).
- Move buttons that can't be used get the native `disabled` attribute, which removes them from the tab order.
- All controls are native `<button>`, `<input>` and `<textarea>` elements, so they can be operated from the keyboard.
- Focused inputs get a visible accent border.
- Adding a section moves focus to the new name field.
- The page is marked `lang="id"` for screen reader pronunciation.

**Gaps**

- Toolbar and tool buttons have no custom `:focus-visible` style and rely on the browser default outline.
- The note textarea's `aria-label` (`Notes {name}`) is set at render time, so it goes stale after the section is renamed until the next render.
- Nothing announces reordering or deletion to assistive technology (there is no ARIA live region).
- The `NOTES` label is hidden with `display:none`, so sighted users see no visible label for the notes field.
- The delete button's only visible content is an emoji (🗑), although it has an `aria-label`.
- Section color is decoration only, so no information depends on it alone. This is compliant.

---

## 14. Internationalization

| Aspect | Implementation |
|---|---|
| UI language | Indonesian (`lang="id"`). All labels, placeholders, confirms and alerts are hard-coded Indonesian strings |
| Code comments | English |
| Date display | `id-ID` locale in the PNG only. The date input uses the browser's own locale UI |
| Text direction | LTR only |
| Unicode | UTF-8 throughout. `wrapLines` iterates by code point, so surrogate pairs are not split |
| String externalization | None. Strings are written inline in the markup and template literals |

**UI string catalogue**

| Context | String |
|---|---|
| Title placeholder | *Judul lagu* |
| Subtitle | *Peta lagu* |
| Metadata labels | *KUNCI DASAR*, *TANGGAL IBADAH*, *JUDUL IBADAH* |
| Placeholders | *Contoh: G*, *Contoh: Ibadah Minggu Pagi*, *Nama section*, *Tambahkan notes...* |
| Buttons | *Export JSON*, *Export Gambar*, *Import JSON*, *Reset*, *＋ Tambah Song Detail* |
| Tooltips | *Geser ke atas*, *Geser ke bawah*, *Hapus section* |
| Delete confirmation | *Hapus section "{name}"?* |
| Reset confirmation | *Reset semua data ke kondisi awal?* |
| Import error | *File JSON tidak valid.* |

---

## 15. Browser compatibility

The minimum version is set by the newest API the app uses, `structuredClone`:

| Browser | Minimum version |
|---|---|
| Chrome / Edge | 98 |
| Firefox | 94 |
| Safari (macOS / iOS) | 15.4 |
| Samsung Internet | 18 |

Other features that need a recent browser: optional chaining and `??` (2020), `TextMetrics.actualBoundingBoxAscent` (the code has a fallback value), CSS `clamp()`/`min()` and 8-digit hex colors.

**Environment notes**

- **`file://` protocol:** fully supported. `localStorage` works, but it is scoped per file path in some browsers.
- **Private browsing:** storage may be temporary or limited in size.
- **iOS Safari:** `<a download>` with a data URL can open the image in a new view instead of downloading it. Users can long-press to save.
- **Internet Explorer and legacy Edge:** not supported.

---

## 16. Performance

| Operation | Cost | Notes |
|---|---|---|
| Keystroke | O(size of state) `JSON.stringify` and a `setItem` | Negligible for realistic songs (fewer than 50 sections) |
| Structural change | Full rebuild of `#details` | Fine at this scale. Very long lists would benefit from keyed updates |
| PNG export | Measures all text twice, then draws | Usually well under 100 ms. A 2400 × N canvas can use tens of MB of memory for very tall songs |
| PNG encoding | `toDataURL` (base64 string in memory) | `toBlob` would use about 33% less memory |
| Startup | One `localStorage` read, one render | Instant, with no network |

---

## 17. Error handling

| Scenario | Handling |
|---|---|
| Corrupt JSON in `localStorage` | Caught in `load()`, which falls back to `defaults` |
| `localStorage` unavailable while loading | Caught in `load()`, which falls back to `defaults` |
| `localStorage` write fails (quota, disabled) | **Not caught.** `persist()` throws and the action that triggered it stops after the state changed |
| Invalid import file | Caught, shows `alert("File JSON tidak valid.")`, state unchanged |
| Import where a section is `null` or a primitive | Accessing `.name` on `null` throws, which is caught and shows the alert |
| File picker cancelled | `if(!f) return` |
| Out-of-range move or delete index | Guard clauses return early |
| Invalid date string | `new Date` produces `Invalid Date` and the image shows "Invalid Date" |

---

## 18. Coding conventions

| Convention | Observed practice |
|---|---|
| Indentation | One space inside the script. CSS is partly minified, with several rules on single lines |
| Naming | camelCase for functions and variables, kebab-case for CSS classes, `data-*` for DOM-to-state binding |
| Declarations | `const` by default and `let` only for `state` and local accumulators. No `var` |
| Functions | Function declarations for named logic, arrow functions for callbacks |
| DOM creation | Template literals with `innerHTML` for cards, `createElement` for the add button and download links |
| Comments | Short English comments explaining *why* (for example, baseline alignment and design intent in export) |
| Versioning | `Major.Minor.Release`. Development builds are `song_structure_timeline_v1.x.y.html` and stable builds are `…-STABLE.html`. In this repository the stable build is `index.html` |
| Change policy | Small, isolated changes that preserve existing behavior (see [`AGENT_HANDOFF_v1.4.7.md`](AGENT_HANDOFF_v1.4.7.md) §14) |

---

## 19. Known technical issues

| # | Severity | Issue | Location | Suggested fix |
|---|---|---|---|---|
| 1 | Medium | **`color` is not escaped or validated.** Imported or stored `color` is put into `style="..."` attributes, so a crafted JSON file can inject HTML or script | `index.html:164-168`, `485`, `132`, `139` | Check against `/^#[0-9a-f]{6}$/i`, fall back to the default color |
| 2 | Medium | **Import drops metadata.** `baseKey`, `serviceDate` and `serviceTitle` are not copied from the file, and the next save removes them from storage | `index.html:484-487` | Include the three fields, each defaulting to `""` |
| 3 | Low | **Very long notes overflow their PNG card.** The height budget uses 28 px per line but notes are drawn at 32 px per line. The bottom margin is `54 − 4n` px, so notes of about 13 or more wrapped lines spill past the card and eventually into the next one | `index.html:324`, `431` vs `456` | Use `32` in the height formula, or calculate the name and note column heights separately |
| 4 | Low | **An empty title turns back into "Song Title" on reload.** Reset saves `title:""` but `load()` replaces it with `"Song Title"` | `index.html:128` | Use `current.title ?? "Song Title"` |
| 5 | Low | **`persist()` has no error handling.** A quota error or disabled storage throws an uncaught exception | `index.html:146` | Wrap it in try/catch and tell the user |
| 6 | Low | **The PNG file name is not sanitized.** Characters like `/ \ : * ? " < > \|` in the title can produce odd names | `index.html:462` | Replace those characters before building the name |
| 7 | Low | **Non-hex colors break alpha suffixing.** `color + "55"` or `+ "88"` produces an invalid CSS or canvas color when `color` isn't 6-digit hex, so the border falls back to the previous or default color | `index.html:164`, `434` | Follow the fix for issue #1 |
| 8 | Low | **The metadata grid doesn't collapse on phones.** The minimum track widths plus the gap are 410 px, which can overflow viewports narrower than about 454 px | `index.html:22`, `51-59` | Add `grid-template-columns: 1fr` inside the breakpoint |
| 9 | Info | `.meta-field.full` is used in the markup but has no CSS rule | `index.html:72` | Add `grid-column: 1 / -1` or remove the class |
| 10 | Info | `APP_VERSION` is declared but never used | `index.html:91` | Use it (for example in the export or UI) or remove it |
| 11 | Info | `render()` sets three header input values twice | `index.html:154-156` | Remove the duplicate lines |
| 12 | Info | The `colors` palette contains duplicates (`#18d47b`, `#ff9b2f`) | `index.html:95` | Intentional or cosmetic, review before changing |

---

## 20. Testing

The project has no automated test suite. The verification steps below are recommended.

### 20.1 Manual regression checklist

| Area | Steps | Expected result |
|---|---|---|
| First run | Clear site data and load the page | Example song with 9 sections |
| Editing | Edit the title, the metadata, a section name and a note, then reload | All values are kept |
| Add | Click *＋ Tambah Song Detail* | "New Section" is appended with its name selected and a palette color |
| Reorder | Use ↑ and ↓ on the middle, first and last sections | They swap correctly, and ↑ on the first and ↓ on the last are disabled |
| Delete | Click 🗑, then cancel; then confirm | Nothing changes on cancel; the section is removed on confirm |
| Reset | Click Reset and confirm | No sections and all fields empty |
| Export JSON | Click Export JSON | `song-structure.json` downloads with 2-space indentation |
| Import JSON | Import the exported file | Sections are restored (the metadata caveat in §19 #2 applies) |
| Invalid import | Import `{}` or a non-JSON file | Alert "File JSON tidak valid." and state unchanged |
| PNG export | Export with a key, date, service title and long notes | 2400 px wide, correct header, wrapped notes, height fits the content |
| PNG empty key | Export with the key blank | The badge shows "—" with a muted border |
| Responsive | Resize the window below 850 px | Cards stack the name above the notes and the header stacks |
| Migration | Put v1.4.1 or v1.3.0 shaped data under the legacy keys and clear the current key | The data loads and is written under `v1_4_2` |

### 20.2 Suggested automation

If automated tests are added, a browser end-to-end tool such as Playwright fits well because the app has no build step. Load `index.html`, drive the controls, assert on `localStorage` and the DOM, and compare exported PNGs with snapshots. Pure helpers like `esc` and `wrapLines` could be unit-tested if they were moved out of the IIFE.

---

## 21. Extension guidelines

1. **Keep it a single file with no dependencies.** It must keep working when opened through `file://` and offline.
2. **Change the schema through migration.** Any new or renamed state field needs handling in `load()` (the current-key branch and the legacy branches) *and* in the import transformation, with safe defaults.
3. **Changing the storage key** means adding the old key to the migration chain. Never orphan existing data.
4. **Escape everything that goes into `innerHTML`** with `esc()`, and validate values used in CSS contexts.
5. **Don't re-render on text input.** Doing so destroys focus and the caret.
6. **Keep the PNG measure and draw passes in sync.** Every font, wrap width and line height used for drawing must match the ones used to calculate `total`.
7. **Put UI strings in Indonesian** to match the existing interface.
8. **Keep the removed features removed.** Don't reintroduce Team Notes, and don't make Reset restore the template (see [`AGENT_HANDOFF_v1.4.7.md`](AGENT_HANDOFF_v1.4.7.md) §14).
9. **Bump the version** in both the HTML comment (`index.html:3`), `<title>` and `APP_VERSION`.

---

## 22. Glossary

| Term | Meaning |
|---|---|
| **Section / Song Detail** | One part of a song (Intro, Verse, Chorus…) with a name, color and notes |
| **Base key / Kunci Dasar** | The musical key the song is played in |
| **Ibadah** | Worship service |
| **Peta lagu** | "Song map", the subtitle of the app and the export |
| **Accent color** | A section's identifying color, shown as a bar and dot in the UI and the PNG |
| **Team Notes / Catatan untuk Team** | A global notes field removed in v1.4.7 |
| **STABLE** | A release suffix marking a baseline approved for handoff |
| **IIFE** | Immediately Invoked Function Expression, used here to scope the application |
| **Event delegation** | A single listener on an ancestor that handles events for dynamically created children |
