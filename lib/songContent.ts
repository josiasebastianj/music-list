import { guessKey, parseChordPro, sectionLabels, songMeta } from "./chordpro";
import { colors, uid, type Section, type Song } from "./event";

// One empty Section Note per section heading in the ChordPro text, in order.
export function sectionNotesFrom(content: string): Section[] {
  return sectionLabels(content).map((name, i) => ({ id: uid("section"), name, color: colors[i % colors.length], note: "" }));
}

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
    sections: song.sections.length ? song.sections : sectionNotesFrom(content),
  };
}
