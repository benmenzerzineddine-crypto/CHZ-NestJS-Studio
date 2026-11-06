import { ImportRegistry } from "../ir/imports";
import type { GeneratedFile, ProjectIR } from "../ir/types";
import { MAIL_MODULE_PATH, MAIL_SERVICE_PATH, file } from "./helpers";

function emitMailService(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Injectable", "Logger");

  const content = `${registry.render()}export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(options: SendMailOptions): Promise<void> {
    // In production, configure an SMTP or third-party transactional email provider (e.g. Resend, SendGrid).
    // For development and testing, output to the console logger.
    this.logger.log(\`[MailService] Sending email to: \${options.to} | Subject: \${options.subject}\`);
    this.logger.log(\`[MailService] Content:\\n\${options.text}\`);
  }
}
`;
  return file(MAIL_SERVICE_PATH, content);
}

function emitMailModule(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Module");
  registry.add("./mail.service", "MailService");

  const content = `${registry.render()}@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
`;
  return file(MAIL_MODULE_PATH, content);
}

export function emitMail(ir: ProjectIR): GeneratedFile[] {
  if (!ir.auth.enabled || (!ir.auth.passwordReset && !ir.auth.emailVerification)) {
    return [];
  }
  return [emitMailService(), emitMailModule()];
}
