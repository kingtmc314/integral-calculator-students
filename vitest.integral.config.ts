import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "client/src/lib/integralEngine.test.ts",
      "client/src/lib/exactMath.test.ts",
    ],
    testTimeout: 20000,
  },
});
