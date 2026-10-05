"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type DragEvent } from "react";
import ChordSheet from "@/components/ChordSheet";
import Icon from "@/components/Icon";
import SongFields from "@/components/SongFields";
import { keyStep, parseChordPro } from "@/lib/chordpro";
import { migrationHint } from "@/lib/event";
import { SAVED, draftFrom, draftStatus, identity, isReady, toSongRow, type Draft, type Fields, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = ".cho,.chopro,.pro,.chordpro,.txt";

export default function AddSongs({ themes }: { themes: Theme[] }) {
  const [mode, setMode] = useState<"paste" | "files">("paste");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addDrafts(read: Draft[]) {
    if (!read.length) return;
    setMessage(null);
    const titles = [...new Set(read.map((d) => d.fields.title.trim()).filter(Boolean))];
    let existing: { title: string; artist: string | null }[] = [];
    if (titles.length) {
      const { data, error } = await createClient().from("songs").select("title,artist").in("title", titles);
      if (error) setMessage(`Couldn't check the library for duplicates: ${migrationHint(error.message)}. Duplicates will be skipped when saving.`);
      else existing = data ?? [];
    }
    setDrafts((current) => {
      const seen = new Set([...existing.map((s) => identity(s.title, s.artist ?? "")), ...current.map((d) => identity(d.fields.title, d.fields.artist))]);
      const marked = read.map((d) => {
        const id = identity(d.fields.title, d.fields.artist);
        const duplicate = !d.unreadable && seen.has(id);
        if (!d.unreadable) seen.add(id);
        return { ...d, duplicate };
      });
      return [...current, ...marked];
    });
  }

  async function onFiles(files: File[]) {
    const read = await Promise.all(files.map(async (f) => draftFrom(f.name, await f.text(), f.name.replace(/\.[^.]+$/, ""))));
    await addDrafts(read);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    void onFiles([...(e.target.files ?? [])]);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    if (!busy) void onFiles([...e.dataTransfer.files]);
  }

  async function onPreview() {
    if (!pasted.trim()) return;
    await addDrafts([draftFrom("Pasted text", pasted, "")]);
    setPasted("");
  }

  const edit = (i: number, patch: Partial<Draft>) => setDrafts((current) => current.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const editFields = (i: number, patch: Partial<Fields>) =>
    setDrafts((current) =>
      current.map((d, j) =>
        j === i
          ? {
              ...d,
              fields: { ...d.fields, ...patch },
              ...("title" in patch || "artist" in patch ? { duplicate: false } : {}),
              ...("key" in patch ? { keyConfirmed: true } : {}),
            }
          : d,
      ),
    );

  const remove = (i: number) => setDrafts((current) => current.filter((_, j) => j !== i));

  async function save() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const next = [...drafts];
    let added = 0;
    for (let i = 0; i < next.length; i++) {
      const d = next[i];
      if (!isReady(d)) continue;
      const { data, error } = await supabase.from("songs").insert(toSongRow(d.fields, d.content)).select("id").single();
      let result = SAVED;
      if (error) {
        result = error.code === "23505" ? "Already in library" : `Failed: ${migrationHint(error.message)}`;
      } else {
        added++;
        if (d.fields.themeIds.length) {
          const { error: themeError } = await supabase.from("song_themes").insert(d.fields.themeIds.map((theme_id) => ({ song_id: data.id, theme_id })));
          if (themeError) result = `Saved, but themes failed: ${migrationHint(themeError.message)}`;
        }
      }
      next[i] = { ...d, result };
      setDrafts([...next]);
    }
    setMessage(`Added ${added}, skipped ${next.length - added}.`);
    setBusy(false);
  }

  const ready = drafts.filter(isReady).length;

  return (
    <>
      <div className="song-tabs" role="tablist" aria-label="How to add songs">
        <button type="button" role="tab" aria-selected={mode === "paste"} className={`song-tab${mode === "paste" ? " active" : ""}`} onClick={() => setMode("paste")}>Paste text</button>
        <button type="button" role="tab" aria-selected={mode === "files"} className={`song-tab${mode === "files" ? " active" : ""}`} onClick={() => setMode("files")}>Upload files</button>
      </div>

      {mode === "paste" ? (
        <div className="paste-box">
          <textarea
            className="chord-editor"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste a chord sheet from the web (chords above the lyrics) or ChordPro text. The first line is used as the title."
            aria-label="Song text"
            spellCheck={false}
            disabled={busy}
          />
          <button className="btn primary" type="button" onClick={onPreview} disabled={busy || !pasted.trim()}>Preview</button>
        </div>
      ) : (
        <label
          className={`upload-drop${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <Icon name="plus" />
          <strong>Drop song files here, or click to choose</strong>
          <span>.cho, .chopro, .pro, .chordpro or .txt — several at once</span>
          <input type="file" multiple accept={ACCEPT} onChange={onPick} className="sr-only" aria-label="Choose song files" disabled={busy} />
        </label>
      )}

      {drafts.length > 0 && (
        <div className="draft-list">
          {drafts.map((d, i) => {
            const s = draftStatus(d);
            const locked = !!d.result || d.unreadable;
            return (
              <article key={i} className="draft-card">
                <header className="draft-head">
                  <strong className="draft-label">{d.label}</strong>
                  <span className={`upload-status ${s.ok ? "ok" : "bad"}`}>{s.text}</span>
                  {!d.result && (
                    <button className="icon-btn danger" type="button" title="Remove from this batch" aria-label={`Remove ${d.label}`} onClick={() => remove(i)} disabled={busy}>
                      <Icon name="trash" />
                    </button>
                  )}
                </header>
                {!d.unreadable && <SongFields idPrefix={`draft-${i}`} value={d.fields} themes={themes} disabled={locked || busy} onChange={(patch) => editFields(i, patch)} />}
                {!locked && !d.keyConfirmed && keyStep(d.fields.key, 0) && (
                  <button className="btn compact" type="button" disabled={busy} onClick={() => edit(i, { keyConfirmed: true })}>
                    Use {d.fields.key}
                  </button>
                )}
                <details className="draft-preview" open={!d.result}>
                  <summary>Preview</summary>
                  <ChordSheet parsed={parseChordPro(d.content)} />
                </details>
              </article>
            );
          })}
        </div>
      )}

      <div className="upload-actions">
        <button className="btn primary" type="button" onClick={save} disabled={busy || ready === 0}>
          {busy ? "Saving…" : `Save ${ready} ${ready === 1 ? "song" : "songs"}`}
        </button>
        {message && <span role="status">{message}</span>}
        {drafts.some((d) => d.result?.startsWith(SAVED)) && <Link className="btn" href="/library">Back to Library</Link>}
      </div>
    </>
  );
}
