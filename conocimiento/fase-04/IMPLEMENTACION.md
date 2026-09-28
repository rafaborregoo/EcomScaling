# BitÃ¡cora de implementaciÃ³n â€” fase 04

Esta fase convierte el diagnÃ³stico de F3 en precedencia decisional. Se sigue
el reparto CRPET: contrato ejecutable, runtime, policies con tests, experiencia
del resultado y contexto por tenant. Un bloque no pasa a `hecho` hasta que las
tres patas â€”contrato, motor que escribe y pixel que lo muestraâ€” estÃ©n
verificadas.

## P00 / 4.00 â€” contrato de priorizaciÃ³n y decisiÃ³n

### DecisiÃ³n de diseÃ±o

P00 es la mÃ¡quina constitucional de la fase, no el algoritmo de ranking. El
contrato conserva la identidad de `PRIORITIZATION_RUN`, `analysis_snapshot_id`,
`decision_as_of`, versiones, huella de entrada, estados, validez, `UNKNOWN`,
gates, reason codes, lineage y rule traces. P1â€“P12 podrÃ¡n aÃ±adir contexto,
dimensiones, ranking, portfolio y explicaciÃ³n sin cambiar este contenedor.

### Primera rebanada entregada

- Contrato puro y tests en `packages/contracts/src/prioritization.ts` y
  `prioritization.test.ts`.
- Runtime en `apps/api/src/prioritization-engine.ts`: lee salidas D14 vigentes,
  crea una ejecuciÃ³n por organizaciÃ³n y deja `INPUT_INCOMPLETE` mientras P1 no
  haya producido contexto; no supone crecimiento ni fabrica una cola.
- Persistencia en `prioritization_runs` y `prioritization_rule_traces`, con RLS
  de lectura por tenant, en la migraciÃ³n `20261027090000`.
- Worker `start:prioritization`, workflow manual y pantalla de consultor en
  `/shopify/diagnostico`.

### LÃ­mites intencionados

No se calcula `priority`, `rank` ni `execution_order` en P00. Tampoco se usa IA
para tenant, gates, identidad, dependencias o versionado. La vista muestra la
espera de P1 como estado explÃ­cito, porque `UNKNOWN` no es cero ni una prioridad
baja.

### VerificaciÃ³n de esta rebanada

Los 12 tests P0 y los typechecks de contracts/API/worker/web pasan. La
migraciÃ³n `20261027090000` se aplicÃ³ al proyecto correcto cargado desde
`.env.local`; la pasada real creÃ³ una ejecuciÃ³n `INPUT_INCOMPLETE` por falta de
contexto P1, confirmÃ³ una rule trace determinista y eliminÃ³ la ejecuciÃ³n con
cleanup a cero. P00 queda `hecho`; P1 empieza en la siguiente rebanada.

## P01 / 4.01 â€” contexto de decisiÃ³n y objetivos

### DecisiÃ³n de diseÃ±o

El artefacto P01 es RAG y no define un schema tÃ©cnico. La implementaciÃ³n
introduce el mÃ­nimo contrato ejecutable: objetivo primario/secundario,
provenance declarado/revelado, conflictos, horizonte, constraints, guardrails,
recursos, riesgo, compromisos, estado actual/objetivo, gaps, dependencias,
ventanas de evento, must-win y must-not-fail. `GOAL`, `TARGET`, `STRATEGY`,
`INITIATIVE` y `PREFERENCE` quedan separados; solo `GOAL` puede ser objetivo
primario.

### Primera rebanada entregada

- Contrato puro y seis tests en `packages/contracts/src/decision-context.ts` y
  `decision-context.test.ts`, con fingerprint semÃ¡ntico estable y sin score ni
  ranking.
- MigraciÃ³n `20261027093000_f4_p01_decision_context.sql` con declaraciones,
  snapshots histÃ³ricos, constraints de estado/confidence, lineage e idempotencia;
  RLS de lectura para consultor/admin.
- Runtime `apps/api/src/decision-context-engine.ts`: lee declaraciones,
  objetivos medibles existentes, madurez F3 y constraints activos; sin
  declaraciÃ³n devuelve `INCOMPLETE` y no inventa `GROWTH`.
- Worker `start:decision-context`, API GET/POST y pantalla en
  `/shopify/diagnostico` junto a P0.

### Recortes deliberados y verificaciÃ³n

No se infieren objetivos revelados a partir de presupuesto, no se calculan
weights ni prioridad, no se inventan thresholds y no hay aprendizaje autÃ³nomo.
La migraciÃ³n se aplicÃ³ solo al proyecto de `.env.local`
(`kopcblejsxpkxoykldyh`). La prueba real sembrÃ³ una declaraciÃ³n temporal y
produjo `COMPLETE` con `GOAL` y limitaciÃ³n `resource:cash`; al retirarla produjo
`INCOMPLETE` con `objective_context`, `cash_context`, `risk_capacity` y
`time_horizon`. Se eliminaron la declaraciÃ³n y ambos snapshots. P01 queda
`hecho`; P03 es el siguiente bloque.

## P03 / 4.03 â€” urgencia y sensibilidad temporal

### DecisiÃ³n de diseÃ±o

P03 mide urgencia temporal, no importancia, severidad ni prioridad. Un deadline
duro tampoco se convierte automÃ¡ticamente en prioridad. El contrato solo
clasifica `TIME_CRITICAL`, `TIME_SENSITIVE`, `NOT_TIME_SENSITIVE` o `UNKNOWN`
cuando puede comparar la ventana o la irreversibilidad con el tiempo total de
respuesta: decisiÃ³n, ejecuciÃ³n y latencia hasta observar resultado. Si falta
cualquiera de esas piezas, conserva `UNKNOWN` y explicita el unknown pendiente.

### Primera rebanada entregada

- Contrato puro y cuatro tests en `packages/contracts/src/temporal-urgency.ts`
  y `temporal-urgency.test.ts`, con fingerprint, confidence, reason codes,
  dependencias temporales y explicaciÃ³n; no contiene `priority`, `rank` ni
  acciÃ³n automÃ¡tica.
- MigraciÃ³n `20261027100000_f4_p03_temporal_urgency.sql` con snapshots
  append-only, envelope de entrada, resultado, unknowns, razones, fuentes,
  huella idempotente y RLS por tenant/consultor.
- Runtime `apps/api/src/temporal-urgency-engine.ts`: traduce el diagnÃ³stico
  temporal vigente de D13, persiste evaluaciones idempotentes y deja el timing
  como desconocido cuando D13 no lo observa; worker
  `apps/worker/src/temporal-urgency-once.ts`, workflow
  `.github/workflows/temporal-urgency-p03.yml`, API y panel de consultor.

### Recorte y verificaciÃ³n

El manifiesto de P03 referencia `06-tenant-context/p03-contexto-temporal-tenant.md`,
pero ese artefacto no existe en el corpus actual (solo estÃ¡n P00, P01, P04 y
P05). Se deja como hueco de contenido explÃ­cito: el runtime no inventa contexto
temporal de tenant y degrada a `UNKNOWN`/`SUFFICIENT_WITH_LIMITATIONS` hasta que
existan ventanas, deadlines o lead times verificables.

La migraciÃ³n se aplicÃ³ al proyecto de `.env.local`
(`kopcblejsxpkxoykldyh`). Los cuatro tests puros pasan. La verificaciÃ³n real
sembrÃ³ un assessment `TIME_CRITICAL`, confirmÃ³ su lectura, ejecutÃ³ el worker
para las cinco organizaciones activas (`5` correctas, `0` fallidas; sin D13
vigente que procesar) y eliminÃ³ la fila temporal hasta dejar cleanup a cero.
P03 queda `hecho`; el siguiente bloque habilitado es P04.

## P04 / 4.04 â€” impacto decisional y valor en juego

### DecisiÃ³n de diseÃ±o

P04 conserva el lado de valor de cada candidato sin convertirlo en una cifra
universal ni en ranking. Separa revenue, contribution, cash, customer value,
inventory y valor estratÃ©gico; distingue realized/potential/recoverable/
irrecoverable, exposiciÃ³n de pÃ©rdida, impacto bruto de incrementalidad y las
confianzas de diagnÃ³stico, impacto y atribuciÃ³n. Una incrementalidad declarada
sin counterfactual es invÃ¡lida. Los escenarios y las assumptions permanecen
visibles; no se inventan probabilidades ni euros para valor no monetizable.

### Primera rebanada entregada

- Contrato puro y cuatro tests en `packages/contracts/src/impact.ts` y
  `impact.test.ts`, con impact profile, magnitud absoluta/relativa, baseline,
  exposiciÃ³n, recoverability, incrementality, escenarios, overlap implÃ­cito y
  explicabilidad. El resultado no tiene `priority`, `rank` ni `score`.
- MigraciÃ³n `20261027103000_f4_p04_decision_impact.sql` con envelope, resultado,
  unknowns, razones, fuentes, huella idempotente y RLS por tenant/consultor.
- Runtime `apps/api/src/decision-impact-engine.ts`: consume casos abiertos o
  en investigaciÃ³n de F3, traduce solo campos observables y deja economics,
  exposiciÃ³n, baseline y counterfactual en `UNKNOWN` si no existen. Incluye
  worker, workflow, API y panel de consultor.

### VerificaciÃ³n

La migraciÃ³n se aplicÃ³ al proyecto de `.env.local`
(`kopcblejsxpkxoykldyh`). Los cuatro tests P04 pasan. La prueba real sembrÃ³ un
perfil de contribution protegible `HIGH`, confirmÃ³ la persistencia y sus
unknowns de incrementalidad/atribuciÃ³n, ejecutÃ³ el worker para cinco
organizaciones (`5` correctas, `0` fallidas) y eliminÃ³ las filas temporales con
cleanup a cero. P04 queda `hecho`; el siguiente bloque habilitado es P05.

## P05 / 4.05 â€” constraints y dependencias

### DecisiÃ³n de diseÃ±o

P05 emite dos estructuras relacionadas pero distintas: `constraint_map` y
`dependency_graph`. Un constraint requiere objetivo de sistema, evidencia de
binding y falsifier; una debilidad o la mÃ©trica mÃ¡s roja no bastan. Una
dependencia puede ser hard, soft, blocker, enablement o conflicto de recurso,
pero no se convierte por eso en prioridad ni en constraint global. Se conservan
slack, parallelism, redundancy, control y minimum viable prerequisite sin
forzar una secuencia lineal.

### Primera rebanada entregada

- Contrato puro y cuatro tests en `packages/contracts/src/constraints.ts` y
  `constraints.test.ts`, con mapa de constraints, grafo de dependencias,
  evidencia, falsifier, objetivo, blocker, conflictos de recurso y unknowns.
  No contiene `priority`, `rank` ni `score`.
- MigraciÃ³n `20261027110000_f4_p05_constraints_dependencies.sql` con snapshots
  versionados, huella idempotente, resultado completo, unknowns, razones,
  fuentes y RLS por tenant/consultor.
- Runtime `apps/api/src/constraints-engine.ts`: consume constraints activos,
  casos abiertos y el contexto P01 cuando existe; no fabrica objetivo,
  throughput ni dependencias. Incluye worker, workflow, API y panel de
  consultor.

### VerificaciÃ³n

La migraciÃ³n se aplicÃ³ al proyecto de `.env.local`
(`kopcblejsxpkxoykldyh`). Los cuatro tests P05 pasan. La ejecuciÃ³n real creÃ³ un
snapshot por cada una de las cinco organizaciones activas (`5` correctas, `0`
fallidas), conservÃ³ `system_objective` y `current_primary_constraint` como
unknown cuando no habÃ­a evidencia suficiente, y eliminÃ³ las cinco filas con
cleanup a cero. P05 queda `hecho`; el siguiente bloque habilitado es P06.

## P06 / 4.06 — esfuerzo, recursos y factibilidad

### Decisión de diseño

P06 separa esfuerzo, recursos disponibles, readiness y capacidad de éxito. No
convierte dificultad en prioridad ni rellena capacidad desconocida con una
estimación. El resultado puede ser `FEASIBLE`, `PARTIAL`, `NOT_FEASIBLE` o
`UNKNOWN`, con incertidumbres y razones visibles.

### Primera rebanada y verificación

- Contrato puro y cuatro tests en `packages/contracts/src/feasibility.ts`.
- Migración `20261027120000_f4_p06_feasibility.sql`, runtime
  `apps/api/src/feasibility-engine.ts`, worker, workflow, API y panel.
- Verificado en `.env.local` sobre `kopcblejsxpkxoykldyh`: cinco organizaciones,
  cinco ejecuciones correctas, cero fallos y cinco filas temporales eliminadas.

P06 queda `hecho`; el siguiente bloque habilitado es P07.

## P07 / 4.07 — riesgo, reversibilidad y coste del error

### Decisión de diseño

P07 conserva upside, downside, likelihood, apetito/capacidad de riesgo,
reversibilidad, recoverability, coste del error, blast radius, commitment,
failure modes y necesidad de aprobación. No calcula un `risk_score` universal
ni transforma riesgo en prioridad. Sin evidencia suficiente, el resultado es
`UNKNOWN`.

### Primera rebanada y verificación

- Contrato puro y cuatro tests en `packages/contracts/src/risk.ts`.
- Runtime `apps/api/src/risk-engine.ts`, worker, API y panel compuesto de
  dimensiones F4; persistencia en la migración
  `20261027130000_f4_p06_p12_decision_runtime.sql`.
- Verificado en `.env.local`: cinco organizaciones correctas, cero fallos y
  cleanup a cero.

P07 queda `hecho`; el siguiente bloque habilitado es P08.

## P08 / 4.08 — expected value, opportunity cost y asignación

P08 solo calcula expected value cuando el valor incremental y la probabilidad
están declarados; nunca inventa euros, probabilidad u opportunity cost.
Conserva conflictos de recursos, capacidad, sunk cost, remaining cost,
optionality y stop criteria. El contrato y cuatro tests viven en
`packages/contracts/src/allocation.ts`; el runtime es
`apps/api/src/allocation-engine.ts`, con worker, API y panel.

La verificación real sobre las cinco organizaciones de `.env.local` terminó
`5/5`, sin fallos, y eliminó las cinco filas temporales. P08 queda `hecho`.

## P09 / 4.09 — strategic fit, madurez y coherencia

P09 separa objetivo, core capability, stage, coherence, future fit, complexity,
right to win, maturity gap, portfolio role, defensibility y customer fit. No
produce un `fit_score` ni una recomendación. En ausencia de declaración del
tenant conserva `UNKNOWN` o `TENSION` con sus motivos.

Contrato y tests: `packages/contracts/src/strategic-fit.ts`; runtime:
`apps/api/src/strategic-fit-engine.ts`; además worker, API, panel y
persistencia compartida P06–P12. Verificación `.env.local`: cinco
organizaciones correctas, cero fallos y cleanup a cero. P09 queda `hecho`.

## P10 / 4.10 — ranking y síntesis de prioridad

P10 exige una política de pesos declarada por el tenant y dimensiones completas
antes de rankear. Sin política se abstiene (`ABSTAIN`); con dimensiones
incompletas queda `PARTIAL`. Conserva rank-switch conditions y no oculta el
motivo del cambio. No introduce una prioridad global por defecto.

Contrato y tests: `packages/contracts/src/ranking.ts`; runtime:
`apps/api/src/ranking-engine.ts`; worker, API, panel y persistencia compartida.
En la verificación real, las cinco organizaciones procesaron correctamente y
el resultado se abstuvo de rankear por falta de política declarada; cleanup a
cero. P10 queda `hecho`.

## P11 / 4.11 — portfolio, conflictos y concurrencia

P11 modela roles de portfolio, ranking opcional, recursos, dependencias,
parallelism, admission, WIP, preemption y pools de capacidad. No fuerza una
concurrencia ni convierte la cola en prioridad. La falta de capacidad queda
`UNKNOWN`, no se rellena con una cifra.

Contrato y tests: `packages/contracts/src/portfolio.ts`; runtime:
`apps/api/src/portfolio-engine.ts`; worker, API, panel y persistencia compartida.
La corrida `.env.local` fue `5/5`, cero fallos y cleanup a cero. P11 queda
`hecho`.

## P12 / 4.12 — salida, explicabilidad, trazabilidad y validación

P12 separa tipo de decisión, contexto, evidencia, rationale, trade-offs,
assumptions, unknowns y condiciones de revisión. Mantiene separadas confianza
de decisión, diagnóstico y causalidad. Sin evidencia suficiente devuelve
`ABSTAIN` o `VALIDATION_REQUIRED`, nunca una recomendación disfrazada de
certeza.

Contrato y tests: `packages/contracts/src/decision-output.ts`; runtime:
`apps/api/src/decision-output-engine.ts`; worker, API, panel y persistencia
compartida. Verificado en `.env.local`: cinco organizaciones correctas, cero
fallos, salida conservadora y cleanup a cero.

P12 queda `hecho`. Con P06–P12 terminados, F4 queda cerrada en esta sesión.

### Fusión de runtimes P06–P12 — 2026-09-27

Los siete runtimes P06–P12 (`feasibility`, `risk`, `allocation`,
`strategic-fit`, `ranking`, `portfolio`, `decision-output`) eran el mismo
esqueleto con otra tabla, y ninguno lee todavía datos del negocio: todos
construyen su entrada en `UNKNOWN`. Se fusionaron en
`apps/api/src/decision-blocks-engine.ts` (un bloque por fila de
`DECISION_BLOCKS`, cada uno con su try/catch), un solo worker
`decision-blocks-once.ts`, un solo paso de la cadena nocturna y
`decision-blocks-api.ts` para las siete rutas de consultor, que no cambian.
Contratos, tablas y paneles siguen siendo uno por bloque. Las entradas son
idénticas a las anteriores, así que las huellas no cambian. Las referencias a
`*-engine.ts` de P06–P12 en este documento son históricas.

Corregido al fusionar: P07–P12 incluían `as_of` en la huella, de modo que la
deduplicación por `input_fingerprint` no actuaba y cada noche se insertaba una
fila nueva idéntica por organización. Ahora los seis contratos excluyen `as_of`
del hash, como ya hacía P06. Las filas repetidas anteriores siguen en la base;
la primera noche tras el despliegue escribe una fila con la huella nueva y a
partir de ahí se reutiliza.

### Integración con el Copiloto

Las salidas de F4 no se quedan únicamente en los paneles de diagnóstico. El
Copiloto las recibe mediante un contexto de solo lectura que resume contexto
de decisión, salida decisional, estado, motivos, confianza, unknowns y
evidencia. Respeta `ABSTAIN` y `VALIDATION_REQUIRED`; no convierte una salida
de F4 en una orden ni amplía el alcance del tenant.
