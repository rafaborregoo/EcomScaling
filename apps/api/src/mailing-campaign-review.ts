/**
 * ADR-0025: revision automatica (codigo, sin modelo) de un borrador de A11
 * dentro de la campaña de mailing. Sustituye al "A26 audita" del diseño
 * inicial: A26 audita emails ya enviados y no entra en el grafo.
 *
 * Solo comprueba lo verificable sin juicio: enlaces, campos personalizados de
 * Klaviyo, textos literales pedidos y longitud del asunto. Lo que deja pasar
 * lo sigue viendo una persona antes de aprobar.
 */

export const MAILING_SUBJECT_MAX_CHARS = 60;
/** Lo que los clientes de correo muestran del preheader antes de cortarlo. */
export const MAILING_PREHEADER_MAX_CHARS = 140;

export type MailingReviewDraft = {
  subject: string | null;
  preheader?: string | null;
  html: string | null;
  plain_text: string | null;
  verbatim_texts?: readonly string[] | null;
};

export type MailingReviewResult = { passed: boolean; reasons: string[] };

// Enlaces que no son llamada a la accion: baja y preferencias.
const NON_CTA_HREF = /unsubscribe|manage[_-]?preferences|\bpreferences\b|opt[_-]?out/i;

const KLAVIYO_PERSON_FIELD = /^(first_name|last_name|person\.|email|phone_number|location\.)/;

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

export function reviewMailingDraft(draft: MailingReviewDraft): MailingReviewResult {
  const reasons: string[] = [];
  const subject = (draft.subject ?? "").trim();
  const html = draft.html ?? "";
  const body = `${subject}\n${html}\n${draft.plain_text ?? ""}`;

  if (!subject) reasons.push("El asunto está vacío.");
  else if (subject.length > MAILING_SUBJECT_MAX_CHARS) {
    reasons.push(`El asunto tiene ${subject.length} caracteres; el máximo es ${MAILING_SUBJECT_MAX_CHARS}.`);
  }

  const preheader = (draft.preheader ?? "").trim();
  if (!preheader) reasons.push("El preheader está vacío.");
  else if (preheader.length > MAILING_PREHEADER_MAX_CHARS) {
    reasons.push(`El preheader tiene ${preheader.length} caracteres; el máximo es ${MAILING_PREHEADER_MAX_CHARS}.`);
  }

  // Enlaces: cada href tiene que llevar a algun sitio real, y al menos uno
  // distinto del de baja (solo "darse de baja" no es llamada a la accion).
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)].map((match) => match[1]!.trim());
  if (!hrefs.some((href) => !NON_CTA_HREF.test(href))) {
    reasons.push("El email no tiene ningún enlace: la llamada a la acción no lleva a ningún sitio.");
  }
  for (const href of hrefs) {
    if (/^\{\{.*\}\}$|^\{%.*%\}$/.test(href)) continue; // URL de Klaviyo resuelta al enviar
    if (!href || href === "#" || /^javascript:/i.test(href)) {
      reasons.push(`Hay un enlace sin destino útil ("${href || "vacío"}").`);
    } else if (/^mailto:|^tel:/i.test(href)) {
      continue;
    } else if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(href)) {
      reasons.push(`El enlace "${href.slice(0, 120)}" no es una URL absoluta.`);
    } else if (/\b(example\.(com|org)|tu-?tienda|tudominio|url-aqui)\b/i.test(href)) {
      reasons.push(`El enlace "${href.slice(0, 120)}" es un marcador de ejemplo.`);
    }
  }

  // Campos personalizados: etiquetas cerradas y con valor por defecto.
  const opens = (body.match(/\{\{/g) ?? []).length;
  const closes = (body.match(/\}\}/g) ?? []).length;
  if (opens !== closes) reasons.push("Hay un campo personalizado sin cerrar ({{ … }}).");
  if ((body.match(/\{%/g) ?? []).length !== (body.match(/%\}/g) ?? []).length) {
    reasons.push("Hay una etiqueta de Klaviyo sin cerrar ({% … %}).");
  }
  for (const match of body.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
    const expression = match[1]!;
    if (KLAVIYO_PERSON_FIELD.test(expression) && !/\|\s*default\s*:/.test(expression)) {
      reasons.push(`El campo "{{ ${expression} }}" no tiene valor por defecto: saldría vacío a quien no lo tenga.`);
    }
  }
  if (/\[(nombre|first[_ ]name|producto|enlace|link)\]|\bX{3,}\b|[€$]\s?XX\b|\bXX\s?(%|€|euros)|lorem ipsum/i.test(body)) {
    reasons.push("Quedan marcadores sin rellenar ([nombre], XXX, lorem ipsum…).");
  }

  // Textos literales pedidos por el consultor.
  const haystack = normalize(`${subject} ${stripTags(html)} ${draft.plain_text ?? ""}`);
  for (const text of draft.verbatim_texts ?? []) {
    if (text.trim() && !haystack.includes(normalize(text))) {
      reasons.push(`Falta el texto literal pedido: "${text.trim().slice(0, 120)}".`);
    }
  }

  const unique = [...new Set(reasons)].slice(0, 20);
  return { passed: unique.length === 0, reasons: unique };
}
