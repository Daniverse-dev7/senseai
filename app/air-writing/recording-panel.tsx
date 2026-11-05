import { useEffect, useRef, useState, type RefObject } from "react";
import { Circle, Download, Square } from "lucide-react";
import { SceneRecorder } from "../../lib/scene-recorder";

type Props = {
  video: RefObject<HTMLVideoElement | null>;
  ink: RefObject<HTMLCanvasElement | null>;
  layers: RefObject<HTMLCanvasElement | null>[];
  recorderRef: RefObject<SceneRecorder | null>;
};
export default function RecordingPanel({
  video,
  ink,
  layers,
  recorderRef,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{
    url: string;
    extension: string;
    size: string;
  } | null>(null);
  const [error, setError] = useState("");
  const url = useRef("");
  useEffect(
    () => () => {
      recorderRef.current?.dispose();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [recorderRef],
  );
  function start() {
    setError("");
    if (
      typeof MediaRecorder === "undefined" ||
      !HTMLCanvasElement.prototype.captureStream
    ) {
      setError(
        "Video recording is unavailable in this browser. Try desktop Chrome.",
      );
      return;
    }
    if (
      !video.current ||
      !ink.current ||
      layers.some((layer) => !layer.current)
    )
      return;
    try {
      recorderRef.current?.dispose();
      recorderRef.current = new SceneRecorder(
        {
          video: video.current,
          ink: ink.current,
          layers: layers.map((layer) => layer.current!),
        },
        {
          tick: setSeconds,
          finishing: () => setPhase("saving"),
          done: (blob) => {
            if (url.current) URL.revokeObjectURL(url.current);
            url.current = URL.createObjectURL(blob);
            setClip({
              url: url.current,
              extension: blob.type.includes("mp4") ? "mp4" : "webm",
              size: `${(blob.size / 1024 / 1024).toFixed(1)} MB`,
            });
            setPhase("idle");
          },
          error: () => {
            setError("The recording could not be saved. Please try again.");
            setPhase("idle");
          },
        },
      );
      setSeconds(0);
      setPhase("recording");
    } catch {
      setPhase("idle");
      setError(
        "This browser could not start video recording. Try desktop Chrome.",
      );
    }
  }
  return (
    <section className="recording-panel" aria-label="Scene recording">
      <h3>Record your scene</h3>
      <p className="air-note">
        Camera if active + writing + effects. Silent clips up to 30 seconds,
        saved on your device. Full-screen bursts fit inside the video.
      </p>
      <button
        className={`button ${phase === "recording" ? "recording-active" : ""}`}
        disabled={phase === "saving"}
        onClick={
          phase === "recording" ? () => recorderRef.current?.stop() : start
        }
      >
        {phase === "recording" ? <Square size={16} /> : <Circle size={16} />}
        {phase === "recording"
          ? "Stop recording"
          : phase === "saving"
            ? "Saving clip…"
            : "Start recording"}
      </button>
      <p className="air-note recording-time" aria-live="polite">
        {phase === "recording"
          ? `Recording · 00:${String(seconds).padStart(2, "0")} / 00:30`
          : phase === "saving"
            ? "Finishing your clip…"
            : clip
              ? "Clip ready. Download it to keep it."
              : "Previews and mouse drawing work without a camera, too."}
      </p>
      {error && (
        <p className="air-note" role="alert">
          {error}
        </p>
      )}
      {clip && (
        <div className="recorded-clip">
          <video
            src={clip.url}
            controls
            playsInline
            preload="metadata"
            aria-label="Recorded clip preview"
          />
          <a
            className="button"
            href={clip.url}
            download={`senseai-clip.${clip.extension}`}
          >
            <Download size={16} />
            Download clip · {clip.size}
          </a>
        </div>
      )}
    </section>
  );
}
