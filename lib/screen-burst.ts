import type { Point } from "./air-writing";
/** Fixed-viewport explosion, separate from camera effects and exported ink. */
export class ScreenBurst {
  private ctx: CanvasRenderingContext2D;
  private origin: Point = { x: 0.5, y: 0.45 };
  private lobes = Array.from({ length: 64 }, (_, i) => ({
    angle: i * 2.399963,
    size: 0.055 + Math.random() * 0.06,
    travel: 0.12 + Math.random() * 0.75,
    seed: Math.random() * 10,
  }));
  constructor(
    private canvas: HTMLCanvasElement,
    private flame: HTMLCanvasElement,
    private smoke: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext("2d")!;
    canvas.dataset.phase = "idle";
  }
  begin(stage: DOMRect, point: Point) {
    this.origin = {
      x:
        Math.max(
          0.25,
          Math.min(
            0.75,
            (stage.left + (point.x / 960) * stage.width) / innerWidth,
          ),
        ) *
          0.45 +
        0.5 * 0.55,
      y:
        Math.max(
          0.25,
          Math.min(
            0.65,
            (stage.top + (point.y / 540) * stage.height) / innerHeight,
          ),
        ) *
          0.45 +
        0.45 * 0.55,
    };
  }
  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.dataset.phase = "idle";
  }
  paint(age: number, reduced: boolean) {
    const w = innerWidth,
      h = innerHeight,
      dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2100000 / (w * h)));
    const pw = Math.round(w * dpr),
      ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    this.canvas.dataset.phase = "burst";
    this.canvas.dataset.stage =
      age < 0.55 ? "ignition" : age < 1.4 ? "expanding" : "cooling";
    const x = this.origin.x * w,
      y = this.origin.y * h,
      diag = Math.hypot(w, h),
      fade = Math.max(
        0,
        Math.min(1, age / 0.12) * (1 - Math.max(0, age - 1.1) / 1.2),
      );
    if (reduced) {
      const g = c.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * 0.25);
      g.addColorStop(0, `rgba(255,140,45,${fade * 0.3})`);
      g.addColorStop(1, "rgba(255,70,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      return;
    }
    const expansion = 1 - Math.exp(-age * 2.6),
      wave = diag * 0.85 * expansion;
    // A single warm exposure pulse, followed by cooling smoke rather than flashing.
    const wash = c.createRadialGradient(x, y, 0, x, y, diag * 0.8);
    wash.addColorStop(0, `rgba(255,160,65,${fade * 0.32})`);
    wash.addColorStop(0.35, `rgba(195,48,9,${fade * 0.24})`);
    wash.addColorStop(1, `rgba(18,8,5,${fade * 0.5})`);
    c.fillStyle = wash;
    c.fillRect(0, 0, w, h);
    for (const l of this.lobes) {
      const radius = wave * l.travel,
        px = x + Math.cos(l.angle) * radius,
        py = y + Math.sin(l.angle) * radius * 0.9 - age * 24;
      const size = diag * l.size * (0.25 + expansion * 1.6);
      const cooling = Math.max(0, (age - 1) * 0.9);
      c.save();
      c.translate(px, py);
      c.rotate(l.angle * 0.2 + Math.sin(l.seed + age) * 0.12);
      c.globalAlpha = fade * 0.65;
      c.globalCompositeOperation = "source-over";
      c.drawImage(
        this.smoke,
        -size * 1.25,
        -size * 1.25,
        size * 2.5,
        size * 2.5,
      );
      c.globalAlpha =
        fade * Math.max(0, 0.8 - cooling) * (0.65 + Math.sin(l.seed) * 0.15);
      c.drawImage(this.flame, -size, -size * 1.2, size * 2, size * 2.4);
      c.restore();
    }
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 1;
    const ringRadius = wave * 1.1;
    c.strokeStyle = `rgba(255,195,115,${fade * 0.22})`;
    c.lineWidth = Math.max(1, 12 * (1 - expansion));
    c.beginPath();
    c.ellipse(x, y, ringRadius, ringRadius * 0.85, 0, 0, Math.PI * 2);
    c.stroke();
    // Fast radial embers keep a crisp sense of velocity above the rolling fire.
    for (let i = 0; i < 100; i++) {
      const theta = i * 2.399963,
        velocity = 0.3 + (i % 11) / 12,
        travel = diag * age * velocity * 0.75;
      const sx = x + Math.cos(theta) * travel,
        sy = y + Math.sin(theta) * travel + age * age * 30;
      c.strokeStyle = `rgba(255,${150 + (i % 80)},65,${fade * Math.max(0, 1 - age / 2)})`;
      c.lineWidth = i % 3 === 0 ? 2 : 1;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(
        sx - Math.cos(theta) * (12 + age * 15),
        sy - Math.sin(theta) * (12 + age * 15),
      );
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
  }
}
