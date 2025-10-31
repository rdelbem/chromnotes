#!/usr/bin/env node

import { execSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const imagesDir = path.join(projectRoot, "images");
const distDir = path.join(projectRoot, "dist");

function runBuild() {
  console.log("▶ Building Chromnotes extension bundle…");
  execSync("npm run build -- --emptyOutDir", {
    cwd: projectRoot,
    stdio: "inherit"
  });
}

function copyStaticAssets() {
  if (!existsSync(publicDir)) {
    return;
  }

  console.log("▶ Copying static assets to dist/");
  cpSync(publicDir, distDir, { recursive: true, force: true, dereference: true });

  if (existsSync(imagesDir)) {
    console.log("▶ Copying extension images/");
    cpSync(imagesDir, path.join(distDir, "images"), {
      recursive: true,
      force: true,
      dereference: true
    });
  }
}

function ensureManifest() {
  const manifestPath = path.join(distDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      "manifest.json was not found in the dist folder. Ensure it exists under public/ before building."
    );
  }
}

try {
  runBuild();
  copyStaticAssets();
  ensureManifest();
  console.log(`✓ Extension build complete. Output available at ${distDir}`);
} catch (error) {
  console.error("✖ Failed to build the Chrome extension.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
