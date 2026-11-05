"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ScanEye,
  LayoutDashboard,
  ScanText,
  MessageSquare,
  Settings,
  Camera,
  Square,
  Mic,
  Send,
  Volume2,
  VolumeX,
  Copy,
  ArrowLeft,
  Activity,
  ShieldCheck,
} from "lucide-react";
import {
  answer,
  cameraError,
  position,
  type Detection,
} from "../../lib/vision";
type Model = Awaited<
  ReturnType<(typeof import("@tensorflow-models/coco-ssd"))["load"]>
>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export default function Studio() {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    model = useRef<Model | null>(null),
    active = useRef(false),
    generation = useRef(0),
    recognition = useRef<Recognition | null>(null),
    mounted = useRef(true),
    worker = useRef<Awaited<
      ReturnType<(typeof import("tesseract.js"))["createWorker"]>
    > | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 }),
    [running, setRunning] = useState(false),
    [loading, setLoading] = useState(false),
    [status, setStatus] = useState("Ready when you are"),
    [error, setError] = useState(""),
    [items, setItems] = useState<Detection[]>([]),
    [ocr, setOcr] = useState(""),
    [reading, setReading] = useState(false),
    [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<{ role: string; text: string }[]>([]),
    [muted, setMuted] = useState(true),
    [listening, setListening] = useState(false),
    [supported, setSupported] = useState(false),
    [contrast, setContrast] = useState(false),
    [large, setLarge] = useState(false),
    [tab, setTab] = useState("Live Vision"),
    [activity, setActivity] = useState<string[]>([]);
  function log(text: string) {
    setActivity((a) => [text, ...a].slice(0, 4));
  }
  function speak(text: string) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      if (!muted) speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }
  function stop() {
    generation.current++;
    active.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setRunning(false);
    setLoading(false);
    setItems([]);
    setStatus("Camera stopped");
    recognition.current?.stop();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  useEffect(() => {
    mounted.current = true;
    const lifecycle = generation;
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    queueMicrotask(() => {
      if (mounted.current)
        setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    });
    return () => {
      mounted.current = false;
      lifecycle.current++;
      active.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      recognition.current?.stop();
      void worker.current?.terminate();
      model.current?.dispose();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);
  async function start() {
    if (loading || running) return;
    const id = ++generation.current;
    setLoading(true);
    setError("");
    let phase: "camera" | "model" = "camera";
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera requires a supported browser with HTTPS.");
      setStatus("Requesting camera permission…");
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (id !== generation.current || !mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      setDimensions({
        width: video.current!.videoWidth,
        height: video.current!.videoHeight,
      });
      setRunning(true);
      phase = "model";
      setStatus("Loading detection model…");
      if (!model.current) {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        const coco = await import("@tensorflow-models/coco-ssd");
        const loaded = await coco.load({ base: "lite_mobilenet_v2" });
        if (!mounted.current) {
          loaded.dispose();
          return;
        }
        model.current = loaded;
      }
      if (id !== generation.current || !mounted.current) return;
      active.current = true;
      setStatus("Live detection active");
      log("Camera and object detection started");
      const detect = async () => {
        if (!active.current || id !== generation.current || !video.current)
          return;
        try {
          const results = await model.current!.detect(video.current, 20, 0.5);
          if (active.current && id === generation.current)
            setItems(results as Detection[]);
        } catch (e) {
          if (id === generation.current) {
            setError(
              `Detection failed: ${e instanceof Error ? e.message : "Unknown model error"}`,
            );
            active.current = false;
            setStatus("Detection interrupted — stop and retry");
          }
        }
        if (active.current && id === generation.current)
          setTimeout(() => void detect(), 350);
      };
      void detect();
    } catch (e) {
      if (id === generation.current) {
        stop();
        setError(
          phase === "model"
            ? "Detection model could not load. Check your connection, allow storage.googleapis.com, and retry."
            : cameraError(e),
        );
        setStatus("Camera or model unavailable");
      }
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }
  async function readText() {
    if (!video.current || !running || reading) return;
    setReading(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.current.videoWidth;
      canvas.height = video.current.videoHeight;
      canvas.getContext("2d")!.drawImage(video.current, 0, 0);
      const { createWorker } = await import("tesseract.js");
      if (!worker.current) {
        const loaded = await createWorker("eng");
        if (!mounted.current) {
          await loaded.terminate();
          return;
        }
        worker.current = loaded;
      }
      const result = await worker.current.recognize(canvas);
      if (!mounted.current) return;
      const text = result.data.text.trim();
      setOcr(text);
      log(
        text ? "Text recognized from camera frame" : "No readable text found",
      );
      if (!text)
        setError(
          "No readable text detected. Move closer, improve lighting, and try again.",
        );
    } catch (e) {
      if (mounted.current)
        setError(
          `OCR could not finish. Check your connection and retry. ${e instanceof Error ? e.message : ""}`,
        );
    } finally {
      if (mounted.current) setReading(false);
    }
  }
  function ask(value = question) {
    if (!value.trim()) return;
    const response = answer(value, items, dimensions.width, ocr);
    setMessages((m) => [
      ...m,
      { role: "You", text: value },
      { role: "SenseAI", text: response },
    ]);
    setQuestion("");
    speak(response);
  }
  function listen() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    const r = new Constructor();
    recognition.current = r;
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => ask(e.results[0][0].transcript);
    r.onerror = (e) => {
      setError(`Microphone: ${e.error}. You can type your question below.`);
      setListening(false);
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Speech recognition could not start. Please use typed input.");
    }
  }
  return (
    <div
      className={`studio ${contrast ? "high-contrast" : ""} ${large ? "large-text" : ""}`}
    >
      <aside className="sidebar">
        <Link href="/" className="brand">
          <ScanEye /> SenseAI
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {[
            [LayoutDashboard, "Dashboard"],
            [ScanEye, "Live Vision"],
            [ScanText, "Text Reader"],
            [MessageSquare, "AI Assistant"],
            [Settings, "Settings"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof ScanEye;
            return (
              <button
                key={String(label)}
                className={tab === label ? "nav-item selected" : "nav-item"}
                onClick={() => {
                  setTab(String(label));
                  const target =
                    label === "Text Reader"
                      ? "text-reader"
                      : label === "AI Assistant"
                        ? "ai-assistant"
                        : null;
                  if (target)
                    requestAnimationFrame(() =>
                      document.getElementById(target)?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      }),
                    );
                }}
              >
                <I size={19} />
                {String(label)}
              </button>
            );
          })}
        </nav>
        <Link className="nav-item air-link" href="/air-writing">
          <ScanEye size={19} />
          Air Writing
        </Link>
        <div className="sidebar-bottom">
          <ShieldCheck size={20} />
          <strong>On-device intelligence</strong>
          <p>
            Camera frames stay in your browser. Models download on first use.
          </p>
          <Link href="/">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <div className="eyebrow">YOUR EVERYDAY VISUAL COMPANION</div>
            <h1>{tab}</h1>
            <p>A little more clarity. A whole new perspective.</p>
          </div>
          <span className="badge">
            <span className="dot" /> BROWSER AI
          </span>
        </header>
        {tab === "Settings" ? (
          <section className="panel settings">
            <h2>Make SenseAI yours</h2>
            <label>
              <input
                type="checkbox"
                checked={contrast}
                onChange={(e) => setContrast(e.target.checked)}
              />{" "}
              High contrast
            </label>
            <label>
              <input
                type="checkbox"
                checked={large}
                onChange={(e) => setLarge(e.target.checked)}
              />{" "}
              Larger text
            </label>
            <label>
              <input
                type="checkbox"
                checked={!muted}
                onChange={(e) => setMuted(!e.target.checked)}
              />{" "}
              Speak assistant responses
            </label>
            <p>
              Voice input depends on browser support and may use your browser
              provider’s online speech service. English OCR is enabled.
            </p>
            <h3>Advanced scene understanding</h3>
            <p>
              Not configured. Full visual question answering requires a secure
              backend vision provider. Current answers use actual detections and
              captured text only.
            </p>
          </section>
        ) : null}
        <div
          className="studio-grid"
          style={tab === "Settings" ? { display: "none" } : undefined}
        >
          <section className="vision-column">
            <div className="panel camera-panel">
              <div className="panel-heading">
                <h2>
                  <ScanEye size={18} /> Live camera
                </h2>
                <span className={running ? "live-label" : "subtle"}>
                  {running ? "● LIVE" : "STANDBY"}
                </span>
              </div>
              <div className="viewport">
                <video
                  ref={video}
                  playsInline
                  muted
                  aria-label="Live camera feed"
                />
                {!running && (
                  <div className="camera-empty">
                    <div className="camera-symbol">
                      <ScanEye size={40} />
                    </div>
                    <h2>Your world, in focus.</h2>
                    <p>Start your camera to discover what’s around you.</p>
                    <span>
                      Camera permission is requested only when you start.
                    </span>
                  </div>
                )}
                {running &&
                  items.map((d, i) => (
                    <div
                      className="bounding-box"
                      key={`${d.class}-${i}`}
                      style={{
                        left: `${(d.bbox[0] / dimensions.width) * 100}%`,
                        top: `${(d.bbox[1] / dimensions.height) * 100}%`,
                        width: `${(d.bbox[2] / dimensions.width) * 100}%`,
                        height: `${(d.bbox[3] / dimensions.height) * 100}%`,
                      }}
                    >
                      <span>
                        {d.class} {Math.round(d.score * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
              <div className="camera-toolbar">
                <button
                  className="button primary"
                  disabled={loading || running}
                  onClick={() => void start()}
                >
                  <Camera size={17} />
                  {loading ? "Starting…" : "Start camera"}
                </button>
                <button
                  className="button"
                  disabled={!running && !loading}
                  onClick={stop}
                >
                  <Square size={15} /> Stop
                </button>
                <button
                  className="button"
                  disabled={!running || reading}
                  onClick={() => void readText()}
                >
                  <ScanText size={17} />
                  {reading ? "Recognizing…" : "Read text"}
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    muted ? "Enable spoken responses" : "Mute spoken responses"
                  }
                  onClick={() => {
                    setMuted(!muted);
                    if ("speechSynthesis" in window) speechSynthesis.cancel();
                  }}
                >
                  {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
                </button>
              </div>
              <div className="status" role="status">
                <span className={running ? "dot" : "dot idle"} />
                {status}
                <span>COCO-SSD · 50% threshold</span>
              </div>
            </div>
            <div role="alert">
              {error && <div className="error">{error}</div>}
            </div>
            <div className="stats">
              <article>
                <span>Objects detected</span>
                <strong>{items.length.toString().padStart(2, "0")}</strong>
              </article>
              <article>
                <span>Processing</span>
                <strong>
                  On device <span className="dot" />
                </strong>
              </article>
              <article>
                <span>Scene reasoning</span>
                <strong className="small-value">Requires configuration</strong>
              </article>
            </div>
            <section id="text-reader" className="panel text-panel">
              <div className="panel-heading">
                <h2>
                  <ScanText size={18} /> Text reader
                </h2>
                <div>
                  <button
                    aria-label="Copy recognized text"
                    className="icon-button"
                    disabled={!ocr}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(ocr)
                        .then(() => log("Text copied"))
                        .catch(() =>
                          setError(
                            "Clipboard access denied. Select and copy the text manually.",
                          ),
                        )
                    }
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    aria-label="Read recognized text aloud"
                    className="icon-button"
                    disabled={!ocr}
                    onClick={() => {
                      if ("speechSynthesis" in window) {
                        speechSynthesis.cancel();
                        speechSynthesis.speak(
                          new SpeechSynthesisUtterance(ocr),
                        );
                      }
                    }}
                  >
                    <Volume2 size={17} />
                  </button>
                </div>
              </div>
              <p className={ocr ? "recognized-text" : "empty-text"}>
                {reading
                  ? "Reading your captured frame…"
                  : ocr ||
                    "Words worth noticing. Capture a frame with “Read text” to get started."}
              </p>
            </section>
            <div className="safety">
              <ShieldCheck size={16} />
              <p>
                SenseAI can miss or misidentify objects. It is not a navigation
                or mobility safety system and cannot judge distance or physical
                safety.
              </p>
            </div>
          </section>
          <aside className="insights-column">
            <section className="panel detections">
              <div className="panel-heading">
                <h2>Detected objects</h2>
                <span className="count">{items.length}</span>
              </div>
              {items.length ? (
                <ul>
                  {items.map((d, i) => (
                    <li key={i}>
                      <span className="object-icon">
                        <ScanEye size={17} />
                      </span>
                      <div>
                        <strong>{d.class}</strong>
                        <small>{position(d, dimensions.width)} of frame</small>
                      </div>
                      <span className="confidence">
                        {Math.round(d.score * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <ScanEye size={28} />
                  <p>A fresh perspective awaits.</p>
                  <small>Detected objects will appear here.</small>
                </div>
              )}
            </section>
            <section id="ai-assistant" className="panel assistant">
              <div className="panel-heading">
                <h2>
                  <MessageSquare size={17} /> Ask SenseAI
                </h2>
                <span className="tiny-badge">EVIDENCE BASED</span>
              </div>
              <div className="conversation" aria-live="polite">
                {!messages.length && (
                  <>
                    <div className="assistant-avatar">
                      <ScanEye size={20} />
                    </div>
                    <p>
                      Hi, I’m SenseAI.
                      <br />
                      <span>
                        Ask me about the objects I detect or the text you
                        capture.
                      </span>
                    </p>
                    <div className="suggestions">
                      {[
                        "What objects can you see?",
                        "How many people are visible?",
                        "Where is the chair?",
                      ].map((q) => (
                        <button key={q} onClick={() => ask(q)}>
                          {q} ↗
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {messages.map((m, i) => (
                  <div
                    className={`message ${m.role === "You" ? "user-message" : ""}`}
                    key={i}
                  >
                    <strong>{m.role}</strong>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
              >
                <label className="sr-only" htmlFor="question">
                  Ask about detections or text
                </label>
                <input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about your surroundings…"
                />
                <button
                  className="icon-button"
                  aria-label="Send question"
                  disabled={!question.trim()}
                >
                  <Send size={17} />
                </button>
              </form>
              <div className="voice-row">
                <button
                  className={listening ? "voice listening" : "voice"}
                  type="button"
                  disabled={!supported}
                  onClick={listen}
                >
                  <Mic size={14} />
                  {listening ? "Listening · stop" : "Use your voice"}
                </button>
                <small>
                  {supported
                    ? "English · browser speech"
                    : "Voice unavailable · type above"}
                </small>
              </div>
            </section>
            <section className="panel activity">
              <h2>
                <Activity size={16} /> Recent activity
              </h2>
              {activity.length ? (
                activity.map((a, i) => (
                  <p key={i}>
                    <span className="dot" />
                    {a}
                  </p>
                ))
              ) : (
                <p>Your session activity will appear here.</p>
              )}
            </section>
          </aside>
        </div>
        <footer className="studio-footer">
          SENSEAI <span>See clearly. Explore confidently.</span>
          <span>Browser inference · No camera uploads</span>
        </footer>
      </main>
    </div>
  );
}
