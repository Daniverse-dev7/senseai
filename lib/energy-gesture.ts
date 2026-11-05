import { openPalm, type Point } from "./air-writing";
export type Orb = { center: Point; radius: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** Uses two visible open palms. Apparent size growth is a gesture cue, not distance. */
export class EnergyGesture {
  private history: { time: number; sizes: number[]; center: Point }[] = [];
  private cooldown = 0;
  reset() {
    this.history = [];
    this.cooldown = 0;
  }
  update(
    hands: Point[][],
    time: number,
  ): { orb: Orb | null; release: Orb | null } {
    const palms = hands.length === 2 ? hands.map(openPalm) : [];
    if (palms.length !== 2 || !palms[0] || !palms[1]) {
      this.history = [];
      return { orb: null, release: null };
    }
    const centers = palms as Point[];
    const gap = distance(centers[0], centers[1]);
    if (gap < 0.12 || gap > 0.85) {
      this.history = [];
      return { orb: null, release: null };
    }
    const center = {
      x: (centers[0].x + centers[1].x) / 2,
      y: (centers[0].y + centers[1].y) / 2,
    };
    const sizes = hands.map((p) => distance(p[0], p[9])).sort((a, b) => a - b);
    const orb = { center, radius: Math.min(0.22, Math.max(0.055, gap * 0.32)) };
    if (time < this.cooldown) return { orb: null, release: null };
    if (this.history.length && time - this.history.at(-1)!.time > 250)
      this.history = [];
    this.history = this.history.filter((s) => time - s.time < 550);
    const first = this.history[0];
    this.history.push({ time, sizes, center });
    if (
      first &&
      time - first.time >= 240 &&
      sizes.every((size, i) => size > first.sizes[i] * 1.28) &&
      distance(center, first.center) < 0.18
    ) {
      this.history = [];
      this.cooldown = time + 1700;
      return { orb: null, release: orb };
    }
    return { orb, release: null };
  }
}
