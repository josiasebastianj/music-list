"use client";

import { useState, type FormEvent } from "react";
import Icon from "@/components/Icon";
import { migrationHint } from "@/lib/event";
import { byName } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";

type ThemeRow = { id: string; name: string; songs: number };

const errorText = (e: { code?: string; message: string }) => (e.code === "23505" ? "Theme already exists." : migrationHint(e.message));

export default function ThemeManager({ initial }: { initial: ThemeRow[] }) {
  const [themes, setThemes] = useState(initial);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const { data, error } = await createClient().from("themes").insert({ name: trimmed }).select("id,name").single();
    setBusy(false);
    if (error) return setError(errorText(error));
    setError(null);
    setName("");
    setThemes([...themes, { id: data.id, name: data.name, songs: 0 }].sort(byName));
  }

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) return setError("A theme needs a name.");
    setBusy(true);
    const { error } = await createClient().from("themes").update({ name: trimmed }).eq("id", editing.id);
    setBusy(false);
    if (error) return setError(errorText(error));
    setError(null);
    setThemes(themes.map((t) => (t.id === editing.id ? { ...t, name: trimmed } : t)).sort(byName));
    setEditing(null);
  }

  async function remove(t: ThemeRow) {
    if (!confirm(`Delete "${t.name}"? It will be removed from ${t.songs} ${t.songs === 1 ? "song" : "songs"}.`)) return;
    setBusy(true);
    const { error } = await createClient().from("themes").delete().eq("id", t.id);
    setBusy(false);
    if (error) return setError(errorText(error));
    setError(null);
    setThemes(themes.filter((x) => x.id !== t.id));
  }

  return (
    <>
      <form className="theme-add" onSubmit={add}>
        <input className="team-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New theme, e.g. Easter" aria-label="New theme name" maxLength={40} disabled={busy} />
        <button className="btn primary" type="submit" disabled={busy || !name.trim()}>
          <Icon name="plus" />
          Add
        </button>
      </form>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {themes.length === 0 ? (
        <div className="workspace-empty dash-empty">
          <div className="workspace-empty-inner">
            <div className="workspace-empty-title">No themes yet.</div>
            <div className="workspace-empty-copy">Add one above, then tag songs in the Library.</div>
          </div>
        </div>
      ) : (
        <ul className="dash-list">
          {themes.map((t) => (
            <li key={t.id} className="dash-item">
              {editing?.id === t.id ? (
                <form className="theme-edit" onSubmit={rename}>
                  <input className="team-input" value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} aria-label={`New name for ${t.name}`} maxLength={40} autoFocus disabled={busy} />
                  <button className="btn primary compact" type="submit" disabled={busy}>Save</button>
                  <button className="btn compact" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                </form>
              ) : (
                <>
                  <div className="dash-link">
                    <span className="dash-name">{t.name}</span>
                    <span className="dash-meta">{t.songs} {t.songs === 1 ? "song" : "songs"}</span>
                  </div>
                  <button className="icon-btn" type="button" title="Rename theme" aria-label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })} disabled={busy}>
                    <Icon name="edit" />
                  </button>
                  <button className="icon-btn danger" type="button" title="Delete theme" aria-label={`Delete ${t.name}`} onClick={() => remove(t)} disabled={busy}>
                    <Icon name="trash" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
