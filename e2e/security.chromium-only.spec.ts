import { test, expect } from "./support/test";

const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "media-src 'none'",
  "manifest-src 'self'",
];

test("production entry point declares the restrictive browser policy", async ({
  page,
}) => {
  await page.goto("/");

  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");

  expect(policy).not.toBeNull();
  for (const directive of REQUIRED_CSP_DIRECTIVES) {
    expect(policy).toContain(directive);
  }
});
