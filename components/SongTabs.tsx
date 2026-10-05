"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import SectionNotes from "./SectionNotes";
import { lyricLines, parseChordPro } from "@/lib/chordpro";
import type { Section, Song } from "@/lib/event";

type Tab = "lyrics" | "chords" | "notes";
type Props = {
  song: Song;
  content: string; // what to show: song.content, or a view-only transposition on share links
  readOnly: boolean;
  onContentChange: (content: string) => void;
  onSectionsChange: (sections: Section[]) => void;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "lyrics", label: "Lyrics Only" },
  { id: "chords", label: "Lyrics + Chords" },
  { id: "notes", label: "Section Notes" },
];
const TAB_KEY = "setlistApp_songTab";
const NBSP = " ";

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

export default function SongTabs({ song, content, readOnly, onContentChange, onSectionsChange }: Props) {
  const stored = useSyncExternalStore(subscribe, readTab, () => null);
  const [picked, setPicked] = useState<Tab | null>(null);
  const [editing, setEditing] = useState(false);
  const parsed = useMemo(() => parseChordPro(content), [content]);
  const hasLyrics = content.trim() !== "";
  const tab: Tab = picked ?? stored ?? (hasLyrics ? "chords" : "notes");

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
      No lyrics yet.{!readOnly && " Use Edit on the Lyrics + Chords tab to paste ChordPro, or add the song from the library."}
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
          {!readOnly && (
            <div className="lyrics-toolbar">
              <button className="btn compact" type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                {editing ? "Done editing" : "Edit"}
              </button>
            </div>
          )}
          {editing && !readOnly ? (
            <textarea className="chord-editor" value={content} onChange={(e) => onContentChange(e.target.value)} aria-label="Lyrics and chords (ChordPro)" spellCheck={false} />
          ) : hasLyrics ? (
            parsed.sections.map((s, i) => (
              <section key={i} className="lyrics-section">
                {s.label && <h3 className="lyrics-label">{s.label}</h3>}
                {s.lines.map((line, j) =>
                  line.type === "grid" ? (
                    <div key={j} className="chord-grid">{line.cells.join(" ")}</div>
                  ) : line.segments.some((g) => g.chord) ? (
                    <div key={j} className="chord-line">
                      {line.segments.map((g, k) => (
                        <span key={k} className="chord-seg">
                          <span className="chord">{g.chord ?? NBSP}</span>
                          <span className="chord-text">{g.text || NBSP}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p key={j} className="lyrics-line chord-plain">{line.segments.map((g) => g.text).join("")}</p>
                  ),
                )}
              </section>
            ))
          ) : (
            empty
          )}
        </>
      )}
    </div>
  );
}
