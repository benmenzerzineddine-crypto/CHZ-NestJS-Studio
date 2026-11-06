import type { EntityIR, ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import {
  entityControllerPath,
  entityFilePath,
  entityModulePath,
  entityResolverPath,
  entityServicePath,
  file,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";

export function emitModule(ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityModulePath(entity);
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Module");
  registry.add("@nestjs/typeorm", "TypeOrmModule");
  registry.add(sourceImport(path, entityFilePath(entity)), entity.name);
  registry.add(sourceImport(path, entityControllerPath(entity)), `${entity.name}Controller`);
  registry.add(sourceImport(path, entityServicePath(entity)), `${entity.name}Service`);

  const providers = [`${entity.name}Service`];
  if (ir.graphql.enabled) {
    registry.add(sourceImport(path, entityResolverPath(entity)), `${entity.name}Resolver`);
    providers.push(`${entity.name}Resolver`);
  }

  const content = `${registry.render()}@Module({
  imports: [TypeOrmModule.forFeature([${entity.name}])],
  controllers: [${entity.name}Controller],
  providers: [${providers.join(", ")}],
  exports: [${entity.name}Service],
})
export class ${entity.name}Module {}
`;
  return file(path, content);
}

export function emitModules(ir: ProjectIR): GeneratedFile[] {
  return ir.entities.filter((entity) => !entity.isSystem).map((entity) => emitModule(ir, entity));
}
