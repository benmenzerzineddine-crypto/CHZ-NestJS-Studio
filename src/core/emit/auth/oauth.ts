import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_GITHUB_STRATEGY_PATH,
  AUTH_GOOGLE_STRATEGY_PATH,
  file,
} from "../helpers";

export function emitGoogleStrategy(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Injectable");
  registry.add("@nestjs/config", "ConfigService");
  registry.add("@nestjs/passport", "PassportStrategy");
  registry.add("passport-google-oauth20", "Strategy");
  registry.addType("passport-google-oauth20", "Profile", "VerifyCallback");

  const defaultCallback = `http://localhost:3000/${ir.apiPrefix}/auth/google/callback`;

  const content = `${registry.render()}@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("GOOGLE_CLIENT_ID") ?? "placeholder-google-client-id",
      clientSecret: config.get<string>("GOOGLE_CLIENT_SECRET") ?? "placeholder-google-client-secret",
      callbackURL: config.get<string>("GOOGLE_CALLBACK_URL") ?? ${JSON.stringify(defaultCallback)},
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, photos } = profile;
    const user = {
      provider: "google" as const,
      id,
      email: emails?.[0]?.value,
      avatarUrl: photos?.[0]?.value,
    };
    done(null, user);
  }
}
`;
  return file(AUTH_GOOGLE_STRATEGY_PATH, content);
}

export function emitGithubStrategy(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Injectable");
  registry.add("@nestjs/config", "ConfigService");
  registry.add("@nestjs/passport", "PassportStrategy");
  registry.add("passport-github2", "Strategy");
  registry.addType("passport-github2", "Profile");

  const defaultCallback = `http://localhost:3000/${ir.apiPrefix}/auth/github/callback`;

  const content = `${registry.render()}@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("GITHUB_CLIENT_ID") ?? "placeholder-github-client-id",
      clientSecret: config.get<string>("GITHUB_CLIENT_SECRET") ?? "placeholder-github-client-secret",
      callbackURL: config.get<string>("GITHUB_CALLBACK_URL") ?? ${JSON.stringify(defaultCallback)},
      scope: ["user:email"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ): Promise<any> {
    const { id, emails, photos } = profile;
    const user = {
      provider: "github" as const,
      id: String(id),
      email: emails?.[0]?.value,
      avatarUrl: photos?.[0]?.value,
    };
    done(null, user);
  }
}
`;
  return file(AUTH_GITHUB_STRATEGY_PATH, content);
}
