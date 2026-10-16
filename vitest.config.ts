import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Project root with forward slashes (Vite expects them, even on Windows). */
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\\/g, "/");

/** Unit tests: `npm test` (once) or `npm run test:watch`. Tests live in tests/. */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // Next's guard against importing server code in the browser; a no-op in tests.
      { find: /^server-only$/, replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
