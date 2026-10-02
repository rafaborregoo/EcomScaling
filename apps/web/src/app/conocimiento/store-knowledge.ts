"use client";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { toast } from "@/components/ui";

// Datos y llamadas compartidas entre el cuestionario (wizard paso a paso) y
// el perfil de la tienda (el mismo conocimiento visto como un documento
// unico). Cada respuesta se guarda como un documento de conocimiento normal
// -- mismo endpoint que "Añadir documento" -- identificado por el prefijo del
// titulo. Reeditar una respuesta ya guardada hace PATCH sobre ese documento
// en vez de crear uno nuevo, así que no se acumulan duplicados con el mismo
// título.

export type StoreQuestionType = "text" | "textarea" | "number";

export type StoreQuestion = {
  id: string;
  question: string;
  type: StoreQuestionType;
  /** Unidad mostrada junto al input numerico ("%", "€", "días"...). */
  unit?: string;
  placeholder?: string;
  /** Para qué usa el copiloto esta respuesta. Texto fijo; no promete cálculos. */
  why?: string;
  /** Ejemplo de buena respuesta, solo orientativo. */
  example?: string;
};

export type StoreQuestionCategory = {
  id: string;
  label: string;
  questions: StoreQuestion[];
};

export const QUESTIONNAIRE_PREFIX = "Cuestionario: ";

export const STORE_QUESTION_CATEGORIES: StoreQuestionCategory[] = [
  {
    id: "negocio",
    label: "Negocio",
    questions: [
      {
        id: "vision",
        question: "¿Qué vendéis y quién es vuestro cliente objetivo?",
        type: "textarea",
      },
      {
        id: "objetivo",
        question: "¿Cuál es el objetivo de negocio más importante ahora mismo?",
        type: "textarea",
      },
      {
        id: "ticket_medio",
        question: "¿Cuál es vuestro ticket medio objetivo?",
        type: "number",
        unit: "€",
      },
      {
        id: "pedidos_mes",
        question: "¿Cuántos pedidos hacéis de media al mes?",
        type: "number",
        unit: "pedidos",
      },
    ],
  },
  {
    id: "producto",
    label: "Producto y catálogo",
    questions: [
      {
        id: "categoria_principal",
        question: "¿Cuál es vuestra categoría de producto principal?",
        type: "text",
      },
      {
        id: "skus",
        question: "¿Cuántas referencias (SKUs) tenéis activas?",
        type: "number",
        unit: "SKUs",
      },
      {
        id: "productos_estrella",
        question:
          "¿Hay productos que nunca deberían quedarse sin stock?",
        type: "textarea",
      },
      {
        id: "temporada",
        question: "¿Cuándo son vuestras temporadas altas y bajas?",
        type: "textarea",
      },
    ],
  },
  {
    id: "marca",
    label: "Cliente y marca",
    questions: [
      {
        id: "tono_marca",
        question: "¿Cómo describirías el tono y los valores de la marca?",
        type: "textarea",
      },
      {
        id: "competencia",
        question: "¿Quiénes son vuestros principales competidores?",
        type: "textarea",
      },
      {
        id: "diferenciacion",
        question: "¿Qué os diferencia de la competencia?",
        type: "textarea",
      },
      {
        id: "lineas_rojas_marca",
        question: "¿Hay algo que la marca nunca diría o haría?",
        type: "textarea",
      },
    ],
  },
  {
    id: "comercial",
    label: "Precios y comercial",
    questions: [
      {
        id: "margen_minimo",
        question: "¿Cuál es el margen mínimo que nunca debería bajar?",
        type: "number",
        unit: "%",
      },
      {
        id: "descuentos_prohibidos",
        question:
          "¿Hay descuentos o promociones que no debamos proponer nunca?",
        type: "textarea",
      },
      {
        id: "envio_gratis_desde",
        question: "¿A partir de qué importe ofrecéis envío gratis?",
        type: "number",
        unit: "€",
      },
      {
        id: "cac_maximo",
        question: "¿Cuál es el coste de adquisición (CAC) máximo aceptable?",
        type: "number",
        unit: "€",
      },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    questions: [
      {
        id: "envios_devoluciones",
        question: "¿Cuál es vuestra política de envíos y devoluciones?",
        type: "textarea",
      },
      {
        id: "dias_envio",
        question: "¿Cuántos días tardáis en enviar un pedido de media?",
        type: "number",
        unit: "días",
      },
      {
        id: "atencion_cliente",
        question: "¿Quién atiende al cliente y por qué canal?",
        type: "textarea",
      },
      {
        id: "decisiones",
        question: "¿Quién toma las decisiones de marketing y presupuesto?",
        type: "textarea",
      },
    ],
  },
];

const QUESTION_HINTS: Record<string, { why: string; example: string }> = {
  vision: { why: "Es lo primero que lee el copiloto antes de proponerte nada.", example: "Menaje y textil de hogar de diseño mediterráneo. Cliente: mujer de 30 a 50 años que amuebla su primera casa en propiedad." },
  objetivo: { why: "Ordena sus prioridades: no te propondrá crecer a cualquier precio si lo que toca es rentabilizar.", example: "Subir la recompra del 18 % al 25 % antes de diciembre sin bajar margen." },
  ticket_medio: { why: "Para juzgar si una promoción o un pack sube o baja el pedido medio.", example: "65" },
  pedidos_mes: { why: "Le da escala: 10 pedidos más no significan lo mismo con 50 que con 5.000 al mes.", example: "420" },
  categoria_principal: { why: "Para compararte con tiendas parecidas y hablar en tu idioma.", example: "Vajilla de cerámica" },
  skus: { why: "Cambia el consejo: con 20 referencias se cuida cada ficha, con 2.000 se trabaja por reglas.", example: "340" },
  productos_estrella: { why: "Los vigilará primero cuando hable de stock y reposición.", example: "Plato llano Alba 27 cm y el juego de 6 vasos Ola: son la entrada del 40 % de clientes nuevos." },
  temporada: { why: "Para no leer una caída de temporada como un problema.", example: "Alta: noviembre-diciembre y mayo (bodas). Baja: enero-febrero y agosto." },
  tono_marca: { why: "Lo aplica en cada asunto y texto de email que redacta.", example: "Cercano y tranquilo, de tú. Nada de urgencias falsas ni mayúsculas. Valores: hecho a mano, durar años." },
  competencia: { why: "Para comparar precios y mensajes con quien de verdad compites.", example: "Sargadelos en gama alta, Zara Home en precio y talleres pequeños de Instagram." },
  diferenciacion: { why: "Es el argumento que pondrá en anuncios y emails.", example: "Cerámica hecha en Manises con reposición de piezas sueltas durante 10 años." },
  lineas_rojas_marca: { why: "Lo que nunca escribirá en tu nombre.", example: "Nunca «últimas unidades» si no es verdad. Nunca comparar con marcas por su nombre." },
  margen_minimo: { why: "Es el límite que tendrá presente al proponerte promociones y precios.", example: "35" },
  descuentos_prohibidos: { why: "Los descartará antes de sugerirte campañas.", example: "Nada de descuentos sitewide de más del 15 %. Black Friday solo con packs, nunca con cupón." },
  envio_gratis_desde: { why: "Para proponer packs y ventas cruzadas que lleguen a ese importe.", example: "60" },
  cac_maximo: { why: "Para decirte si una campaña de captación compensa.", example: "22" },
  envios_devoluciones: { why: "Para redactar emails posventa y responder dudas sin inventar condiciones.", example: "Envío 24-72 h en península. Devolución gratuita 30 días salvo piezas personalizadas." },
  dias_envio: { why: "Para fijar promesas de entrega realistas en campañas con fecha.", example: "2" },
  atencion_cliente: { why: "Para saber a dónde mandar a un cliente en cada email.", example: "Lucía, por WhatsApp y email, de lunes a viernes de 9 a 15 h." },
  decisiones: { why: "Para dirigir cada propuesta a quien la puede aprobar.", example: "Marta (fundadora) aprueba presupuesto; Pablo lleva Meta y Klaviyo." },
};

export const STORE_QUESTIONS = STORE_QUESTION_CATEGORIES.flatMap((category) =>
  category.questions.map((question) => ({
    ...question,
    ...QUESTION_HINTS[question.id],
    categoryId: category.id,
    categoryLabel: category.label,
  })),
);

export function questionDocumentTitle(question: { question: string }) {
  return QUESTIONNAIRE_PREFIX + question.question;
}

export type AnsweredDoc = { id: string; title: string; created_at: string; updated_at?: string };

/**
 * El documento mas reciente por titulo. Desde que reeditar hace PATCH ya no
 * se acumulan duplicados, pero un documento contestado antes de tener PATCH
 * puede seguir teniendo mas de uno con el mismo titulo -- esto decide cual
 * de los dos es la respuesta vigente.
 */
export function latestByTitle(documents: AnsweredDoc[]): Map<string, AnsweredDoc> {
  const map = new Map<string, AnsweredDoc>();
  for (const document of documents) {
    const current = map.get(document.title);
    if (!current || document.created_at > current.created_at) {
      map.set(document.title, document);
    }
  }
  return map;
}

export async function fetchDocumentContent(
  organizationId: string,
  documentId: string,
): Promise<string | null> {
  try {
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/knowledge/documents/${documentId}`,
    );
    if (!response.ok) {
      toast.danger(await readApiError(response));
      return null;
    }
    const payload = (await response.json()) as {
      document: { content: string | null };
    };
    return payload.document.content ?? "";
  } catch {
    toast.danger("No se pudo cargar la respuesta por un error de red.");
    return null;
  }
}

export async function saveAnswer(
  organizationId: string,
  existingDocumentId: string | undefined,
  title: string,
  content: string,
): Promise<boolean> {
  try {
    const response = existingDocumentId
      ? await apiFetch(
          `/v1/organizations/${organizationId}/knowledge/documents/${existingDocumentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        )
      : await apiFetch(
          `/v1/organizations/${organizationId}/knowledge/documents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              content,
              source_type: "manual",
              audience: "client_visible",
            }),
          },
        );
    if (!response.ok) {
      toast.danger(await readApiError(response));
      return false;
    }
    toast.success(existingDocumentId ? "Respuesta actualizada" : "Respuesta guardada");
    return true;
  } catch {
    toast.danger("No se pudo guardar la respuesta por un error de red.");
    return false;
  }
}
