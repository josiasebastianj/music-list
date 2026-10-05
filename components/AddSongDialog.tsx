"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { lyricLines, normalizeSearch, parseChordPro } from "@/lib/chordpro";
import { uid, type Song } from "@/lib/event";
import { sectionNotesFrom } from "@/lib/songContent";
import { createClient } from "@/lib/supabase/client";

type Result = { id: string; title: string; artist: string | null; song_key: string; rhythm?: string | null; bpm?: number | null; content: string };

function songFromLibrary(r: Result): Song {
  return {
    id: uid("song"),
    title: r.title,
    baseKey: r.song_key,
    rhythm: r.rhythm ?? "",
    bpm: r.bpm ?? null,
    content: r.content,
    librarySongId: r.id,
    sections: sectionNotesFrom(r.content),
  };
}

function snippet(content: string, query: string) {
  const nq = normalizeSearch(query);
  const lines = lyricLines(parseChordPro(content)).flatMap((s) => s.lines);
  return lines.find((l) => normalizeSearch(l).includes(nq)) ?? lines[0] ?? "";
}

function highlight(text: string, query: string): ReactNode {
  const words = normalizeSearch(query).split(" ").filter((w) => w.length >= 2);
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export default function AddSongDialog({ onAdd }: { onAdd: (song: Song) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searching = normalizeSearch(query).length >= 3;

  useEffect(() => {
    if (normalizeSearch(query).length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await createClient().rpc("search_songs", { q: normalizeSearch(query) });
      if (cancelled) return;
      setLoading(false);
      setError(error ? `Search failed: ${error.message}` : null);
      setResults(error ? [] : ((data ?? []) as Result[]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function close() {
    dialogRef.current?.close();
  }

  function pick(song: Song) {
    onAdd(song);
    close();
  }

  return (
    <>
      <button className="btn primary compact" type="button" onClick={() => dialogRef.current?.showModal()}>
        <Icon name="plus" />
        Add Song
      </button>
      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="addSongTitle"
        onClose={() => {
          setQuery("");
          setResults(null);
          setError(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="share-dialog-inner">
          <div className="share-dialog-title" id="addSongTitle">Add Song</div>
          <input
            className="team-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a line of the lyrics or the title"
            aria-label="Search songs"
          />
          {!searching && <p className="share-dialog-copy">Type at least 3 letters.</p>}
          {searching && error && <p className="share-dialog-hint">{error}</p>}
          {searching && !error && results === null && <p className="share-dialog-copy">Searching…</p>}
          {searching && results && results.length > 0 && (
            <ul className="song-results">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" className="song-result" onClick={() => pick(songFromLibrary(r))}>
                    <span className="song-result-title">{r.title}</span>
                    <span className="song-result-meta">{[r.artist, `Key ${r.song_key}`].filter(Boolean).join(" · ")}</span>
                    <span className="song-result-snippet">{highlight(snippet(r.content, query), query)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searching && results && results.length === 0 && !error && !loading && <p className="share-dialog-copy">No songs found.</p>}
          <div className="share-dialog-actions">
            <a className="btn" href="/library/upload">Upload songs</a>
            <button className="btn" type="button" onClick={() => pick({ id: uid("song"), title: "", baseKey: "", rhythm: "", bpm: null, content: "", sections: [] })}>
              Add blank song
            </button>
            <button className="btn" type="button" onClick={close}>Cancel</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
