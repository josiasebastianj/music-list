"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/lib/chordpro";
import { songMetaLine, type LibrarySong, type Theme } from "@/lib/library";

type Row = Omit<LibrarySong, "content">;

// One fixed zone, so the server (UTC on Vercel) and the browser render the same day.
const TIME_ZONE = "Asia/Jakarta";

function formatUpdated(iso?: string) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }) : "";
}

export default function LibraryList({ songs, themes }: { songs: Row[]; themes: Theme[] }) {
  const [query, setQuery] = useState("");
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const shown = useMemo(() => {
    const q = normalizeSearch(query);
    return songs.filter(
      (s) =>
        (!themeIds.length || s.themes.some((t) => themeIds.includes(t.id))) &&
        (!q || `${normalizeSearch(`${s.title} ${s.artist ?? ""}`)} ${s.search_text}`.includes(q)),
    );
  }, [songs, query, themeIds]);

  const toggle = (id: string) => setThemeIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

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
      </div>
      {themes.length > 0 && (
        <fieldset className="theme-chips lib-theme-chips">
          <legend className="sr-only">Show songs with these themes</legend>
          {themes.map((t) => (
            <label key={t.id} className={`theme-chip toggle${themeIds.includes(t.id) ? " on" : ""}`}>
              <input type="checkbox" className="sr-only" checked={themeIds.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          ))}
          {themeIds.length > 0 && (
            <button className="btn compact" type="button" onClick={() => setThemeIds([])}>Clear</button>
          )}
        </fieldset>
      )}
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
              {s.updated_at && (
                <span className="dash-meta lib-updated">
                  Updated {formatUpdated(s.updated_at)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
