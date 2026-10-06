import type { ParsedSong } from "@/lib/chordpro";

const NBSP = " ";

export default function ChordSheet({ parsed }: { parsed: ParsedSong }) {
  return (
    <>
      {parsed.sections.map((s, i) => (
        <section key={i} className="lyrics-section">
          {s.label && <h3 className="lyrics-label">{s.label}</h3>}
          {s.lines.map((line, j) =>
            line.type === "grid" ? (
              <div key={j} className="chord-grid">{line.cells.join(" ")}</div>
            ) : line.segments.some((g) => g.chord) ? (
              <div key={j} className="chord-line">
                {line.segments.map((g, k) => (
                  <span key={k} className="chord-seg">
                    <span className="chord">{g.chord ?? NBSP}</span>
                    <span className="chord-text">{g.text || NBSP}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p key={j} className="lyrics-line chord-plain">{line.segments.map((g) => g.text).join("")}</p>
            ),
          )}
        </section>
      ))}
    </>
  );
}
