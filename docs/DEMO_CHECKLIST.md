# Final device rehearsal

The automated audit passed 40 unit tests and 32 browser tests. These checks do not establish physical-camera gesture accuracy or freehand OCR quality.

After the approved commits deploy:

1. Open `/air-writing` in desktop Chrome over HTTPS. Start tracking and allow the camera. Confirm the cursor follows your index finger.
2. Write slow letters and fast curves. Pinch to write, release between letters. Briefly introduce your second hand; the writing hand should remain selected. Move out of view and return elsewhere; there should be no connecting line.
3. Try Continuous pen control. Use Put pen down / Lift pen (or Space outside form fields). Escape pauses drawing. Resume explicitly and lower the pen again.
4. Recognize clear English block letters, correct the text and apply a style. Drawing pauses during review. Export PNG; restore original ink and test undo/redo.
5. Try each effect separately, then record and replay a short downloaded clip. Stop tracking and confirm the camera indicator switches off.

If physical tracking struggles, improve front lighting and keep the full hand visible. Mouse/touch drawing remains available. Do not present OCR as guaranteed handwriting transcription; review its output before applying typography.
