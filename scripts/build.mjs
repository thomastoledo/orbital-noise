import { mkdir, readdir, readFile, rm, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "lightningcss";
import { minify } from "terser";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const distDir = path.join(projectRoot, "dist");
const buildEntries = ["index.html", "styles.css", "app.js", "config.js", "generatorRegistry.js", "src", "modes", "assets"];

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

async function minifyJavaScript(sourcePath, targetPath) {
  const code = await readFile(sourcePath, "utf8");
  const result = await minify(code, {
    module: true,
    compress: {
      passes: 2,
    },
    mangle: true,
    format: {
      comments: false,
    },
  });

  if (!result.code) {
    throw new Error(`Terser returned no output for ${path.relative(projectRoot, sourcePath)}`);
  }

  await ensureParentDir(targetPath);
  await writeFile(targetPath, result.code);
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

async function buildEntry(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(distDir, relativePath);
  const sourceStat = await stat(sourcePath);

  if (sourceStat.isDirectory()) {
    const entries = await readdir(sourcePath);
    await Promise.all(entries.map((entry) => buildEntry(path.join(relativePath, entry))));
    return;
  }

  if (relativePath.endsWith(".js")) {
    await minifyJavaScript(sourcePath, targetPath);
    return;
  }

  if (relativePath.endsWith(".css")) {
    await minifyStylesheet(sourcePath, targetPath);
    return;
  }

  await copyAsset(sourcePath, targetPath);
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const existingEntries = [];
  for (const entry of buildEntries) {
    if (await pathExists(path.join(projectRoot, entry))) {
      existingEntries.push(entry);
    }
  }

  await Promise.all(existingEntries.map((entry) => buildEntry(entry)));

  console.log(`Built ${existingEntries.length} project entr${existingEntries.length === 1 ? "y" : "ies"} into dist/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
