import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import { renderEntityFile } from "../entity";
import {
  EMAIL_VERIFICATION_ENTITY_PATH,
  PASSWORD_RESET_ENTITY_PATH,
  REFRESH_TOKEN_ENTITY_PATH,
  USER_ENTITY_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitUserEntity(ir: ProjectIR): GeneratedFile {
  const user = ir.user;
  if (!user) throw new Error("The project has no built-in User entity.");
  const generated = renderEntityFile(ir, user, { authColumns: true });
  return file(generated.path, generated.content);
}

export function emitRefreshTokenEntity(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add(
    "typeorm",
    "Column",
    "CreateDateColumn",
    "Entity",
    "Index",
    "JoinColumn",
    "ManyToOne",
    "PrimaryGeneratedColumn",
  );
  registry.addType(sourceImport(REFRESH_TOKEN_ENTITY_PATH, USER_ENTITY_PATH), "User");

  const idType = ir.driver === "postgres" ? "uuid" : "varchar";
  const idLength = ir.driver === "postgres" ? "" : ", length: 36";
  const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";

  const sessionColumns = ir.auth.sessionManagement
    ? `
  @Column({ name: "user_agent", type: "varchar", length: 500, nullable: true })
  userAgent?: string | null;

  @Column({ name: "ip_address", type: "varchar", length: 45, nullable: true })
  ipAddress?: string | null;
`
    : "";

  const content = `${registry.render()}@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Index({ unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 64, select: false })
  tokenHash: string;

  @Index()
  @Column({ name: "user_id", type: "${idType}"${idLength} })
  userId: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user: User;

  @Column({ name: "expires_at", type: "${dateType}" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "${dateType}", nullable: true })
  revokedAt?: Date | null;${sessionColumns}
  @CreateDateColumn({ name: "created_at", type: "${dateType}" })
  createdAt: Date;
}
`;
  return file(REFRESH_TOKEN_ENTITY_PATH, content);
}

export function emitPasswordResetEntity(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add(
    "typeorm",
    "Column",
    "CreateDateColumn",
    "Entity",
    "Index",
    "JoinColumn",
    "ManyToOne",
    "PrimaryGeneratedColumn",
  );
  registry.addType(sourceImport(PASSWORD_RESET_ENTITY_PATH, USER_ENTITY_PATH), "User");

  const idType = ir.driver === "postgres" ? "uuid" : "varchar";
  const idLength = ir.driver === "postgres" ? "" : ", length: 36";
  const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";

  const content = `${registry.render()}@Entity("password_resets")
export class PasswordReset {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Index({ unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 64, select: false })
  tokenHash: string;

  @Index()
  @Column({ name: "user_id", type: "${idType}"${idLength} })
  userId: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user: User;

  @Column({ name: "expires_at", type: "${dateType}" })
  expiresAt: Date;

  @Column({ name: "used_at", type: "${dateType}", nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: "created_at", type: "${dateType}" })
  createdAt: Date;
}
`;
  return file(PASSWORD_RESET_ENTITY_PATH, content);
}

export function emitEmailVerificationEntity(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add(
    "typeorm",
    "Column",
    "CreateDateColumn",
    "Entity",
    "Index",
    "JoinColumn",
    "ManyToOne",
    "PrimaryGeneratedColumn",
  );
  registry.addType(sourceImport(EMAIL_VERIFICATION_ENTITY_PATH, USER_ENTITY_PATH), "User");

  const idType = ir.driver === "postgres" ? "uuid" : "varchar";
  const idLength = ir.driver === "postgres" ? "" : ", length: 36";
  const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";

  const content = `${registry.render()}@Entity("email_verifications")
export class EmailVerification {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Index({ unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 64, select: false })
  tokenHash: string;

  @Index()
  @Column({ name: "user_id", type: "${idType}"${idLength} })
  userId: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user: User;

  @Column({ name: "expires_at", type: "${dateType}" })
  expiresAt: Date;

  @Column({ name: "used_at", type: "${dateType}", nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: "created_at", type: "${dateType}" })
  createdAt: Date;
}
`;
  return file(EMAIL_VERIFICATION_ENTITY_PATH, content);
}
