import { test } from "node:test";
import assert from "node:assert/strict";
import { placePanel } from "./place.ts";

const anchor = { top: 420, bottom: 440, left: 500, width: 30 };
const viewport = { width: 1280, height: 860 };

test("a panel that fits goes below the chord", () => {
  const p = placePanel(anchor, { width: 360, height: 300 }, viewport);
  assert.equal(p.placement, "below");
  assert.equal(p.top, 448);
});

test("a tall panel never covers the chord and is capped to its side", () => {
  const p = placePanel(anchor, { width: 360, height: 700 }, viewport);
  const bottom = p.top + Math.min(700, p.maxHeight);
  assert.ok(p.placement === "below" ? p.top >= anchor.bottom : bottom <= anchor.top, JSON.stringify(p));
  assert.ok(p.top >= 8 && bottom <= viewport.height - 8, JSON.stringify(p));
});

test("a panel that fits only above goes above", () => {
  const p = placePanel({ top: 700, bottom: 720, left: 100, width: 30 }, { width: 360, height: 400 }, viewport);
  assert.equal(p.placement, "above");
  assert.equal(p.top, 700 - 8 - 400);
});

test("the panel stays inside the viewport sideways", () => {
  assert.equal(placePanel({ ...anchor, left: 0 }, { width: 360, height: 100 }, viewport).left, 8);
  assert.equal(placePanel({ ...anchor, left: 1270 }, { width: 360, height: 100 }, viewport).left, 1280 - 360 - 8);
});
