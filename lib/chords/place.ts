/** Where the chord panel goes: beside its chord, never on top of it. */
export function placePanel(
  anchor: { top: number; bottom: number; left: number; width: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number; placement: "above" | "below"; maxHeight: number } {
  const MARGIN = 8;
  const GAP = 8;
  const below = anchor.bottom + GAP;
  const roomBelow = viewport.height - MARGIN - below;
  const roomAbove = anchor.top - GAP - MARGIN;
  // Never cover the chord: use the side that fits, else the roomier side and let the panel scroll.
  const placement = panel.height <= roomBelow || roomBelow >= roomAbove ? "below" : "above";
  const room = Math.max(0, placement === "below" ? roomBelow : roomAbove);
  const height = Math.min(panel.height, room);
  const top = placement === "below" ? below : anchor.top - GAP - height;
  const centred = anchor.left + anchor.width / 2 - panel.width / 2;
  const left = Math.min(Math.max(MARGIN, centred), Math.max(MARGIN, viewport.width - panel.width - MARGIN));
  return { left, top, placement, maxHeight: room };
}
