import type { HandLandmarker } from "@mediapipe/tasks-vision";
/** Abort the caller promptly; dispose resources that finish initializing after cancellation. */
export function abortable<T>(
  task: Promise<T>,
  signal: AbortSignal,
  dispose?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("Operation canceled", "AbortError"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    task.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) dispose?.(value);
        else resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
export async function loadHandTracker(
  signal: AbortSignal,
): Promise<HandLandmarker> {
  const response = await fetch(
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    { signal },
  );
  if (!response.ok) throw new Error("Hand model download failed");
  const model = new Uint8Array(await response.arrayBuffer());
  const { FilesetResolver, HandLandmarker } = await abortable(
    import("@mediapipe/tasks-vision"),
    signal,
  );
  const files = await abortable(
    FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm",
    ),
    signal,
  );
  const create = (delegate: "GPU" | "CPU") =>
    abortable(
      HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetBuffer: model, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
      signal,
      (hand) => hand.close(),
    );
  try {
    return await create("GPU");
  } catch (error) {
    if (signal.aborted) throw error;
    return create("CPU");
  }
}
