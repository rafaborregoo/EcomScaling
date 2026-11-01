import { z } from "zod";

export const internalEmailTemplateSchema = z.object({
  version: z.literal(1),
  key: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
  description: z.string().min(1).max(1000),
  variables: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/),
    label: z.string().min(1).max(100),
    kind: z.enum(["text", "image", "url", "color"]),
    example: z.string().min(1).max(2000),
  }).strict()).min(1).max(60),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.variables.map((item) => item.key)).size !== value.variables.length)
    ctx.addIssue({ code: "custom", message: "duplicate_template_variables" });
});
export type InternalEmailTemplate = z.infer<typeof internalEmailTemplateSchema>;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Replace declared slots only. Values are text, never executable markup or CSS. */
export function renderInternalEmailTemplate(html: string, template: InternalEmailTemplate, values: Record<string, string> = {}) {
  const parsed = internalEmailTemplateSchema.parse(template);
  const fields = new Map(parsed.variables.map((field) => [field.key, field]));
  return html.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    const field = fields.get(key);
    if (!field) throw new Error(`unknown_template_variable:${key}`);
    const value = values[key] ?? field.example;
    if (!value.trim() || value.length > 2000) throw new Error(`invalid_template_value:${key}`);
    if (field.kind === "color" && !/^#[a-f0-9]{6}$/i.test(value)) throw new Error(`invalid_template_color:${key}`);
    if (field.kind === "url" || field.kind === "image") {
      const localDemoImage = field.kind === "image" && /^\/marketing-demo\/[a-z0-9-]+\.(png|webp|jpg)$/.test(value);
      if (!localDemoImage) {
        let url: URL;
        try { url = new URL(value); } catch { throw new Error(`invalid_template_url:${key}`); }
        if (url.protocol !== "https:" || url.username || url.password) throw new Error(`invalid_template_url:${key}`);
      }
    }
    return escapeHtml(value);
  });
}
