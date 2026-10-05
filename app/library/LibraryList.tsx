"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/lib/chordpro";
import { songMetaLine, type LibrarySong, type Theme } from "@/lib/library";

type Row = Omit<LibrarySong, "content">;

export default function LibraryList({ songs, themes }: { songs: Row[]; themes: Theme[] }) {
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState("");
  const shown = useMemo(() => {
    const q = normalizeSearch(query);
    return songs.filter(
      (s) =>
        (!themeId || s.themes.some((t) => t.id === themeId)) &&
        (!q || `${normalizeSearch(`${s.title} ${s.artist ?? ""}`)} ${s.search_text}`.includes(q)),
    );
  }, [songs, query, themeId]);

  if (songs.length === 0) {
    return (
      <div className="workspace-empty dash-empty">
        <div className="workspace-empty-inner">
          <div className="workspace-empty-title">No songs yet.</div>
          <div className="workspace-empty-copy">Use <strong>Add songs</strong> to paste a chord sheet or upload files.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lib-filters">
        <input className="team-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title, artist or lyrics" aria-label="Filter songs" />
        <select className="team-input lib-theme-filter" value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Filter by theme">
          <option value="">All themes</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      {shown.length === 0 ? (
        <p className="lyrics-empty">No songs match.</p>
      ) : (
        <ul className="dash-list">
          {shown.map((s) => (
            <li key={s.id} className="dash-item">
              <a href={`/library/${s.id}`} className="dash-link">
                <span className="dash-name">{s.title}</span>
                <span className="dash-meta">{songMetaLine(s)}</span>
                {s.themes.length > 0 && (
                  <span className="theme-chips">
                    {s.themes.map((t) => (
                      <span key={t.id} className="theme-chip">{t.name}</span>
                    ))}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
