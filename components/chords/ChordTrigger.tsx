"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import ChordVisualizer from "./ChordVisualizer";
import { parseChord } from "@/lib/chords/parse";

const HOVER_DELAY = 120;

// One shared MediaQueryList for every chord; false on the server so first paint matches.
let hoverMq: MediaQueryList | null = null;
const mq = () => (hoverMq ??= window.matchMedia("(hover: hover) and (pointer: fine)"));
const subscribeHover = (cb: () => void) => {
  mq().addEventListener("change", cb);
  return () => mq().removeEventListener("change", cb);
};
const useCanHover = () => useSyncExternalStore(subscribeHover, () => mq().matches, () => false);

// Only one chord panel may be open; opening another closes this one.
let closeActive: (() => void) | null = null;

export default function ChordTrigger({ token }: { token: string }) {
  const canHover = useCanHover();
  const [focusPanel, setFocusPanel] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const parsed = parseChord(token);
  const open = (pinned || hovered) && anchor !== null;

  const clearTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const capture = useCallback(() => {
    const el = btnRef.current;
    if (el) setAnchor(el.getBoundingClientRect());
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setPinned(false);
    setHovered(false);
    setFocusPanel(false);
  }, []);

  // Close on Escape or on a pointerdown outside both the trigger and the panel.
  useEffect(() => {
    if (!open) return;
    if (closeActive && closeActive !== close) closeActive();
    closeActive = close;
    // The panel is position:fixed at a captured rect, so it would drift from its chord.
    const onMove = () => close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.activeElement?.closest?.(".chord-panel")) btnRef.current?.focus();
      close();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if ((t as Element).closest?.(".chord-panel")) return;
      setPinned(false);
      setHovered(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      if (closeActive === close) closeActive = null;
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  // A pinned panel must not survive a song or tab change: this component unmounts then.
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  if (!parsed) return <span className="chord">{token}</span>;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="chord chord-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseEnter={
          canHover
            ? () => {
                clearTimer();
                hoverTimer.current = setTimeout(() => {
                  capture();
                  setHovered(true);
                }, HOVER_DELAY);
              }
            : undefined
        }
        onMouseLeave={
          canHover
            ? () => {
                clearTimer();
                hoverTimer.current = setTimeout(() => setHovered(false), HOVER_DELAY);
              }
            : undefined
        }
        onFocus={canHover ? () => { capture(); setHovered(true); } : undefined}
        onBlur={canHover ? (e) => { if (!(e.relatedTarget as Element | null)?.closest?.(".chord-panel")) setHovered(false); } : undefined}
        onClick={(e) => {
          const next = !pinned;
          clearTimer();
          setHovered(false);
          if (next) capture();
          setPinned(next);
          // detail 0 = keyboard activation: the panel is portaled away, so move focus into it
          setFocusPanel(next && e.detail === 0);
        }}
      >
        {token}
      </button>

      {open && anchor && (
        <ChordVisualizer
          token={token}
          anchor={anchor}
          onClose={close}
          focusOnOpen={focusPanel}
          onPointerEnter={
            canHover
              ? () => {
                  clearTimer();
                  setHovered(true);
                }
              : undefined
          }
          onPointerLeave={canHover && !pinned ? () => setHovered(false) : undefined}
        />
      )}
    </>
  );
}
