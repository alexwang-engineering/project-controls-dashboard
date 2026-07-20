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
      const recordConsoleError = (message: ConsoleMessage) => {
        if (message.type() === "error") {
          errors.push(`console: ${message.text()}`);
        }
      };

      page.on("console", recordConsoleError);
      page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

      await use();

      expect(errors, "browser runtime errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
