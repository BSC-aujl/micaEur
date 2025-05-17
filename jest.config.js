/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testMatch: [
    "**/sources/sol-programs/**/tests/**/*.test.ts",
    "**/sources/interface/tests/**/*.test.ts",
    "**/sources/kyc-api/tests/**/*.test.ts",
    "**/sources/app/**/tests/**/*.test.ts",
  ],
};
