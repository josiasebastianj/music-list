"use client";

import { useEffect, useRef, useState } from "react";

// Lives outside the per-song TempoControl (which is keyed by song) so "on" survives song changes and the new tempo takes over.
export default function Metronome({ bpm }: { bpm: number | null }) {
  const [on, setOn] = useState(false);
  const dot = useRef<HTMLButtonElement>(null);
  const ctx = useRef<AudioContext | null>(null);
  const active = on && bpm !== null;

  useEffect(() => {
    if (!active) return;
    const ac = (ctx.current ??= new AudioContext()); // created inside the click's effect, so the browser allows sound
    void ac.resume();
    const period = 60 / bpm;
    let next = ac.currentTime + 0.05;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // schedule clicks on the audio clock a little ahead, so timer jitter never shifts the beat
    const tick = setInterval(() => {
      for (; next < ac.currentTime + 0.1; next += period) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.3, next);
        gain.gain.exponentialRampToValueAtTime(0.001, next + 0.05);
        osc.connect(gain).connect(ac.destination);
        osc.start(next);
        osc.stop(next + 0.06);
        const t = setTimeout(() => {
          timers.delete(t);
          dot.current?.animate([{ background: "var(--accent)", color: "#fff" }, {}], 180);
        }, Math.max(0, (next - ac.currentTime) * 1000));
        timers.add(t);
      }
    }, 25);
    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, [active, bpm]);

  return (
    <button
      ref={dot}
      className="metronome"
      type="button"
      aria-pressed={on}
      disabled={bpm === null && !on}
      title={bpm === null ? "Set a BPM to use the metronome" : on ? "Stop metronome" : "Start metronome"}
      aria-label="Metronome"
      onClick={() => setOn(!on)}
    >
      {on ? "❚❚" : "▶"}
    </button>
  );
}
