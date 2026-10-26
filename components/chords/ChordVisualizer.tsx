"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PianoDiagram from "./PianoDiagram";
import { parseChord } from "@/lib/chords/parse";
import { voicings, voicingNames } from "@/lib/chords/voicings";

export function placePanel(
  anchor: { top: number; bottom: number; left: number; width: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number; placement: "above" | "below" } {
  const MARGIN = 8;
  const GAP = 8;
  const below = anchor.bottom + GAP;
  const fitsBelow = below + panel.height <= viewport.height - MARGIN;
  const top = fitsBelow ? below : Math.max(MARGIN, anchor.top - GAP - panel.height);
  const centred = anchor.left + anchor.width / 2 - panel.width / 2;
  const left = Math.min(Math.max(MARGIN, centred), Math.max(MARGIN, viewport.width - panel.width - MARGIN));
  return { left, top, placement: fitsBelow ? "below" : "above" };
}

type Props = {
  token: string;
  anchor: DOMRect;
  onClose: () => void;
  focusOnOpen?: boolean;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
};

export default function ChordVisualizer({ token, anchor, onClose, focusOnOpen, onPointerEnter, onPointerLeave }: Props) {
  const chord = parseChord(token);
  const vs = chord ? voicings(chord) : [];
  // Keyed by token: a selection belongs to one chord, so a new chord starts at 0
  // without an effect that resets state after render.
  const [picks, setPicks] = useState<Record<string, number>>({});
  const pick = picks[token] ?? 0;
  const setPick = (i: number) => setPicks((p) => ({ ...p, [token]: i }));
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = placePanel(
      anchor,
      { width: r.width, height: r.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPos({ left: next.left, top: next.top });
  }, [anchor, token, pick]);

  const placed = pos !== null;
  useEffect(() => {
    if (focusOnOpen && placed) panelRef.current?.querySelector("button")?.focus();
  }, [focusOnOpen, placed]);

  if (!chord || vs.length === 0) return null;
  const v = vs[Math.min(pick, vs.length - 1)];
  const names = voicingNames(chord, v);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={false}
      aria-label={`Chord ${chord.text}`}
      className="chord-panel"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="chord-panel-head">
        <div className="chord-panel-name">{chord.text}</div>
        <button className="chord-panel-close" type="button" aria-label="Close chord diagram" onClick={onClose}>
          ✕
        </button>
      </div>

      {vs.length > 1 && (
        <div className="chord-panel-voicings" role="group" aria-label="Voicings">
          {vs.map((voicing, i) => (
            <button
              key={voicing.name}
              type="button"
              className="chord-panel-voicing"
              aria-pressed={i === pick}
              onClick={() => setPick(i)}
            >
              {voicing.name}
            </button>
          ))}
        </div>
      )}

      <PianoDiagram voicing={v} labels={names} label={`${chord.text}, ${v.name}: ${names.join(" ")}`} />
      <p className="chord-panel-notes">{names.join(" · ")}</p>
    </div>,
    document.body,
  );
}
