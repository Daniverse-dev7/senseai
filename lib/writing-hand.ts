import { trackPen, type Point } from "./air-writing";
/** Keep the same writing hand when detection order changes or another hand enters. */
export class WritingHand {
  private wrist: Point | null = null;
  private last = 0;
  reset() {
    this.wrist = null;
    this.last = 0;
  }
  select(hands: Point[][], time: number): Point[] | undefined {
    const valid = hands.filter(
      (p) =>
        p.length >= 21 &&
        p.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y)),
    );
    if (time - this.last > 250) this.wrist = null;
    if (!valid.length) return undefined;
    const anchor = this.wrist;
    const selected = anchor
      ? valid
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a[0].x - anchor.x, a[0].y - anchor.y) -
              Math.hypot(b[0].x - anchor.x, b[0].y - anchor.y),
          )[0]
      : valid.find((p) => trackPen(p, null)?.down) || valid[0];
    if (
      anchor &&
      Math.hypot(selected[0].x - anchor.x, selected[0].y - anchor.y) > 0.18
    )
      return undefined;
    this.wrist = { ...selected[0] };
    this.last = time;
    return selected;
  }
}
