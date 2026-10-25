import { HIGH, LOW, type Voicing } from "@/lib/chords/voicings";

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);
const WHITE_W = 24;
const WHITE_H = 96;
const BLACK_W = 14;
const BLACK_H = 60;
const WHITE_KEYS = 15; // C4 .. C6
const WIDTH = WHITE_KEYS * WHITE_W;
const HEIGHT = WHITE_H;

type Key = { midi: number; black: boolean; x: number };

// Walking LOW..HIGH in order means a black key always immediately follows its
// lower white neighbour, so `whites` is exactly the number of whites to its left.
const KEYS = ((): Key[] => {
  const out: Key[] = [];
  let whites = 0;
  for (let midi = LOW; midi <= HIGH; midi++) {
    if (WHITE_PC.has(midi % 12)) {
      out.push({ midi, black: false, x: whites * WHITE_W });
      whites++;
    } else {
      out.push({ midi, black: true, x: whites * WHITE_W - BLACK_W / 2 });
    }
  }
  return out;
})();

type Props = { voicing: Voicing; labels: string[]; label: string };

export default function PianoDiagram({ voicing, labels, label }: Props) {
  const active = new Map(voicing.keys.map((midi, i) => [midi, i]));
  const lowest = voicing.keys[0];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {/* whites first, then blacks, so a black key overlaps its neighbours */}
      {KEYS.filter((k) => !k.black).map((k) => (
        <rect key={k.midi} x={k.x} y={0} width={WHITE_W} height={WHITE_H} rx={3} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={1} />
      ))}
      {KEYS.filter((k) => k.black).map((k) => (
        <rect key={k.midi} x={k.x} y={0} width={BLACK_W} height={BLACK_H} rx={2} fill="var(--text)" stroke="var(--line-strong)" strokeWidth={1} />
      ))}
      {/* highlights last, so they are never hidden under an adjacent black key */}
      {KEYS.filter((k) => active.has(k.midi)).map((k) => {
        const i = active.get(k.midi)!;
        const isLowest = k.midi === lowest;
        return (
          <g key={`h${k.midi}`}>
            <rect
              x={k.x + (k.black ? 0 : 1)}
              y={k.black ? 0 : 1}
              width={(k.black ? BLACK_W : WHITE_W) - (k.black ? 0 : 2)}
              height={(k.black ? BLACK_H : WHITE_H) - (k.black ? 0 : 2)}
              rx={k.black ? 2 : 3}
              fill="var(--accent-fill)"
              stroke={isLowest ? "var(--accent)" : "none"}
              strokeWidth={isLowest ? 3 : 0}
            />
            <text
              x={k.x + (k.black ? BLACK_W : WHITE_W) / 2}
              y={k.black ? BLACK_H - 6 : HEIGHT - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="var(--on-accent)"
            >
              {labels[i] ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
