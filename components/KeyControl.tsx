"use client";

import Icon from "./Icon";
import { keyStep } from "@/lib/chordpro";

type Props = {
  value: string;
  readOnly: boolean;
  onStep: (steps: number) => void;
  onType?: (value: string) => void;
  onReset?: () => void;
};

export default function KeyControl({ value, readOnly, onStep, onType, onReset }: Props) {
  const known = keyStep(value, 0) !== null;
  return (
    <div className="key-control">
      <button className="icon-btn" type="button" aria-label="Lower key" title={known ? "Lower key" : "Unknown key"} disabled={!known} onClick={() => onStep(-1)}>
        <Icon name="minus" />
      </button>
      {readOnly ? (
        <div className="key-badge" title="Key" aria-label={`Key ${value.trim() || "not set"}`}>
          <span aria-hidden="true">Key</span>
          <strong aria-hidden="true">{value.trim() || "—"}</strong>
        </div>
      ) : (
        <label className="key-field">
          <span>Key</span>
          <input className="key-input" value={value} onChange={(e) => onType?.(e.target.value)} placeholder="—" aria-label="Base key" />
        </label>
      )}
      <button className="icon-btn" type="button" aria-label="Raise key" title={known ? "Raise key" : "Unknown key"} disabled={!known} onClick={() => onStep(1)}>
        <Icon name="plus" />
      </button>
      {onReset && (
        <button className="btn compact" type="button" onClick={onReset}>Reset</button>
      )}
    </div>
  );
}
