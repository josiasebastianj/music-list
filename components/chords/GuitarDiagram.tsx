import type { Fingering } from "@/lib/chords/guitar";

const GAP_X = 24;
const GAP_Y = 24;
const LEFT = 36;
const TOP = 28;
const ROWS = 5;
const WIDTH = LEFT + GAP_X * 5 + 20;
const HEIGHT = TOP + GAP_Y * ROWS + 10;

export default function GuitarDiagram({ fingering, label }: { fingering: Fingering; label: string }) {
  const { frets } = fingering;
  const fretted = frets.filter((f) => f > 0);
  const lowest = fretted.length ? Math.min(...fretted) : 1;
  const base = Math.max(...frets) <= ROWS ? 1 : lowest;
  const x = (s: number) => LEFT + s * GAP_X;
  const y = (row: number) => TOP + row * GAP_Y;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ maxWidth: 240, display: "block", margin: "0 auto" }} role="img" aria-label={label}>
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line key={`f${r}`} x1={x(0)} x2={x(5)} y1={y(r)} y2={y(r)} stroke="var(--line-strong)" strokeWidth={r === 0 && base === 1 ? 4 : 1} />
      ))}
      {frets.map((_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={y(0)} y2={y(ROWS)} stroke="var(--line-strong)" strokeWidth={1} />
      ))}
      {base > 1 && (
        <text x={x(0) - 10} y={y(0) + GAP_Y / 2 + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
          {base}fr
        </text>
      )}
      {frets.map((f, s) =>
        f > 0 ? (
          <circle key={`d${s}`} cx={x(s)} cy={y(f - base) + GAP_Y / 2} r={8} fill="var(--accent-fill)" />
        ) : (
          <text key={`m${s}`} x={x(s)} y={y(0) - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">
            {f === 0 ? "○" : "×"}
          </text>
        ),
      )}
    </svg>
  );
}
