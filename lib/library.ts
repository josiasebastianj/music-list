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
