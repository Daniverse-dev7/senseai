import type { Point } from "./air-writing";
export type Portal = {
  center: Point;
  radiusX: number;
  radiusY: number;
  score: number;
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** Geometry-only closed-circle match; uses aspect-correct, uniformly spaced samples. */
export function recognizePortal(
  points: Point[],
  aspect = 16 / 9,
): Portal | null {
  if (
    points.length < 16 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const raw = points.map((p) => ({ x: p.x * aspect, y: p.y }));
  const lengths = [0];
  for (let i = 1; i < raw.length; i++)
    lengths.push(lengths[i - 1] + distance(raw[i - 1], raw[i]));
  const length = lengths.at(-1)!;
  if (length < 0.3) return null;
  const samples: Point[] = [];
  let j = 1;
  for (let i = 0; i < 64; i++) {
    const target = (length * i) / 63;
    while (j < raw.length - 1 && lengths[j] < target) j++;
    const mix = (target - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1);
    samples.push({
      x: raw[j - 1].x + (raw[j].x - raw[j - 1].x) * mix,
      y: raw[j - 1].y + (raw[j].y - raw[j - 1].y) * mix,
    });
  }
  const xs = samples.map((p) => p.x),
    ys = samples.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const width = maxX - minX,
    height = maxY - minY;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    radius = (width + height) / 4;
  if (
    radius < 0.065 ||
    width / height < 0.65 ||
    width / height > 1.5 ||
    distance(raw[0], raw.at(-1)!) > radius * 0.45
  )
    return null;
  const radii = samples.map((p) => distance(p, center));
  const error =
    Math.sqrt(
      radii.reduce((sum, r) => sum + (r - radius) ** 2, 0) / radii.length,
    ) / radius;
  const bins = new Set(
    samples.map(
      (p) =>
        Math.floor(
          ((Math.atan2(p.y - center.y, p.x - center.x) + Math.PI) /
            (Math.PI * 2)) *
            24,
        ) % 24,
    ),
  );
  let sweep = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    sweep += Math.atan2(
      (a.x - center.x) * (b.y - center.y) - (a.y - center.y) * (b.x - center.x),
      (a.x - center.x) * (b.x - center.x) + (a.y - center.y) * (b.y - center.y),
    );
  }
  const circumference = length / (2 * Math.PI * radius);
  if (
    error > 0.18 ||
    bins.size < 21 ||
    Math.abs(sweep) < Math.PI * 1.65 ||
    Math.abs(sweep) > Math.PI * 2.4 ||
    circumference < 0.75 ||
    circumference > 1.35
  )
    return null;
  return {
    center: { x: center.x / aspect, y: center.y },
    radiusX: radius / aspect,
    radiusY: radius,
    score: Math.max(0, 1 - error),
  };
}
