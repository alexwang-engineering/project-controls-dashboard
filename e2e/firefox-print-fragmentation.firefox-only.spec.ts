import { expect, test } from "./support/test";

test("uses compact atomic milestone cards in Firefox print", async ({
  page,
}) => {
  await page.goto("/");
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => {
    const header = document.createElement("header");
    header.className = "report-document__header";
    const list = document.createElement("ul");
    list.className = "report-record-list";
    for (const title of ["First", "Second", "Third"]) {
      const item = document.createElement("li");
      const content = document.createElement("div");
      const heading = document.createElement("strong");
      const detail = document.createElement("p");
      heading.textContent = title;
      detail.textContent = "Complete cause, recovery and decision evidence.";
      content.append(heading, detail);
      item.append(content);
      list.append(item);
    }
    document.body.append(header, list);
  });

  const headerStyle = await page.locator(".report-document__header")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    });
  expect(headerStyle).toEqual({
    backgroundColor: "rgb(243, 250, 249)",
    backgroundImage: "none",
  });

  const cards = page.locator(".report-record-list > li");
  await expect(cards).toHaveCount(3);
  const listStyle = await page.locator(".report-record-list").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      breakInside: style.breakInside,
      pageBreakInside: style.pageBreakInside,
    };
  });
  expect(listStyle).toEqual({
    display: "block",
    breakInside: "auto",
    pageBreakInside: "auto",
  });
  const firstStyle = await cards.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      breakInside: style.breakInside,
      pageBreakInside: style.pageBreakInside,
    };
  });
  expect(firstStyle).toEqual({
    display: "inline-block",
    breakInside: "avoid",
    pageBreakInside: "avoid",
  });
  const contentStyle = await cards.first().locator("div").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      gridTemplateColumns: style.gridTemplateColumns,
    };
  });
  expect(contentStyle.display).toBe("grid");
  expect(contentStyle.gridTemplateColumns.split(" ")).toHaveLength(3);
  await expect(cards.first().locator("p")).toBeVisible();
});
