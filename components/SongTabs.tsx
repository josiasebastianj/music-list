"use client";

import { useMemo, useState, useSyncExternalStore, type ClipboardEvent } from "react";
import SectionNotes from "./SectionNotes";
import ChordSheet from "./ChordSheet";
import { convertPastedChords, lyricLines, parseChordPro } from "@/lib/chordpro";
import type { Section, Song } from "@/lib/event";
import { fillFromContent } from "@/lib/songContent";

type Tab = "lyrics" | "chords" | "notes";
type Props = {
  song: Song;
  content: string; // what to show: song.content, or a view-only transposition on share links
  readOnly: boolean;
  onContentChange: (content: string) => void;
  onSectionsChange: (sections: Section[]) => void;
  onSongChange: (song: Song) => void; // a converted paste may also fill in title, key and Section Notes
};

const TABS: { id: Tab; label: string }[] = [
  { id: "lyrics", label: "Lyrics Only" },
  { id: "chords", label: "Lyrics + Chords" },
  { id: "notes", label: "Section Notes" },
];
const TAB_KEY = "setlistApp_songTab";

function readTab(): Tab | null {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return v === "lyrics" || v === "chords" || v === "notes" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export default function SongTabs({ song, content, readOnly, onContentChange, onSectionsChange, onSongChange }: Props) {
  const stored = useSyncExternalStore(subscribe, readTab, () => null);
  const [picked, setPicked] = useState<Tab | null>(null);
  const [editing, setEditing] = useState(false);
  // after a converted paste: the song as it was, plus the content a plain paste would have given
  const [undo, setUndo] = useState<{ before: Song; raw: string } | null>(null);
  const parsed = useMemo(() => parseChordPro(content), [content]);
  const hasLyrics = content.trim() !== "";
  const tab: Tab = picked ?? (hasLyrics ? (stored ?? "chords") : "notes");
  const showEditor = !readOnly && (editing || !hasLyrics); // empty songs open straight into the editor
  const showUndo = undo !== null && undo.before.id === song.id;

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text/plain");
    const intoEmpty = content.trim() === "";
    const converted = convertPastedChords(pasted, intoEmpty);
    if (converted === null) return; // ChordPro or plain lyrics: let the browser paste it as is
    e.preventDefault();
    const { selectionStart: start, selectionEnd: end } = e.currentTarget;
    const raw = content.slice(0, start) + pasted + content.slice(end);
    setUndo({ before: song, raw });
    setEditing(false); // show the converted result
    if (intoEmpty) onSongChange(fillFromContent(song, converted));
    else onContentChange(content.slice(0, start) + converted + content.slice(end));
  }

  function undoPaste() {
    if (!undo) return;
    onSongChange({ ...undo.before, content: undo.raw });
    setUndo(null);
    setEditing(true);
  }

  function choose(t: Tab) {
    setPicked(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // storage blocked (private mode): the choice lasts for this page only
    }
  }

  const empty = (
    <p className="lyrics-empty">
      No lyrics yet.{!readOnly && " Open the Lyrics + Chords tab to paste a chord sheet, or add the song from the library."}
    </p>
  );

  return (
    <div className="main-content">
      <div className="song-tabs" role="tablist" aria-label="Song views">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`song-tab${tab === t.id ? " active" : ""}`} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notes" && <SectionNotes sections={song.sections} readOnly={readOnly} onChange={onSectionsChange} />}

      {tab === "lyrics" &&
        (hasLyrics
          ? lyricLines(parsed).map((s, i) => (
              <section key={i} className="lyrics-section">
                {s.label && <h3 className="lyrics-label">{s.label}</h3>}
                {s.lines.map((line, j) => (
                  <p key={j} className="lyrics-line">{line}</p>
                ))}
              </section>
            ))
          : empty)}

      {tab === "chords" && (
        <>
          {!readOnly && (showUndo || hasLyrics) && (
            <div className="lyrics-toolbar">
              {showUndo && (
                <p className="paste-note" role="status">
                  Converted to ChordPro.{" "}
                  <button className="link-btn" type="button" onClick={undoPaste}>Undo</button>
                </p>
              )}
              {hasLyrics && (
                <button className="btn compact" type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                  {editing ? "Done editing" : "Edit"}
                </button>
              )}
            </div>
          )}
          {showEditor ? (
            <textarea
              className="chord-editor"
              value={content}
              onChange={(e) => {
                setEditing(true); // keep the editor open once typing starts in an empty song
                setUndo(null);
                onContentChange(e.target.value);
              }}
              onPaste={onPaste}
              placeholder="Paste a chord sheet from the web or ChordPro text here."
              aria-label="Lyrics and chords (ChordPro)"
              spellCheck={false}
            />
          ) : hasLyrics ? (
            <ChordSheet parsed={parsed} />
          ) : (
            empty
          )}
        </>
      )}
    </div>
  );
}
