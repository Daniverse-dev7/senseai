import { test } from "node:test";
import assert from "node:assert/strict";
import { WritingHand } from "../lib/writing-hand";
import { abortable } from "../lib/hand-tracker";
function hand(x: number) {
  return Array.from({ length: 21 }, () => ({ x, y: 0.5 }));
}
test("writing hand survives a second hand and reordered detections", () => {
  const tracker = new WritingHand(),
    a = hand(0.2),
    b = hand(0.8);
  assert.equal(tracker.select([a], 0), a);
  assert.equal(tracker.select([b, a], 33), a);
  assert.equal(tracker.select([], 66), undefined);
  assert.equal(tracker.select([b, a], 99), a);
});
test("a distant replacement cannot immediately take over a stroke", () => {
  const tracker = new WritingHand(),
    a = hand(0.2),
    b = hand(0.8);
  tracker.select([a], 0);
  assert.equal(tracker.select([b], 33), undefined);
  assert.equal(tracker.select([b], 300), b);
  tracker.reset();
  assert.equal(tracker.select([a], 333), a);
  assert.equal(tracker.select([[{ x: NaN, y: 0 }]], 366), undefined);
});
test("canceled model initialization disposes resources arriving late", async () => {
  const controller = new AbortController();
  let resolve!: (v: number) => void;
  let disposed = 0;
  const task = new Promise<number>((r) => {
    resolve = r;
  });
  const result = abortable(task, controller.signal, (v) => {
    disposed = v;
  });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  resolve(42);
  await Promise.resolve();
  assert.equal(disposed, 42);
});
test("successful initialization stays alive and errors remain observable", async () => {
  const controller = new AbortController();
  let disposed = false;
  assert.equal(
    await abortable(Promise.resolve(42), controller.signal, () => {
      disposed = true;
    }),
    42,
  );
  controller.abort();
  assert.equal(disposed, false);
  await assert.rejects(
    abortable(
      Promise.reject(new Error("model failed")),
      new AbortController().signal,
    ),
    /model failed/,
  );
});
