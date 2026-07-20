import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // These integration-heavy UI files share finite CPU and IndexedDB capacity.
    // Serial files keep the release gate deterministic on the packaged-app host.
    fileParallelism: false,
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**/*.ts", "src/features/**/*.tsx"],
    },
  },
});
