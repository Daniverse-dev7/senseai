import { test, expect } from "@playwright/test";
test("energy mode previews a real animated sphere, releases and cleans up", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Two-hand energy", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Two-hand energy", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Preview energy ball" }).click();
  const c = page.locator(".magic-effects");
  await expect(c).toHaveAttribute("data-phase", "energy-charging");
  expect(
    await c.evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      return canvas
        .getContext("2d")!
        .getImageData(0, 0, 960, 540)
        .data.some((v, i) => i % 4 === 3 && v > 0);
    }),
  ).toBe(true);
  await expect(c).toHaveAttribute("data-phase", "energy-release");
  await expect(c).toHaveAttribute("data-phase", "idle");
  await page.getByRole("button", { name: "Preview energy ball" }).click();
  await page.keyboard.press("Escape");
  await expect(c).toHaveAttribute("data-phase", "idle");
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeDisabled();
});

test("drawing a closed circle opens a portal using the real shape recognizer", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Portal drawing", exact: true })
    .click();
  await page.getByLabel("Mouse / touch drawing").check();
  const canvas = page.getByLabel("Air writing drawing canvas");
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!,
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2,
    r = Math.min(b.width, b.height) * 0.3;
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= 64; i++)
    await page.mouse.move(
      cx + Math.cos((i / 64) * Math.PI * 2) * r,
      cy + Math.sin((i / 64) * Math.PI * 2) * r,
    );
  await page.mouse.up();
  await expect(page.locator(".magic-effects")).toHaveAttribute(
    "data-phase",
    "portal-active",
  );
  await expect(page.getByRole("status")).toContainText("Portal opened");
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeDisabled();
  await page.screenshot({ path: "/tmp/senseai-portal.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".magic-effects")).toHaveAttribute(
    "data-phase",
    "idle",
  );
});
test("portal mode leaves open lines as ink and mode changes clear previews", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page
    .getByRole("button", { name: "Portal drawing", exact: true })
    .click();
  await page.getByLabel("Mouse / touch drawing").check();
  const c = page.getByLabel("Air writing drawing canvas");
  await c.scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!;
  await page.mouse.move(b.x + 100, b.y + 120);
  await page.mouse.down();
  await page.mouse.move(b.x + 300, b.y + 120, { steps: 24 });
  await page.mouse.up();
  await expect(page.locator(".magic-effects")).toHaveAttribute(
    "data-phase",
    "idle",
  );
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Preview portal" }).click();
  await expect(page.locator(".magic-effects")).toHaveAttribute(
    "data-phase",
    "portal-active",
  );
  await page
    .getByRole("button", { name: "Writing + fire", exact: true })
    .click();
  await expect(page.locator(".magic-effects")).toHaveAttribute(
    "data-phase",
    "idle",
  );
});
