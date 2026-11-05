import { test, expect } from "@playwright/test";
for (const [mode, preview, phase, next] of [
  ["Lightning", "Preview lightning", "lightning-linked", "lightning-release"],
  [
    "Freeze + shatter",
    "Preview freeze + shatter",
    "ice-freezing",
    "ice-shattering",
  ],
  ["Living drawings", "Preview butterfly", "living-flight", "living-flight"],
])
  test(`${mode} renders actual pixels and clears on Escape`, async ({
    page,
  }) => {
    await page.goto("/air-writing");
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.getByRole("button", { name: preview, exact: true }).click();
    const c = page.locator(".element-effects");
    await expect(c).toHaveAttribute("data-phase", phase);
    await expect
      .poll(() =>
        c.evaluate((el) => {
          const c = el as HTMLCanvasElement;
          return c
            .getContext("2d")!
            .getImageData(0, 0, 960, 540)
            .data.some((v, i) => i % 4 === 3 && v > 0);
        }),
      )
      .toBe(true);
    await expect(c).toHaveAttribute("data-phase", next, { timeout: 8000 });
    await page.keyboard.press("Escape");
    await expect(c).toHaveAttribute("data-phase", "idle");
    await expect(
      page.getByRole("button", { name: "Save writing as PNG" }),
    ).toBeDisabled();
  });
test("living drawings animate a real pointer sketch and preserve PNG ink", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Living drawings", exact: true })
    .click();
  await page.getByLabel("Mouse / touch drawing").check();
  const ink = page.getByLabel("Air writing drawing canvas");
  await ink.scrollIntoViewIfNeeded();
  const b = (await ink.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.3, {
    steps: 20,
  });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Bring drawing to life", exact: true })
    .click();
  await expect(page.locator(".element-effects")).toHaveAttribute(
    "data-phase",
    "living-flight",
  );
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Writing + fire", exact: true })
    .click();
  await expect(page.locator(".element-effects")).toHaveAttribute(
    "data-phase",
    "idle",
  );
});

test("new effects are included in recorded video", async ({ page }) => {
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Living drawings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview butterfly", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.locator(".recording-time")).toContainText("00:02");
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  const v = page.getByLabel("Recorded clip preview");
  await expect
    .poll(() => v.evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  await v.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => v.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.2);
  expect(
    await v.evaluate((v: HTMLVideoElement) => {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 90;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v, 0, 0, 160, 90);
      return ctx
        .getImageData(0, 0, 160, 90)
        .data.some((n, i) => i % 4 !== 3 && n > 100);
    }),
  ).toBe(true);
});
