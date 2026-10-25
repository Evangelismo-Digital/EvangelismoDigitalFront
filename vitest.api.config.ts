import { defineConfig } from 'vitest/config'

// Contract tests against a running backend (opt-in: `npm run test:api`).
// Kept out of `npm test` because they need the API, its database and real providers.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['api-tests/**/*.api.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One request at a time: friendlier to the providers' quotas and the rate limiter.
    fileParallelism: false,
    sequence: { concurrent: false },
  }
})
