import { openPalm, type Point } from "./air-writing";
import { FireGesture, closedFist } from "./fire-gesture";
export type ElementMode = "lightning" | "ice" | "living";
export class ElementGesture {
  private release = [new FireGesture(), new FireGesture()];
  private sweep: { p: Point; time: number } | null = null;
  private last = 0;
  private frozen = false;
  reset() {
    this.release.forEach((g) => g.reset());
    this.sweep = null;
    this.frozen = false;
    this.last = 0;
  }
  update(mode: ElementMode, hands: Point[][], time: number) {
    if (time - this.last > 250) this.reset();
    this.last = time;
    const ordered = hands.slice().sort((a, b) => a[0].x - b[0].x);
    const palms = ordered.map(openPalm);
    const events = this.release.map((g, i) => g.update(ordered[i], time));
    let freeze = false;
    if (mode === "ice" && ordered.length === 1 && palms[0]) {
      if (!this.sweep || time - this.sweep.time > 650)
        this.sweep = { p: palms[0], time };
      if (Math.abs(palms[0].x - this.sweep.p.x) > 0.18) {
        freeze = true;
        this.frozen = true;
      }
    }
    if (!ordered.length) this.sweep = null;
    return {
      palms: palms.filter((p): p is Point => !!p),
      launch:
        mode === "lightning" && ordered.length === 2
          ? (events.find((e) => e.launch)?.launch ?? null)
          : mode === "ice" && this.frozen
            ? events[0].launch
            : null,
      freeze,
      crack:
        mode === "ice" &&
        this.frozen &&
        ordered.length === 1 &&
        closedFist(ordered[0]),
    };
  }
}
