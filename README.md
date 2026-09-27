# Song Structure Timeline (setlist.app)

**Version:** 1.4.7-STABLE

Song Structure Timeline is a single-page browser app for building a song map before a worship service. You enter the song's details, list its sections in order (Intro, Verse, Chorus, Bridge, and so on), add a performance note to each section, and then export the result as a PNG to share with the team or as a JSON file to reuse later.

The whole app is one HTML file with no build step, no dependencies and no server. The UI is written in Indonesian.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Features](#features)
3. [Using the app](#using-the-app)
4. [Data model](#data-model)
5. [Persistence and migration](#persistence-and-migration)
6. [JSON export and import](#json-export-and-import)
7. [PNG export](#png-export)
8. [Architecture](#architecture)
9. [Styling and responsive layout](#styling-and-responsive-layout)
10. [Version history](#version-history)
11. [Known limitations](#known-limitations)
12. [Contributing and preservation rules](#contributing-and-preservation-rules)
13. [Repository layout](#repository-layout)

---

## Quick start

No installation is needed.

1. Clone or download the repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).

To serve it locally instead, for example to test on a phone on the same network:

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

The app works offline once it is loaded. Any static host (GitHub Pages, Netlify, an S3 bucket) can serve it as-is.

**Browser requirements:** the app uses `structuredClone`, optional chaining (`?.`), `localStorage`, `FileReader`, `Blob` and the Canvas 2D API, so it needs a browser released in 2022 or later.

---

## Features

| Feature | Description |
|---|---|
| Song metadata | Song title, base key (*Kunci Dasar*), service date (*Tanggal Ibadah*) and service title (*Judul Ibadah*). |
| Song sections | An ordered list of sections. Each has a name, an accent color and free-text notes. |
| Reordering | Up/down arrows move a section one position. The first section can't move up and the last can't move down. |
| Deletion | Deletes a section after a confirmation prompt. |
| Auto-save | Every edit is saved to the browser's `localStorage` immediately. |
| JSON export/import | Saves the song as `song-structure.json` and loads it back. |
| PNG export | Draws a high-resolution image of the song map in the browser. |
| Reset | Clears everything to a blank song with no sections. |
| Responsive UI | A two-column card layout on desktop that stacks vertically on narrow screens. |

---

## Using the app

### Header

| UI element | Indonesian label | Action |
|---|---|---|
| Large title input | *Judul lagu* (placeholder) | Song title |
| Text input | **KUNCI DASAR** | Base key, e.g. `G` |
| Date picker | **TANGGAL IBADAH** | Service date |
| Text input | **JUDUL IBADAH** | Service title, e.g. *Ibadah Minggu Pagi* |
| Button | **Export JSON** | Download the current data as JSON |
| Button | **Export Gambar** | Download a PNG image |
| Button | **Import JSON** | Load a previously exported JSON file |
| Button (red) | **Reset** | Clear all data (asks for confirmation) |

### Song Details

Each section is shown as a card with four parts:

```
┌─┬──────────────────┬──────────────────────────────────────┬────┐
│▌│ ● Section name   │ Notes for this section...            │ ↑  │
│▌│                  │                                      │ 🗑 │
│▌│                  │                                      │ ↓  │
└─┴──────────────────┴──────────────────────────────────────┴────┘
 accent  identity           notes (textarea)                 tools
```

- **Accent bar and dot:** the section's color. It is stored with the section and also used in the PNG export.
- **Section name:** edit it in place by clicking it.
- **Notes:** a resizable textarea for performance cues ("Jaga ruang untuk vocal", "Tunggu cue final", and so on).
- **Tools:** move up (↑), delete (🗑) and move down (↓).

**＋ Tambah Song Detail** adds a new section named "New Section" at the end of the list. It gets the next color from the built-in palette, and its name field is focused and selected so you can type straight away.

### First run

On first launch, or when nothing is stored, the app loads an example song with nine sections: Intro, Verse 1, Chorus 1, Intro / Turn, Verse 2, Chorus 2, Bridge, Final Chorus and Outro. Each comes with sample Indonesian notes.

### Reset

**Reset** asks *"Reset semua data ke kondisi awal?"*. If you confirm, it:

1. replaces the state with a blank state (all metadata empty, no sections);
2. saves that blank state to `localStorage`;
3. re-renders the UI.

Reset is a **clear current work** operation. It does **not** restore the example template.

---

## Data model

The application state is a plain object:

```js
{
  title: "",          // Song title
  baseKey: "",        // Musical base key, e.g. "G"
  serviceDate: "",    // ISO date string "YYYY-MM-DD" from <input type="date">
  serviceTitle: "",   // Service/event title
  sections: [
    {
      name: "Verse 1",      // Section label
      color: "#18d47b",     // Accent color (hex)
      note: "Jaga ruang untuk vocal. Jangan terlalu ramai."
    }
  ]
}
```

- `sections` is **ordered**. Its order is the song's performance order.
- The accent palette used when adding sections is:
  `#3182f6, #18d47b, #ff9b2f, #14cbe6, #18d47b, #ff9b2f, #ef4e9b, #ffad32, #9747ff`
  (it cycles by section index).
- **Removed field:** `teamNotes` ("Catatan untuk Team") was removed in 1.4.7. Older saved or imported data may still contain it, but the current UI and export ignore it.

---

## Persistence and migration

All data stays in the browser's `localStorage`. Nothing is sent to a server.

| Constant | Key | Role |
|---|---|---|
| `KEY` | `songStructureTimeline_v1_4_2` | Current storage key. It keeps its old name on purpose so existing saved data still loads. |
| `PREVIOUS_KEY` | `songStructureTimeline_v1_4_1` | Migrated from if found |
| `PREVIOUS_KEY_2` | `songStructureTimeline_v1_3_0` | Migrated from if found |

On startup, `load()` tries these sources in order:

1. **Current key.** Used as-is if it contains a `sections` array.
2. **v1.4.1 key.** Title, metadata and sections are mapped into the current shape and written to the current key.
3. **v1.3.0 key.** Title and sections are migrated. Metadata fields start empty.
4. **Fallback.** A clone of the built-in example song.

During migration each section is normalized to `{ name, color, note }`, with defaults of `"Untitled"`, `#3182f6` and `""`.

Any change (typing, adding, moving, deleting, importing, resetting) calls `persist()` right away, so there is no Save button.

> Data is tied to one browser and origin. Clearing site data, using a private window, or opening the file from a different path or host starts with a separate, empty store. Use **Export JSON** for backups and for moving songs between devices.

---

## JSON export and import

### Export

**Export JSON** serializes the state with `JSON.stringify(state, null, 2)` and downloads it as **`song-structure.json`**.

### Import

**Import JSON** opens a hidden file picker that accepts `.json` files. The app then:

1. reads the file with `FileReader`;
2. parses it as JSON;
3. checks that `sections` is an array, and rejects the file otherwise;
4. rebuilds each section as `{ name, color, note }` with defaults;
5. saves and re-renders.

An invalid file shows the alert **"File JSON tidak valid."** and leaves the current data unchanged.

> **Schema note:** treat the JSON structure as the app's data format. If a future version changes the schema, add migration logic so existing exported files keep working.

---

## PNG export

**Export Gambar** draws the song map with the HTML Canvas 2D API, entirely in the browser.

**Canvas geometry**

- Logical width **1200px**, rendered at **2× scale**, so the file is 2400px wide.
- Padding 60px. The gap between section cards is 14px.
- The height is **calculated from the content**. Long notes make the image taller, with a minimum of 600 logical px.

**Rendering order**

1. Dark vertical gradient background (`#102033` → `#05090f` → `#03070c`) with a soft blue radial glow behind the header.
2. **Song title**: 800 weight, 54px, wrapped to at most 2 lines.
3. **Service line**: a calendar icon followed by `Service Title • DD Month YYYY`. The date uses the `id-ID` locale, for example *27 September 2026*.
4. **Subtitle**: a document icon and "Peta lagu".
5. **Key badge** in the top-right corner: a "KUNCI DASAR" label above the key in large type, or "—" if the key is empty.
6. A divider and the **SONG DETAILS** label.
7. **One card per section**: accent bar, colored dot, section name, a vertical divider, then the wrapped notes.

**Typography (v1.4.7)**

| Element | Font |
|---|---|
| Section name | 700, **24px**, at most 2 lines, 29px line height |
| Section notes | 500, **22px**, 32px line height |

Text wrapping (`wrapLines`) breaks on words, keeps explicit line breaks, and splits very long words character by character when they don't fit.

The image is downloaded as **`<Song Title>.png`**.

---

## Architecture

Everything lives in `index.html`: the markup, a `<style>` block and a single IIFE `<script>`.

**Technologies:** HTML5, CSS3 (custom properties, grid, flexbox, media queries), vanilla JavaScript (ES2020+), DOM APIs, Canvas 2D, `localStorage`, `FileReader`, `Blob` / `URL.createObjectURL`, and download links (`<a download>`).

It uses no framework (React, Vue and so on), no bundler and no backend.

### Key functions

| Function | Responsibility |
|---|---|
| `load()` | Reads state from `localStorage`, runs migrations, and falls back to the example song |
| `persist()` | Writes `state` to `localStorage` under `KEY` |
| `esc(s)` | HTML-escapes `& < > " '` for user text placed into generated markup |
| `render()` | Fills the header inputs and rebuilds every section card and the add button |
| `addSection()` | Adds a new section, saves, re-renders and focuses the new name field |
| `moveSection(i, dir)` | Swaps a section with its neighbour (`dir` is `-1` or `+1`) |
| `deleteSection(i)` | Confirms, then removes a section |
| `wrapLines(ctx, text, maxWidth)` | Canvas text wrapping for the export |
| `roundRect(ctx, …)` | Rounded-rectangle path helper for the canvas |
| `exportImage()` | Measures the layout, draws the PNG and downloads it |

### Event handling

- **One delegated `click` listener** on `document` handles the move-up, delete and move-down buttons (through `data-up`, `data-delete` and `data-down` attributes) and the add button.
- **One delegated `input` listener** updates `state` for the metadata fields and the section name and note fields (`data-name`, `data-note`), then saves.
- Text input does **not** re-render, so focus and cursor position are kept while typing. Only structural changes (add, move, delete, import, reset) call `render()`.
- The toolbar buttons use direct `onclick` handlers.

---

## Styling and responsive layout

The app has a dark theme defined with CSS custom properties:

```css
--bg:#05090f;   --panel:#0b1420; --panel2:#0e1926; --text:#f3f6fb;
--muted:#9eacc0; --line:#26374c; --accent:#4da3ff; --danger:#ff5f7a;
--green:#18d47b; --orange:#ff9b2f; --cyan:#14cbe6; --pink:#ef4e9b;
```

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

**Desktop (> 850px):** each card is a 4-column grid: `7px accent | 250px identity | flexible notes | 44px tools`. Section names are 22px and notes are 18px. Card height follows the content.

**Narrow screens (≤ 850px):** the card becomes `7px accent | content | 42px tools`, and the notes move under the section name with a top divider. Notes drop to 17px, and the header stacks the title area above the toolbar.

Inputs look like plain text until you hover or focus them, when a subtle border and background appear.

---

## Version history

### v1.4.7-STABLE (current)

- **Song Details layout:** a compact two-column card (identity | notes) on desktop, larger and easier-to-read note text, height that follows the content, and responsive collapse on small screens.
- **PNG export typography:** section names enlarged to 24px and notes to 22px, with more line spacing and a height calculated from the content.
- **Reset:** now clears to a truly blank song, with no sections and empty metadata, instead of restoring the example.
- **Team Notes removed:** the "Catatan untuk Team" field is gone from the UI, the data model and the PNG export.

### v1.4.6-STABLE (baseline)

Song metadata, sections (name, color, notes, reorder, delete), JSON import/export, PNG export, `localStorage` persistence with migration from older keys, Reset, and a responsive UI.

### Naming convention

| Kind | Pattern |
|---|---|
| Development build | `song_structure_timeline_v1.x.y.html` |
| Stable build | `song_structure_timeline_v1.x.y-STABLE.html` |

In this repository the stable build is published as `index.html`.

---

## Known limitations

These are behaviors in the current code worth knowing about. They are candidates for future fixes, not intended features.

- **Import drops some metadata.** Importing JSON only restores `title` and `sections`. `baseKey`, `serviceDate` and `serviceTitle` in the file are ignored and cleared, even though Export JSON includes them.
- **An empty title comes back as "Song Title" after a reload.** Reset saves `title: ""`, but `load()` replaces an empty title with `"Song Title"` the next time the page opens.
- **Section colors are not validated.** `color` from imported JSON goes straight into inline `style` attributes without being escaped, so only import JSON files you trust. Names and notes are escaped with `esc()`.
- **The PNG file name is not sanitized.** A title with characters such as `/` or `:` can produce an odd file name, depending on the browser.
- **Export truncation.** The song title is limited to 2 lines and section names to 2 lines in the PNG. Anything longer is cut off.
- **Colors can't be picked in the UI.** Colors come from the built-in palette, or from an edited JSON file.
- **Storage is per browser.** Data isn't synced across devices, so use JSON export for backups.

---

## Contributing and preservation rules

This app has built up deliberate behavior over many versions. Treat **v1.4.7-STABLE as the authoritative baseline**, and prefer **small, isolated changes** over rewrites.

**Preserve:**

- section ordering, the up/down controls and deletion;
- per-section notes and accent colors;
- all song metadata fields;
- `localStorage` persistence and the existing storage/migration keys, unless you design a deliberate migration;
- JSON import/export;
- PNG export, including the content-based height;
- the responsive layout;
- reset-to-blank behavior.

**Do not reintroduce:**

- the Team Notes / *Catatan untuk Team* UI;
- a Team Notes block in the PNG export;
- a Reset that restores the example section template.

**When changing the data schema**, add migration logic in `load()` and in the import path so older `localStorage` data and exported JSON files keep working.

**Manual test checklist** (the project has no automated tests):

1. Add, rename, add notes to, reorder and delete sections, then reload and confirm everything was saved.
2. Export JSON, reset, import the file, and confirm the sections come back.
3. Export a PNG with long notes and check that the height and wrapping are right.
4. Resize below 850px and check the stacked card layout.
5. Reset and confirm there are no sections and the fields are empty.

---

## Repository layout

```
.
├── index.html                    # The application (v1.4.7-STABLE)
├── README.md                     # This file
└── docs/
    ├── AGENT_HANDOFF_v1.4.7.md   # Feature history, functional spec & preservation rules
    └── TECH_SPECIFICATION.md     # Technical spec: stack, standards, architecture, algorithms
```

For more detail, see:

- [`docs/TECH_SPECIFICATION.md`](docs/TECH_SPECIFICATION.md): the technology stack, web standards, architecture, data formats, the PNG rendering engine, security, accessibility, compatibility and known technical issues.
- [`docs/AGENT_HANDOFF_v1.4.7.md`](docs/AGENT_HANDOFF_v1.4.7.md): the feature specification, version history and handoff rules for future contributors.
