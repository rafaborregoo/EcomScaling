/**
 * Campos de personalización de una plantilla de email.
 *
 * Un token es texto que Klaviyo sustituye al enviar: en el editor se ve
 * `{{first_name}}` y en la bandeja del cliente pone su nombre. Por eso se
 * insertan desde una lista cerrada y no se escriben a mano — un token mal
 * escrito no da error en ningún sitio, simplemente llega literal al email de
 * un cliente real.
 */
import type { TemplateBlock, TemplateDesign } from "./template-design";

export type MergeField = {
  /** Nombre del token tal y como se declara en `personalization_tokens`. */
  name: string;
  label: string;
  /** Lo que se escribe en la plantilla. */
  token: string;
  /** Qué se ve si el contacto no tiene ese dato. */
  hint: string;
};

export const MERGE_FIELDS: MergeField[] = [
  {
    name: "first_name",
    label: "Nombre de pila",
    token: "{{first_name}}",
    hint: "Vacío si el contacto no tiene nombre guardado.",
  },
  {
    name: "last_name",
    label: "Apellido",
    token: "{{last_name}}",
    hint: "Vacío si el contacto no tiene apellido guardado.",
  },
  {
    name: "email",
    label: "Email del contacto",
    token: "{{email}}",
    hint: "Siempre existe: es la clave del perfil.",
  },
  {
    name: "organization.name",
    label: "Nombre de la tienda",
    token: "{{organization.name}}",
    hint: "El que tengas puesto en la cuenta de Klaviyo.",
  },
  {
    name: "location.city",
    label: "Ciudad del contacto",
    token: "{{location.city}}",
    hint: "Vacío si Klaviyo no ha podido ubicarlo.",
  },
];

/** Bloques donde tiene sentido meter un token: los que llevan texto. */
function hasText(
  block: TemplateBlock | undefined,
): block is Extract<TemplateBlock, { text: string }> {
  return (
    block !== undefined &&
    (block.type === "heading" || block.type === "text" || block.type === "button")
  );
}

/**
 * Mete el token al final del bloque seleccionado.
 *
 * Al final y no en el cursor: el lienzo es un iframe de origen opaco y la
 * posición del cursor no sale de ahí. Insertar al final es predecible y se
 * arrastra a su sitio escribiendo encima, que es como ya se edita el texto.
 *
 * Devuelve `null` cuando no hay dónde meterlo (sin bloque, o un bloque sin
 * texto como una imagen): quien llama decide qué hacer, normalmente mandarlo
 * al asunto.
 *
 * ponytail: inserción al final del bloque. Si hiciera falta insertar en el
 * cursor, hay que mandar la orden al iframe y aplicarla con Selection allí.
 */
export function insertMergeField(
  design: TemplateDesign,
  selectedId: string | null,
  token: string,
): TemplateDesign | null {
  if (!selectedId) return null;
  const block = design.blocks.find((entry) => entry.id === selectedId);
  if (!hasText(block)) return null;

  // Un espacio delante salvo que el texto ya termine en uno: sin esto, el
  // token se pega a la última palabra.
  const text = block.text
    ? `${block.text}${block.text.endsWith(" ") ? "" : " "}${token}`
    : token;

  return {
    ...design,
    blocks: design.blocks.map((entry) =>
      entry.id === selectedId ? ({ ...entry, text } as TemplateBlock) : entry,
    ),
  };
}

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|[^}]*)?\}\}/g;

/**
 * Qué tokens usa de verdad la plantilla, leídos del contenido y no de lo que
 * alguien haya declarado a mano.
 *
 * El borrador declara sus `personalization_tokens` y el consultor los revisa
 * antes de aprobar; si la lista se rellenara a mano acabaría mintiendo en
 * cuanto alguien editara un texto.
 */
export function collectMergeTokens(...content: string[]): string[] {
  const found = new Set<string>();
  for (const text of content) {
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      found.add(match[1]);
    }
  }
  return [...found].sort();
}
