"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ChordSheet from "@/components/ChordSheet";
import Icon from "@/components/Icon";
import SectionLayout from "@/components/SectionLayout";
import SongFields from "@/components/SongFields";
import SongTabs from "@/components/SongTabs";
import { parseChordPro } from "@/lib/chordpro";
import { migrationHint } from "@/lib/event";
import { byName, fieldsFrom, songMetaLine, toSongRow, validateFields, type Fields, type LibrarySong, type Theme } from "@/lib/library";
import { sectionNotesFrom } from "@/lib/songContent";
import { createClient } from "@/lib/supabase/client";

const noop = () => {};

export default function LibrarySongView({ initial, themes, actions }: { initial: LibrarySong; themes: Theme[]; actions: ReactNode }) {
  const [song, setSong] = useState(initial);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initial));
  const [content, setContent] = useState(initial.content);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leavingRef = useRef(false); // set once the user confirmed leaving, so beforeunload doesn't ask again
  const preview = useMemo(() => parseChordPro(content), [content]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(patch: Partial<Fields>) {
    setFields({ ...fields, ...patch });
    setDirty(true);
  }

  function startEdit() {
    setFields(fieldsFrom(song));
    setContent(song.content);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (dirty && !confirm("Discard your changes to this song?")) return;
    setEditing(false);
    setDirty(false);
    setError(null);
  }

  async function save() {
    const problem = validateFields(fields);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const row = toSongRow(fields, content);
    const { error: saveError } = await supabase.from("songs").update(row).eq("id", song.id).select("id").single();
    if (saveError) {
      setBusy(false);
      return setError(saveError.code === "23505" ? "A song with this title and artist is already in the library." : `Could not save: ${migrationHint(saveError.message)}`);
    }
    const before = song.themes.map((t) => t.id);
    const removed = before.filter((id) => !fields.themeIds.includes(id));
    const added = fields.themeIds.filter((id) => !before.includes(id));
    const errors: string[] = [];
    if (removed.length) {
      const { error } = await supabase.from("song_themes").delete().eq("song_id", song.id).in("theme_id", removed);
      if (error) errors.push(error.message);
    }
    if (added.length) {
      const { error } = await supabase.from("song_themes").upsert(added.map((theme_id) => ({ song_id: song.id, theme_id })), { onConflict: "song_id,theme_id", ignoreDuplicates: true });
      if (error) errors.push(error.message);
    }
    const { data: links } = await supabase.from("song_themes").select("theme_id").eq("song_id", song.id);
    const savedIds = links ? links.map((l) => l.theme_id) : before;
    setBusy(false);
    setSong({ ...song, ...row, themes: themes.filter((t) => savedIds.includes(t.id)).sort(byName) });
    if (errors.length) {
      setError(`The song was saved, but its themes weren't fully updated: ${migrationHint(errors.join("; "))}. Press Save to try again.`);
      return;
    }
    setDirty(false);
    setEditing(false);
  }

  async function remove() {
    if (!confirm(`Delete "${song.title}" from the library? Events that already use it keep their copy.`)) return;
    setBusy(true);
    const { error } = await createClient().from("songs").delete().eq("id", song.id);
    if (error) {
      setBusy(false);
      return setError(`Could not delete: ${migrationHint(error.message)}`);
    }
    window.location.assign(new URL("/library", window.location.origin).href);
  }

  const asEventSong = { id: song.id, title: song.title, baseKey: song.song_key, rhythm: song.rhythm ?? "", bpm: song.bpm, content: song.content, sections: sectionNotesFrom(song.content) };

  return (
    <SectionLayout current="library" actions={actions} confirmLeave={() => !(editing && dirty) || (leavingRef.current = confirm("Leave without saving your changes?"))}>
      <main className="dash">
      <div className="dash-head">
        <div>
          {/* plain <a>: a full page load keeps the beforeunload guard working */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <div className="eyebrow"><a href="/library">LIBRARY</a></div>
          <h1 className="dash-title">{song.title}</h1>
          <div className="dash-sub">{songMetaLine(song)}</div>
          {song.themes.length > 0 && (
            <div className="theme-chips">
              {song.themes.map((t) => (
                <span key={t.id} className="theme-chip">{t.name}</span>
              ))}
            </div>
          )}
        </div>
        {!editing && (
          <div className="dash-head-actions">
            <button className="btn" type="button" onClick={startEdit} disabled={busy}>
              <Icon name="edit" />
              Edit
            </button>
            <button className="btn danger" type="button" onClick={remove} disabled={busy}>
              <Icon name="trash" />
              Delete
            </button>
          </div>
        )}
      </div>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {editing ? (
        <div className="lib-editor">
          <SongFields idPrefix="edit" value={fields} themes={themes} disabled={busy} onChange={change} keyHint="The key the chords are written in. Changing it doesn't move the chords." />
          <label className="field field-wide">
            Lyrics and chords (ChordPro)
            <textarea
              className="chord-editor"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              disabled={busy}
            />
          </label>
          <div className="lib-preview">
            <div className="section-label">PREVIEW</div>
            <ChordSheet parsed={preview} />
          </div>
          <div className="upload-actions">
            <button className="btn primary" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn" type="button" onClick={cancel} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : (
        <SongTabs song={asEventSong} content={song.content} readOnly onContentChange={noop} onSectionsChange={noop} onSongChange={noop} />
      )}
      </main>
    </SectionLayout>
  );
}
