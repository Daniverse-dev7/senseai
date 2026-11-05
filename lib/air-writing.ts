export type Point = { x: number; y: number };
export type Pen = Point & { down: boolean };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** MediaPipe normalized landmarks; mirror X to match the selfie preview. */
export function trackPen(
  landmarks: Point[] | undefined,
  previous: Pen | null,
): Pen | null {
  if (
    !landmarks ||
    landmarks.length < 21 ||
    landmarks.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const palm = distance(landmarks[0], landmarks[9]);
  if (palm < 0.02) return null;
  const pinch = distance(landmarks[4], landmarks[8]) / palm;
  const down = pinch < (previous?.down ? 0.45 : 0.32);
  const next = {
    x: Math.max(0, Math.min(1, 1 - landmarks[8].x)),
    y: Math.max(0, Math.min(1, landmarks[8].y)),
    down,
  };
  // Smooth small jitter; never connect a jump or a newly raised/lowered pen.
  return previous && down && previous.down && distance(previous, next) < 0.18
    ? {
        ...next,
        x: previous.x + (next.x - previous.x) * 0.45,
        y: previous.y + (next.y - previous.y) * 0.45,
      }
    : next;
}
export function connects(previous: Pen | null, next: Pen | null) {
  return !!(previous?.down && next?.down && distance(previous, next) < 0.18);
}
