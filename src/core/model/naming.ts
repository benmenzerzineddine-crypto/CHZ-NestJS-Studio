import pluralize from "pluralize";

/** `BlogPost` → `blog-post` */
export function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** `blog post` / `blog_post` / `blogPost` → `BlogPost` */
export function toPascalCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** `Blog Post` → `blogPost` */
export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** `BlogPost` → `BlogPosts` */
export function toPlural(value: string): string {
  return pluralize(value);
}

/** `BlogPost` → `blog-posts` (the REST collection path). */
export function toRestPath(entityName: string): string {
  return toKebabCase(pluralize(entityName));
}

/** `BlogPost` → `blog_posts` (the database table name). */
export function toTableName(entityName: string): string {
  return toKebabCase(pluralize(entityName)).replace(/-/g, "_");
}

/** `publishedAt` / `Published At` → `published_at` (the database column name). */
export function toSnakeCase(value: string): string {
  return toKebabCase(value).replace(/-/g, "_");
}
