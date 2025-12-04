import { readFile, writeFile } from "node:fs/promises";

const newVersion = process.argv[2];

if (!newVersion) {
  console.error("Usage: node scripts/update-manifest-version.mjs <version>");
  process.exit(1);
}

const manifestPaths = ["public/manifest.json", "dist/manifest.json"];

const formatJson = (data) => `${JSON.stringify(data, null, 2)}\n`;

async function updateManifestVersion(path) {
  try {
    const content = await readFile(path, "utf8");
    const manifest = JSON.parse(content);

    if (manifest.version === newVersion) {
      console.log(`[manifest] ${path} already at ${newVersion}`);
      return;
    }

    manifest.version = newVersion;
    await writeFile(path, formatJson(manifest));
    console.log(`[manifest] Updated ${path} to ${newVersion}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`[manifest] Skipping missing ${path}`);
      return;
    }

    throw error;
  }
}

await Promise.all(manifestPaths.map(updateManifestVersion));
