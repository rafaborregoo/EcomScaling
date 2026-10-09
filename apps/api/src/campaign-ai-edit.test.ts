import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_EDITS_PER_ITEM_PER_DAY,
  CAMPAIGN_EDITOR_GUIDANCE,
  aiEditAccessDecision,
  aiEditLimitExceeded,
  allowedFieldsFor,
  editorOutputContract,
  editsToDraftPatch,
  normalizeProposedEdits,
  proposalResolution,
  type EditorOutput,
} from "./campaign-ai-edit.js";

const current = {
  subject: "Oferta del puente: 20 % en tu cesta de otoño, solo hasta el domingo por la noche",
  preheader: "Solo este fin de semana",
  body: "<p>Hola</p>",
  starts_at: "2026-10-11T08:00:00.000Z",
};

test("campos editables: el email no toca el creativo y una campaña sin pieza solo mueve la fecha", () => {
  assert.deepEqual(allowedFieldsFor("email"), ["subject", "preheader", "body", "starts_at"]);
  assert.ok(allowedFieldsFor("meta").includes("headline"));
  assert.ok(!allowedFieldsFor("meta").includes("subject"));
  assert.deepEqual(allowedFieldsFor("none"), ["starts_at"]);
});

test("propuestas: el 'antes' lo pone el servidor, no el modelo, y se descartan los cambios que no cambian nada", () => {
  const output: EditorOutput = {
    answer: "He acortado el asunto.",
    edits: [
      { field: "subject", now: "20 % en tu cesta de otoño, hasta el domingo", why: "Cabe en móvil." },
      { field: "preheader", now: "Solo este fin de semana", why: "Igual que antes." },
      { field: "headline", now: "Titular de Meta", why: "No es campo de un email." },
      { field: "subject", now: "Otro asunto repetido", why: "Repetido." },
    ],
  };
  const edits = normalizeProposedEdits(output, "email", current);
  assert.equal(edits.length, 1);
  assert.equal(edits[0]?.field, "subject");
  assert.equal(edits[0]?.was, current.subject);
  assert.equal(edits[0]?.label, "Asunto");
  assert.equal(edits[0]?.state, "open");
});

test("propuestas: una fecha no valida o un enlace sin protocolo no pasan", () => {
  const output: EditorOutput = {
    answer: "ok",
    edits: [
      { field: "starts_at", now: "mañana por la tarde", why: "x" },
      { field: "destination_url", now: "huertanorte.es/cesta", why: "x" },
    ],
  };
  assert.deepEqual(normalizeProposedEdits(output, "meta", { ...current, destination_url: "" }), []);
  const good = normalizeProposedEdits(
    { answer: "ok", edits: [{ field: "starts_at", now: "2026-10-12T08:00:00Z", why: "Puente" }] },
    "email",
    current,
  );
  assert.equal(good[0]?.field, "starts_at");
});

test("de propuesta a PATCH de la pieza: el email lleva su texto plano; Meta usa sus propios campos", () => {
  assert.deepEqual(editsToDraftPatch("email", [{ field: "subject", now: "Nuevo asunto" }]), { subject: "Nuevo asunto" });
  const body = editsToDraftPatch("email", [{ field: "body", now: "<p>Hola <b>mundo</b></p>" }]);
  assert.equal(body.html, "<p>Hola <b>mundo</b></p>");
  assert.match(String(body.plain_text), /Hola/);
  assert.deepEqual(
    editsToDraftPatch("meta", [
      { field: "headline", now: "Cesta −20 %" },
      { field: "destination_url", now: "https://huertanorte.es/cesta" },
    ]),
    { headline: "Cesta −20 %", destination_url: "https://huertanorte.es/cesta" },
  );
  // La fecha no es un campo de la pieza: va por el calendario.
  assert.deepEqual(editsToDraftPatch("email", [{ field: "starts_at", now: "2026-10-12T08:00:00Z" }]), {});
});

test("la propuesta se cierra cuando no queda nada por decidir", () => {
  assert.equal(proposalResolution([{ state: "open" }, { state: "applied" }]), null);
  assert.equal(proposalResolution([{ state: "applied" }, { state: "dismissed" }]), "applied");
  assert.equal(proposalResolution([{ state: "dismissed" }]), "dismissed");
});

test("limite diario de propuestas por campaña", () => {
  assert.equal(aiEditLimitExceeded(AI_EDITS_PER_ITEM_PER_DAY - 1), false);
  assert.equal(aiEditLimitExceeded(AI_EDITS_PER_ITEM_PER_DAY), true);
});

test("acceso: el staff edita todo; el cliente con consultor solo lo que creó; sin consultor, lo suyo y lo visible", () => {
  const own = { origin: "client", created_by: "u1" };
  const foreign = { origin: "staff", created_by: "u2" };
  assert.equal(aiEditAccessDecision({ actor: "consultant", clientHasConsultant: true, item: foreign, userId: "u1" }), true);
  assert.equal(aiEditAccessDecision({ actor: "client", clientHasConsultant: true, item: own, userId: "u1" }), true);
  assert.equal(aiEditAccessDecision({ actor: "client", clientHasConsultant: true, item: foreign, userId: "u1" }), false);
  assert.equal(aiEditAccessDecision({ actor: "client", clientHasConsultant: true, item: { origin: "client", created_by: "u3" }, userId: "u1" }), false);
  assert.equal(aiEditAccessDecision({ actor: "client", clientHasConsultant: false, item: foreign, userId: "u1" }), true);
});

test("contrato de salida: campos cerrados, sin texto libre fuera de answer/why", () => {
  const contract = editorOutputContract();
  const schema = contract.jsonSchema as {
    required: string[];
    properties: { edits: { items: { properties: { field: { enum: string[] } } } } };
  };
  assert.deepEqual(schema.required, ["answer", "edits"]);
  assert.ok(schema.properties.edits.items.properties.field.enum.includes("subject"));
  const ok = contract.schema.safeParse({ answer: "Listo", edits: [{ field: "subject", now: "x", why: "y" }] });
  assert.equal(ok.success, true);
  assert.equal(contract.schema.safeParse({ answer: "Listo", edits: [{ field: "inventado", now: "x", why: "y" }] }).success, false);
  assert.equal(contract.schema.safeParse({ answer: "", edits: [] }).success, false);
});

test("la guia dice que la IA propone y no escribe, y que no inventa ofertas", () => {
  assert.match(CAMPAIGN_EDITOR_GUIDANCE, /nada se escribe hasta que una persona las aplica/);
  assert.match(CAMPAIGN_EDITOR_GUIDANCE, /no inventes ofertas, plazos, precios ni datos/);
});
