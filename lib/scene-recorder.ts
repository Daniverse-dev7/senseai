export type Scene = {
  video: HTMLVideoElement;
  ink: HTMLCanvasElement;
  layers: HTMLCanvasElement[];
};

/** Records only the scene, without UI, microphone or screen-sharing permissions. */
export class SceneRecorder {
  private recorder: MediaRecorder;
  private stream: MediaStream | null = null;
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private failed = false;
  private started = performance.now();
  private chunks: Blob[] = [];
  private bytes = 0;
  constructor(
    scene: Scene,
    callbacks: {
      tick: (seconds: number) => void;
      finishing: () => void;
      done: (blob: Blob) => void;
      error: () => void;
    },
  ) {
    const output = document.createElement("canvas");
    const scale = Math.min(
      1,
      1280 / scene.ink.width,
      Math.sqrt(921600 / (scene.ink.width * scene.ink.height)),
    );
    output.width = Math.max(2, Math.round((scene.ink.width * scale) / 2) * 2);
    output.height = Math.max(2, Math.round((scene.ink.height * scale) / 2) * 2);
    const ctx = output.getContext("2d")!;
    const paint = () => {
      ctx.fillStyle = "#0a0c10";
      ctx.fillRect(0, 0, output.width, output.height);
      const fit = Math.min(
        output.width / scene.ink.width,
        output.height / scene.ink.height,
      );
      const w = scene.ink.width * fit,
        h = scene.ink.height * fit;
      const x = (output.width - w) / 2,
        y = (output.height - h) / 2;
      if (scene.video.readyState >= 2 && scene.video.srcObject) {
        ctx.save();
        ctx.globalAlpha = Number(scene.video.style.opacity || 1);
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(scene.video, 0, 0, w, h);
        ctx.restore();
      }
      for (const layer of [scene.ink, ...scene.layers]) {
        if (layer.width && layer.height) ctx.drawImage(layer, x, y, w, h);
      }
      this.frame = requestAnimationFrame(paint);
    };
    paint();
    try {
      this.stream = output.captureStream(30);
      const mimeType = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      this.recorder = new MediaRecorder(this.stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 6000000,
      });
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) {
          this.chunks.push(event.data);
          this.bytes += event.data.size;
        }
        if (this.bytes >= 64 * 1024 * 1024) this.stop();
      };
      this.recorder.onerror = () => {
        this.failed = true;
        this.stop();
      };
      this.recorder.onstop = () => {
        this.clean();
        if (this.disposed) return;
        if (this.failed || !this.bytes) callbacks.error();
        else
          callbacks.done(
            new Blob(this.chunks, {
              type: this.recorder.mimeType || this.chunks[0].type,
            }),
          );
        this.chunks = [];
      };
      this.recorder.start(1000);
      this.timer = setInterval(() => {
        const seconds = (performance.now() - this.started) / 1000;
        callbacks.tick(Math.min(30, Math.floor(seconds)));
        if (seconds >= 30) this.stop();
      }, 250);
      this.onFinishing = callbacks.finishing;
      document.addEventListener("visibilitychange", this.hidden);
    } catch (error) {
      cancelAnimationFrame(this.frame);
      this.stream?.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }
  private onFinishing = () => {};
  private hidden = () => {
    if (document.hidden) this.stop();
  };
  stop() {
    if (this.recorder.state !== "inactive") {
      this.onFinishing();
      this.recorder.stop();
      this.clean();
    }
  }
  private clean() {
    cancelAnimationFrame(this.frame);
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
    document.removeEventListener("visibilitychange", this.hidden);
  }
  dispose() {
    this.disposed = true;
    this.onFinishing = () => {};
    this.stop();
    this.clean();
    this.chunks = [];
  }
}
