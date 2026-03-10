import { mkdir, readdir, readFile, rm, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { transform } from "lightningcss";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const distDir = path.join(projectRoot, "dist");
const staticEntries = ["index.html", "styles.css", "assets"];

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

async function minifyStylesheet(sourcePath, targetPath) {
  const css = await readFile(sourcePath);
  const result = transform({
    filename: sourcePath,
    code: css,
    minify: true,
    sourceMap: false,
  });

  await ensureParentDir(targetPath);
  await writeFile(targetPath, result.code);
}

async function copyAsset(sourcePath, targetPath) {
  await ensureParentDir(targetPath);
  await copyFile(sourcePath, targetPath);
}

async function buildStaticEntry(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(distDir, relativePath);
  const sourceStat = await stat(sourcePath);

  if (sourceStat.isDirectory()) {
    const entries = await readdir(sourcePath);
    await Promise.all(entries.map((entry) => buildStaticEntry(path.join(relativePath, entry))));
    return;
  }

  if (relativePath.endsWith(".css")) {
    await minifyStylesheet(sourcePath, targetPath);
    return;
  }

  await copyAsset(sourcePath, targetPath);
}

async function buildJavaScript() {
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ["app.js"],
    outdir: distDir,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    sourcemap: false,
    logLevel: "silent",
    entryNames: "[name]",
    chunkNames: "chunks/[name]-[hash]",
    assetNames: "assets/[name]-[hash]",
  });
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const existingEntries = [];
  for (const entry of staticEntries) {
    if (await pathExists(path.join(projectRoot, entry))) {
      existingEntries.push(entry);
    }
  }

  await Promise.all(existingEntries.map((entry) => buildStaticEntry(entry)));
  await buildJavaScript();

  console.log(
    `Built app bundle and ${existingEntries.length} static entr${existingEntries.length === 1 ? "y" : "ies"} into dist/`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
