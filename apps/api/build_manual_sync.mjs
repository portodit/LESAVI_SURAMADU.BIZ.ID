
import { build as esbuild } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  await esbuild({
    entryPoints: [path.resolve(__dirname, "../../manual_sync_funnel.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(__dirname, "../../manual_sync_funnel.mjs"),
    logLevel: "info",
    external: ["*.node", "pg-native"],
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
