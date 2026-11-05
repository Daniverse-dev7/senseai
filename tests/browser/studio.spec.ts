import { test, expect } from "@playwright/test";
test("landing, typed evidence fallback, accessibility and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({ path: "/tmp/senseai-landing.png", fullPage: true });
  await expect(
    page.getByRole("heading", { name: "See more. Understand more." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Launch SenseAI" }).click();
  await expect(
    page.getByRole("heading", { name: "Your world, in focus." }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/senseai-studio-default.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "What objects can you see?" }).click();
  await expect(
    page.getByText("No objects are currently detected.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("High contrast").check();
  await page.getByLabel("Larger text").check();
  await expect(page.locator(".studio")).toHaveClass(
    /high-contrast.*large-text/,
  );
  await page.getByRole("button", { name: "Live Vision", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "/tmp/senseai-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: "/tmp/senseai-studio.png", fullPage: true });
});
test("camera permission denial is actionable and retryable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Camera permission was denied" }),
  ).toContainText("Camera permission was denied");
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeEnabled();
});
test("pending camera is stopped and its tracks are released", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      releaseCamera: () => void;
      trackStopped: boolean;
    };
    w.trackStopped = false;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        new Promise((resolve) => {
          w.releaseCamera = () =>
            resolve({
              getTracks: () => [
                {
                  stop: () => {
                    w.trackStopped = true;
                  },
                },
              ],
            });
        }),
    });
  });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { releaseCamera: () => void }).releaseCamera(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { trackStopped: boolean }).trackStopped,
      ),
    )
    .toBeTruthy();
  await expect(page.getByRole("status")).toContainText("Camera stopped");
});
test("real OCR reads a generated test frame", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 1280;
        c.height = 720;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "black";
        ctx.font = "bold 80px Arial";
        ctx.fillText("HELLO SENSEAI", 100, 200);
        const stream = c.captureStream(10);
        setInterval(() => {
          ctx.fillStyle = "black";
          ctx.fillText("HELLO SENSEAI", 100, 200);
        }, 100);
        return stream;
      },
    });
  });
  // Only the model request is held. OCR runs the real downloaded worker, WASM and English data.
  await page.route("https://storage.googleapis.com/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 90000));
    await route.abort("blockedbyclient").catch(() => {});
  });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Read text", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Read text", exact: true }).click();
  await expect(page.locator(".recognized-text")).toContainText(
    "HELLO SENSEAI",
    { timeout: 80000 },
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
});

test("failed model download releases a real generated media stream", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 640, 480);
        const media = canvas.captureStream(10);
        setInterval(() => ctx.fillRect(0, 0, 640, 480), 100);
        (window as unknown as { testStream: MediaStream }).testStream = media;
        return media;
      },
    });
  });
  await page.route("https://storage.googleapis.com/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/studio");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.locator(".error")).toContainText(
    "Detection model could not load",
    { timeout: 30000 },
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { testStream: MediaStream }).testStream
          .getTracks()
          .every((t) => t.readyState === "ended"),
      ),
    )
    .toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeEnabled();
});

test("speech unavailable keeps typed questions usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
    });
  });
  await page.goto("/studio");
  await expect(
    page.getByRole("button", { name: "Use your voice" }),
  ).toBeDisabled();
  await page.getByLabel("Ask about detections or text").fill("Read the text");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.locator(".message").last()).toContainText(
    "No text has been captured",
  );
});

test("spoken responses cancel previous speech and microphone errors retain fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { spoken: string[]; cancellations: number };
    w.spoken = [];
    w.cancellations = 0;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        cancel: () => w.cancellations++,
        speak: (u: SpeechSynthesisUtterance) => w.spoken.push(u.text),
      },
    });
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        queueMicrotask(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        });
      }
      stop() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: Recognition });
  });
  await page.goto("/studio");
  await page
    .getByRole("button", { name: "Enable spoken responses", exact: true })
    .click();
  await page.getByRole("button", { name: "What objects can you see?" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { spoken: string[] }).spoken.length,
      ),
    )
    .toBe(1);
  await page.getByLabel("Ask about detections or text").fill("Read text");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { spoken: string[] }).spoken.length,
      ),
    )
    .toBe(2);
  expect(
    await page.evaluate(
      () => (window as unknown as { cancellations: number }).cancellations,
    ),
  ).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Use your voice" }).click();
  await expect(page.locator(".error")).toContainText("not-allowed");
  await expect(
    page.getByRole("button", { name: "Use your voice" }),
  ).toBeEnabled();
});
