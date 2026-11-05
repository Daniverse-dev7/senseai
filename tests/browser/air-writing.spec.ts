import { test, expect } from "@playwright/test";
async function inkPixels(page: import("@playwright/test").Page) {
  return page.getByLabel("Air writing drawing canvas").evaluate((c) => {
    const data = (c as HTMLCanvasElement)
      .getContext("2d")!
      .getImageData(0, 0, 1280, 720).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
    return count;
  });
}
test("manual fallback draws real canvas ink, pauses, undoes, clears and exports", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await expect(
    page.getByRole("heading", { name: "Write in the air." }),
  ).toBeVisible();
  await page.getByLabel("Mouse / touch drawing").check();
  const canvas = page.getByLabel("Air writing drawing canvas");
  async function stroke() {
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 90);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 150, { steps: 12 });
    await page.mouse.up();
  }
  await stroke();
  expect(await inkPixels(page)).toBeGreaterThan(50);
  const pixels = await inkPixels(page);
  await page.getByRole("button", { name: "Pause drawing" }).click();
  await stroke();
  expect(await inkPixels(page)).toBe(pixels);
  await page.getByRole("button", { name: "Resume drawing" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save writing as PNG" }).click();
  expect((await download).suggestedFilename()).toBe("senseai-air-writing.png");
  await page.getByRole("button", { name: "Undo stroke" }).click();
  expect(await inkPixels(page)).toBe(0);
  await stroke();
  await page.getByRole("button", { name: "Clear canvas" }).click();
  expect(await inkPixels(page)).toBe(0);
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("air writing handles camera denial without disabling manual drawing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/air-writing");
  await page.getByRole("button", { name: "Start hand tracking" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Camera permission was denied",
  );
  await expect(
    page.getByRole("button", { name: "Start hand tracking" }),
  ).toBeEnabled();
  await page.getByLabel("Mouse / touch drawing").check();
});
test("canceling air writing while camera permission is pending releases late stream", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { release: () => void; stopped: boolean };
    w.stopped = false;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        new Promise((resolve) => {
          w.release = () =>
            resolve({
              getTracks: () => [
                {
                  stop: () => {
                    w.stopped = true;
                  },
                },
              ],
            });
        }),
    });
  });
  await page.goto("/air-writing");
  await page.getByRole("button", { name: "Start hand tracking" }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { release: () => void }).release(),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { stopped: boolean }).stopped),
    )
    .toBeTruthy();
});

test("hand model download failure releases camera and offers manual fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d")!;
        ctx.fillRect(0, 0, 640, 360);
        const stream = canvas.captureStream(10);
        setInterval(() => ctx.fillRect(0, 0, 640, 360), 100);
        (window as unknown as { stream: MediaStream }).stream = stream;
        return stream;
      },
    });
  });
  await page.route("https://storage.googleapis.com/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/air-writing");
  await page.getByRole("button", { name: "Start hand tracking" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Hand tracking could not load",
    { timeout: 60000 },
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { stream: MediaStream }).stream
          .getTracks()
          .every((t) => t.readyState === "ended"),
      ),
    )
    .toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Start hand tracking" }),
  ).toBeEnabled();
});

test("particle preview charges, releases and bursts without changing saved ink", async ({
  page,
}) => {
  await page.goto("/air-writing");
  const effects = page.locator(".fire-effects");
  await expect(effects).toHaveAttribute("data-phase", "idle");
  await page.getByRole("button", { name: "Preview fireball effect" }).click();
  await expect(effects).toHaveAttribute("data-phase", "charging");
  await expect
    .poll(() =>
      effects.evaluate((c) => {
        const data = (c as HTMLCanvasElement)
          .getContext("2d")!
          .getImageData(0, 0, 960, 540).data;
        return data.some((v, i) => i % 4 === 3 && v > 0);
      }),
    )
    .toBe(true);
  await expect(effects).toHaveAttribute("data-phase", "flying");
  await expect(effects).toHaveAttribute("data-phase", "burst");
  await page.screenshot({
    path: "/tmp/senseai-fireball-burst.png",
    fullPage: true,
  });
  await expect(effects).toHaveAttribute("data-phase", "idle");
  expect(await inkPixels(page)).toBe(0);
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Preview fireball effect" }).click();
  await page.getByRole("button", { name: "Pause drawing" }).click();
  await expect(effects).toHaveAttribute("data-phase", "idle");
});
test("reduced-motion preview completes and navigating away cleans up", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/air-writing");
  await page.getByRole("button", { name: "Preview fireball effect" }).click();
  await expect(page.locator(".fire-effects")).toHaveAttribute(
    "data-phase",
    "burst",
  );
  await expect(page.locator(".fire-effects")).toHaveAttribute(
    "data-phase",
    "idle",
  );
  await page.getByRole("button", { name: "Preview fireball effect" }).click();
  await page.getByRole("link", { name: "Back to studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
});
