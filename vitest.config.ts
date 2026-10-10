import { defineConfig } from 'vitest/config';

// Minimal vitest config. The design's highest-value tests (materializePlan,
// paid-vs-owed math, adapter no-network-when-unconfigured) are pure/unit, so
// no jsdom environment is required here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
