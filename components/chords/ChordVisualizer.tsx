"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PianoDiagram from "./PianoDiagram";
import GuitarDiagram from "./GuitarDiagram";
import { setInstrument, useInstrument } from "./instrument";
import { guitarVoicings, tabString, type Fingering } from "@/lib/chords/guitar";
import { parseChord } from "@/lib/chords/parse";
import { placePanel } from "@/lib/chords/place";
import { voicings, voicingNames, type Voicing } from "@/lib/chords/voicings";

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
  const instrument = useInstrument();
  const guitar = instrument === "guitar";
  const vs: { name: string }[] = chord ? (guitar ? guitarVoicings(chord) : voicings(chord)) : [];
  // Keyed by instrument and token: a selection belongs to one chord, so a new chord starts at 0
  // without an effect that resets state after render.
  const [picks, setPicks] = useState<Record<string, number>>({});
  const pickKey = `${instrument}:${token}`;
  const pick = picks[pickKey] ?? 0;
  const setPick = (i: number) => setPicks((p) => ({ ...p, [pickKey]: i }));
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = placePanel(
      anchor,
      { width: r.width, height: el.scrollHeight + (r.height - el.clientHeight) }, // natural height, even when capped
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPos({ left: next.left, top: next.top, maxHeight: next.maxHeight });
  }, [anchor, token, pick, instrument]);

  const placed = pos !== null;
  useEffect(() => {
    if (focusOnOpen && placed) panelRef.current?.querySelector("button")?.focus();
  }, [focusOnOpen, placed]);

  if (!chord) return null;
  const v = vs[Math.min(pick, vs.length - 1)];

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={false}
      aria-label={`Chord ${chord.text}`}
      className="chord-panel"
      style={pos ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight, overflowY: "auto" } : { left: 0, top: 0, visibility: "hidden" }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="chord-panel-head">
        <div className="chord-panel-name">{chord.text}</div>
        <button className="chord-panel-close" type="button" aria-label="Close chord diagram" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="chord-panel-voicings" role="group" aria-label="Instrument">
        {(["keyboard", "guitar"] as const).map((i) => (
          <button key={i} type="button" className="chord-panel-voicing" aria-pressed={i === instrument} onClick={() => setInstrument(i)}>
            {i === "keyboard" ? "Keyboard" : "Guitar"}
          </button>
        ))}
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

      {!v ? (
        <p className="chord-panel-notes">No guitar shape for this chord yet.</p>
      ) : guitar ? (
        <>
          <GuitarDiagram fingering={v as Fingering} label={`${chord.text}, ${v.name}: ${tabString((v as Fingering).frets)}`} />
          <p className="chord-panel-notes">Tab (low E to high e): {tabString((v as Fingering).frets)}</p>
        </>
      ) : (
        <>
          <PianoDiagram voicing={v as Voicing} labels={voicingNames(chord, v as Voicing)} label={`${chord.text}, ${v.name}: ${voicingNames(chord, v as Voicing).join(" ")}`} />
          <p className="chord-panel-notes">{voicingNames(chord, v as Voicing).join(" · ")}</p>
        </>
      )}
    </div>,
    document.body,
  );
}
