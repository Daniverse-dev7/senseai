"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Download,
  Hand,
  Pause,
  Play,
  Square,
  Trash2,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  ScanEye,
} from "lucide-react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import {
  trackPen,
  connects,
  type Pen,
  type Point,
} from "../../lib/air-writing";
import { recognizePortal } from "../../lib/portal";
import { MagicRenderer } from "../../lib/magic-renderer";
import { FireRenderer } from "../../lib/fire-renderer";
import { appendInk, finishInk, repaintInk, type Stroke } from "../../lib/ink";
import { cameraError } from "../../lib/vision";
export default function AirWriting() {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    cursor = useRef<HTMLDivElement>(null),
    fireCanvas = useRef<HTMLCanvasElement>(null),
    magicCanvas = useRef<HTMLCanvasElement>(null),
    magic = useRef<MagicRenderer | null>(null),
    effectRef = useRef<"fire" | "energy" | "portal">("fire"),
    screenFire = useRef<HTMLCanvasElement>(null),
    redoStrokes = useRef<Stroke[]>([]),
    stabilizationRef = useRef(0.6),
    fire = useRef<FireRenderer | null>(null),
    media = useRef<MediaStream | null>(null),
    detector = useRef<HandLandmarker | null>(null),
    epoch = useRef(0),
    frame = useRef(0),
    pausedRef = useRef(false),
    previous = useRef<Pen | null>(null),
    strokes = useRef<Stroke[]>([]),
    current = useRef<Stroke | null>(null),
    ink = useRef({ color: "#bcf77b", width: 7 }),
    manualRef = useRef(false),
    pointerDown = useRef(false);
  const [running, setRunning] = useState(false),
    [loading, setLoading] = useState(false),
    [paused, setPaused] = useState(false),
    [manual, setManual] = useState(false),
    [status, setStatus] = useState("Ready to write"),
    [error, setError] = useState(""),
    [count, setCount] = useState(0),
    [color, setColor] = useState("#bcf77b"),
    [width, setWidth] = useState(7),
    [redoCount, setRedoCount] = useState(0),
    [stabilization, setStabilization] = useState(0.6),
    [brightness, setBrightness] = useState(85),
    [focus, setFocus] = useState(false),
    [aspect, setAspect] = useState(16 / 9),
    [resolution, setResolution] = useState("HD canvas"),
    [effect, setEffect] = useState<"fire" | "energy" | "portal">("fire");
  function endStroke() {
    const ctx = canvas.current?.getContext("2d");
    if (ctx && current.current) finishInk(ctx, current.current);
    const finished = current.current;
    previous.current = null;
    current.current = null;
    if (
      finished &&
      effectRef.current === "portal" &&
      finished.points.length >= 16
    ) {
      const shape = recognizePortal(
        finished.points,
        canvas.current!.width / canvas.current!.height,
      );
      if (shape) {
        strokes.current = strokes.current.filter((s) => s !== finished);
        setCount(strokes.current.length);
        redraw();
        magic.current?.openPortal(shape);
        setStatus("Portal opened from your circle · Escape closes it");
      } else
        setStatus(
          "Try a closed, round loop. Keep pinching until you finish the circle.",
        );
    }
  }
  function release() {
    epoch.current++;
    cancelAnimationFrame(frame.current);
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    detector.current?.close();
    detector.current = null;
    if (video.current) video.current.srcObject = null;
    if (cursor.current) cursor.current.style.display = "none";
    fire.current?.reset();
    magic.current?.reset();
    endStroke();
  }
  useEffect(() => {
    const lifecycle = epoch;
    const renderer = new FireRenderer(fireCanvas.current!, screenFire.current!);
    fire.current = renderer;
    const magicRenderer = new MagicRenderer(magicCanvas.current!);
    magic.current = magicRenderer;
    return () => {
      renderer.destroy();
      magicRenderer.destroy();
      lifecycle.current++;
      cancelAnimationFrame(frame.current);
      media.current?.getTracks().forEach((t) => t.stop());
      detector.current?.close();
    };
  }, []);
  function stop() {
    release();
    setRunning(false);
    setLoading(false);
    setStatus("Camera stopped · your writing is kept");
  }
  function draw(next: Pen | null) {
    const previousPoint = previous.current;
    if (!next?.down) {
      endStroke();
      previous.current = next;
      return;
    }
    if (!connects(previousPoint, next)) {
      endStroke();
      redoStrokes.current = [];
      setRedoCount(0);
      current.current = { points: [{ x: next.x, y: next.y }], ...ink.current };
      strokes.current.push(current.current);
      setCount(strokes.current.length);
    } else current.current?.points.push({ x: next.x, y: next.y });
    const ctx = canvas.current?.getContext("2d");
    if (ctx && current.current) appendInk(ctx, current.current);
    previous.current = next;
  }
  async function start() {
    if (loading || running) return;
    const id = ++epoch.current;
    setLoading(true);
    setError("");
    let phase = "camera";
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Unsupported camera");
      setStatus("Requesting camera permission…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      if (id !== epoch.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      video.current!.srcObject = stream;
      await video.current!.play();
      if (id !== epoch.current) return;
      const v = video.current!;
      const ratio = v.videoWidth / v.videoHeight;
      if (Number.isFinite(ratio) && ratio > 0) {
        setAspect(ratio);
        setResolution(`${v.videoWidth} × ${v.videoHeight} camera`);
        const c = canvas.current!;
        c.width = Math.round(Math.min(1920, Math.sqrt(2073600 * ratio)));
        c.height = Math.round(c.width / ratio);
        redraw();
      }
      phase = "model";
      setStatus("Loading hand tracking · first download may take a moment…");
      const { FilesetResolver, HandLandmarker } =
        await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm",
      );
      if (id !== epoch.current) return;
      const hand = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      if (id !== epoch.current) {
        hand.close();
        return;
      }
      detector.current = hand;
      setRunning(true);
      setLoading(false);
      setStatus("Show one hand · pinch thumb and index finger to draw");
      let lastTime = -1,
        lastFrame = 0,
        lastMode = "";
      const tick = (time: number) => {
        if (id !== epoch.current) return;
        try {
          if (
            video.current &&
            video.current.readyState >= 2 &&
            time - lastFrame >= 32 &&
            video.current.currentTime !== lastTime
          ) {
            lastFrame = time;
            lastTime = video.current.currentTime;
            const result = hand.detectForVideo(video.current, time);
            const pen = trackPen(
              result.landmarks.length === 1 ? result.landmarks[0] : undefined,
              previous.current,
              stabilizationRef.current,
            );
            if (!pausedRef.current && !manualRef.current) {
              if (effectRef.current === "energy")
                magic.current?.updateHands(result.landmarks, time);
              else if (effectRef.current === "fire")
                fire.current?.update(
                  result.landmarks.length === 1
                    ? result.landmarks[0]
                    : undefined,
                  time,
                );
            }
            if (cursor.current) {
              cursor.current.style.display =
                pen && !manualRef.current && effectRef.current !== "energy"
                  ? "block"
                  : "none";
              if (pen) {
                cursor.current.style.left = `${pen.x * 100}%`;
                cursor.current.style.top = `${pen.y * 100}%`;
                cursor.current.dataset.down = String(
                  pen.down && !pausedRef.current,
                );
              }
            }
            const mode = manualRef.current
              ? "Mouse / touch mode"
              : effectRef.current === "energy" && !pausedRef.current
                ? result.landmarks.length === 2
                  ? "Energy ball · separate palms to grow, push both toward camera to release"
                  : "Energy mode · show two open palms"
                : pausedRef.current
                  ? "Paused · move your hand without drawing"
                  : !pen
                    ? "No hand found · show your palm to the camera"
                    : pen.down
                      ? "Writing · release your pinch to lift the pen"
                      : "Hand tracked · pinch thumb and index to write";
            if (mode !== lastMode) {
              setStatus(mode);
              lastMode = mode;
            }
            if (!manualRef.current) {
              if (!pausedRef.current && effectRef.current !== "energy")
                draw(pen);
              else endStroke();
            }
          }
          frame.current = requestAnimationFrame(tick);
        } catch {
          stop();
          setError(
            "Hand tracking was interrupted. Stop other camera apps and try again.",
          );
        }
      };
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      if (id === epoch.current) {
        stop();
        setError(
          phase === "camera"
            ? cameraError(e)
            : "Hand tracking could not load. Check your connection and allow cdn.jsdelivr.net and storage.googleapis.com, then retry. Mouse / touch drawing still works.",
        );
      }
    } finally {
      if (id === epoch.current) setLoading(false);
    }
  }
  function redraw() {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) repaintInk(ctx, strokes.current);
  }
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      down: true,
    };
  }
  function save() {
    const output = document.createElement("canvas");
    endStroke();
    output.width = canvas.current!.width;
    output.height = canvas.current!.height;
    const ctx = output.getContext("2d")!;
    ctx.fillStyle = "#0a0c10";
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(canvas.current!, 0, 0);
    const link = document.createElement("a");
    link.download = "senseai-air-writing.png";
    link.href = output.toDataURL("image/png");
    link.click();
  }
  return (
    <main className={`air-page ${focus ? "air-focus" : ""}`}>
      <canvas
        ref={screenFire}
        className="screen-fire-effects"
        aria-hidden="true"
      />
      <nav>
        <Link className="brand" href="/">
          <ScanEye />
          SenseAI
        </Link>
        <Link href="/studio" className="button small">
          <ArrowLeft size={16} /> Back to studio
        </Link>
      </nav>
      <header>
        <div className="eyebrow">YOUR HAND IS THE PEN</div>
        <h1>Write in the air.</h1>
        <p>
          Move your index fingertip. Pinch your thumb and index finger together
          to draw; release to move without ink.
        </p>
      </header>
      <div className="air-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Hand size={18} /> Air writing canvas
            </h2>
            <span className="badge">
              {manual ? "MOUSE / TOUCH" : running ? "HAND TRACKING" : "STANDBY"}
            </span>
          </div>
          <div
            className="effect-picker"
            role="group"
            aria-label="Choose interaction"
          >
            {(["fire", "energy", "portal"] as const).map((mode) => (
              <button
                key={mode}
                className={effect === mode ? "selected" : ""}
                aria-pressed={effect === mode}
                onClick={() => {
                  endStroke();
                  fire.current?.reset();
                  magic.current?.reset();
                  effectRef.current = mode;
                  setEffect(mode);
                  if (cursor.current) cursor.current.style.display = "none";
                }}
              >
                {mode === "fire"
                  ? "Writing + fire"
                  : mode === "energy"
                    ? "Two-hand energy"
                    : "Portal drawing"}
              </button>
            ))}
          </div>
          <div className="air-stage" style={{ aspectRatio: aspect }}>
            <video
              ref={video}
              style={{ opacity: brightness / 100 }}
              muted
              playsInline
              aria-label="Mirrored hand tracking camera"
            />
            {!running && !loading && !count && (
              <div className="air-placeholder">
                <Hand size={44} />
                <h2>A little movement. A blank canvas.</h2>
                <p>Start your camera or enable mouse / touch mode below.</p>
              </div>
            )}
            <canvas
              ref={canvas}
              width={1920}
              height={1080}
              aria-label="Air writing drawing canvas"
              className={manual ? "manual-canvas" : ""}
              onPointerDown={(e) => {
                if (!manual || paused) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                pointerDown.current = true;
                endStroke();
                draw(point(e));
              }}
              onPointerMove={(e) => {
                if (manual && pointerDown.current && !paused) draw(point(e));
              }}
              onPointerUp={() => {
                pointerDown.current = false;
                endStroke();
              }}
              onPointerCancel={() => {
                pointerDown.current = false;
                endStroke();
              }}
            />
            <canvas
              ref={magicCanvas}
              className="magic-effects"
              width={960}
              height={540}
              aria-hidden="true"
            />
            <div ref={cursor} className="air-cursor" aria-hidden="true" />
            <canvas
              ref={fireCanvas}
              className="fire-effects"
              width={960}
              height={540}
              aria-hidden="true"
            />
          </div>
          <div className="air-quality">
            <span>
              <span className="dot" /> {resolution}
            </span>
            <span>{count} strokes · Smoothed ink</span>
            <button
              className="icon-button"
              aria-label={focus ? "Exit focus canvas" : "Focus canvas"}
              onClick={() => setFocus(!focus)}
            >
              {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          <div className="camera-toolbar air-toolbar">
            <button
              className="button primary"
              onClick={() => void start()}
              disabled={loading || running}
            >
              <Camera size={16} />
              {loading ? "Loading…" : "Start hand tracking"}
            </button>
            <button
              className="button"
              disabled={!running && !loading}
              onClick={stop}
            >
              <Square size={15} />
              Stop
            </button>
            <button
              className="button"
              aria-pressed={paused}
              onClick={() => {
                fire.current?.reset();
                magic.current?.reset();
                pausedRef.current = !paused;
                setPaused(!paused);
                endStroke();
              }}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? "Resume drawing" : "Pause drawing"}
            </button>
          </div>
          <p className="air-status" role="status">
            {status}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </section>
        <aside className="panel air-tools">
          <h2>Make your mark</h2>
          <label>
            Ink color
            <input
              aria-label="Ink color"
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                ink.current.color = e.target.value;
                endStroke();
              }}
            />
          </label>
          <label>
            Pen width <span>{width}px</span>
            <input
              aria-label="Pen width"
              type="range"
              min="3"
              max="20"
              value={width}
              onChange={(e) => {
                setWidth(+e.target.value);
                ink.current.width = +e.target.value;
                endStroke();
              }}
            />
          </label>
          <label>
            Stroke stabilization <span>{Math.round(stabilization * 100)}%</span>
            <input
              aria-label="Stroke stabilization"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={stabilization}
              onChange={(e) => {
                setStabilization(+e.target.value);
                stabilizationRef.current = +e.target.value;
              }}
            />
          </label>
          <label>
            Camera visibility <span>{brightness}%</span>
            <input
              aria-label="Camera visibility"
              type="range"
              min="0"
              max="100"
              value={brightness}
              onChange={(e) => setBrightness(+e.target.value)}
            />
          </label>
          <div className="air-actions">
            <button
              className="button"
              disabled={!count}
              onClick={() => {
                endStroke();
                const removed = strokes.current.pop();
                if (removed) redoStrokes.current.push(removed);
                setRedoCount(redoStrokes.current.length);
                setCount(strokes.current.length);
                redraw();
              }}
            >
              <Undo2 size={16} />
              Undo stroke
            </button>
            <button
              className="button"
              disabled={!redoCount}
              onClick={() => {
                endStroke();
                const restored = redoStrokes.current.pop();
                if (restored) strokes.current.push(restored);
                setRedoCount(redoStrokes.current.length);
                setCount(strokes.current.length);
                redraw();
              }}
            >
              <Redo2 size={16} />
              Redo stroke
            </button>
            <button
              className="button"
              disabled={!count}
              onClick={() => {
                endStroke();
                strokes.current = [];
                redoStrokes.current = [];
                setRedoCount(0);
                setCount(0);
                redraw();
              }}
            >
              <Trash2 size={16} />
              Clear canvas
            </button>
            <button className="button primary" disabled={!count} onClick={save}>
              <Download size={16} />
              Save writing as PNG
            </button>
          </div>
          <label className="air-toggle">
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => {
                fire.current?.reset();
                magic.current?.reset();
                manualRef.current = e.target.checked;
                setManual(e.target.checked);
                endStroke();
                pointerDown.current = false;
                if (cursor.current) cursor.current.style.display = "none";
              }}
            />{" "}
            Mouse / touch drawing
          </label>
          {effect === "portal" ? (
            <>
              <h3>Draw a doorway to somewhere else</h3>
              <p className="air-note">
                Pinch and draw one closed circle, then release to open a portal
                at that spot. Mouse / touch mode also works. A round loop
                becomes a portal; other strokes remain as ink. Portals fade
                after seven seconds.
              </p>
              <button
                className="button"
                onClick={() => magic.current?.previewPortal()}
              >
                Preview portal
              </button>
            </>
          ) : effect === "energy" ? (
            <>
              <h3>Shape energy with both hands</h3>
              <p className="air-note">
                Show two open palms to the camera. Move them apart to grow the
                sphere, then push both palms toward the camera to release it.
                Keep both hands visible. This uses apparent palm-size changes,
                so move deliberately.
              </p>
              <button
                className="button"
                onClick={() => magic.current?.previewEnergy()}
              >
                Preview energy ball
              </button>
            </>
          ) : (
            <>
              <h3>Open to charge. Close to launch.</h3>
              <p className="air-note">
                Open your hand briefly to build a flame, then close all four
                fingers into a fist to release a fireball. It rushes toward you
                and bursts across the whole screen with rolling fire, smoke and
                embers. Pinch to write as before. Effects stay out of saved
                drawings.
              </p>
              <button
                className="button"
                onClick={() => fire.current?.preview()}
              >
                Preview full-screen burst
              </button>
            </>
          )}
          <p className="air-note">
            Preview plays the animation without using your camera.
            Reduced-motion settings soften the effect. Press Escape to dismiss.
          </p>
          <h3>Three simple steps</h3>
          <ol>
            <li>Keep one hand in frame, with good lighting.</li>
            <li>Pinch thumb and index finger to put the pen down.</li>
            <li>Release the pinch between letters or strokes.</li>
          </ol>
          <p className="air-note">
            This draws your handwriting as ink. It does not convert gestures
            into typed text or recognize sign language.
          </p>
          <p className="air-note">
            Processing stays in your browser. Save exports only your writing,
            never the camera image.
          </p>
        </aside>
      </div>
    </main>
  );
}
