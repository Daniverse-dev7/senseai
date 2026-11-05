import { ElementGesture, type ElementMode } from "./element-gesture";
import type { Point } from "./air-writing";
import type { Stroke } from "./ink";
const TAU = Math.PI * 2;
/** Bounded scene effects; no writes to camera or saved ink. */
export class ElementRenderer {
  private c: CanvasRenderingContext2D;
  private gesture = new ElementGesture();
  private frost = this.makeFrost();
  private mode: ElementMode = "lightning";
  private frame = 0;
  private start = 0;
  private sample = 0;
  private preview = false;
  private phase = "idle";
  private palms: Point[] = [];
  private target: Point = { x: 0.5, y: 0.5 };
  private sprite: HTMLCanvasElement | null = null;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");
  private disposed = false;
  private escape = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.reset();
  };
  private hidden = () => {
    if (document.hidden) this.reset();
  };
  constructor(private canvas: HTMLCanvasElement) {
    this.c = canvas.getContext("2d")!;
    canvas.dataset.phase = "idle";
    document.addEventListener("keydown", this.escape);
    document.addEventListener("visibilitychange", this.hidden);
  }
  reset() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.phase = "idle";
    this.preview = false;
    this.palms = [];
    this.sprite = null;
    this.gesture.reset();
    this.c.clearRect(0, 0, 960, 540);
    this.canvas.dataset.phase = "idle";
  }
  destroy() {
    this.reset();
    this.disposed = true;
    document.removeEventListener("keydown", this.escape);
    document.removeEventListener("visibilitychange", this.hidden);
  }
  update(mode: ElementMode, hands: Point[][], time: number) {
    if (this.preview || this.disposed) return;
    this.mode = mode;
    this.sample = performance.now();
    const e = this.gesture.update(mode, hands, time);
    this.palms = e.palms;
    if (e.palms[0]) this.target = e.palms[0];
    if (mode === "lightning" && this.phase !== "lightning-release") {
      if (e.palms.length === 2) this.begin("lightning-linked", false);
      else if (!e.launch) this.phase = "idle";
      if (e.launch) this.begin("lightning-release");
    }
    if (mode === "ice") {
      if (e.freeze && this.phase === "idle") this.begin("ice-freezing");
      if (e.crack && ["ice-freezing", "ice-frozen"].includes(this.phase))
        this.begin("ice-cracked");
      if (e.launch && this.phase === "ice-cracked")
        this.begin("ice-shattering");
    }
    this.wake();
  }
  private begin(phase: string, restart = true) {
    if (restart || this.phase !== phase) this.start = performance.now();
    this.phase = phase;
    this.wake();
  }
  private wake() {
    if (!this.frame && !this.disposed && this.phase !== "idle")
      this.frame = requestAnimationFrame(this.paint);
  }
  previewEffect(mode: ElementMode) {
    this.reset();
    this.mode = mode;
    this.preview = true;
    this.palms = [
      { x: 0.27, y: 0.5 },
      { x: 0.73, y: 0.5 },
    ];
    if (mode === "living") this.makeButterfly();
    this.begin(
      mode === "lightning"
        ? "lightning-linked"
        : mode === "ice"
          ? "ice-freezing"
          : "living-flight",
    );
  }
  awaken(ink: HTMLCanvasElement, strokes: Stroke[]) {
    if (this.phase === "living-flight" || !strokes.length) return;
    const points = strokes.flatMap((s) => s.points);
    if (!points.length) return;
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const x = Math.max(0, minX * ink.width - 25),
      y = Math.max(0, minY * ink.height - 25);
    const w = Math.min(ink.width - x, (maxX - minX) * ink.width + 50),
      h = Math.min(ink.height - y, (maxY - minY) * ink.height + 50);
    this.sprite = document.createElement("canvas");
    this.sprite.width = 384;
    this.sprite.height = Math.max(1, Math.round((384 * h) / w));
    if (this.sprite.height > 384) {
      this.sprite.width = Math.max(1, Math.round((384 * w) / h));
      this.sprite.height = 384;
    }
    this.sprite
      .getContext("2d")!
      .drawImage(ink, x, y, w, h, 0, 0, this.sprite.width, this.sprite.height);
    this.mode = "living";
    this.begin("living-flight");
  }
  private makeButterfly() {
    const s = document.createElement("canvas");
    s.width = 360;
    s.height = 280;
    const c = s.getContext("2d")!;
    c.translate(180, 140);
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      const g = c.createLinearGradient(0, -90, 140, 80);
      g.addColorStop(0, "#e8fcff");
      g.addColorStop(0.4, "#58baf9");
      g.addColorStop(1, "#37236c");
      c.fillStyle = g;
      c.strokeStyle = "#bdeaff";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(110, -175, 205, -100, 115, 0);
      c.bezierCurveTo(170, 100, 35, 150, 0, 0);
      c.fill();
      c.stroke();
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(45, i * 15 - 65, 115 - i * 7, i * 20 - 85);
        c.strokeStyle = "#081d5480";
        c.lineWidth = 1;
        c.stroke();
      }
      c.restore();
    }
    c.fillStyle = "#e6f7ff";
    c.beginPath();
    c.ellipse(0, 0, 5, 45, 0, 0, TAU);
    c.fill();
    this.sprite = s;
  }
  private bolt(a: Point, b: Point, t: number) {
    const c = this.c;
    const points: Point[] = [];
    for (let i = 0; i <= 34; i++) {
      const u = i / 34;
      points.push({
        x: a.x + (b.x - a.x) * u,
        y:
          a.y +
          (b.y - a.y) * u +
          ((Math.sin(i * 127.1 + Math.floor(t * 12) * 311.7) * 43758.5453) %
            1) *
            Math.sin(Math.PI * u) *
            26,
      });
    }
    for (const [width, color] of [
      [16, "#395dff22"],
      [6, "#72b9ff77"],
      [1.8, "#edfcff"],
    ] as const) {
      c.lineWidth = width;
      c.strokeStyle = color;
      c.beginPath();
      points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
    }
    c.strokeStyle = "#9bd9ff99";
    c.lineWidth = 1;
    for (let i = 5; i < 30; i += 5) {
      const p = points[i];
      c.beginPath();
      c.moveTo(p.x, p.y);
      for (let j = 1; j < 6; j++)
        c.lineTo(
          p.x + j * 9,
          p.y + Math.sin(j * 3 + i + t) * 10 + j * (i % 2 ? 7 : -7),
        );
      c.stroke();
    }
    for (const p of [a, b]) {
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 65);
      g.addColorStop(0, "#ccf6ffb0");
      g.addColorStop(0.2, "#508dff60");
      g.addColorStop(1, "#2244ff00");
      c.fillStyle = g;
      c.fillRect(p.x - 65, p.y - 65, 130, 130);
    }
  }
  private makeFrost() {
    const texture = document.createElement("canvas");
    texture.width = 960;
    texture.height = 540;
    const c = texture.getContext("2d")!;
    const base = c.createLinearGradient(0, 0, 960, 540);
    base.addColorStop(0, "#b9eaff55");
    base.addColorStop(0.5, "#5e9fbb22");
    base.addColorStop(1, "#d5f5ff66");
    c.fillStyle = base;
    c.fillRect(0, 0, 960, 540);
    const rand = (n: number) => {
      const a = Math.sin(n * 127.1) * 43758.5453;
      return a - Math.floor(a);
    };
    const branch = (
      x: number,
      y: number,
      a: number,
      len: number,
      depth: number,
    ) => {
      const ex = x + Math.cos(a) * len,
        ey = y + Math.sin(a) * len;
      c.lineWidth = depth * 0.35;
      c.strokeStyle = `rgba(215,246,255,${0.12 + depth * 0.12})`;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(ex, ey);
      c.stroke();
      if (depth > 0)
        for (let k = 1; k <= 4; k++)
          for (const side of [-1, 1])
            branch(
              x + ((ex - x) * k) / 5,
              y + ((ey - y) * k) / 5,
              a + side * 0.65,
              len * 0.22,
              depth - 1,
            );
    };
    for (let i = 0; i < 48; i++) {
      const x = rand(i + 4) * 960,
        y = rand(i + 174) * 540,
        a = rand(i + 88) * TAU,
        len = 30 + rand(i + 39) * 85;
      for (let spoke = 0; spoke < 6; spoke++)
        branch(x, y, a + (spoke * TAU) / 6, len, 2);
      const glow = c.createRadialGradient(x, y, 0, x, y, len);
      glow.addColorStop(0, "#dbfaff22");
      glow.addColorStop(1, "#dbfaff00");
      c.fillStyle = glow;
      c.fillRect(x - len, y - len, len * 2, len * 2);
    }
    for (let i = 0; i < 2500; i++) {
      c.fillStyle = i % 3 ? "#d9f7ff25" : "#ffffff77";
      c.fillRect(rand(i + 650) * 960, rand(i + 3500) * 540, 1, 1);
    }
    return texture;
  }
  private ice(age: number) {
    const c = this.c,
      shatter = this.phase === "ice-shattering";
    const amount = this.phase === "ice-freezing" ? Math.min(1, age / 1.4) : 1;
    c.save();
    c.globalAlpha = shatter ? Math.max(0, 1 - age / 1.6) : 1;
    if (!shatter) {
      c.save();
      c.beginPath();
      c.rect(0, 0, 960 * amount, 540);
      c.clip();
      c.drawImage(this.frost, 0, 0);
      c.restore();
    }
    const vertex = (col: number, row: number) => ({
      x:
        col * 96 +
        (col > 0 && col < 10 ? Math.sin(col * 17 + row * 9) * 24 : 0),
      y:
        row * 90 + (row > 0 && row < 6 ? Math.sin(col * 7 + row * 19) * 22 : 0),
    });
    if (shatter || this.phase === "ice-cracked")
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 10; col++)
          for (let half = 0; half < 2; half++) {
            const a = vertex(col, row),
              b = vertex(col + 1, row + 1),
              d = half ? vertex(col, row + 1) : vertex(col + 1, row);
            const x = (a.x + b.x + d.x) / 3,
              y = (a.y + b.y + d.y) / 3,
              seed = row * 21 + col * 2 + half;
            c.save();
            if (shatter && !this.reduced.matches) {
              c.translate(
                x + (x - 480) * age * 0.65,
                y + (y - 270) * age * 0.6 + age * age * 240,
              );
              c.rotate(Math.sin(seed * 17) * age * 2);
              c.translate(-x, -y);
            }
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.lineTo(d.x, d.y);
            c.closePath();
            c.strokeStyle = "#e8fcff99";
            c.lineWidth = 0.8;
            c.stroke();
            if (shatter) {
              c.clip();
              c.drawImage(this.frost, 0, 0);
            }
            c.restore();
          }
    c.restore();
  }
  private paint = (now: number) => {
    this.frame = 0;
    const c = this.c;
    c.clearRect(0, 0, 960, 540);
    let age = (now - this.start) / 1000;
    const t = this.reduced.matches ? 0 : now / 1000;
    if (this.preview) {
      if (this.phase === "lightning-linked" && age > 1.8)
        this.begin("lightning-release");
      if (this.phase === "ice-frozen" && age > 1) this.begin("ice-cracked");
      if (this.phase === "ice-cracked" && age > 0.8)
        this.begin("ice-shattering");
    }
    age = Math.max(0, (now - this.start) / 1000);
    if (this.phase === "lightning-linked") {
      if (!this.preview && now - this.sample > 300) this.phase = "idle";
      else if (this.palms.length === 2)
        this.bolt(
          { x: this.palms[0].x * 960, y: this.palms[0].y * 540 },
          { x: this.palms[1].x * 960, y: this.palms[1].y * 540 },
          t,
        );
    } else if (this.phase === "lightning-release") {
      c.globalAlpha = Math.max(0, 1 - age / 1.2);
      for (let i = 0; i < 5; i++)
        this.bolt(
          { x: this.target.x * 960, y: this.target.y * 540 },
          {
            x:
              480 +
              Math.cos(i * 1.7) * (this.reduced.matches ? 0.2 : age) * 750,
            y:
              270 +
              Math.sin(i * 1.7) * (this.reduced.matches ? 0.2 : age) * 420,
          },
          t + i,
        );
      c.globalAlpha = 1;
      if (age > 1.2) this.phase = "idle";
    } else if (this.phase.startsWith("ice-")) {
      this.ice(age);
      if (this.phase === "ice-freezing" && age > 1.4) this.begin("ice-frozen");
      if (
        (this.phase === "ice-shattering" && age > 1.6) ||
        (this.phase === "ice-frozen" && age > 8) ||
        (this.phase === "ice-cracked" && age > 5)
      )
        this.phase = "idle";
    } else if (this.phase === "living-flight" && this.sprite) {
      const follow =
        !this.preview && now - this.sample < 300 && this.palms.length;
      const x = follow ? this.target.x * 960 : 480 + Math.sin(t * 0.8) * 190,
        y = follow ? this.target.y * 540 - 80 : 260 + Math.sin(t * 1.3) * 60;
      c.save();
      c.translate(x, y);
      c.rotate(this.reduced.matches ? 0 : Math.sin(t * 1.4) * 0.13);
      const flap = this.reduced.matches
        ? 1
        : 0.65 + Math.abs(Math.sin(t * 5)) * 0.35;
      c.globalAlpha = Math.min(1, age * 2, Math.max(0, (10 - age) / 1.2));
      c.shadowColor = "#85ddff";
      c.shadowBlur = 14;
      const w = 200 * flap,
        h = (200 * this.sprite.height) / this.sprite.width;
      c.drawImage(this.sprite, -w / 2, -h / 2, w, h);
      c.shadowBlur = 0;
      for (let i = 0; i < 24; i++) {
        c.globalAlpha *= 0.96;
        c.fillStyle = "#b8e9ff";
        c.beginPath();
        c.arc(-i * 7, Math.sin(t * 2 + i) * 12, 1.5, 0, TAU);
        c.fill();
      }
      c.restore();
      if (age > 10) this.phase = "idle";
    }
    this.canvas.dataset.phase = this.phase;
    if (this.phase !== "idle") this.wake();
    else {
      this.preview = false;
      c.clearRect(0, 0, 960, 540);
    }
  };
}
