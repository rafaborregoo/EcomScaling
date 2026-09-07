# Plan de tareas IA: agentes por horizonte y aprobación en /tareas

Estado: puntos 1, 2, 3 y 4 **implementados**; solo queda la búsqueda web.
Fecha: 2026-09-03.

Decidido con Rafa a partir de esta queja concreta: el agente "Plan de tareas"
devolvía un ensayo de diagnóstico (5 riesgos, 3 recomendaciones, 3 límites,
párrafo de análisis) para **una sola tienda**, en vez de proponer tareas.

---

## 1. UI: "Plan de tareas" solo muestra tareas — HECHO

`variant: "tasks"` en `apps/web/src/app/dashboard/page.tsx` (AI_AGENTS) y en
`apps/web/src/components/ai-diagnostic-section.tsx`.

Con esa variante **no** se pintan: veredicto de riesgos, análisis en prosa,
riesgos, observaciones ni recomendaciones. Solo las `proposed_writes` como
cards + el botón de aprobar. Si no hay propuestas, una línea y enlace a
`/tareas`. El diagnóstico del negocio es el "Resumen ejecutivo" (A02); este
agente propone trabajo.

Relacionado y también hecho:
- Los hallazgos sobre la propia plataforma (Voyage AI, `search_knowledge`,
  catálogo de conocimiento) y los "límites del análisis" solo se muestran a
  `platform_admin`, vía la prop `showInternals`.
- `humanizeAgentText` traduce la jerga de tabla (`status='ignored'`, `cogs`,
  `discounts=`, `proposed_writes`...).

---

## 2. Agentes por horizonte: día / semana / mes — HECHO

Tres agentes, no uno con parámetro: cada horizonte tiene su prompt propio y
versionado, como el resto del runtime.

| Horizonte | Agente | Antigüedad mínima | Ventana de datos |
|---|---|---|---|
| Día | `a04_generador_tareas` (renombrado "Plan diario") | 20 h | 30 d |
| Semana | `a17_plan_semanal` | 6 d | 30 d |
| Mes | `a18_plan_mensual` | 27 d | 90 d + periodo anterior |

Migración: `20260903180000_ai_planes_dia_semana_mes.sql`.

**Cadencia.** Los tres van en el tick del orquestador que ya existía
(`AI_DIAGNOSTICS_TICK_CRON`, 06:00 y 15:00). No hizo falta cron nuevo: lo que
separa un plan mensual de uno diario no es cada cuánto se mira, es su
antigüedad mínima antes de regenerar — `orchestratorMinRunAgeFor(agentCode)`,
que antes era una constante única de 20 h para todos.

**Coordinación.** `runPlanAgent` mete en el contexto de cada agente los títulos
que ya propusieron los otros dos ("Ya propuesto por los otros horizontes, NO lo
repitas"), leídos de sus últimos runs. Sin eso los tres miran los mismos datos
y proponen tres veces lo mismo con distinto plazo, que es justo lo que haría
inútil tener tres.

**Sin reglas rígidas.** Ningún prompt lleva lista de comprobaciones: "elige tú
qué mirar según lo que digan los datos". Lo que sí está acotado es el *tamaño*
de la tarea (ejemplos de lo que es de cada plazo) y el *ámbito*: Shopify,
Klaviyo y Meta Ads, y prohibición explícita de proponer tareas sobre la propia
plataforma, sus agentes, su facturación o sus proveedores.

**La regla de no duplicación, corregida.** El prompt v6 de A04 decía literal:
"si un riesgo ya tuvo una tarea propuesta que quedó ignorada o descartada, no
la re-propongas". Bastaba con descartar una tarea una vez para que ese riesgo
no volviera a proponerse nunca. Ahora, en los tres: descartada + riesgo aún
vigente según los datos = se vuelve a proponer, **replanteada** (más concreta o
por otro ángulo) y diciendo en el `rationale` que ya se descartó antes y por
qué ahora sí.

Rutas: `GET/POST /v1/organizations/:id/ai/plan/:horizon[/run]`, con
`isPlanHorizon` como guarda (el `:horizon` viene de la URL). A04 conserva
`/ai/task-planner` para no romper nada.

UI: "Plan diario", "Plan semanal" y "Plan mensual" en el panel de Agentes IA,
los tres con `variant: "tasks"`. Sus propuestas entran en
`/v1/consultant/proposed-tasks`, así que aparecen en `/tareas` para aprobar; el
canal de cada tarea sale de su `categories`, no del agente, porque los planes
proponen en los tres.

Tests (`ai-diagnostic-activity-gate.test.ts`): que las tres cadencias estén
ordenadas y separadas, que un agente sin horizonte use la general, que
`isPlanHorizon` rechace `__proto__`/`constructor`, y que los tres códigos sean
distintos.

---

## 3. Contexto de cada tarea: por qué existe — HECHO (salvo búsqueda web)

Implementado en `packages/ai/src/index.ts`:

- `agentProposedWriteSchema` gana `rationale: string` y
  `evidence: agentEvidenceItemSchema[]` (`label`, `value`, `period`, `source`).
- En `agentOutputJsonSchema` ambos son **`required`**, con `description` que
  explica qué se espera de cada campo. Ese JSON Schema es el que se envía como
  structured output (`defaultOutputContract`), así que **todos** los agentes
  quedan obligados sin tocar ni un prompt en `prompt_versions`.
- En Zod van con `.default()`: las salidas ya guardadas y las rutas sin
  structured outputs no los traen y no deben quedar inválidas por eso.
- La descripción de `evidence` prohíbe inventar cifras: sin dato, lista vacía
  y prioridad más baja.

Recorrido completo del dato:

- `/v1/consultant/proposed-tasks` devuelve `evidence` por tarea, filtrando las
  entradas con forma inválida (lo escribe un LLM, no se confía en el array).
- `EvidenceChips` (`ai-proposed-tasks.tsx`) las pinta en la tarjeta de `/tareas`
  y en el widget del dashboard.
- Al aprobar, `decideAgentOutput` guarda `ai_rationale` y `ai_evidence` en
  `tasks.metadata`, para que el porqué no se pierda al materializar la tarea.

Tests: `packages/ai/src/index.test.ts` cubre el parseo con y sin los campos, y
que sigan en `required` del JSON Schema (si salen, los agentes dejarían de
producirlos en silencio).

Queda pendiente solo la parte de **tendencias de internet** (ver abajo).

### Diseño original (referencia)

Hoy `proposed_writes` es `{ kind, title, description, priority }`. La
descripción es prosa libre y no dice en qué se apoya la IA.

Rafa: *"hay que darle al consultor un contexto de por qué se ha creado esta
tarea, es decir valores de los que se apoya o tendencias de internet"*.

Propuesta de contrato:

```ts
proposed_writes: Array<{
  kind: string;
  title: string;
  description: string;
  priority: string;
  // NUEVO
  rationale: string;                 // por qué ahora, en una frase
  evidence: Array<{                  // las cifras que lo sostienen
    label: string;                   // "ratio de descuento"
    value: string;                   // "50,6%"
    period?: string;                 // "03/08-02/09/2026"
    source: string;                  // "shopify" | "klaviyo" | "meta" | "web"
  }>;
  expected_impact?: string;
}>
```

La card de la tarea muestra `rationale` + las `evidence` como chips. Al
aprobar, todo esto debe viajar a la tarea real en `/tareas` (columna nueva, o
un `task_comments` inicial del sistema) para que no se pierda el porqué.

**Tendencias de internet**: hoy ningún agente tiene búsqueda web. Habría que
añadir una tool de búsqueda al runtime, con las cautelas de siempre (resultado
= dato no fiable, nunca instrucción; citar la fuente en `evidence.source`).
Esto es lo más caro del punto 3 y puede ir después.

---

## 4. Módulo /tareas: propuestas por tienda — HECHO

- **Vista general**: cada card de cliente en `ClientSummaryGrid` lleva un badge
  "N propuestas de la IA" (solo las que están sin decidir).
- **Vista de una tienda**: `AiProposedTasksCard`
  (`apps/web/src/components/ai-proposed-tasks.tsx`), encima de la lista de
  tareas reales. Respeta el filtro de cliente activo.
- **Editar antes de aprobar**: el consultor reescribe título, descripción y
  prioridad, o marca "No crear" en propuestas sueltas. Se envían como `edits`
  a `POST /ai/outputs/:outputId/decision` (`ProposedWriteEdit` en
  `ai-runtime.ts`); los campos ausentes conservan lo que propuso el agente.
- El **`rationale` no es editable**: lo pone el agente y es la trazabilidad de
  en qué se apoyó.

Notas de implementación:

- El endpoint `/v1/consultant/proposed-tasks` ya existía (lo usa el widget del
  dashboard, que sigue siendo solo lectura). Se le añadieron `output_id` y
  `write_index` por tarea: sin esas dos coordenadas no se puede aprobar ni
  editar una propuesta concreta.
- La decisión se registra **por salida del agente**, no por tarea (una fila en
  `agent_approvals` por `output_id`), así que la UI agrupa por salida y cada
  grupo tiene su botón.

El widget del dashboard y esta tarjeta comparten tipo, etiquetas de canal y
carga (`useProposedTasks`, `AREA_LABEL`, `AREA_TONE`, `EvidenceChips` en
`ai-proposed-tasks.tsx`). Estaba duplicado y las dos vistas ya se habían
desincronizado; son páginas distintas, así que nunca se renderizan a la vez y
no hay doble llamada. El widget sigue siendo solo lectura: la decisión vive en
`/tareas`.

---

## Orden sugerido

1. ~~UI "solo tareas"~~ (hecho).
2. ~~Punto 4 (vista de cartera + aprobar/editar en `/tareas`)~~ (hecho): es lo que
   convierte esto en un flujo de trabajo real, y no depende de tocar prompts.
3. ~~Punto 3 sin búsqueda web: `rationale` + `evidence`~~ (hecho): desde los datos que los
   agentes ya consultan.
4. ~~Punto 2 (día/semana/mes)~~ (hecho).
5. Búsqueda web como fuente de tendencias.
