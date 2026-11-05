import { openPalm, trackPen, type Point } from "./air-writing";
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function closedFist(points: Point[] | undefined): boolean {
  if (
    !points ||
    points.length < 21 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return false;
  const scale = distance(points[0], points[9]);
  return (
    scale >= 0.02 &&
    [5, 9, 13, 17].every(
      (base) =>
        distance(points[base + 3], points[0]) <
          distance(points[base + 1], points[0]) * 1.08 &&
        distance(points[base + 3], points[base]) < scale * 0.65,
    )
  );
}
/** Debounced open -> closed transition. Tracking loss never counts as a fist. */
export class FireGesture {
  private openedAt: number | null = null;
  private closedAt: number | null = null;
  private lastOpen = 0;
  private lastSample: number | null = null;
  private armed = false;
  private origin: Point | null = null;
  reset() {
    this.openedAt = null;
    this.closedAt = null;
    this.lastSample = null;
    this.armed = false;
    this.origin = null;
  }
  update(
    points: Point[] | undefined,
    time: number,
  ): { palm: Point | null; launch: Point | null } {
    if (this.lastSample !== null && time - this.lastSample > 250) this.reset();
    this.lastSample = time;
    if (
      !points ||
      points.length < 21 ||
      points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    ) {
      this.reset();
      return { palm: null, launch: null };
    }
    const palm = openPalm(points);
    if (palm) {
      this.openedAt ??= time;
      this.lastOpen = time;
      this.closedAt = null;
      this.origin = palm;
      if (time - this.openedAt >= 220) this.armed = true;
      return { palm, launch: null };
    }
    this.openedAt = null;
    if (this.armed && closedFist(points) && time - this.lastOpen < 900) {
      this.closedAt ??= time;
      if (time - this.closedAt >= 80) {
        const launch = this.origin;
        this.reset();
        return { palm: null, launch };
      }
      return { palm: this.origin, launch: null };
    }
    this.closedAt = null;
    if (trackPen(points, null)?.down || time - this.lastOpen >= 900) {
      this.armed = false;
      this.origin = null;
    }
    return { palm: null, launch: null };
  }
}
