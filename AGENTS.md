# SenseAI development

Read PROJECT_STATUS.md, DEVELOPMENT_LOG.md and NEXT_STEPS.md first. Verify branch, working tree, remote and remote synchronization before editing. Each cloud task is isolated; use the existing checkout and do not create worktrees unless requested.

Next.js App Router: app/page.tsx is the landing page; app/studio/page.tsx owns camera and browser inference; lib/vision.ts contains pure evidence-based response functions. app/globals.css provides responsive styling. Tests live in tests/.

Use strict TypeScript. Never fabricate detections, OCR output, scene reasoning, deployment URLs or test outcomes. Never send secrets to client JavaScript. Preserve camera cleanup, inference serialization and permission fallback behavior.

Run npm test, npm run typecheck, npm run lint and npm run build. Browser tests must distinguish mocked camera control tests from real model inference. Check permission failures, resource cleanup, OCR, speech fallback and responsive layout.

Checkpoint every completed milestone with updated status/log/next steps, a descriptive commit, and a push to origin. Verify remote commit matches local HEAD and report blockers immediately. Do not commit .env, downloaded models, node_modules or build output. Before resuming on another computer fetch, inspect changes, and pull --ff-only; never reset away user work.
