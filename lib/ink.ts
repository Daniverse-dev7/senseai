import type { Point } from "./air-writing";
export type Stroke = { points: Point[]; color: string; width: number };
function style(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = (s.width * ctx.canvas.width) / 1280;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
const mid = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
/** Append a quadratic segment without repainting the entire drawing each frame. */
export function appendInk(ctx: CanvasRenderingContext2D, s: Stroke) {
  style(ctx, s);
  const n = s.points.length,
    w = ctx.canvas.width,
    h = ctx.canvas.height;
  const last = s.points[n - 1];
  if (n === 1) {
    ctx.beginPath();
    ctx.arc(last.x * w, last.y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const previous = s.points[n - 2],
    start = n > 2 ? mid(s.points[n - 3], previous) : previous,
    end = mid(previous, last);
  ctx.beginPath();
  ctx.moveTo(start.x * w, start.y * h);
  ctx.quadraticCurveTo(previous.x * w, previous.y * h, end.x * w, end.y * h);
  ctx.stroke();
}
export function finishInk(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length < 2) return;
  style(ctx, s);
  const last = s.points.at(-1)!,
    from = mid(s.points.at(-2)!, last);
  ctx.beginPath();
  ctx.moveTo(from.x * ctx.canvas.width, from.y * ctx.canvas.height);
  ctx.lineTo(last.x * ctx.canvas.width, last.y * ctx.canvas.height);
  ctx.stroke();
}
export function repaintInk(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of strokes) {
    style(ctx, s);
    const w = ctx.canvas.width,
      h = ctx.canvas.height;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
    for (let i = 1; i < s.points.length; i++) {
      const end = mid(s.points[i - 1], s.points[i]);
      ctx.quadraticCurveTo(
        s.points[i - 1].x * w,
        s.points[i - 1].y * h,
        end.x * w,
        end.y * h,
      );
    }
    ctx.lineTo(s.points.at(-1)!.x * w, s.points.at(-1)!.y * h);
    ctx.stroke();
    if (s.points.length === 1) appendInk(ctx, s);
  }
}
