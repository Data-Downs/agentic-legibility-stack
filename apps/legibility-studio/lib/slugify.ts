/** Convert a string to a URL-friendly slug */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generate a service ID from department and service name */
export function generateServiceId(department: string, name: string): string {
  return `${slugify(department)}.${slugify(name)}`;
}
