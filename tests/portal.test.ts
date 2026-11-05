import { test } from "node:test";
import assert from "node:assert/strict";
import { recognizePortal } from "../lib/portal";
function circle(turns = 1, aspect = 16 / 9) {
  return Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2 * turns;
    return {
      x: 0.5 + (Math.cos(a) * 0.22) / aspect,
      y: 0.5 + Math.sin(a) * 0.22,
    };
  });
}
test("closed circles open aspect-correct portals", () => {
  for (const aspect of [1, 16 / 9, 9 / 16]) {
    const result = recognizePortal(circle(1, aspect), aspect);
    assert.ok(result);
    assert.ok(Math.abs(result.center.x - 0.5) < 0.01);
    assert.ok(result.score > 0.95);
  }
});
test("open arcs, lines, double loops and invalid traces do not open portals", () => {
  assert.equal(recognizePortal(circle(0.7)), null);
  assert.equal(recognizePortal(circle(2)), null);
  assert.equal(
    recognizePortal(
      Array.from({ length: 30 }, (_, i) => ({ x: i / 30, y: 0.5 })),
    ),
    null,
  );
  assert.equal(recognizePortal([]), null);
  const p = circle();
  p[0].x = NaN;
  assert.equal(recognizePortal(p), null);
});
test("small hand jitter is tolerated without accepting a scribble", () => {
  const p = circle().map((p, i) => ({
    x: p.x + Math.sin(i * 5) * 0.003,
    y: p.y + Math.cos(i * 7) * 0.003,
  }));
  assert.ok(recognizePortal(p));
  assert.equal(
    recognizePortal(
      circle().map((p, i) => ({ ...p, y: p.y + (i % 2 ? 0.14 : -0.14) })),
    ),
    null,
  );
});
