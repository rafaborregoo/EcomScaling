# Bitácora de implementación F8 — Ejecución y supervisión

## 8.02 — HITL y niveles de aprobación — **hecho** — 2026-09-20

### Alcance implementado

| Capa | Implementación |
| --- | --- |
| Contrato | `packages/contracts/src/hitl-approval.ts`: autonomía graduada, requisitos y estados de aprobación, granularidad, approval package, autoridad, frescura, revocación, escalado, review timing, ownership y estados separados de ejecución. La salida siempre fija `execution_authorized: false`. |
| Motor puro | `evaluateHitlApproval`, con tests de gate material, aprobación existente, contexto incompleto y human-only. El motor es conservador y falla cerrado ante contexto crítico desconocido. |
| Runtime/persistencia | `apps/api/src/hitl-approval-engine.ts` lee la última salida y aprobación del agente, incorpora política declarada sin inventar roles o thresholds, calcula fingerprint y persiste en `hitl_approval_assessment_runs`. |
| Migración/RLS | `supabase/migrations/20260920182834_f8_p02_hitl_approval_assessments.sql`; lectura solo para consultor/platform admin, índices tenant-bound y constraint que impide persistir autoridad de ejecución. |
| Worker/workflow | `apps/worker/src/hitl-approval-once.ts`, script `dev:hitl-approval`/`start:hitl-approval` y `.github/workflows/hitl-approval-f8-p02.yml`. |
| API/pantalla | `GET /v1/consultant/hitl-approval`, `HitlApprovalPanel` y ancla `#insight-hitl-approval`. Muestra autonomía, gate, approval state, execution state, autoridad, scope, freshness y escalado. |
| Copiloto/InsightsMenu | El contexto incorpora F8.02 con tenant, procedencia, unknowns y la regla de no confundir aprobación con ejecución. El feed publica únicamente gates, escalados, human-only y validaciones, y navega a la card exacta. |

### Guardrails y decisiones

- Una instrucción humana no se interpreta como autorización operacional por sí sola.
- Aprobado no significa ejecutado; una acción aprobada puede seguir bloqueada por el executor y los bloques de readiness, envelope, guardrails y verificación.
- La política puede declarar niveles, requisitos y autoridad, pero F8.02 no inventa jerarquías, umbrales monetarios ni roles universales.
- Acciones materiales, irreversibles, de alto riesgo/exposición o con incertidumbre/novedad relevante cruzan gate; la ausencia de aprobación nunca es aprobación implícita.
- El aprendizaje de approvals queda como evidencia contextual; no se convierte automáticamente en autoridad ni amplía autonomía.

### Verificación

- Contrato: 4 tests; runtime: 3 tests; Copiloto/feed: 3 tests; UI/InsightsMenu: 2 tests enfocados.
- Typechecks de contracts, API y web; build de API y worker; `git diff --check` pasan.
- Migración aplicada con `.env.local` y `.env.production.local`; ambos dry-runs informan cero pendientes.
- Smoke real temporal: primero `APPROVAL_REQUIRED/PENDING/BLOCKED`; después aprobación existente `APPROVED/CURRENT` pero `BLOCKED` y `execution_authorized=false`; cleanup confirmado a cero.

### Siguiente rebanada

F8/P16 — handoff y captura del resultado — fue el siguiente bloque habilitado de la ola 1.


## 8.16 — Cierre, handoff y captura del resultado — **hecho** — 2026-09-20

### Alcance implementado

| Capa | Implementación |
| --- | --- |
| Contrato | `packages/contracts/src/closure-handoff.ts`: completion frente a closure, gate, estado final observado, outcome operacional, calidad, madurez, handoff, residual risk y learning package. `CLOSED` no se convierte en éxito de negocio. |
| Motor puro | `evaluateClosureHandoff` con TDD para cierre completo, acciones activas/ownership pendiente y ejecución parcial. El gate exige estado final conocido, verificación explícita, cleanup, riesgo tratado y handoff aceptado cuando aplica. |
| Runtime/persistencia | `apps/api/src/closure-handoff-engine.ts` enlaza la última `agent_output` con tareas materializadas mediante `metadata.agent_output_id`, calcula acciones activas/completadas y persiste idempotentemente en `execution_closure_runs`. |
| Migración/RLS | `supabase/migrations/20260920191350_f8_p16_execution_closure_runs.sql`; lectura tenant-bound para consultor/platform admin y escritura desde el worker service-role. |
| Worker/workflow/API | `apps/worker/src/closure-handoff-once.ts`, scripts `dev:closure-handoff`/`start:closure-handoff`, workflow `.github/workflows/closure-handoff-f8-p16.yml`, `GET /v1/consultant/closure-handoff`. |
| Pantalla | `ClosureHandoffPanel` con ancla `#insight-closure-handoff`: estado, gate, outcome operacional, verificación, calidad, madurez, handoff y esperado frente a real. |
| Copiloto/InsightsMenu | Bloque Copiloto-first F8.16 y feed `F8_16_CLOSURE_HANDOFF`; el menú navega a la card exacta y no confunde cierre, éxito de negocio, outcome maduro ni causalidad. |

### Guardrails y verificación

- No se cierra con acciones activas, incidente crítico abierto, recovery activo, unknown crítico, cleanup incompleto u ownership pendiente.
- Estado esperado y estado real se guardan separados; la falta de evidencia no se convierte en éxito.
- La captura es de solo lectura sobre hechos existentes: no ejecuta tareas, no concede autoridad y no reescribe una intervención cerrada.
- Contrato/runtime, Copiloto/feed, UI/InsightsMenu, typechecks, builds y `git diff --check` pasan.
- Smoke real con `.env.local`: `COMPLETED / gate=false / active_actions`; después, `CLOSED / gate=true / SUCCESS`; cleanup del tenant a cero.
- Migración aplicada en desarrollo y producción; ambos dry-runs informan cero pendientes.

### Siguiente rebanada

La ola 1 de F8 (`8.02` + `8.16`) queda completa. El siguiente bloque de la ola técnica es `8.03`.

## 8.03 — Descomposición de recomendación en execution plan — **hecho** — 2026-09-20

### Alcance implementado

| Capa | Implementación |
| --- | --- |
| Contrato | `packages/contracts/src/execution-plan.ts`: intención, objetivo, alcance, acciones, dependencias, secuencia segura, camino crítico, checkpoints, rollout, controles temporales, presupuestos, criterios de éxito/fallo/rollback, aprobación y entorno. El resultado siempre fija `execution_authorized: false`. |
| Motor puro | `evaluateExecutionPlan` con TDD para secuencia/camino crítico, ciclos, dependencias huérfanas, duplicados, unknowns, presupuestos y approval gate. Un plan listo con aprobación pendiente queda `READY_WITH_APPROVAL`; lo inválido queda `INVALID`. |
| Runtime/persistencia | `apps/api/src/execution-plan-engine.ts` lee las últimas salidas de `recommendation_communication_runs`, `expected_outcome_runs` y `hitl_approval_assessment_runs`, genera el mínimo plan verificable y persiste idempotentemente en `execution_plan_runs`. No llama herramientas ni materializa tareas. |
| Migración/RLS | `supabase/migrations/20260920200847_f8_p03_execution_plans.sql`; tenant-bound, lectura para consultor/platform admin, índices y constraint que impide persistir autorización de ejecución. Aplicada en desarrollo y producción. |
| Worker/workflow/API | `apps/worker/src/execution-plan-once.ts`, scripts `dev:execution-plan`/`start:execution-plan`, workflow `.github/workflows/execution-plan-f8-p03.yml` y `GET /v1/consultant/execution-plans`. |
| Copiloto/InsightsMenu/UI | Nuevo bloque F8.03 en el contexto del Copiloto; feed `F8_03_EXECUTION_PLAN`; `ExecutionPlanPanel` con ancla `#insight-execution-plan`. El menú navega a la card exacta y distingue plan, aprobación y ejecución. |

### Guardrails y verificación

- El plan exige leer antes de escribir, acciones trazables, dependencias sin huérfanos, checkpoints, rollback y presupuestos; no se aceptan ciclos ni scope expansion implícita.
- No se inventan owners, thresholds, cadencias ni entorno: cuando no están declarados quedan configurables o `UNKNOWN`.
- Contrato, runtime, feed Copiloto, UI, typechecks y builds pasan; el test existente del contexto Copiloto se actualizó para los 24 bloques actuales.
- Smoke real con `.env.local`: worker sobre 6 organizaciones, fila temporal `READY_WITH_APPROVAL`, dos acciones, camino crítico `action-1 → action-2` y `execution_authorized=false`; cleanup confirmado a cero.
- `db:push:dry` de desarrollo queda sin pendientes; la migración también se aplicó en producción.

### Siguiente rebanada

La siguiente implementación técnica de F8 es `8.04` (precondiciones y readiness). F8 sigue abierta hasta cerrar todos sus bloques.

## 8.04 — Precondiciones y readiness — **hecho** — 2026-09-20

### Alcance implementado

| Capa | Implementación |
| --- | --- |
| Contrato | `packages/contracts/src/readiness.ts`: dimensiones de readiness, precondiciones hard/soft/critical, evidencia, estado actual/objetivo, aprobación, freshness, ventana, freeze, concurrencia, remediation, safe state y decisión `READY`/`READY_WITH_CONDITIONS`/`WAITING`/`BLOCKED`. La salida fija `execution_authorized: false`. |
| Motor puro | `evaluateReadiness` con TDD: unknown crítico, autorización no lista, degraded measurement, assessment stale, ventanas, freeze, conflictos y remediation. Readiness no se confunde con ejecución. |
| Runtime/persistencia | `apps/api/src/readiness-engine.ts` revalida el último execution plan y HITL, deriva evidencia mínima tenant-bound y persiste idempotentemente en `readiness_assessment_runs`. Ante aprobación pendiente devuelve `BLOCKED`; no escribe ni llama herramientas. |
| Migración/RLS | `supabase/migrations/20260920202151_f8_p04_readiness_assessments.sql`, RLS de consultor/platform admin, índices y constraint de no autorización. Aplicada en desarrollo y producción. |
| Worker/workflow/API | `apps/worker/src/readiness-once.ts`, scripts `dev:readiness`/`start:readiness`, workflow `.github/workflows/readiness-f8-p04.yml` y `GET /v1/consultant/readiness`. |
| Copiloto/InsightsMenu/UI | Bloque F8.04 en el contexto del Copiloto, feed `F8_04_READINESS` y `ReadinessPanel` con ancla `#insight-readiness`; muestra dimensiones, bloqueos, remediation, safe state y revalidación. |

### Guardrails y verificación

- `UNKNOWN` crítico no se optimiza a `READY`; un bloqueo preventivo no es un fallo de ejecución.
- La evaluación exige estado target/current, approval freshness, medición, recovery y revalidación; no fija thresholds universales ni roles de tenant.
- Smoke real con `.env.local`: `BLOCKED`, dimensiones `DATA/TARGET/RECOVERY=READY`, `MEASUREMENT=DEGRADED`, `AUTHORIZATION=NOT_READY`, remediation y `execution_authorized=false`; cleanup a cero.
- Contrato/runtime/Copiloto/UI, typechecks, builds y `db:push:dry` pasan; la migración está aplicada en desarrollo y producción.

### Siguiente rebanada

La siguiente implementación técnica de F8 es `8.05` (scope, límites y action envelope). F8 sigue abierta.
| --- | --- |
| Contrato | `packages/contracts/src/action-envelope.ts`: scope, tools, tipos, objetos, tenant/entorno, magnitud, frescura, violaciones, alternativas y zonas `INSIDE`/`INSIDE_WITH_CONDITIONS`/`OUTSIDE`/`FORBIDDEN`. La salida fija `execution_authorized: false`. |
| --- | --- |
| Contrato | `packages/contracts/src/action-envelope.ts`: scope, tools, tipos, objetos, tenant/entorno, magnitud, frescura, violaciones, alternativas y zonas `INSIDE`/`INSIDE_WITH_CONDITIONS`/`OUTSIDE`/`FORBIDDEN`. La salida fija `execution_authorized: false`. |
| Motor/runtime | `evaluateActionEnvelope` y `apps/api/src/action-envelope-engine.ts`: envelope efectivo desde plan/readiness, validación tenant-bound e idempotencia en `action_envelope_runs`. |
| Worker/API/UI | worker, workflow, `GET /v1/consultant/action-envelope`, `ActionEnvelopePanel`, `#insight-action-envelope`, feed de `InsightsMenu` y bloque Copiloto-first. |
- Migración `20260920203023_f8_p05_action_envelopes.sql` aplicada en desarrollo y producción; F8 sigue abierta y el siguiente bloque es `8.06`.
## 8.05 — Action envelope: scope, límites y autoridad — **hecho** — 2026-09-20

### Alcance implementado

| Capa | Implementación |
| --- | --- |
| Contrato | `packages/contracts/src/action-envelope.ts`: scope, tools, tipos, objetos, tenant/entorno, magnitud, frescura, violaciones, alternativas y zonas `INSIDE`/`INSIDE_WITH_CONDITIONS`/`OUTSIDE`/`FORBIDDEN`. La salida fija `execution_authorized: false`. |
| Motor/runtime | `evaluateActionEnvelope` y `apps/api/src/action-envelope-engine.ts`: envelope efectivo desde plan/readiness, validación tenant-bound e idempotencia en `action_envelope_runs`. |
| Worker/API/UI | worker, workflow, `GET /v1/consultant/action-envelope`, `ActionEnvelopePanel`, `#insight-action-envelope`, feed de `InsightsMenu` y bloque Copiloto-first. |

### Verificación

- Smoke real con `.env.local`: envelope temporal dentro de scope → `INSIDE`, persistencia confirmada, `execution_authorized=false` y cleanup a cero.
- Migración `20260920203023_f8_p05_action_envelopes.sql` aplicada en desarrollo y producción; F8 sigue abierta y el siguiente bloque es `8.06`.
-
## 8.06–8.15 y 8.17 — Supervisión de ejecución — **hecho** — 2026-09-20

Se implementan como etapas explícitas del contrato/runtime común `execution-supervision` sin perder la separación por bloque:

| Bloques | Etapa persistida |
| --- | --- |
| 8.06 | `CAPABILITIES` — capability-first, tool candidate, permission y acting identity. |
| 8.07 | `SAFE_EXECUTION` — read-before-write, cambio idempotente y control de transición. |
| 8.08 | `MONITORING` — observabilidad, side effects y estado desconocido. |
| 8.09 | `GUARDRAILS` — stop/hold/continue y barrera de envelope. |
| 8.10 | `LIFECYCLE` — estados y transiciones explícitas. |
| 8.11 | `INCIDENTS` — clasificación y respuesta conservadora. |
| 8.12 | `ROLLBACK_RECOVERY` — recovery/rollback y estado seguro. |
| 8.13 | `OVERRIDE_ESCALATION` — takeover humano, escalado y revocación. |
| 8.14 | `CONCURRENCY` — admission control y ausencia de conflicto. |
| 8.15 | `VERIFICATION` — estado final esperado frente a observado. |
| 8.17 | `REPORTING` — evidencia operativa y handoff de reporting. |

`packages/contracts/src/execution-supervision.ts` contiene el contrato y el motor puro TDD; `apps/api/src/execution-supervision-engine.ts` deriva las once evaluaciones desde plan/readiness/action envelope, persiste idempotentemente en `execution_supervision_runs` y nunca ejecuta tools. Worker, workflow, endpoint `GET /v1/consultant/execution-supervision`, Copiloto, feed de `InsightsMenu` y `ExecutionSupervisionPanel` quedan conectados.

### Verificación

- Smoke real con `.env.local`: 11 etapas procesadas (`CAPABILITIES:BLOCKED`, `SAFE_EXECUTION:READY`, `MONITORING:CONDITIONAL`, `GUARDRAILS:READY`, `LIFECYCLE:READY`, `INCIDENTS:CONDITIONAL`, `ROLLBACK_RECOVERY:READY`, `OVERRIDE_ESCALATION:BLOCKED`, `CONCURRENCY:READY`, `VERIFICATION:BLOCKED`, `REPORTING:CONDITIONAL`), todas con `execution_authorized=false` y cleanup a cero.
- Contrato/runtime/API/worker/UI/Copiloto y typechecks pasan. Migración `20260920204142_f8_p06_p17_execution_supervision.sql` aplicada en desarrollo y producción.
- F8 completa técnicamente: 8.02, 8.03, 8.04, 8.05, 8.06–8.15, 8.16 y 8.17 están hechos.
-
## 8.00–8.17 — Cierre completo de F8 — **hecho** — 2026-09-20

Las etapas raíz `UNIVERSAL` y `EXECUTABILITY_AUTHORIZATION` completan el
framework: separan recomendación, intención, decisión, acción, ejecución,
resultado técnico y resultado de negocio; además obligan a evaluar
ejecutabilidad, capability, readiness, envelope y autoridad explícita. Se
mantiene `execution_authorized=false` incluso cuando una etapa está `READY`.

La migración `20260920204900_f8_p00_p01_stage_roots.sql` amplía la constraint
de etapas de `execution_supervision_runs`. La pantalla y el Copiloto muestran
ahora F8.00 y F8.01 junto al resto de la supervisión. Smoke y cleanup real se
repiten sobre `.env.local` al cerrar la fase.

## Cierre de los bloques en esqueleto — 2026-09-24

| Bloque | Evaluador | Decisión propia |
| --- | --- | --- |
| `8.00` | `execution-framework.ts` | etapa alcanzada del flujo universal; `SEQUENCE_BROKEN` si se ejecutó saltándose un paso; context drift |
| `8.01` | `executability-authorization.ts` | ejecutabilidad por acción; capacidad, acceso y autoridad separados; preparar ≠ ejecutar; modo de ejecución y handoff |
| `8.06` | `execution-capabilities.ts` | acción → capacidad → tools candidatas del registro real; mínimo privilegio; hueco de capacidad nombrado |
| `8.07` | `safe-execution.ts` | pre-commit check del plan (pre-state, diff, punto de no retorno, presupuesto); `PREPARE_ONLY` sin operación de proveedor |
| `8.08` | `execution-monitoring.ts` | plan de monitorización antes; salud (`HEALTHY`…`BLIND`) y respuesta del §37 durante |
| `8.09` | `execution-guardrails.ts` | siete guardrails con estado y respuesta; señal ausente en uno duro = fail closed; gana la respuesta más protectora |
| `8.11` | `execution-incidents.ts` | bloqueo ≠ fallo; resultado desconocido; severidad por factores; contención |
| `8.12` | `rollback-recovery.ts` | preparación de recovery; reversibilidad técnica ≠ de negocio; rollback / roll forward / compensar / contener; no declarar recuperado sin verificación |
| `8.13` | `override-escalation.ts` | motivos, destino, urgencia; overrides que admite la máquina de 8.10; sin destino = vacío de control |
| `8.14` | `execution-concurrency.ts` | admisión `ADMIT` / `COORDINATE` / `QUEUE` (single writer) / `DUPLICATE` |
| `8.15` | `execution-verification.ts` | verificable antes; `PENDING` hasta observar el estado real; esperado ≠ real es `FAILED` aunque la tool dijera éxito |
| `8.17` | `execution-reporting.ts` | informe al consultor y al cliente compuesto con los demás bloques; nunca "hecho" de algo sin ejecutar |

Tests: `packages/contracts/src/execution-supervision-blocks.test.ts` (38),
`apps/api/src/execution-supervision-engine.test.ts` (4, traducción filas → foto),
`apps/web/.../execution-supervision-view-model.test.ts` (4; de paso arregla que el
panel mostraba la evaluación más antigua de cada etapa en vez de la más reciente).
