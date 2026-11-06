import { test, expect } from "@playwright/test";
test("live stroke tip reaches the pointer and commits cleanly on lift", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page.getByLabel("Mouse / touch drawing").check();
  const ink = page.getByLabel("Air writing drawing canvas");
  await ink.scrollIntoViewIfNeeded();
  const b = (await ink.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.4, {
    steps: 10,
  });
  const tip = page.locator(".ink-tip");
  expect(
    await tip.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      return ctx
        .getImageData(
          Math.round(c.width * 0.5) - 2,
          Math.round(c.height * 0.4) - 2,
          4,
          4,
        )
        .data.some((v, i) => i % 4 === 3 && v > 0);
    }),
  ).toBe(true);
  await page.mouse.up();
  expect(
    await tip.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      return c
        .getContext("2d")!
        .getImageData(0, 0, c.width, c.height)
        .data.some((v, i) => i % 4 === 3 && v > 0);
    }),
  ).toBe(false);
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Undo stroke" }).click();
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeDisabled();
});
