import type { ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import {
  ALL_EXCEPTIONS_PATH,
  APP_MODULE_PATH,
  DATA_SOURCE_PATH,
  HEALTH_PATH,
  MAIN_PATH,
  SWAGGER_CONFIG_PATH,
  TYPEORM_CONFIG_PATH,
  file,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";

function dbTypeValidation(): string {
  return `function resolveDbType(value: string | undefined): "postgres" | "mysql" | "sqlite" {
  const type = value ?? "postgres";
  if (type !== "postgres" && type !== "mysql" && type !== "sqlite") {
    throw new Error(\`Unsupported DB_TYPE: \${type}\`);
  }
  return type;
}`;
}

export function emitTypeOrmConfig(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.addType("@nestjs/config", "ConfigService");
  registry.addType("@nestjs/typeorm", "TypeOrmModuleOptions");
  registry.add("node:path", "join");

  const content = `${registry.render()}${dbTypeValidation()}

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const type = resolveDbType(config.get<string>("DB_TYPE") ?? ${JSON.stringify(ir.driver)});
  const entities = [join(__dirname, "..", "**", "*.entity{.ts,.js}")];
  const synchronize =
    config.get<string>("DB_SYNCHRONIZE") === "true" ||
    (config.get<string>("DB_SYNCHRONIZE") !== "false" &&
      config.get<string>("NODE_ENV") !== "production");
  const dropSchema = config.get<string>("NODE_ENV") === "test";
  const logging = config.get<string>("DB_LOGGING") === "true";

  if (type === "sqlite") {
    return {
      type: "better-sqlite3",
      database: config.get<string>("DB_DATABASE") ?? "app.sqlite",
      entities,
      synchronize,
      dropSchema,
      logging,
    };
  }

  if (type === "mysql") {
    return {
      type,
      host: config.get<string>("DB_HOST") ?? "localhost",
      port: Number(config.get<string>("DB_PORT") ?? 3306),
      username: config.get<string>("DB_USERNAME") ?? "root",
      password: config.get<string>("DB_PASSWORD") ?? "",
      database: config.get<string>("DB_DATABASE") ?? ${JSON.stringify(ir.packageName)},
      entities,
      synchronize,
      dropSchema,
      logging,
    };
  }

  return {
    type,
    host: config.get<string>("DB_HOST") ?? "localhost",
    port: Number(config.get<string>("DB_PORT") ?? 5432),
    username: config.get<string>("DB_USERNAME") ?? "postgres",
    password: config.get<string>("DB_PASSWORD") ?? "",
    database: config.get<string>("DB_DATABASE") ?? ${JSON.stringify(ir.packageName)},
    entities,
    synchronize,
    dropSchema,
    logging,
  };
}
`;
  return file(TYPEORM_CONFIG_PATH, content);
}

export function emitDataSource(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.addSideEffect("dotenv/config");
  registry.add("typeorm", "DataSource");
  registry.addType("typeorm", "DataSourceOptions");
  registry.add("node:path", "join");

  const content = `${registry.render()}${dbTypeValidation()}

const type = resolveDbType(process.env.DB_TYPE ?? ${JSON.stringify(ir.driver)});
const common = {
  entities: [join(__dirname, "..", "**", "*.entity{.ts,.js}")],
  migrations: [join(__dirname, "migrations", "*.{.ts,.js}")],
  synchronize: false,
};

const options: DataSourceOptions =
  type === "sqlite"
    ? {
        ...common,
        type: "better-sqlite3",
        database: process.env.DB_DATABASE ?? "app.sqlite",
      }
    : {
        ...common,
        type,
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? (type === "mysql" ? 3306 : 5432)),
        username: process.env.DB_USERNAME ?? (type === "mysql" ? "root" : "postgres"),
        password: process.env.DB_PASSWORD ?? "",
        database: process.env.DB_DATABASE ?? ${JSON.stringify(ir.packageName)},
      };

export default new DataSource(options);
`;
  return file(DATA_SOURCE_PATH, content);
}

export function emitSwaggerConfig(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.addType("@nestjs/common", "INestApplication");
  registry.add("@nestjs/swagger", "DocumentBuilder", "SwaggerModule");

  const tagLines = ir.entities
    .map((e) => `    .addTag('${e.restPath}', 'Operations for ${e.name}')`)
    .join("\n");
  const authTag = ir.auth.enabled ? "\n    .addTag('auth', 'Authentication and account management')" : "";

  const content = `${registry.render()}export function setupSwagger(
  app: INestApplication,
  apiPrefix: string,
  bearerAuth: boolean,
): void {
  const builder = new DocumentBuilder()
    .setTitle(${JSON.stringify(ir.name)})
    .setDescription("Generated NestJS + TypeORM REST API")
    .setVersion("1.0")${authTag ? authTag : ""}${tagLines ? "\n" + tagLines : ""};

  if (bearerAuth) builder.addBearerAuth();
  const document = SwaggerModule.createDocument(app, builder.build());
  SwaggerModule.setup(\`\${apiPrefix}/docs\`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
`;
  return file(SWAGGER_CONFIG_PATH, content);
}

export function emitMain(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.addSideEffect("reflect-metadata");
  registry.addSideEffect("dotenv/config");
  registry.add("@nestjs/core", "NestFactory");
  registry.add("@nestjs/common", "Logger", "ValidationPipe");
  registry.add(sourceImport(MAIN_PATH, APP_MODULE_PATH), "AppModule");
  if (ir.project.settings.swagger) {
    registry.add(sourceImport(MAIN_PATH, SWAGGER_CONFIG_PATH), "setupSwagger");
  }

  const authGuard = ir.auth.enabled
    ? `  if (process.env.NODE_ENV === "production") {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (
      !accessSecret ||
      accessSecret === "change-me-access-secret" ||
      !refreshSecret ||
      refreshSecret === "change-me-refresh-secret"
    ) {
      throw new Error("Refusing to boot in production with default JWT secrets.");
    }
  }

`
    : "";

  const swagger = ir.project.settings.swagger
    ? `  setupSwagger(app, ${JSON.stringify(ir.apiPrefix)}, ${ir.auth.enabled});
`
    : "";

  const content = `${registry.render()}${authGuard}async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(${JSON.stringify(ir.apiPrefix)});
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
${swagger}  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(\`API listening on http://localhost:\${port}/${ir.apiPrefix}\`, "Bootstrap");
}

void bootstrap();
`;
  return file(MAIN_PATH, content);
}

export function emitAppModule(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Module");
  registry.add("@nestjs/config", "ConfigModule", "ConfigService");
  const coreImports = ["APP_FILTER", "APP_INTERCEPTOR"];
  if (ir.throttling.enabled || ir.auth.enabled) {
    coreImports.push("APP_GUARD");
  }
  registry.add("@nestjs/core", ...coreImports);
  registry.add("@nestjs/common", "ClassSerializerInterceptor");
  if (ir.throttling.enabled) {
    registry.add("@nestjs/throttler", "ThrottlerGuard", "ThrottlerModule");
  }
  registry.add("@nestjs/typeorm", "TypeOrmModule");
  registry.add(sourceImport(APP_MODULE_PATH, TYPEORM_CONFIG_PATH), "buildTypeOrmOptions");
  registry.add(sourceImport(APP_MODULE_PATH, HEALTH_PATH), "HealthController");
  registry.add(sourceImport(APP_MODULE_PATH, ALL_EXCEPTIONS_PATH), "AllExceptionsFilter");
  registry.add(sourceImport(APP_MODULE_PATH, "src/users/users.module.ts"), "UsersModule");
  if (ir.auth.enabled) {
    registry.add(sourceImport(APP_MODULE_PATH, "src/auth/auth.module.ts"), "AuthModule");
    registry.add(sourceImport(APP_MODULE_PATH, "src/auth/guards/jwt-auth.guard.ts"), "JwtAuthGuard");
    registry.add(sourceImport(APP_MODULE_PATH, "src/auth/guards/roles.guard.ts"), "RolesGuard");
  }
  if (ir.uploads?.enabled) {
    registry.add(
      sourceImport(APP_MODULE_PATH, "src/attachments/attachments.module.ts"),
      "AttachmentsModule",
    );
  }
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "GraphQLModule");
    registry.add("@nestjs/apollo", "ApolloDriver", "ApolloDriverConfig");
    registry.add("node:path", "join");
  }
  if (ir.queues.enabled) {
    registry.add(sourceImport(APP_MODULE_PATH, "src/jobs/jobs.module.ts"), "JobsModule");
  }
  if (ir.websockets.enabled) {
    registry.add(sourceImport(APP_MODULE_PATH, "src/events/events.module.ts"), "EventsModule");
  }

  const featureModules: string[] = [];
  for (const entity of ir.entities.filter((candidate) => !candidate.isSystem)) {
    const path = `${entity.moduleDir}/${entity.singularKebab}.module.ts`;
    registry.add(sourceImport(APP_MODULE_PATH, path), `${entity.name}Module`);
    featureModules.push(`${entity.name}Module`);
  }

  const throttlerTtl = ir.throttling.ttl === 60 ? "60_000" : `${ir.throttling.ttl * 1000}`;
  const imports = [
    `ConfigModule.forRoot({ isGlobal: true })`,
    `TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    })`,
    ...(ir.throttling.enabled
      ? [`ThrottlerModule.forRoot([{ ttl: ${throttlerTtl}, limit: ${ir.throttling.limit} }])`]
      : []),
    ...(ir.graphql.enabled
      ? [
          `GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      sortSchema: true,
      playground: ${ir.graphql.playground ? "true" : "false"},
      path: ${JSON.stringify(ir.graphql.path)},
      context: ({ req }: any) => ({ req }),
    })`,
        ]
      : []),
    "UsersModule",
    ...(ir.auth.enabled ? ["AuthModule"] : []),
    ...(ir.uploads?.enabled ? ["AttachmentsModule"] : []),
    ...(ir.queues.enabled ? ["JobsModule"] : []),
    ...(ir.websockets.enabled ? ["EventsModule"] : []),
    ...featureModules,
  ];

  const guards = ir.auth.enabled
    ? [
        `{ provide: APP_GUARD, useClass: JwtAuthGuard }`,
        `{ provide: APP_GUARD, useClass: RolesGuard }`,
      ]
    : [];

  const providers = [
    ...(ir.throttling.enabled ? [`{ provide: APP_GUARD, useClass: ThrottlerGuard }`] : []),
    `{ provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }`,
    `{ provide: APP_FILTER, useClass: AllExceptionsFilter }`,
    ...guards,
  ];

  const content = `${registry.render()}@Module({
  imports: [
${imports.map((line) => `    ${line},`).join("\n")}
  ],
  controllers: [HealthController],
  providers: [
${providers.map((line) => `    ${line},`).join("\n")}
  ],
})
export class AppModule {}
`;
  return file(APP_MODULE_PATH, content);
}
