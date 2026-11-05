import { plasmaTexture } from "./plasma-texture";
import { ScreenBurst } from "./screen-burst";
import { FireGesture } from "./fire-gesture";
import type { Point } from "./air-writing";
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  seed: number;
  kind: "fire" | "spark" | "smoke";
};
type Shot = { from: Point; to: Point; age: number };
/** A bounded, local Canvas2D particle effect. Never draws onto the export canvas. */
export class FireRenderer {
  private ctx: CanvasRenderingContext2D;
  private core = plasmaTexture("fire");
  private charge = 0;
  private screen: ScreenBurst;
  private escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.reset();
  };
  private gesture = new FireGesture();
  private particles: Particle[] = [];
  private palm: Point | null = null;
  private shot: Shot | null = null;
  private burst: { at: Point; age: number } | null = null;
  private raf: number | null = null;
  private last = 0;
  private sampleAt = 0;
  private previewAt: number | null = null;
  private disposed = false;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private sprites: Record<"fire" | "smoke", HTMLCanvasElement>;
  private hidden = () => {
    if (document.hidden) this.reset();
  };
  constructor(
    private canvas: HTMLCanvasElement,
    screenCanvas: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.sprites = { fire: this.sprite(false), smoke: this.sprite(true) };
    this.screen = new ScreenBurst(
      screenCanvas,
      this.sprites.fire,
      this.sprites.smoke,
    );
    document.addEventListener("keydown", this.escape);
    document.addEventListener("visibilitychange", this.hidden);
    canvas.dataset.phase = "idle";
  }
  private sprite(smoke: boolean) {
    const c = document.createElement("canvas");
    const size = 192;
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const image = ctx.createImageData(size, size);
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const noise = (x: number, y: number) => {
      const ix = Math.floor(x),
        iy = Math.floor(y),
        fx = x - ix,
        fy = y - iy,
        u = fx * fx * (3 - 2 * fx),
        v = fy * fy * (3 - 2 * fy);
      return (
        (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
        (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
      );
    };
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const nx = x / size,
          ny = y / size,
          dx = (nx - 0.5) * 2,
          dy = (ny - 0.5) * 2;
        const turbulence =
          noise(nx * 5, ny * 5) * 0.55 +
          noise(nx * 11 + 3, ny * 11) * 0.3 +
          noise(nx * 25, ny * 25 + 7) * 0.15;
        const radius = Math.hypot(dx, dy),
          field = 0.88 - radius + (turbulence - 0.5) * 0.62;
        const coverage = clamp(field / 0.22);
        const heat = clamp(field * 1.25 + (turbulence - 0.4) * 0.65);
        const i = (y * size + x) * 4;
        image.data[i] = smoke ? 25 + turbulence * 40 : 160 + heat * 95;
        image.data[i + 1] = smoke
          ? 22 + turbulence * 29
          : 25 + Math.pow(heat, 0.9) * 230;
        image.data[i + 2] = smoke
          ? 20 + turbulence * 22
          : Math.pow(heat, 3) * 210;
        image.data[i + 3] =
          coverage *
          coverage *
          (3 - 2 * coverage) *
          (smoke ? 0.38 : 0.94) *
          255;
      }
    ctx.putImageData(image, 0, 0);
    return c;
  }

  update(points: Point[] | undefined, time: number) {
    if (this.disposed || this.previewAt !== null) return;
    const event = this.gesture.update(points, time);
    this.sampleAt = performance.now();
    this.palm = event.palm;
    if (event.launch) this.launch(event.launch);
    this.wake();
  }
  preview() {
    this.reset();
    this.previewAt = performance.now();
    this.palm = { x: 0.3, y: 0.7 };
    this.wake();
  }
  reset() {
    this.gesture.reset();
    this.charge = 0;
    this.particles = [];
    this.palm = null;
    this.shot = null;
    this.burst = null;
    this.previewAt = null;
    this.last = 0;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.dataset.phase = "idle";
    this.screen.clear();
  }
  destroy() {
    this.reset();
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.hidden);
    document.removeEventListener("keydown", this.escape);
  }
  private wake() {
    if (this.raf === null && !this.disposed)
      this.raf = requestAnimationFrame(this.render);
  }
  private launch(origin: Point) {
    if (this.shot || this.burst) return;
    this.palm = null;
    this.shot = {
      from: { x: origin.x * 960, y: origin.y * 540 - 20 },
      to: { x: 480, y: 240 },
      age: 0,
    };
  }
  private emit(x: number, y: number, count: number, blast = false) {
    for (let i = 0; i < count && this.particles.length < 480; i++) {
      const kind = i % 9 === 0 ? "smoke" : i % 6 === 0 ? "spark" : "fire";
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 240;
      const life = blast
        ? 0.45 + Math.random() * 0.9
        : 0.35 + Math.random() * 0.65;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 12,
        vx: blast ? Math.cos(angle) * speed : (Math.random() - 0.5) * 30,
        vy: blast ? Math.sin(angle) * speed : -45 - Math.random() * 95,
        life,
        max: life,
        size:
          kind === "spark"
            ? 1.5 + Math.random() * 2
            : blast
              ? 15 + Math.random() * 28
              : 10 + Math.random() * 20,
        seed: Math.random() * 20,
        kind,
      });
    }
  }
  private glow(x: number, y: number, r: number, alpha = 0.65) {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,244,180,${alpha})`);
    g.addColorStop(0.2, `rgba(255,170,35,${alpha * 0.7})`);
    g.addColorStop(0.55, `rgba(244,62,6,${alpha * 0.2})`);
    g.addColorStop(1, "rgba(190,25,0,0)");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  private render = (time: number) => {
    this.raf = null;
    if (this.disposed) return;
    const dt = Math.min((time - (this.last || time - 16)) / 1000, 0.035);
    this.last = time;
    const reduced = this.motion.matches;
    if (reduced) this.particles = [];
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 960, 540);
    if (this.previewAt !== null && time - this.previewAt >= 850) {
      this.launch({ x: 0.3, y: 0.7 });
      this.previewAt = null;
    }
    if (this.previewAt === null && time - this.sampleAt > 250) this.palm = null;
    if (this.palm) {
      const x = this.palm.x * 960,
        y = this.palm.y * 540 - 12;
      ctx.globalCompositeOperation = "lighter";
      this.charge = Math.min(1, this.charge + dt * 0.65);
      this.glow(x, y - 12, 85 + this.charge * 65, 0.4);
      ctx.save();
      ctx.translate(x, y - 24);
      ctx.rotate(reduced ? 0 : time * 0.0005);
      const radius = 28 + this.charge * 28;
      ctx.drawImage(this.core, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
      if (!reduced)
        this.emit(
          x,
          y,
          Math.max(1, Math.round(dt * (130 + this.charge * 100))),
        );
      else this.glow(x, y - 22, 48, 0.7);
    }
    if (this.shot) {
      const shot = this.shot;
      shot.age += dt;
      const t = Math.min(shot.age / 0.65, 1),
        e = t * t * (3 - 2 * t);
      const x = shot.from.x + (shot.to.x - shot.from.x) * e,
        y =
          shot.from.y +
          (shot.to.y - shot.from.y) * e -
          Math.sin(t * Math.PI) * 50;
      ctx.globalCompositeOperation = "lighter";
      if (!reduced) {
        this.emit(x, y, Math.ceil(dt * 220));
        this.glow(x, y, 25 + t * t * 110, 0.65);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 0.003);
        const radius = 22 + t * t * 130;
        ctx.drawImage(this.core, -radius, -radius, radius * 2, radius * 2);
        ctx.restore();
      }
      if (t >= 1) {
        this.burst = { at: shot.to, age: 0 };
        this.screen.begin(this.canvas.getBoundingClientRect(), shot.to);
        this.shot = null;
        if (!reduced) this.emit(shot.to.x, shot.to.y, 150, true);
      }
    }
    if (this.burst) {
      this.burst.age += dt;
      this.screen.paint(this.burst.age, reduced);
      if (this.burst.age > 2.3) {
        this.burst = null;
        this.screen.clear();
      }
    }
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x +=
        p.vx * dt +
        Math.sin(time * 0.006 + p.seed) * dt * (p.kind === "fire" ? 18 : 2);
      p.y += p.vy * dt;
      p.vx *= Math.exp(-dt * 1.5);
      p.vy += dt * (p.kind === "spark" ? 60 : -20);
      const age = 1 - p.life / p.max;
      ctx.globalAlpha =
        Math.min(1, age * 8) * (1 - age) * (p.kind === "smoke" ? 0.55 : 0.75);
      ctx.globalCompositeOperation =
        p.kind === "smoke" ? "source-over" : "lighter";
      if (p.kind === "spark") {
        ctx.strokeStyle = "#ffca65";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.stroke();
      } else {
        const size =
          p.size * (p.kind === "smoke" ? 1 + age * 2 : 1 - age * 0.55);
        ctx.drawImage(
          this.sprites[p.kind],
          p.x - size,
          p.y - size * 1.4,
          size * 2,
          size * 2.8,
        );
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.canvas.dataset.phase = this.shot
      ? "flying"
      : this.burst
        ? "burst"
        : this.palm
          ? "charging"
          : "idle";
    if (
      this.palm ||
      this.shot ||
      this.burst ||
      this.particles.length ||
      this.previewAt !== null
    )
      this.wake();
    else this.last = 0;
  };
}
