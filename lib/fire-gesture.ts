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
/** Open to arm, close then thrust. Palm-bone growth is a depth cue, not measured distance. */
export class FireGesture {
  private openedAt: number | null = null;
  private closedAt: number | null = null;
  private lastOpen = 0;
  private fistSize = 0;
  private thrustAt: number | null = null;
  private fistCenter: Point | null = null;
  private lastSample: number | null = null;
  private armed = false;
  private origin: Point | null = null;
  reset() {
    this.openedAt = null;
    this.closedAt = null;
    this.thrustAt = null;
    this.fistSize = 0;
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
      this.fistSize = 0;
      this.thrustAt = null;
      this.origin = palm;
      if (time - this.openedAt >= 220) this.armed = true;
      return { palm, launch: null };
    }
    this.openedAt = null;
    if (this.armed && closedFist(points) && time - this.lastOpen < 900) {
      const size =
        (distance(points[0], points[9]) + distance(points[5], points[17])) / 2;
      const center = {
        x: 1 - (points[0].x + points[9].x) / 2,
        y: (points[0].y + points[9].y) / 2,
      };
      if (this.closedAt === null) {
        this.closedAt = time;
        this.fistSize = size;
        this.fistCenter = center;
      }
      const thrust =
        size > this.fistSize * 1.23 && distance(center, this.fistCenter!) < 0.2;
      this.thrustAt = thrust ? (this.thrustAt ?? time) : null;
      if (
        time - this.closedAt >= 80 &&
        this.thrustAt !== null &&
        time - this.thrustAt >= 45
      ) {
        const launch = center;
        this.reset();
        return { palm: null, launch };
      }
      return { palm: this.origin, launch: null };
    }
    this.closedAt = null;
    this.thrustAt = null;
    if (trackPen(points, null)?.down || time - this.lastOpen >= 900) {
      this.armed = false;
      this.origin = null;
    }
    return { palm: null, launch: null };
  }
}
