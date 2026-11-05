import { test } from "node:test";
import assert from "node:assert/strict";
import { EnergyGesture } from "../lib/energy-gesture";
function hand(cx: number, scale = 1) {
  const p = Array.from({ length: 21 }, () => ({ x: cx, y: 0.5 }));
  p[0] = { x: cx, y: 0.65 };
  p[4] = { x: cx - 0.15, y: 0.4 };
  for (const [i, b] of [5, 9, 13, 17].entries()) {
    const x = cx - 0.09 + i * 0.06;
    p[b] = { x, y: 0.5 };
    p[b + 1] = { x, y: 0.4 };
    p[b + 2] = { x, y: 0.3 };
    p[b + 3] = { x, y: 0.2 };
  }
  return p.map((p) => ({
    x: cx + (p.x - cx) * scale,
    y: 0.5 + (p.y - 0.5) * scale,
  }));
}
test("two hands center and resize the sphere independent of result order", () => {
  const g = new EnergyGesture();
  const a = g.update([hand(0.3), hand(0.7)], 0).orb!;
  const b = g.update([hand(0.8), hand(0.2)], 40).orb!;
  assert.ok(Math.abs(a.center.x - b.center.x) < 1e-9);
  assert.ok(a.center.x > 0.45 && a.center.x < 0.55);
  assert.ok(b.radius > a.radius);
});
test("deliberate two-palm growth releases once with cooldown", () => {
  const g = new EnergyGesture();
  for (let t = 0; t <= 240; t += 40) g.update([hand(0.3), hand(0.7)], t);
  const result = g.update([hand(0.3, 1.4), hand(0.7, 1.4)], 280);
  assert.ok(result.release);
  assert.equal(g.update([hand(0.3, 1.5), hand(0.7, 1.5)], 320).release, null);
});
test("missing hand, moving apart, and tracking gaps do not launch", () => {
  const g = new EnergyGesture();
  for (let t = 0; t <= 240; t += 40) g.update([hand(0.3), hand(0.7)], t);
  assert.equal(g.update([hand(0.2), hand(0.8)], 280).release, null);
  assert.equal(g.update([hand(0.3)], 320).orb, null);
  assert.equal(g.update([hand(0.3, 1.5), hand(0.7, 1.5)], 360).release, null);
  assert.equal(g.update([hand(0.3, 2), hand(0.7, 2)], 1000).release, null);
});
