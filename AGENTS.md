# SenseAI development

Read PROJECT_STATUS.md, DEVELOPMENT_LOG.md and NEXT_STEPS.md first. Verify branch, working tree, remote and remote synchronization before editing. Each cloud task is isolated; use the existing checkout and do not create worktrees unless requested.

Next.js App Router: app/page.tsx is the landing page; app/studio/page.tsx owns camera and browser inference; lib/vision.ts contains pure evidence-based response functions. app/globals.css provides responsive styling. Tests live in tests/. Air writing lives in app/air-writing/page.tsx; lib/air-writing.ts contains pinch, smoothing and stroke-connect logic. Keep the MediaPipe CDN WASM version aligned with the pinned package. Air writing draws ink; the explicit OCR panel can convert clear English writing into editable text. Never imply automatic or guaranteed handwriting transcription. lib/fire-gesture.ts handles debounced open-palm to closed-fist transitions; lib/fire-renderer.ts owns bounded Canvas2D particles, preview, reduced motion and cleanup. lib/screen-burst.ts handles the fixed viewport overlay, and lib/ink.ts handles continuous quadratic stroke paths and replay. Keep visual effects separate from the ink export; reset global effects on Stop, Escape, visibility loss and unmount. Never treat missing hand landmarks as a release gesture.

lib/energy-gesture.ts handles two-palm release; lib/portal.ts recognizes closed circles; lib/magic-renderer.ts draws energy and portals. lib/scene-recorder.ts composites camera and effect layers for local video export; app/air-writing/recording-panel.tsx owns recording UI. Keep recordings local, bounded, and release capture tracks on stop/unmount.

lib/element-gesture.ts gates lightning and ice gestures; lib/element-renderer.ts owns lightning, frost shards and animated ink copies. Living drawings animate user ink without claiming shape recognition. Include the element canvas in scene recordings.

lib/smooth-pen.ts provides timestamp-aware adaptive pen filtering with immediate lift and gap resets. The temporary ink-tip canvas holds the entire active continuous path, commits once at stroke end, and remains included in recordings. Dropout recovery and borderline-lift grace must freeze ink and only reconnect nearby positions.

lib/ink-text.ts prepares alpha-only ink for OCR and draws typography; app/air-writing/text-panel.tsx owns worker lifecycle, cancellation and editable review. Preserve original ink and keep the styled canvas in export/recording. Writing is the default mode; all effects remain opt-in.

Use strict TypeScript. Never fabricate detections, OCR output, scene reasoning, deployment URLs or test outcomes. Never send secrets to client JavaScript. Preserve camera cleanup, inference serialization and permission fallback behavior.

Run npm test, npm run typecheck, npm run lint and npm run build. Browser tests must distinguish mocked camera control tests from real model inference. Check permission failures, resource cleanup, OCR, speech fallback and responsive layout.

Checkpoint every completed milestone with updated status/log/next steps, a descriptive commit, and a push to origin. Verify remote commit matches local HEAD and report blockers immediately. Do not commit .env, downloaded models, node_modules or build output. Before resuming on another computer fetch, inspect changes, and pull --ff-only; never reset away user work.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
