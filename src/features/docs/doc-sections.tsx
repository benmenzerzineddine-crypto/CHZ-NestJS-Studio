import {
  Boxes,
  Code2,
  Cpu,
  Key,
  Lock,
  Network,
  Rocket,
  Server,
  Shield,
  Terminal,
  Upload,
  Zap,
} from "lucide-react";
import type { ComponentType, JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "./CodeBlock";

export interface DocSection {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  category: "Getting Started" | "Studio & Modeling" | "Security & Identity" | "Advanced & API" | "Deployment & CLI";
  summary: string;
  render: () => JSX.Element;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "Overview & Architecture",
    icon: Rocket,
    category: "Getting Started",
    summary: "Introduction to chz-nest, core architectural boundaries, and tech stack.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          <strong className="text-foreground">chz-nest</strong> is a desktop low-code studio and CLI tool designed for architecting, validating, and generating enterprise-grade <strong className="text-foreground">NestJS + TypeORM</strong> REST and GraphQL APIs.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface-raised/40 p-3">
            <p className="text-xs font-semibold text-foreground">Desktop Studio</p>
            <p className="mt-1 text-[11px] text-muted">Tauri 2 + React 19 + HeroUI v3 + Tailwind CSS v4</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-raised/40 p-3">
            <p className="text-xs font-semibold text-foreground">Pure Engine Core</p>
            <p className="mt-1 text-[11px] text-muted">100% pure TypeScript (zero DOM/React) in <code className="text-foreground">src/core/</code></p>
          </div>
          <div className="rounded-lg border border-border bg-surface-raised/40 p-3">
            <p className="text-xs font-semibold text-foreground">Output Artifact</p>
            <p className="mt-1 text-[11px] text-muted">NestJS 10, TypeORM, Swagger, Docker, Jest e2e</p>
          </div>
        </div>

        <h3 className="pt-2 text-sm font-semibold text-foreground">Prerequisites & Running</h3>
        <p className="text-xs text-muted">Run the studio in desktop shell or browser development mode:</p>
        <CodeBlock
          language="bash"
          code={`# Desktop studio (Tauri 2 with native filesystem)\nnpm run tauri dev\n\n# Browser development mode (localStorage fallback)\nnpm run dev\n\n# Run full test suite\nnpm test\n\n# Production build check\nnpm run build`}
        />
      </div>
    ),
  },
  {
    id: "settings",
    title: "Project & Engine Settings",
    icon: Server,
    category: "Getting Started",
    summary: "Configure database dialects, server ports, CORS, mailers, and Docker Compose.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Configure global parameters for the generated NestJS application from the <strong className="text-foreground">Settings</strong> tab:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li><strong className="text-foreground">Database Dialect</strong>: Choose <strong>PostgreSQL 16</strong> (default), <strong>MySQL</strong>, or <strong>SQLite</strong>. The generator adjusts column types, migration drivers, and Docker compose services accordingly.</li>
          <li><strong className="text-foreground">Server Port & API Prefix</strong>: Customize listening port (default: <code className="text-foreground">3000</code>) and global route prefix (default: <code className="text-foreground">/api</code>).</li>
          <li><strong className="text-foreground">CORS Configuration</strong>: Configure allowed origins, methods, and credentials for frontend access.</li>
          <li><strong className="text-foreground">Docker Compose</strong>: Generates multi-stage production Dockerfile and compose stacks pre-wired with database healthchecks.</li>
          <li><strong className="text-foreground">Mailer Settings</strong>: SMTP configuration for user email verification and password reset workflows.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "entities",
    title: "Entity & Model Designer",
    icon: Boxes,
    category: "Studio & Modeling",
    summary: "Design entities, fields, enums, soft-delete, pagination, and relations.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          The <strong className="text-foreground">Entities</strong> screen provides an interactive form-based model editor with live semantic validation.
        </p>
        <h4 className="text-xs font-semibold text-foreground">Field Types Supported</h4>
        <div className="flex flex-wrap gap-1.5">
          {["string", "text", "int", "float", "boolean", "date", "datetime", "uuid", "enum", "json"].map((type) => (
            <Badge key={type} variant="accent">{type}</Badge>
          ))}
        </div>

        <h4 className="pt-2 text-xs font-semibold text-foreground">Entity Modifiers</h4>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          <li><strong className="text-foreground">Timestamps</strong>: Automatically manages <code className="text-foreground">createdAt</code> and <code className="text-foreground">updatedAt</code>.</li>
          <li><strong className="text-foreground">Soft Delete</strong>: Uses TypeORM <code className="text-foreground">@DeleteDateColumn()</code> with admin-only restore endpoints.</li>
          <li><strong className="text-foreground">Pagination</strong>: Standard pagination envelopes (<code className="text-foreground">page</code>, <code className="text-foreground">limit</code>, <code className="text-foreground">total</code>, <code className="text-foreground">totalPages</code>).</li>
          <li><strong className="text-foreground">Searchable & Sortable</strong>: Emits contains search (<code className="text-foreground">ILIKE</code>/<code className="text-foreground">LIKE</code>) and whitelisted sort query parameters.</li>
        </ul>

        <h4 className="pt-2 text-xs font-semibold text-foreground">Relations</h4>
        <p className="text-xs text-muted">
          Define <code className="text-foreground">1:1</code>, <code className="text-foreground">1:N</code>, and <code className="text-foreground">N:M</code> relations with configurable cascades (<code className="text-foreground">CASCADE</code>, <code className="text-foreground">SET NULL</code>, <code className="text-foreground">RESTRICT</code>). Inverse relations are automatically derived.
        </p>
      </div>
    ),
  },
  {
    id: "auth",
    title: "Authentication, 2FA & OAuth",
    icon: Shield,
    badge: "Security",
    category: "Security & Identity",
    summary: "JWT tokens, bcrypt cost 12, TOTP Two-Factor Auth, and social OAuth logins.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Comprehensive identity security built directly into the generated API:
        </p>
        <div className="space-y-2 text-xs text-muted">
          <div className="rounded-md border border-border bg-surface-raised/30 p-2.5">
            <span className="font-semibold text-foreground">JWT Access & Refresh Tokens</span>: Short-lived access tokens with rotating refresh tokens stored hashed with SHA-256. Password hashing via <code className="text-foreground">bcrypt</code> cost 12.
          </div>
          <div className="rounded-md border border-border bg-surface-raised/30 p-2.5">
            <span className="font-semibold text-foreground">Two-Factor Authentication (2FA)</span>: TOTP secrets, QR code data URLs for authenticator apps, and single-use emergency recovery codes.
          </div>
          <div className="rounded-md border border-border bg-surface-raised/30 p-2.5">
            <span className="font-semibold text-foreground">OAuth 2.0 Social Logins</span>: Passport strategies for Google, GitHub, and Discord pre-configured with auth callback endpoints.
          </div>
          <div className="rounded-md border border-border bg-surface-raised/30 p-2.5">
            <span className="font-semibold text-foreground">Password Reset & Email Verification</span>: Time-limited single-use cryptographic tokens with automated mail delivery.
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "authorization",
    title: "Access Matrix & Ownership Rules",
    icon: Lock,
    badge: "Security",
    category: "Security & Identity",
    summary: "Per-entity, per-operation Access Matrix with 404 ownership isolation.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Configure fine-grained permissions across every CRUD operation (<code className="text-foreground">list</code>, <code className="text-foreground">read</code>, <code className="text-foreground">create</code>, <code className="text-foreground">update</code>, <code className="text-foreground">delete</code>, <code className="text-foreground">restore</code>):
        </p>
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-md border border-border bg-surface p-2.5">
            <strong className="text-accent">Public</strong>
            <p className="mt-0.5 text-muted">Endpoint accessible without authentication headers.</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-2.5">
            <strong className="text-accent">Authenticated</strong>
            <p className="mt-0.5 text-muted">Requires any valid JWT bearer token.</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-2.5">
            <strong className="text-accent">Roles (RBAC)</strong>
            <p className="mt-0.5 text-muted">Restricted to specific roles (e.g. ADMIN, MODERATOR).</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-2.5">
            <strong className="text-accent">Owner (Row-Level)</strong>
            <p className="mt-0.5 text-muted">Strict row-level isolation via managed owner FK relation.</p>
          </div>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <strong>Ownership Security Invariant:</strong> Foreign records return <strong>404 Not Found</strong> instead of 403 Forbidden to prevent existence leaking.
        </div>
      </div>
    ),
  },
  {
    id: "endpoints",
    title: "Custom Endpoints & Route Builder",
    icon: Network,
    category: "Advanced & API",
    summary: "Design custom controllers, HTTP methods, path params, DTOs, and caching.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Add custom business logic endpoints beyond standard CRUD operations:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li><strong className="text-foreground">HTTP Methods</strong>: <code className="text-foreground">GET</code>, <code className="text-foreground">POST</code>, <code className="text-foreground">PUT</code>, <code className="text-foreground">PATCH</code>, <code className="text-foreground">DELETE</code>.</li>
          <li><strong className="text-foreground">Path Tokens</strong>: Supports parameterized route segments (e.g., <code className="text-foreground">posts/:id/publish</code>).</li>
          <li><strong className="text-foreground">DTO Generation</strong>: Automatically generates typed request body DTOs and query parameter validation schemas.</li>
          <li><strong className="text-foreground">Guards & Access</strong>: Configured with role, authenticated, or custom access guards.</li>
          <li><strong className="text-foreground">Rate Limits & Cache</strong>: Custom per-endpoint throttling limits and HTTP <code className="text-foreground">Cache-Control</code> max-age headers.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "graphql",
    title: "Code-First GraphQL Generation",
    icon: Cpu,
    category: "Advanced & API",
    summary: "Generate code-first GraphQL schemas, resolvers, input types, and ApolloDriver.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          When GraphQL is enabled in project settings, <code className="text-foreground">chz-nest</code> generates a complete code-first GraphQL layer alongside REST:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li><strong className="text-foreground">Types & Inputs</strong>: Emits <code className="text-foreground">@ObjectType()</code>, <code className="text-foreground">@InputType()</code>, and <code className="text-foreground">@ArgsType()</code> with strict TypeORM mappings.</li>
          <li><strong className="text-foreground">Resolvers</strong>: Emits NestJS <code className="text-foreground">@Resolver()</code> classes with <code className="text-foreground">@Query()</code> and <code className="text-foreground">@Mutation()</code> operations matching the entity's access rules.</li>
          <li><strong className="text-foreground">ApolloDriver Wiring</strong>: Pre-configures <code className="text-foreground">GraphQLModule.forRoot&lt;ApolloDriverConfig&gt;</code> in <code className="text-foreground">AppModule</code>.</li>
          <li><strong className="text-foreground">Interactive Playground</strong>: Access the interactive GraphQL playground at <code className="text-foreground">http://localhost:3000/graphql</code>.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "multitenancy-storage",
    title: "Multi-Tenancy & File Storage",
    icon: Upload,
    category: "Advanced & API",
    summary: "Tenant scoping (Header/Subdomain/Param) and Local / AWS S3 file attachments.",
    render: () => (
      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-foreground">Multi-Tenancy Scoping</h4>
        <p className="text-xs text-muted">
          Automates SaaS tenant isolation. Associated queries are filtered and scoped by tenant context resolved via:
        </p>
        <div className="flex gap-2">
          <Badge variant="accent">Header (X-Tenant-ID)</Badge>
          <Badge variant="accent">Subdomain</Badge>
          <Badge variant="accent">Route Param (/:tenantId)</Badge>
        </div>

        <h4 className="pt-2 text-xs font-semibold text-foreground">File Uploads & Attachments</h4>
        <p className="text-xs text-muted">
          Supports file upload endpoints and metadata tracking via an <code className="text-foreground">Attachment</code> entity:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          <li><strong className="text-foreground">Local Driver</strong>: Stores files under <code className="text-foreground">./uploads/</code> with unique SHA hashing.</li>
          <li><strong className="text-foreground">AWS S3 Driver</strong>: Direct upload to S3, MinIO, or Cloudflare R2 with pre-signed URLs.</li>
          <li>Configurable maximum file sizes and MIME-type whitelists (e.g. <code className="text-foreground">image/*</code>).</li>
        </ul>
      </div>
    ),
  },
  {
    id: "preview-export",
    title: "Code Preview, Diff Viewer & Export",
    icon: Code2,
    category: "Studio & Modeling",
    summary: "Fast raw generation, Monaco syntax viewer, Monaco DiffEditor, and 3-way merge.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          The <strong className="text-foreground">Generate</strong> screen provides complete visibility before touching disk:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li><strong className="text-foreground">Sub-300ms Generation</strong>: Raw generation executes in &lt;50ms, showing code immediately while Prettier formats in background.</li>
          <li><strong className="text-foreground">Monaco Diff Viewer</strong>: Compares generated files against existing files on disk, categorizing them as <span className="text-success">Unchanged</span>, <span className="text-accent">Generator Updated</span>, <span className="text-warning">Disk Modified</span>, or <span className="text-muted">Untracked</span>.</li>
          <li><strong className="text-foreground">Three-Way Merge</strong>: Choose to <code className="text-foreground">Overwrite</code>, <code className="text-foreground">Skip</code> (preserve disk edits), or <code className="text-foreground">Save as .new</code>.</li>
          <li><strong className="text-foreground">Export Formats</strong>: Download a ZIP with a SHA-256 integrity manifest or write directly to a local folder.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "cli",
    title: "Standalone CLI Guide",
    icon: Terminal,
    badge: "CLI",
    category: "Deployment & CLI",
    summary: "Headless model validation and code generation using npm run chz.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Use the standalone Node.js CLI (<code className="text-foreground">chz</code>) in CI/CD pipelines or automated workflows:
        </p>
        <CodeBlock
          language="bash"
          code={`# Validate a project model (exits 0 if valid, 2 if invalid)\nnpm run chz -- validate ./project.json\n\n# Validate with machine-readable JSON output\nnpm run chz -- validate ./project.json --json\n\n# Generate project to disk\nnpm run chz -- generate ./project.json --out ./my-api\n\n# Dry run export plan\nnpm run chz -- generate ./project.json --out ./my-api --dry-run\n\n# Force overwrite manual disk edits\nnpm run chz -- generate ./project.json --out ./my-api --overwrite`}
        />
        <div className="grid gap-2 text-xs sm:grid-cols-4">
          <div className="rounded border border-border bg-surface p-2 text-center">
            <span className="font-mono font-bold text-success">Exit 0</span>
            <p className="text-[10px] text-muted">Success</p>
          </div>
          <div className="rounded border border-border bg-surface p-2 text-center">
            <span className="font-mono font-bold text-warning">Exit 1</span>
            <p className="text-[10px] text-muted">Usage Error</p>
          </div>
          <div className="rounded border border-border bg-surface p-2 text-center">
            <span className="font-mono font-bold text-danger">Exit 2</span>
            <p className="text-[10px] text-muted">Invalid Model</p>
          </div>
          <div className="rounded border border-border bg-surface p-2 text-center">
            <span className="font-mono font-bold text-danger">Exit 3</span>
            <p className="text-[10px] text-muted">Write Failed</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "deployment",
    title: "Running the Generated NestJS API",
    icon: Zap,
    category: "Deployment & CLI",
    summary: "Migrations, deterministic seeds, Docker Compose, Swagger docs, and e2e testing.",
    render: () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Steps to boot and verify an exported NestJS API:
        </p>
        <CodeBlock
          language="bash"
          code={`# 1. Install dependencies\ncd my-api && npm install\n\n# 2. Configure environment\ncp .env.example .env\n\n# 3. Run database migrations & seeds\nnpm run migration:run\nnpm run seed\n\n# 4. Start local development server\nnpm run start:dev\n\n# 5. Boot full Docker Compose stack (API + DB)\ndocker compose up --build -d\n\n# 6. Run generated Jest + Supertest e2e tests\nnpm run test:e2e`}
        />
        <div className="flex gap-4 text-xs text-muted">
          <div>
            <strong className="text-foreground">Swagger UI:</strong> <code className="text-accent">http://localhost:3000/docs</code>
          </div>
          <div>
            <strong className="text-foreground">GraphQL:</strong> <code className="text-accent">http://localhost:3000/graphql</code>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts Reference",
    icon: Key,
    category: "Studio & Modeling",
    summary: "Productivity shortcuts for rapid model designing and generation.",
    render: () => (
      <div className="space-y-4">
        <div className="divide-y divide-border rounded-lg border border-border bg-surface text-xs">
          <div className="flex items-center justify-between p-3">
            <span className="text-muted">Undo last change</span>
            <kbd className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground">Ctrl / Cmd + Z</kbd>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-muted">Redo last change</span>
            <kbd className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground">Ctrl / Cmd + Shift + Z</kbd>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-muted">Run code generation</span>
            <kbd className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground">Ctrl / Cmd + Enter</kbd>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-muted">Manual save project</span>
            <kbd className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground">Ctrl / Cmd + S</kbd>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-muted">Navigate entity sidebar</span>
            <kbd className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground">Up / Down Arrow</kbd>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-muted">Close active modal</span>
            <kbd className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground">Escape</kbd>
          </div>
        </div>
      </div>
    ),
  },
];
