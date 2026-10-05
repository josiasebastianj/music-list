"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AddSongDialog from "./AddSongDialog";
import AppShell from "./AppShell";
import Icon from "./Icon";
import KeyControl from "./KeyControl";
import SongTabs from "./SongTabs";
import TeamDialog from "./TeamDialog";
import ThemeToggle from "./ThemeToggle";
import { keyStep, transpose } from "@/lib/chordpro";
import type { SetlistEvent, Song } from "@/lib/event";
import { exportSongImage } from "@/lib/exportPng";
import { createClient } from "@/lib/supabase/client";

type Props = { initial: SetlistEvent; eventId?: string; shareToken?: string | null; readOnly?: boolean };

const songNumber = (i: number) => String(i + 1).padStart(2, "0");

function swap<T>(items: T[], i: number, j: number) {
  if (j < 0 || j >= items.length) return items;
  const copy = [...items];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export default function EventEditor({ initial, eventId, shareToken = null, readOnly = false }: Props) {
  const [event, setEvent] = useState(initial);
  const [activeSongId, setActiveSongId] = useState<string | null>(initial.songs[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [viewKeys, setViewKeys] = useState<Record<string, string>>({}); // share links: per-song display key, never saved
  const focusId = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revision = useRef(0);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
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
  const displayKey = song ? (viewKeys[song.id] ?? song.baseKey) : "";
  const displayContent = song && readOnly && displayKey !== song.baseKey ? transpose(song.content, song.baseKey, displayKey) : (song?.content ?? "");

  function update(next: SetlistEvent) {
    revision.current++;
    setEvent(next);
    setDirty(true);
  }
  function updateSong(id: string, fn: (s: Song) => Song) {
    update({ ...event, songs: event.songs.map((s) => (s.id === id ? fn(s) : s)) });
  }

  function addSong(s: Song) {
    update({ ...event, songs: [...event.songs, s] });
    setActiveSongId(s.id);
    if (!s.title) focusId.current = s.id;
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
  function stepKey(steps: number) {
    if (!song) return;
    const next = keyStep(song.baseKey, steps);
    if (next) updateSong(song.id, (s) => ({ ...s, baseKey: next, content: transpose(s.content, s.baseKey, next) }));
  }
  function stepView(steps: number) {
    if (!song) return;
    const next = keyStep(displayKey, steps);
    if (next) setViewKeys({ ...viewKeys, [song.id]: next });
  }
  function resetView() {
    if (song) setViewKeys(Object.fromEntries(Object.entries(viewKeys).filter(([id]) => id !== song.id)));
  }
  function exportPng() {
    if (song) exportSongImage(event, song, document.documentElement.dataset.theme === "dark");
  }

  async function save() {
    if (!eventId) return;
    const savedRevision = revision.current;
    setSaving("saving");
    const { error } = await createClient()
      .from("events")
      .update({ event_name: event.eventName.trim() || null, event_date: event.eventDate || null, data: { songs: event.songs }, members: event.members, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .select("id")
      .single();
    if (error) {
      setSaving("idle");
      setError(
        error.code === "PGRST116"
          ? "You're signed out, or this event isn't yours. Log in again in another tab, then press Save — your changes are still here."
          : `Could not save event: ${error.message}`,
      );
      return;
    }
    setError(null);
    if (revision.current === savedRevision) setDirty(false);
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
      <Link
        className="btn"
        href="/dashboard"
        aria-label="Dashboard"
        onClick={(e) => {
          if (dirty && !confirm("Leave without saving your changes?")) e.preventDefault();
        }}
      >
        ←<span className="btn-label"> Dashboard</span>
      </Link>
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
            <TeamDialog members={event.members} readOnly={readOnly} onChange={(members) => update({ ...event, members })} />
          </div>
          <nav className="song-nav" aria-label="Songs">
            <div className="nav-heading">
              <div className="nav-heading-title">SONGS</div>
              {!readOnly && <AddSongDialog onAdd={addSong} />}
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
                      <KeyControl value={displayKey} readOnly onStep={stepView} onReset={displayKey !== song.baseKey ? resetView : undefined} />
                    ) : (
                      <>
                        <KeyControl value={song.baseKey} readOnly={false} onStep={stepKey} onType={(v) => updateSong(song.id, (s) => ({ ...s, baseKey: v }))} />
                        <button className="icon-btn" type="button" title="Move song up" aria-label="Move song up" disabled={index === 0} onClick={() => moveSong(-1)}><Icon name="up" /></button>
                        <button className="icon-btn" type="button" title="Move song down" aria-label="Move song down" disabled={index === event.songs.length - 1} onClick={() => moveSong(1)}><Icon name="down" /></button>
                        <button className="icon-btn danger" type="button" title="Delete song" aria-label="Delete song" onClick={deleteSong}><Icon name="trash" /></button>
                      </>
                    )}
                    <button className="export-btn" type="button" onClick={exportPng}><Icon name="image" />Export PNG</button>
                  </div>
                </div>
              </div>

              <SongTabs
                song={song}
                content={displayContent}
                readOnly={readOnly}
                onContentChange={(content) => updateSong(song.id, (s) => ({ ...s, content }))}
                onSectionsChange={(sections) => updateSong(song.id, (s) => ({ ...s, sections }))}
                onSongChange={(next) => updateSong(song.id, () => next)}
              />

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
