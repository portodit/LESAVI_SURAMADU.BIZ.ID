/**
 * LESAVI - Quick Start Script
 * Cara pakai:
 *   node start.js
 *
 * Script ini akan:
 * 1. Cek Docker (start jika perlu)
 * 2. Cek PostgreSQL connection
 * 3. Build project (jika belum)
 * 4. Push database schema
 * 5. Start server di http://localhost:8080
 */

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

// Environment variables - loaded from .env file
function loadEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf8");
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

const envFile = loadEnv();
const env = {
  DATABASE_URL: envFile.DATABASE_URL || "postgresql://postgres:password@localhost:5432/lesavi",
  SESSION_SECRET: envFile.SESSION_SECRET || "a_very_long_and_secret_string_for_lesavi_suramadu",
  PORT: envFile.PORT || "8080",
  NODE_ENV: "production",
  GOOGLE_API_KEY: envFile.GOOGLE_API_KEY || "AIzaSyBHMj9LSM_4CbtY2zs9U9AHJtHL0_36jNQ",
};

// Color output
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

function log(msg, type = "info") {
  const prefix = { info: cyan("[INFO]"), ok: green("[OK]"), error: red("[ERROR]"), warn: yellow("[WARN]") };
  console.log(prefix[type] || prefix.info, msg);
}

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    cwd: rootDir,
    stdio: opts.silent ? "pipe" : "inherit",
    shell: true,
    env: { ...process.env, ...env, ...opts.env },
  });
}

function runSync(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: opts.silent ? "pipe" : "inherit",
    shell: true,
    env: { ...process.env, ...env, ...opts.env },
  });
}

// Step 1: Check Docker
function checkDocker() {
  log("Memeriksa Docker...");
  const result = runSync("docker", ["--context", "default", "ps"], { silent: true });
  if (result.status !== 0) {
    log("Docker tidak aktif. Pastikan Docker Desktop sedang berjalan.", "warn");
    return false;
  }
  log("Docker OK", "ok");
  return true;
}

// Step 2: Start PostgreSQL if not running
function startPostgres() {
  log("Memeriksa PostgreSQL container...");

  // Check if lesavi container exists
  const result = runSync("docker", ["--context", "default", "ps", "-a", "--filter", "name=lesavi", "--format", "{{.Names}}"], { silent: true });

  if (!result.stdout.toString().includes("lesavi")) {
    log("Membuat PostgreSQL container...");
    const create = runSync("docker", ["--context", "default", "compose", "up", "-d"], { silent: false });
    if (create.status !== 0) {
      log("Gagal membuat container. Jalankan secara manual: docker compose up -d", "error");
      return false;
    }
  } else {
    // Container exists, start if not running
    const status = runSync("docker", ["--context", "default", "ps", "--filter", "name=lesavi", "--format", "{{.Status}}"], { silent: true });
    if (!status.stdout.toString().includes("Up")) {
      log("Memulai container PostgreSQL...");
      runSync("docker", ["--context", "default", "compose", "start"], { silent: false });
    }
  }

  // Wait for PostgreSQL to be ready
  log("Menunggu PostgreSQL siap...");
  for (let i = 0; i < 15; i++) {
    const check = runSync("docker", ["--context", "default", "exec", "lesavi-db-1", "pg_isready", "-U", "postgres"], { silent: true });
    if (check.status === 0) {
      log("PostgreSQL siap", "ok");
      return true;
    }
    process.stdout.write(".");
    const sleep = spawnSync("sleep", ["1"], { shell: true });
  }
  console.log("");
  log("PostgreSQL tidak merespons setelah 15 detik", "warn");
  return true; // Continue anyway
}

// Step 3: Check / build project
function buildProject() {
  const distPath = path.join(rootDir, "apps/api/dist/index.mjs");

  if (existsSync(distPath)) {
    log("Build sudah ada, skip build", "ok");
    return true;
  }

  log("Membangun project...");

  // Build dengan env yang tepat
  const buildEnv = { ...env, PORT: "3000", BASE_PATH: "/" };
  const result = runSync("pnpm", ["run", "build"], { env: buildEnv, silent: false });

  if (result.status !== 0) {
    log("Build GAGAL!", "error");
    return false;
  }

  log("Build selesai", "ok");
  return true;
}

// Step 4: Push schema
function pushSchema() {
  log("Push schema database...");

  if (!existsSync(path.join(rootDir, "apps/api/dist/index.mjs"))) {
    log("Project belum di-build. Jalankan node start.js ulang.", "error");
    return false;
  }

  const result = runSync("npx", ["drizzle-kit", "push", "--config", "packages/db/drizzle.config.json"], {
    env: { ...process.env, ...env, FORCE_COLOR: "1" },
    silent: false,
  });

  if (result.status !== 0) {
    // Schema push fails on Windows due to path with spaces.
    // Table already exists from initial setup - continue.
    log("Schema push gagal (biasanya karena tabel sudah ada). Continue...", "warn");
    return true;
  }

  log("Schema OK", "ok");
  return true;
}

// Step 5: Start server
function startServer() {
  console.log("");
  log("==========================================", "info");
  log("  LESAVI", "ok");
  log("  Buka: http://localhost:8080", "ok");
  log("  Tekan Ctrl+C untuk stop", "info");
  log("==========================================", "info");
  console.log("");

  const server = run("node", ["./apps/api/dist/index.mjs"], { silent: false });

  server.on("close", (code) => {
    console.log(`
${yellow("[INFO] Server berhenti dengan exit code:", code)}
    `);
    process.exit(code);
  });

  process.on("SIGINT", () => {
    console.log(`
${cyan("[INFO] Mematikan server...")}`);
    server.kill("SIGINT");
  });
}

// MAIN
async function main() {
  console.log(`
${cyan("╔══════════════════════════════════════════╗")}
${cyan("║      LESAVI - Quick Start Script        ║")}
${cyan("╚══════════════════════════════════════════╝")}
  `);

  // 1. Docker
  if (!checkDocker()) {
    console.log(`
${yellow("⚠ Harap buka Docker Desktop dan jalankan script lagi.")}`);
    process.exit(1);
  }

  // 2. PostgreSQL
  startPostgres();

  // 3. Build
  if (!buildProject()) {
    process.exit(1);
  }

  // 4. Schema
  if (!pushSchema()) {
    process.exit(1);
  }

  // 5. Server
  startServer();
}

main().catch((err) => {
  console.error(`${red("[ERROR]")} ${err.message}`);
  process.exit(1);
});