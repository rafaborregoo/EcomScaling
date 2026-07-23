/**
 * AI-06 (P0): primer dataset real de evaluacion de A01 (analista de
 * llamadas), pedido explicitamente por AI-06-evaluaciones-calidad.md ("Datasets
 * de A01/A06 -- solo A02 tiene dataset real hoy"). Mismo patron que
 * eval-a02-monitor.ts: LLM real (no mock), escenarios con datos sembrados de
 * verdad, checks "hard" (deterministicos, bloquean el eval) y "soft"
 * (heuristicas de texto, se reportan pero no bloquean solas), quality gates
 * de coste/latencia.
 *
 * Escenarios cubiertos (3, los que este mismo documento pedia explicitamente
 * para A01: "llamada sin tareas, tareas sin responsable" -- audio deficiente
 * y varios interlocutores quedan fuera de este primer lote, requieren
 * transcripciones mas elaboradas):
 *  1. Llamada con tareas claras: transcripcion con 2 pendientes explicitos,
 *     cada uno con dueño y plazo mencionados en el dialogo -- el agente
 *     deberia proponer tareas correspondientes con owner/priority correctos.
 *  2. Llamada sin tareas accionables: checkin informativo, sin problemas ni
 *     decisiones pendientes -- el agente NO deberia inventar tareas de la
 *     nada solo por generar contenido.
 *  3. Tarea mencionada sin responsable claro: se discute un problema real
 *     pero nadie en la transcripcion se compromete a resolverlo -- el agente
 *     no deberia inventar un nombre de responsable que no esta en el texto
 *     (fuente unica = transcripcion, sin tools, por diseño de A01).
 *
 * Cuesta llamadas reales al proveedor de IA configurado (dinero) -- no correr
 * en cada PR. Ejecutar manualmente con `npm run eval:a01 -w @ecomscaling/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runCallAnalyst } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-a01-call-analyst");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;

type Check = { name: string; type: "hard" | "soft"; pass: boolean; detail: string };

type ProposedTask = { title: string; description: string; priority: string; owner: "cliente" | "consultor" };

// Forma minima que necesitamos leer del output validado por runAgentTurn
// (ya paso callSummaryOutputSchema + checkOutputSanity antes de llegar aqui).
type AgentOutputShape = {
  summary: string;
  facts: string[];
  decisions: string[];
  recommendations: Array<{ action: string; priority: string; rationale: string }>;
  risks: string[];
  proposed_tasks: ProposedTask[];
  key_quotes: string[];
  confidence: string;
  warnings: string[];
};

type Scenario = {
  name: string;
  description: string;
  transcript: string;
  setup: (actorUserId: string) => Promise<{ organizationId: string; callId: string }>;
  checks: (output: AgentOutputShape) => Check[];
};

// agent_runs.actor_user_id tiene FK real a public.profiles (que a su vez
// exige auth.users) -- necesitamos un usuario efimero real, mismo patron que
// eval-a02-monitor.ts.
async function createEvalUser() {
  const email = `eval-a01-${RUN_TAG}@ecomscaling.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Eval-A01-${RUN_TAG}!`,
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

async function createEvalOrgAndCall(label: string, title: string, transcript: string, actorUserId: string) {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ display_name: `Eval A01 ${label} ${RUN_TAG}`, slug: `eval-a01-${label}-${RUN_TAG}`, status: "active" })
    .select("id")
    .single();
  if (orgError || !org) {
    throw new Error(`No se pudo crear la organizacion de eval (${label}): ${orgError?.message}`);
  }

  const { data: call, error: callError } = await admin
    .from("consulting_calls")
    .insert({
      organization_id: org.id,
      title,
      status: "held",
      held_at: new Date().toISOString(),
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (callError || !call) {
    throw new Error(`No se pudo crear la llamada de eval (${label}): ${callError?.message}`);
  }

  const { error: transcriptError } = await admin.from("call_transcripts").insert({
    call_id: call.id,
    organization_id: org.id,
    content: transcript,
    source: "manual",
    created_by: actorUserId,
  });
  if (transcriptError) {
    throw new Error(`No se pudo crear la transcripcion de eval (${label}): ${transcriptError.message}`);
  }

  return { organizationId: org.id as string, callId: call.id as string };
}

function hasKeyword(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

const CLEAR_TASKS_TRANSCRIPT = `
Consultor: Buenas Marta, vamos con la revision mensual de Tienda Ejemplo. Antes que nada, ¿como va el tema de los costes de envio? Los teniamos pendientes de revisar desde la ultima llamada.
Cliente: Si, lo he mirado. La tarifa plana que tenemos con la transportadora esta desactualizada, sigue siendo la de hace dos años. Voy a renegociarla yo directamente con ellos esta semana, antes del viernes.
Consultor: Perfecto, quedamos en que tu te encargas de renegociar la tarifa de envio con la transportadora antes del viernes. Por otro lado, vi en el dashboard que las campañas de Meta llevan tres dias sin datos actualizados.
Cliente: Eso es cosa vuestra, ¿no? Vosotros gestionais la integracion con Meta.
Consultor: Correcto, me encargo yo. Voy a revisar la conexion de Meta Ads y dejarla funcionando de nuevo, prioridad alta porque nos deja ciegos en gasto publicitario. Lo tengo listo para mañana.
Cliente: Genial, gracias.
`.trim();

const NO_TASKS_TRANSCRIPT = `
Consultor: Hola Jorge, revision mensual de Tienda Sana. Las ventas del mes van un 8% por encima del mes anterior, el margen se mantiene estable en el rango que hablamos, y el stock esta correctamente abastecido en todas las referencias principales.
Cliente: Si, la verdad es que va todo muy tranquilo este mes. No tengo ninguna incidencia que comentar.
Consultor: Perfecto, por nuestro lado tampoco hay ninguna alerta activa ni nada pendiente de resolver. Seguimos con la misma estrategia el mes que viene.
Cliente: Me parece bien, sin cambios entonces. Nos vemos el mes que viene.
Consultor: Genial, que tengas buen mes.
`.trim();

const NO_OWNER_TRANSCRIPT = `
Consultor: Buenas, seguimos con la revision. Hay un tema que quiero comentar: el checkout esta tardando mucho en cargar en movil, varios clientes se han quejado en las reseñas.
Cliente: Uy, no tenia ni idea. Eso hay que arreglarlo.
Consultor: Si, es un problema real que afecta a la conversion. Habria que investigar si es el tema o alguna app instalada la que lo esta ralentizando.
Cliente: No se, la verdad no tengo ni idea de quien deberia mirar eso, no es algo que yo sepa tocar.
Consultor: Ya, tampoco es algo que gestionemos nosotros directamente, seria mas bien tema de tu desarrollador de tema si tienes uno.
Cliente: No tengo desarrollador ahora mismo, lo tendre que pensar.
Consultor: Vale, quedamos en que es un problema pendiente de resolver, aunque todavia no esta claro quien se hace cargo.
`.trim();

const SCENARIOS: Scenario[] = [
  {
    name: "tareas_claras",
    description:
      "Transcripcion con 2 pendientes explicitos, cada uno con dueño (cliente/consultor) y plazo mencionados en el dialogo.",
    transcript: CLEAR_TASKS_TRANSCRIPT,
    setup: (actorUserId) => createEvalOrgAndCall("tareas-claras", "Revision mensual - tareas claras", CLEAR_TASKS_TRANSCRIPT, actorUserId),
    checks: (output) => {
      const allTitles = output.proposed_tasks.map((t) => t.title.toLowerCase()).join(" | ");
      return [
        {
          name: "propone al menos 1 tarea",
          type: "hard",
          pass: output.proposed_tasks.length >= 1,
          detail: `proposed_tasks=${output.proposed_tasks.length}`,
        },
        {
          name: "cada tarea propuesta tiene owner valido (cliente|consultor)",
          type: "hard",
          pass: output.proposed_tasks.every((t) => t.owner === "cliente" || t.owner === "consultor"),
          detail: `owners: ${output.proposed_tasks.map((t) => t.owner).join(", ")}`,
        },
        {
          name: "detecta la tarea de renegociar tarifa de envio",
          type: "soft",
          pass: hasKeyword(allTitles, ["tarifa", "envio", "transportadora", "renegociar"]),
          detail: `titulos propuestos: ${allTitles || "ninguno"}`,
        },
        {
          name: "detecta la tarea de arreglar la conexion de Meta Ads",
          type: "soft",
          pass: hasKeyword(allTitles, ["meta", "conexion", "campañ", "publicidad"]),
          detail: `titulos propuestos: ${allTitles || "ninguno"}`,
        },
        {
          name: "key_quotes no vacio (hay citas textuales claras en esta transcripcion)",
          type: "soft",
          pass: output.key_quotes.length > 0,
          detail: `key_quotes=${output.key_quotes.length}`,
        },
      ];
    },
  },
  {
    name: "sin_tareas_accionables",
    description: "Checkin informativo sin problemas ni decisiones pendientes -- no deberia inventar tareas.",
    transcript: NO_TASKS_TRANSCRIPT,
    setup: (actorUserId) => createEvalOrgAndCall("sin-tareas", "Revision mensual - sin incidencias", NO_TASKS_TRANSCRIPT, actorUserId),
    checks: (output) => [
      {
        name: "no propone tareas cuando la llamada no genero ninguna",
        type: "soft",
        pass: output.proposed_tasks.length === 0,
        detail: `proposed_tasks=${output.proposed_tasks.length}: ${JSON.stringify(output.proposed_tasks.map((t) => t.title))}`,
      },
      {
        name: "resumen no esta vacio",
        type: "hard",
        pass: output.summary.trim().length > 0,
        detail: "summary vacio ya lo bloquea checkOutputSanity, esto es una doble confirmacion aqui.",
      },
      {
        name: "confidence no es baja (la transcripcion es clara, aunque no tenga tareas)",
        type: "soft",
        pass: output.confidence !== "low",
        detail: `confidence reportada: ${output.confidence}`,
      },
    ],
  },
  {
    name: "tarea_sin_responsable",
    description:
      "Se discute un problema real (checkout lento en movil) pero nadie se compromete a resolverlo -- el agente no deberia inventar un responsable que no esta en el texto.",
    transcript: NO_OWNER_TRANSCRIPT,
    setup: (actorUserId) => createEvalOrgAndCall("sin-responsable", "Revision mensual - checkout lento", NO_OWNER_TRANSCRIPT, actorUserId),
    checks: (output) => {
      const allText = [output.summary, ...output.risks, ...output.proposed_tasks.map((t) => t.description)].join(" ");
      return [
        {
          name: "no inventa un nombre propio de responsable que no esta en la transcripcion",
          type: "hard",
          // La transcripcion no menciona ningun nombre propio de tercero (solo
          // "consultor"/"cliente" genericos) -- si el output menciona un nombre
          // propio especifico como responsable, esta inventando informacion que
          // no viene de la fuente unica permitida (la propia transcripcion).
          pass: !/\b(responsable|encargad[oa])\s*:?\s+[A-ZÁÉÍÓÚ][a-záéíóú]+\b/.test(allText),
          detail: `texto evaluado (recortado): ${allText.slice(0, 300)}`,
        },
        {
          name: "menciona el problema real (checkout lento en movil)",
          type: "soft",
          pass: hasKeyword(allText, ["checkout", "movil", "carga", "lento"]),
          detail: `texto evaluado (recortado): ${allText.slice(0, 300)}`,
        },
        {
          name: "si propone una tarea para esto, el owner por defecto es consultor (no inventa que el cliente se comprometio)",
          type: "soft",
          pass: output.proposed_tasks
            .filter((t) => hasKeyword(t.title + " " + t.description, ["checkout", "movil", "lento"]))
            .every((t) => t.owner === "consultor"),
          detail: `tareas relacionadas: ${JSON.stringify(
            output.proposed_tasks.filter((t) => hasKeyword(t.title + " " + t.description, ["checkout", "movil", "lento"])),
          )}`,
        },
      ];
    },
  },
];

async function runScenario(scenario: Scenario, actorUserId: string) {
  const { organizationId, callId } = await scenario.setup(actorUserId);
  try {
    const context = fakeAuthContext(organizationId, actorUserId);
    const result = await runCallAnalyst(env, context, organizationId, callId);

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

// Mismos umbrales que eval-a02-monitor.ts hasta tener una primera corrida
// real de A01 que los calibre con datos propios.
const MAX_COST_PER_SCENARIO_USD = 0.15;
const MAX_LATENCY_PER_SCENARIO_MS = 45_000;
const SOFT_FAILURE_RATE_WARNING_THRESHOLD = 1 / 3;

async function main() {
  logger.info("Starting AI-06 eval: A01 analista de llamadas", { scenarios: SCENARIOS.map((s) => s.name) });

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

      if (result.usage) {
        totalCostUsd += result.usage.estimated_cost_usd;
        console.log(`usage: ${JSON.stringify(result.usage)}`);

        if (result.usage.estimated_cost_usd > MAX_COST_PER_SCENARIO_USD) {
          const violation = `[GATE FAIL] ${scenario.name}: coste $${result.usage.estimated_cost_usd} supera el umbral $${MAX_COST_PER_SCENARIO_USD}`;
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
