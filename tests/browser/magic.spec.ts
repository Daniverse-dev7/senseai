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
