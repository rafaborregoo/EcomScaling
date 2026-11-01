import test from "node:test";
import assert from "node:assert/strict";
import { buildA26ContentOutputContract } from "./index.js";

const message = { message_id: "123e4567-e89b-42d3-a456-426614174000", account_id: "123e4567-e89b-42d3-a456-426614174001", content_hash: "a".repeat(64), asunto: "Una promesa", preheader: "Detalles", cuerpo: "Compra con calma", enlaces: [] };
const review = { review_ref: "review-1", message_id: message.message_id, account_id: message.account_id, content_hash: message.content_hash, dimension: "body", claim_type: "editorial_hypothesis", confidence: "medium", quote: "con calma", observation: "La llamada es ambigua", limitation: "No hay entrega individual", permitted_change: "Precisar la llamada", acceptance_criterion: "Indicar destino concreto", destination: "a11" };
const output = { content_decision: "revision_proposal", answer: "Diagnóstico editorial", findings: [], recommendations: [], sources: [], proposed_writes: [], approval_required: true, confidence: "medium", warnings: [], content_reviews: [review] };

test("A26 retains diagnosis even without tasks and requires evidence-linked reviews", () => {
  const contract = buildA26ContentOutputContract([message]);
  assert.equal(contract.schema.parse(output).answer, output.answer);
  assert.equal(contract.schema.safeParse({ ...output, content_decision: "no_change", content_reviews: [] }).success, true);
  assert.equal(contract.schema.safeParse({ ...output, content_decision: "needs_evidence", content_reviews: [] }).success, true);
  assert.equal(contract.schema.safeParse({ ...output, content_reviews: [] }).success, false);
  const required = contract.jsonSchema.required as string[];
  for (const key of ["answer", "findings", "recommendations", "content_reviews"]) assert.ok(required.includes(key));
  assert.equal(contract.schema.safeParse({ ...output, content_reviews: [{ ...review, message_id: message.account_id }] }).success, false);
  assert.equal(contract.schema.safeParse({ ...output, content_reviews: [{ ...review, content_hash: "b".repeat(64) }] }).success, false);
  assert.equal(contract.schema.safeParse({ ...output, content_reviews: [{ ...review, quote: "cita inventada" }] }).success, false);
});

test("A26 validates claim dimensions and exact tool quotes", () => {
  assert.equal(buildA26ContentOutputContract([message]).schema.safeParse({ ...output, content_reviews: [{ ...review, quote: null, dimension: "visual" }] }).success, false);
  assert.equal(buildA26ContentOutputContract([{ ...message, quote_sources: ["El centro recuperado"] }]).schema.safeParse({ ...output, content_reviews: [{ ...review, quote: "centro recuperado" }] }).success, true);
  assert.equal(buildA26ContentOutputContract([message]).schema.safeParse({ ...output, content_reviews: [{ ...review, quote: null }] }).success, false);
});

test("A26 rejects unlinked tasks and incomplete Camino identity", () => {
  const write = { kind: "task", title: "Precisar CTA", description: "Corregir pieza", priority: "medium", review_ref: "review-1" };
  const contract = buildA26ContentOutputContract([message]);
  assert.equal(contract.schema.safeParse({ ...output, proposed_writes: [write] }).success, true);
  assert.equal(contract.schema.safeParse({ ...output, proposed_writes: [{ ...write, review_ref: "inventada" }] }).success, false);
  assert.equal(contract.schema.safeParse({ ...output, proposed_writes: [{ ...write, plan_id: message.account_id }] }).success, false);
});
