import { trackPen, type Pen, type Point } from "./air-writing";
const alpha = (cutoff: number, dt: number) =>
  1 - Math.exp(-2 * Math.PI * cutoff * dt);
/** Time-aware adaptive low-pass filter: steady at rest, responsive in motion. */
export class SmoothPen {
  private raw: Pen | null = null;
  private filtered: Pen | null = null;
  private velocity = { x: 0, y: 0 };
  private time = 0;
  reset() {
    this.raw = this.filtered = null;
    this.velocity = { x: 0, y: 0 };
    this.time = 0;
  }
  update(
    points: Point[] | undefined,
    time: number,
    stabilization = 0.6,
  ): Pen | null {
    if (!Number.isFinite(time)) {
      this.reset();
      return null;
    }
    const gap = this.raw && (time - this.time > 160 || time <= this.time);
    if (gap) this.reset();
    // Keep pinch hysteresis, but obtain an unsmoothed coordinate sample.
    const detected = trackPen(points, this.raw, 0);
    if (!detected) {
      this.reset();
      return null;
    }
    const next = {
      ...detected,
      x: Math.max(0, Math.min(1, 1 - points![8].x)),
      y: Math.max(0, Math.min(1, points![8].y)),
    };
    const previous = this.raw,
      old = this.filtered;
    const dt = Math.max(1 / 120, Math.min(0.1, (time - this.time) / 1000));
    this.time = time;
    this.raw = next;
    const jump =
      previous && Math.hypot(next.x - previous.x, next.y - previous.y) > 0.18;
    if (!previous || !old || previous.down !== next.down || jump || gap) {
      this.velocity = { x: 0, y: 0 };
      // A gap deliberately lifts the pen once, preventing bridges over lost frames.
      this.filtered = { ...next, down: gap ? false : next.down };
      return this.filtered;
    }
    const d = alpha(4, dt);
    this.velocity.x += ((next.x - previous.x) / dt - this.velocity.x) * d;
    this.velocity.y += ((next.y - previous.y) / dt - this.velocity.y) * d;
    const strength = Math.max(0, Math.min(1, stabilization));
    const cutoff =
      1.2 +
      (1 - strength) * 5 +
      Math.hypot(this.velocity.x, this.velocity.y) * 18;
    const blend = strength === 0 ? 1 : alpha(cutoff, dt);
    this.filtered = {
      x: old.x + (next.x - old.x) * blend,
      y: old.y + (next.y - old.y) * blend,
      down: next.down,
    };
    return this.filtered;
  }
}
