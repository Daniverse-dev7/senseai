import { EnergyGesture, type Orb } from "./energy-gesture";
import type { Portal } from "./portal";
import type { Point } from "./air-writing";
/** Camera-local effects share one overlay, separate from handwriting and export. */
export class MagicRenderer {
  private ctx: CanvasRenderingContext2D;
  private energy = new EnergyGesture();
  private orb: Orb | null = null;
  private portal: { shape: Portal; start: number } | null = null;
  private released: { orb: Orb; start: number } | null = null;
  private previewStart: number | null = null;
  private lastSample = 0;
  private frame: number | null = null;
  private disposed = false;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private escape = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.reset();
  };
  private hidden = () => {
    if (document.hidden) this.reset();
  };
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    canvas.dataset.phase = "idle";
    document.addEventListener("keydown", this.escape);
    document.addEventListener("visibilitychange", this.hidden);
  }
  updateHands(hands: Point[][], time: number) {
    if (this.previewStart !== null || this.disposed) return;
    const event = this.energy.update(hands, time);
    this.lastSample = performance.now();
    if (event.orb) {
      const old = this.orb;
      this.orb = old
        ? {
            center: {
              x: old.center.x + (event.orb.center.x - old.center.x) * 0.35,
              y: old.center.y + (event.orb.center.y - old.center.y) * 0.35,
            },
            radius: old.radius + (event.orb.radius - old.radius) * 0.35,
          }
        : event.orb;
    } else this.orb = null;
    if (event.release)
      this.released = { orb: event.release, start: performance.now() };
    this.wake();
  }
  previewEnergy() {
    this.reset();
    this.previewStart = performance.now();
    this.wake();
  }
  openPortal(shape: Portal) {
    this.reset();
    this.portal = { shape, start: performance.now() };
    this.wake();
  }
  previewPortal() {
    this.openPortal({
      center: { x: 0.5, y: 0.5 },
      radiusX: 0.18,
      radiusY: 0.32,
      score: 1,
    });
  }
  reset() {
    this.energy.reset();
    this.orb = null;
    this.portal = null;
    this.released = null;
    this.previewStart = null;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.ctx.clearRect(0, 0, 960, 540);
    this.canvas.dataset.phase = "idle";
  }
  destroy() {
    this.reset();
    this.disposed = true;
    document.removeEventListener("keydown", this.escape);
    document.removeEventListener("visibilitychange", this.hidden);
  }
  private wake() {
    if (this.frame === null && !this.disposed)
      this.frame = requestAnimationFrame(this.render);
  }
  private drawOrb(orb: Orb, time: number, alpha = 1) {
    const c = this.ctx,
      x = orb.center.x * 960,
      y = orb.center.y * 540,
      r = orb.radius * 960,
      t = this.motion.matches ? 0 : time * 0.001;
    c.save();
    c.translate(x, y);
    c.globalAlpha = alpha;
    c.globalCompositeOperation = "lighter";
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
    glow.addColorStop(0, "#d6ffffb0");
    glow.addColorStop(0.22, "#5eeaff70");
    glow.addColorStop(0.55, "#6f40ff35");
    glow.addColorStop(1, "#4020ff00");
    c.fillStyle = glow;
    c.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6);
    for (let j = 0; j < 5; j++) {
      c.save();
      c.rotate(t * 0.35 + (j * Math.PI) / 5);
      c.strokeStyle = j % 2 ? "#b78cff" : "#65f5ff";
      c.lineWidth = 1.2 + j * 0.25;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 12;
      c.beginPath();
      c.ellipse(0, 0, r, r * (0.25 + j * 0.13), 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    for (let j = 0; j < 7; j++) {
      c.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2,
          noise = Math.sin(a * 7 + t * 5 + j) * Math.sin(a * 3 - t * 2 + j),
          radius = r * (0.93 + noise * 0.09);
        const px = Math.cos(a + j) * radius,
          py = Math.sin(a + j) * radius;
        if (!i) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.strokeStyle = j % 2 ? "#7d82ff75" : "#b4fcff90";
      c.lineWidth = 0.8;
      c.stroke();
    }
    for (let i = 0; i < 28; i++) {
      const a = i * 2.39996 + t * 0.6,
        rr = r * (1.05 + (i % 5) * 0.09);
      c.fillStyle = i % 2 ? "#ae94ff" : "#c1ffff";
      c.beginPath();
      c.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1 + (i % 2), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  private drawPortal(shape: Portal, age: number, time: number) {
    const c = this.ctx,
      t = this.motion.matches ? 0 : time * 0.001;
    const grow = this.motion.matches ? 1 : Math.min(1, age / 0.5),
      fade = Math.min(1, (7 - age) / 0.7);
    const x = shape.center.x * 960,
      y = shape.center.y * 540,
      rx = shape.radiusX * 960 * grow,
      ry = shape.radiusY * 540 * grow;
    if (rx < 1 || ry < 1 || fade <= 0) return;
    c.save();
    c.translate(x, y);
    c.scale(rx, ry);
    c.globalAlpha = fade;
    c.save();
    c.beginPath();
    c.arc(0, 0, 0.98, 0, Math.PI * 2);
    c.clip();
    const voidGlow = c.createRadialGradient(0.12, -0.1, 0, 0, 0, 1);
    voidGlow.addColorStop(0, "#02020c");
    voidGlow.addColorStop(0.45, "#111037");
    voidGlow.addColorStop(0.8, "#4e2166");
    voidGlow.addColorStop(1, "#ff762a");
    c.fillStyle = voidGlow;
    c.fillRect(-1, -1, 2, 2);
    for (let j = 0; j < 15; j++) {
      const z = (j / 15 + t * 0.13) % 1,
        angle = t * 0.28 + j * 0.7;
      c.strokeStyle = `rgba(145,121,255,${z * 0.4})`;
      c.lineWidth = 0.006;
      c.beginPath();
      c.ellipse(
        Math.cos(angle) * 0.08,
        Math.sin(angle) * 0.08,
        z,
        z * 0.8,
        angle,
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
    for (let j = 0; j < 90; j++) {
      const a = j * 2.39996 + t * 0.2,
        r = ((j % 29) / 29 + t * 0.09) % 1;
      c.fillStyle = j % 3 ? "#b3b5ff" : "#fff4dd";
      c.beginPath();
      c.arc(
        Math.cos(a) * r,
        Math.sin(a) * r,
        0.003 + r * 0.006,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.restore();
    c.globalCompositeOperation = "lighter";
    for (let j = 0; j < 4; j++) {
      c.strokeStyle = ["#ff5e1bb0", "#ffa83dcc", "#fff1b0", "#ffbd6270"][j];
      c.lineWidth = [0.07, 0.035, 0.012, 0.01][j];
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2,
          r = 1 + j * 0.012 + Math.sin(a * 13 + t * 3 + j) * 0.012;
        if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.stroke();
    }
    if (!this.motion.matches)
      for (let j = 0; j < 65; j++) {
        const a = j * 2.39996 + t * 0.9,
          life = (j / 65 + t * 0.65) % 1,
          r = 1 + life * 0.27;
        c.globalAlpha = fade * (1 - life);
        c.strokeStyle = j % 2 ? "#ffb358" : "#fff3c0";
        c.lineWidth = 0.006;
        c.beginPath();
        c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        c.lineTo(
          Math.cos(a - 0.045) * (r + 0.035),
          Math.sin(a - 0.045) * (r + 0.035),
        );
        c.stroke();
      }
    c.restore();
  }
  private render = (time: number) => {
    this.frame = null;
    if (this.disposed) return;
    const c = this.ctx;
    c.clearRect(0, 0, 960, 540);
    if (this.previewStart !== null) {
      const elapsed = time - this.previewStart;
      if (elapsed < 1500)
        this.orb = {
          center: { x: 0.5, y: 0.5 },
          radius: 0.065 + Math.min(elapsed / 1300, 1) * 0.1,
        };
      else {
        this.released = {
          orb: this.orb || { center: { x: 0.5, y: 0.5 }, radius: 0.165 },
          start: time,
        };
        this.orb = null;
        this.previewStart = null;
      }
    }
    if (this.previewStart === null && time - this.lastSample > 300)
      this.orb = null;
    if (this.orb) this.drawOrb(this.orb, time);
    if (this.released) {
      const age = (time - this.released.start) / 1000;
      const factor = this.motion.matches ? 1 : 1 + age * 2.8;
      this.drawOrb(
        {
          center: this.released.orb.center,
          radius: this.released.orb.radius * factor,
        },
        time,
        Math.max(0, 1 - age / 1.3),
      );
      if (age > 1.3) this.released = null;
    }
    if (this.portal) {
      const age = (time - this.portal.start) / 1000;
      this.drawPortal(this.portal.shape, age, time);
      if (age >= 7) this.portal = null;
    }
    this.canvas.dataset.phase = this.portal
      ? time - this.portal.start < 500
        ? "portal-opening"
        : "portal-active"
      : this.released
        ? "energy-release"
        : this.orb
          ? "energy-charging"
          : "idle";
    if (this.orb || this.released || this.portal || this.previewStart !== null)
      this.wake();
  };
}
