import type { EntityIR, FieldIR } from "../ir/types";

export interface SeedDataOptions {
  realistic?: boolean;
}

const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Sam", "Casey", "Riley", "Jamie", "Avery", "Dakota"];
const LAST_NAMES = ["Morgan", "Chen", "Smith", "Johnson", "Davis", "Williams", "Miller", "Brown", "Wilson", "Taylor"];
const CITIES = ["San Francisco", "Austin", "Seattle", "New York", "Chicago", "Boston", "Denver", "Portland"];
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "Japan", "Netherlands"];
const STREETS = [
  "742 Evergreen Terrace",
  "221B Baker Street",
  "10 Downing Street",
  "100 Market Street",
  "450 Mission Street",
  "1200 Broadway",
  "350 5th Avenue",
  "800 West Peachtree",
];

const DOMAINS = ["example.com", "example.org", "example.net"];

function pick<T>(list: T[], index: number): T {
  return list[index % list.length];
}

function clampLength(value: string, minLength: number, maxLength: number): string {
  if (value.length > maxLength) {
    return value.slice(0, maxLength);
  }
  if (value.length < minLength) {
    return value.padEnd(minLength, "x").slice(0, maxLength);
  }
  return value;
}

function getSpecificEntityString(
  entityName: string,
  fieldName: string,
  row: number,
): string | null {
  const entity = entityName.toLowerCase();
  const field = fieldName.toLowerCase();

  // Blog / Post / Article
  if (["post", "article", "story"].includes(entity)) {
    if (field === "title") {
      const titles = [
        "Getting Started with Modern NestJS Architecture",
        "Optimizing High-Throughput Relational Databases",
        "Designing Resilient Cloud Microservices with Zero-Trust Security",
        "Mastering TypeScript and Domain-Driven Design Patterns",
        "Automated Continuous Delivery Pipelines for Node.js",
      ];
      return pick(titles, row);
    }
    if (field === "slug") {
      const slugs = [
        "getting-started-with-modern-nestjs-architecture",
        "optimizing-high-throughput-relational-databases",
        "designing-resilient-cloud-microservices",
        "mastering-typescript-and-domain-driven-design",
        "automated-continuous-delivery-pipelines",
      ];
      return pick(slugs, row);
    }
    if (["content", "body"].includes(field)) {
      const contents = [
        "In modern backend engineering, structured domain modelling and decoupled modules ensure long-term codebase maintainability. This article explores best practices for building enterprise-grade APIs with NestJS.",
        "Database indexing, connection pooling, and optimistic concurrency are critical techniques when scaling high-traffic transactional applications in production environments.",
        "Adopting zero-trust authorization architectures, signed session tokens, and strict input validation guards distributed systems against common production vulnerabilities.",
        "Event-driven architecture coupled with reliable message queues allows independent service scaling without tight runtime coupling across operational boundaries.",
        "Comprehensive automated testing, contract validation, and containerized parity guarantee safe production deployments at scale.",
      ];
      return pick(contents, row);
    }
  }

  // Comment / Review / Feedback
  if (["comment", "review", "feedback"].includes(entity)) {
    if (["content", "body", "comment"].includes(field)) {
      const comments = [
        "Great breakdown! The architectural insights on module boundaries were especially helpful.",
        "Clear and thorough guide. We applied these connection pooling settings and observed immediate latency drops.",
        "Excellent overview of security trade-offs. Looking forward to the next deep dive!",
        "Very practical explanation. Saved our team hours during API design reviews.",
        "Insightful real-world examples. The error handling patterns are clean and reliable.",
      ];
      return pick(comments, row);
    }
  }

  // Tag / Category / Topic
  if (["tag", "category", "topic", "genre"].includes(entity)) {
    if (field === "name") {
      const tags = ["Engineering", "Architecture", "Security", "DevOps", "Database", "Design", "Cloud", "Performance"];
      return pick(tags, row);
    }
    if (field === "slug") {
      const slugs = ["engineering", "architecture", "security", "devops", "database", "design", "cloud", "performance"];
      return pick(slugs, row);
    }
    if (field === "description") {
      const descs = [
        "Core software engineering practices, patterns, and principles.",
        "System architecture, modular boundaries, and distributed systems.",
        "Authentication, authorization, and zero-trust security hardening.",
        "Continuous integration, deployment automation, and observability.",
      ];
      return pick(descs, row);
    }
  }

  // Product / Item
  if (["product", "item", "merchandise"].includes(entity)) {
    if (["name", "title"].includes(field)) {
      const products = [
        "Wireless Noise-Canceling Studio Headphones",
        "Ergonomic Custom Mechanical Keyboard",
        "Ultra-Wide 4K IPS Creator Display",
        "Precision Dual-Sensor Wireless Mouse",
        "Compact Aluminum Multiport USB-C Hub",
      ];
      return pick(products, row);
    }
    if (field === "sku") {
      return `SKU-PROD-${1000 + row + 1}`;
    }
    if (field === "slug") {
      const slugs = [
        "wireless-noise-canceling-studio-headphones",
        "ergonomic-custom-mechanical-keyboard",
        "ultra-wide-4k-ips-creator-display",
        "precision-dual-sensor-wireless-mouse",
        "compact-aluminum-multiport-usb-c-hub",
      ];
      return pick(slugs, row);
    }
    if (field === "description") {
      const productDescs = [
        "High-fidelity acoustics with hybrid active noise cancellation, 40-hour battery life, and plush memory foam earcups.",
        "Hot-swappable mechanical switches with custom PBT keycaps, per-key RGB backlighting, and solid aluminum chassis.",
        "Color-calibrated 34-inch IPS display with 99% DCI-P3 gamut, Thunderbolt 4 connectivity, and ergonomic stand.",
      ];
      return pick(productDescs, row);
    }
  }

  // Order
  if (entity === "order") {
    if (["ordernumber", "order_number"].includes(field)) {
      return `ORD-2024-${1000 + row + 1}`;
    }
    if (["shippingaddress", "billingaddress"].includes(field)) {
      const addresses = [
        "742 Evergreen Terrace, Suite 100, Springfield, OR 97477",
        "221B Baker Street, Floor 2, London, NW1 6XE",
        "10 Market Street, 4th Floor, San Francisco, CA 94105",
      ];
      return pick(addresses, row);
    }
  }

  // Organization / Company / Tenant
  if (["organization", "company", "tenant"].includes(entity)) {
    if (field === "name") {
      const companies = ["Acme Corporation", "NovaTech Solutions", "Starlight Cloud", "Vertex Innovations", "Apex Digital"];
      return pick(companies, row);
    }
    if (field === "slug") {
      const slugs = ["acme-corp", "novatech-solutions", "starlight-cloud", "vertex-innovations", "apex-digital"];
      return pick(slugs, row);
    }
    if (["billingemail", "billing_email"].includes(field)) {
      const emails = ["billing@acme.example.com", "finance@novatech.example.org", "accounts@starlight.example.net"];
      return pick(emails, row);
    }
    if (field === "plan") {
      return pick(["starter", "pro", "enterprise"], row);
    }
    if (field === "industry") {
      const industries = ["Software & Cloud Services", "Financial Technology", "Enterprise Healthcare", "Supply Chain & Logistics"];
      return pick(industries, row);
    }
  }

  // Workspace
  if (entity === "workspace") {
    if (field === "name") {
      const workspaces = ["Production Operations", "Design System", "Customer Portal", "Analytics Engine"];
      return pick(workspaces, row);
    }
    if (field === "slug") {
      const slugs = ["production-ops", "design-system", "customer-portal", "analytics-engine"];
      return pick(slugs, row);
    }
  }

  // Deal
  if (entity === "deal") {
    if (["title", "name"].includes(field)) {
      const deals = [
        "Enterprise Platform Subscription",
        "Cloud Infrastructure Migration Project",
        "Annual Multi-Tenant License Renewal",
        "Custom API Integration Package",
      ];
      return pick(deals, row);
    }
  }

  // Activity / Task
  if (["activity", "task"].includes(entity)) {
    if (["subject", "title"].includes(field)) {
      const subjects = [
        "Quarterly architecture alignment call",
        "Contract terms review with procurement",
        "Technical integration milestone sign-off",
        "Product roadmap sync meeting",
      ];
      return pick(subjects, row);
    }
    if (["notes", "note"].includes(field)) {
      const notes = [
        "Reviewed technical milestone deliverables and confirmed deployment schedule for next quarter.",
        "Walked through SLA commitments and confirmed security compliance requirements.",
        "Finalized pricing terms and shared updated contract with legal team.",
      ];
      return pick(notes, row);
    }
  }

  // ApiKey
  if (["apikey", "api_key"].includes(entity)) {
    if (field === "name") {
      const keys = ["Production Ingestion Key", "Staging Webhook Dispatcher", "Developer CLI Token"];
      return pick(keys, row);
    }
    if (field === "keyprefix") {
      return pick(["ak_live_", "ak_stage_", "ak_dev_"], row);
    }
    if (field === "keyhash") {
      const hashes = [
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
        "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
      ];
      return pick(hashes, row);
    }
  }

  // AuditLog
  if (["auditlog", "audit_log"].includes(entity)) {
    if (field === "action") {
      return pick(["user.auth.login", "organization.member.invite", "api_key.generate", "workspace.create"], row);
    }
    if (field === "resource") {
      return pick(["auth/sessions", "teams/memberships", "settings/apikeys", "workspaces/settings"], row);
    }
  }

  return null;
}

export function sampleRealisticString(
  field: FieldIR,
  entity: EntityIR,
  row: number,
  options: SeedDataOptions = { realistic: true },
): string {
  const maxLength = Math.min(
    field.definition.validators?.maxLength ?? field.definition.column?.length ?? 255,
    field.definition.column?.length ?? 255,
  );
  const minLength = field.definition.validators?.minLength ?? 0;

  if (options.realistic === false) {
    const base =
      field.name === "email"
        ? `seed+${entity.singularKebab}-${row + 1}@example.com`
        : field.unique
          ? `${entity.name} ${row + 1}`
          : `${entity.name} sample ${row + 1}`;
    const padded = base.padEnd(minLength, "x");
    return padded.slice(0, Math.max(minLength, maxLength));
  }

  // Check specific entity + field override first
  const specific = getSpecificEntityString(entity.name, field.name, row);
  if (specific !== null) {
    const uniqueVal = field.unique ? `${specific}-${row + 1}` : specific;
    return clampLength(uniqueVal, minLength, maxLength);
  }

  const name = field.name.toLowerCase();

  // Email
  if (name.includes("email")) {
    const userNames = ["alex.morgan", "jordan.chen", "taylor.smith", "morgan.johnson", "sam.davis"];
    const domain = pick(DOMAINS, row);
    const raw = `${pick(userNames, row)}${field.unique ? `.${row + 1}` : ""}@${domain}`;
    return clampLength(raw, minLength, maxLength);
  }

  // First name
  if (name === "firstname" || name === "first_name") {
    return clampLength(pick(FIRST_NAMES, row), minLength, maxLength);
  }

  // Last name
  if (name === "lastname" || name === "last_name") {
    return clampLength(pick(LAST_NAMES, row), minLength, maxLength);
  }

  // Full Name / Person Name
  if (name === "fullname" || name === "full_name" || (name === "name" && ["user", "author", "contact", "customer", "person", "member"].includes(entity.name.toLowerCase()))) {
    const fullName = `${pick(FIRST_NAMES, row)} ${pick(LAST_NAMES, row)}`;
    const finalVal = field.unique ? `${fullName} ${row + 1}` : fullName;
    return clampLength(finalVal, minLength, maxLength);
  }

  // Username
  if (name === "username" || name === "handle") {
    const handles = ["alex_m", "jordan_dev", "taylor_tech", "morgan_pro", "sam_cloud"];
    const handle = `${pick(handles, row)}${field.unique ? `_${row + 1}` : ""}`;
    return clampLength(handle, minLength, maxLength);
  }

  // Phone
  if (name.includes("phone") || name.includes("mobile") || name === "tel") {
    const phones = ["+1-555-0142", "+1-555-0189", "+1-555-0233", "+1-555-0374", "+1-555-0419"];
    return clampLength(pick(phones, row), minLength, maxLength);
  }

  // URL / Website
  if (name.includes("url") || name.includes("website") || name === "link" || name === "site") {
    if (name.includes("avatar") || name.includes("photo") || name.includes("image")) {
      const images = [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
      ];
      return clampLength(pick(images, row), minLength, maxLength);
    }
    const urls = ["https://acme.example.com", "https://novatech.example.org", "https://starlight.example.net"];
    return clampLength(pick(urls, row), minLength, maxLength);
  }

  // Address
  if (name.includes("address") || name.includes("street")) {
    return clampLength(pick(STREETS, row), minLength, maxLength);
  }

  // City
  if (name.includes("city")) {
    return clampLength(pick(CITIES, row), minLength, maxLength);
  }

  // Country
  if (name.includes("country")) {
    return clampLength(pick(COUNTRIES, row), minLength, maxLength);
  }

  // Zip / Postal code
  if (name.includes("zip") || name.includes("postal")) {
    const zips = ["94105", "78701", "98101", "10001", "60601"];
    return clampLength(pick(zips, row), minLength, maxLength);
  }

  // Job title
  if (name.includes("job") || name.includes("title") && ["contact", "employee", "user"].includes(entity.name.toLowerCase())) {
    const titles = ["Senior Software Architect", "Head of Product Design", "Director of Infrastructure"];
    return clampLength(pick(titles, row), minLength, maxLength);
  }

  // Company
  if (name.includes("company") || name.includes("organization")) {
    const comps = ["Acme Corporation", "NovaTech Solutions", "Starlight Cloud"];
    return clampLength(pick(comps, row), minLength, maxLength);
  }

  // IP address
  if (name === "ipaddress" || name === "ip_address" || name === "ip") {
    const ips = ["192.168.1.42", "10.0.0.15", "172.16.0.8", "198.51.100.24"];
    return clampLength(pick(ips, row), minLength, maxLength);
  }

  // User Agent
  if (name === "useragent" || name === "user_agent") {
    const agents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ];
    return clampLength(pick(agents, row), minLength, maxLength);
  }

  // Currency
  if (name.includes("currency")) {
    return clampLength(pick(["USD", "EUR", "GBP"], row), minLength, maxLength);
  }

  // Color
  if (name.includes("color")) {
    return clampLength(pick(["#6366f1", "#10b981", "#f59e0b", "#ec4899"], row), minLength, maxLength);
  }

  // Title / Headline
  if (name === "title" || name === "headline" || name === "subject") {
    const titles = [
      `${entity.name} Master Architecture Plan`,
      `Advanced Guide to ${entity.name} Management`,
      `Scaling ${entity.name} Workflows in Production`,
    ];
    const val = field.unique ? `${pick(titles, row)} ${row + 1}` : pick(titles, row);
    return clampLength(val, minLength, maxLength);
  }

  // Slug
  if (name === "slug") {
    const baseSlug = `${entity.singularKebab}-${row + 1}`;
    return clampLength(baseSlug, minLength, maxLength);
  }

  // Description / Summary / Bio
  if (name.includes("description") || name.includes("summary") || name.includes("bio") || name.includes("about")) {
    const desc = `Comprehensive overview and configuration details for ${entity.name.toLowerCase()} operations.`;
    return clampLength(desc, minLength, maxLength);
  }

  // Fallback
  const fallback = field.unique
    ? `${entity.name} ${row + 1}`
    : `${entity.name} sample ${row + 1}`;
  return clampLength(fallback, minLength, maxLength);
}

export function sampleRealisticNumeric(
  field: FieldIR,
  row: number,
  options: SeedDataOptions = { realistic: true },
): number {
  const min = field.definition.validators?.min ?? 0;
  const max = field.definition.validators?.max;

  if (options.realistic === false) {
    const step = field.type === "int" ? 1 : 1.5;
    let value = min + row * step;
    if (field.type === "int") value = Math.ceil(value);
    if (max !== undefined && value > max) value = max;
    return value;
  }

  const name = field.name.toLowerCase();

  // Ratings / Score (usually 1-5 or 0-100)
  if (name.includes("rating") || name.includes("stars") || name.includes("grade")) {
    const baseScores = [5, 4, 5, 4, 3];
    let val = pick(baseScores, row);
    if (val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  }

  // Pricing / Monetary
  if (
    name.includes("price") ||
    name.includes("amount") ||
    name.includes("cost") ||
    name.includes("total") ||
    name.includes("balance") ||
    name.includes("salary") ||
    name.includes("fee")
  ) {
    const prices = [49.99, 129.5, 299.0, 79.0, 549.99];
    let val = pick(prices, row);
    if (field.type === "int") val = Math.round(val);
    if (val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  }

  // Stock / Inventory / Quantity
  if (name.includes("stock") || name.includes("inventory") || name.includes("quantity")) {
    const counts = [45, 120, 250, 80, 15];
    let val = pick(counts, row);
    if (val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  }

  // Views / Clicks / Analytics
  if (name.includes("view") || name.includes("click") || name.includes("download") || name.includes("like")) {
    const metrics = [142, 385, 890, 1250, 2400];
    let val = pick(metrics, row);
    if (val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  }

  // General number step
  const step = field.type === "int" ? 1 : 1.5;
  let value = min + row * step;
  if (field.type === "int") value = Math.ceil(value);
  if (max !== undefined && value > max) value = max;
  return value;
}

export function sampleRealisticDate(row: number): string {
  const dates = ["2024-01-15", "2024-02-20", "2024-03-25", "2024-04-10", "2024-05-18"];
  return pick(dates, row);
}

export function sampleRealisticDateTime(row: number): string {
  const dateTimes = [
    "2024-01-15T09:30:00.000Z",
    "2024-02-20T14:15:00.000Z",
    "2024-03-25T16:45:00.000Z",
    "2024-04-10T11:20:00.000Z",
    "2024-05-18T18:00:00.000Z",
  ];
  return pick(dateTimes, row);
}

export function sampleRealisticJson(
  field: FieldIR,
  row: number,
  options: SeedDataOptions = { realistic: true },
): Record<string, unknown> {
  if (options.realistic === false) {
    return { seed: row + 1 };
  }

  const name = field.name.toLowerCase();
  if (name.includes("setting") || name.includes("preference")) {
    return {
      theme: row % 2 === 0 ? "dark" : "light",
      notifications: true,
      digestFrequency: "weekly",
      timezone: "UTC",
    };
  }
  if (name.includes("detail") || name.includes("meta")) {
    return {
      version: 1,
      source: "web-client",
      env: "production",
      revision: `rev-${100 + row + 1}`,
    };
  }
  if (name.includes("spec") || name.includes("attribute")) {
    return {
      format: "standard",
      dimensions: { width: 100 + row * 10, height: 200 + row * 10 },
      certified: true,
    };
  }
  return {
    item: row + 1,
    status: "active",
    syncedAt: "2024-01-15T09:30:00.000Z",
  };
}
