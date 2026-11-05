import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("records real effect frames to a playable downloadable video", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Portal drawing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview portal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.locator(".recording-time")).toContainText("00:02");
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  const video = page.getByLabel("Recorded clip preview");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBe(1280);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.2);
  const bright = await video.evaluate((v: HTMLVideoElement) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 72;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0, 128, 72);
    return ctx
      .getImageData(0, 0, 128, 72)
      .data.some((n, i) => i % 4 !== 3 && n > 80);
  });
  expect(bright).toBe(true);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download clip/ }).click();
  const download = await downloadPromise;
  const bytes = await readFile((await download.path())!);
  expect(bytes.length).toBeGreaterThan(2000);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("1a45dfa3");
});

test("unavailable recorder explains fallback without breaking drawing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "MediaRecorder", { value: undefined });
  });
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Scene recording" }).getByRole("alert"),
  ).toContainText("Try desktop Chrome");
  await page.getByLabel("Mouse / touch drawing").check();
  await expect(page.getByLabel("Mouse / touch drawing")).toBeChecked();
});

test("recording stops capture tracks when navigating away", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const capture = HTMLCanvasElement.prototype.captureStream;
    const tracks: MediaStreamTrack[] = [];
    Object.assign(window, { recordedTracks: tracks });
    HTMLCanvasElement.prototype.captureStream = function (rate?: number) {
      const stream = capture.call(this, rate);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.getByRole("link").first().click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tracks = (
          window as unknown as { recordedTracks: MediaStreamTrack[] }
        ).recordedTracks;
        return (
          tracks.length > 0 && tracks.every((t) => t.readyState === "ended")
        );
      }),
    )
    .toBe(true);
});
