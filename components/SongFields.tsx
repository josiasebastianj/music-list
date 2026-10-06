"use client";

import { RHYTHM_PRESETS } from "@/lib/chordpro";
import type { Fields, Theme } from "@/lib/library";

type Props = {
  idPrefix: string;
  value: Fields;
  themes: Theme[];
  disabled?: boolean;
  onChange: (patch: Partial<Fields>) => void;
  keyHint?: string;
};

export default function SongFields({ idPrefix, value, themes, disabled = false, onChange, keyHint }: Props) {
  const toggle = (id: string) =>
    onChange({ themeIds: value.themeIds.includes(id) ? value.themeIds.filter((t) => t !== id) : [...value.themeIds, id] });

  return (
    <div className="song-fields">
      <label className="field field-title">
        Title
        <input value={value.title} onChange={(e) => onChange({ title: e.target.value })} disabled={disabled} />
      </label>
      <label className="field field-title">
        Artist
        <input value={value.artist} onChange={(e) => onChange({ artist: e.target.value })} disabled={disabled} />
      </label>
      <label className="field">
        Key
        <input value={value.key} onChange={(e) => onChange({ key: e.target.value })} disabled={disabled} placeholder="G" />
        {keyHint && <span className="field-hint">{keyHint}</span>}
      </label>
      <label className="field">
        Rhythm
        <input list={`${idPrefix}-rhythms`} value={value.rhythm} maxLength={12} onChange={(e) => onChange({ rhythm: e.target.value })} disabled={disabled} placeholder="4/4" />
        <datalist id={`${idPrefix}-rhythms`}>
          {RHYTHM_PRESETS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      <label className="field">
        BPM
        <input type="number" inputMode="numeric" min={20} max={300} step={1} value={value.bpm} onChange={(e) => onChange({ bpm: e.target.value })} disabled={disabled} placeholder="72" />
      </label>
      {themes.length > 0 ? (
        <fieldset className="field field-wide theme-picker" disabled={disabled}>
          <legend>Themes</legend>
          {themes.map((t) => (
            <label key={t.id} className={`theme-chip toggle${value.themeIds.includes(t.id) ? " on" : ""}`}>
              <input type="checkbox" className="sr-only" checked={value.themeIds.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="field-hint field-wide">
          No themes yet. Add some on the <a href="/themes" target="_blank" rel="noopener">Theme</a> page.
        </p>
      )}
    </div>
  );
}
