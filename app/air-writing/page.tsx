"use client";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react";
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
import { connects, type Pen, type Point } from "../../lib/air-writing";
import TextPanel from "./text-panel";
import RecordingPanel from "./recording-panel";
import { SceneRecorder } from "../../lib/scene-recorder";
import { WritingHand } from "../../lib/writing-hand";
import { loadHandTracker } from "../../lib/hand-tracker";
import { SmoothPen } from "../../lib/smooth-pen";
import { ElementRenderer } from "../../lib/element-renderer";
import { openPalm } from "../../lib/air-writing";
type Effect =
  "writing" | "fire" | "energy" | "portal" | "lightning" | "ice" | "living";
import { recognizePortal } from "../../lib/portal";
import { MagicRenderer } from "../../lib/magic-renderer";
import { FireRenderer } from "../../lib/fire-renderer";
import { drawInk, repaintInk, type Stroke } from "../../lib/ink";
import { cameraError } from "../../lib/vision";
export default function AirWriting() {
  const [styledActive, setStyledActive] = useState(false);
  const styledCanvas = useRef<HTMLCanvasElement>(null);
  const continuousRef = useRef(false),
    penDownRef = useRef(false);
  const [continuous, setContinuous] = useState(false),
    [penDown, setPenDown] = useState(false);
  const activePointer = useRef<number | null>(null);
  const writingHand = useRef(new WritingHand());
  const modelAbort = useRef<AbortController | null>(null);
  const smoothPen = useRef(new SmoothPen());
  const tipCanvas = useRef<HTMLCanvasElement>(null);
  const elements = useRef<ElementRenderer | null>(null);
  const elementCanvas = useRef<HTMLCanvasElement>(null);
  const livingHeld = useRef<number | null>(null);
  const recorder = useRef<SceneRecorder | null>(null);
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    cursor = useRef<HTMLDivElement>(null),
    fireCanvas = useRef<HTMLCanvasElement>(null),
    magicCanvas = useRef<HTMLCanvasElement>(null),
    magic = useRef<MagicRenderer | null>(null),
    effectRef = useRef<Effect>("writing"),
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
    ink = useRef({ color: "#dce9ff", width: 7 }),
    manualRef = useRef(false),
    pointerDown = useRef(false);
  const [running, setRunning] = useState(false),
    [loading, setLoading] = useState(false),
    [paused, setPaused] = useState(false),
    [manual, setManual] = useState(false),
    [status, setStatus] = useState("Ready to write"),
    [error, setError] = useState(""),
    [count, setCount] = useState(0),
    [color, setColor] = useState("#dce9ff"),
    [width, setWidth] = useState(7),
    [redoCount, setRedoCount] = useState(0),
    [stabilization, setStabilization] = useState(0.6),
    [brightness, setBrightness] = useState(85),
    [focus, setFocus] = useState(false),
    [aspect, setAspect] = useState(16 / 9),
    [resolution, setResolution] = useState("HD canvas"),
    [effect, setEffect] = useState<Effect>("writing");
  function endStroke() {
    const tip = tipCanvas.current;
    tip?.getContext("2d")?.clearRect(0, 0, tip.width, tip.height);
    const ctx = canvas.current?.getContext("2d");
    if (ctx && current.current) drawInk(ctx, current.current);
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
    penDownRef.current = false;
    setPenDown(false);
    modelAbort.current?.abort();
    writingHand.current.reset();
    recorder.current?.stop();
    smoothPen.current.reset();
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
    elements.current?.reset();
    livingHeld.current = null;
    smoothPen.current.reset();
    endStroke();
  }
  function liftPen() {
    penDownRef.current = false;
    setPenDown(false);
    pointerDown.current = false;
    activePointer.current = null;
    smoothPen.current.reset();
    writingHand.current.reset();
    endStroke();
  }
  const suspendInput = useEffectEvent(() => {
    liftPen();
    pausedRef.current = true;
    setPaused(true);
    fire.current?.reset();
    magic.current?.reset();
    elements.current?.reset();
    setStatus("Drawing paused · select Resume drawing to continue");
  });
  const toggleContinuous = useEffectEvent(() => {
    if (!continuousRef.current || manualRef.current || pausedRef.current)
      return;
    endStroke();
    penDownRef.current = !penDownRef.current;
    setPenDown(penDownRef.current);
    smoothPen.current.reset();
  });
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) suspendInput();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        suspendInput();
        return;
      }
      const target = event.target as HTMLElement;
      if (
        event.code === "Space" &&
        continuousRef.current &&
        !manualRef.current &&
        !pausedRef.current &&
        !event.repeat &&
        !target.closest("input,textarea,select,button,a,[contenteditable=true]")
      ) {
        event.preventDefault();
        toggleContinuous();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("keydown", keyboard);
    };
  }, []);
  useEffect(() => {
    const lifecycle = epoch;
    const renderer = new FireRenderer(fireCanvas.current!, screenFire.current!);
    fire.current = renderer;
    const magicRenderer = new MagicRenderer(magicCanvas.current!);
    magic.current = magicRenderer;
    const elementRenderer = new ElementRenderer(elementCanvas.current!);
    elements.current = elementRenderer;
    return () => {
      renderer.destroy();
      magicRenderer.destroy();
      elementRenderer.destroy();
      modelAbort.current?.abort();
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
    if (next?.down && styledCanvas.current?.dataset.active === "true") {
      const c = styledCanvas.current;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      c.dataset.active = "false";
      setStyledActive(false);
    }
    const previousPoint = previous.current;
    if (
      next?.down &&
      previousPoint?.down &&
      current.current &&
      Math.hypot(next.x - previousPoint.x, next.y - previousPoint.y) < 0.00001
    )
      return;
    if (!next?.down) {
      endStroke();
      previous.current = next;
      return;
    }
    if (
      !current.current ||
      !previousPoint?.down ||
      (!manualRef.current && !connects(previousPoint, next))
    ) {
      endStroke();
      redoStrokes.current = [];
      setRedoCount(0);
      current.current = { points: [{ x: next.x, y: next.y }], ...ink.current };
      strokes.current.push(current.current);
      setCount(strokes.current.length);
    } else current.current?.points.push({ x: next.x, y: next.y });
    const ctx = canvas.current?.getContext("2d");
    if (ctx && current.current) {
      const tip = tipCanvas.current!;
      if (tip.width !== ctx.canvas.width || tip.height !== ctx.canvas.height) {
        tip.width = ctx.canvas.width;
        tip.height = ctx.canvas.height;
      }
      const tail = tip.getContext("2d")!;
      tail.clearRect(0, 0, tip.width, tip.height);
      drawInk(tail, current.current);
    }
    previous.current = next;
  }
  async function start() {
    if (loading || running) return;
    liftPen();
    manualRef.current = false;
    setManual(false);
    pausedRef.current = false;
    setPaused(false);
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
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener(
          "ended",
          () => {
            if (id === epoch.current) {
              stop();
              setError(
                "Camera disconnected. Reconnect it and start hand tracking again.",
              );
            }
          },
          { once: true },
        ),
      );
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
      const controller = new AbortController();
      modelAbort.current = controller;
      const timeout = setTimeout(() => controller.abort(), 35000);
      let hand: HandLandmarker;
      try {
        hand = await loadHandTracker(controller.signal);
      } finally {
        clearTimeout(timeout);
      }
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
            !pausedRef.current &&
            !manualRef.current &&
            video.current &&
            video.current.readyState >= 2 &&
            time - lastFrame >= 32 &&
            video.current.currentTime !== lastTime
          ) {
            lastFrame = time;
            lastTime = video.current.currentTime;
            const result = hand.detectForVideo(video.current, time);
            const pen = smoothPen.current.update(
              writingHand.current.select(result.landmarks, time),
              time,
              stabilizationRef.current,
              continuousRef.current ? penDownRef.current : undefined,
            );
            if (!pausedRef.current && !manualRef.current) {
              if (["lightning", "ice", "living"].includes(effectRef.current)) {
                elements.current?.update(
                  effectRef.current as "lightning" | "ice" | "living",
                  result.landmarks,
                  time,
                );
                if (
                  effectRef.current === "living" &&
                  result.landmarks.length === 1 &&
                  openPalm(result.landmarks[0])
                ) {
                  livingHeld.current ??= time;
                  if (time - livingHeld.current > 600)
                    elements.current?.awaken(canvas.current!, strokes.current);
                } else livingHeld.current = null;
              } else if (effectRef.current === "energy")
                magic.current?.updateHands(result.landmarks, time);
              else if (effectRef.current === "portal")
                magic.current?.updatePortalHand(
                  result.landmarks.length === 1
                    ? result.landmarks[0]
                    : undefined,
                  time,
                );
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
                pen &&
                !manualRef.current &&
                !["energy", "lightning", "ice"].includes(effectRef.current)
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
              : effectRef.current === "writing" &&
                  continuousRef.current &&
                  !pausedRef.current
                ? penDownRef.current
                  ? "Continuous pen down · use Lift pen or Pause to stop writing"
                  : "Continuous pen lifted · choose Put pen down to write"
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
              if (
                !pausedRef.current &&
                !["energy", "lightning", "ice"].includes(effectRef.current)
              )
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
  function showInk() {
    const c = styledCanvas.current;
    if (c?.dataset.active === "true") {
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      c.dataset.active = "false";
      setStyledActive(false);
    }
  }
  function prepareText() {
    liftPen();
    pausedRef.current = true;
    setPaused(true);
    setStatus("Drawing paused for text review · resume when ready");
  }
  function redraw() {
    const ctx = canvas.current?.getContext("2d");
    if (ctx)
      repaintInk(
        ctx,
        strokes.current.filter((stroke) => stroke !== current.current),
      );
  }
  function point(
    e: PointerEvent<HTMLCanvasElement>,
    sample: { clientX: number; clientY: number } = e,
  ) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (sample.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (sample.clientY - r.top) / r.height)),
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
    ctx.drawImage(
      styledCanvas.current?.dataset.active === "true"
        ? styledCanvas.current
        : canvas.current!,
      0,
      0,
      output.width,
      output.height,
    );
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
        <div className="eyebrow">GESTURE STUDIO</div>
        <h1>Create beyond the keyboard.</h1>
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
            {(
              [
                "writing",
                "fire",
                "energy",
                "portal",
                "lightning",
                "ice",
                "living",
              ] as const
            ).map((mode) => (
              <button
                key={mode}
                className={effect === mode ? "selected" : ""}
                aria-pressed={effect === mode}
                onClick={() => {
                  endStroke();
                  fire.current?.reset();
                  magic.current?.reset();
                  elements.current?.reset();
                  livingHeld.current = null;
                  smoothPen.current.reset();
                  penDownRef.current = false;
                  setPenDown(false);
                  effectRef.current = mode;
                  setEffect(mode);
                  if (cursor.current) cursor.current.style.display = "none";
                }}
              >
                {mode === "writing"
                  ? "Writing"
                  : mode === "fire"
                    ? "Writing + fire"
                    : mode === "energy"
                      ? "Two-hand energy"
                      : mode === "portal"
                        ? "Portal drawing"
                        : mode === "lightning"
                          ? "Lightning"
                          : mode === "ice"
                            ? "Freeze + shatter"
                            : "Living drawings"}
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
                if (
                  !manual ||
                  paused ||
                  !e.isPrimary ||
                  activePointer.current !== null
                )
                  return;
                activePointer.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                pointerDown.current = true;
                endStroke();
                draw(point(e));
              }}
              onPointerMove={(e) => {
                if (
                  manual &&
                  pointerDown.current &&
                  !paused &&
                  activePointer.current === e.pointerId
                ) {
                  const samples = e.nativeEvent.getCoalescedEvents?.() || [];
                  for (const sample of samples) draw(point(e, sample));
                  draw(point(e));
                }
              }}
              onPointerUp={(e) => {
                if (activePointer.current !== e.pointerId) return;
                activePointer.current = null;
                if (manual && pointerDown.current && !paused) draw(point(e));
                pointerDown.current = false;
                endStroke();
              }}
              onLostPointerCapture={(e) => {
                if (activePointer.current === e.pointerId) {
                  activePointer.current = null;
                  pointerDown.current = false;
                  endStroke();
                }
              }}
              onPointerCancel={(e) => {
                if (activePointer.current !== e.pointerId) return;
                activePointer.current = null;
                pointerDown.current = false;
                endStroke();
              }}
            />
            <canvas
              ref={tipCanvas}
              className="ink-tip"
              width={1920}
              height={1080}
              aria-hidden="true"
            />
            <canvas
              ref={styledCanvas}
              className="styled-text-canvas"
              width={1920}
              height={1080}
              aria-hidden="true"
            />
            <canvas
              ref={magicCanvas}
              className="magic-effects"
              width={960}
              height={540}
              aria-hidden="true"
            />
            <canvas
              ref={elementCanvas}
              className="element-effects"
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
            {continuous && !manual && (
              <button
                className="button"
                disabled={paused}
                aria-pressed={penDown}
                onClick={() => {
                  endStroke();
                  penDownRef.current = !penDownRef.current;
                  setPenDown(penDownRef.current);
                  smoothPen.current.reset();
                }}
              >
                {penDown ? "Lift pen" : "Put pen down"}
              </button>
            )}
            <button
              className="button"
              aria-pressed={paused}
              onClick={() => {
                fire.current?.reset();
                magic.current?.reset();
                elements.current?.reset();
                livingHeld.current = null;
                smoothPen.current.reset();
                pausedRef.current = !paused;
                liftPen();
                setStatus(
                  !paused
                    ? "Drawing paused · select Resume drawing to continue"
                    : "Drawing resumed · show your writing hand",
                );
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
          <h2>Creative controls</h2>
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
                showInk();
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
                showInk();
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
              disabled={!count && !styledActive}
              onClick={() => {
                endStroke();
                const styled = styledCanvas.current!;
                styled
                  .getContext("2d")!
                  .clearRect(0, 0, styled.width, styled.height);
                styled.dataset.active = "false";
                setStyledActive(false);
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
            <button
              className="button primary"
              disabled={!count && !styledActive}
              onClick={save}
            >
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
                elements.current?.reset();
                livingHeld.current = null;
                smoothPen.current.reset();
                liftPen();
                pausedRef.current = false;
                setPaused(false);
                setStatus(
                  e.target.checked
                    ? "Mouse / touch mode · drag on the canvas to write"
                    : "Show your hand to write",
                );
                manualRef.current = e.target.checked;
                setManual(e.target.checked);
                endStroke();
                pointerDown.current = false;
                if (cursor.current) cursor.current.style.display = "none";
              }}
            />{" "}
            Mouse / touch drawing
          </label>
          <div className="pen-control">
            <label>
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => {
                  endStroke();
                  continuousRef.current = e.target.checked;
                  setContinuous(e.target.checked);
                  penDownRef.current = false;
                  setPenDown(false);
                  smoothPen.current.reset();
                }}
              />{" "}
              Continuous pen control
            </label>
            <p className="air-note">
              For uninterrupted lettering, control the pen with this button
              instead of holding a pinch. Tracking loss still pauses ink.
            </p>
            <p className="air-note">
              Use the pen button beside the canvas, or Space when a form field
              is not focused. Escape pauses drawing.
            </p>
          </div>
          <TextPanel
            inkRef={canvas}
            outputRef={styledCanvas}
            finish={prepareText}
            hasInk={count > 0}
            onStyledChange={setStyledActive}
          />
          {effect === "writing" ? (
            <p className="air-note">
              Writing mode keeps gesture effects inactive so you can focus on
              lettering. Choose an effect above when ready to present it.
            </p>
          ) : ["lightning", "ice", "living"].includes(effect) ? (
            <>
              <h3>
                {effect === "lightning"
                  ? "Electricity between your hands"
                  : effect === "ice"
                    ? "Freeze the scene. Break the ice."
                    : "Let your ink take flight"}
              </h3>
              <p className="air-note">
                {effect === "lightning"
                  ? "Show two open palms to link them with lightning. Keep both visible, close one into a fist, then push it toward the camera to release a branching bolt."
                  : effect === "ice"
                    ? "Sweep one open palm across the camera to spread frost. Close it to crack the ice, then promptly thrust toward the camera to shatter it. Frost fades automatically; Escape clears it."
                    : "Draw a butterfly, star, or any sketch. Hold one open palm for a moment to animate a glowing copy, then move your palm to guide it. Or use Bring drawing to life. Your original ink is kept. This animates your drawing; it does not identify what you drew."}
              </p>
              {effect === "living" && (
                <button
                  className="button"
                  disabled={!count}
                  onClick={() => {
                    endStroke();
                    elements.current?.awaken(canvas.current!, strokes.current);
                  }}
                >
                  Bring drawing to life
                </button>
              )}
              <button
                className="button"
                onClick={() =>
                  elements.current?.previewEffect(
                    effect as "lightning" | "ice" | "living",
                  )
                }
              >
                {effect === "lightning"
                  ? "Preview lightning"
                  : effect === "ice"
                    ? "Preview freeze + shatter"
                    : "Preview butterfly"}
              </button>
            </>
          ) : effect === "portal" ? (
            <>
              <h3>Draw a doorway to somewhere else</h3>
              <p className="air-note">
                Hold an open palm, close it into a fist, then thrust toward the
                camera to open a portal. Or pinch and draw one closed circle,
                then release to open a portal at that spot. Mouse / touch mode
                also works. A round loop becomes a portal; other strokes remain
                as ink. Portals fade after seven seconds.
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
              <h3>Charge. Close. Thrust to launch.</h3>
              <p className="air-note">
                Open your hand briefly to build a flame, then close all four
                fingers into a fist and push toward the camera to release a
                fireball. Keep your fist visible and facing the camera; closing
                alone will not launch. It rushes toward you and bursts across
                the whole screen with rolling fire, smoke and embers. Pinch to
                write as before. Effects stay out of saved drawings.
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
          <RecordingPanel
            video={video}
            ink={canvas}
            layers={[
              tipCanvas,
              styledCanvas,
              fireCanvas,
              magicCanvas,
              elementCanvas,
              screenFire,
            ]}
            recorderRef={recorder}
          />
          <h3>Three simple steps</h3>
          <ol>
            <li>Keep one hand in frame, with good lighting.</li>
            <li>Pinch thumb and index finger to put the pen down.</li>
            <li>Release the pinch between letters or strokes.</li>
          </ol>
          <p className="air-note">
            Writing creates ink. Use Recognize handwriting to convert it to
            editable text. Sign language recognition is not supported.
          </p>
          <p className="air-note">
            Processing stays in your browser. PNG saves only your writing. Video
            clips include your camera when it is active.
          </p>
        </aside>
      </div>
    </main>
  );
}
