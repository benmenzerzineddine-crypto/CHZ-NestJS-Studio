import type { ProjectIR, EntityIR, FieldIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";

export function gqlFieldDecorator(field: FieldIR, registry: ImportRegistry): string {
  registry.add("@nestjs/graphql", "@Field");
  const isNullable = !field.required;
  const nullableOpt = isNullable ? ", { nullable: true }" : "";
  switch (field.type) {
    case "int":
      registry.add("@nestjs/graphql", "Int");
      return `@Field(() => Int${nullableOpt})`;
    case "float":
    case "decimal":
      registry.add("@nestjs/graphql", "Float");
      return `@Field(() => Float${nullableOpt})`;
    case "boolean":
      return `@Field(() => Boolean${nullableOpt})`;
    case "date":
    case "datetime":
      return `@Field(() => Date${nullableOpt})`;
    case "uuid":
      registry.add("@nestjs/graphql", "ID");
      return `@Field(() => ID${nullableOpt})`;
    default:
      return `@Field(() => String${nullableOpt})`;
  }
}

export function renderAuthColumns(ir: ProjectIR, registry: ImportRegistry): string[] {
  const lines: string[] = [];
  const hasOAuth = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github);
  lines.push("  @Exclude()");
  if (hasOAuth) {
    lines.push("  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })");
    lines.push("  passwordHash?: string | null;");
  } else {
    lines.push("  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })");
    lines.push("  passwordHash: string;");
  }
  lines.push("");
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "@Field");
    lines.push("  @Field(() => [String])");
  }
  lines.push("  @Column({ name: 'roles', type: 'simple-array' })");
  lines.push("  roles: string[];");
  lines.push("");
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "@Field");
    lines.push("  @Field(() => Boolean)");
  }
  lines.push("  @Column({ name: 'is_active', type: 'boolean', default: true })");
  lines.push("  isActive: boolean;");
  lines.push("");
  if (ir.auth.emailVerification) {
    const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date, { nullable: true })");
    }
    lines.push(`  @Column({ name: 'email_verified_at', type: '${dateType}', nullable: true })`);
    lines.push("  emailVerifiedAt?: Date | null;");
    lines.push("");
  }
  if (ir.auth.oauth?.google) {
    lines.push("  @Index()");
    lines.push("  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true })");
    lines.push("  googleId?: string | null;");
    lines.push("");
  }
  if (ir.auth.oauth?.github) {
    lines.push("  @Index()");
    lines.push("  @Column({ name: 'github_id', type: 'varchar', length: 255, nullable: true })");
    lines.push("  githubId?: string | null;");
    lines.push("");
  }
  if (hasOAuth) {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => String, { nullable: true })");
    }
    lines.push("  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })");
    lines.push("  avatarUrl?: string | null;");
    lines.push("");
  }
  if (ir.auth.twoFactor) {
    lines.push("  @Exclude()");
    lines.push("  @Column({ name: 'two_factor_secret', type: 'varchar', length: 255, nullable: true, select: false })");
    lines.push("  twoFactorSecret?: string | null;");
    lines.push("");
    lines.push("  @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })");
    lines.push("  twoFactorEnabled: boolean;");
    lines.push("");
    lines.push("  @Exclude()");
    lines.push("  @Column({ name: 'two_factor_recovery_codes', type: 'simple-array', nullable: true, select: false })");
    lines.push("  twoFactorRecoveryCodes?: string[] | null;");
    lines.push("");
  }
  return lines;
}

export function renderAuditColumns(entity: EntityIR, ir: ProjectIR, registry: ImportRegistry): string[] {
  const lines: string[] = [];
  if (entity.timestamps) {
    const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date)");
    }
    lines.push(`  @CreateDateColumn({ name: 'created_at', type: '${dateType}' })`);
    lines.push("  createdAt: Date;");
    lines.push("");
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date)");
    }
    lines.push(`  @UpdateDateColumn({ name: 'updated_at', type: '${dateType}' })`);
    lines.push("  updatedAt: Date;");
    lines.push("");
  }

  if (entity.softDelete) {
    const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date, { nullable: true })");
    }
    lines.push(`  @DeleteDateColumn({ name: 'deleted_at', type: '${dateType}', nullable: true })`);
    lines.push("  deletedAt?: Date;");
    lines.push("");
  }

  if (entity.multitenant) {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => String)");
    }
    lines.push("  @Index()");
    lines.push("  @Column({ name: 'tenant_id', type: 'varchar', length: 64 })");
    lines.push("  tenantId: string;");
    lines.push("");
  }
  return lines;
}
