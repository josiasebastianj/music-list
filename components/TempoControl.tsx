"use client";

import { useState } from "react";
import { RHYTHM_PRESETS, parseBpm } from "@/lib/chordpro";

type Props = {
  rhythm: string;
  bpm: number | null;
  readOnly: boolean;
  onChange: (patch: { rhythm?: string; bpm?: number | null }) => void;
};

export default function TempoControl({ rhythm, bpm, readOnly, onChange }: Props) {
  const [bpmText, setBpmText] = useState(bpm === null ? "" : String(bpm));

  if (readOnly) {
    if (!rhythm && bpm === null) return null;
    return (
      <div className="tempo-badges">
        {rhythm && <span className="tempo-badge">{rhythm}</span>}
        {bpm !== null && <span className="tempo-badge">{bpm} BPM</span>}
      </div>
    );
  }

  return (
    <div className="tempo-control">
      <label className="meta-field">
        <span>Time</span>
        <input list="tempo-rhythms" value={rhythm} maxLength={12} onChange={(e) => onChange({ rhythm: e.target.value })} placeholder="4/4" aria-label="Rhythm" />
      </label>
      <datalist id="tempo-rhythms">
        {RHYTHM_PRESETS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <label className="meta-field">
        <span>BPM</span>
        <input
          type="number"
          inputMode="numeric"
          min={20}
          max={300}
          step={1}
          value={bpmText}
          onChange={(e) => {
            const text = e.target.value;
            setBpmText(text);
            if (text.trim() === "") onChange({ bpm: null });
            else {
              const n = parseBpm(text);
              if (n !== null) onChange({ bpm: n });
            }
          }}
          onBlur={() => setBpmText(bpm === null ? "" : String(bpm))}
          placeholder="—"
          aria-label="Beats per minute"
        />
      </label>
    </div>
  );
}
