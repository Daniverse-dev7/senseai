import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, position, cameraError, type Detection } from "../lib/vision";
const objects: Detection[] = [
  { class: "person", score: 0.94, bbox: [0, 20, 100, 200] },
  { class: "chair", score: 0.8, bbox: [700, 0, 100, 100] },
];
test("localization uses bounding box center", () => {
  assert.equal(position(objects[0], 900), "left");
  assert.equal(position(objects[1], 900), "right");
  assert.equal(
    position({ ...objects[0], bbox: [400, 0, 100, 100] }, 900),
    "center",
  );
});
test("answers count and locate actual detections", () => {
  assert.match(answer("How many people?", objects, 900, ""), /1 matching/);
  assert.match(answer("Where is the chair?", objects, 900, ""), /right/);
  assert.match(
    answer("Where is the bottle?", objects, 900, ""),
    /not in the current/,
  );
  assert.match(answer("How many people?", [], 900, ""), /0 matching/);
});
test("OCR evidence and unavailable reasoning are explicit", () => {
  assert.equal(
    answer("Read text", objects, 900, "Hello SenseAI"),
    "Hello SenseAI",
  );
  assert.match(answer("read text", [], 900, ""), /No text/);
  assert.match(
    answer("What color is this?", objects, 900, ""),
    /requires a configured/,
  );
  assert.match(answer("Is it safe?", objects, 900, ""), /cannot estimate/);
});
test("permission failures give actionable messages", () => {
  assert.match(
    cameraError(new DOMException("denied", "NotAllowedError")),
    /permission was denied/,
  );
  assert.match(
    cameraError(new DOMException("missing", "NotFoundError")),
    /No camera/,
  );
});

test("absent object count is zero rather than total detections", () => {
  assert.match(answer("How many bottles?", objects, 900, ""), /0 matching/);
  assert.match(answer("How many objects?", objects, 900, ""), /2 matching/);
});
