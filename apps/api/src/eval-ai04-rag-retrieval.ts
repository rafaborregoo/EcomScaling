/**
 * AI-04/DB-11: "conseguir VOYAGE_API_KEY de un entorno de prueba y correr
 * retrieval real antes de invertir en chunking estructural o busqueda
 * hibrida" era la siguiente accion explicita de AI-04, y el dataset de
 * recall@k/precision de citas era un gap abierto de DB-11. Este entorno ya
 * tiene `VOYAGE_API_KEY` configurada en `.env.local` -- primera vez que
 * `search_knowledge` corre contra embeddings reales (Voyage `voyage-3.5`) en
 * vez de quedar bloqueado por falta de la key.
 *
 * Metodologia: se ingestan 6 documentos de metodologia E-NORA
 * (organization-scoped) via `createKnowledgeDocument`, y se prueban preguntas
 * individuales y preguntas que necesitan dos documentos. Las etiquetas son
 * documentales, por lo que los chunks de un mismo documento se deduplican
 * antes de calcular P@1, P@3, R@3, R@8 y MRR. Es una prueba sintetica de
 * retrieval, no una evaluacion de respuestas del copiloto ni del corpus real.
 * Hay ademas una consulta "distractor" sobre un tema no cubierto
 * por ningun documento, solo informativa (no hay umbral de similitud
 * absoluto validado todavia contra el que juzgar un "no deberia encontrar
 * nada" con confianza).
 *
 * Cuesta llamadas reales a la API de Voyage (dinero, minimo) -- no correr en
 * cada PR. Ejecutar manualmente con `npm run eval:ai04 -w @e-nora/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { createKnowledgeDocument, searchKnowledge } from "./knowledge.js";
import { scoreRetrievalAtK } from "./rag-retrieval-metrics.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-ai04-rag-retrieval");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;

type Document = { key: string; title: string; content: string };
type QueryCase = { documentKeys: string[]; query: string };

const DOCUMENTS: Document[] = [
  {
    key: "reorder_point",
    title: "Punto de reorden de inventario",
    content:
      "El punto de reorden indica cuando lanzar un nuevo pedido a un proveedor antes de quedarse sin stock. " +
      "Se calcula como la demanda diaria promedio multiplicada por el lead time de entrega del proveedor en dias, " +
      "mas un stock de seguridad para absorber picos de demanda inesperados o retrasos del proveedor. " +
      "Si el inventario disponible cae por debajo de este punto, hay que emitir la orden de compra de inmediato.",
  },
  {
    key: "roas_break_even",
    title: "ROAS de equilibrio (break-even)",
    content:
      "El ROAS de equilibrio es el retorno de inversion publicitaria minimo a partir del cual una campaña deja de " +
      "generar perdidas, considerando el margen bruto del producto y los costes fijos asociados a la venta. " +
      "Se calcula como uno dividido entre el margen bruto expresado en tanto por uno. Por debajo de ese ROAS, " +
      "cada euro gastado en publicidad genera mas coste que beneficio, aunque las ventas brutas suban.",
  },
  {
    key: "damaged_returns",
    title: "Politica de devoluciones por producto dañado",
    content:
      "Cuando un cliente recibe un producto dañado o defectuoso, se ofrece reembolso completo o reenvio sin coste " +
      "adicional, sin exigir devolucion fisica del articulo si el valor es bajo. El cliente debe aportar una foto " +
      "del daño dentro de los primeros catorce dias tras la entrega. Este caso no cuenta contra la ventana " +
      "estandar de devoluciones por cambio de opinion, que si exige devolver el producto.",
  },
  {
    key: "ad_fatigue",
    title: "Deteccion de fatiga publicitaria",
    content:
      "La fatiga publicitaria ocurre cuando la misma audiencia ve un anuncio demasiadas veces y su rendimiento " +
      "empieza a caer: sube la frecuencia de impresiones por usuario mientras el CTR baja de forma sostenida " +
      "durante varios dias seguidos. Cuando la frecuencia supera un umbral (tipicamente entre tres y cuatro " +
      "impresiones por usuario en siete dias) sin mejora de CTR, conviene refrescar la creatividad del anuncio.",
  },
  {
    key: "ltv_cohorts",
    title: "Analisis de cohortes de valor de vida del cliente",
    content:
      "El analisis de cohortes agrupa a los clientes por el mes de su primera compra y sigue cuanto gasta cada " +
      "grupo en los meses siguientes, para ver si el valor de vida del cliente mejora o empeora con el tiempo. " +
      "Comparar cohortes recientes contra cohortes antiguas revela si cambios en producto, precio o marketing " +
      "estan atrayendo clientes que compran mas veces o de mayor valor que los de antes.",
  },
  {
    key: "call_summary_approval",
    title: "Aprobacion de resumenes de llamada generados por IA",
    content:
      "Ningun resumen de llamada generado automaticamente se publica ni genera tareas sin que un consultor o " +
      "platform admin lo revise y apruebe explicitamente. El consultor puede aprobar el resumen tal cual, " +
      "rechazarlo con un motivo, o pedir que se regenere. Solo tras la aprobacion las tareas propuestas se " +
      "materializan como tareas reales enlazadas a la llamada.",
  },
];

// Consultas parafraseadas: ninguna repite el vocabulario exacto del
// documento que deberia encontrar (evita que el recall se explique por
// superposicion lexica en vez de similitud semantica real).
const QUERIES: QueryCase[] = [
  { documentKeys: ["reorder_point"], query: "¿Cómo sé cuándo debo volver a pedir mercancía a mi proveedor antes de quedarme sin existencias?" },
  { documentKeys: ["roas_break_even"], query: "¿A partir de qué retorno publicitario dejamos de perder dinero en una campaña?" },
  { documentKeys: ["damaged_returns"], query: "Un cliente recibió un artículo roto, ¿qué hacemos, le pedimos que lo devuelva?" },
  { documentKeys: ["ad_fatigue"], query: "¿Cómo detectamos que un anuncio ya se volvió repetitivo para la misma audiencia y hay que cambiarlo?" },
  { documentKeys: ["ltv_cohorts"], query: "¿Cómo comparamos si los clientes nuevos gastan más a lo largo del tiempo que los de hace unos meses?" },
  { documentKeys: ["call_summary_approval"], query: "¿Quién tiene que dar el visto bueno antes de que las tareas de una llamada se creen de verdad?" },
  { documentKeys: ["roas_break_even", "ad_fatigue"], query: "En el gráfico de Meta baja el retorno mientras aumenta la frecuencia y cae el clic: ¿qué dos comprobaciones harías antes de tocar el anuncio?" },
  { documentKeys: ["ltv_cohorts", "roas_break_even"], query: "¿Cómo comparo el valor de los clientes nuevos con lo que puedo pagar por adquirirlos sin perder margen?" },
];

const DISTRACTOR_QUERY = "¿Cuál es la política de vacaciones del equipo de soporte técnico?";

// La cuenta de Voyage de este entorno no tiene metodo de pago anadido
// (encontrado corriendo este script por primera vez): limite reducido de 3
// RPM en vez del limite estandar. Cada documento y cada consulta dispara una
// llamada real a la API de embeddings, asi que hay que espaciarlas o el
// script falla con 429 a mitad de la ingesta. 21s de margen sobre 20s (3
// llamadas/60s) dejano un margen prudente ante jitter.
const VOYAGE_FREE_TIER_DELAY_MS = 21_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createEvalUser() {
  const email = `eval-ai04-${RUN_TAG}@ecomscaling.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Eval-Ai04-${RUN_TAG}!`,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de eval: ${error?.message}`);
  }
  const { error: roleError } = await admin
    .from("profiles")
    .update({ platform_role: "platform_admin" })
    .eq("id", data.user.id);
  if (roleError) {
    throw new Error(`No se pudo fijar el rol del usuario de eval: ${roleError.message}`);
  }
  return data.user.id as string;
}

function fakeAuthContext(organizationId: string, actorUserId: string): AuthContext {
  return {
    user: { id: actorUserId, email: "eval-harness@ecomscaling.internal" },
    profile: {
      id: actorUserId,
      full_name: "Eval Harness",
      avatar_url: null,
      platform_role: "platform_admin",
      is_active: true,
    },
    memberships: [{ organization_id: organizationId, role: "owner", accessSource: "membership", organization: null }],
    subscriptions: [],
  };
}

type SearchMatch = { document_id: string; document_title: string; similarity: number };

async function main() {
  logger.info("Starting AI-04/DB-11 eval: RAG retrieval real (Voyage)", {
    documents: DOCUMENTS.map((d) => d.key),
  });

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ display_name: `Eval AI-04 RAG ${RUN_TAG}`, slug: `eval-ai04-rag-${RUN_TAG}`, status: "active" })
    .select("id")
    .single();
  if (orgError || !org) {
    throw new Error(`No se pudo crear la organizacion de eval: ${orgError?.message}`);
  }
  const organizationId = org.id as string;
  const actorUserId = await createEvalUser();
  const context = fakeAuthContext(organizationId, actorUserId);

  const documentIds = new Map<string, string>();

  try {
    console.log(`\n=== Ingesta (${DOCUMENTS.length} documentos) ===`);
    for (const [index, doc] of DOCUMENTS.entries()) {
      if (index > 0) {
        await sleep(VOYAGE_FREE_TIER_DELAY_MS);
      }
      const result = await createKnowledgeDocument(env, context, organizationId, {
        title: doc.title,
        content: doc.content,
        source_type: "manual",
      });

      if (!result.ok) {
        throw new Error(`Ingesta fallida para "${doc.key}": ${JSON.stringify(result)}`);
      }

      documentIds.set(doc.key, result.data.document_id);
      console.log(`ingested "${doc.key}" -> document_id=${result.data.document_id}, chunks=${result.data.chunk_count}`);
    }

    console.log(`\n=== Retrieval (${QUERIES.length} consultas etiquetadas) ===`);
    const scores: Array<{ p1: number; p3: number; r3: number; r8: number; mrr: number }> = [];

    for (const queryCase of QUERIES) {
      await sleep(VOYAGE_FREE_TIER_DELAY_MS);

      const expectedDocumentIds = queryCase.documentKeys.map((key) => {
        const id = documentIds.get(key);
        if (!id) throw new Error(`No hay document_id registrado para "${key}"`);
        return id;
      });

      const result = await searchKnowledge(env, context, organizationId, queryCase.query, null);

      if (!result.ok) {
        console.log(`QUERY FAILED (${queryCase.documentKeys.join("+")}): ${JSON.stringify(result)}`);
        continue;
      }

      const matches = result.data.matches as SearchMatch[];
      const documentRanks = [...new Set(matches.map((match) => match.document_id))];
      const p1 = scoreRetrievalAtK(documentRanks, expectedDocumentIds, 1).precision;
      const at3 = scoreRetrievalAtK(documentRanks, expectedDocumentIds, 3);
      const at8 = scoreRetrievalAtK(documentRanks, expectedDocumentIds, 8);
      scores.push({ p1, p3: at3.precision, r3: at3.recall, r8: at8.recall, mrr: at8.reciprocalRank });

      console.log(
        `"${queryCase.query}"\n` +
          `  relevantes: ${queryCase.documentKeys.join(", ")} | P@1=${p1.toFixed(2)} P@3=${at3.precision.toFixed(2)} R@3=${at3.recall.toFixed(2)} R@8=${at8.recall.toFixed(2)}\n` +
          `  top-3 documentos: ${[...new Set(matches.map((m) => m.document_title))].slice(0, 3).join(" | ")}`,
      );
    }

    console.log(`\n=== Consulta distractor (informativa, sin documento relacionado) ===`);
    await sleep(VOYAGE_FREE_TIER_DELAY_MS);
    const distractorResult = await searchKnowledge(env, context, organizationId, DISTRACTOR_QUERY, null);
    if (distractorResult.ok) {
      const topMatch = (distractorResult.data.matches as SearchMatch[])[0];
      console.log(`"${DISTRACTOR_QUERY}"`);
      console.log(
        topMatch
          ? `  top match: ${topMatch.document_title} (similarity=${topMatch.similarity.toFixed(4)}) -- sin umbral validado para juzgar esto como pass/fail todavia`
          : "  sin resultados",
      );
    }

    const average = (key: keyof (typeof scores)[number]) =>
      scores.length ? scores.reduce((sum, score) => sum + score[key], 0) / scores.length : 0;
    console.log(`\n=== Resumen documental (consultas respondidas: ${scores.length}/${QUERIES.length}) ===`);
    for (const key of ["p1", "p3", "r3", "r8", "mrr"] as const) {
      console.log(`${key.toUpperCase()}: ${(average(key) * 100).toFixed(1)}%`);
    }

    if (scores.length !== QUERIES.length || scores.some((score) => score.r8 < 1)) {
      console.log(
        "ADVERTENCIA: faltan documentos relevantes en el top-8 o fallaron consultas. Revisar retrieval antes de comparar cambios.",
      );
      process.exitCode = 1;
    }
  } finally {
    await admin.from("organizations").delete().eq("id", organizationId);
    await admin.auth.admin.deleteUser(actorUserId);
  }
}

main().catch((error: unknown) => {
  logger.error("AI-04/DB-11 eval crashed", error);
  process.exit(1);
});
