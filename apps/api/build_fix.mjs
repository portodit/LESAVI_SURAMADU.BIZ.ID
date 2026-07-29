import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";

// Use the correct path for esbuild from pnpm store
const esbuildPath = "/home/ivalora/LESAVI-SURAMADU/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild";
const esbuildBin = existsSync(esbuildPath + ".js") ? esbuildPath + ".js" : esbuildPath;

// Use dynamic import for esbuild
const esbuild = await import(esbuildBin);
const build = esbuild.build || esbuild;

const artifactDir = "/home/ivalora/LESAVI-SURAMADU/apps/api";
const distDir = path.resolve(artifactDir, "dist");

await rm(distDir, { recursive: true, force: true });

await build({
  entryPoints: [path.resolve(artifactDir, "src/index.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: [
    "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas",
    "bcrypt", "argon2", "fsevents", "re2", "farmhash",
    "bufferutil", "utf-8-validate", "ssh2", "cpu-features",
    "dtrace-provider", "isolated-vm", "lightningcss", "pg-native",
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
}).catch(e => { console.error(e); process.exit(1); });

console.log("API build complete!");
