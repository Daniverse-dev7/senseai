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
  ScanEye,
} from "lucide-react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import {
  trackPen,
  connects,
  type Pen,
  type Point,
} from "../../lib/air-writing";
import { FireRenderer } from "../../lib/fire-renderer";
import { cameraError } from "../../lib/vision";
type Stroke = { points: Point[]; color: string; width: number };
export default function AirWriting() {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    cursor = useRef<HTMLDivElement>(null),
    fireCanvas = useRef<HTMLCanvasElement>(null),
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
    [width, setWidth] = useState(7);
  function endStroke() {
    previous.current = null;
    current.current = null;
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
    endStroke();
  }
  useEffect(() => {
    const lifecycle = epoch;
    const renderer = new FireRenderer(fireCanvas.current!);
    fire.current = renderer;
    return () => {
      renderer.destroy();
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
      current.current = { points: [{ x: next.x, y: next.y }], ...ink.current };
      strokes.current.push(current.current);
      setCount(strokes.current.length);
    } else current.current?.points.push({ x: next.x, y: next.y });
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (c && ctx) {
      ctx.strokeStyle = ink.current.color;
      ctx.fillStyle = ink.current.color;
      ctx.lineWidth = ink.current.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (connects(previousPoint, next)) {
        ctx.beginPath();
        ctx.moveTo(previousPoint!.x * c.width, previousPoint!.y * c.height);
        ctx.lineTo(next.x * c.width, next.y * c.height);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(
          next.x * c.width,
          next.y * c.height,
          ink.current.width / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
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
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
        numHands: 1,
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
            time - lastFrame >= 40 &&
            video.current.currentTime !== lastTime
          ) {
            lastFrame = time;
            lastTime = video.current.currentTime;
            const result = hand.detectForVideo(video.current, time);
            const pen = trackPen(result.landmarks[0], previous.current);
            if (!pausedRef.current && !manualRef.current)
              fire.current?.update(result.landmarks[0], time);
            if (cursor.current) {
              cursor.current.style.display =
                pen && !manualRef.current ? "block" : "none";
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
              if (!pausedRef.current) draw(pen);
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
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const stroke of strokes.current) {
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * c.width, p.y * c.height);
        else ctx.lineTo(p.x * c.width, p.y * c.height);
      });
      ctx.stroke();
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(
          p.x * c.width,
          p.y * c.height,
          stroke.width / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
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
    output.width = 1280;
    output.height = 720;
    const ctx = output.getContext("2d")!;
    ctx.fillStyle = "#0a0c10";
    ctx.fillRect(0, 0, 1280, 720);
    ctx.drawImage(canvas.current!, 0, 0);
    const link = document.createElement("a");
    link.download = "senseai-air-writing.png";
    link.href = output.toDataURL("image/png");
    link.click();
  }
  return (
    <main className="air-page">
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
          <div className="air-stage">
            <video
              ref={video}
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
              width={1280}
              height={720}
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
            <div ref={cursor} className="air-cursor" aria-hidden="true" />
            <canvas
              ref={fireCanvas}
              className="fire-effects"
              width={960}
              height={540}
              aria-hidden="true"
            />
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
          <div className="air-actions">
            <button
              className="button"
              disabled={!count}
              onClick={() => {
                endStroke();
                strokes.current.pop();
                setCount(strokes.current.length);
                redraw();
              }}
            >
              <Undo2 size={16} />
              Undo stroke
            </button>
            <button
              className="button"
              disabled={!count}
              onClick={() => {
                endStroke();
                strokes.current = [];
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
                manualRef.current = e.target.checked;
                setManual(e.target.checked);
                endStroke();
                pointerDown.current = false;
                if (cursor.current) cursor.current.style.display = "none";
              }}
            />{" "}
            Mouse / touch drawing
          </label>
          <h3>Open to charge. Close to launch.</h3>
          <p className="air-note">
            Open your hand briefly to build a flame, then close all four fingers
            into a fist to release a fireball. It travels across the camera view
            and bursts into sparks. Pinch to write as before. Effects stay out
            of saved drawings.
          </p>
          <button className="button" onClick={() => fire.current?.preview()}>
            Preview fireball effect
          </button>
          <p className="air-note">
            Preview plays the animation without using your camera.
            Reduced-motion settings soften the effect.
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
