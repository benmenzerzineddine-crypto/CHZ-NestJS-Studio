import type { Driver, Project } from "../model/schema";

export type TemplateCategory = "saas" | "ecommerce" | "crm" | "cms";

export interface ProjectTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  tagline: string;
  description: string;
  icon: string;
  features: string[];
  entities: string[];
  createProject: (options?: {
    name?: string;
    packageName?: string;
    driver?: Driver;
  }) => Project;
}
