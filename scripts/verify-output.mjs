#!/usr/bin/env node
/**
 * Golden-output check: generate a fixture, write it to a temp folder, install,
 * build and (for SQLite by default) boot it and request /api/health.
 *
 * Usage:
 *   node scripts/verify-output.mjs --fixture blog --driver sqlite
 *   node scripts/verify-output.mjs --fixture blog --driver postgres --boot
 *   node scripts/verify-output.mjs --fixture blog --driver sqlite --docker
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
register();

const { generateProject } = await import(path.join(root, "src/core/generate.ts"));
const { projectSchema } = await import(path.join(root, "src/core/model/schema.ts"));

function usage(message) {
  if (message) console.error(`\n${message}\n`);
  console.error(
    "Usage: node scripts/verify-output.mjs --fixture <name> --driver <postgres|mysql|sqlite> [options]\n" +
      "  --out <dir>       Write into this folder (must not exist or be empty)\n" +
      "  --keep            Keep the generated folder after a successful run\n" +
      "  --skip-install    Reuse an existing node_modules folder\n" +
      "  --skip-build      Skip npm run build\n" +
      "  --boot            Boot the app and request /api/health (default: sqlite only)\n" +
      "  --no-boot         Do not boot the app\n" +
      "  --port <number>   Port for the boot check (default: 4310)\n" +
      "  --timeout <sec>   Boot/health timeout (default: 60)\n" +
      "  --docker          Build and smoke-test the generated compose stack\n" +
      "  --db-port <n>     Host port for Postgres/MySQL in Docker mode (default: 55432/43306)\n" +
      "  --keep-stack      Leave the Docker stack running for debugging",
  );
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    fixture: "blog",
    driver: "sqlite",
    out: null,
    keep: false,
    install: true,
    build: true,
    boot: null,
    docker: false,
    keepStack: false,
    dbPort: null,
    port: 4310,
    timeout: 60,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") usage();
    if (arg === "--keep") {
      options.keep = true;
      continue;
    }
    if (arg === "--skip-install") {
      options.install = false;
      continue;
    }
    if (arg === "--skip-build") {
      options.build = false;
      continue;
    }
    if (arg === "--boot") {
      options.boot = true;
      continue;
    }
    if (arg === "--no-boot") {
      options.boot = false;
      continue;
    }
    if (arg === "--docker") {
      options.docker = true;
      continue;
    }
    if (arg === "--keep-stack") {
      options.keepStack = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) usage(`Missing value for ${arg}`);
    index += 1;

    if (arg === "--fixture") options.fixture = value;
    else if (arg === "--driver") options.driver = value;
    else if (arg === "--out") options.out = path.resolve(value);
    else if (arg === "--port") options.port = Number(value);
    else if (arg === "--db-port") options.dbPort = Number(value);
    else if (arg === "--timeout") options.timeout = Number(value);
    else usage(`Unknown option: ${arg}`);
  }

  if (!["postgres", "mysql", "sqlite"].includes(options.driver)) {
    usage(`Unsupported driver: ${options.driver}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    usage(`Invalid port: ${options.port}`);
  }
  if (!Number.isFinite(options.timeout) || options.timeout < 1) {
    usage(`Invalid timeout: ${options.timeout}`);
  }
  if (options.boot === null) options.boot = options.driver === "sqlite";
  if (options.docker) {
    options.install = false;
    options.build = false;
    options.boot = false;
  }
  if (options.dbPort === null) {
    options.dbPort = options.driver === "mysql" ? 43306 : 55432;
  }
  if (!Number.isInteger(options.dbPort) || options.dbPort < 1 || options.dbPort > 65535) {
    usage(`Invalid DB port: ${options.dbPort}`);
  }
  if (options.keepStack && !options.docker) {
    usage("--keep-stack requires --docker");
  }
  if (options.keepStack) {
    options.keep = true;
  }
  return options;
}

function run(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (${signal ?? code})`));
    });
  });
}

function printTree(root) {
  console.log(`${root.name || "project"}/`);

  function visit(node, prefix) {
    for (const folder of node.children) {
      console.log(`${prefix}${folder.name}/`);
      visit(folder, `${prefix}  `);
    }
    for (const file of node.files) {
      console.log(`${prefix}${path.basename(file.path)}`);
    }
  }

  visit(root, "  ");
}

async function assertEmptyOrMissing(directory) {
  if (!existsSync(directory)) return;
  const entries = await readdir(directory);
  if (entries.length > 0) {
    usage(`Output folder is not empty: ${directory}`);
  }
  await mkdir(directory, { recursive: true });
}

function safePath(base, filePath) {
  if (path.isAbsolute(filePath) || filePath.split(/[\\/]/).includes("..")) {
    throw new Error(`Refusing to write unsafe generated path: ${filePath}`);
  }
  const target = path.resolve(base, filePath);
  if (!target.startsWith(`${path.resolve(base)}${path.sep}`)) {
    throw new Error(`Generated path escapes the output folder: ${filePath}`);
  }
  return target;
}

async function waitForHealth(url, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before becoming healthy (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return { status: response.status, body: await response.text() };
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function bootCheck(directory, options) {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(options.port),
    DB_TYPE: options.driver,
  };
  if (options.driver === "sqlite") {
    env.DB_DATABASE = path.join(directory, "verify.sqlite");
  }

  const child = spawn("npm", ["run", "start:prod"], {
    cwd: directory,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  let logs = "";
  const capture = (chunk) => {
    const text = chunk.toString();
    logs += text;
    if (logs.length > 20_000) logs = logs.slice(-20_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  const url = `http://127.0.0.1:${options.port}/api/health`;
  try {
    const health = await waitForHealth(url, options.timeout * 1000, child);
    console.log(`\nHealth check: ${url} -> ${health.status} ${health.body.trim()}`);
  } catch (error) {
    console.error(`\nServer output:\n${logs}`);
    throw error;
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5_000);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return { status: response.status, body: await response.text() };
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function dumpDockerLogs(directory, env) {
  try {
    await run("docker", ["compose", "logs", "--tail=200"], directory, env);
  } catch {
    // The stack may not have been created.
  }
}

async function dockerCheck(directory, options) {
  const env = {
    ...process.env,
    COMPOSE_ANSI: "never",
    COMPOSE_PROJECT_NAME: `chz-verify-${randomUUID().slice(0, 8)}`,
  };
  const adminEmail = `verify-${randomUUID().slice(0, 8)}@example.com`;
  const adminPassword = `Verify-${randomUUID()}`;
  const dbPassword = `Verify-${randomUUID()}`;
  const envLines = [
    `JWT_ACCESS_SECRET=${randomUUID()}`,
    `JWT_REFRESH_SECRET=${randomUUID()}`,
    `ADMIN_EMAIL=${adminEmail}`,
    `ADMIN_PASSWORD=${adminPassword}`,
    `DB_PASSWORD=${dbPassword}`,
    `DB_SYNCHRONIZE=true`,
    `RUN_SEED=true`,
    `PORT=${options.port}`,
    `DB_HOST_PORT=${options.dbPort}`,
  ];
  if (options.driver !== "sqlite") {
    envLines.push(`DB_USERNAME=${options.driver === "mysql" ? "root" : "postgres"}`);
  }
  await writeFile(path.join(directory, ".env"), `${envLines.join("\n")}\n`);

  const base = `http://127.0.0.1:${options.port}`;
  try {
    console.log("\nStarting Docker compose stack...\n");
    try {
      await run("docker", ["compose", "version"], directory, env);
    } catch {
      throw new Error("Docker Compose is required for --docker but was not found.");
    }
    await run(
      "docker",
      [
        "compose",
        "up",
        "--build",
        "-d",
        "--wait",
        "--wait-timeout",
        String(options.timeout),
      ],
      directory,
      env,
    );

    const health = await waitForHttp(`${base}/api/health`, options.timeout * 1000);
    console.log(`Health check: ${base}/api/health -> ${health.status} ${health.body.trim()}`);

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    if (!login.ok) {
      throw new Error(`Admin login failed: ${login.status} ${await login.text()}`);
    }
    const auth = await login.json();
    const token = auth.accessToken;
    if (!token) throw new Error("Admin login returned no access token");

    const me = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!me.ok) throw new Error(`Authenticated /auth/me failed: ${me.status}`);
    const profile = await me.json();
    if (profile.email !== adminEmail) {
      throw new Error(`Authenticated user mismatch: ${profile.email}`);
    }

    if (options.fixture === "blog") {
      const posts = await fetch(`${base}/api/posts?limit=100`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!posts.ok) throw new Error(`Seeded /api/posts failed: ${posts.status}`);
      const body = await posts.json();
      const rows = Array.isArray(body) ? body : body.data;
      if (!Array.isArray(rows) || rows.length < 3) {
        throw new Error(`Expected at least 3 seeded posts, got ${rows?.length ?? 0}`);
      }
    }

    console.log("Docker verification passed: health, login and seed data are valid.");
  } catch (error) {
    await dumpDockerLogs(directory, env);
    throw error;
  } finally {
    if (options.keepStack) {
      console.log("Keeping Docker stack running (--keep-stack).");
      console.log(
        `Clean it up with: docker compose -p ${env.COMPOSE_PROJECT_NAME} down -v --remove-orphans`,
      );
    } else {
      await run("docker", ["compose", "down", "-v", "--remove-orphans"], directory, env).catch(() => {
        console.error("Could not remove the Docker stack; run docker compose down -v manually.");
      });
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const fixturePath = path.join(root, "src/core/fixtures", `${options.fixture}.json`);

let rawFixture;
try {
  rawFixture = JSON.parse(await readFile(fixturePath, "utf8"));
} catch (error) {
  usage(`Cannot read fixture ${fixturePath}: ${error.message}`);
}

const project = projectSchema.parse({ ...rawFixture, driver: options.driver });
const result = await generateProject(project);

if (result.files.length === 0) {
  console.error("Generation produced zero files:");
  for (const issue of result.issues) console.error(`- [${issue.severity}] ${issue.message}`);
  process.exit(1);
}

console.log(`\nGenerated ${result.stats.fileCount} files for ${options.fixture} (${options.driver}):\n`);
printTree(result.tree);

let directory = options.out;
let temporary = false;
if (directory) {
  await assertEmptyOrMissing(directory);
} else {
  directory = await mkdtemp(path.join(tmpdir(), `chz-verify-${options.fixture}-${options.driver}-`));
  temporary = true;
}

try {
  for (const file of result.files) {
    const target = safePath(directory, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
  console.log(`\nWrote generated project to ${directory}`);

  if (options.docker) {
    await dockerCheck(directory, options);
  }

  if (options.install) {
    console.log("\nInstalling dependencies...\n");
    await run("npm", ["install", "--no-audit", "--no-fund"], directory);
  }

  if (options.build) {
    console.log("\nBuilding generated project...\n");
    await run("npm", ["run", "build"], directory);
  }

  if (options.boot) {
    console.log("\nBooting generated project...\n");
    await bootCheck(directory, options);
  } else {
    console.log("\nSkipping boot check.");
  }

  console.log("\nGolden-output verification passed.");
  if (options.keep || !temporary) console.log(`Generated project kept at ${directory}`);
} catch (error) {
  console.error(`\nGolden-output verification failed: ${error.message}`);
  console.error(`Generated project kept at ${directory}`);
  process.exitCode = 1;
} finally {
  if (temporary && !options.keep && process.exitCode !== 1) {
    await rm(directory, { recursive: true, force: true });
  }
}
