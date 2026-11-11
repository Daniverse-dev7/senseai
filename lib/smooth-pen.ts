import { trackPen, type Pen, type Point } from "./air-writing";
const alpha = (cutoff: number, dt: number) =>
  1 - Math.exp(-2 * Math.PI * cutoff * dt);
/** Time-aware adaptive low-pass filter: steady at rest, responsive in motion. */
export class SmoothPen {
  private raw: Pen | null = null;
  private filtered: Pen | null = null;
  private velocity = { x: 0, y: 0 };
  private time = 0;
  private missing = false;
  private releaseAt: number | null = null;
  reset() {
    this.raw = this.filtered = null;
    this.velocity = { x: 0, y: 0 };
    this.time = 0;
    this.missing = false;
    this.releaseAt = null;
  }
  update(
    points: Point[] | undefined,
    time: number,
    stabilization = 0.6,
    penDown?: boolean,
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
      if (this.filtered?.down && time - this.time <= 90) {
        this.missing = true;
        return { ...this.filtered }; // Freeze ink; never extrapolate missing landmarks.
      }
      this.reset();
      return null;
    }
    const next = {
      ...detected,
      down: penDown ?? detected.down,
      x: Math.max(0, Math.min(1, 1 - points![8].x)),
      y: Math.max(0, Math.min(1, points![8].y)),
    };
    const recoveredFar =
      (this.missing || this.releaseAt !== null) &&
      this.raw &&
      Math.hypot(next.x - this.raw.x, next.y - this.raw.y) > 0.025;
    this.missing = false;
    // Brief uncertainty near the lift threshold freezes the tip, rather than cutting the stroke.
    if (penDown === undefined && this.filtered?.down && !next.down) {
      const palm = Math.hypot(
        points![0].x - points![9].x,
        points![0].y - points![9].y,
      );
      const ratio =
        Math.hypot(points![4].x - points![8].x, points![4].y - points![8].y) /
        palm;
      this.releaseAt ??= time;
      if (
        ratio < 0.6 &&
        time - this.releaseAt < 45 &&
        !recoveredFar &&
        Math.hypot(next.x - this.filtered.x, next.y - this.filtered.y) < 0.025
      )
        return { ...this.filtered };
    } else this.releaseAt = null;
    const previous = this.raw,
      old = this.filtered;
    const dt = Math.max(1 / 120, Math.min(0.1, (time - this.time) / 1000));
    this.time = time;
    this.raw = next;
    const jump =
      previous && Math.hypot(next.x - previous.x, next.y - previous.y) > 0.18;
    if (
      !previous ||
      !old ||
      previous.down !== next.down ||
      jump ||
      gap ||
      recoveredFar
    ) {
      this.velocity = { x: 0, y: 0 };
      // A gap deliberately lifts the pen once, preventing bridges over lost frames.
      this.filtered = {
        ...next,
        down: gap || jump || recoveredFar ? false : next.down,
      };
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
