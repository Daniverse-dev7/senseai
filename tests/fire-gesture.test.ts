import { test } from "node:test";
import assert from "node:assert/strict";
import { FireGesture, closedFist } from "../lib/fire-gesture";
function pose(closed = false) {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }));
  p[0] = { x: 0.5, y: 0.9 };
  p[4] = { x: 0.15, y: 0.55 };
  for (const [i, b] of [5, 9, 13, 17].entries()) {
    const x = 0.35 + i * 0.1;
    p[b] = { x, y: 0.65 };
    p[b + 1] = { x, y: 0.48 };
    p[b + 2] = { x, y: 0.35 };
    p[b + 3] = { x, y: closed ? 0.72 : 0.22 };
  }
  return p;
}
function thrust(scale = 1.4) {
  return pose(true).map((p) => ({
    x: 0.5 + (p.x - 0.5) * scale,
    y: 0.7 + (p.y - 0.7) * scale,
  }));
}
function charge(g: FireGesture, start = 0) {
  for (let t = start; t <= start + 240; t += 40) g.update(pose(), t);
}
test("fist classifier rejects open, pointing and invalid hands", () => {
  assert.equal(closedFist(pose(true)), true);
  assert.equal(closedFist(pose()), false);
  const point = pose(true);
  point[8] = { x: 0.35, y: 0.22 };
  assert.equal(closedFist(point), false);
  assert.equal(closedFist(undefined), false);
  assert.equal(closedFist([]), false);
  const bad = pose(true);
  bad[8].x = NaN;
  assert.equal(closedFist(bad), false);
});
test("closed fist followed by a sustained forward thrust launches once", () => {
  const g = new FireGesture();
  charge(g);
  assert.equal(g.update(pose(true), 280).launch, null);
  assert.equal(g.update(thrust(), 320).launch, null);
  assert.ok(g.update(thrust(), 380).launch);
  for (let t = 400; t < 1000; t += 40)
    assert.equal(g.update(pose(true), t).launch, null);
  charge(g, 1000);
  g.update(pose(true), 1280);
  g.update(thrust(), 1320);
  assert.ok(g.update(thrust(), 1380).launch);
});
test("tracking loss, long frame gaps and brief open gestures never launch", () => {
  for (const variant of ["loss", "gap", "brief"]) {
    const g = new FireGesture();
    if (variant === "brief") g.update(pose(), 0);
    else charge(g);
    if (variant === "loss") g.update(undefined, 260);
    const start = variant === "gap" ? 1000 : 280;
    for (let t = start; t < start + 200; t += 40)
      assert.equal(g.update(pose(true), t).launch, null);
  }
});
test("writing pinch and reset disarm a charged flame", () => {
  for (const reset of [true, false]) {
    const g = new FireGesture();
    charge(g);
    if (reset) g.reset();
    else {
      const pinch = pose();
      pinch[4] = { ...pinch[8] };
      g.update(pinch, 260);
    }
    for (let t = 280; t < 500; t += 40)
      assert.equal(g.update(pose(true), t).launch, null);
  }
});

test("closing alone, sideways movement and brief size spikes do not release", () => {
  for (const kind of ["still", "sideways", "spike"]) {
    const g = new FireGesture();
    charge(g);
    g.update(pose(true), 280);
    for (let t = 320; t < 1100; t += 40) {
      const p =
        kind === "sideways"
          ? thrust().map((p) => ({ ...p, x: p.x + 0.35 }))
          : kind === "spike" && t === 320
            ? thrust()
            : pose(true);
      assert.equal(g.update(p, t).launch, null);
    }
  }
});
