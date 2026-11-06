import type { ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { DATA_SOURCE_PATH, RUN_MIGRATIONS_PATH, file, sourceImport } from "./helpers";
import type { GeneratedFile } from "../ir/types";

function dockerfile(): GeneratedFile {
  const content = `FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chmod=755 docker-entrypoint.sh ./
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
`;
  return file("Dockerfile", content, "docker");
}

function dockerignore(): GeneratedFile {
  return file(
    ".dockerignore",
    `node_modules
dist
coverage
.env
.env.*
*.sqlite
*.sqlite3
data
.git
.gitignore
Dockerfile
docker-compose.yml
`,
    "docker",
  );
}

function entrypoint(): GeneratedFile {
  return file(
    "docker-entrypoint.sh",
    `#!/bin/sh
set -eu

if [ "\${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  node dist/database/run-migrations.js
fi

if [ "\${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding the database..."
  node dist/database/seeds/seed.js
fi

exec "$@"
`,
    "docker",
  );
}

function redisServiceYaml(): string {
  return `  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
`;
}

function sqliteCompose(ir: ProjectIR): string {
  const queuesEnabled = ir.queues.enabled;
  const dependsOn = queuesEnabled
    ? `    depends_on:
      redis:
        condition: service_healthy\n`
    : "";
  const queueEnv = queuesEnabled
    ? `      REDIS_HOST: redis
      REDIS_PORT: 6379\n`
    : "";

  return `services:
  api:
    build: .
    restart: unless-stopped
    env_file:
      - path: .env
        required: false
${dependsOn}    environment:
      NODE_ENV: production
      PORT: 3000
      DB_TYPE: sqlite
      DB_DATABASE: /app/data/app.sqlite
      DB_SYNCHRONIZE: \${DB_SYNCHRONIZE:-true}
      RUN_MIGRATIONS: \${RUN_MIGRATIONS:-false}
      RUN_SEED: \${RUN_SEED:-true}
      SEED_ADMIN: \${SEED_ADMIN:-true}
      ADMIN_EMAIL: \${ADMIN_EMAIL:-admin@example.com}
      ADMIN_PASSWORD: \${ADMIN_PASSWORD:-change-me-admin-password}
      JWT_ACCESS_SECRET: \${JWT_ACCESS_SECRET:?Set JWT_ACCESS_SECRET in .env}
      JWT_REFRESH_SECRET: \${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET in .env}
${queueEnv}    ports:
      - "\${PORT:-3000}:3000"
    volumes:
      - app-data:/app/data
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

${queuesEnabled ? `${redisServiceYaml()}\n` : ""}volumes:
  app-data:
`;
}

function serverCompose(ir: ProjectIR): string {
  const isPostgres = ir.driver === "postgres";
  const dbPort = isPostgres ? 5432 : 3306;
  const dbService = isPostgres ? "postgres" : "mysql";
  const image = isPostgres ? "postgres:16-alpine" : "mysql:8.4";
  const database = ir.packageName.replace(/-/g, "_");
  const dbEnv = isPostgres
    ? `      POSTGRES_USER: \${DB_USERNAME:-postgres}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-postgres}
      POSTGRES_DB: \${DB_DATABASE:-${database}}`
    : `      MYSQL_ROOT_PASSWORD: \${DB_PASSWORD:-root}
      MYSQL_DATABASE: \${DB_DATABASE:-${database}}`;
  const healthcheck = isPostgres
    ? `      test: ["CMD-SHELL", "pg_isready -U \${DB_USERNAME:-postgres} -d \${DB_DATABASE:-${database}}"]
      interval: 5s
      timeout: 5s
      retries: 10`
    : `      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p\${DB_PASSWORD:-root}"]
      interval: 5s
      timeout: 5s
      retries: 10`;

  return `services:
  api:
    build: .
    restart: unless-stopped
    env_file:
      - path: .env
        required: false
    depends_on:
      ${dbService}:
        condition: service_healthy
${ir.queues.enabled ? `      redis:
        condition: service_healthy\n` : ""}    environment:
      NODE_ENV: production
      PORT: 3000
      DB_TYPE: ${ir.driver}
      DB_HOST: ${dbService}
      DB_PORT: ${dbPort}
      DB_USERNAME: \${DB_USERNAME:-${isPostgres ? "postgres" : "root"}}
      DB_PASSWORD: \${DB_PASSWORD:-${isPostgres ? "postgres" : "root"}}
      DB_DATABASE: \${DB_DATABASE:-${database}}
      DB_SYNCHRONIZE: \${DB_SYNCHRONIZE:-true}
      RUN_MIGRATIONS: \${RUN_MIGRATIONS:-false}
      RUN_SEED: \${RUN_SEED:-true}
      SEED_ADMIN: \${SEED_ADMIN:-true}
      ADMIN_EMAIL: \${ADMIN_EMAIL:-admin@example.com}
      ADMIN_PASSWORD: \${ADMIN_PASSWORD:-change-me-admin-password}
      JWT_ACCESS_SECRET: \${JWT_ACCESS_SECRET:?Set JWT_ACCESS_SECRET in .env}
      JWT_REFRESH_SECRET: \${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET in .env}
${ir.queues.enabled ? `      REDIS_HOST: redis
      REDIS_PORT: 6379\n` : ""}    ports:
      - "\${PORT:-3000}:3000"
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  ${dbService}:
    image: ${image}
    environment:
${dbEnv}
    ports:
      - "\${DB_HOST_PORT:-${dbPort}}:${dbPort}"
    volumes:
      - db-data:/var/lib/${isPostgres ? "postgresql" : "mysql"}/data
    healthcheck:
${healthcheck}

${ir.queues.enabled ? `${redisServiceYaml()}\n` : ""}volumes:
  db-data:
`;
}

function dockerCompose(ir: ProjectIR): GeneratedFile {
  return file(
    "docker-compose.yml",
    ir.driver === "sqlite" ? sqliteCompose(ir) : serverCompose(ir),
    "docker",
  );
}

function runMigrations(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.addDefault(sourceImport(RUN_MIGRATIONS_PATH, DATA_SOURCE_PATH), "dataSource");

  return file(
    RUN_MIGRATIONS_PATH,
    `${registry.render()}async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    const migrations = await dataSource.runMigrations();
    console.log(\`Applied \${migrations.length} migration(s).\`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  );
}

export function emitDocker(ir: ProjectIR): GeneratedFile[] {
  if (!ir.project.settings.docker) return [];
  return [dockerfile(), dockerignore(), entrypoint(), dockerCompose(ir), runMigrations()];
}
