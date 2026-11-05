# Development log

## 2026-11-05 — Initial implementation

Started from a README-only repository. Implemented Next.js landing and studio, dynamic browser model loading, serialized detection, real camera frame OCR, typed evidence-based assistance, browser speech controls, accessibility settings and responsive styling. Advanced vision-language reasoning remains explicitly unconfigured. No paid provider or secret is needed for the primary workflow.

Chose browser inference to avoid server camera uploads and heavyweight deployment infrastructure. Initial network commands required the configured proxy outside the command sandbox. GitHub read access is verified. Deployment authentication is not yet available.

## Validation checkpoint

Fresh frozen-lockfile installation, five unit tests, typecheck, lint and production build all passed. Added seven Chromium integration checks; all passed against the production server. Real OCR read a generated video frame. Verified development server route content. Captured actual UI screenshots.

Fixed object counts for absent categories, made model-download failures actionable, guarded workers loaded after unmount, and verified camera release on cancellation/model failure. Removed the external font request so the interface does not depend on Google Fonts. Reformatted code for maintainability. Browser test config reuses an available Chromium and inherited proxy, or Playwright's installed browser elsewhere.

A failed browser test initially selected Next.js's route-announcement alert as well as the application error; scoped the selector. Another generated-camera fixture produced no frames; drawing frames corrected the fixture and the actual failure path passed. No assertions were disabled.

Cloud egress blocks storage.googleapis.com, preventing actual detector-model validation. Saved domain additions with reusable environment installation/start instructions; saving does not apply runtime policy or deploy the site. Vercel credentials are unavailable. Public release and real-device checks remain pending, and are not presented as completed.

## Air writing

Implemented an independent browser-only MediaPipe Hand Landmarker workflow so air writing does not require the COCO object model to start. A mirrored index-tip cursor follows one hand; normalized thumb/index pinch distance relative to palm size controls pen contact with hysteresis. Stroke smoothing reduces jitter; pen release, tracking loss and large jumps separate strokes. Manual drawing remains available when model loading fails. Camera resources, animation loops and late model creation are guarded on stop/unmount.

Canvas history supports undo, clear, color/width changes and PNG export of ink only. Pinned MediaPipe JavaScript/WASM to the same version. Added focused gesture unit tests and browser drawing/export/lifecycle checks, then ran all existing regressions: 9 unit and 11 browser tests passed. Actual physical hand-tracking inference is not verified because cloud egress still blocks the official model host. No fake tracking results are used.

## Open-palm fire animation

Added animated flames that follow the mirrored palm when all four fingers are extended. Three consecutive tracked frames activate the effect; closing the hand, tracking loss, pause, manual mode and Stop turn it off. Pinching remains reserved for drawing. Flames are an overlay and do not appear in PNG exports; reduced-motion preferences disable flicker. Open/closed hand, pinch and rotation unit tests passed (12 total); lint, TypeScript and production build passed. Actual webcam gesture validation remains pending because the cloud blocks the hand-model download.

The fire update's four air-writing browser checks passed after correcting a test fixture to remeasure the canvas following page scrolling. The added instructions made the panel taller; cached screen coordinates no longer pointed at the canvas after clicking Undo. No app assertion was disabled.

## Particle fire and fist-release fireball

Replaced CSS flame shapes with a bounded Canvas2D particle renderer: hot core glow, turbulent flame wisps, embers, smoke, an arcing fireball, expanding burst and shock ring. Hold an open palm briefly, then close all four fingers to release once. Gesture debounce, tracking continuity checks and explicit fist classification prevent launch from tracking loss, pinches or a single noisy sample. Pause, Stop, manual mode, hidden document and unmount reset effects. The animation uses a separate canvas and does not enter PNG exports. Reduced-motion users get a softened, stationary glow in place of fast particle motion.

Added a clearly labeled camera-free animation preview. Chromium verified actual charge, flight and burst pixels, ink separation, cancellation, reduced-motion completion and navigation cleanup. All 16 unit tests and six Air Writing browser tests passed; lint, TypeScript and production build passed. Screenshot in docs/fireball-preview.png shows the animation preview, not real hand recognition. Physical-camera gesture recognition remains unverified due to the cloud model-download restriction. The known public URL is https://senseai-pi.vercel.app/air-writing; no fresh public rollout is claimed.
