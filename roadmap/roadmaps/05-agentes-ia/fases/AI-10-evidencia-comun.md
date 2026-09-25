# AI-10 - Envolvente comun IA <-> Frontend

> Correccion de catalogo 2026-08-21: `AGENT_CATALOG` ya existe en
> `packages/contracts/src/index.ts` con nombres de producto y estado `implemented`/`prepared`.
> La traza del panel tecnico usa el nombre humano y conserva el codigo interno como detalle; la
> afirmacion historica de que el mapeo no existia queda supersedida.

## Estado

### Estado actualizado 2026-07-22

La envolvente comun ya existe en `packages/contracts/src/index.ts` como `AgentOutputEnvelope<TContent>`
con `AgentSourceReference` y `AgentProposal`. `apps/api/src/ai-runtime.ts` la anade de forma aditiva a
los diagnosticos cacheados de A02/A04/A06/A08 y a las respuestas de chat A09; los payloads legacy (`output`,
`output_status`, `generated_at`) se mantienen para compatibilidad. `AiDiagnosticSection` ya muestra freshness
y el numero de fuentes sin interpretar warnings como unica senal.

- **Estado real:** `implemented_partial` — **corregido 2026-07-23**: la cabecera de este documento seguia
  diciendo `planned`/"no existe hoy ninguna envolvente comun" (ver seccion "Evidencia de implementacion" mas
  abajo, que ya documentaba lo contrario desde el 2026-07-22) — desactualizacion real del propio documento,
  no del codigo. Verificado contra codigo real: `AgentOutputEnvelope`/`AgentSourceReference`/`AgentProposal`
  existen tal cual en `packages/contracts/src/index.ts` (no solo como contrato en este doc, coinciden campo
  por campo), y `buildAgentOutputEnvelope` (`apps/api/src/ai-runtime.ts`) los rellena en 3 sitios reales:
  `getCachedDiagnostic` (A02/A04/A06/A08, cache-hit y fresh) y `runConsultantChatTurn` (A09). Los 2 primeros
  criterios de cierre ya se cumplen (envolvente usada por 4 agentes de diagnostico + el copiloto, con
  `content: AgentOutput` y `content: ChatOutput`).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** AI-00, AI-01, AI-02, AI-05
- **Bloqueador:** ninguno
- **Evidencia:** `packages/contracts/src/index.ts` (tipos), `apps/api/src/ai-runtime.ts` (`buildAgentOutputEnvelope`,
  `getCachedDiagnostic`, `runConsultantChatTurn`), `apps/web/src/components/ai-diagnostic-section.tsx` (el
  frontend ya lee `envelope.freshness.status`/`envelope.sources.length` en vez de solo `warnings`, ver linea
  con "datos {freshness.status} · N fuente(s)"). Metadatos de ejecucion en `agent_runs`
  (`supabase/migrations/20260717200000_db_08a_runtime_agentes.sql` +
  `20260722190000_ai_09_budget_status.sql` para `budget_exceeded`).
- **Gaps identificados (reales, verificados en codigo, no el estado obsoleto de arriba):**
  - **`freshness.status` es hoy efectivamente siempre `"fresh"`** — hallazgo real 2026-07-23:
    `buildAgentOutputEnvelope` tiene `freshness: { status: fromCache ? "fresh" : "fresh", ... }` (ambas ramas
    del ternario devuelven el mismo valor), y `getCachedDiagnostic` solo sirve un run cacheado cuando ya paso
    el chequeo `isFresh` (`< DIAGNOSTIC_STALE_AFTER_MS`, 24h) -- un diagnostico mas viejo nunca se sirve como
    `"stale"`, se regenera en su lugar. Los valores `"stale"`/`"superseded"` del tipo son alcanzables en el
    schema pero no hay ninguna rama de codigo que los produzca hoy. No es un bug (el frontend nunca muestra
    un dato viejo como si fuera nuevo, porque nunca sirve datos viejos), pero el criterio de cierre "el
    frontend usa `freshness.status` en vez de `warnings`" esta solo parcialmente cumplido: el campo se lee,
    pero no transmite informacion real todavia porque solo tiene un valor posible en la practica.
  - `AgentSourceReference` en uso real tiene `kind` mapeado desde el `agentSourceSchema` legacy
    (`sourceKind()` en `ai-runtime.ts`: `metric`->`metric`, `table`/`tool`->`sql_result`, `document`->`document`,
    cualquier otro->`integration`) pero `location`/`href` nunca se rellenan (siguen `undefined` como preveia
    este documento) -- depende de que RAG (AI-04) y transcripciones (AI-01) cierren su propio gap de
    localizacion precisa, sigue fuera de alcance.
  - `AgentProposal.type` en uso real solo distingue `"create_task"` vs `"update_plan"` (deriva de
    `item.kind === "task"`) -- el resto del enum (`update_task`, `publish_summary`, `create_alert`,
    `request_reauthorization`) no se genera desde ningun agente todavia, es aspiracional.
  - `quality.groundedness`/`quality.dataCompleteness` se calculan con una heuristica minima real
    (`sources.length > 0 ? "partially_supported" : "insufficient_evidence"`), no con evaluacion real de
    groundedness -- correcto que siga fuera de alcance de este documento (depende de AI-06).
  - Los nombres internos (`A01`..`A09`) no tienen hoy un nombre de producto mapeado en ningun sitio del
    codigo ni la documentacion, mas alla de la tabla de este mismo doc.
- **Siguiente accion:** decidir si vale la pena que `freshness.status` distinga `"stale"` de verdad (ej.
  servir un diagnostico cacheado mas alla de 24h con `status: "stale"` en vez de bloquear en regenerar) o si
  el patron actual (siempre regenerar, nunca mostrar stale) es preferible y el campo se simplifica/documenta
  como "reservado, no usado hoy" en vez de dejarlo pareciendo mas rico de lo que es.

## Objetivo

Definir una envolvente comun que todo output de agente comparte (ejecucion, alcance, freshness, calidad,
fuentes, propuestas), dejando el contenido especifico de cada agente como un payload tipado aparte — nunca
forzado dentro de un unico schema gigante. Sin esto, cada pantalla que muestra un resultado de IA
reinventa su propia forma de comunicar "de donde sale esto y cuando caduca".

## Contrato historico y gaps pendientes

La envolvente base ya está implementada y utilizada; esta sección conserva el
contrato ampliado y señala únicamente los campos o transiciones que aún no
están completos en código. No debe interpretarse como ausencia de
`AgentOutputEnvelope`.

```ts
type AgentOutputEnvelope<TContent> = {
  run: {
    id: string; // agent_runs.id
    agentCode: string; // agent_runs.agent_definition_id -> agent_definitions.code
    agentVersion: string; // agent_versions.version
    status: AgentRunStatus; // ver maquina de estados abajo
    generatedAt: string; // agent_runs.created_at
    completedAt?: string; // agent_runs.finished_at
    fromCache: boolean; // hoy implicito en getCachedDiagnostic (AI-02), no un campo explicito
  };

  scope: {
    organizationId: string; // agent_runs.organization_id -- ya existe
    storeId?: string; // agent_runs.store_id -- ya existe desde AI-05
    period?: { from: string; to: string; timezone: string }; // no existe hoy como campo estructurado
    dataSnapshotId?: string; // no existe -- necesario para invalidar diagnostico tras un sync (ver AI-02 gap)
    financialConfigVersion?: string; // no existe -- depende de que DB-03 cierre calculation_version
  };

  freshness: {
    status: "fresh" | "stale" | "superseded";
    reason?: string;
    validUntil?: string;
  }; // concepto nuevo, no existe en ningun schema actual

  quality: {
    confidence: "low" | "medium" | "high"; // ya existe: agentOutputSchema.confidence / chatOutputSchema.confidence
    groundedness: "verified" | "partially_supported" | "insufficient_evidence"; // nuevo, depende de AI-06
    dataCompleteness: "complete" | "partial" | "insufficient"; // nuevo
    warnings: string[]; // ya existe: agentOutputSchema.warnings
  };

  sources: AgentSourceReference[]; // reemplaza/extiende agentSourceSchema, ver gap arriba

  content: TContent; // AgentOutput | ChatOutput | CallSummaryOutput -- sin cambios, cada agente conserva su forma

  proposals: AgentProposal[]; // generaliza proposed_writes (generico) y proposed_tasks (A01)
};
```

`content` **nunca** se reemplaza por un schema unico: `AgentOutput` (A02/A04/A06/A08), `ChatOutput` (A09) y
`CallSummaryOutput` (A01) siguen siendo tres formas de dominio distintas, tal como ya estan hoy en
`packages/ai/src/index.ts`. La envolvente solo estandariza lo que hoy se resuelve de forma distinta en cada
endpoint: ejecucion, alcance, freshness, calidad y fuentes.

### Fuentes: de `agentSourceSchema` a `AgentSourceReference`

```ts
type AgentSourceReference = {
  id: string;
  kind:
    | "metric"
    | "sql_result"
    | "document"
    | "transcript"
    | "alert"
    | "task"
    | "integration";
  label: string;
  organizationId: string;
  storeId?: string;
  period?: { from: string; to: string };
  generatedAt?: string;
  location?: {
    page?: number;
    section?: string;
    paragraph?: number;
    timestampStart?: number;
    timestampEnd?: number;
  };
  href?: string;
};
```

Migrar `agentSourceSchema` (`kind: metric|table|tool|document`) a esta forma es un cambio de contrato que
toca A01/A02/A04/A06/A08/A09 a la vez — no se hace parcialmente. `kind` se amplia (`sql_result` en vez de
`table`/`tool` separados, mas `transcript`/`alert`/`task`/`integration` para citar entidades del producto,
no solo datos). `location` solo lo puede rellenar RAG (AI-04) y transcripciones (AI-01) cuando esos
documentos cierren su propio gap de localizacion precisa — hasta entonces queda `undefined`, nunca
inventado.

### Propuestas: de `proposed_writes`/`proposed_tasks` a `AgentProposal`

```ts
type AgentProposal = {
  id: string;
  type:
    | "create_task"
    | "update_task"
    | "publish_summary"
    | "create_alert"
    | "update_plan"
    | "request_reauthorization";
  title: string;
  explanation: string;
  target: { entityType: string; entityId?: string };
  impact?: {
    severity: "low" | "medium" | "high" | "critical";
    reversible: boolean;
  };
  approval: { required: boolean; allowedRoles: string[] };
  idempotencyKey: string;
  status:
    | "proposed"
    | "pending_approval"
    | "approved"
    | "rejected"
    | "executing"
    | "executed"
    | "failed"
    | "expired"
    | "superseded";
};
```

Hoy `agentProposedWriteSchema` (`kind: task|note`) y `callProposedTaskSchema` no tienen `idempotencyKey` ni
`status` propio — el estado de aprobacion vive en `agent_outputs.status`
(`draft|pending_approval|approved|rejected|published`, constraint real) a nivel del output completo, no
por propuesta individual. Introducir `AgentProposal.status` por-propuesta es necesario para el caso donde
un resumen de llamada aprobado crea 4 tareas pero 1 se rechaza — hoy eso no es representable.

## Maquina de estados de ejecucion (formaliza lo que hoy solo es un constraint)

```
queued -> running -> succeeded | failed | rejected_output | budget_exceeded | cancelled
```

`agent_runs.status` real hoy (`running`, `succeeded`, `failed`, `rejected_output`, y `budget_exceeded`
desde AI-09) no incluye `queued` ni `cancelled` como valores de constraint — si se necesitan, es una
migracion de DB-08a, no solo un cambio de este documento. Estados derivados de presentacion
(`fresh`/`stale`/`superseded`, `pending_approval`/`published` ya existen en `agent_outputs.status`) se
calculan a partir de `freshness`/`quality` de la envolvente, nunca se guardan como columna nueva de
`agent_runs`.

## Nombres de producto (no exponer codigos internos al cliente)

| Codigo | Superficie visible al cliente | Solo visible en panel tecnico/consultor |
| ------ | ----------------------------- | --------------------------------------- |
| A01    | Resumen de llamada            | `A01`                                   |
| A02    | Diagnostico del negocio       | `A02`                                   |
| A03    | Analisis de adquisicion       | `A03` (bloqueado)                       |
| A04    | Plan de prioridades           | `A04`                                   |
| A05    | Estrategia de campañas        | `A05` (bloqueado)                       |
| A06    | Planificacion de stock        | `A06`                                   |
| A07    | Rendimiento de contenido      | `A07` (bloqueado)                       |
| A08    | Estado del conocimiento       | `A08`                                   |
| A09    | Copiloto                      | `A09`                                   |

El mapeo vive aqui como referencia; implementarlo es anadir un campo `displayName`/catalogo en
`agent_definitions` o en el frontend — no existe todavia en ningun sitio.

## Criterios de cierre

- [x] `AgentOutputEnvelope` implementado como tipo compartido en `@e-nora/contracts`, usado por al
      menos dos agentes (uno con `content: AgentOutput`, uno con `content: ChatOutput`) — cumplido: A02/A04/
      A06/A08 (`AgentOutput`) + A09 (`ChatOutput`), verificado 2026-07-23.
- [x] `AgentSourceReference` sustituye a `agentSourceSchema` en al menos un agente sin romper los ya
      migrados — cumplido: `sourceKind()` mapea el legacy a los 5 agentes con envolvente, sin romper el
      payload `output.sources` legacy que se sigue guardando en paralelo.
- [ ] El frontend deja de inspeccionar `warnings` como texto libre para decidir si un resultado esta
      desactualizado — usa `freshness.status`. **Parcial**: el frontend ya lee `freshness.status` (no
      `warnings`), pero el backend solo produce el valor `"fresh"` hoy (ver gap de arriba) — el criterio esta
      tecnicamente conectado de punta a punta, pero no aporta senal real todavia porque no hay otro valor
      posible en la practica.

## Fuera de alcance de este documento

- Rellenar `groundedness`/`dataCompleteness` con datos reales — depende de que AI-06 tenga datasets de
  evaluacion, no es un problema de contrato.
- Decidir `dataSnapshotId`/`financialConfigVersion` reales — dependen de DB-03 (`calculation_version`) y de
  que exista un snapshot de sync identificable, ninguno de los dos cerrado hoy.
- Migrar los 5 agentes existentes a la envolvente de una sola vez — se hace agente por agente, empezando
  por el que el usuario elija.

### Evidencia de implementacion

La primera migracion cubre los cinco puntos de entrada prioritarios sin cambiar sus schemas de contenido:
los cuatro diagnosticos automaticos comparten `AgentOutputEnvelope<AgentOutput>` y el copiloto comparte
`AgentOutputEnvelope<ChatOutput>`. Las fuentes que no traen una referencia valida se omiten, nunca se
rellenan con identificadores inventados; las propuestas reciben una clave idempotente derivada del run.
La calidad se marca como `partially_supported` cuando hay fuentes y `insufficient_evidence` cuando no las
hay, dejando claro que la envolvente no convierte por si sola una salida de modelo en verdad canonica.
