import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_EMAILS_PER_SIDE, summariseSubjectTraits, type KlaviyoSubjectRow } from "./klaviyo-subject-patterns.js";

const row = (over: Partial<KlaviyoSubjectRow>): KlaviyoSubjectRow => ({
  subject: "Nueva coleccion", subject_chars: 15, has_emoji: false, is_question: false, has_number: false,
  has_personalization: false, delivered: 1000, opens_unique: 300, clicks_unique: 20, ...over,
});

test("la apertura se pondera por entregados, no es la media de tasas", () => {
  const rows = [
    ...Array.from({ length: MIN_EMAILS_PER_SIDE }, () => row({ has_emoji: true, delivered: 100, opens_unique: 50 })),
    row({ has_emoji: true, delivered: 10000, opens_unique: 1000 }),
    ...Array.from({ length: MIN_EMAILS_PER_SIDE }, () => row({ delivered: "1000", opens_unique: "300" })),
  ];
  const emoji = summariseSubjectTraits(rows).find((t) => t.trait === "emoji")!;
  assert.equal(emoji.with_emails, MIN_EMAILS_PER_SIDE + 1);
  assert.ok(Math.abs(emoji.with_open_rate! - 1150 / 10300) < 1e-9);
  assert.equal(emoji.better, "sin");
});

test("sin envios suficientes a cada lado no hay ganador", () => {
  const rows = [row({ is_question: true, opens_unique: 900 }), row({}), row({}), row({})];
  const pregunta = summariseSubjectTraits(rows).find((t) => t.trait === "pregunta")!;
  assert.equal(pregunta.better, null);
  assert.ok(pregunta.with_open_rate! > pregunta.without_open_rate!);
});

test("los envios sin entregas ni asunto no cuentan", () => {
  const traits = summariseSubjectTraits([row({ delivered: 0 }), row({ subject: null })]);
  assert.ok(traits.every((t) => t.with_emails === 0 && t.without_emails === 0));
});
