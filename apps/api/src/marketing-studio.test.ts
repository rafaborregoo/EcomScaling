import assert from "node:assert/strict";
import { test } from "node:test";

import { fillKlaviyoTags, studioDraftFields, studioPieceSchema } from "./marketing-studio.js";

const base = {
  channel: "email",
  name: "Lino verano",
  subject: "Ya está aquí",
  design: { version: 2, blocks: [] },
  html: '<table><tr><td onclick="x()">Hola<script>alert(1)</script></td></tr></table>',
};

test("studioDraftFields limpia el HTML y mapea el canal", () => {
  const email = studioDraftFields(studioPieceSchema.parse(base));
  assert.equal(email.ok, true);
  if (!email.ok) return;
  assert.doesNotMatch(String(email.fields.html), /script|onclick/);
  assert.equal(email.fields.content_type, "campaign");
  assert.equal((email.fields.request_patch as { channel: string }).channel, "email_klaviyo");

  const popup = studioDraftFields(studioPieceSchema.parse({ ...base, channel: "popup" }));
  assert.equal(popup.ok && popup.fields.content_type, "popup");

  const meta = studioDraftFields(studioPieceSchema.parse({ ...base, channel: "meta" }));
  assert.equal(meta.ok && (meta.fields.request_patch as { channel: string }).channel, "meta_ads");
});

test("studioDraftFields rechaza reply-to inválido, diseño viejo y HTML vacío", () => {
  const replyTo = studioDraftFields(studioPieceSchema.parse({ ...base, reply_to: "no-es-email" }));
  assert.equal(!replyTo.ok && replyTo.error, "reply_to_invalido");
  const version = studioDraftFields(studioPieceSchema.parse({ ...base, design: { version: 1 } }));
  assert.equal(!version.ok && version.error, "studio_design_version_invalid");
  const empty = studioDraftFields(studioPieceSchema.parse({ ...base, html: "<script></script>" }));
  assert.equal(!empty.ok && empty.error, "diseno_vacio");
});

test("studioPieceSchema no admite campos de más", () => {
  assert.equal(studioPieceSchema.safeParse({ ...base, status: "approved" }).success, false);
});

test("fillKlaviyoTags sustituye etiquetas y campos para la prueba", () => {
  const html = fillKlaviyoTags(
    `Hola {{ first_name|default:"amiga" }} de {{ location.city }} · {{ organization.name }} · {{ person.raro|default:'x' }} {% unsubscribe 'Baja' %} {% manage_preferences %} {% if x %}`,
    "Casa Brava",
  );
  assert.equal(
    html,
    'Hola Lucía de Valencia · Casa Brava · x <a href="#" style="color:inherit">Baja</a> <a href="#" style="color:inherit">Preferencias</a> ',
  );
});
