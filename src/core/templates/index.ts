import { blogTemplate } from "./blog";
import { crmTemplate } from "./crm";
import { ecommerceTemplate } from "./ecommerce";
import { saasTemplate } from "./saas";
import type { ProjectTemplate, TemplateCategory } from "./types";

export * from "./types";
export { saasTemplate } from "./saas";
export { ecommerceTemplate } from "./ecommerce";
export { crmTemplate } from "./crm";
export { blogTemplate } from "./blog";

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  saasTemplate,
  ecommerceTemplate,
  crmTemplate,
  blogTemplate,
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((template) => template.category === category);
}
