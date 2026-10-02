"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppShell from "./AppShell";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { colors, safeColor, uid, type Section, type SetlistEvent, type Song } from "@/lib/event";
import { exportSongImage } from "@/lib/exportPng";
import { createClient } from "@/lib/supabase/client";

type Props = { initial: SetlistEvent; eventId?: string; shareToken?: string | null; readOnly?: boolean };

const songNumber = (i: number) => String(i + 1).padStart(2, "0");
const tagColor = (color: string) => ({ "--tag-color": safeColor(color) }) as CSSProperties;

export default function EventEditor({ initial, eventId, shareToken = null, readOnly = false }: Props) {
  const [event, setEvent] = useState(initial);
  const [activeSongId, setActiveSongId] = useState<string | null>(initial.songs[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const focusId = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (fallbackUrl) dialogRef.current?.showModal();
  }, [fallbackUrl]);

  useEffect(() => {
    // phone layout: keep the active song chip visible in the horizontal strip (v2.4.0)
    document.querySelector(".song-nav-item.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSongId]);

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    const el = document.querySelector<HTMLInputElement>(`[data-focus="${CSS.escape(id)}"]`);
    el?.focus();
    el?.select();
  });

  const song = event.songs.find((s) => s.id === activeSongId) ?? event.songs[0] ?? null;
  const index = song ? event.songs.indexOf(song) : -1;

  function update(next: SetlistEvent) {
    setEvent(next);
    setDirty(true);
  }
  function updateSong(id: string, fn: (s: Song) => Song) {
    update({ ...event, songs: event.songs.map((s) => (s.id === id ? fn(s) : s)) });
  }
  function updateSections(fn: (sections: Section[]) => Section[]) {
    if (song) updateSong(song.id, (s) => ({ ...s, sections: fn(s.sections) }));
  }
  function swap<T>(items: T[], i: number, j: number) {
    if (j < 0 || j >= items.length) return items;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }

  function addSong() {
    const s: Song = { id: uid("song"), title: "", baseKey: "", sections: [] };
    update({ ...event, songs: [...event.songs, s] });
    setActiveSongId(s.id);
    focusId.current = s.id;
  }
  function deleteSong() {
    if (!song) return;
    if (!confirm(`Delete "${song.title.trim() || `Song ${index + 1}`}" and all of its song details?`)) return;
    const songs = event.songs.filter((s) => s.id !== song.id);
    update({ ...event, songs });
    setActiveSongId((songs[index] ?? songs[index - 1])?.id ?? null);
  }
  function moveSong(direction: number) {
    update({ ...event, songs: swap(event.songs, index, index + direction) });
  }
  function addDetail() {
    if (!song) return;
    const section: Section = { id: uid("section"), name: "", color: colors[song.sections.length % colors.length], note: "" };
    updateSections((sections) => [...sections, section]);
    focusId.current = section.id;
  }
  function setSection(i: number, patch: Partial<Section>) {
    updateSections((sections) => sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function deleteDetail(i: number) {
    if (!song) return;
    if (!confirm(`Delete "${song.sections[i].name.trim() || "this song detail"}"?`)) return;
    updateSections((sections) => sections.filter((_, j) => j !== i));
  }
  function cycleColor(i: number) {
    if (!song) return;
    const current = safeColor(song.sections[i].color).toLowerCase();
    setSection(i, { color: colors[(colors.findIndex((c) => c.toLowerCase() === current) + 1) % colors.length] });
  }
  function exportPng() {
    if (song) exportSongImage(event, song, document.documentElement.dataset.theme === "dark");
  }

  async function save() {
    if (!eventId) return;
    setSaving("saving");
    const { error } = await createClient()
      .from("events")
      .update({ event_name: event.eventName.trim() || null, event_date: event.eventDate || null, data: { songs: event.songs }, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .select("id")
      .single();
    if (error) {
      setSaving("idle");
      setError(`Could not save event: ${error.message}`);
      return;
    }
    setError(null);
    setDirty(false);
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1800);
  }

  async function share() {
    if (!shareToken) return;
    const url = `${location.origin}/share/${encodeURIComponent(shareToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Share link copied to clipboard");
    } catch {
      setFallbackUrl(url);
    }
  }

  const actions = readOnly ? (
    <ThemeToggle />
  ) : (
    <>
      <button className="btn primary" type="button" onClick={save} disabled={saving === "saving"}>
        {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : "Save"}
      </button>
      <button className="btn" type="button" onClick={share} disabled={!shareToken} title="Copy a read-only link to this event">
        Share
      </button>
      <ThemeToggle />
    </>
  );

  return (
    <AppShell actions={actions} className={readOnly ? "view-only" : ""}>
      {readOnly && (
        <div className="share-banner" role="status">
          <span>Viewing a shared setlist · read-only</span>
          <Link href="/">Open my setlist</Link>
        </div>
      )}
      {error && (
        <div className="share-banner error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <div className="event-block">
            <div className="eyebrow">EVENT</div>
            <input
              className="event-name"
              value={event.eventName}
              onChange={(e) => update({ ...event, eventName: e.target.value })}
              readOnly={readOnly}
              aria-label="Event name"
              placeholder={readOnly ? "Untitled Event" : "Event Name"}
            />
            {!(readOnly && !event.eventDate) && (
              <input
                className="event-date"
                type="date"
                value={event.eventDate}
                onChange={(e) => update({ ...event, eventDate: e.target.value })}
                readOnly={readOnly}
                aria-label="Event date"
              />
            )}
          </div>
          <nav className="song-nav" aria-label="Songs">
            <div className="nav-heading">
              <div className="nav-heading-title">SONGS</div>
              {!readOnly && (
                <button className="btn primary compact" type="button" onClick={addSong}>
                  <Icon name="plus" />
                  Add Song
                </button>
              )}
            </div>
            <div className="song-list">
              {event.songs.length === 0 ? (
                <div className="empty-nav">
                  {readOnly ? "This shared event has no songs." : <>No songs yet.<br />Use <strong>+ Add Song</strong> to start.</>}
                </div>
              ) : (
                event.songs.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`song-nav-item${s.id === song?.id ? " active" : ""}`}
                    aria-current={s.id === song?.id}
                    onClick={() => setActiveSongId(s.id)}
                  >
                    <span className="song-nav-number">{songNumber(i)}</span>
                    <span className="song-nav-title">{s.title.trim() || "Untitled Song"}</span>
                    <span className="song-nav-key">{s.baseKey.trim() || "—"}</span>
                    <span className="song-nav-arrow"><Icon name="next" /></span>
                  </button>
                ))
              )}
            </div>
          </nav>
          <div className="sidebar-footer">
            <div>
              {event.songs.length} {event.songs.length === 1 ? "song" : "songs"}
            </div>
          </div>
        </aside>

        <main className="main">
          {!song ? (
            <div className="workspace-empty">
              <div className="workspace-empty-inner">
                <div className="workspace-empty-title">{readOnly ? "No songs in this setlist." : "Your setlist starts here."}</div>
                <div className="workspace-empty-copy">
                  {readOnly ? "The person who shared this event hasn't added any songs yet." : "Add a song from the sidebar to create your first Song Workspace."}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="main-header">
                <div className="main-heading">
                  {readOnly ? (
                    <h1 className="view-title">{song.title.trim() || "Untitled Song"}</h1>
                  ) : (
                    <input
                      className="song-title"
                      data-focus={song.id}
                      value={song.title}
                      onChange={(e) => updateSong(song.id, (s) => ({ ...s, title: e.target.value }))}
                      placeholder="Song Title"
                      aria-label="Song title"
                    />
                  )}
                  <div className="header-song-actions">
                    {readOnly ? (
                      <div className="key-badge" title="Base key" aria-label={`Base key ${song.baseKey.trim() || "not set"}`}>
                        <span aria-hidden="true">Key</span>
                        <strong aria-hidden="true">{song.baseKey.trim() || "—"}</strong>
                      </div>
                    ) : (
                      <>
                        <label className="key-field">
                          <span>Key</span>
                          <input
                            className="key-input"
                            value={song.baseKey}
                            onChange={(e) => updateSong(song.id, (s) => ({ ...s, baseKey: e.target.value }))}
                            placeholder="—"
                            aria-label="Base key"
                          />
                        </label>
                        <button className="icon-btn" type="button" title="Move song up" aria-label="Move song up" disabled={index === 0} onClick={() => moveSong(-1)}><Icon name="up" /></button>
                        <button className="icon-btn" type="button" title="Move song down" aria-label="Move song down" disabled={index === event.songs.length - 1} onClick={() => moveSong(1)}><Icon name="down" /></button>
                        <button className="icon-btn danger" type="button" title="Delete song" aria-label="Delete song" onClick={deleteSong}><Icon name="trash" /></button>
                      </>
                    )}
                    <button className="export-btn" type="button" onClick={exportPng}><Icon name="image" />Export PNG</button>
                  </div>
                </div>
              </div>

              <div className="main-content">
                <div className="section-label">SONG DETAILS</div>
                <div className="details">
                  {song.sections.length === 0 ? (
                    <div className="empty-detail">{readOnly ? "This song has no details yet." : "No song details yet. Add a section to start building this song."}</div>
                  ) : (
                    song.sections.map((section, i) =>
                      readOnly ? (
                        <div className="detail-row" key={section.id} style={tagColor(section.color)}>
                          <div className="detail-name-wrap">
                            <span className="color-dot static" style={tagColor(section.color)} aria-hidden="true" />
                            <div className="view-detail-name">{section.name.trim() || "Untitled"}</div>
                          </div>
                          <div className="view-detail-note">{section.note}</div>
                        </div>
                      ) : (
                        <div className="detail-row" key={section.id} style={tagColor(section.color)}>
                          <div className="detail-name-wrap">
                            <button className="color-dot" type="button" style={tagColor(section.color)} title="Change section color" aria-label="Change section color" onClick={() => cycleColor(i)} />
                            <input
                              className="detail-name-input"
                              data-focus={section.id}
                              value={section.name}
                              onChange={(e) => setSection(i, { name: e.target.value })}
                              aria-label="Song detail name"
                              placeholder="Song detail name"
                            />
                          </div>
                          <textarea
                            className="detail-note"
                            rows={1}
                            value={section.note}
                            onChange={(e) => setSection(i, { note: e.target.value })}
                            aria-label={`Notes for ${section.name || "song detail"}`}
                            placeholder="Add notes..."
                          />
                          <div className="detail-tools">
                            <button className="icon-btn" type="button" title="Move up" aria-label="Move song detail up" disabled={i === 0} onClick={() => updateSections((s) => swap(s, i, i - 1))}><Icon name="up" /></button>
                            <button className="icon-btn" type="button" title="Move down" aria-label="Move song detail down" disabled={i === song.sections.length - 1} onClick={() => updateSections((s) => swap(s, i, i + 1))}><Icon name="down" /></button>
                            <button className="icon-btn danger" type="button" title="Delete song detail" aria-label="Delete song detail" onClick={() => deleteDetail(i)}><Icon name="trash" /></button>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
                {!readOnly && (
                  <button className="btn add-detail" type="button" onClick={addDetail}><Icon name="plus" />Add Song Detail</button>
                )}
              </div>

              <div className="main-bottom">
                <div className="song-position">Song {songNumber(index)} of {event.songs.length}</div>
                {!readOnly && <button className="export-btn" type="button" onClick={exportPng}><Icon name="image" />Export PNG</button>}
              </div>
            </>
          )}
        </main>
      </div>

      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="shareDialogTitle"
        onClose={() => setFallbackUrl(null)}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <form method="dialog" className="share-dialog-inner">
          <div className="share-dialog-title" id="shareDialogTitle">Share link</div>
          <p className="share-dialog-hint">Couldn&apos;t access the clipboard. Copy the link below with Ctrl+C (or ⌘C).</p>
          <input className="share-dialog-url" type="text" readOnly value={fallbackUrl ?? ""} aria-label="Shareable link" onFocus={(e) => e.currentTarget.select()} autoFocus />
          <div className="share-dialog-actions">
            <button className="btn" type="submit">Close</button>
          </div>
        </form>
      </dialog>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </AppShell>
  );
}
