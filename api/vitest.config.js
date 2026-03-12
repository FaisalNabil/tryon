import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run tests sequentially to share a single DB connection
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    // Longer timeout for DB-backed integration tests
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Setup file runs before each test file
    setupFiles: ['./tests/setup.js'],
  },
})
