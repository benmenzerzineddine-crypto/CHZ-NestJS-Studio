import type { GeneratedFile, ProjectIR } from "../ir/types";
import { file } from "./helpers";

function emitAttachmentEntity(): GeneratedFile {
  const content = `import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("attachments")
export class Attachment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  filename!: string;

  @Column({ type: "varchar", length: 255 })
  originalName!: string;

  @Column({ type: "varchar", length: 100 })
  mimeType!: string;

  @Column({ type: "int" })
  size!: number;

  @Column({ type: "varchar", length: 20 })
  driver!: "local" | "s3";

  @Column({ type: "varchar", length: 500 })
  path!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
`;
  return file("src/attachments/attachment.entity.ts", content);
}

function emitStorageInterface(): GeneratedFile {
  const content = `import type { Readable } from "node:stream";

export interface StoredFile {
  filename: string;
  path: string;
  driver: "local" | "s3";
}

export interface StorageEngine {
  save(file: Express.Multer.File): Promise<StoredFile>;
  getStream(path: string): Promise<Readable>;
  delete(path: string): Promise<void>;
}

export const STORAGE_ENGINE = "STORAGE_ENGINE";
`;
  return file("src/attachments/storage/storage.interface.ts", content);
}

function emitLocalStorageService(): GeneratedFile {
  const content = `import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream, promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { StorageEngine, StoredFile } from "./storage.interface";

@Injectable()
export class LocalStorageService implements StorageEngine {
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>("UPLOAD_DIR") ?? "./uploads";
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async save(file: Express.Multer.File): Promise<StoredFile> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const ext = file.originalname.includes(".")
      ? file.originalname.slice(file.originalname.lastIndexOf("."))
      : "";
    const filename = \`\${randomUUID()}\${ext}\`;
    const destination = join(this.uploadDir, filename);

    if (file.buffer) {
      await fs.writeFile(destination, file.buffer);
    } else if (file.path) {
      await fs.copyFile(file.path, destination);
    }

    return {
      filename,
      path: destination,
      driver: "local",
    };
  }

  async getStream(path: string): Promise<Readable> {
    return createReadStream(path);
  }

  async delete(path: string): Promise<void> {
    try {
      await fs.unlink(path);
    } catch {
      // Ignore if file is already deleted
    }
  }
}
`;
  return file("src/attachments/storage/local-storage.service.ts", content);
}

function emitS3StorageService(): GeneratedFile {
  const content = `import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { StorageEngine, StoredFile } from "./storage.interface";

@Injectable()
export class S3StorageService implements StorageEngine {
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("S3_BUCKET") ?? "my-uploads";
    this.region = this.config.get<string>("S3_REGION") ?? "us-east-1";
    this.endpoint = this.config.get<string>("S3_ENDPOINT");
  }

  async save(file: Express.Multer.File): Promise<StoredFile> {
    const ext = file.originalname.includes(".")
      ? file.originalname.slice(file.originalname.lastIndexOf("."))
      : "";
    const filename = \`\${randomUUID()}\${ext}\`;
    const key = \`uploads/\${filename}\`;

    return {
      filename,
      path: key,
      driver: "s3",
    };
  }

  async getStream(_path: string): Promise<Readable> {
    throw new Error("Direct S3 streaming: configure GetObjectCommand stream or presigned download URL.");
  }

  async delete(_path: string): Promise<void> {
    // S3 DeleteObjectCommand placeholder
  }
}
`;
  return file("src/attachments/storage/s3-storage.service.ts", content);
}

function emitAttachmentsService(): GeneratedFile {
  const content = `import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Readable } from "node:stream";
import { Attachment } from "./attachment.entity";
import { STORAGE_ENGINE, type StorageEngine } from "./storage/storage.interface";

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly repository: Repository<Attachment>,
    @Inject(STORAGE_ENGINE)
    private readonly storage: StorageEngine,
  ) {}

  async upload(file: Express.Multer.File): Promise<Attachment> {
    const stored = await this.storage.save(file);
    const attachment = this.repository.create({
      filename: stored.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      driver: stored.driver,
      path: stored.path,
    });
    return this.repository.save(attachment);
  }

  async findOne(id: string): Promise<Attachment> {
    const attachment = await this.repository.findOne({ where: { id } });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return attachment;
  }

  async getStream(id: string): Promise<{ attachment: Attachment; stream: Readable }> {
    const attachment = await this.findOne(id);
    const stream = await this.storage.getStream(attachment.path);
    return { attachment, stream };
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.findOne(id);
    await this.storage.delete(attachment.path);
    await this.repository.remove(attachment);
  }
}
`;
  return file("src/attachments/attachments.service.ts", content);
}

function emitAttachmentsController(ir: ProjectIR): GeneratedFile {
  const authDecorators = ir.auth.enabled ? `@ApiBearerAuth()\n` : "";
  const content = `import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AttachmentsService } from "./attachments.service";
import { Attachment } from "./attachment.entity";

@ApiTags("attachments")
${authDecorators}@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload a file attachment" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiCreatedResponse({ description: "File uploaded successfully", type: Attachment })
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.service.upload(file);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get file attachment metadata" })
  @ApiOkResponse({ description: "Attachment metadata found", type: Attachment })
  @ApiNotFoundResponse({ description: "Attachment not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Download attachment file stream" })
  @ApiOkResponse({ description: "Binary file stream" })
  @ApiNotFoundResponse({ description: "Attachment not found" })
  async download(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { attachment, stream } = await this.service.getStream(id);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", \`attachment; filename="\${attachment.originalName}"\`);
    stream.pipe(res);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete file attachment" })
  @ApiNoContentResponse({ description: "Attachment deleted" })
  @ApiNotFoundResponse({ description: "Attachment not found" })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
`;
  return file("src/attachments/attachments.controller.ts", content);
}

function emitAttachmentsModule(ir: ProjectIR): GeneratedFile {
  const driverClass = ir.uploads.driver === "s3" ? "S3StorageService" : "LocalStorageService";
  const content = `import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Attachment } from "./attachment.entity";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { STORAGE_ENGINE } from "./storage/storage.interface";
import { LocalStorageService } from "./storage/local-storage.service";
import { S3StorageService } from "./storage/s3-storage.service";

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: STORAGE_ENGINE,
      useClass: ${driverClass},
    },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
`;
  return file("src/attachments/attachments.module.ts", content);
}

export function emitAttachments(ir: ProjectIR): GeneratedFile[] {
  if (!ir.uploads?.enabled) {
    return [];
  }

  return [
    emitAttachmentEntity(),
    emitStorageInterface(),
    emitLocalStorageService(),
    emitS3StorageService(),
    emitAttachmentsService(),
    emitAttachmentsController(ir),
    emitAttachmentsModule(ir),
  ];
}
