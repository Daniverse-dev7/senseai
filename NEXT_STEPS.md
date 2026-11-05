# Next steps

1. Read status and run all checks after `npm ci`.
2. Validate real camera capture, object detection, OCR and speech in desktop Chrome and a mobile browser. Check permission denial and Stop cleanup.
3. Import the GitHub repository into Vercel using the work branch. Deploy with default Next.js settings and verify the HTTPS deployment with a real camera. Record the actual URL only after verification.
4. Optionally add a secure server vision provider with credentials stored in hosting settings. Keep the current configuration notice until verified.

Resume: clone the repository, `git checkout work`, `git pull --ff-only`, `npm ci`, `npm run dev`. Never rely only on the cloud filesystem. Preserve meaningful checkpoints in GitHub.
