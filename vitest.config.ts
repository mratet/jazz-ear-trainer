import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      thresholds: { lines: 80 },
    },
  },
});
