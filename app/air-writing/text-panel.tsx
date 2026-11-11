import { useEffect, useRef, useState, type RefObject } from "react";
import {
  prepareInkText,
  renderStyledText,
  type TextStyle,
} from "../../lib/ink-text";
type Worker = Awaited<
  ReturnType<(typeof import("tesseract.js"))["createWorker"]>
>;
export default function TextPanel({
  inkRef,
  outputRef,
  finish,
  hasInk,
  onStyledChange,
}: {
  inkRef: RefObject<HTMLCanvasElement | null>;
  outputRef: RefObject<HTMLCanvasElement | null>;
  finish: () => void;
  hasInk: boolean;
  onStyledChange: (active: boolean) => void;
}) {
  const [text, setText] = useState(""),
    [style, setStyle] = useState<TextStyle>("editorial"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "Write clearly in English, then recognize and review the result.",
    );
  const downloadRef = useRef<AbortController | null>(null);
  const workerRef = useRef<Worker | null>(null),
    generation = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
      downloadRef.current?.abort();
      void workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );
  async function recognize() {
    if (pending.current) return;
    finish();
    const source = inkRef.current && prepareInkText(inkRef.current);
    if (!source) {
      setMessage("Add handwriting before recognizing text.");
      return;
    }
    const id = ++generation.current;
    pending.current = true;
    setBusy(true);
    setMessage("Reading your ink locally… First use downloads the OCR model.");
    try {
      const { createWorker, PSM } = await import("tesseract.js");
      if (!workerRef.current) {
        if (id !== generation.current) return;
        const controller = new AbortController();
        downloadRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(
            "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("OCR language download failed");
          await response.arrayBuffer();
        } finally {
          clearTimeout(timeout);
        }
        if (id !== generation.current) return;
        // Preflight the model with cancellation and warm the HTTP cache before worker initialization.
        const worker = await new Promise<Worker>((resolve, reject) => {
          createWorker("eng", 1, {
            errorHandler: reject,
          }).then(resolve, reject);
        });
        if (id !== generation.current) {
          await worker.terminate();
          return;
        }
        workerRef.current = worker;
      }
      await workerRef.current.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      });
      const result = await workerRef.current.recognize(source);
      if (id !== generation.current) return;
      const recognized = result.data.text.trim().slice(0, 160);
      setText(recognized);
      setMessage(
        recognized
          ? `Recognition confidence: ${Math.round(result.data.confidence)}%. Review and correct before applying a style.`
          : "No readable text found. Try clear, separated letters, or type a correction below.",
      );
    } catch {
      if (id === generation.current)
        setMessage(
          "Recognition could not complete. Check the connection for the initial model download, or enter the text below.",
        );
    } finally {
      if (id === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  function cancel() {
    generation.current++;
    downloadRef.current?.abort();
    void workerRef.current?.terminate();
    workerRef.current = null;
    pending.current = false;
    setBusy(false);
    setMessage("Recognition canceled. Your original ink is kept.");
  }
  function apply() {
    finish();
    const out = outputRef.current!,
      ink = inkRef.current!;
    out.width = ink.width;
    out.height = ink.height;
    renderStyledText(out, text, style);
    onStyledChange(true);
    setMessage(
      "Styled text is on the canvas. Save as PNG or record it. Drawing again returns to your original ink.",
    );
  }
  return (
    <section className="text-panel" aria-label="Handwriting to text">
      <div className="eyebrow">INK → TYPE</div>
      <h3>Turn handwriting into typography</h3>
      <p className="air-note">
        Best with clear block letters. Cursive may need corrections. Your
        original ink is preserved.
      </p>
      <button className="button" disabled={busy || !hasInk} onClick={recognize}>
        {busy ? "Recognizing…" : "Recognize handwriting"}
      </button>
      {busy && (
        <button className="button" onClick={cancel}>
          Cancel recognition
        </button>
      )}
      <p className="air-note" aria-live="polite">
        {message}
      </p>
      <label>
        Review text · {text.length}/160
        <textarea
          aria-label="Recognized text"
          value={text}
          maxLength={160}
          rows={3}
          placeholder="Recognized text appears here. You can also type or correct it."
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label>
        Text style
        <select
          aria-label="Text style"
          value={style}
          onChange={(e) => setStyle(e.target.value as TextStyle)}
        >
          <option value="editorial">Editorial serif</option>
          <option value="signature">Signature script</option>
          <option value="modern">Modern sans</option>
        </select>
      </label>
      <div className="air-actions">
        <button
          className="button primary"
          disabled={!text.trim() || busy}
          onClick={apply}
        >
          Apply text style
        </button>
        <button
          className="button"
          onClick={() => {
            const c = outputRef.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            c.dataset.active = "false";
            onStyledChange(false);
            setMessage("Original ink restored.");
          }}
        >
          Show original ink
        </button>
      </div>
    </section>
  );
}
