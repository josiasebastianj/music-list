"use client";

import { useRef } from "react";
import { bpmFromTaps } from "@/lib/chordpro";

const RESET_MS = 2000; // a pause this long starts a fresh count

export default function TapTempo({ onBpm, disabled = false }: { onBpm: (bpm: number) => void; disabled?: boolean }) {
  const taps = useRef<number[]>([]);

  function tap() {
    const now = performance.now();
    if (now - (taps.current.at(-1) ?? -Infinity) > RESET_MS) taps.current = [];
    taps.current.push(now);
    const bpm = bpmFromTaps(taps.current);
    if (bpm !== null) onBpm(bpm);
  }

  return (
    <button className="btn compact tap-btn" type="button" disabled={disabled} title="Tap along to the beat to set the BPM" onClick={tap}>
      Tap
    </button>
  );
}
