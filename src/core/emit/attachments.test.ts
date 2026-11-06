import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createProject } from "../model/defaults";
import { emitAttachments } from "./attachments";
import { emitAppModule } from "./config";

describe("attachments emitter", () => {
  it("does not emit any files when uploads are disabled", () => {
    const project = createProject("Test API");
    const ir = buildIR(project);
    expect(emitAttachments(ir)).toEqual([]);
    expect(emitAppModule(ir).content).not.toContain("AttachmentsModule");
  });

  it("emits attachment entity, storage engines, service, controller, and module with local driver", () => {
    const project = createProject("Test API");
    project.settings.uploads = {
      enabled: true,
      driver: "local",
      maxFileSizeMb: 25,
    };

    const ir = buildIR(project);
    const files = emitAttachments(ir);
    const paths = files.map((f) => f.path);

    expect(paths).toContain("src/attachments/attachment.entity.ts");
    expect(paths).toContain("src/attachments/storage/storage.interface.ts");
    expect(paths).toContain("src/attachments/storage/local-storage.service.ts");
    expect(paths).toContain("src/attachments/storage/s3-storage.service.ts");
    expect(paths).toContain("src/attachments/attachments.service.ts");
    expect(paths).toContain("src/attachments/attachments.controller.ts");
    expect(paths).toContain("src/attachments/attachments.module.ts");

    const controller = files.find((f) => f.path.endsWith("attachments.controller.ts"))!.content;
    expect(controller).toContain('@ApiConsumes("multipart/form-data")');
    expect(controller).toContain('@Post("upload")');
    expect(controller).toContain('@Get(":id/download")');

    const moduleContent = files.find((f) => f.path.endsWith("attachments.module.ts"))!.content;
    expect(moduleContent).toContain("useClass: LocalStorageService");

    const appModule = emitAppModule(ir).content;
    expect(appModule).toContain("AttachmentsModule");
  });

  it("configures S3 storage engine when driver is s3", () => {
    const project = createProject("Test API");
    project.settings.uploads = {
      enabled: true,
      driver: "s3",
      maxFileSizeMb: 50,
    };

    const ir = buildIR(project);
    const files = emitAttachments(ir);
    const moduleContent = files.find((f) => f.path.endsWith("attachments.module.ts"))!.content;
    expect(moduleContent).toContain("useClass: S3StorageService");
  });
});
