import {
  expect,
  test as base,
  type ConsoleMessage,
} from "@playwright/test";

interface DiagnosticFixtures {
  runtimeDiagnostics: void;
}

export const test = base.extend<DiagnosticFixtures>({
  runtimeDiagnostics: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const expectedOrigin = "http://127.0.0.1:4173";
      const recordConsoleError = (message: ConsoleMessage) => {
        if (message.type() === "error") {
          errors.push(`console: ${message.text()}`);
        }
      };

      page.on("console", recordConsoleError);
      page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        if (
          (requestUrl.protocol === "http:" || requestUrl.protocol === "https:") &&
          requestUrl.origin !== expectedOrigin
        ) {
          errors.push(`external request: ${request.method()} ${request.url()}`);
        }
      });

      await use();

      expect(errors, "browser runtime or external-network errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
