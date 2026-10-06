"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Icon from "./Icon";
import { colors, safeColor, uid, type Section } from "@/lib/event";

type Props = { sections: Section[]; readOnly: boolean; onChange: (sections: Section[]) => void };

const tagColor = (color: string) => ({ "--tag-color": safeColor(color) }) as CSSProperties;

function swap<T>(items: T[], i: number, j: number) {
  if (j < 0 || j >= items.length) return items;
  const copy = [...items];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export default function SectionNotes({ sections, readOnly, onChange }: Props) {
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    const el = document.querySelector<HTMLInputElement>(`[data-focus="${CSS.escape(id)}"]`);
    el?.focus();
    el?.select();
  });

  const setSection = (i: number, patch: Partial<Section>) => onChange(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  function add() {
    const section: Section = { id: uid("section"), name: "", color: colors[sections.length % colors.length], note: "" };
    onChange([...sections, section]);
    focusId.current = section.id;
  }

  function remove(i: number) {
    if (!confirm(`Delete "${sections[i].name.trim() || "this song detail"}"?`)) return;
    onChange(sections.filter((_, j) => j !== i));
  }

  function cycleColor(i: number) {
    const current = safeColor(sections[i].color).toLowerCase();
    setSection(i, { color: colors[(colors.findIndex((c) => c.toLowerCase() === current) + 1) % colors.length] });
  }

  return (
    <>
      <div className="details">
        {sections.length === 0 ? (
          <div className="empty-detail">{readOnly ? "This song has no details yet." : "No song details yet. Add a section to start building this song."}</div>
        ) : (
          sections.map((section, i) =>
            readOnly ? (
              <div className="detail-row" key={section.id} style={tagColor(section.color)}>
                <div className="detail-name-wrap">
                  <span className="color-dot static" style={tagColor(section.color)} aria-hidden="true" />
                  <div className="view-detail-name">{section.name.trim() || "Untitled"}</div>
                </div>
                <div className="view-detail-note">{section.note}</div>
              </div>
            ) : (
              <div className="detail-row" key={section.id} style={tagColor(section.color)}>
                <div className="detail-name-wrap">
                  <button className="color-dot" type="button" style={tagColor(section.color)} title="Change section color" aria-label="Change section color" onClick={() => cycleColor(i)} />
                  <input
                    className="detail-name-input"
                    data-focus={section.id}
                    value={section.name}
                    onChange={(e) => setSection(i, { name: e.target.value })}
                    aria-label="Song detail name"
                    placeholder="Song detail name"
                  />
                </div>
                <textarea
                  className="detail-note"
                  rows={1}
                  value={section.note}
                  onChange={(e) => setSection(i, { note: e.target.value })}
                  aria-label={`Notes for ${section.name || "song detail"}`}
                  placeholder="Add notes..."
                />
                <div className="detail-tools">
                  <button className="icon-btn" type="button" title="Move up" aria-label="Move song detail up" disabled={i === 0} onClick={() => onChange(swap(sections, i, i - 1))}><Icon name="up" /></button>
                  <button className="icon-btn" type="button" title="Move down" aria-label="Move song detail down" disabled={i === sections.length - 1} onClick={() => onChange(swap(sections, i, i + 1))}><Icon name="down" /></button>
                  <button className="icon-btn danger" type="button" title="Delete song detail" aria-label="Delete song detail" onClick={() => remove(i)}><Icon name="trash" /></button>
                </div>
              </div>
            ),
          )
        )}
      </div>
      {!readOnly && (
        <button className="btn add-detail" type="button" onClick={add}><Icon name="plus" />Add Song Detail</button>
      )}
    </>
  );
}
