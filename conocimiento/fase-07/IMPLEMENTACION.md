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
- `npm run typecheck --workspace=@e-nora/api`, `npm run typecheck
  --workspace=@e-nora/worker` y `npm run typecheck --workspace=web` pasan.
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

## 7.03 - Priorizacion entre intervenciones - **hecho** - 2026-09-18

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-prioritization.ts`. Compara candidatas con descriptores cualitativos de bottleneck, dano activo, impacto, evidencia, urgencia, velocidad, esfuerzo, riesgo, reversibilidad, dependencias, aprendizaje, recursos, guardrails y encaje estrategico. No introduce score ni pesos numericos. |
| Migracion | `supabase/migrations/20261030300000_f7_p03_intervention_prioritization.sql`. Tabla tenant-bound `intervention_prioritization_runs`, fingerprint idempotente, RLS y lectura de consultor/platform admin. |
| Motor puro | `evaluateInterventionPrioritizationSet`. Solo produce una prioridad `NOW` cuando una candidata domina cualitativamente a las demas; un trade-off, unknown critico o dato faltante devuelve `VALIDATION_REQUIRED`. Alternativas quedan explicadas como `LATER` o `DO_NOT_DO`. |
| Motor impuro | `apps/api/src/intervention-prioritization-engine.ts`. Consume los ultimos runs reales de F7.01/F7.02 y el perfil opcional `domain_extension.prioritization`; conserva trazabilidad y aislamiento por organizacion. |
| Worker/workflow | `apps/worker/src/intervention-prioritization-once.ts`, scripts del worker y `.github/workflows/intervention-prioritization-f7-p03.yml`. La ejecucion es manual o programable por workflow, sin efectos de escritura operativa. |
| API/pixel | Endpoint `GET /v1/consultant/intervention-prioritization` y panel `InterventionPrioritizationPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-prioritization`. Muestra principal, alternativas, motivos y unknowns. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora F7.03 como bloque separado; `ai-playbook-insights-api` y `InsightsMenu` muestran solo las prioridades que necesitan validacion y navegan a la card exacta. La prioridad no es permiso de ejecucion. |

### Decisiones y guardrails

- F7.03 prioriza intervenciones, no vuelve a priorizar problemas y no sustituye a F7.01 ni F7.02.
- No hay score, ROI, pesos ni falsa precision. La dominancia exige que una candidata no sea peor en ninguna dimension declarada y sea mejor al menos en una; si existe trade-off se conserva `VALIDATION_REQUIRED`.
- Un guardrail critico fallido produce `DO_NOT_DO`; dependencias bloqueadas no se presentan como `NOW`; los unknowns no se degradan a `LOW`.
- El resultado guarda `execution_authorized: false`. No crea tareas, no asigna owners, no cambia campanas/pricing, no lanza tests y no ejecuta workflows.
- `InsightsMenu` sigue siendo la superficie de Insights de IA, separada de las notificaciones normales, y solo lleva al consultor al sitio exacto.

### Verificacion

- Tests de contrato: 5 casos de dominancia, trade-off, veto de guardrail, unknowns y ausencia de candidatos priorizables.
- Tests de runtime: 2 casos de contexto tenant-bound y mapeo de metadata cualitativa desde el catalogo.
- Tests de Copiloto/feed/pixel: bloque F7.03, feed de validacion, ancla exacta y view-model del panel.
- `npm run build --workspace=@e-nora/api`, typechecks de API, worker y web, y tests enfocados de contracts/API/web pasan.
- `npm run db:push` aplico `20261030300000_f7_p03_intervention_prioritization.sql` usando `.env.local`; el proyecto de desarrollo queda sin migraciones pendientes.
- Smoke real con `.env.local`: se sembraron temporalmente un template de prioridad y runs upstream `MATCHED`/`ELIGIBLE_NOW` en la organizacion `19449030-0696-40eb-bade-e561cbff4010`. El motor persistio `PRIORITY_AVAILABLE`, devolvio una unica `primary_priority_candidate_id`, confirmo `tenant_match: true` y `execution_authorized: false`. Templates y runs se borraron despues: cleanup a cero.

### Fuera de alcance de 7.03

El impacto formal, esfuerzo detallado, riesgo profundo, secuenciacion, intensidad, portfolio, stop/continue/rollback y success criteria pertenecen a los bloques posteriores de F7. La prioridad queda preparada para que esos bloques la profundicen sin reescribir el contexto.

### Siguiente rebanada

El siguiente bloque habilitado es `7.04`. Los bloques `7.15`, `7.17` y `7.18` siguen pendientes y no se marcan como hechos por cerrar 7.03.

## 7.04 - Impacto esperado - **hecho** - 2026-09-19

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-impact.ts`. Modela la cadena Intervencion -> mecanismo -> leading indicator -> KPI -> outcome, alcance, timing, durabilidad, magnitud cualitativa, efectos secundarios, trade-offs, incrementabilidad, contrafactual, supuestos, guardrails y unknowns. No calcula score, ROI, probabilidades ni forecast; los valores cuantitativos sin soporte se anulan. |
| Migracion | `supabase/migrations/20261030400000_f7_p04_intervention_impact.sql`. Tabla tenant-bound `intervention_impact_runs`, fingerprint idempotente, RLS y lectura de consultor/platform admin. Se mantiene separada de la evaluacion de impacto decisional de F4: aqui el sujeto es la intervencion priorizada. |
| Motor puro/runtime | `evaluateInterventionImpact`/`evaluateInterventionImpactSet` y `apps/api/src/intervention-impact-engine.ts`. Consume la prioridad F7.03, el matching F7.02 y metadata explicita del catalogo; no inventa mecanismo, magnitud, causalidad ni outcome. Produce `SUPPORTED_QUALITATIVE`, `POTENTIAL_ONLY`, `VALIDATION_REQUIRED` o `NO_VALID_IMPACT`. |
| Worker/workflow | `apps/worker/src/intervention-impact-once.ts`, scripts del worker y `.github/workflows/intervention-impact-f7-p04.yml`. Solo persiste evaluacion explicable; no crea tareas ni ejecuta cambios. |
| API/pixel | `GET /v1/consultant/intervention-impact` y `InterventionImpactPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-impact`. Muestra traza causal, magnitud cualitativa, timing, durabilidad, trade-offs y unknowns. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora F7.04 como bloque separado; `ai-playbook-insights-api` y `InsightsMenu` publican un insight solo si requiere validacion y navegan a la card exacta. Siempre expone `execution_authorized: false` y que la expectativa no es garantia. |

### Decisiones y guardrails

- Una expectativa de impacto no es un resultado garantizado ni sustituye una medicion posterior.
- La magnitud es cualitativa por defecto. No hay score, ROI, forecast ni falsa precision; una cifra sin soporte explicito no entra en el resultado.
- La cadena causal debe estar trazada hasta un mecanismo, indicador lider, KPI y outcome. Una asociacion KPI -> resultado sin mecanismo queda en validacion.
- `counterfactual` e `incrementality` permanecen visibles. `ATTRIBUTED_ONLY`, `MIXED`, estimate basis especulativo o guardrails desconocidos no se presentan como impacto soportado.
- F7.04 no autoriza ejecucion, no crea tareas, no cambia campanas/pricing y no reemplaza F4 ni F7.01-F7.03.

### Verificacion

- Tests de contrato: 5 casos de traza cualitativa, potential-only, validacion por cadena incompleta, rechazo de cuantificacion sin soporte y conjunto con primary/unknowns.
- Tests de runtime: 2 casos de contexto tenant-bound y mapeo de mecanismo/meta de impacto sin inventar numeros.
- Tests de Copiloto/feed/pixel: bloque F7.04, resumen sin garantia/autorizacion, feed con ancla exacta y view-model del panel.
- `npm run db:push` aplico `20261030400000_f7_p04_intervention_impact.sql` con `.env.local`; compilacion API, typechecks worker/web y tests enfocados pasan.
- Smoke real con `.env.local`: template activo temporal y runs upstream en `19449030-0696-40eb-bade-e561cbff4010`; persistio `IMPACTS_AVAILABLE`, preservo `primary_priority_candidate_id`, `magnitude_value: null` y `execution_authorized: false`. Cleanup confirmado a cero.

### Fuera de alcance de 7.04

No mide el resultado realizado, no estima uplift estadistico, no calcula retorno economico y no ejecuta intervenciones. La medicion posterior y el aprendizaje quedan para bloques posteriores.

### Siguiente rebanada

El siguiente bloque habilitado es `7.05`. Los bloques `7.15`, `7.17` y `7.18` siguen pendientes y no se marcan como hechos por cerrar 7.04.

## 7.05 - Esfuerzo, coste y recursos - **hecho** - 2026-09-19

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-feasibility.ts`. Separa coste, esfuerzo y capacidad; representa recursos requeridos, disponibilidad, bottleneck, capability gaps, contention, tiempo, coste recurrente, coste de oportunidad, commitment minimo, adaptaciones y alternativas. No define score, ROI, formula de coste, umbral universal ni unidad monetaria obligatoria. |
| Migracion | `supabase/migrations/20261030500000_f7_p05_intervention_feasibility.sql`. Tabla tenant-bound `intervention_feasibility_runs`, fingerprint idempotente, RLS y lectura de consultor/platform admin. |
| Motor puro/runtime | `evaluateInterventionFeasibility`/`evaluateInterventionFeasibilitySet` y `apps/api/src/intervention-feasibility-engine.ts`. Consume F7.03/F7.04 y metadata explicita `domain_extension.feasibility`/`resources`; sin contexto de recursos conserva `VALIDATION_REQUIRED`, no inventa capacidad. |
| Worker/workflow | `apps/worker/src/intervention-feasibility-once.ts`, scripts del worker y `.github/workflows/intervention-feasibility-f7-p05.yml`. Solo persiste evaluacion; no contrata, compra, reasigna presupuesto, asigna personas ni ejecuta cambios. |
| API/pixel | `GET /v1/consultant/intervention-feasibility` y `InterventionFeasibilityPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-feasibility`. Muestra recursos requeridos/disponibles, bottleneck, gaps, coste cualitativo, esfuerzo y adaptaciones. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora F7.05 como bloque separado; `ai-playbook-insights-api` y `InsightsMenu` publican solo factibilidades que requieren validacion y navegan a la card exacta. Expone que no es presupuesto ni autorizacion. |

### Decisiones y guardrails

- Coste != esfuerzo y headcount != capacidad. Las tres dimensiones permanecen visibles.
- Un importe numerico sin soporte explicito se elimina; no se inventan hourly rates, payback, ROI ni umbrales de capacidad.
- Un bottleneck, capacidad parcial, contention, capability gap, owner ausente o contexto desconocido degrada la salida o exige adaptacion.
- Una alternativa o adaptacion puede volver una intervencion `FEASIBLE_WITH_ADAPTATION`, pero no se convierte en una orden.
- La factibilidad no autoriza contratar, comprar software, firmar vendors, reasignar presupuesto, parar proyectos ni ejecutar la intervencion. `execution_authorized` permanece en `false`.

### Verificacion

- Tests de contrato: 5 casos de separacion coste/esfuerzo/capacidad, no-invencion de coste, bottleneck con adaptacion, contexto desconocido y conjunto con primary.
- Tests de runtime: 2 casos de aislamiento tenant, lineage F7.03/F7.04 y mapeo explicito de recursos sin inventar disponibilidad.
- Tests de Copiloto/feed/pixel: bloque F7.05, resumen sin presupuesto/autorizacion, feed con ancla exacta y view-model del panel.
- `npm run db:push` aplico `20261030500000_f7_p05_intervention_feasibility.sql` con `.env.local`; `db:push:dry`, compilacion API y typechecks pasan.
- Smoke real con `.env.local`: template y runs upstream temporales en `19449030-0696-40eb-bade-e561cbff4010`; persistio `FEASIBILITY_AVAILABLE`/`FEASIBLE_NOW`, preservo primary, no produjo bottleneck falso y mantuvo `execution_authorized: false`. Cleanup confirmado a cero.

### Fuera de alcance de 7.05

No asigna personas, no genera presupuesto, no programa proyectos, no calcula riesgo/intensidad y no decide el tamaño final de la apuesta. Esas capas quedan para bloques posteriores.

### Siguiente rebanada

El siguiente bloque habilitado es `7.06`. Los bloques `7.15`, `7.17` y `7.18` siguen pendientes y no se marcan como hechos por cerrar 7.05.

## 7.06 - Riesgo, reversibilidad y coste del error - **hecho** - 2026-09-19

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-risk.ts`. Mantiene separados upside, downside, incertidumbre, exposición, blast radius, reversibilidad, evidencia, riesgo de inacción, guardrails, observabilidad, modos de fallo, capacidad del tenant y coste del error. No define `risk score`, probabilidades ni autorización. |
| Migracion | `supabase/migrations/20261030600000_f7_p06_intervention_risk.sql`. Tabla tenant-bound `intervention_risk_runs`, fingerprint idempotente, RLS y lectura de consultor/platform admin. |
| Motor puro/runtime | `evaluateInterventionRisk`/`evaluateInterventionRiskSet` y `apps/api/src/intervention-risk-engine.ts`. Consume F7.03/F7.04/F7.05, usa solo metadata explícita `domain_extension.risk`/`reversibility` y conserva `VALIDATION_REQUIRED` cuando falta contexto. |
| Worker/workflow | `apps/worker/src/intervention-risk-once.ts`, scripts del worker y `.github/workflows/intervention-risk-f7-p06.yml`. Evalúa y persiste; no lanza tests, cambia pricing/spend, ejecuta rollback ni autoriza acciones. |
| API/pixel | `GET /v1/consultant/intervention-risk` y `InterventionRiskPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-risk`. Muestra exposición, reversibilidad, coste del error, failure modes, mitigaciones y unknowns. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora F7.06 como bloque separado; `ai-playbook-insights-api` y `InsightsMenu` publican solo revisiones que requieren validación y navegan a la card exacta. Expone siempre `execution_authorized: false` y la ausencia de score/probabilidades. |

### Decisiones y guardrails

- Riesgo, incertidumbre, confianza, impacto, coste y reversibilidad no se promedian ni se comprimen en un valor único.
- Guardrail duro fallido o riesgo existencial produce `DO_NOT_PROCEED`; una puerta de una sola dirección, exposición material, severidad material o evidencia insuficiente exige mitigación o validación.
- El runtime compara riesgo de actuar con riesgo de esperar, conserva residual damage y prioriza reducción de blast radius, staged commitment, observabilidad y rollback readiness.
- Claims numéricos sin soporte explícito se eliminan. No se inventan probabilidades, pérdida monetaria, thresholds, capacidad ni risk appetite.
- El bloque es recommendation-only: no inicia experimentos, no cambia presupuestos, no publica pricing, no para campañas, no ejecuta rollback ni concede permisos.

### Verificacion

- Tests de contrato: 5 casos de ejes separados, veto de guardrail, unknowns de reversibilidad/contexto, descarte de claims numéricos y conjunto con primary.
- Tests de runtime: 2 casos de tenant/lineage y mapeo de metadata de riesgo explícita.
- Tests de Copiloto/feed/pixel: bloque F7.06, resumen sin score/autorización, feed con ancla exacta y view-model del panel.
- `npm run db:push` aplicó `20261030600000_f7_p06_intervention_risk.sql` con `.env.local`; `db:push:dry`, build API y typechecks pasan.
- Smoke real con `.env.local`: se sembraron temporalmente template y runs F7.04/F7.05 en `19449030-0696-40eb-bade-e561cbff4010`; persistió `RISK_ASSESSMENTS_AVAILABLE`/`RISK_ACCEPTABLE_WITH_GUARDRAILS`, `execution_authorized: false`, sin score ni probabilidades, y cleanup a cero.

### Fuera de alcance de 7.06

No decide test-vs-execute, secuenciación, intensidad, portfolio, stop/continue/scale/rollback, criterios de seguridad ni permisos de autonomía. Esos límites pertenecen a bloques posteriores.

### Siguiente rebanada

El siguiente bloque habilitado es `7.07`. Los bloques `7.15`, `7.17` y `7.18` siguen pendientes y no se marcan como hechos por cerrar 7.06.

## 7.07 - Secuenciacion y dependencias - **hecho** - 2026-09-19

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-sequencing.ts`. Representa camino condicional, prerequisitos, bloqueadores, desbloqueos, gates, ramas `IF/IF NOT`, tracks paralelos, `NOT YET`, ventanas de observacion y condiciones de salida. No es un DAG tecnico, scheduler, backlog ni autorizacion. |
| Migracion | `supabase/migrations/20261030700000_f7_p07_intervention_sequencing.sql`. Tabla tenant-bound `intervention_sequencing_runs`, fingerprint idempotente, RLS y lectura de consultor/platform admin. |
| Motor puro/runtime | `evaluateInterventionSequencing`/`evaluateInterventionSequencingSet` y `apps/api/src/intervention-sequencing-engine.ts`. Consume F7.03-F7.06 y el perfil explicito `domain_extension.sequencing`/`dependencies`; conserva `VALIDATION_REQUIRED` cuando falta camino, prerequisitos o guardrails. |
| Worker/workflow | `apps/worker/src/intervention-sequencing-once.ts`, scripts del worker y `.github/workflows/intervention-sequencing-f7-p07.yml`. Solo evalua y persiste el camino; no crea tareas, fechas, owners, scheduler ni permisos. |
| API/pixel | `GET /v1/consultant/intervention-sequencing` y `InterventionSequencingPanel` en `shopify/diagnostico`, anclado en `#insight-intervention-sequencing`. Muestra NOW, WHY FIRST, THEN, ramas, prerequisitos, bloqueadores, paralelismo, esperas y unknowns. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora F7.07 como bloque de solo lectura; `ai-playbook-insights-api` y `InsightsMenu` publican únicamente secuencias que requieren validacion y navegan a la card exacta. Expone siempre `execution_authorized: false`. |

### Decisiones y guardrails

- Secuenciar no equivale a ejecutar: el resultado es una ruta de decisión condicionada, no un plan operativo.
- Un prerequisito duro no satisfecho bloquea la cadena; una dependencia blanda se conserva como contexto y no se convierte en requisito ficticio.
- Las ramas deben quedar explicitadas como `IF`, `IF NOT`, `PARALLEL`, `NOT YET` o `WAIT`; no se inventa paralelismo por conveniencia.
- Guardrails fallidos, gates fallidos, blockers actuales o evidencia insuficiente degradan a bloqueo, validación o espera según el caso.
- El bloque no calcula calendario, duración, score de dependencia, owner, orden técnico de tareas ni autorización. `execution_authorized` permanece en `false`.

### Verificacion

- Tests de contrato: decisiones completas, validación por camino/prerequisito ausente, bloqueo por dependencia dura, gate fallido y conservación de unknowns sin autorizar ejecución.
- Tests de runtime: aislamiento tenant, consumo de runs upstream, mapeo de perfiles explícitos, persistencia idempotente y ausencia de candidatos inventados.
- Tests de Copiloto/feed/pixel: bloque F7.07, resumen de camino sin tareas/fechas/owners, feed con ancla exacta y view-model de la pantalla.
- `npm run db:push` aplicó `20261030700000_f7_p07_intervention_sequencing.sql` con `.env.local`; `db:push:dry`, build API, typechecks worker/web y tests enfocados pasan.
- Smoke real con `.env.local`: template y runs upstream temporales; persistió `SEQUENCES_AVAILABLE`, verificó `NOW/THEN`, gate, tenant y `execution_authorized: false`; cleanup confirmado a cero.

### Fuera de alcance de 7.07

No crea tareas, asigna responsables, agenda fechas, inicia experimentos, aplica cambios, concede permisos ni convierte la secuencia en una orden de ejecución. La decisión de experimentar frente a ejecutar queda para `7.08` y la ejecución supervisada para F8.

### Siguiente rebanada

El siguiente bloque habilitado es `7.08`. Los bloques `7.15`, `7.17` y `7.18` siguen pendientes y no se marcan como hechos por cerrar 7.07.

## 7.08 - Experimentar vs ejecutar directamente - **hecho** - 2026-09-19

### Alcance implementado

| Capa | Implementacion |
| --- | --- |
| Contrato | `packages/contracts/src/intervention-test-execute.ts`. Representa `FIX`, `DIRECT_EXECUTION`, `TEST`, `PILOT`, `GATHER_EVIDENCE`, `WAIT_OBSERVE` y `DO_NOT_PROCEED`, con hipótesis, pregunta de aprendizaje, outcomes, guardrails, exposición, observación, contaminación, fidelidad y transferencia de evidencia. No define estadística, sample size ni rollout. |
| Migracion | `supabase/migrations/20261030800000_f7_p08_intervention_test_execute.sql`. Tabla tenant-bound `intervention_test_execute_runs`, fingerprint idempotente, RLS y lectura de consultor/platform admin. |
| Motor puro/runtime | `evaluateInterventionTestExecute`/`evaluateInterventionTestExecuteSet` y `apps/api/src/intervention-test-execute-engine.ts`. Consume F7.07 y el perfil explícito `domain_extension.test_execute`/`experimentation`; evita experimentar con defectos confirmados y degrada ante medición, economía o guardrails insuficientes. |
| Worker/workflow | `apps/worker/src/intervention-test-execute-once.ts`, scripts del worker y `.github/workflows/intervention-test-execute-f7-p08.yml`. Solo decide/persiste el modo; no lanza tests, randomiza tráfico, cambia producción, asigna presupuesto ni autoriza ejecución. |
| API/pixel | `GET /v1/consultant/intervention-test-execute` y `InterventionTestExecutePanel` en `shopify/diagnostico`, anclado en `#insight-intervention-test-execute`. Muestra modo recomendado, hipótesis, pregunta, outcome, guardrails, exposición, observación y decisión posterior. |
| Copiloto | `loadDecisionPlaybookContextBlocks` incorpora F7.08 como bloque separado; `ai-playbook-insights-api` y `InsightsMenu` publican los modos que requieren revisión y navegan a la card exacta. Expone siempre `execution_authorized: false`. |

### Decisiones y guardrails

- Un defecto confirmado, dañino o de compliance se corrige; no se convierte en experimento artificial.
- Un experimento solo aparece cuando existe hipótesis, pregunta que puede cambiar una decisión, medición suficiente, exposición controlable y guardrails aceptables.
- Una intervención grande o con incertidumbre de ejecución material se deriva a `PILOT`; una evidencia barata y no interventiva se prioriza como `GATHER_EVIDENCE`.
- Medición rota, contexto contaminado, ventana inmadura o evidencia no transferible permanecen visibles; no se transforman en confianza artificial.
- No se calculan porcentajes, significancia, potencia, duración exacta, asignación de tráfico, sample size ni ganador automático. `execution_authorized` permanece en `false`.

### Verificacion

- Tests de contrato: fix de defecto confirmado, test con hipótesis medible, pilot por escala/incertidumbre, recopilación por medición rota, veto económico/guardrail, espera por ventana inmadura y ausencia de autorización.
- Tests de runtime: aislamiento tenant, consumo de F7.07, mapeo de metadata explícita y persistencia idempotente.
- Tests de Copiloto/feed/pixel: bloque F7.08, resumen sin lanzamiento ni autorización, feed con ancla exacta y view-model del panel.
- `npm run db:push` aplicó `20261030800000_f7_p08_intervention_test_execute.sql` con `.env.local`; build de contratos/API y tests enfocados pasan.
- Smoke real con `.env.local`: secuencia upstream y template temporales; persistió `DECISIONS_AVAILABLE` con modo `TEST`, conservó hipótesis y decisión posterior, no generó `scheduled_at`, `owner_id` ni `rollout_percentage`, y cleanup confirmado a cero.

### Fuera de alcance de 7.08

No lanza experimentos, randomiza tráfico, cambia pricing, publica cambios, asigna budgets, escala rollouts, ejecuta rollback ni decide criterios finales de stop/continue/scale. Esas responsabilidades pertenecen a bloques posteriores y Fase 8.

### Siguiente rebanada

El siguiente bloque habilitado es `7.09`. Los bloques `7.15`, `7.17` y `7.18` siguen pendientes y no se marcan como hechos por cerrar 7.08.

## 7.09 - Intensidad y tamano de la intervencion - **hecho** - 2026-09-20

### Alcance implementado

- Contrato `packages/contracts/src/intervention-intensity.ts` con magnitud, alcance, velocidad y duracion separadas, limiter, rampa, observacion y modos cualitativos `INCREASE`, `MAINTAIN`, `DECREASE` y `STOP_INCREASING`.
- Motor puro con tests y runtime `apps/api/src/intervention-intensity-engine.ts`; consume F7.08, conserva unknowns y nunca convierte intensidad en presupuesto, porcentaje, scheduler o autorizacion.
- Migracion `20261030900000_f7_p09_intervention_intensity.sql`, worker, workflow horario, endpoint `GET /v1/consultant/intervention-intensity` y panel `#insight-intervention-intensity`.
- Copiloto y `InsightsMenu` reciben el resumen tenant-bound de solo lectura y navegan a la card exacta; `execution_authorized` permanece en `false`.

### Verificacion y guardrails

- Contratos: 769/769. API F7: 41/41. Web F7 y registry: 28/28.
- `npm run db:push` y `npm run db:push:dry` pasan con `.env.local`, sin migraciones pendientes.
- Smoke real con plantilla y decision upstream temporales: `INTENSITY_PROFILES_AVAILABLE`, modo `INCREASE`, dimensiones `moderate/targeted/stepwise/temporary`, limiter `cash` y cleanup a cero.
- La falta de observabilidad, respuesta marginal o saturacion no puede derivar en una apuesta mayor; degrada a observacion/validacion.

### Fuera de alcance de 7.09

No calcula porcentajes universales, presupuesto, asignacion, rollout, scheduler, stop/continue/rollback, aprobaciones ni ejecucion. Esos controles pertenecen a bloques posteriores y Fase 8.

F7/P09 queda hecho. El siguiente bloque habilitado es F7/P10 (`7.10`).

## 7.10 - Recomendaciones por madurez - **hecho** - 2026-09-20

### Alcance implementado

- Contrato `packages/contracts/src/maturity-recommendations.ts` y motor puro con tests: adapta una intervención a madurez funcional, readiness, capabilities, evidence, riesgo, capacidad de absorción y complejidad organizativa sin crear scores, thresholds ni inferir madurez por revenue, tamaño o tooling.
- Runtime `apps/api/src/maturity-recommendations-engine.ts`: consume la última evaluación de intensidad F7.09 y el perfil D03 vigente, conserva unknowns, produce `NOW/LATER`, `NOT YET`, capability previa, reset local, modos stage-appropriate y `maturity unlock`; persistencia idempotente en `maturity_recommendation_runs`.
- Migración `20261031000000_f7_p10_maturity_recommendations.sql`, worker `maturity-recommendations-once.ts`, workflow diario, endpoint `GET /v1/consultant/maturity-recommendations` y panel `#insight-maturity-recommendations`.
- Copiloto y `InsightsMenu` conectados al feed F7.10; las revisiones de contexto incompleto aparecen como insight accionable y navegan a la card exacta; `execution_authorized` permanece en `false`.

### Verificación y guardrails

- Contrato: escenarios de madurez madura, capability previa, reset local, simplificación por baja absorción, contexto desconocido y conjunto de candidatos.
- API y web: tests del runtime, feed F7.10 y view-model; build de contratos/API/worker y typecheck web pasan.
- `npm run db:push` aplicó la migración en `.env.local`; `npm run db:push:dry` posterior informa cero migraciones pendientes.
- Smoke real en `.env.local`: plantilla, evaluación upstream, perfil D03 y capability temporales; persistió `MATURITY_RECOMMENDATIONS_AVAILABLE`, modo `BUILD_CAPABILITY_FIRST`, timing `LATER`, capability previa y cleanup confirmado a cero.

### Fuera de alcance de 7.10

No asigna maturity score, no clasifica por facturación, no cambia organización, no compra tooling, no ejecuta automatizaciones, no crea planes de proyecto y no autoriza intervención. F7.11 sigue siendo el siguiente bloque habilitado.

F7/P10 queda hecho. El siguiente bloque habilitado es F7/P11 (`7.11`).

## Cierre F7/P11 — recomendaciones bajo restricciones — 2026-09-20

- [x] Contrato y motor puro con tests: constraints relevantes, binding constraint, dureza, duración, granularidad, controllability, slack/headroom, success capacity, escasez frente a mala asignación/desperdicio, y respuestas `remove/reduce/replace/reallocate/resequence/delay` sin scores ni thresholds.
- [x] Runtime tenant-bound desde F7.10; solo consume contexto de restricciones declarado en la extensión del playbook y conserva la cadena de evidencia. Persistencia idempotente en `constraint_recommendation_runs`, migración `20261031100000_f7_p11_constraint_recommendations.sql`, worker y workflow.
- [x] API, panel `#insight-constraint-recommendations`, Copiloto y `InsightsMenu` conectados en solo lectura. El Copiloto expone binding constraint, acción factible, adaptación, diferido y siguiente constraint; `execution_authorized` permanece en `false`.
- [x] Verificado con `.env.local`: `CONSTRAINT_RECOMMENDATIONS_AVAILABLE`, `REDUCE_SCOPE`, outcome ajustado, source refs tenant-bound y cleanup real a cero; `db:push:dry` queda sin pendientes.

F7/P11 queda hecho. La siguiente tarea habilitada es F7/P12 (`7.12`).

### Cierre F7/P12 - 2026-09-20

F7/P12 queda hecho con contrato, motor puro probado, runtime persistente desde
F7.11, worker, workflow, endpoint, panel y consumo Copiloto-first. La salida
construye una cartera mínima alrededor de una Primary y conserva roles
Enabling, Supporting, Parallel, Deferred y Excluded, junto con razones de
entrada/deferral, secuencia, ramas condicionales, carga agregada, factibilidad,
riesgo de cartera, narrativa y exclusiones explícitas.

El bloque deduplica y preserva interferencias; no suma impactos, no rellena
cinco cajas, no es optimizer, solver, scheduler, gestor de proyectos ni
autorización de ejecución. `execution_authorized` permanece en `false`.

La migración `20261031110000_f7_p12_recommendation_portfolio.sql` se aplicó con
`.env.local`. El smoke real sembró temporalmente F7.11 y un playbook de prueba,
persistió `PORTFOLIO_AVAILABLE` con la Primary correcta y terminó con cero
filas temporales; contratos, API, worker, web, Copiloto, feed y registry pasan
sus verificaciones enfocadas. La siguiente rebanada habilitada es F7/P13
(`7.13`).
### Cierre F7/P13 — decisiones dinámicas — 2026-09-20

- [x] Contrato, motor puro TDD, runtime desde F7.12, persistencia idempotente, migración `20261031120000_f7_p13_dynamic_decisions.sql`, worker, workflow y API.
- [x] Copiloto e `InsightsMenu` conectados con `STOP`, `CONTINUE`, `SCALE`, `ROLLBACK`, qualifiers, límites, rollback target, fix-forward y evidencia siguiente; `execution_authorized: false`.
- [x] Smoke real con `.env.local`: `DECISIONS_AVAILABLE`, `SCALE`, fila persistida, aislamiento tenant, cleanup a cero y `db:push:dry` sin pendientes.

F7/P13 queda hecho. La siguiente tarea habilitada es F7/P14 (`7.14`).
### Cierre F7/P14 — no-action / wait / gather evidence — 2026-09-20

- [x] Contrato y motor puro TDD: `NO_ACTION`, `WAIT`, `GATHER_EVIDENCE`, `ACT_SMALL` y `ACT`; no confunde restraint con continue, pause o deferred y exige validación de contexto decisivo desconocido.
- [x] Runtime desde F7.13, persistencia idempotente, migración `20261031130000_f7_p14_restraint_decisions.sql`, worker, workflow, API y contexto tenant-bound.
- [x] Copiloto e `InsightsMenu` conectados con frontera de decisión, coste de delay, evidencia necesaria, camino, completion condition, review condition y triggers; card `#insight-restraint-decision` separada de notificaciones normales.
- [x] Smoke real con `.env.local`: `DECISION_AVAILABLE`, decisión `WAIT`, fila persistida, aislamiento tenant, cleanup a cero y `db:push:dry` sin pendientes.

F7/P14 queda hecho. La siguiente tarea habilitada es F7/P15 (`7.15`).
### Cierre F7/P15 — expected outcome y success criteria — 2026-09-20

- [x] Contrato y motor puro TDD: tesis causal, outcomes por capas, criterios primario y de decisión, guardrails, materialidad, baseline/contrafactual, incrementalidad, economía y sostenibilidad; sin promesas ni magnitud inventada.
- [x] Runtime desde F7.14, persistencia idempotente en `expected_outcome_runs`, migración `20261031140000_f7_p15_expected_outcomes.sql`, worker, workflow, endpoint y aislamiento tenant.
- [x] Panel `#insight-expected-outcome`, feed de `InsightsMenu` y bloque Copiloto; conserva unknowns, evidencia ambigua, piloto frente a readiness de escala y `execution_authorized: false`.
- [x] Verificado con `.env.local`: smoke real con seed temporal y cleanup a cero; contratos 802/802; suites API, web, typecheck y builds pasan; desarrollo y producción sin migraciones pendientes después de aplicar F7.13–F7.15.

F7/P15 queda hecho. F7.17 y F7.18 siguen abiertos; F7 no se declara cerrada hasta completar ambos.
### Cierre F7/P17 — confianza calibrada de la recomendación — 2026-09-20

- [x] Contrato y motor puro TDD: confianza multidimensional, evidencia, integridad, contexto de transferencia, incertidumbre principal, contradicciones y actualización específica por capa; sin score, porcentajes ni modelo probabilístico.
- [x] Runtime desde F7.15, persistencia idempotente en `recommendation_confidence_runs`, migración `20261031150000_f7_p17_recommendation_confidence.sql`, worker, workflow, endpoint y aislamiento tenant.
- [x] Panel `#insight-recommendation-confidence`, feed de `InsightsMenu` y bloque Copiloto; la confianza modifica el compromiso cualitativo, pero no sustituye factibilidad, economía, prioridad, guardrails ni ejecución.
- [x] Verificado con `.env.local`: smoke real temporal y cleanup a cero; 807/807 contratos, suites API/Copiloto/UI, typecheck y builds pasan; desarrollo y producción sin migraciones pendientes después de aplicar F7.17.

F7/P17 queda hecho. F7.18 es el siguiente bloque abierto; F7 no se declara cerrada hasta completarlo.

### Cierre F7/P18 — comunicación de recomendaciones — 2026-09-20

- [x] Contrato y motor puro TDD: decisión primero, razón, por qué ahora, exclusiones, outcome condicional, riesgo, incertidumbre, hechos frente a inferencias, señal de éxito y siguiente decisión; sin falsa precisión ni volcado del razonamiento.
- [x] Runtime tenant-bound desde F7.17/F7.15, persistencia idempotente en `recommendation_communication_runs`, migración `20261031160000_f7_p18_recommendation_communication.sql`, worker, workflow, endpoint y aislamiento tenant.
- [x] Panel `#insight-recommendation-communication`, feed de `InsightsMenu` y bloque Copiloto; adapta la presentación sin cambiar el razonamiento y mantiene `execution_authorized: false`.
- [x] Verificado con `.env.local`: smoke real temporal `COMMUNICATION_AVAILABLE` y cleanup a cero; tests de contrato, API/Copiloto/UI, typechecks y builds pasan; desarrollo y producción sin migraciones pendientes.

F7/P18 queda hecho. F7 queda cerrada completa; F8 queda habilitada.
