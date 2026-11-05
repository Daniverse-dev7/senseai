# Next steps

Test https://senseai-pi.vercel.app/air-writing after the latest main deployment. Open your hand briefly to charge; close all four fingers into a fist to launch a fireball and full-screen burst. Verify tracking loss or a writing pinch does not launch, Stop clears effects, and PNG exports only ink. The Preview full-screen burst button can demonstrate the animation without camera access.

**Latest feature:** Air writing is implemented at `/air-writing`. After Vercel finishes deploying the new main commit, test one-hand tracking, pinch/release between strokes, pause, clear, undo and saved PNG on a physical webcam. Hand-model inference remains unverified here because the cloud blocks its official download host. The user supplied https://senseai-pi.vercel.app/studio; this cloud currently blocks that domain, so live deployment validation remains pending.

1. **Public deployment:** Import https://github.com/Daniverse-dev7/senseai into Vercel. Select the branch with the final implementation (`work`; `main` is also intended to receive the final fast-forward checkpoint). Choose Next.js, install `npm ci`, build `npm run build`. No environment variables needed. Send the actual HTTPS deployment URL for verification.
2. **Real device verification:** Start camera on the HTTPS site in desktop Chrome. Confirm real boxes/counts/localization with a person and chair/bottle; recognize a printed text page; test text copy and audible output; ask typed and spoken questions; deny permissions; stop camera and confirm its indicator goes off. Repeat basic camera/layout checks on a mobile browser.
3. **Cloud detector validation:** Review/save the saved storage.googleapis.com network addition in environment settings and publish the environment. Retry actual model inference; do not claim it passed until it does. Vercel domains were also added to the draft, but deployment still requires authentication.
4. **Optional:** Add a securely configured server vision-language provider. Retain the explicit configuration notice until actual frame reasoning is verified. Add Urdu support later.

Before launch, test the full-screen burst on a physical phone and desktop webcam. Verify Escape, Stop and page navigation clear it; pinch still writes; redo works; PNG contains ink only. Try stabilization and camera visibility sliders, focus mode, and actual camera resolution. Physical hand tracking remains unverified in this cloud.

## Resume from any computer

Clone the repository; `git fetch origin`; `git checkout work`; `git pull --ff-only`; read AGENTS.md and the status/log files; run `npm ci`, then `npm run dev`. Use Node.js 22 or 24. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

For browser tests, install Chromium with `npx playwright install chromium` if needed, start the production app (`npm start` after a build), then `npm run test:browser` in another terminal. Tests use system Chromium if available; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH can select another binary. SENSEAI_TEST_URL selects a different app URL; tests still use controlled/generated camera fixtures and do not validate physical hardware.

Commit and push every completed milestone with updated documentation. Verify local HEAD against remote refs. Never rely only on cloud storage or overwrite uncommitted work.
