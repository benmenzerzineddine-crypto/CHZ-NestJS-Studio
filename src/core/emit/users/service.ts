import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  PAGINATED_RESPONSE_PATH,
  REFRESH_TOKEN_ENTITY_PATH,
  USERS_DTO_PROFILE_PATH,
  USERS_DTO_QUERY_PATH,
  USERS_SERVICE_PATH,
  USER_ENTITY_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitUsersService(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add(
    "@nestjs/common",
    "BadRequestException",
    "ConflictException",
    "Injectable",
    "NotFoundException",
  );
  registry.add("@nestjs/typeorm", "InjectRepository");
  registry.add("bcrypt", "hash", "compare");
  registry.add("typeorm", "Repository");
  registry.add(sourceImport(USERS_SERVICE_PATH, USER_ENTITY_PATH), "User");
  registry.add(sourceImport(USERS_SERVICE_PATH, REFRESH_TOKEN_ENTITY_PATH), "RefreshToken");
  registry.add(sourceImport(USERS_SERVICE_PATH, USERS_DTO_QUERY_PATH), "QueryUserDto");
  registry.add(sourceImport(USERS_SERVICE_PATH, USERS_DTO_PROFILE_PATH), "UpdateProfileDto");
  registry.add(sourceImport(USERS_SERVICE_PATH, PAGINATED_RESPONSE_PATH), "PaginatedResponse");

  const allowedRoles = ir.auth.roles.map((role) => JSON.stringify(role.key)).join(", ");
  const like = ir.driver === "postgres" ? "ILIKE" : "LIKE";
  const user = ir.user;
  if (!user) throw new Error("The project has no built-in User entity.");

  const profileChecks: string[] = [];
  const profileAssignments: string[] = [];
  for (const field of user.fields) {
    if (field.primary) continue;
    if (field.name === "email") {
      profileChecks.push(`    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== user.id) throw new ConflictException("Email already registered");
    }`);
    } else if (field.unique) {
      profileChecks.push(`    if (dto.${field.name} !== undefined && dto.${field.name} !== user.${field.name}) {
      const existing = await this.users.findOne({ where: { ${field.name}: dto.${field.name} } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException(${JSON.stringify(`${field.name} already in use`)});
      }
    }`);
    }

    if (field.type === "date" || field.type === "datetime") {
      profileAssignments.push(
        field.required
          ? `    if (dto.${field.name} !== undefined) user.${field.name} = new Date(dto.${field.name});`
          : `    if (dto.${field.name} !== undefined) user.${field.name} = dto.${field.name} === null ? null : new Date(dto.${field.name});`,
      );
    } else {
      profileAssignments.push(`    if (dto.${field.name} !== undefined) user.${field.name} = dto.${field.name};`);
    }
  }

  const content = `${registry.render()}const ALLOWED_ROLES = [${allowedRoles}];
const DEFAULT_ROLE = ${JSON.stringify(ir.auth.defaultRole)};
const ADMIN_ROLE = ${JSON.stringify(ir.auth.adminRole)};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async list(query: QueryUserDto): Promise<PaginatedResponse<User>> {
    const qb = this.users.createQueryBuilder("user").where("user.deletedAt IS NULL");
    if (query.email) {
      qb.andWhere("user.email ${like} :email", { email: \`%\${query.email}%\` });
    }
    if (query.search) {
      qb.andWhere("user.email ${like} :search", { search: \`%\${query.search}%\` });
    }

    qb.orderBy("user.createdAt", "DESC");
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string, withPassword = false): Promise<User | null> {
    const qb = this.users
      .createQueryBuilder("user")
      .where("user.id = :id", { id })
      .andWhere("user.deletedAt IS NULL");
    if (withPassword) qb.addSelect("user.passwordHash");
    return qb.getOne();
  }

  async findByEmail(email: string, withPassword = false): Promise<User | null> {
    const qb = this.users
      .createQueryBuilder("user")
      .where("user.email = :email", { email })
      .andWhere("user.deletedAt IS NULL");
    if (withPassword) qb.addSelect("user.passwordHash");
    return qb.getOne();
  }

  async create(email: string, password: string, roles: string[] = [DEFAULT_ROLE]): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException("Email already registered");

    const invalid = roles.filter((role) => !ALLOWED_ROLES.includes(role));
    if (invalid.length > 0) throw new BadRequestException(\`Unknown roles: \${invalid.join(", ")}\`);

    const passwordHash = await hash(password, 12);
    const user = this.users.create({ email, passwordHash, roles, isActive: true });
    return this.users.save(user);
  }

  async checkPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return compare(password, user.passwordHash);
  }

  async updateRoles(id: string, roles: string[], actorId: string): Promise<User> {
    if (id === actorId) throw new BadRequestException("You cannot change your own roles");
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");

    const invalid = roles.filter((role) => !ALLOWED_ROLES.includes(role));
    if (invalid.length > 0) throw new BadRequestException(\`Unknown roles: \${invalid.join(", ")}\`);

    if (user.roles.includes(ADMIN_ROLE) && !roles.includes(ADMIN_ROLE) && (await this.countAdmins()) <= 1) {
      throw new BadRequestException("The last admin cannot be demoted");
    }

    user.roles = roles;
    return this.users.save(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    const user = await this.findById(userId, true);
    if (!user) throw new NotFoundException("User not found");
    if (!(await this.checkPassword(user, currentPassword))) {
      throw new BadRequestException("Current password is incorrect");
    }

    user.passwordHash = await hash(newPassword, 12);
    await this.users.save(user);
    await this.refreshTokens
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where("userId = :userId", { userId })
      .andWhere("revokedAt IS NULL")
      .execute();
    return { success: true };
  }${ir.auth.passwordReset ? `\n\n  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.findById(userId, true);
    if (!user) throw new NotFoundException("User not found");
    user.passwordHash = await hash(newPassword, 12);
    await this.users.save(user);
    await this.refreshTokens
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where("userId = :userId", { userId })
      .andWhere("revokedAt IS NULL")
      .execute();
  }` : ""}${ir.auth.emailVerification ? `\n\n  async markEmailVerified(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    user.emailVerifiedAt = new Date();
    await this.users.save(user);
  }` : ""}${Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github) ? `\n\n  async findByOAuthId(provider: "google" | "github", id: string): Promise<User | null> {
    const field = provider === "google" ? "googleId" : "githubId";
    return this.users
      .createQueryBuilder("user")
      .where(\`user.\${field} = :id\`, { id })
      .andWhere("user.deletedAt IS NULL")
      .getOne();
  }

  async linkOAuthAccount(
    user: User,
    provider: "google" | "github",
    id: string,
    avatarUrl?: string,
  ): Promise<User> {
    if (provider === "google") {
      user.googleId = id;
    } else {
      user.githubId = id;
    }
    if (avatarUrl && !user.avatarUrl) {
      user.avatarUrl = avatarUrl;
    }
    return this.users.save(user);
  }

  async createOAuthUser(
    email: string,
    provider: "google" | "github",
    id: string,
    avatarUrl?: string,
    roles: string[] = [DEFAULT_ROLE],
  ): Promise<User> {
    const user = this.users.create({
      email,
      roles,
      isActive: true,
      ...(provider === "google" ? { googleId: id } : { githubId: id }),
      ...(avatarUrl ? { avatarUrl } : {}),
      ${ir.auth.emailVerification ? "emailVerifiedAt: new Date()," : ""}
    });
    return this.users.save(user);
  }` : ""}${ir.auth.twoFactor ? `\n\n  async findByIdWithTwoFactor(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder("user")
      .where("user.id = :id", { id })
      .andWhere("user.deletedAt IS NULL")
      .addSelect(["user.twoFactorSecret", "user.twoFactorRecoveryCodes"])
      .getOne();
  }

  async setTwoFactorSecret(userId: string, secret: string): Promise<void> {
    await this.users.update({ id: userId }, { twoFactorSecret: secret });
  }

  async enableTwoFactor(userId: string, recoveryCodes: string[]): Promise<void> {
    await this.users.update(
      { id: userId },
      { twoFactorEnabled: true, twoFactorRecoveryCodes: recoveryCodes },
    );
  }

  async disableTwoFactor(userId: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null },
    );
  }

  async consumeRecoveryCode(userId: string, remainingCodes: string[]): Promise<void> {
    await this.users.update({ id: userId }, { twoFactorRecoveryCodes: remainingCodes });
  } ` : ""}

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");

${profileChecks.join("\n")}

${profileAssignments.join("\n")}

    return this.users.save(user);
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw new BadRequestException("You cannot delete your own account");
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");
    if (user.roles.includes(ADMIN_ROLE) && (await this.countAdmins()) <= 1) {
      throw new BadRequestException("The last admin cannot be deleted");
    }
    await this.users.softRemove(user);
  }

  private async countAdmins(): Promise<number> {
    return this.users
      .createQueryBuilder("user")
      .where("user.deletedAt IS NULL")
      .andWhere(
        "(user.roles = :admin OR user.roles LIKE :prefix OR user.roles LIKE :suffix OR user.roles LIKE :middle)",
        {
          admin: ADMIN_ROLE,
          prefix: \`\${ADMIN_ROLE},%\`,
          suffix: \`%,\${ADMIN_ROLE}\`,
          middle: \`%,\${ADMIN_ROLE},%\`,
        },
      )
      .getCount();
  }
}
`;
  return file(USERS_SERVICE_PATH, content);
}
