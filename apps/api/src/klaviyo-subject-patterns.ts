/**
 * Que rasgos del asunto se asocian con mas apertura, desde
 * `klaviyo_subject_performance`. Es una comparacion descriptiva entre envios
 * de la propia cuenta, no un test: por eso cada rasgo lleva cuantos envios hay
 * a cada lado, y no se da ganador con menos de MIN_EMAILS_PER_SIDE.
 *
 * Tasas ponderadas por entregados (suma de aperturas / suma de entregados), no
 * media de tasas: un envio de 50 personas no pesa lo mismo que uno de 50.000.
 */

export type KlaviyoSubjectRow = {
  subject: string | null;
  subject_chars: number | null;
  has_emoji: boolean | null;
  is_question: boolean | null;
  has_number: boolean | null;
  has_personalization: boolean | null;
  delivered: number | string | null;
  opens_unique: number | string | null;
  clicks_unique: number | string | null;
};

export type SubjectTraitComparison = {
  trait: "emoji" | "pregunta" | "numero" | "personalizacion" | "corto";
  label: string;
  with_emails: number;
  without_emails: number;
  with_open_rate: number | null;
  without_open_rate: number | null;
  /** null si algun lado tiene menos envios de los necesarios. */
  better: "con" | "sin" | null;
};

export const MIN_EMAILS_PER_SIDE = 3;
const SHORT_SUBJECT_CHARS = 40;

const TRAITS: Array<{ trait: SubjectTraitComparison["trait"]; label: string; test: (r: KlaviyoSubjectRow) => boolean | null }> = [
  { trait: "emoji", label: "Con emoji", test: (r) => r.has_emoji },
  { trait: "pregunta", label: "En forma de pregunta", test: (r) => r.is_question },
  { trait: "numero", label: "Con un número", test: (r) => r.has_number },
  { trait: "personalizacion", label: "Personalizado ({{ nombre }})", test: (r) => r.has_personalization },
  { trait: "corto", label: `Corto (≤ ${SHORT_SUBJECT_CHARS} caracteres)`, test: (r) => (r.subject_chars == null ? null : r.subject_chars <= SHORT_SUBJECT_CHARS) },
];

function openRate(rows: KlaviyoSubjectRow[]): number | null {
  const delivered = rows.reduce((sum, r) => sum + Number(r.delivered ?? 0), 0);
  if (delivered <= 0) return null;
  return rows.reduce((sum, r) => sum + Number(r.opens_unique ?? 0), 0) / delivered;
}

export function summariseSubjectTraits(rows: KlaviyoSubjectRow[]): SubjectTraitComparison[] {
  const sent = rows.filter((r) => r.subject && Number(r.delivered ?? 0) > 0);
  return TRAITS.map(({ trait, label, test }) => {
    const withTrait = sent.filter((r) => test(r) === true);
    const withoutTrait = sent.filter((r) => test(r) === false);
    const withRate = openRate(withTrait);
    const withoutRate = openRate(withoutTrait);
    const enough = withTrait.length >= MIN_EMAILS_PER_SIDE && withoutTrait.length >= MIN_EMAILS_PER_SIDE;
    return {
      trait,
      label,
      with_emails: withTrait.length,
      without_emails: withoutTrait.length,
      with_open_rate: withRate,
      without_open_rate: withoutRate,
      better: enough && withRate !== null && withoutRate !== null && withRate !== withoutRate ? (withRate > withoutRate ? "con" : "sin") : null,
    };
  });
}
