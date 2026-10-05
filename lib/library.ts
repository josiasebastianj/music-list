import { fromChordsAboveLyrics, guessKey, isChordProText, keyStep, parseBpm, parseChordPro, searchText, songMeta } from "./chordpro.ts";

export type Theme = { id: string; name: string };

export const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export type LibrarySong = {
  id: string;
  title: string;
  artist: string | null;
  song_key: string;
  rhythm: string | null;
  bpm: number | null;
  content: string;
  search_text: string;
  themes: Theme[];
  updated_at?: string; // from migration 006
};

export const byTitle = <T extends { title: string }>(a: T, b: T) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

export function songMetaLine(s: Pick<LibrarySong, "artist" | "song_key" | "rhythm" | "bpm">) {
  return [s.artist, s.song_key && `Key ${s.song_key}`, s.rhythm, s.bpm != null && `${s.bpm} BPM`].filter(Boolean).join(" · ");
}

export type Fields = { title: string; artist: string; key: string; rhythm: string; bpm: string; themeIds: string[] };

export function fieldsFrom(s: LibrarySong): Fields {
  return {
    title: s.title,
    artist: s.artist ?? "",
    key: s.song_key,
    rhythm: s.rhythm ?? "",
    bpm: s.bpm == null ? "" : String(s.bpm),
    themeIds: s.themes.map((t) => t.id),
  };
}

export function validateFields(f: Fields): string | null {
  if (!f.title.trim()) return "Add a title.";
  if (keyStep(f.key, 0) === null) return "Enter a key like G, Bb or F#m.";
  if (f.bpm.trim() && parseBpm(f.bpm) === null) return "BPM must be a whole number from 20 to 300.";
  if (f.rhythm.trim().length > 12) return "Rhythm is too long (12 characters max).";
  return null;
}

export function toSongRow(f: Fields, content: string) {
  const title = f.title.trim();
  return {
    title,
    artist: f.artist.trim() || null,
    song_key: f.key.trim(),
    rhythm: f.rhythm.trim() || null,
    bpm: parseBpm(f.bpm),
    content,
    search_text: searchText(title, content),
  };
}

export type Draft = {
  label: string;
  fields: Fields;
  keyConfirmed: boolean;
  content: string;
  sections: string[];
  unreadable: boolean;
  duplicate: boolean;
  confirmed: boolean; // the user checked the preview; only confirmed drafts are saved
  pasted?: boolean; // made from the paste box (Preview again replaces it until confirmed)
  result?: string;
};

export const SAVED = "Saved";

export const identity = (title: string, artist: string) => `${title.trim().toLowerCase()}\u0000${artist.trim().toLowerCase()}`;

// A pasted chord sheet or an uploaded file → a preview card. fallbackTitle: the file name ("" for pasted text).
export function draftFrom(label: string, raw: string, fallbackTitle: string): Draft {
  const text = raw.replace(/\r\n?/g, "\n");
  let content = isChordProText(text) ? text : fromChordsAboveLyrics(text, fallbackTitle);
  if (!parseChordPro(content).title.trim() && fallbackTitle) content = `{title: ${fallbackTitle}}\n${content}`;
  const parsed = parseChordPro(content);
  const meta = songMeta(content);
  return {
    label,
    fields: {
      title: parsed.title,
      artist: parsed.artist,
      key: parsed.key || guessKey(parsed) || "",
      rhythm: meta.rhythm || "4/4",
      bpm: meta.bpm === null ? "" : String(meta.bpm),
      themeIds: [],
    },
    keyConfirmed: parsed.key !== "",
    content,
    sections: parsed.sections.map((s) => s.label).filter(Boolean),
    unreadable: !parsed.sections.some((s) => s.lines.length > 0),
    duplicate: false,
    confirmed: false,
  };
}

export function draftStatus(d: Draft): { text: string; ok: boolean } {
  if (d.result) return { text: d.result, ok: d.result === SAVED };
  if (d.unreadable) return { text: "Couldn't read it", ok: false };
  if (d.duplicate) return { text: "Already in library", ok: false };
  if (!d.fields.title.trim()) return { text: "Needs a title", ok: false };
  if (!keyStep(d.fields.key, 0) || !d.keyConfirmed) return { text: "Needs a key", ok: false };
  const problem = validateFields(d.fields);
  if (problem) return { text: problem, ok: false };
  return d.confirmed ? { text: "Confirmed", ok: true } : { text: "Ready", ok: true };
}

// Ready = checked out fine but not confirmed yet; Confirmed = will be saved.
export const isReady = (d: Draft) => draftStatus(d).text === "Ready";
export const isConfirmed = (d: Draft) => draftStatus(d).text === "Confirmed";
