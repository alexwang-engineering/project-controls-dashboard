import { expect, test } from "./support/test";

test("honours reduced motion and preserves focus in forced colours", async ({
  page,
}) => {
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Import and data quality", level: 1 }),
  ).toBeVisible();

  const preferences = await page.evaluate(() => ({
    forcedColors: matchMedia("(forced-colors: active)").matches,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  expect(preferences).toEqual({
    forcedColors: true,
    reducedMotion: true,
    scrollBehavior: "auto",
  });

  const button = page.getByRole("button", {
    name: "Download blank schedule template",
  });
  await button.focus();
  await expect(button).toBeFocused();
  const outline = await button.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});
