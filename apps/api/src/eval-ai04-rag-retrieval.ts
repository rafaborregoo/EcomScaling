/**
 * AI-04/DB-11: "conseguir VOYAGE_API_KEY de un entorno de prueba y correr
 * retrieval real antes de invertir en chunking estructural o busqueda
 * hibrida" era la siguiente accion explicita de AI-04, y el dataset de
 * recall@k/precision de citas era un gap abierto de DB-11. Este entorno ya
 * tiene `VOYAGE_API_KEY` configurada en `.env.local` -- primera vez que
 * `search_knowledge` corre contra embeddings reales (Voyage `voyage-3.5`) en
 * vez de quedar bloqueado por falta de la key.
 *
 * Metodologia: se ingestan 6 documentos de metodologia EcomScaling
 * (organization-scoped, un tema claramente distinto cada uno) via
 * `createKnowledgeDocument` (chunking + embeddings reales), y se lanza 1
 * consulta parafraseada por documento -- nunca coincidencia exacta de
 * palabras clave, para que el recall dependa de similitud semantica real, no
 * de superposicion lexica. Se mide recall@8 (el `match_count` por defecto de
 * `knowledge_search`/`searchKnowledge`) y recall@3 (mas exigente) para cada
 * documento esperado, mas una consulta "distractor" sobre un tema no cubierto
 * por ningun documento, solo informativa (no hay umbral de similitud
 * absoluto validado todavia contra el que juzgar un "no deberia encontrar
 * nada" con confianza).
 *
 * Cuesta llamadas reales a la API de Voyage (dinero, minimo) -- no correr en
 * cada PR. Ejecutar manualmente con `npm run eval:ai04 -w @ecomscaling/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { createKnowledgeDocument, searchKnowledge } from "./knowledge.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-ai04-rag-retrieval");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;

type Document = { key: string; title: string; content: string };
type QueryCase = { documentKey: string; query: string };

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
  { documentKey: "reorder_point", query: "¿Cómo sé cuándo debo volver a pedir mercancía a mi proveedor antes de quedarme sin existencias?" },
  { documentKey: "roas_break_even", query: "¿A partir de qué retorno publicitario dejamos de perder dinero en una campaña?" },
  { documentKey: "damaged_returns", query: "Un cliente recibió un artículo roto, ¿qué hacemos, le pedimos que lo devuelva?" },
  { documentKey: "ad_fatigue", query: "¿Cómo detectamos que un anuncio ya se volvió repetitivo para la misma audiencia y hay que cambiarlo?" },
  { documentKey: "ltv_cohorts", query: "¿Cómo comparamos si los clientes nuevos gastan más a lo largo del tiempo que los de hace unos meses?" },
  { documentKey: "call_summary_approval", query: "¿Quién tiene que dar el visto bueno antes de que las tareas de una llamada se creen de verdad?" },
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
    memberships: [{ organization_id: organizationId, role: "owner", organization: null }],
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

    console.log(`\n=== Retrieval (${QUERIES.length} consultas parafraseadas) ===`);
    let recallAt8Hits = 0;
    let recallAt3Hits = 0;

    for (const queryCase of QUERIES) {
      await sleep(VOYAGE_FREE_TIER_DELAY_MS);

      const expectedDocumentId = documentIds.get(queryCase.documentKey);
      if (!expectedDocumentId) {
        throw new Error(`No hay document_id registrado para "${queryCase.documentKey}"`);
      }

      const result = await searchKnowledge(env, context, organizationId, queryCase.query, null);

      if (!result.ok) {
        console.log(`QUERY FAILED (${queryCase.documentKey}): ${JSON.stringify(result)}`);
        continue;
      }

      const matches = result.data.matches as SearchMatch[];
      const rank = matches.findIndex((m) => m.document_id === expectedDocumentId);
      const foundAt8 = rank !== -1;
      const foundAt3 = rank !== -1 && rank < 3;

      if (foundAt8) recallAt8Hits += 1;
      if (foundAt3) recallAt3Hits += 1;

      console.log(
        `[${foundAt8 ? "HIT" : "MISS"}] "${queryCase.documentKey}" <- "${queryCase.query}"\n` +
          `  esperado: ${queryCase.documentKey} | rank=${foundAt8 ? rank + 1 : "no encontrado en top-8"} | ` +
          `similarity=${foundAt8 ? matches[rank]!.similarity.toFixed(4) : "n/a"}\n` +
          `  top-3 real: ${matches.slice(0, 3).map((m) => `${m.document_title} (${m.similarity.toFixed(3)})`).join(" | ")}`,
      );
    }

    const recallAt8 = recallAt8Hits / QUERIES.length;
    const recallAt3 = recallAt3Hits / QUERIES.length;

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

    console.log(`\n=== Resumen ===`);
    console.log(`Recall@8: ${recallAt8Hits}/${QUERIES.length} (${(recallAt8 * 100).toFixed(0)}%)`);
    console.log(`Recall@3: ${recallAt3Hits}/${QUERIES.length} (${(recallAt3 * 100).toFixed(0)}%)`);

    if (recallAt8Hits < QUERIES.length) {
      console.log(
        `ADVERTENCIA: ${QUERIES.length - recallAt8Hits} consulta(s) no encontraron su documento esperado ni en el top-8. Revisar chunking/embeddings antes de confiar en retrieval para produccion.`,
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
