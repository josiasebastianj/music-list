> **ARCHIVED — OBSOLETE.** This document describes "Song Structure Timeline v1.4.7", a
> single-song predecessor of the current app. It does not reflect the current codebase
> (`index.html`, now setlist.app v2.1.0+ with a multi-song Event → Songs → Song Details
> architecture). Kept for historical reference only — see `docs/v2.1.0_feature_documentation.md`
> and `docs/v2.1.0_tech_documentation.md` for the current documentation.

# setlist.app — Song Structure Timeline v1.4.7-STABLE
## Feature & Technology Documentation / Agent Handoff

> Baseline: Song Structure Timeline v1.4.6-STABLE.
> Release: v1.4.7-STABLE.
> Scope: preserve the existing application behavior while implementing the 1.4.7 Song Details/export refinements and removing the Team Notes feature.

---

## 1. Product purpose

`Song Structure Timeline` is a lightweight, single-page web application for preparing a song structure/setlist view.

The application lets the user:

- enter a song title;
- enter a base key;
- enter a service date;
- enter a service title;
- create and edit ordered song sections;
- attach notes to each section;
- reorder sections;
- delete sections;
- export the current data as JSON;
- import JSON data;
- export a visual PNG image;
- reset the current song details to an empty state.

The current release no longer has a separate **“Catatan untuk Team” / Team Notes** field.

---

## 2. Version history relevant to 1.4.7-STABLE

### v1.4.6-STABLE baseline
The 1.4.6 baseline already contained:

- Song title, base key, service date, and service title metadata.
- Song Sections with:
  - section name;
  - color/accent;
  - notes;
  - up/down ordering controls;
  - delete control.
- JSON export/import.
- PNG image export.
- localStorage persistence.
- migration support from earlier storage keys.
- Reset functionality.
- Responsive UI.

### v1.4.7 changes
The 1.4.7 development work focused on:

1. **Song Details layout refinement**
   - Section information and notes are presented as a more compact two-column card on desktop.
   - The section identity remains visually separated from the notes.
   - Notes use a larger, more readable font.
   - Card height is content-driven rather than fixed.
   - Responsive behavior allows the layout to collapse appropriately on smaller screens.

2. **PNG export typography refinement**
   - Exported section names were enlarged.
   - Exported section notes were enlarged.
   - Line spacing was increased to maintain readability with the larger typography.
   - Export height is calculated dynamically from the rendered content.

3. **Reset behavior**
   - Reset now returns to a genuinely blank song state.
   - All Song Sections are deleted.
   - Song title, base key, service date, and service title are cleared.

4. **Removal of Team Notes**
   - The separate Team Notes UI was removed.
   - The exported image no longer contains a Team Notes block.
   - The active 1.4.7 UI/data model does not depend on a Team Notes field.

---

## 3. Current functional specification

### 3.1 Song metadata

The current editable metadata is:

| Field | Purpose |
|---|---|
| Song Title | Main title of the song |
| Base Key | Musical base key |
| Service Date | Date associated with the service |
| Service Title | Service/event title |

There is intentionally no Team Notes field in the current UI.

### 3.2 Song Sections

Each section contains:

- `name`
- `color`
- `note`

Example conceptual object:

```json
{
  "name": "Verse 1",
  "color": "#18d47b",
  "note": "Jaga ruang untuk vocal. Jangan terlalu ramai."
}
```

The section list is ordered.

### 3.3 Section ordering

Each section has:

- Up arrow: move the section one position upward.
- Down arrow: move the section one position downward.
- Trash button: delete the section.

The first section cannot move upward and the last section cannot move downward.

### 3.4 Adding sections

The UI provides:

`＋ Tambah Song Detail`

A newly created section receives a default accent color and empty/default section content according to the current implementation.

### 3.5 Section notes

Notes belong to individual sections.

The editor uses a larger note presentation than the older compact implementation. The export renderer also uses enlarged note typography.

---

## 4. Reset semantics

Reset is intentionally different from restoring the example/template data.

The blank state is conceptually:

```js
const blankState = {
  title: "",
  baseKey: "",
  serviceDate: "",
  serviceTitle: "",
  sections: []
};
```

When Reset is confirmed:

1. `state` is replaced with a clone of `blankState`.
2. The blank state is persisted to localStorage.
3. The UI is re-rendered.
4. All sections disappear.
5. All metadata fields are empty.

This means Reset is a **clear current work** operation, not a restore-template operation.

---

## 5. Persistence

The application uses browser `localStorage`.

Current storage key:

```js
const KEY = "songStructureTimeline_v1_4_2";
```

The key is intentionally retained from the existing application storage scheme so that existing saved data can continue to be recognized.

The application also retains migration support for earlier keys:

```js
const PREVIOUS_KEY = "songStructureTimeline_v1_4_1";
const PREVIOUS_KEY_2 = "songStructureTimeline_v1_3_0";
```

The `load()` function attempts:

1. current storage;
2. previous 1.4.1 storage;
3. previous 1.3.0 storage;
4. fallback template/default state.

Migration maps section data into the current section representation and writes the migrated result to the current key.

---

## 6. JSON export/import

### Export

The application serializes the current `state` object:

```js
JSON.stringify(state, null, 2)
```

and downloads it as:

```text
song-structure.json
```

### Import

The user selects a JSON file through a hidden file input.

The application:

1. reads the file with `FileReader`;
2. parses JSON;
3. verifies that `sections` is an array;
4. reconstructs the application state;
5. persists it;
6. renders the UI.

Invalid JSON produces:

```text
File JSON tidak valid.
```

### Important handoff note

The JSON structure should be treated as an application data format. If future versions change the schema, migration logic should be added rather than silently breaking existing saved files.

---

## 7. PNG export

The application creates the export image entirely in the browser using the HTML Canvas API.

High-level process:

1. Read current state.
2. Calculate text wrapping and required image height.
3. Create a canvas.
4. Scale the canvas for the export resolution.
5. Draw:
   - dark gradient background;
   - song title;
   - service/date metadata;
   - song structure subtitle;
   - base-key badge;
   - section cards;
   - section names;
   - section notes.
6. Convert the canvas to PNG with `toDataURL("image/png")`.
7. Trigger a browser download.

### Export typography in v1.4.7

The current implementation uses enlarged typography for exported Song Sections:

- Section name: `24px`
- Section notes: `22px`

Line spacing was also increased to prevent the larger text from colliding.

The image height is dynamically calculated from the amount of content, so long notes can increase the resulting image height.

---

## 8. UI/layout technology

The application is a self-contained HTML document.

Primary technologies:

- HTML5
- CSS3
- Vanilla JavaScript
- Browser DOM APIs
- Canvas API
- localStorage
- FileReader API
- Blob API
- browser download links

There is no application framework requirement such as React, Vue, Angular, or Svelte.

There is no server-side dependency in the current implementation.

---

## 9. CSS/design characteristics

The UI uses a dark, modern interface.

The stylesheet defines CSS custom properties such as:

```css
--bg
--panel
--panel2
--text
--muted
--line
--accent
--danger
--green
--orange
--cyan
--pink
```

The primary layout uses:

- flexbox;
- CSS grid;
- responsive sizing;
- media-query-based responsive adjustments;
- rounded cards;
- accent borders;
- compact controls;
- dark background gradients.

The application uses a system-font stack beginning with:

```css
Inter,
ui-sans-serif,
system-ui,
-apple-system,
BlinkMacSystemFont,
"Segoe UI",
sans-serif
```

---

## 10. Section visual model

Each Song Section has three major visual areas:

1. **Section identity**
   - accent color;
   - colored dot;
   - editable section name.

2. **Notes**
   - `NOTES` label;
   - editable textarea;
   - larger typography.

3. **Tools**
   - move up;
   - delete;
   - move down.

The accent color is stored with the section and is also used in the exported visual representation.

---

## 11. Responsive behavior

Desktop layout prioritizes a compact horizontal card structure.

On narrower screens, the section content can collapse into a more vertical arrangement so that:

- section names remain readable;
- notes remain accessible;
- controls remain usable;
- cards do not require excessive horizontal scrolling.

Future UI changes should preserve this responsive behavior.

---

## 12. Security/robustness details

The application includes an `esc()` helper for safely inserting section text into generated HTML attributes/content.

Conceptually:

```js
function esc(s) {
  return String(s ?? "").replace(...);
}
```

This is important because section names and notes are user-editable strings.

JSON import is also validated before the imported state is accepted.

---

## 13. Current state model

The active state is conceptually:

```js
{
  title: "",
  baseKey: "",
  serviceDate: "",
  serviceTitle: "",
  sections: [
    {
      name: "",
      color: "#3182f6",
      note: ""
    }
  ]
}
```

### Removed field

The following is no longer part of the intended current product model:

```js
teamNotes
```

Older stored/imported data may contain it because previous versions used it. Future agents should not reintroduce the field into the current UI unless explicitly requested.

---

## 14. Important preservation rules for future agents

When modifying v1.4.7-STABLE:

### Preserve
- Existing Song Section ordering behavior.
- Up/down controls.
- Delete behavior.
- Per-section notes.
- Per-section accent colors.
- Song metadata fields.
- localStorage persistence.
- Existing migration keys unless a deliberate storage migration is designed.
- JSON import/export.
- PNG export.
- Dynamic export height.
- Responsive layout.
- Reset-to-blank behavior.

### Do not reintroduce
- Team Notes / Catatan untuk Team UI.
- Team Notes block in PNG export.
- A reset operation that restores the example section template.

### Prefer
Small, isolated changes that modify only the requested feature.

Avoid rewriting the entire application for a localized UI change, because this application has accumulated intentional behavior across versions.

---

## 15. Files

Stable application:

```text
song_structure_timeline_v1.4.7-STABLE.html
```

Development naming convention:

```text
song_structure_timeline_v1.x.y.html
```

Stable naming convention:

```text
song_structure_timeline_v1.x.y-STABLE.html
```

---

## 16. Agent handoff summary

The agent receiving this document should treat:

**v1.4.7-STABLE as the authoritative baseline.**

The most important product-level facts are:

- It is a standalone browser-based Song Structure Timeline tool.
- Song Details consist of song metadata plus an ordered list of Song Sections.
- Each section has a name, color, and note.
- Sections can be moved up/down or deleted.
- Data persists in localStorage.
- JSON import/export is supported.
- PNG export is generated client-side with Canvas.
- Export typography for section names and notes is intentionally larger in 1.4.7.
- Reset clears the current work completely.
- Team Notes has been intentionally removed.
- Future changes should be incremental and should preserve the existing behavior unless the requested feature explicitly changes it.

