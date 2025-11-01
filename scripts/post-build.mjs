#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const iconSource = path.join(projectRoot, "images", "icon.png");
const targetDir = path.join(projectRoot, "dist", "images");
const targetPath = path.join(targetDir, "icon.png");

function copyIcon() {
  if (!existsSync(iconSource)) {
    console.warn("⚠️  Icon file images/icon.png not found. Skipping copy step.");
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(iconSource, targetPath);
  console.log("▶ Copied icon to dist/images/");
}

try {
  copyIcon();
} catch (error) {
  console.error("✖ Failed to copy icon into build output.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
