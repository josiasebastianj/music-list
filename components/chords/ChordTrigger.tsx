"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChordVisualizer from "./ChordVisualizer";
import { parseChord } from "@/lib/chords/parse";

const HOVER_DELAY = 120;

export default function ChordTrigger({ token }: { token: string }) {
  const [canHover, setCanHover] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const parsed = parseChord(token);
  const open = (pinned || hovered) && anchor !== null;

  // Read the media query in an effect so the first paint is identical on server and client.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
  }, []);

  // Close on Escape or on a pointerdown outside both the trigger and the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
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
    return () => {
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
        onBlur={canHover ? () => setHovered(false) : undefined}
        onClick={() => {
          const next = !pinned;
          clearTimer();
          setHovered(false);
          if (next) capture();
          setPinned(next);
        }}
      >
        {token}
      </button>

      {open && anchor && (
        <ChordVisualizer
          token={token}
          anchor={anchor}
          onClose={close}
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
