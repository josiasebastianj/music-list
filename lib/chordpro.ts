// ChordPro helpers: parse, convert plain "chords above lyrics" sheets, transpose, build search text.
// No imports, so `node --test` can load this file directly.

export type Segment = { chord?: string; text: string };
export type ChordLine = { type: "lyrics"; segments: Segment[] } | { type: "grid"; cells: string[] };
export type ParsedSection = { label: string; kind: "lyrics" | "grid"; lines: ChordLine[] };
export type ParsedSong = { title: string; artist: string; key: string; sections: ParsedSection[] };

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX: Record<string, number> = { Cb: 11, Fb: 4, "E#": 5, "B#": 0 };
SHARPS.forEach((n, i) => (NOTE_INDEX[n] = i));
FLATS.forEach((n, i) => (NOTE_INDEX[n] = i));
const FLAT_MAJOR = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);
const FLAT_MINOR = new Set(["Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

const CHORD_RE = /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|[0-9]|[#b+°ø()-])*)(?:\/([A-G](?:#|b)?))?$/;
const DIRECTIVE_RE = /^\{\s*([A-Za-z_]+)\s*(?::\s*(.*?))?\s*\}$/;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function isChord(token: string) {
  return CHORD_RE.test(token);
}

function parseKey(key: string): { root: number; minor: boolean } | null {
  const m = /^([A-G](?:#|b)?)(m)?$/.exec(key.trim());
  if (!m || NOTE_INDEX[m[1]] === undefined) return null;
  return { root: NOTE_INDEX[m[1]], minor: !!m[2] };
}

function usesFlats(root: number, minor: boolean) {
  return minor ? FLAT_MINOR.has(FLATS[root] + "m") : FLAT_MAJOR.has(FLATS[root]);
}

export function keyStep(key: string, steps: number): string | null {
  const k = parseKey(key);
  if (!k) return null;
  const root = mod12(k.root + steps);
  return (usesFlats(root, k.minor) ? FLATS : SHARPS)[root] + (k.minor ? "m" : "");
}

function transposeChord(token: string, steps: number, flats: boolean) {
  const m = CHORD_RE.exec(token);
  if (!m) return token;
  const names = flats ? FLATS : SHARPS;
  const shift = (note: string) => names[mod12(NOTE_INDEX[note] + steps)];
  return shift(m[1]) + m[2] + (m[3] ? "/" + shift(m[3]) : "");
}

export function transpose(text: string, from: string, to: string): string {
  const f = parseKey(from);
  const t = parseKey(to);
  if (!f || !t || from.trim() === to.trim()) return text;
  const steps = t.root - f.root;
  const flats = usesFlats(t.root, t.minor);
  let inGrid = false;
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const d = DIRECTIVE_RE.exec(trimmed);
      if (d) {
        const name = d[1].toLowerCase();
        if (name === "key") return `{key: ${to.trim()}}`;
        if (name === "start_of_grid" || name === "sog") inGrid = true;
        if (name === "end_of_grid" || name === "eog") inGrid = false;
        return line;
      }
      if (inGrid || trimmed.startsWith("|")) return line.replace(/\S+/g, (tok) => transposeChord(tok, steps, flats));
      return line.replace(/\[([^\]]+)\]/g, (whole, chord: string) => (isChord(chord) ? `[${transposeChord(chord, steps, flats)}]` : whole));
    })
    .join("\n");
}

const SECTION_STARTS: Record<string, { kind: "lyrics" | "grid"; label: string }> = {
  start_of_verse: { kind: "lyrics", label: "Verse" },
  sov: { kind: "lyrics", label: "Verse" },
  start_of_chorus: { kind: "lyrics", label: "Chorus" },
  soc: { kind: "lyrics", label: "Chorus" },
  start_of_bridge: { kind: "lyrics", label: "Bridge" },
  sob: { kind: "lyrics", label: "Bridge" },
  start_of_grid: { kind: "grid", label: "" },
  sog: { kind: "grid", label: "" },
};
const SECTION_ENDS = new Set(["end_of_verse", "eov", "end_of_chorus", "eoc", "end_of_bridge", "eob", "end_of_grid", "eog"]);
const HEADING_DIRECTIVES = new Set(["comment", "c", "comment_italic", "ci"]);

function parseSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  const add = (text: string) => {
    if (segments.length) segments[segments.length - 1].text += text;
    else if (text) segments.push({ text });
  };
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    add(line.slice(last, m.index));
    if (isChord(m[1])) segments.push({ chord: m[1], text: "" });
    else add(m[0]);
    last = m.index + m[0].length;
  }
  add(line.slice(last));
  return segments;
}

export function parseChordPro(text: string): ParsedSong {
  const song: ParsedSong = { title: "", artist: "", key: "", sections: [] };
  const open = (label: string, kind: "lyrics" | "grid"): ParsedSection => {
    const section: ParsedSection = { label, kind, lines: [] };
    song.sections.push(section);
    return section;
  };
  let current: ParsedSection | null = null;
  let explicit = false; // opened by start_of_*: blank lines don't split it
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = raw.trim();
    const d = DIRECTIVE_RE.exec(trimmed);
    if (d) {
      const name = d[1].toLowerCase();
      const value = (d[2] ?? "").trim();
      if (name === "title" || name === "t") song.title = value;
      else if (name === "artist") song.artist = value;
      else if (name === "key") song.key = value;
      else if (SECTION_STARTS[name]) {
        current = open(value || SECTION_STARTS[name].label, SECTION_STARTS[name].kind);
        explicit = true;
      } else if (SECTION_ENDS.has(name)) {
        current = null;
        explicit = false;
      } else if (HEADING_DIRECTIVES.has(name) && value) {
        current = open(value, "lyrics");
        explicit = false;
      }
      continue;
    }
    if (!trimmed) {
      if (current && !explicit && !current.label && current.lines.length) current = null;
      continue;
    }
    if (!current) {
      current = open("", "lyrics");
      explicit = false;
    }
    if (current.kind === "grid" || trimmed.startsWith("|")) current.lines.push({ type: "grid", cells: trimmed.split(/\s+/) });
    else current.lines.push({ type: "lyrics", segments: parseSegments(trimmed) });
  }
  return song;
}

export function lyricLines(song: ParsedSong): { label: string; lines: string[] }[] {
  return song.sections
    .map((s) => ({
      label: s.label,
      lines: s.lines
        .flatMap((l) => (l.type === "lyrics" ? [l.segments.map((g) => g.text).join("").replace(/\s+/g, " ").trim()] : []))
        .filter(Boolean),
    }))
    .filter((s) => s.lines.length > 0);
}

export function sectionLabels(text: string): string[] {
  return parseChordPro(text).sections.map((s) => s.label).filter(Boolean);
}

export function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchText(title: string, text: string) {
  return normalizeSearch([title, ...lyricLines(parseChordPro(text)).flatMap((s) => s.lines)].join(" "));
}

export function isChordProText(text: string) {
  if (text.split(/\r?\n/).some((l) => DIRECTIVE_RE.test(l.trim()))) return true;
  for (const m of text.matchAll(/\[([^\]\s]+)\]/g)) if (isChord(m[1])) return true;
  return false;
}

export function guessKey(song: ParsedSong): string | null {
  for (const s of song.sections) {
    for (const l of s.lines) {
      const chords = l.type === "lyrics" ? l.segments.flatMap((g) => (g.chord ? [g.chord] : [])) : l.cells.filter(isChord);
      if (chords.length) {
        const m = CHORD_RE.exec(chords[0])!;
        return m[1] + (/^m(?!aj)/.test(m[2]) ? "m" : "");
      }
    }
  }
  return null;
}

const HEADING_RE = /^(intro|verse|pre-?chorus|chorus|bridge|interlude|instrumental|outro|tag|ending|refrain|reff?)(\s*\d+)?\.?$/i;
const KEY_LINE_RE = /^key\s*[:=]\s*([A-G](?:#|b)?m?)\s*$/i;
const MARKER_RE = /^(\|+|\.|-|\/|\(?x\d+\)?)$/i;

function expandTabs(line: string) {
  let out = "";
  for (const ch of line) out += ch === "\t" ? " ".repeat(8 - (out.length % 8)) : ch;
  return out;
}

function headingLabel(trimmed: string): string | null {
  const inner = trimmed.replace(/^[[(](.*)[\])]$/, "$1").trim();
  if (HEADING_RE.test(inner)) return inner.replace(/\.$/, "");
  if (inner.endsWith(":") && inner.length <= 40 && !inner.slice(0, -1).includes(":")) return inner.slice(0, -1).trim();
  return null;
}

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.some(isChord) && tokens.every((t) => isChord(t) || MARKER_RE.test(t));
}

function mergeChords(chordLine: string, lyricLine: string) {
  let lyric = lyricLine;
  const marks = [...chordLine.matchAll(/\S+/g)].filter((m) => isChord(m[0]));
  for (const m of marks.reverse()) {
    const col = m.index!;
    if (lyric.length < col) lyric = lyric.padEnd(col);
    lyric = lyric.slice(0, col) + `[${m[0]}]` + lyric.slice(col);
  }
  return lyric.trimEnd();
}

function gridLine(trimmed: string) {
  return trimmed.includes("|") ? trimmed.replace(/\s+/g, " ") : `| ${trimmed.split(/\s+/).join(" ")} |`;
}

export function fromChordsAboveLyrics(text: string, fallbackTitle: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => expandTabs(l).trimEnd());
  const used = new Set<number>();
  let key = "";
  lines.forEach((l, i) => {
    const m = KEY_LINE_RE.exec(l.trim());
    if (m && !key) {
      key = m[1];
      used.add(i);
    }
  });
  let title = fallbackTitle;
  const first = lines.findIndex((l, i) => !used.has(i) && l.trim() !== "");
  if (first >= 0 && !isChordLine(lines[first]) && headingLabel(lines[first].trim()) === null) {
    title = lines[first].trim();
    used.add(first);
  }
  const out = [`{title: ${title}}`];
  if (key) out.push(`{key: ${key}}`);
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    const label = headingLabel(trimmed);
    if (label !== null) {
      out.push(`{comment: ${label}}`);
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (!trimmed.includes("|") && next !== undefined && !used.has(i + 1) && next.trim() && !isChordLine(next) && headingLabel(next.trim()) === null) {
        out.push(mergeChords(line, next));
        i++;
        continue;
      }
      out.push(gridLine(trimmed));
      continue;
    }
    out.push(trimmed);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
