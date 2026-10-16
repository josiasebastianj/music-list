"use client";

import { useId, useRef } from "react";
import Icon from "./Icon";
import type { ExportVersion } from "@/lib/exportPng";

type Props = { hasLyrics: boolean; onPick: (v: ExportVersion) => void };

export default function ExportDialog({ hasLyrics, onPick }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const pick = (v: ExportVersion) => { dialogRef.current?.close(); onPick(v); };
  const lyricsNote = !hasLyrics && <span className="export-choice-note">No lyrics yet</span>;

  return (
    <>
      <button className="export-btn" type="button" onClick={() => { dialogRef.current?.showModal(); cancelRef.current?.focus(); }}><Icon name="image" />Export PNG</button>
      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby={titleId}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <form method="dialog" className="share-dialog-inner">
          <div className="share-dialog-title" id={titleId}>Export PNG</div>
          <p className="share-dialog-copy">Which version?</p>
          <button className="btn export-choice" type="button" disabled={!hasLyrics} onClick={() => pick("lyrics")}>
            <span>Lyrics Only{lyricsNote}</span>
          </button>
          <button className="btn export-choice" type="button" disabled={!hasLyrics} onClick={() => pick("chords")}>
            <span>Lyrics + Chords{lyricsNote}</span>
          </button>
          <button className="btn export-choice" type="button" onClick={() => pick("notes")}><span>Section Notes</span></button>
          <div className="share-dialog-actions">
            <button className="btn" type="submit" ref={cancelRef}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
