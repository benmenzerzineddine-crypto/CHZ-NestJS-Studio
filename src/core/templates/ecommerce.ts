import {
  USER_ENTITY_ID,
  buildUserEntity,
  createEntity,
  createEnum,
  createField,
  createProject,
  createRelation,
} from "../model/defaults";
import type { Driver, Project } from "../model/schema";
import type { ProjectTemplate } from "./types";

export function createEcommerceProject(options?: {
  name?: string;
  packageName?: string;
  driver?: Driver;
}): Project {
  const project = createProject(
    options?.name ?? "E-Commerce API",
    options?.driver ?? "postgres",
    true,
  );

  if (options?.packageName) {
    project.packageName = options.packageName;
  }

  // Uploads & Throttling
  project.settings.uploads = {
    enabled: true,
    driver: "local",
    maxFileSizeMb: 10,
  };
  project.settings.throttling = {
    enabled: true,
    ttl: 60,
    limit: 120,
  };

  // Auth configuration
  project.auth = {
    ...project.auth,
    refreshTokens: true,
    sessionManagement: true,
    roles: [
      { key: "admin", label: "Admin" },
      { key: "customer", label: "Customer" },
    ],
  };

  // Enums
  const orderStatusEnum = createEnum("OrderStatus", [
    "pending",
    "paid",
    "shipped",
    "delivered",
    "cancelled",
  ]);
  orderStatusEnum.id = "enm_orderstatus";
  project.enums = [orderStatusEnum];

  // Entities
  const user = buildUserEntity();

  const category = createEntity("Category");
  category.id = "ent_category";
  category.description = "Product category organizing store items.";
  category.fields = [
    createField("name", "string", { column: { length: 80 } }),
    createField("slug", "string", { unique: true, indexed: true, column: { length: 80 } }),
    createField("description", "text", { required: false }),
  ];
  category.options.searchFields = ["name", "slug"];
  category.access = {
    list: { level: "public" },
    read: { level: "public" },
    create: { level: "roles", roles: ["admin"] },
    update: { level: "roles", roles: ["admin"] },
    delete: { level: "roles", roles: ["admin"] },
  };

  const product = createEntity("Product");
  product.id = "ent_product";
  product.description = "Catalog merchandise available for purchase.";
  product.fields = [
    createField("name", "string", { column: { length: 120 } }),
    createField("slug", "string", { unique: true, indexed: true, column: { length: 120 } }),
    createField("description", "text"),
    createField("price", "decimal", { column: { precision: 10, scale: 2 } }),
    createField("sku", "string", { unique: true, column: { length: 40 } }),
    createField("stock", "int", { defaultValue: "0" }),
    createField("active", "boolean", { defaultValue: "true" }),
  ];
  product.relations = [
    createRelation("category", category.id, "many-to-one", { nullable: false }),
  ];
  product.options.searchFields = ["name", "slug", "sku"];
  product.access = {
    list: { level: "public" },
    read: { level: "public" },
    create: { level: "roles", roles: ["admin"] },
    update: { level: "roles", roles: ["admin"] },
    delete: { level: "roles", roles: ["admin"] },
  };

  const order = createEntity("Order");
  order.id = "ent_order";
  order.description = "Customer checkout transaction and shipment status.";
  order.options.owner = true;
  order.options.ownerRelation = "customer";
  order.fields = [
    createField("orderNumber", "string", { unique: true, indexed: true, column: { length: 32 } }),
    createField("status", "enum", { enumId: orderStatusEnum.id, defaultValue: "'pending'" }),
    createField("total", "decimal", { column: { precision: 10, scale: 2 } }),
    createField("shippingAddress", "text"),
  ];
  order.relations = [
    createRelation("customer", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  order.options.searchFields = ["orderNumber"];
  order.access = {
    list: { level: "owner" },
    read: { level: "owner" },
    create: { level: "authenticated" },
    update: { level: "roles", roles: ["admin"] },
    delete: { level: "roles", roles: ["admin"] },
  };

  const orderItem = createEntity("OrderItem");
  orderItem.id = "ent_orderitem";
  orderItem.description = "Line item inside a customer order.";
  orderItem.fields = [
    createField("quantity", "int", { defaultValue: "1" }),
    createField("unitPrice", "decimal", { column: { precision: 10, scale: 2 } }),
  ];
  orderItem.relations = [
    createRelation("order", order.id, "many-to-one", { nullable: false, cascade: true }),
    createRelation("product", product.id, "many-to-one", { nullable: false }),
  ];
  orderItem.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "authenticated" },
    update: { level: "roles", roles: ["admin"] },
    delete: { level: "roles", roles: ["admin"] },
  };

  const review = createEntity("Review");
  review.id = "ent_review";
  review.description = "Verified customer rating and feedback on a product.";
  review.options.owner = true;
  review.options.ownerRelation = "author";
  review.fields = [
    createField("rating", "int", { validators: { min: 1, max: 5 } }),
    createField("comment", "text", { required: false }),
  ];
  review.relations = [
    createRelation("product", product.id, "many-to-one", { nullable: false }),
    createRelation("author", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  review.access = {
    list: { level: "public" },
    read: { level: "public" },
    create: { level: "authenticated" },
    update: { level: "owner" },
    delete: { level: "owner" },
  };

  project.entities = [user, category, product, order, orderItem, review];
  return project;
}

export const ecommerceTemplate: ProjectTemplate = {
  id: "ecommerce",
  title: "E-Commerce Starter",
  category: "ecommerce",
  tagline: "Online store with catalog, orders, and reviews",
  description:
    "End-to-end storefront architecture featuring product catalog with categories, SKU & stock tracking, customer orders with line items, and product reviews.",
  icon: "ShoppingBag",
  features: [
    "Product & Category Catalog",
    "Orders & Line Items",
    "Customer Product Reviews",
    "Image Upload Support",
    "Rate Limiting & Throttling",
  ],
  entities: ["Category", "Product", "Order", "OrderItem", "Review"],
  createProject: createEcommerceProject,
};
