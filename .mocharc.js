/* eslint-disable */
export default {
  // Load environment setup before tests (sets Anchor env vars)
  require: ["tests/utils/env-setup.ts"],
  // Handle TypeScript files
  extension: ["ts"],
  // Optional: increase default test timeout
  timeout: 120000,
}; 