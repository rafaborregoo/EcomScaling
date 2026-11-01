import assert from "node:assert/strict";
import { test } from "node:test";
import { renderInternalEmailTemplate, internalEmailTemplateSchema } from "./internal-email-template.js";
const template = internalEmailTemplateSchema.parse({ version: 1, key: "example-email", description: "Demo",
  variables: [{ key: "headline", label: "Titular", kind: "text", example: "Una idea" }, { key: "image_url", label: "Imagen", kind: "image", example: "/marketing-demo/orbita-lamp.png" }, { key: "cta_url", label: "Enlace", kind: "url", example: "https://example.com/producto" }, { key: "accent", label: "Color", kind: "color", example: "#5522bb" }] });
test("renders replaceable content safely without changing template markup", () => {
  assert.equal(renderInternalEmailTemplate('<h1>{{headline}}</h1><img src="{{image_url}}"><a href="{{cta_url}}" style="color:{{accent}}">Ver</a>', template, { headline: '<img onerror="alert(1)">' }), '<h1>&lt;img onerror=&quot;alert(1)&quot;&gt;</h1><img src="/marketing-demo/orbita-lamp.png"><a href="https://example.com/producto" style="color:#5522bb">Ver</a>');
});
test("rejects executable URLs, CSS injection, missing slots and duplicate keys", () => {
  for (const value of ["javascript:alert(1)", "data:image/svg+xml,bad", "https://user:pass@example.com"]) assert.throws(() => renderInternalEmailTemplate('{{cta_url}}', template, { cta_url: value }));
  assert.throws(() => renderInternalEmailTemplate('{{accent}}', template, { accent: '#fff;background:url(x)' }));
  assert.throws(() => renderInternalEmailTemplate('{{unknown}}', template));
  assert.equal(internalEmailTemplateSchema.safeParse({ ...template, variables: [...template.variables, template.variables[0]] }).success, false);
});
