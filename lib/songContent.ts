import { guessKey, parseChordPro, songMeta } from "./chordpro";
import type { Song } from "./event";

// Use pasted ChordPro as the song's lyrics and fill in only the fields the user left empty.
export function fillFromContent(song: Song, content: string): Song {
  const parsed = parseChordPro(content);
  const meta = songMeta(content);
  return {
    ...song,
    content,
    title: song.title.trim() ? song.title : parsed.title,
    baseKey: song.baseKey.trim() ? song.baseKey : parsed.key || guessKey(parsed) || "",
    rhythm: song.rhythm.trim() ? song.rhythm : meta.rhythm,
    bpm: song.bpm ?? meta.bpm,
  };
}
