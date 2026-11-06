import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import { scalarPropertyLines } from "../dto";
import {
  PAGINATION_PATH,
  USERS_DTO_PASSWORD_PATH,
  USERS_DTO_PROFILE_PATH,
  USERS_DTO_QUERY_PATH,
  USERS_DTO_ROLES_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitQueryUserDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsEmail", "IsOptional");
  registry.add("@nestjs/swagger", "ApiPropertyOptional");
  registry.add(sourceImport(USERS_DTO_QUERY_PATH, PAGINATION_PATH), "PaginationQueryDto");

  const content = `${registry.render()}export class QueryUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: "user@example.com" })
  @IsEmail()
  @IsOptional()
  email?: string;
}
`;
  return file(USERS_DTO_QUERY_PATH, content);
}

export function emitUpdateProfileDto(ir: ProjectIR): GeneratedFile {
  const user = ir.user;
  if (!user) throw new Error("The project has no built-in User entity.");
  const registry = new ImportRegistry();

  const lines: string[] = [];
  for (const field of user.fields) {
    if (field.primary) continue;
    const fieldLines = scalarPropertyLines(field, registry, USERS_DTO_PROFILE_PATH, true);
    if (field.name === "email") {
      registry.add("class-validator", "IsEmail");
      const propertyIndex = fieldLines.findIndex((line) => line.trim().startsWith("email"));
      fieldLines.splice(propertyIndex === -1 ? fieldLines.length - 1 : propertyIndex, 0, "  @IsEmail()");
    }
    lines.push(...fieldLines);
  }

  if (lines.length === 0) {
    lines.push("  // This entity has no profile fields.");
    lines.push("");
  }

  return file(
    USERS_DTO_PROFILE_PATH,
    `${registry.render()}export class UpdateProfileDto {\n${lines.join("\n")}}\n`,
  );
}

export function emitUpdateRolesDto(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsArray", "IsIn", "IsString");
  registry.add("@nestjs/swagger", "ApiProperty");

  const roles = ir.auth.roles.map((role) => JSON.stringify(role.key)).join(", ");
  const content = `${registry.render()}export class UpdateRolesDto {
  @ApiProperty({ type: [String], example: [${JSON.stringify(ir.auth.defaultRole)}] })
  @IsArray()
  @IsIn([${roles}], { each: true })
  @IsString({ each: true })
  roles: string[];
}
`;
  return file(USERS_DTO_ROLES_PATH, content);
}

export function emitChangePasswordDto(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString", "MinLength");
  registry.add("@nestjs/swagger", "ApiProperty");

  const content = `${registry.render()}export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: ${ir.auth.passwordMinLength} })
  @IsString()
  @MinLength(${ir.auth.passwordMinLength})
  newPassword: string;
}
`;
  return file(USERS_DTO_PASSWORD_PATH, content);
}
