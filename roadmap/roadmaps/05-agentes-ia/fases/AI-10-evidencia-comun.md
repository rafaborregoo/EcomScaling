# AI-10 - Envolvente comun IA <-> Frontend

## Estado

### Estado actualizado 2026-07-22

La envolvente comun ya existe en `packages/contracts/src/index.ts` como `AgentOutputEnvelope<TContent>`
con `AgentSourceReference` y `AgentProposal`. `apps/api/src/ai-runtime.ts` la anade de forma aditiva a
los diagnosticos cacheados de A02/A04/A06/A08 y a las respuestas de chat A09; los payloads legacy (`output`,
`output_status`, `generated_at`) se mantienen para compatibilidad. `AiDiagnosticSection` ya muestra freshness
y el numero de fuentes sin interpretar warnings como unica senal.

- **Estado real:** `planned` (no iniciado — el roadmap ya preveia este documento en
  `roadmap/roadmaps/05-agentes-ia/README.md` como "formato universal de evidencia", pero nunca se escribio
  hasta ahora).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** AI-00, AI-01, AI-02, AI-05
- **Bloqueador:** ninguno
- **Evidencia:** este documento es contrato, no implementacion. Los payloads de dominio que envuelve **si**
  existen ya en `packages/ai/src/index.ts`: `agentOutputSchema` (A02/A04/A06/A08), `chatOutputSchema`
  (A09), `callSummaryOutputSchema` (A01). Los metadatos de ejecucion viven en `agent_runs`
  (`supabase/migrations/20260717200000_db_08a_runtime_agentes.sql` +
  `20260722190000_ai_09_budget_status.sql` para `budget_exceeded`).
- **Gaps identificados:**
  - No existe hoy ninguna envolvente comun: cada endpoint que sirve un output de agente al frontend expone
    su propio shape ad-hoc a partir de `agent_runs` + el payload de dominio.
  - `agentSourceSchema` actual (`kind: metric|table|tool|document`, `reference: string`,
    `period: string|null`) es mucho mas pobre que lo que necesita una cita auditable: sin `organizationId`,
    sin `storeId`, sin `location` (pagina/seccion/timestamp), sin `href`. Migrar esto es cambio de contrato,
    no solo de documentacion (ver AI-04 para el gap de citas de RAG).
  - No existe `freshness`/`quality` como concepto en ningun schema — hoy la unica señal de "estos datos
    pueden estar desactualizados" es el campo libre `warnings: string[]`.
  - Los nombres internos (`A01`..`A09`) no tienen hoy un nombre de producto mapeado en ningun sitio del
    codigo ni la documentacion.
- **Siguiente accion:** cuando se implemente, empezar por el campo `scope` (organizationId/storeId/period),
  que ya existe como dato real en `agent_runs.store_id` — es el que menos invento requiere.

## Objetivo

Definir una envolvente comun que todo output de agente comparte (ejecucion, alcance, freshness, calidad,
fuentes, propuestas), dejando el contenido especifico de cada agente como un payload tipado aparte — nunca
forzado dentro de un unico schema gigante. Sin esto, cada pantalla que muestra un resultado de IA
reinventa su propia forma de comunicar "de donde sale esto y cuando caduca".

## Contrato (documentado aqui, no implementado en codigo todavia)

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
  kind: "metric" | "sql_result" | "document" | "transcript" | "alert" | "task" | "integration";
  label: string;
  organizationId: string;
  storeId?: string;
  period?: { from: string; to: string };
  generatedAt?: string;
  location?: { page?: number; section?: string; paragraph?: number; timestampStart?: number; timestampEnd?: number };
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
  type: "create_task" | "update_task" | "publish_summary" | "create_alert" | "update_plan" | "request_reauthorization";
  title: string;
  explanation: string;
  target: { entityType: string; entityId?: string };
  impact?: { severity: "low" | "medium" | "high" | "critical"; reversible: boolean };
  approval: { required: boolean; allowedRoles: string[] };
  idempotencyKey: string;
  status: "proposed" | "pending_approval" | "approved" | "rejected" | "executing" | "executed" | "failed" | "expired" | "superseded";
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
| --- | --- | --- |
| A01 | Resumen de llamada | `A01` |
| A02 | Diagnostico del negocio | `A02` |
| A03 | Analisis de adquisicion | `A03` (bloqueado) |
| A04 | Plan de prioridades | `A04` |
| A05 | Estrategia de campañas | `A05` (bloqueado) |
| A06 | Planificacion de stock | `A06` |
| A07 | Rendimiento de contenido | `A07` (bloqueado) |
| A08 | Estado del conocimiento | `A08` |
| A09 | Copiloto | `A09` |

El mapeo vive aqui como referencia; implementarlo es anadir un campo `displayName`/catalogo en
`agent_definitions` o en el frontend — no existe todavia en ningun sitio.

## Criterios de cierre

- `AgentOutputEnvelope` implementado como tipo compartido en `@ecomscaling/contracts`, usado por al menos
  dos agentes (uno con `content: AgentOutput`, uno con `content: ChatOutput`).
- `AgentSourceReference` sustituye a `agentSourceSchema` en al menos un agente sin romper los ya migrados.
- El frontend deja de inspeccionar `warnings` como texto libre para decidir si un resultado esta
  desactualizado — usa `freshness.status`.

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
