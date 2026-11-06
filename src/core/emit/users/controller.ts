import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_CURRENT_USER_PATH,
  AUTH_ROLES_PATH,
  AUTH_USER_PATH,
  USERS_CONTROLLER_PATH,
  USERS_DTO_PASSWORD_PATH,
  USERS_DTO_PROFILE_PATH,
  USERS_DTO_QUERY_PATH,
  USERS_DTO_ROLES_PATH,
  USERS_SERVICE_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitUsersController(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Body", "Controller", "HttpCode", "Patch", "Post");
  registry.add("@nestjs/swagger", "ApiBearerAuth", "ApiTags");
  registry.add(sourceImport(USERS_CONTROLLER_PATH, USERS_SERVICE_PATH), "UsersService");
  registry.add(sourceImport(USERS_CONTROLLER_PATH, USERS_DTO_PASSWORD_PATH), "ChangePasswordDto");
  registry.add(sourceImport(USERS_CONTROLLER_PATH, USERS_DTO_PROFILE_PATH), "UpdateProfileDto");
  registry.add(sourceImport(USERS_CONTROLLER_PATH, AUTH_USER_PATH), "AuthUser");
  registry.add(sourceImport(USERS_CONTROLLER_PATH, AUTH_CURRENT_USER_PATH), "CurrentUser");
  if (ir.auth.adminUserEndpoints) {
    registry.add("@nestjs/common", "Delete", "Get", "Param", "ParseUUIDPipe", "Query");
    registry.add(sourceImport(USERS_CONTROLLER_PATH, USERS_DTO_QUERY_PATH), "QueryUserDto");
    registry.add(sourceImport(USERS_CONTROLLER_PATH, USERS_DTO_ROLES_PATH), "UpdateRolesDto");
    registry.add(sourceImport(USERS_CONTROLLER_PATH, AUTH_ROLES_PATH), "Roles");
  }

  const adminRole = JSON.stringify(ir.auth.adminRole);
  const lines: string[] = [];
  lines.push("@ApiTags('users')");
  lines.push("@ApiBearerAuth()");
  lines.push("@Controller('users')");
  lines.push("export class UsersController {");
  lines.push("  constructor(private readonly usersService: UsersService) {}");
  lines.push("");

  if (ir.auth.adminUserEndpoints) {
    lines.push(`  @Roles(${adminRole})`);
    lines.push("  @Get()");
    lines.push("  findAll(@Query() query: QueryUserDto) {");
    lines.push("    return this.usersService.list(query);");
    lines.push("  }");
    lines.push("");
    lines.push(`  @Roles(${adminRole})`);
    lines.push("  @Patch(':id/roles')");
    lines.push(
      "  updateRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRolesDto, @CurrentUser() actor: AuthUser) {",
    );
    lines.push("    return this.usersService.updateRoles(id, dto.roles, actor.id);");
    lines.push("  }");
    lines.push("");
    lines.push(`  @Roles(${adminRole})`);
    lines.push("  @Delete(':id')");
    lines.push("  @HttpCode(204)");
    lines.push("  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser): Promise<void> {");
    lines.push("    await this.usersService.remove(id, actor.id);");
    lines.push("  }");
    lines.push("");
  }

  lines.push("  @Post('change-password')");
  lines.push("  @HttpCode(200)");
  lines.push("  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() actor: AuthUser) {");
  lines.push("    return this.usersService.changePassword(actor.id, dto.currentPassword, dto.newPassword);");
  lines.push("  }");
  lines.push("");
  lines.push("  @Patch('me')");
  lines.push("  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() actor: AuthUser) {");
  lines.push("    return this.usersService.updateProfile(actor.id, dto);");
  lines.push("  }");
  lines.push("}");
  return file(USERS_CONTROLLER_PATH, `${registry.render()}${lines.join("\n")}\n`);
}
