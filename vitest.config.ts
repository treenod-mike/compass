import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
    ],
    exclude: [
      "node_modules/**",
      "gameboard-src/**",
      "crawler/**",
      // node:test 로 작성된 pre-existing 파일들 — node --test (tsx --test) 로 돌림
      "src/shared/api/appsflyer/__tests__/client.test.ts",
      "src/shared/api/appsflyer/__tests__/fetcher.test.ts",
      "src/shared/api/__tests__/mmm-data.test.ts",
      "src/shared/api/__tests__/cpi-benchmarks.test.ts",
      "src/shared/api/__tests__/mock-data.test.ts",
      "src/shared/store/__tests__/game-settings.test.ts",
      "src/shared/api/vc-simulation/__tests__/**",
    ],
  },
})
