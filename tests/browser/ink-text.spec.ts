import { test, expect } from "@playwright/test";
async function draw(page: import("@playwright/test").Page) {
  await page.getByLabel("Mouse / touch drawing").check();
  const c = page.getByLabel("Air writing drawing canvas");
  await c.scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.5, {
    steps: 20,
  });
  await page.mouse.up();
  return c;
}
test("real OCR reads prepared ink and styling preserves the original", async ({
  page,
}) => {
  await page.goto("/air-writing");
  const c = await draw(page);
  // Controlled printed glyphs verify the real OCR pipeline, not freehand accuracy.
  await c.evaluate((el) => {
    const c = el as HTMLCanvasElement,
      ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = "bold 140px Arial";
    ctx.fillStyle = "#dce9ff";
    ctx.fillText("HELLO", 300, 350);
  });
  const before = await c.evaluate((el) =>
    (el as HTMLCanvasElement).toDataURL(),
  );
  await page
    .getByRole("button", { name: "Recognize handwriting", exact: true })
    .click();
  await expect(page.getByLabel("Recognized text")).toHaveValue(/HELLO/i, {
    timeout: 90000,
  });
  await page.getByLabel("Text style").selectOption("editorial");
  await page.getByRole("button", { name: "Apply text style" }).click();
  await expect(page.locator(".styled-text-canvas")).toHaveAttribute(
    "data-active",
    "true",
  );
  expect(await c.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(
    before,
  );
  await page.locator(".air-stage").screenshot({ path: "/tmp/senseai-typography.png" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save writing as PNG" }).click();
  expect((await download).suggestedFilename()).toContain(".png");
  await page.getByRole("button", { name: "Show original ink" }).click();
  await expect(page.locator(".styled-text-canvas")).toHaveAttribute(
    "data-active",
    "false",
  );
});
test("canceling recognition preserves ink and allows editable text", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await draw(page);
  await page
    .getByRole("button", { name: "Recognize handwriting", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel recognition" }).click();
  await expect(
    page.getByRole("region", { name: "Handwriting to text" }),
  ).toContainText("Recognition canceled");
  await page.getByLabel("Recognized text").fill("SenseAI");
  await page.getByLabel("Text style").selectOption("modern");
  await page.getByRole("button", { name: "Apply text style" }).click();
  await expect(page.locator(".styled-text-canvas")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByLabel("Mouse / touch drawing").uncheck();
  await page.getByLabel("Continuous pen control").check();
  await page.getByRole("button", { name: "Put pen down" }).click();
  await expect(page.getByRole("button", { name: "Lift pen" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Lift pen" }).click();
  await expect(
    page.getByRole("button", { name: "Writing", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("typed corrections can be styled and exported without existing ink", async ({
  page,
}) => {
  await page.goto("/air-writing");
  await page.getByLabel("Recognized text").fill("SenseAI Studio");
  await page.getByLabel("Text style").selectOption("signature");
  await page.getByRole("button", { name: "Apply text style" }).click();
  await expect(
    page.getByRole("button", { name: "Save writing as PNG" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save writing as PNG" }).click();
  expect((await download).suggestedFilename()).toContain(".png");
  await page.getByRole("button", { name: "Clear canvas" }).click();
  await expect(page.locator(".styled-text-canvas")).toHaveAttribute(
    "data-active",
    "false",
  );
});
test("OCR download failure keeps correction and styling available", async ({
  page,
}) => {
  await page.route(/traineddata/, (route) => route.abort());
  await page.goto("/air-writing");
  await draw(page);
  await page
    .getByRole("button", { name: "Recognize handwriting", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Handwriting to text" }),
  ).toContainText("Recognition could not complete", { timeout: 45000 });
  await page.getByLabel("Recognized text").fill("Review");
  await page.getByRole("button", { name: "Apply text style" }).click();
  await expect(page.locator(".styled-text-canvas")).toHaveAttribute(
    "data-active",
    "true",
  );
});
