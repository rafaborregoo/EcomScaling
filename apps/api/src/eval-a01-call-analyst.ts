/**
 * AI-06 (P0): dataset real de evaluacion de A01 (analista de llamadas),
 * pedido explicitamente por AI-06-evaluaciones-calidad.md ("Datasets de A01/A06
 * -- solo A02 tiene dataset real hoy"). Mismo patron que eval-a02-monitor.ts:
 * LLM real (no mock), escenarios con datos sembrados de verdad, checks "hard"
 * (deterministicos, bloquean el eval) y "soft" (heuristicas de texto, se
 * reportan pero no bloquean solas), quality gates de coste/latencia.
 *
 * Escenarios cubiertos (5 -- los 3 originales del primer lote mas los 2 que
 * quedaron pendientes explicitamente: "audio deficiente y varios
 * interlocutores", ver AI-06-evaluaciones-calidad.md):
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
 *  4. Audio deficiente: transcripcion con tramos marcados `[inaudible]`/
 *     `[audio cortado]` justo en los puntos donde se menciona una cifra y un
 *     plazo -- el agente no deberia rellenar esos huecos con una cifra o
 *     fecha inventada, y deberia bajar su `confidence` o avisar del hueco en
 *     vez de presentar el resumen como si la transcripcion fuera completa.
 *  5. Varios interlocutores: 3 personas en la llamada (consultor + 2 personas
 *     del lado cliente con nombre y rol propios, cada una comprometiendose a
 *     una tarea distinta) -- el agente deberia atribuir cada tarea a la
 *     persona correcta en vez de colapsar a un unico "cliente" generico.
 *
 * Cuesta llamadas reales al proveedor de IA configurado (dinero) -- no correr
 * en cada PR. Ejecutar manualmente con `npm run eval:a01 -w @e-nora/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { evaluateCostGate } from "./eval-cost-gate.js";
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
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
    memberships: [{ organization_id: organizationId, role: "owner", accessSource: "membership", organization: null }],
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

const POOR_AUDIO_TRANSCRIPT = `
Consultor: Buenas Elena, vamos con la revision. Cuentame como va el tema del proveedor nuevo de packaging.
Cliente: Si, al final cerramos precio con ellos, nos sale a [inaudible] euros la unidad, bastante mejor que el proveedor anterior.
Consultor: Genial, ¿y cuando teneis pensado hacer el cambio?
Cliente: Estamos calculando, pero diria que sobre el [audio cortado] deberiamos tener ya el stock nuevo llegando, si todo va bien con la aduana.
Consultor: Perfecto, lo dejamos anotado entonces. Yo por mi parte voy a revisar el catalogo de Shopify para que los productos reflejen el nuevo packaging en las fotos cuando llegue el stock.
Cliente: Vale, eso si, avisame cuando lo tengas para revisarlo yo antes de publicar.
Consultor: Hecho, te lo paso para revision antes de publicar nada.
`.trim();

const MULTI_SPEAKER_TRANSCRIPT = `
Consultor: Buenas a los tres, gracias por uniros. Tenemos la revision trimestral de Tienda Multiequipo. Marta, tu llevas marketing, Pedro tu llevas operaciones, ¿verdad?
Marta: Correcto, yo llevo marketing y contenido.
Pedro: Y yo logistica y almacen.
Consultor: Perfecto. Marta, ¿como va la campaña de verano?
Marta: Bien, aunque necesito que me confirmeis el presupuesto de Meta Ads antes del lunes para poder programar los anuncios a tiempo. Me comprometo a tener el calendario de contenido listo para entonces tambien.
Consultor: Anotado, Marta se encarga del calendario de contenido antes del lunes. Pedro, ¿como va el tema de las devoluciones que comentamos la ultima vez?
Pedro: Ya lo tengo resuelto, cambiamos de transportadora para las devoluciones y baja el tiempo de gestion a la mitad. Lo que si me falta es revisar el stock de seguridad del almacen norte, lo tendre listo para el jueves.
Consultor: Perfecto, Pedro revisa el stock de seguridad del almacen norte para el jueves. Por mi parte, reviso yo la conexion de Shopify con el nuevo transportista para que las etiquetas se generen bien.
Marta: Genial, gracias a los dos.
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
  {
    name: "audio_deficiente",
    description:
      "Transcripcion con tramos [inaudible]/[audio cortado] justo en la cifra de precio y en la fecha de cambio de proveedor -- el agente no deberia inventar el numero ni la fecha que faltan.",
    transcript: POOR_AUDIO_TRANSCRIPT,
    setup: (actorUserId) => createEvalOrgAndCall("audio-deficiente", "Revision mensual - audio con cortes", POOR_AUDIO_TRANSCRIPT, actorUserId),
    checks: (output) => {
      const allText = [output.summary, ...output.facts, ...output.key_quotes].join(" ");
      return [
        {
          name: "no inventa una cifra de precio concreta en el hueco [inaudible]",
          type: "hard",
          // La transcripcion nunca revela el precio real -- cualquier cifra
          // con decimales o "X euros" en el resumen/hechos es una alucinacion,
          // porque no existe en la fuente.
          pass: !/\d+([.,]\d+)?\s*(€|euros?)/i.test(allText),
          detail: `texto evaluado (recortado): ${allText.slice(0, 300)}`,
        },
        {
          name: "no inventa una fecha concreta en el hueco [audio cortado]",
          type: "hard",
          // La transcripcion nunca dice una fecha/mes concreto para el cambio
          // de proveedor -- solo "sobre el [audio cortado]". Un mes o fecha
          // exacta en el resumen séria fabricado.
          pass: !/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{1,2}\/\d{1,2})\b/i.test(
            allText,
          ),
          detail: `texto evaluado (recortado): ${allText.slice(0, 300)}`,
        },
        {
          name: "menciona explicitamente que hay informacion incompleta/inaudible",
          type: "soft",
          pass: hasKeyword(allText + " " + output.warnings.join(" "), ["inaudible", "no se entiende", "corte", "incompleta", "no queda claro", "no se especifica"]),
          detail: `warnings: ${JSON.stringify(output.warnings)}`,
        },
        {
          name: "confidence no es alta (hay huecos reales de informacion)",
          type: "soft",
          pass: output.confidence !== "high",
          detail: `confidence reportada: ${output.confidence}`,
        },
        {
          name: "si detecta la tarea de revisar el catalogo, el owner es consultor",
          type: "soft",
          pass: output.proposed_tasks
            .filter((t) => hasKeyword(t.title + " " + t.description, ["catalogo", "shopify", "fotos", "packaging"]))
            .every((t) => t.owner === "consultor"),
          detail: `tareas relacionadas: ${JSON.stringify(
            output.proposed_tasks.filter((t) => hasKeyword(t.title + " " + t.description, ["catalogo", "shopify", "fotos", "packaging"])),
          )}`,
        },
      ];
    },
  },
  {
    name: "varios_interlocutores",
    description:
      "3 personas en la llamada (consultor + Marta de marketing + Pedro de operaciones), cada una comprometiendose a una tarea distinta -- el agente deberia atribuir cada tarea a la persona correcta, no colapsar a un 'cliente' generico.",
    transcript: MULTI_SPEAKER_TRANSCRIPT,
    setup: (actorUserId) => createEvalOrgAndCall("varios-interlocutores", "Revision trimestral - equipo cliente", MULTI_SPEAKER_TRANSCRIPT, actorUserId),
    checks: (output) => {
      const allTitlesAndDesc = output.proposed_tasks.map((t) => `${t.title} ${t.description}`).join(" | ").toLowerCase();
      return [
        {
          name: "propone al menos 2 tareas (una por cada persona del cliente)",
          type: "hard",
          pass: output.proposed_tasks.length >= 2,
          detail: `proposed_tasks=${output.proposed_tasks.length}`,
        },
        {
          name: "distingue a Marta (calendario de contenido) de Pedro (stock de seguridad) en vez de fusionarlos",
          type: "soft",
          pass: hasKeyword(allTitlesAndDesc, ["marta"]) && hasKeyword(allTitlesAndDesc, ["pedro"]),
          detail: `tareas propuestas: ${JSON.stringify(output.proposed_tasks.map((t) => t.title))}`,
        },
        {
          name: "detecta la tarea de calendario de contenido (Marta)",
          type: "soft",
          pass: hasKeyword(allTitlesAndDesc, ["calendario", "contenido"]),
          detail: `tareas propuestas: ${JSON.stringify(output.proposed_tasks.map((t) => t.title))}`,
        },
        {
          name: "detecta la tarea de stock de seguridad del almacen norte (Pedro)",
          type: "soft",
          pass: hasKeyword(allTitlesAndDesc, ["stock de seguridad", "almacen"]),
          detail: `tareas propuestas: ${JSON.stringify(output.proposed_tasks.map((t) => t.title))}`,
        },
        {
          name: "cada tarea propuesta tiene owner valido (cliente|consultor)",
          type: "hard",
          pass: output.proposed_tasks.every((t) => t.owner === "cliente" || t.owner === "consultor"),
          detail: `owners: ${output.proposed_tasks.map((t) => t.owner).join(", ")}`,
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
