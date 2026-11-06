import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createEntity, createField, createProject } from "../model/defaults";
import { emitAccessContext, emitCurrentTenantDecorator } from "./common";
import { emitController } from "./controller";
import { emitCreateDto } from "./dto";
import { emitEntity } from "./entity";
import { emitService } from "./service";

function multitenantIR() {
  const project = createProject("SaaS API");
  project.settings.multitenancy = {
    enabled: true,
    header: "x-workspace-id",
  };

  const projectEntity = createEntity("Project");
  projectEntity.fields.push(createField("title", "string"));
  projectEntity.options.multitenant = true;
  project.entities.push(projectEntity);

  const ir = buildIR(project);
  const entity = ir.entities.find((candidate) => candidate.name === "Project");
  if (!entity) throw new Error("Missing Project entity IR");
  return { ir, entity };
}

describe("multi-tenancy emission", () => {
  it("emits indexed tenantId column on entity and excludes it from DTO", () => {
    const { ir, entity } = multitenantIR();
    const entityCode = emitEntity(ir, entity).content;
    expect(entity.multitenant).toBe(true);
    expect(entityCode).toContain("@Index()");
    expect(entityCode).toContain("@Column({ name: 'tenant_id', type: 'varchar', length: 64 })");
    expect(entityCode).toContain("tenantId: string;");

    const dtoCode = emitCreateDto(ir, entity).content;
    expect(dtoCode).not.toContain("tenantId");
  });

  it("emits applyTenantScope helper in access context and CurrentTenant decorator", () => {
    const { ir } = multitenantIR();
    const accessCode = emitAccessContext(ir).content;
    expect(accessCode).toContain("applyTenantScope");
    expect(accessCode).toContain("currentTenantId: tenantId");

    const decoratorCode = emitCurrentTenantDecorator(ir).content;
    expect(decoratorCode).toContain("export const CurrentTenant = createParamDecorator");
    expect(decoratorCode).toContain('request.headers["x-workspace-id"]');
    expect(decoratorCode).toContain('Missing required x-workspace-id header');
  });

  it("scopes all service queries and assigns tenantId on creation", () => {
    const { ir, entity } = multitenantIR();
    const serviceCode = emitService(ir, entity).content;

    expect(serviceCode).toContain("applyTenantScope(qb, tenantId)");
    expect(serviceCode).toContain("entity.tenantId = tenantId;");
    expect(serviceCode).toContain("findAll(query: QueryProjectDto, tenantId: string, user?: AuthUser)");
    expect(serviceCode).toContain("findOne(id: string, tenantId: string, user?: AuthUser)");
    expect(serviceCode).toContain("create(dto: CreateProjectDto, tenantId: string, user?: AuthUser)");
    expect(serviceCode).toContain("update(id: string, dto: UpdateProjectDto, tenantId: string, user?: AuthUser)");
    expect(serviceCode).toContain("remove(id: string, tenantId: string, user?: AuthUser)");
  });

  it("injects CurrentTenant decorator and ApiHeader in controller", () => {
    const { ir, entity } = multitenantIR();
    const controllerCode = emitController(ir, entity).content;

    expect(controllerCode).toContain("@ApiHeader({ name: 'x-workspace-id', description: 'Tenant identifier', required: true })");
    expect(controllerCode).toContain("findAll(@Query() query: QueryProjectDto, @CurrentTenant() tenantId: string, @CurrentUser() user?: AuthUser)");
    expect(controllerCode).toContain("this.service.findAll(query, tenantId, user)");
    expect(controllerCode).toContain("create(@Body() dto: CreateProjectDto, @CurrentTenant() tenantId: string, @CurrentUser() user?: AuthUser)");
    expect(controllerCode).toContain("this.service.create(dto, tenantId, user)");
  });
});
