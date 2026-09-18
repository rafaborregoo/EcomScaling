# Bitacora de implementacion F7 - Motor de recomendaciones

Esta fase convierte el catalogo de intervenciones en decisiones que el
Copiloto puede consultar con prudencia. Cada bloque conserva la separacion
entre contrato, motor y pixel; que una intervencion sea elegible no significa
que este priorizada, seleccionada, autorizada ni ejecutada.

## 7.01 - Elegibilidad de una intervencion - **hecho** - 2026-09-18

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-eligibility.ts` y export desde `packages/contracts/src/index.ts`. Incluye disposiciones de elegibilidad, estados del run, unknowns, condiciones, blockers, reason codes y `source_refs`. |
| Migracion | `supabase/migrations/20261030100000_f7_p01_intervention_eligibility.sql`. Tabla tenant-bound `intervention_eligibility_runs`, fingerprint idempotente, RLS y lectura para consultor/platform admin. |
| Motor puro | `evaluateInterventionEligibility` y `evaluateInterventionEligibilitySet`. Evalua todos los candidatos sin ranking ni seleccion. Los unknowns y los prerequisitos no demostrados bloquean una conclusion fuerte. |
| Motor impuro | `apps/api/src/intervention-eligibility-engine.ts`. Lee diagnosticos, decision output y catalogo activo de playbooks; construye un contexto por organizacion, calcula el fingerprint y persiste de forma idempotente. |
| Worker/workflow | `apps/worker/src/intervention-eligibility-once.ts`, scripts del worker y `.github/workflows/intervention-eligibility-f7-p01.yml`. El workflow es manual (`workflow_dispatch`) hasta que exista una politica de frecuencia aprobada. |
| API/pixel | Endpoint `GET /v1/consultant/intervention-eligibility` y panel `InterventionEligibilityPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-eligibility`. La pantalla muestra candidatos, estado, condiciones, blockers y evidencia pendiente. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora el ultimo run con tenant, `as_of`, `source_refs`, `reason_codes` y unknowns. `ai-playbook-insights-api` y `InsightsMenu` publican solo los estados que requieren validacion y saltan a la card exacta. |

### Decisiones y guardrails

- Se usa una tabla propia: `playbook_framework_runs` describe recomendaciones y
  no tiene la semantica de estados de elegibilidad de 7.01.
- El bloque no prioriza, no ordena, no selecciona candidatos y no autoriza
  ejecucion. Siempre devuelve `selected: false`.
- La evidencia de diagnostico solo pasa a `TRUE` cuando esta finalizada como
  `finalized_valid`, con validacion pasada y handoff listo. El resto es
  `UNKNOWN`; no se rellena con heuristicas.
- La evaluacion conserva todos los candidatos activos del catalogo y marca
  `INSUFFICIENT_EVIDENCE` cuando faltan dependencias, ajuste causal,
  restricciones, recursos, riesgo o materialidad demostrables.
- El acceso de Copiloto es de solo lectura, con aislamiento por organizacion y
  procedencia explicita. `InsightsMenu` sigue separado de las notificaciones
  normales y solo navega a la card; no ejecuta acciones.

### Verificacion

- Tests del contrato: 6 casos, incluidos unknowns, causalidad, constraint,
  condiciones, elegibilidad y ausencia de ranking/seleccion.
- Tests del motor API: 2 casos de contexto tenant-bound y mapeo conservador de
  candidatos.
- Tests de contexto/feed/pixel: 11 casos enfocados; el contexto F7.01 aparece
  como quinto bloque y la card conserva el ancla del `InsightsMenu`.
- `npm run typecheck --workspace=@ecomscaling/api`, `npm run typecheck
  --workspace=@ecomscaling/worker` y `npm run typecheck --workspace=web` pasan.
- `npm run db:push` aplico la migracion en el proyecto de desarrollo cargado
  por `.env.local`; `npm run db:push:dry` devuelve `Sin migraciones pendientes`.
- Smoke real con `.env.local`: se sembro temporalmente un candidato activo en
  la organizacion `19449030-0696-40eb-bade-e561cbff4010`. El motor persistio 1
  evaluacion, devolvio `VALIDATION_REQUIRED`, dejo el candidato como
  `INSUFFICIENT_EVIDENCE`, confirmo `tenant_match: true` y `no_selection: true`.
  El candidato y el run temporal se borraron: cleanup a cero.

### Fuera de alcance de 7.01

La priorizacion entre intervenciones, el impacto esperado y la recomendacion
ejecutable pertenecen a bloques posteriores de F7. Los bloques `7.15`, `7.17`
y `7.18` siguen abiertos y no se marcan como hechos por haber cerrado 7.01.

### Siguiente rebanada

El siguiente bloque habilitado es `7.03`, pero debe conservar este mismo
contrato de no-seleccion y el adaptador Copiloto-first antes de abrir cualquier
flujo de recomendacion.

## 7.02 - Matching problema-intervencion - **hecho** - 2026-09-18

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-matching.ts`. Representa problema, driver, causa, mecanismo, palanca, señales confirmatorias/disconfirmatorias, evidencia discriminante, familia, alcance y horizonte; cada candidato mantiene `selected: false`. |
| Migracion | `supabase/migrations/20261030200000_f7_p02_intervention_matching.sql`. Tabla `intervention_matching_runs`, fingerprint idempotente, RLS y lectura tenant-bound para consultor/platform admin. |
| Motor puro | `evaluateInterventionMatching` y `evaluateInterventionMatchingSet`. Exigen una cadena causal explícita; una etiqueta KPI o una táctica sin mecanismo queda en `INSUFFICIENT_EVIDENCE` o `NO_CAUSAL_MATCH`. No hay score ni ranking. |
| Motor impuro | `apps/api/src/intervention-matching-engine.ts`. Lee diagnóstico, decisión y catálogo ACTIVE; solo consume metadata causal explícita de `domain_extension.matching`/`causal_matching` y conserva unknowns si no existe. |
| Worker/workflow | `apps/worker/src/intervention-matching-once.ts`, scripts del worker y `.github/workflows/intervention-matching-f7-p02.yml`; ejecución manual hasta aprobar cadencia. |
| API/pixel | Endpoint `GET /v1/consultant/intervention-matching` y panel `InterventionMatchingPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-matching`. Muestra la cadena causal y señales sin presentar una elección final. |
| Copiloto | El adaptador común incorpora F7.02 con `organization_id`, `as_of`, `source_refs`, `reason_codes`, unknowns, candidatos y cadena causal. `InsightsMenu` publica únicamente matching que requiere validación y navega a la card exacta. |

### Decisiones y guardrails

- La fuente no definía schema ni scoring; se implementó un contrato mínimo y
  explícito, sin inventar pesos, probabilidades o causalidad por asociación de
  métricas.
- El candidato solo puede ser `MATCHED` si hay problema compatible, coherencia
  causal explícita, mecanismo y palanca controlable. Si falta cualquiera, se
  conserva `INSUFFICIENT_EVIDENCE`.
- Las alternativas se conservan en el conjunto y se devuelve
  `selected_candidate_id: null`. Priorizar, secuenciar y recomendar pertenece
  a bloques posteriores.
- La metadata causal del catálogo es opcional y tenant-bound en el envelope;
  sin ella el runtime no convierte el catálogo F5 en una receta universal.

### Verificacion

- Tests del contrato: 4 casos de cadena causal, KPI sin mecanismo, mismatch de
  problema y conjunto sin selección.
- Tests del runtime: 2 casos de aislamiento tenant y preservación de metadata
  causal explícita.
- Tests de Copiloto/pixel: contexto F7.02, feed y view-model con navegación a
  `#insight-intervention-matching`.
- `npm run db:push` aplicó la migración con `.env.local`; `npm run db:push:dry`
  devuelve `Sin migraciones pendientes`.
- Smoke real con `.env.local`: candidato temporal en la organización
  `19449030-0696-40eb-bade-e561cbff4010`, `tenant_match: true`, una fila
  persistida, `VALIDATION_REQUIRED`, `matched_count: 0` por ausencia de
  problema upstream demostrable y `no_selection: true`. El run y el template
  temporal se borraron: cleanup a cero.

### Fuera de alcance de 7.02

No prioriza entre candidatos, no calcula impacto, no decide ejecutar, no genera
playbooks completos y no sustituye a F7.01: después del matching siguen el
filtro de elegibilidad y los bloques decisionales posteriores.
