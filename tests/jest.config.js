module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/jest/**/*.bankrun.test.ts'],
    globals: {
      'ts-jest': { tsconfig: 'tests/tsconfig.json' }
    },
    // we'll wire up a Bankrun in globalSetup/Teardown
    globalSetup: '<rootDir>/jest-global-setup.ts',
    globalTeardown: '<rootDir>/jest-global-teardown.ts',
  };