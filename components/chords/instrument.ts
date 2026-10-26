import { useSyncExternalStore } from "react";

export type Instrument = "keyboard" | "guitar";
const KEY = "chord-instrument";
const listeners = new Set<() => void>();
let current: Instrument | null = null;

function read(): Instrument {
  if (current) return current;
  try {
    current = localStorage.getItem(KEY) === "guitar" ? "guitar" : "keyboard";
  } catch {
    current = "keyboard";
  }
  return current;
}

export function setInstrument(i: Instrument) {
  current = i;
  try {
    localStorage.setItem(KEY, i);
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** The learner's choice is shared by every chord panel and remembered per browser. */
export const useInstrument = () => useSyncExternalStore(subscribe, read, () => "keyboard" as Instrument);
