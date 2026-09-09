/**
 * AI-06: dataset de A08 (gestor de conocimiento) -- el ultimo agente de
 * diagnostico sin eval propio tras cerrar A06 (ver AI-06-evaluaciones-calidad.md,
 * "siguiente accion"). Mismo patron que A02/A06: LLM real (no mock), datos
 * reales sembrados via `createKnowledgeDocument` (embeddings reales de
 * Voyage), checks "hard" (deterministicos) y "soft" (heuristicas de texto).
 *
 * Correccion tras la primera corrida real: a diferencia de lo asumido al
 * escribir este eval, A08 **si tiene `search_knowledge`** en su
 * `allowed_tools` (confirmado en `agent_versions`, `model=claude-opus-4-8`) --
 * el catalogo completo (`knowledge_documents` global + organizacion activa)
 * se le entrega ya resuelto en el contexto, pero el modelo puede ademas
 * buscar semanticamente para confirmar vacios reales. Eso es lo que expuso el
 * hallazgo real de abajo.
 *
 * Escenarios cubiertos (2):
 *  1. Catalogo vacio: organizacion sin ningun documento propio. Confirmado
 *     antes de escribir este eval que el catalogo global tampoco tiene filas
 *     activas hoy (`select count(*) from knowledge_documents where
 *     visibility='global' and status='active'` -> 0), asi que el escenario es
 *     deterministico: el agente no deberia fabricar titulos de documentos que
 *     no existen ni proponer una accion sobre un documento inventado.
 *  2. Duplicados obvios: 2 documentos organization-scoped sobre el mismo tema
 *     con titulos/contenido casi identicos (politica de reembolsos, una vez
 *     en español formal y otra vez casi el mismo texto con variacion menor),
 *     mas 1 documento claramente distinto -- el agente deberia detectar la
 *     duplicacion entre los dos primeros y no señalar el tercero como
 *     duplicado de nada.
 *
 * Cuesta llamadas reales a Voyage (embeddings, ingestion) y al LLM
 * configurado. No correr en cada PR. Ejecutar manualmente con `npm run
 * eval:a08 -w @ecomscaling/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { evaluateCostGate } from "./eval-cost-gate.js";
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { createKnowledgeDocument } from "./knowledge.js";
import { runKnowledgeManagerAgent } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-a08-knowledge-manager");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;

// Mismo limite de la cuenta de Voyage sin metodo de pago que motivo este
// margen en eval-ai04-rag-retrieval.ts: 3 RPM, 21s entre llamadas de embeddings.
const VOYAGE_FREE_TIER_DELAY_MS = 21_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Check = { name: string; type: "hard" | "soft"; pass: boolean; detail: string };

type AgentOutputShape = {
  answer: string;
  findings: Array<{ title: string; severity: string; evidence: string }>;
  recommendations: unknown[];
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  warnings: string[];
  confidence: string;
};

type Scenario = {
  name: string;
  description: string;
  setup: () => Promise<{ organizationId: string }>;
  checks: (output: AgentOutputShape) => Check[];
};

async function createEvalUser() {
  const email = `eval-a08-${RUN_TAG}@ecomscaling.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Eval-A08-${RUN_TAG}!`,
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

async function createEvalOrg(label: string) {
  const { data, error } = await admin
    .from("organizations")
    .insert({
      display_name: `Eval A08 ${label} ${RUN_TAG}`,
      slug: `eval-a08-${label}-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`No se pudo crear la organizacion de eval (${label}): ${error?.message}`);
  }
  return data.id as string;
}

function stripAccents(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function hasKeyword(text: string, keywords: string[]) {
  const normalized = stripAccents(text.toLowerCase());
  return keywords.some((keyword) => normalized.includes(stripAccents(keyword.toLowerCase())));
}

// El incidente real de la primera corrida (ver comentario de cabecera): bajo
// 429 repetidos de Voyage a mitad del turno, el modelo devolvio `answer: ",
// ecd"` -- ni vacio (no lo bloquea checkOutputSanity) ni un patron de
// repeticion (tampoco), pero claramente corrupto/no accionable. Chequeo
// explicito y generico para todos los escenarios, no solo el que lo disparo.
function isAnswerCoherent(answer: string) {
  const trimmed = answer.trim();
  return trimmed.length >= 20 && /[a-zA-Z]{4,}/.test(trimmed);
}

const DUPLICATE_TITLE_A = `Política de reembolsos por producto dañado ${RUN_TAG}`;
const DUPLICATE_TITLE_B = `Reembolsos en productos dañados ${RUN_TAG}`;
const DUPLICATE_CONTENT =
  "Cuando un cliente recibe un producto dañado, se ofrece reembolso completo o reenvío sin coste adicional, " +
  "sin exigir devolución física si el valor del artículo es bajo. El cliente debe aportar una foto del daño " +
  "dentro de los primeros catorce días tras la entrega.";
const DUPLICATE_CONTENT_VARIANT =
  "Si un cliente recibe un producto dañado, se le ofrece un reembolso completo o un reenvío gratuito, sin " +
  "pedirle que devuelva el artículo físicamente cuando su valor es bajo. Debe enviar una foto del daño en un " +
  "plazo máximo de catorce días desde la entrega.";
const DISTINCT_TITLE = `Deteccion de fatiga publicitaria ${RUN_TAG}`;
const DISTINCT_CONTENT =
  "La fatiga publicitaria ocurre cuando la misma audiencia ve un anuncio demasiadas veces y su rendimiento " +
  "empieza a caer: sube la frecuencia de impresiones por usuario mientras el CTR baja de forma sostenida.";

const SCENARIOS: Scenario[] = [
  {
    name: "catalogo_vacio",
    description:
      "Organizacion sin ningun documento propio. El catalogo global tampoco tiene filas activas hoy (confirmado antes de correr este eval) -- el agente no deberia fabricar titulos de documentos ni proponer acciones sobre documentos inventados.",
    setup: async () => {
      const organizationId = await createEvalOrg("vacio");
      return { organizationId };
    },
    checks: (output) => {
      const allText = [output.answer, ...output.warnings, ...output.findings.map((f) => f.evidence)].join(" ");
      // Con 0 documentos reales, cualquier source de kind='document' seria
      // fabricado -- una source de kind='tool' (p.ej. search_knowledge
      // confirmando "sin resultados") es legitima, no una alucinacion.
      const fabricatedDocumentSources = output.sources.filter((s) => s.kind === "document");
      return [
        {
          name: "respuesta no esta vacia ni corrupta",
          type: "hard",
          pass: isAnswerCoherent(output.answer),
          detail: `answer="${output.answer.slice(0, 120)}"`,
        },
        {
          name: "no cita ningun documento fabricado en sources (catalogo vacio de verdad)",
          type: "hard",
          pass: fabricatedDocumentSources.length === 0,
          detail: `sources=${JSON.stringify(output.sources)}`,
        },
        {
          name: "menciona que el catalogo esta vacio o sin documentos",
          type: "soft",
          pass: hasKeyword(allText, ["sin documentos", "no hay documentos", "catalogo vacio", "esta vacio", "no existen documentos", "no se encontraron documentos", "0 documentos"]),
          detail: "Heuristica de texto libre -- util para detectar regresiones, no un contrato estricto.",
        },
      ];
    },
  },
  {
    name: "duplicados_obvios",
    description:
      "2 documentos organization-scoped sobre el mismo tema con contenido casi identico (politica de reembolsos por producto dañado, dos redacciones distintas del mismo contenido), mas 1 documento claramente distinto (fatiga publicitaria) -- el agente deberia detectar la duplicacion entre los dos primeros.",
    setup: async () => {
      const organizationId = await createEvalOrg("duplicados");
      return { organizationId };
    },
    checks: (output) => {
      const allText = [output.answer, ...output.findings.map((f) => f.evidence)].join(" ");
      const distinctFlaggedAsDuplicate = output.findings.some(
        (f) => hasKeyword(f.title + " " + f.evidence, ["fatiga publicitaria"]) && hasKeyword(f.title + " " + f.evidence, ["duplicad"]),
      );
      return [
        {
          name: "respuesta no esta vacia ni corrupta",
          type: "hard",
          pass: isAnswerCoherent(output.answer),
          detail: `answer="${output.answer.slice(0, 120)}"`,
        },
        {
          name: "cita al menos uno de los dos documentos duplicados en sources",
          type: "hard",
          pass: output.sources.some((s) => hasKeyword(s.reference, [DUPLICATE_TITLE_A, DUPLICATE_TITLE_B])),
          detail: `sources=${JSON.stringify(output.sources)}`,
        },
        {
          name: "menciona duplicacion/solapamiento entre los dos documentos de reembolsos",
          type: "soft",
          pass: hasKeyword(allText, ["duplicad", "solapa", "redundante", "mismo contenido", "contenido similar", "casi identic"]),
          detail: "Heuristica de texto libre -- deberia detectar que los dos documentos de reembolsos cubren lo mismo.",
        },
        {
          name: "no señala el documento distinto (fatiga publicitaria) como duplicado",
          type: "hard",
          pass: !distinctFlaggedAsDuplicate,
          detail: `findings=${JSON.stringify(output.findings)}`,
        },
      ];
    },
  },
];

async function seedDuplicateDocuments(env_: typeof env, context: AuthContext, organizationId: string) {
  console.log(`  ingestando "${DUPLICATE_TITLE_A}"...`);
  const first = await createKnowledgeDocument(env_, context, organizationId, {
    title: DUPLICATE_TITLE_A,
    content: DUPLICATE_CONTENT,
    source_type: "manual",
  });
  if (!first.ok) throw new Error(`Ingesta fallida (A): ${JSON.stringify(first)}`);

  await sleep(VOYAGE_FREE_TIER_DELAY_MS);
  console.log(`  ingestando "${DUPLICATE_TITLE_B}"...`);
  const second = await createKnowledgeDocument(env_, context, organizationId, {
    title: DUPLICATE_TITLE_B,
    content: DUPLICATE_CONTENT_VARIANT,
    source_type: "manual",
  });
  if (!second.ok) throw new Error(`Ingesta fallida (B): ${JSON.stringify(second)}`);

  await sleep(VOYAGE_FREE_TIER_DELAY_MS);
  console.log(`  ingestando "${DISTINCT_TITLE}"...`);
  const third = await createKnowledgeDocument(env_, context, organizationId, {
    title: DISTINCT_TITLE,
    content: DISTINCT_CONTENT,
    source_type: "manual",
  });
  if (!third.ok) throw new Error(`Ingesta fallida (C): ${JSON.stringify(third)}`);
}

async function runScenario(scenario: Scenario, actorUserId: string) {
  const { organizationId } = await scenario.setup();
  try {
    const context = fakeAuthContext(organizationId, actorUserId);

    if (scenario.name === "duplicados_obvios") {
      // El escenario anterior (catalogo_vacio) puede haber consumido el
      // presupuesto de RPM de Voyage por su cuenta (A08 llama a
      // search_knowledge varias veces por su cuenta, ver hallazgo real en el
      // comentario de cabecera) -- margen extra antes de arrancar la
      // ingestion de este escenario para no heredar un 429 del anterior.
      await sleep(60_000);
      await seedDuplicateDocuments(env, context, organizationId);
      await sleep(VOYAGE_FREE_TIER_DELAY_MS);
    }

    const result = await runKnowledgeManagerAgent(env, context, organizationId);

    if (!result.ok) {
      return { scenario: scenario.name, error: result, checks: [] as Check[] };
    }

    const output = result.data.output as AgentOutputShape;
    const checks = scenario.checks(output);
    return { scenario: scenario.name, output, checks, usage: result.data.usage };
  } finally {
    await admin.from("organizations").delete().eq("id", organizationId);
  }
}

const MAX_COST_PER_SCENARIO_USD = 0.15;
const MAX_LATENCY_PER_SCENARIO_MS = 45_000;
const SOFT_FAILURE_RATE_WARNING_THRESHOLD = 1 / 3;

async function main() {
  logger.info("Starting AI-06 eval: A08 gestor de conocimiento", { scenarios: SCENARIOS.map((s) => s.name) });

  const actorUserId = await createEvalUser();
  let hardFailures = 0;
  let softFailures = 0;
  let totalSoftChecks = 0;
  let totalCostUsd = 0;
  const gateViolations: string[] = [];

  try {
    for (const scenario of SCENARIOS) {
      console.log(`\n=== ${scenario.name} ===`);
      console.log(scenario.description);

      const result = await runScenario(scenario, actorUserId);

      if ("error" in result) {
        console.log(`RUN FAILED: ${JSON.stringify(result.error)}`);
        hardFailures += 1;
        continue;
      }

      console.log(`answer: ${result.output.answer}`);

      if (result.usage) {
        console.log(`usage: ${JSON.stringify(result.usage)}`);

        const costGate = evaluateCostGate(
          scenario.name,
          result.usage.estimated_cost_usd,
          MAX_COST_PER_SCENARIO_USD,
        );
        totalCostUsd += costGate.addToTotalUsd;
        for (const violation of costGate.violations) {
          console.log(violation);
          gateViolations.push(violation);
          hardFailures += 1;
        }

        if (result.usage.latency_ms > MAX_LATENCY_PER_SCENARIO_MS) {
          const violation = `[GATE FAIL] ${scenario.name}: latencia ${result.usage.latency_ms}ms supera el umbral ${MAX_LATENCY_PER_SCENARIO_MS}ms`;
          console.log(violation);
          gateViolations.push(violation);
          hardFailures += 1;
        }
      }

      for (const check of result.checks) {
        const marker = check.pass ? "PASS" : "FAIL";
        console.log(`[${check.type.toUpperCase()} ${marker}] ${check.name} -- ${check.detail}`);
        if (check.type === "soft") totalSoftChecks += 1;
        if (!check.pass) {
          if (check.type === "hard") hardFailures += 1;
          else softFailures += 1;
        }
      }
    }
  } finally {
    await admin.auth.admin.deleteUser(actorUserId);
  }

  const softFailureRate = totalSoftChecks > 0 ? softFailures / totalSoftChecks : 0;

  console.log(`\n=== Resumen ===`);
  console.log(`Coste total estimado: $${totalCostUsd.toFixed(4)}`);
  console.log(`Fallos hard (bloqueantes): ${hardFailures}`);
  console.log(`Fallos soft (heuristicas): ${softFailures}/${totalSoftChecks} (${(softFailureRate * 100).toFixed(0)}%)`);

  if (softFailureRate > SOFT_FAILURE_RATE_WARNING_THRESHOLD) {
    console.log(
      `ADVERTENCIA DE CALIDAD: tasa de fallos soft (${(softFailureRate * 100).toFixed(0)}%) supera el umbral de revision (${(SOFT_FAILURE_RATE_WARNING_THRESHOLD * 100).toFixed(0)}%). Revisar antes de promover esta version de prompt.`,
    );
  }

  if (gateViolations.length > 0) {
    console.log(`\nQuality gates deterministicos violados: ${gateViolations.length}`);
  }

  if (hardFailures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("AI-06 eval crashed", error);
  process.exit(1);
});
