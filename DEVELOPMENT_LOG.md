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

## Full-screen burst and Air Writing quality update

The explosion now uses a fixed, pointer-transparent canvas covering the full browser viewport. Camera-local charging/fireball flight transitions into expanding textured fire billows, a warm exposure pulse, cooling smoke, radial embers and a shockwave. Resize-aware resolution is capped at about 2.1 million pixels. Escape, Pause, Stop, manual-mode changes, page visibility loss and unmount clear effects. Reduced-motion users receive a smaller softened glow. The labeled preview demonstrates the actual visual effect without claiming hand recognition. Screenshot: docs/fullscreen-fire-preview.png.

Air Writing now uses incremental quadratic curves, speed-adaptive stabilization with a user slider, redo, brighter adjustable camera visibility, focus mode and HD PNG output. Camera startup requests 1920×1080 at 30fps, reports actual negotiated resolution, and adapts the stage and export aspect ratio. Default PNG size is 1920×1080; actual camera aspect ratios may produce different export heights within the pixel budget. Effects never enter the exported ink image.

Validation: 17 unit tests and the complete 15-test Chromium suite passed, including full-screen pixels outside the camera panel, mobile resize, Escape cleanup, reduced motion, drawing/redo, focus controls, and actual downloaded PNG dimensions. After a final fire-texture refinement, all three affected animation tests passed again. Lint, TypeScript and production build passed. Physical-camera hand tracking and the public Vercel rollout remain unverified from this restricted cloud.

## Milestone 1 — Two-hand energy ball

Added an explicit Two-hand energy mode, real MediaPipe two-hand detection, a midpoint-following plasma sphere that grows with hand separation, and a debounced release based on both palms growing in the image. Hand loss and separation alone do not release it. The labeled preview renders the real sphere without claiming live recognition. 20 unit tests, lint, TypeScript and production build passed; the energy preview/browser cleanup check passed. Physical two-hand recognition remains unverified under the cloud model-host restriction. Portal drawing and video recording are the next milestones.

## Milestone 2 — Circle-to-portal drawing

Added Portal drawing mode with aspect-correct closed-circle recognition using uniformly spaced stroke samples, radial error, closure, angular coverage and path length. A matching stroke becomes a seven-second swirling starfield portal with a glowing spark rim; rejected strokes stay as ink. Works with real pinch strokes or the existing pointer fallback. 23 unit tests, three energy/portal browser tests, lint, TypeScript and production build passed. Chromium actually drew a circle and invoked the production recognizer; no portal result was mocked. Video recording is the next milestone.


## Milestone 3 — Local scene recording

Added scene-only video recording that composites the mirrored active camera, ink, fire, energy and portal layers. Full-screen fire fits inside the clip. Silent clips stop after 30 seconds or 64 MB, on camera Stop, or when the tab becomes hidden; navigation disposes capture tracks. Output is up to 1280 pixels wide within a 720p pixel budget, with browser-supported WebM/MP4, playback preview and local download. No upload, microphone or screen-sharing permission is involved. Unsupported browsers show a clear fallback.

Validation: 23 unit tests, TypeScript, lint and production build passed. The full 21-test browser run had one test-selector failure because Next.js also supplies an alert element; scoped the assertion to the recording panel and all three recording tests passed on rerun. Actual encoded video playback, visible effect pixels, a downloaded WebM header, unsupported-browser fallback and capture-track cleanup were verified. An intermediate rerun failed because the local server had stopped on session resume; restarted it before successful verification. Real physical-camera hand recognition and the public Vercel rollout remain unverified under the cloud network policy.


## Cinematic textures and close-then-thrust release

Added cached multi-octave turbulent textures for the fire core, counter-rotating plasma shells with lightning, and layered portal nebulae with spiral depth. Fire charge grows over time; the projectile expands toward the viewer. Portal mode now accepts an open-palm charge followed by a fist and forward thrust, while retaining circle drawing. Fire also requires that thrust: closing alone does not launch. The shared recognizer uses sustained 23% palm-bone scale growth relative to the initial fist, bounded lateral drift, a short time window and tracking continuity. It rejects tested stationary fists, sideways motion and isolated size spikes. It estimates motion from camera geometry, not true depth. Placeholder copy hides while previews are active.

Validation: 24 unit tests and all 21 production Chromium browser checks passed, including real video playback/download, drawing, portal recognition, fire/energy rendering, reduced motion, camera permission failures and cleanup. TypeScript, lint and production build passed. Preview screenshots were visually reviewed and saved in docs/cinematic-energy.png and docs/cinematic-portal.png; they demonstrate rendered effects, not webcam inference. Physical hand tracking and Vercel rollout remain unverified from this cloud. Do not describe the gesture as perfect or physically calibrated.


## Lightning, crystalline frost and living ink

Added three explicit modes on a separate scene canvas included in video recordings. Lightning connects two open palms with branching arcs; one closed fist and forward thrust releases it while both hands remain visible. Ice requires a sideways open-palm sweep, then a fist to crack and forward thrust to shatter. Cached branching frost crystals break into irregular triangular facets. Living drawings animate a cropped copy of actual user ink, preserving original PNG content, and follow a visible palm. Hold an open palm or use Bring drawing to life. The butterfly preview is a built-in example, not shape recognition. Effects have automatic expiry, Escape/Stop/pause/mode/visibility/unmount cleanup and reduced-motion behavior.

Validation: 27 unit tests passed, including sweep gating, one-fist lightning release and loss rejection. Initial 25-test browser run passed 24 and exposed a lightning preview timing bug; corrected its phase clock, refined frost after visual review, and all five new effect browser checks passed on the final build. Those checks cover actual rendered pixels, transitions, Escape, animating real pointer ink while preserving PNG, mode cleanup, and actual recorded-video playback containing the new layer. Existing 21 regression checks passed in the full run. Lint, TypeScript and production build passed. Screenshots docs/frost-preview.png and docs/living-preview.png show camera-free previews. Physical hand inference, device frame rates and Vercel rollout remain unverified; no photorealism or perfect gesture accuracy is claimed.
