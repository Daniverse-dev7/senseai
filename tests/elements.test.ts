import { test } from "node:test";
import assert from "node:assert/strict";
import { ElementGesture } from "../lib/element-gesture";
function hand(x = 0.5, closed = false, scale = 1) {
  const p = Array.from({ length: 21 }, () => ({ x, y: 0.7 }));
  p[0] = { x, y: 0.9 };
  p[4] = { x: x - 0.35, y: 0.55 };
  for (const [i, b] of [5, 9, 13, 17].entries()) {
    const xx = x - 0.15 + i * 0.1;
    p[b] = { x: xx, y: 0.65 };
    p[b + 1] = { x: xx, y: 0.48 };
    p[b + 2] = { x: xx, y: 0.35 };
    p[b + 3] = { x: xx, y: closed ? 0.72 : 0.22 };
  }
  return p.map((p) => ({
    x: x + (p.x - x) * scale,
    y: 0.7 + (p.y - 0.7) * scale,
  }));
}
test("ice needs an open-palm sweep before close/thrust can shatter", () => {
  const g = new ElementGesture();
  for (let t = 0; t <= 240; t += 40) g.update("ice", [hand()], t);
  assert.equal(g.update("ice", [hand(0.5, true)], 280).crack, false);
  g.reset();
  for (let t = 0; t <= 240; t += 40) g.update("ice", [hand(0.3 + t / 1000)], t);
  assert.equal(g.update("ice", [hand(0.55, true)], 280).crack, true);
  g.update("ice", [hand(0.55, true, 1.4)], 320);
  assert.ok(g.update("ice", [hand(0.55, true, 1.4)], 380).launch);
});
test("lightning requires two visible hands and never releases on loss", () => {
  const g = new ElementGesture();
  for (let t = 0; t <= 240; t += 40)
    g.update("lightning", [hand(0.25), hand(0.75)], t);
  assert.equal(g.update("lightning", [hand(0.25, true)], 280).launch, null);
  assert.equal(g.update("lightning", [], 320).launch, null);
  assert.equal(
    g.update("lightning", [hand(0.25, true, 1.4), hand(0.75)], 380).launch,
    null,
  );
});
test("lightning releases after one fist thrust while the other hand stays visible", () => {
  const g = new ElementGesture();
  for (let t = 0; t <= 240; t += 40)
    g.update("lightning", [hand(0.25), hand(0.75)], t);
  g.update("lightning", [hand(0.25, true), hand(0.75)], 280);
  g.update("lightning", [hand(0.25, true, 1.4), hand(0.75)], 320);
  assert.ok(
    g.update("lightning", [hand(0.25, true, 1.4), hand(0.75)], 380).launch,
  );
});
