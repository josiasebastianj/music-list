import { keyStep, parseBpm, searchText } from "./chordpro.ts";

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
