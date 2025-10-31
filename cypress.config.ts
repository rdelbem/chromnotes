import { defineConfig } from "cypress";

export default defineConfig({
  video: false,
  screenshotsFolder: "cypress/screenshots",
  videosFolder: "cypress/videos",
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    baseUrl: "http://localhost:5173",
    setupNodeEvents() {
      // implement node event listeners here if needed
    }
  }
});
