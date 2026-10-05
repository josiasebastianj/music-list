"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import Icon from "@/components/Icon";
import { fromChordsAboveLyrics, guessKey, isChordProText, keyStep, parseChordPro, searchText } from "@/lib/chordpro";
import { createClient } from "@/lib/supabase/client";

type Row = {
  file: string;
  title: string;
  artist: string;
  key: string;
  keyConfirmed: boolean;
  content: string;
  sections: string[];
  unreadable: boolean;
  duplicate: boolean;
  result?: string;
};

const SAVED = "Saved";
const ACCEPT = ".cho,.chopro,.pro,.chordpro,.txt";
const identity = (title: string, artist: string) => `${title.trim().toLowerCase()}\u0000${artist.trim().toLowerCase()}`;

async function readSong(file: File): Promise<Row> {
  const text = (await file.text()).replace(/\r\n?/g, "\n");
  const base = file.name.replace(/\.[^.]+$/, "");
  let content = isChordProText(text) ? text : fromChordsAboveLyrics(text, base);
  if (!parseChordPro(content).title.trim()) content = `{title: ${base}}\n${content}`;
  const parsed = parseChordPro(content);
  return {
    file: file.name,
    title: parsed.title,
    artist: parsed.artist,
    key: parsed.key || guessKey(parsed) || "",
    keyConfirmed: parsed.key !== "",
    content,
    sections: parsed.sections.map((s) => s.label).filter(Boolean),
    unreadable: !parsed.sections.some((s) => s.lines.length > 0),
    duplicate: false,
  };
}

function status(r: Row): { text: string; ok: boolean } {
  if (r.result) return { text: r.result, ok: r.result === SAVED };
  if (r.unreadable) return { text: "Couldn't read it", ok: false };
  if (r.duplicate) return { text: "Already in library", ok: false };
  if (!r.title.trim()) return { text: "Needs a title", ok: false };
  if (!keyStep(r.key, 0) || !r.keyConfirmed) return { text: "Needs a key", ok: false };
  return { text: "Ready", ok: true };
}

const isReady = (r: Row) => !r.result && status(r).text === "Ready";

export default function UploadSongs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setMessage(null);
    const read = await Promise.all(files.map(readSong));
    const titles = [...new Set(read.map((r) => r.title.trim()).filter(Boolean))];
    let existing: { title: string; artist: string | null }[] = [];
    if (titles.length) {
      const { data, error } = await createClient().from("songs").select("title,artist").in("title", titles);
      if (error) setMessage(`Couldn't check the library for duplicates: ${error.message}. Duplicates will be skipped when saving.`);
      else existing = data ?? [];
    }
    const seen = new Set(existing.map((s) => identity(s.title, s.artist ?? "")));
    rows.forEach((r) => seen.add(identity(r.title, r.artist)));
    const marked = read.map((r) => {
      const id = identity(r.title, r.artist);
      const duplicate = !r.unreadable && seen.has(id);
      seen.add(id);
      return { ...r, duplicate };
    });
    setRows((current) => [...current, ...marked]);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    void addFiles([...(e.target.files ?? [])]);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    void addFiles([...e.dataTransfer.files]);
  }

  const edit = (i: number, patch: Partial<Row>) => setRows((current) => current.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      if (!isReady(r)) continue;
      const { error } = await supabase.from("songs").insert({
        title: r.title.trim(),
        artist: r.artist.trim() || null,
        song_key: r.key.trim(),
        content: r.content,
        search_text: searchText(r.title, r.content),
      });
      next[i] = { ...r, result: error ? (error.code === "23505" ? "Already in library" : `Failed: ${error.message}`) : SAVED };
      setRows([...next]);
    }
    const added = next.filter((r) => r.result === SAVED).length;
    setMessage(`Added ${added}, skipped ${next.length - added}.`);
    setBusy(false);
  }

  const ready = rows.filter(isReady).length;

  return (
    <>
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
        <input type="file" multiple accept={ACCEPT} onChange={onPick} className="sr-only" aria-label="Choose song files" />
      </label>

      {rows.length > 0 && (
        <div className="upload-table-wrap">
          <table className="upload-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Title</th>
                <th>Artist</th>
                <th>Key</th>
                <th>Sections</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = status(r);
                const locked = !!r.result || r.unreadable;
                return (
                  <tr key={i}>
                    <td>{r.file}</td>
                    <td>
                      <input value={r.title} disabled={locked || busy} onChange={(e) => edit(i, { title: e.target.value, duplicate: false })} aria-label={`Title for ${r.file}`} />
                    </td>
                    <td>
                      <input value={r.artist} disabled={locked || busy} onChange={(e) => edit(i, { artist: e.target.value, duplicate: false })} aria-label={`Artist for ${r.file}`} />
                    </td>
                    <td>
                      <input value={r.key} disabled={locked || busy} onChange={(e) => edit(i, { key: e.target.value, keyConfirmed: true })} aria-label={`Key for ${r.file}`} />
                      {!locked && !r.keyConfirmed && keyStep(r.key, 0) && (
                        <button className="btn compact" type="button" disabled={busy} onClick={() => edit(i, { keyConfirmed: true })}>
                          Use {r.key}
                        </button>
                      )}
                    </td>
                    <td>{r.sections.join(", ") || "—"}</td>
                    <td className={`upload-status ${s.ok ? "ok" : "bad"}`}>{s.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="upload-actions">
        <button className="btn primary" type="button" onClick={save} disabled={busy || ready === 0}>
          {busy ? "Saving…" : `Save ${ready} ${ready === 1 ? "song" : "songs"}`}
        </button>
        {message && <span role="status">{message}</span>}
      </div>
    </>
  );
}
