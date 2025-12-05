const config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  moduleNameMapper: {
    "\\.css$": "<rootDir>/src/test/styleStub.ts",
    "\\.css\\?inline$": "<rootDir>/src/test/styleStub.ts"
  }
};

module.exports = config;
