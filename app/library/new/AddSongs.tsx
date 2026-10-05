"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent, type ReactNode } from "react";
import ChordSheet from "@/components/ChordSheet";
import Icon from "@/components/Icon";
import SectionLayout from "@/components/SectionLayout";
import SongFields from "@/components/SongFields";
import { keyStep, parseChordPro } from "@/lib/chordpro";
import { migrationHint } from "@/lib/event";
import { SAVED, draftFrom, draftStatus, identity, isConfirmed, isReady, toSongRow, type Draft, type Fields, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = ".cho,.chopro,.pro,.chordpro,.txt";

// The paste box's current card: not confirmed or saved yet.
const isOpenPaste = (d: Draft) => !!d.pasted && !d.confirmed && !d.result;

export default function AddSongs({ themes, actions, loadError }: { themes: Theme[]; actions: ReactNode; loadError?: string }) {
  const [mode, setMode] = useState<"paste" | "files">("paste");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const leavingRef = useRef(false); // set once the user confirmed leaving, so beforeunload doesn't ask again
  const unsaved = pasted.trim() !== "" || drafts.some((d) => !d.result?.startsWith(SAVED));

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // replacePasted: drop the paste box's previous unconfirmed card, so Preview again updates it instead of adding a copy.
  async function addDrafts(read: Draft[], replacePasted = false) {
    if (!read.length) return;
    setMessage(null);
    setChecking(true);
    const titles = [...new Set(read.map((d) => d.fields.title.trim()).filter(Boolean))];
    let existing: { title: string; artist: string | null }[] = [];
    if (titles.length) {
      const { data, error } = await createClient().from("songs").select("title,artist").in("title", titles);
      if (error) setMessage(`Couldn't check the library for duplicates: ${migrationHint(error.message)}. Duplicates will be skipped when saving.`);
      else existing = data ?? [];
    }
    setDrafts((all) => {
      const current = replacePasted ? all.filter((d) => !isOpenPaste(d)) : all;
      const counts = (d: Draft) => !d.unreadable && !!d.fields.title.trim();
      const seen = new Set([...existing.map((s) => identity(s.title, s.artist ?? "")), ...current.filter(counts).map((d) => identity(d.fields.title, d.fields.artist))]);
      const marked = read.map((d) => {
        const id = identity(d.fields.title, d.fields.artist);
        const duplicate = counts(d) && seen.has(id);
        if (counts(d)) seen.add(id);
        return { ...d, duplicate };
      });
      return [...current, ...marked];
    });
    setChecking(false);
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

  // The text stays in the box until its card is confirmed.
  async function onPreview() {
    if (!pasted.trim()) return;
    await addDrafts([{ ...draftFrom("Pasted text", pasted, ""), pasted: true }], true);
  }

  function confirmDrafts(which: (d: Draft, i: number) => boolean) {
    if (drafts.some((d, i) => which(d, i) && d.pasted)) setPasted("");
    setDrafts((current) => current.map((d, i) => (which(d, i) ? { ...d, confirmed: true } : d)));
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
              ...(d.result?.startsWith(SAVED) ? {} : { result: undefined, confirmed: false }),
              ...("key" in patch ? { keyConfirmed: true } : {}),
            }
          : d,
      ),
    );

  const remove = (i: number) => setDrafts((current) => current.filter((_, j) => j !== i));

  async function save() {
    if (confirmed === 0) {
      alert("Confirm the previews you want to save first.");
      return;
    }
    if (ready > 0 && !confirm(`${ready} previewed ${ready === 1 ? "song isn't" : "songs aren't"} confirmed and won't be saved. Save the confirmed ${confirmed === 1 ? "song" : "songs"} anyway?`)) return;
    setBusy(true);
    setMessage(null);
    const retry = (d: Draft) => (d.result?.startsWith("Failed:") ? { ...d, result: undefined } : d);
    setDrafts((cur) => cur.map(retry));
    const supabase = createClient();
    const snapshot = drafts.map(retry);
    let added = 0;
    let skipped = 0;
    for (let i = 0; i < snapshot.length; i++) {
      const d = snapshot[i];
      if (!isConfirmed(d)) {
        if (!d.result) skipped++;
        continue;
      }
      const { data, error } = await supabase.from("songs").insert(toSongRow(d.fields, d.content)).select("id").single();
      let result = SAVED;
      if (error) {
        result = error.code === "23505" ? "Already in library" : `Failed: ${migrationHint(error.message)}`;
      } else {
        added++;
        if (d.fields.themeIds.length) {
          const { error: themeError } = await supabase.from("song_themes").insert(d.fields.themeIds.map((theme_id) => ({ song_id: data.id, theme_id })));
          if (themeError) result = `Saved, but its themes failed: ${migrationHint(themeError.message)}. Fix its themes on its library page.`;
        }
      }
      if (result !== SAVED && !result.startsWith("Saved")) skipped++;
      setDrafts((cur) => cur.map((x, j) => (j === i ? { ...x, result } : x)));
    }
    setMessage(`Added ${added}, skipped ${skipped}.`);
    setBusy(false);
  }

  const ready = drafts.filter(isReady).length;
  const confirmed = drafts.filter(isConfirmed).length;
  const confirmLeave = () => !unsaved || (leavingRef.current = confirm("Leave without saving your changes?"));
  // Link navigates client-side (no beforeunload), so confirm here too.
  const guardLink = (e: MouseEvent) => { if (!confirmLeave()) e.preventDefault(); };

  return (
    <SectionLayout current="library" actions={actions} confirmLeave={confirmLeave}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow"><Link href="/library" onClick={guardLink}>LIBRARY</Link></div>
            <h1 className="dash-title">Add songs</h1>
            <div className="dash-sub">Paste a chord sheet or upload ChordPro / text files. Check each preview, confirm it, then save to the library.</div>
          </div>
        </div>
        {loadError && <div className="share-banner error" role="alert">Could not load themes: {loadError}</div>}
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
            disabled={busy || checking}
          />
          <button className="btn primary" type="button" onClick={onPreview} disabled={busy || checking || !pasted.trim()}>{drafts.some(isOpenPaste) ? "Update preview" : "Preview"}</button>
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
            const saved = !!d.result?.startsWith(SAVED);
            const locked = saved || d.unreadable;
            return (
              <article key={i} className="draft-card">
                <header className="draft-head">
                  <strong className="draft-label">{d.label}</strong>
                  <span className={`upload-status ${s.ok ? "ok" : "bad"}`}>{s.text}</span>
                  {!saved && (
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
                {isReady(d) && (
                  <div className="draft-confirm">
                    <button className="btn primary compact" type="button" disabled={busy} onClick={() => confirmDrafts((_, j) => j === i)}>
                      Confirm
                    </button>
                    <span className="dash-meta">Check the preview, then confirm to include it when saving.</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="upload-actions">
        {ready > 1 && (
          <button className="btn" type="button" onClick={() => confirmDrafts((d) => isReady(d))} disabled={busy}>
            Confirm all {ready} ready
          </button>
        )}
        <button className="btn primary" type="button" onClick={save} disabled={busy || ready + confirmed === 0}>
          {busy ? "Saving…" : `Save ${confirmed} ${confirmed === 1 ? "song" : "songs"}`}
        </button>
        {message && <span role="status">{message}</span>}
        {drafts.some((d) => d.result?.startsWith(SAVED)) && <Link className="btn" href="/library" onClick={guardLink}>Back to Library</Link>}
      </div>
      </main>
    </SectionLayout>
  );
}
