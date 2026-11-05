# Development log

## 2026-11-05 — Initial implementation

Started from a README-only repository. Implemented Next.js landing and studio, dynamic browser model loading, serialized detection, real camera frame OCR, typed evidence-based assistance, browser speech controls, accessibility settings and responsive styling. Advanced vision-language reasoning remains explicitly unconfigured. No paid provider or secret is needed for the primary workflow.

Chose browser inference to avoid server camera uploads and heavyweight deployment infrastructure. Initial network commands required the configured proxy outside the command sandbox. GitHub read access is verified. Deployment authentication is not yet available.

## Validation checkpoint

Fresh frozen-lockfile installation, five unit tests, typecheck, lint and production build all passed. Added seven Chromium integration checks; all passed against the production server. Real OCR read a generated video frame. Verified development server route content. Captured actual UI screenshots.

Fixed object counts for absent categories, made model-download failures actionable, guarded workers loaded after unmount, and verified camera release on cancellation/model failure. Removed the external font request so the interface does not depend on Google Fonts. Reformatted code for maintainability. Browser test config reuses an available Chromium and inherited proxy, or Playwright's installed browser elsewhere.

A failed browser test initially selected Next.js's route-announcement alert as well as the application error; scoped the selector. Another generated-camera fixture produced no frames; drawing frames corrected the fixture and the actual failure path passed. No assertions were disabled.

Cloud egress blocks storage.googleapis.com, preventing actual detector-model validation. Saved domain additions with reusable environment installation/start instructions; saving does not apply runtime policy or deploy the site. Vercel credentials are unavailable. Public release and real-device checks remain pending, and are not presented as completed.
