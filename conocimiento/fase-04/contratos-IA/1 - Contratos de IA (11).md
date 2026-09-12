# **P11 — CONFLICTOS, PORTFOLIO Y CONCURRENCIA DE PRIORIDADES**

## **0\. Propósito**

P11 define cómo debe transformar el sistema un ranking de prioridades en un conjunto operativo coherente de candidatos activos, diferidos, bloqueados, monitorizados o detenidos.

Su responsabilidad es responder:

> Dado lo que merece prioridad, ¿qué puede avanzar simultáneamente, qué compite por los mismos recursos, qué debe esperar y qué combinación es sostenible para el negocio?

P11 NO redefine:

* la prioridad relativa → P10;  
* constraints y dependencias → P5;  
* capacidad y recursos → P6;  
* economics → P8;  
* estrategia → P9;  
* playbooks → Fase 5\.

P11 utiliza esos contratos para construir:

**ACTIVE DECISION PORTFOLIO**

---

# **1\. Principio fundamental**

Debe mantenerse:

**RANKING**

≠

**PORTFOLIO**

≠

**EXECUTION ORDER**

≠

**RESOURCE ALLOCATION**

≠

**CONCURRENCY**

≠

**WIP**

Un ranking:

A \> B \> C

no implica:

> ejecutar A, luego B, luego C.

Puede ocurrir:

A y B en paralelo.

C espera.

O:

A está bloqueado.

B y C avanzan.

---

# **2\. Entidad principal**

Entidad:

**PRIORITY\_PORTFOLIO**

Representa:

> el conjunto estructurado de candidatos que el sistema considera activos o en estados operativos relevantes dentro de un Decision Context concreto.

Relación:

`PRIORITY_RANKING_RESULT`

→ `PRIORITY_PORTFOLIO`

P11 será source of truth de:

* portfolio state;  
* concurrency;  
* portfolio conflicts;  
* WIP decision;  
* active/deferred/blocked set;  
* resource allocation envelope;  
* portfolio-level constraints.

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `portfolio_id` | Sí | identidad |
| `prioritization_run_id` | Sí | ejecución |
| `ranking_result_id` | Sí | ranking origen |
| `portfolio_state` | Sí | validez |
| `portfolio_entry_refs[]` | Sí | candidatos |
| `active_candidate_refs[]` | Sí | activos |
| `deferred_candidate_refs[]` | Opcional | diferidos |
| `blocked_candidate_refs[]` | Opcional | bloqueados |
| `monitor_candidate_refs[]` | Opcional | monitorizados |
| `stop_candidate_refs[]` | Opcional | detenidos |
| `resource_allocation_refs[]` | Opcional | asignaciones |
| `portfolio_conflict_refs[]` | Opcional | conflictos |
| `concurrency_group_refs[]` | Opcional | grupos paralelos |
| `portfolio_constraint_refs[]` | Opcional | límites globales |
| `unknowns[]` | Opcional | incertidumbres |
| `warnings[]` | Opcional | limitaciones |
| `created_at` | Sí | timestamp |
| `policy_version` | Sí | reglas |

---

# **4\. PORTFOLIO\_ENTRY**

Entidad:

**PORTFOLIO\_ENTRY**

Representa el estado de un candidate dentro del portfolio.

Campos:

* `candidate_id`;  
* `business_priority_ref`;  
* `portfolio_status`;  
* `execution_readiness_ref`;  
* `allocation_state`;  
* `concurrency_group_ref`;  
* `sequence_position_ref`;  
* `resource_commitment_refs[]`;  
* `activation_reason_codes[]`;  
* `deactivation_reason_codes[]`;  
* `review_trigger_refs[]`.

---

# **5\. PORTFOLIO\_STATUS**

Estados iniciales:

`ACTIVE`

`ACTIVE_WITH_LIMITATIONS`

`PREPARING`

`VALIDATING`

`MONITORING`

`DEFERRED`

`BLOCKED`

`QUEUED`

`STOPPED`

`EXCLUDED`

Estos estados no deben confundirse con priority states de P10.

---

# **6\. PRIORITY STATE ≠ PORTFOLIO STATUS**

Ejemplo:

P10:

`business_priority = CRITICAL`

P11:

`portfolio_status = BLOCKED`

Correcto.

Otro ejemplo:

P10:

`priority = HIGH`

P11:

`portfolio_status = ACTIVE`

También correcto.

---

# **7\. ACTIVE**

`ACTIVE` significa:

> el candidate está autorizado dentro del portfolio actual para consumir atención/capacidad decisional o de preparación.

No significa necesariamente:

> existe ya un playbook en ejecución.

Fase 5/8 gestionarán ejecución concreta.

---

# **8\. PREPARING**

Significa:

> candidate todavía no ejecuta intervención, pero se están satisfaciendo condiciones previas necesarias.

No debe contener instrucciones de cómo hacerlo.

---

# **9\. VALIDATING**

Candidate activo cuya prioridad actual es:

> reducir incertidumbre material.

Conecta con P10 `VALIDATE`.

---

# **10\. MONITORING**

Candidate no recibe intervención activa.

Pero debe mantenerse bajo observación porque existen triggers capaces de cambiar prioridad.

---

# **11\. QUEUED**

Candidate está preparado y validado, pero espera capacidad o secuencia.

Diferencia:

`BLOCKED`

→ existe condición impeditiva.

`QUEUED`

→ podría ejecutarse, pero portfolio decide no activarlo todavía.

---

# **12\. DEFERRED**

Candidate se pospone conscientemente.

Debe existir:

* motivo;  
* revisión;  
* trigger o condición futura cuando proceda.

No equivale a olvidarlo.

---

# **13\. STOPPED**

Candidate deja de consumir recursos/atención dentro del portfolio.

No implica borrar su historial.

---

# **14\. EXCLUDED**

Candidate no pertenece al portfolio actual porque:

* no es elegible;  
* está fuera de scope;  
* fue invalidado;  
* pertenece a otra decisión.

---

# **15\. CONCURRENCY**

Entidad:

**CONCURRENCY\_GROUP**

Representa:

> conjunto de candidates que pueden permanecer activos simultáneamente bajo las condiciones actuales.

Campos:

* `concurrency_group_id`;  
* `candidate_refs[]`;  
* `compatibility_state`;  
* `shared_resource_refs[]`;  
* `dependency_refs[]`;  
* `interaction_refs[]`;  
* `max_concurrent_members`;  
* `evidence_refs[]`.

---

# **16\. COMPATIBILITY STATE**

Valores:

`COMPATIBLE`

`COMPATIBLE_WITH_LIMITATIONS`

`RESOURCE_CONFLICT`

`DEPENDENCY_CONFLICT`

`STRATEGIC_CONFLICT`

`MUTUALLY_EXCLUSIVE`

`UNKNOWN`

---

# **17\. CAN RUN IN PARALLEL**

Dos candidates pueden ejecutarse concurrentemente si:

* no existe hard dependency entre ellos;  
* no violan portfolio constraints;  
* no consumen recursos exclusivos incompatibles;  
* no son mutuamente excluyentes;  
* no generan interacción negativa no tolerada.

No basta:

> pertenecen a departamentos distintos.

---

# **18\. PARALLEL ≠ INDEPENDENT**

Dos candidates pueden avanzar en paralelo y seguir teniendo:

* información compartida;  
* economics compartidos;  
* dependencia parcial;  
* common owner.

Parallelism solo significa:

> no existe razón contractual suficiente para obligar secuencia completa.

---

# **19\. MUTUAL EXCLUSIVITY**

Entidad:

**PORTFOLIO\_CONFLICT**

Tipo:

`MUTUALLY_EXCLUSIVE`

Ejemplo:

dos candidatos requieren el mismo recurso indivisible durante la misma ventana.

No pueden estar activos simultáneamente.

---

# **20\. RESOURCE CONFLICT**

P11 debe consumir `RESOURCE_CONTENTION` de P6.

Si:

combined demand \> allocatable capacity

debe existir:

`RESOURCE_CONFLICT`.

Pero P11 no recalcula la capacidad original.

---

# **21\. SHARED RESOURCE**

No todo recurso compartido produce conflicto.

Si existe capacidad suficiente:

A y B pueden estar activos.

P11 debe distinguir:

**SHARED**

de

**CONFLICTING**.

---

# **22\. RESOURCE ALLOCATION**

Entidad:

**PORTFOLIO\_RESOURCE\_ALLOCATION**

Representa:

> cuánto recurso del envelope disponible se reserva para cada candidate dentro del portfolio actual.

Campos:

* `resource_ref`;  
* `candidate_id`;  
* `allocated_amount`;  
* `allocation_unit`;  
* `allocation_window`;  
* `allocation_state`;  
* `capacity_snapshot_ref`;  
* `reason_codes[]`.

---

# **23\. RESOURCE ALLOCATION ≠ EXECUTION PLAN**

P11 puede indicar:

> Candidate A recibe hasta X capacidad.

Pero no:

> Developer 1 debe implementar feature Y el lunes.

Eso pertenece a ejecución.

---

# **24\. ALLOCATION STATE**

Valores:

`ALLOCATED`

`PARTIALLY_ALLOCATED`

`RESERVED`

`PENDING`

`NOT_ALLOCATED`

`UNKNOWN`

---

# **25\. MINIMUM EFFECTIVE ALLOCATION**

P8/P6 pueden indicar que candidate requiere mínimo de recurso.

P11 debe respetarlo.

No asignar:

40 % del mínimo

solo para mantener artificialmente más initiatives activas.

---

# **26\. RESOURCE FRAGMENTATION**

P11 debe evitar:

> dividir recursos entre demasiadas prioridades hasta que ninguna tenga capacidad efectiva.

Puede existir:

`RESOURCE_FRAGMENTATION_RISK`.

No hace falta una fórmula universal.

---

# **27\. WIP**

Entidad conceptual:

**WORK\_IN\_PROGRESS\_POLICY**

Representa:

> cuántas prioridades puede mantener activas el sistema simultáneamente bajo determinadas condiciones.

No debe existir un número universal.

---

# **28\. WIP LIMIT**

Puede definirse:

* global;  
* por resource;  
* por team;  
* por domain;  
* por complexity class.

Debe provenir de:

* capacity;  
* operating policy;  
* evidence.

---

# **29\. NO UNIVERSAL "TOP 3"**

Queda prohibido definir:

> siempre ejecutar las tres prioridades principales.

Puede ser incorrecto para:

* pequeño ecommerce;  
* organización grande;  
* incident management;  
* proyectos indivisibles;  
* tareas paralelizables.

---

# **30\. WIP LIMIT ≠ RANK CUTOFF**

Si WIP limit \= 3:

no necesariamente se activan ranks:

1, 2 y 3\.

Ejemplo:

\#1 bloqueado.

Puede activarse:

\#2, \#3 y \#4.

Manteniendo \#1 como highest business priority.

---

# **31\. BLOCKED CAPACITY SUBSTITUTION**

Si candidate prioritario está bloqueado:

P11 puede activar otro candidate compatible temporalmente.

Pero debe conservar:

> candidate bloqueado sigue siendo prioritario.

No debe modificar ranking para justificar utilización de capacidad.

---

# **32\. PORTFOLIO FILLING**

P11 no debe “llenar” capacidad por obligación.

Si no existe candidate suficientemente válido:

capacidad puede permanecer sin asignar.

No inventar trabajo.

---

# **33\. PORTFOLIO OBJECTIVE**

P11 utiliza objetivos P1.

Puede existir:

`portfolio_objective_policy`

para decidir:

* proteger critical path;  
* limitar WIP;  
* maximizar capturable value;  
* preservar flexibility;  
* equilibrar risk.

Pero no debe inventarse dinámicamente.

---

# **34\. PORTFOLIO OPTIMIZATION**

P11 puede utilizar técnicas de optimización cuando:

* inputs cuantificados sean suficientemente fiables;  
* constraints estén formalizados;  
* objetivo matemático sea explícito.

Pero no es obligatorio.

---

# **35\. NO KNAPSACK UNIVERSAL**

No convertir todo el portfolio en:

> maximizar ΣEV sujeto a presupuesto.

Porque existen:

* dependencies;  
* tail risks;  
* qualitative value;  
* mandatory obligations;  
* strategic constraints;  
* indivisibilities;  
* uncertainty.

Una optimización matemática puede ser un submodelo, no la arquitectura completa.

---

# **36\. MANDATORY PORTFOLIO ITEMS**

Algunos candidates pueden requerir:

`MANDATORY_ACTIVE`

por:

* legal;  
* contractual;  
* business continuity;  
* policy.

Eso debe provenir de override/gate autorizado.

---

# **37\. PORTFOLIO OVERRIDE**

Entidad:

**PORTFOLIO\_OVERRIDE**

Puede modificar:

* WIP;  
* allocation;  
* activation;  
* sequencing.

Debe contener autoridad, motivo y vigencia.

---

# **38\. ACTIVE PORTFOLIO CONSTRAINT**

Entidad:

**PORTFOLIO\_CONSTRAINT**

Ejemplos:

* máximo cash comprometido;  
* máximo management attention;  
* máximo engineering concurrency;  
* mínimo operational buffer;  
* risk exposure limit.

P11 aplica estas reglas globalmente.

---

# **39\. CANDIDATE CONSTRAINT ≠ PORTFOLIO CONSTRAINT**

Candidate constraint:

afecta una iniciativa.

Portfolio constraint:

afecta combinación.

Ejemplo:

cada project es viable individualmente.

Pero tres juntos exceden cash disponible.

---

# **40\. COMBINATION FEASIBILITY**

Entidad:

**PORTFOLIO\_FEASIBILITY**

Estados:

`FEASIBLE`

`FEASIBLE_WITH_LIMITATIONS`

`OVER_CAPACITY`

`CONFLICTING`

`UNKNOWN`

Debe evaluarse sobre la combinación, no sobre candidates aislados.

---

# **41\. INDIVIDUALLY FEASIBLE ≠ JOINTLY FEASIBLE**

A es factible.

B es factible.

No implica:

A+B factible.

Este es precisamente uno de los motivos de existencia de P11.

---

# **42\. PORTFOLIO INTERACTIONS**

P11 consume economic interactions de P8:

* complementarity;  
* cannibalization;  
* shared fixed cost;  
* synergy.

Puede utilizarlas para decidir combinación.

---

# **43\. COMPLEMENTARY CANDIDATES**

Si A+B generan mejor economics o readiness conjunta:

P11 puede agruparlos.

Pero debe existir evidence.

No usar “sinergia” como justificación vaga.

---

# **44\. CANNIBALIZING CANDIDATES**

Dos candidates pueden ser individualmente atractivos pero conjuntamente destruir valor.

P11 debe poder excluir simultaneidad.

---

# **45\. DEPENDENCY-AWARE PORTFOLIO**

P5 proporciona dependency graph.

P11 debe respetar:

* hard sequences;  
* prerequisites;  
* blockers;  
* partial order.

No puede activar target si prerequisite obligatorio sigue insatisfecho.

---

# **46\. READY PREDECESSOR**

Un predecessor de menor business priority puede necesitar estado:

`ACTIVE`

para habilitar candidate superior.

Esto no cambia ranking.

---

# **47\. ENABLER**

Puede existir:

`portfolio_role = ENABLER`.

Candidate consume recursos porque desbloquea otro candidate prioritario.

No significa que tenga mayor value at stake propio.

---

# **48\. PORTFOLIO ROLE**

Valores iniciales:

`PRIMARY`

`ENABLER`

`VALIDATION`

`SUPPORTING`

`MONITOR`

`CONTINGENCY`

No son priority states.

Describen función dentro del portfolio.

---

# **49\. PRIMARY PORTFOLIO ITEM**

Candidate que recibe atención directa por su propia prioridad.

---

# **50\. ENABLER PORTFOLIO ITEM**

Candidate activado principalmente porque habilita otro.

---

# **51\. CONTINGENCY**

Candidate preparado para activarse si ocurre un trigger.

No consume necesariamente capacidad activa significativa.

---

# **52\. PORTFOLIO CONFLICT TYPES**

Taxonomía:

`RESOURCE`

`DEPENDENCY`

`TIMING`

`CASH`

`RISK`

`STRATEGIC`

`VALUE_CANNIBALIZATION`

`OPERATIONAL`

`MANAGEMENT_ATTENTION`

`MUTUAL_EXCLUSION`

`OTHER`

---

# **53\. CONFLICT SEVERITY**

Cuando sea útil:

`SOFT`

`MATERIAL`

`HARD`

`UNKNOWN`

Hard conflict impide coexistencia bajo el contexto actual.

---

# **54\. CONFLICT RESOLUTION**

P11 no inventa soluciones.

Puede resolver estructuralmente mediante:

* sequence;  
* defer;  
* exclude;  
* allocation;  
* parallelize;  
* keep blocked.

Pero no define acciones del playbook.

---

# **55\. SEQUENCING**

P11 puede producir:

**PORTFOLIO\_SEQUENCE**

basada en P5.

Debe distinguir:

`MANDATORY_SEQUENCE`

de

`PREFERRED_SEQUENCE`.

---

# **56\. PREFERRED SEQUENCE**

Puede derivarse de:

* resource efficiency;  
* preparation;  
* lower risk;  
* faster information gain.

Solo si policy lo autoriza.

No debe presentarse como hard dependency.

---

# **57\. ACTIVE SET**

Entidad lógica:

**ACTIVE\_SET**

Es el subconjunto de portfolio entries que actualmente reciben capacidad o atención.

Debe poder cambiar entre runs.

---

# **58\. ACTIVE SET ≠ TOP RANKS**

Hard rule.

La composición depende de:

* ranking;  
* blockers;  
* resources;  
* concurrency;  
* WIP;  
* interactions.

---

# **59\. PORTFOLIO FRONTIER**

Puede existir un conjunto de portfolios:

`NON_DOMINATED_PORTFOLIOS`

cuando varias combinaciones son razonables.

Ejemplo:

Portfolio A:

más value, más risk.

Portfolio B:

menos value, más flexibility.

Si policy no resuelve trade-off:

P11 puede devolver:

`MULTIPLE_VALID_PORTFOLIOS`.

---

# **60\. NO FORCED PORTFOLIO**

Si existen varias combinaciones materialmente equivalentes:

no inventar una única solución.

Puede requerir validación de preferencias.

---

# **61\. PORTFOLIO SCENARIO**

Entidad:

**PORTFOLIO\_SCENARIO**

Permite comparar combinaciones.

Campos:

* member\_candidates\[\];  
* resource usage;  
* economics refs;  
* risk refs;  
* constraints;  
* conflicts;  
* feasibility;  
* assumptions.

---

# **62\. SCENARIO ≠ RECOMMENDATION**

P11 puede generar alternativas de portfolio.

P12 explica.

La recomendación concreta posterior deberá respetar la frontera con Fase 5\.

---

# **63\. CONTEXT SWITCHING COST**

Si P6 proporciona evidencia:

P11 puede considerar:

> activar demasiadas iniciativas reduce capacidad efectiva.

No inventar un overhead universal.

---

# **64\. COORDINATION LOAD**

P11 puede considerar:

* número de equipos;  
* interdependencias;  
* owners;  
* cross-functional complexity.

Pero no duplicar P6.

Utiliza refs.

---

# **65\. PORTFOLIO RISK**

Dos initiatives pueden tener riesgos independientes aceptables pero riesgo conjunto excesivo.

P11 debe poder evaluar:

`aggregate_exposure`.

Sin reducirlo siempre a suma.

---

# **66\. RISK CONCENTRATION**

Ejemplo:

tres candidates dependen de mismo proveedor.

Puede existir:

`CONCENTRATION_RISK`.

Esto puede limitar portfolio.

---

# **67\. DIVERSIFICATION**

No asumir que diversificación siempre es mejor.

Solo valorar cuando sea material al risk policy.

---

# **68\. SHARED DOWNSIDE**

P7 puede aportar shared downside pools.

P11 debe evitar multiplicarlos en portfolio.

---

# **69\. PORTFOLIO CASH COMMITMENT**

Debe poder calcular:

* committed cash;  
* reserved cash;  
* expected future requirement;

utilizando P6/P8.

No duplicar las fuentes.

---

# **70\. CASH BUFFER**

Si existe policy:

P11 debe preservar:

`minimum_cash_buffer`.

No agotar caja solo porque portfolios tengan EV positivo.

---

# **71\. RESOURCE BUFFER**

Igualmente:

* incident capacity;  
* operational buffer;  
* management buffer.

P11 debe respetarlos si están definidos.

---

# **72\. QUEUE**

Entidad:

**PRIORITY\_QUEUE**

Puede contener candidates listos pero no activos.

Orden puede referenciar P10.

Pero queue no es ranking completo.

---

# **73\. QUEUE MOVEMENT**

Candidate puede pasar:

`QUEUED → ACTIVE`

cuando:

* recurso se libera;  
* predecessor termina;  
* WIP slot disponible;  
* override entra.

---

# **74\. DEFERRED REVIEW**

Todo deferred material debería incluir:

* review condition;  
* review date si existe;  
* trigger.

No es necesario forzar fecha si la condición es event-driven.

---

# **75\. MONITOR TRIGGERS**

P11 consume triggers de P10/P3.

Candidate `MONITORING` debe poder reactivarse al cumplirse condición.

---

# **76\. PORTFOLIO RECALCULATION TRIGGERS**

Recalcular cuando cambie materialmente:

* ranking P10;  
* candidate state;  
* dependency state;  
* resource capacity;  
* WIP policy;  
* cash;  
* risk limit;  
* strategic constraint;  
* active candidate completion;  
* new candidate;  
* blocker resolution.

---

# **77\. CHANGES THAT SHOULD NOT RECALCULATE**

No recalcular por:

* metadata;  
* reorder visual;  
* rename;  
* equivalent explanation;  
* telemetry timestamp sin cambios materiales.

---

# **78\. PORTFOLIO STABILITY**

Entidad:

**PORTFOLIO\_STABILITY**

Estados:

`STABLE`

`MOSTLY_STABLE`

`SENSITIVE`

`UNSTABLE`

`UNKNOWN`

---

# **79\. PORTFOLIO CHURN**

Debe detectarse cuando candidates:

entran/salen constantemente del active set por cambios pequeños.

Puede indicar:

* WIP policy pobre;  
* thresholds sensibles;  
* noisy ranking;  
* capacity volatility.

---

# **80\. HYSTERESIS**

Puede existir policy para evitar activation/deactivation excesiva ante cambios mínimos.

No debe impedir responder a eventos críticos.

---

# **81\. PREEMPTION**

P11 debe soportar:

**PREEMPTION**

Candidate activo puede ser desplazado por:

* critical incident;  
* override;  
* hard obligation;  
* materially dominant new candidate.

---

# **82\. PREEMPTION ≠ FAILURE**

Si candidate se pausa por prioridad superior:

no significa que fuera una mala decisión.

Debe registrarse motivo.

---

# **83\. PREEMPTION COST**

Cuando cambiar contexto consume coste relevante:

P11 puede utilizar refs de:

* switching cost;  
* restart cost;  
* lost work.

Pero no debe mantener una iniciativa únicamente por sunk cost.

---

# **84\. STOP VS PAUSE**

Debe mantenerse:

`PAUSED`

≠

`STOPPED`

Si se necesita, `PAUSED` puede añadirse como estado explícito.

PAUSED:

puede retomarse.

STOPPED:

decisión actual es no continuar dentro del contexto.

---

# **85\. PORTFOLIO COMPLETION**

Candidate puede salir de active portfolio porque:

`RESOLVED`

pero P11 no define outcome final.

Eso pertenecerá a ejecución/aprendizaje.

P11 solo consume status downstream cuando exista.

---

# **86\. PORTFOLIO VALIDITY**

Estados:

`VALID`

`VALID_WITH_LIMITATIONS`

`MULTIPLE_VALID_PORTFOLIOS`

`REQUIRES_VALIDATION`

`OVERCONSTRAINED`

`NO_ACTIVE_PORTFOLIO`

`STALE`

`INVALID`

---

# **87\. OVERCONSTRAINED**

Significa:

> constraints actuales impiden construir un portfolio que satisfaga los requisitos mínimos.

Esto puede ocurrir aunque existan priorities claras.

---

# **88\. NO ACTIVE PORTFOLIO**

Puede ser resultado legítimo cuando:

* todo está blocked;  
* no existe capacidad;  
* candidate set no requiere acción;  
* todo está monitoring/deferred.

No inventar active work.

---

# **89\. OUTPUT P11**

Contrato:

**PORTFOLIO\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `portfolio_id` | identidad |
| `prioritization_run_id` | ejecución |
| `portfolio_validity` | estado |
| `portfolio_entry_refs[]` | entries |
| `active_set_ref` | activos |
| `queue_ref` | espera |
| `concurrency_group_refs[]` | paralelo |
| `sequence_refs[]` | secuencia |
| `resource_allocation_refs[]` | asignación |
| `portfolio_conflict_refs[]` | conflictos |
| `portfolio_constraint_refs[]` | límites |
| `scenario_refs[]` | alternativas |
| `preemption_refs[]` | desplazamientos |
| `unknowns[]` | desconocidos |
| `warnings[]` | limitaciones |
| `rule_trace_refs[]` | trazabilidad |
| `created_at` | timestamp |
| `policy_version` | versión |

---

# **90\. REASON CODES**

Familias:

`PORTFOLIO.*`

`CONCURRENCY.*`

`ALLOCATION.*`

`WIP.*`

`QUEUE.*`

Ejemplos:

`PORTFOLIO.ACTIVE`

`PORTFOLIO.MULTIPLE_VALID`

`PORTFOLIO.OVERCONSTRAINED`

`CONCURRENCY.COMPATIBLE`

`CONCURRENCY.RESOURCE_CONFLICT`

`CONCURRENCY.MUTUALLY_EXCLUSIVE`

`ALLOCATION.PARTIAL`

`ALLOCATION.CAPACITY_EXCEEDED`

`WIP.LIMIT_REACHED`

`QUEUE.WAITING_CAPACITY`

`QUEUE.WAITING_DEPENDENCY`

`PORTFOLIO.PREEMPTED`

---

# **91\. Invariantes P11**

1. Ranking no equivale a active portfolio.  
2. Rank \#1 no implica ejecución inmediata.  
3. Candidate bloqueado puede seguir siendo prioridad nº1.  
4. Individually feasible no implica jointly feasible.  
5. Shared resource no implica conflicto si existe capacidad.  
6. WIP limit no equivale a top-N ranking.  
7. No existe top-3 universal.  
8. Hard dependencies deben respetarse.  
9. Hard portfolio constraints no pueden compensarse con EV.  
10. Resource buffers configurados deben respetarse.  
11. Capacity no debe sobreasignarse silenciosamente.  
12. Minimum effective allocation debe respetarse.  
13. P11 no debe fragmentar recursos inútilmente.  
14. Multiple valid portfolios están permitidos.  
15. No se fuerza active portfolio.  
16. Opportunity cost debe considerar candidates realmente desplazados.  
17. Portfolio interactions no equivalen a dependencies.  
18. Pausar no equivale a declarar failure.  
19. Stop no elimina historial.  
20. P11 no genera playbooks.

---

# **92\. PRECONDICIONES**

P11 necesita:

* ranking result P10;  
* candidate set P2;  
* dependency graph P5;  
* capacity/resource data P6;  
* economics/interactions P8;  
* risk refs P7;  
* portfolio policies.

Puede producir portfolio parcial si faltan datos no bloqueantes.

---

# **93\. POSTCONDICIONES**

P11 termina correctamente cuando puede responder:

* qué candidates están activos;  
* cuáles están bloqueados;  
* cuáles esperan;  
* cuáles se monitorizan;  
* cuáles deben detenerse;  
* cuáles pueden correr en paralelo;  
* cuáles son mutuamente excluyentes;  
* qué recursos se asignan;  
* si existe overcommitment;  
* si existe un portfolio válido;  
* si existen varias combinaciones válidas.

---

# **94\. FAILURE MODES**

## **Ranking-as-roadmap**

\#1, \#2, \#3 se convierten directamente en ejecución secuencial.

**Prevención:** portfolio separado.

---

## **Top-N fallacy**

Activar siempre cinco priorities.

**Prevención:** WIP contextual.

---

## **Resource fragmentation**

Demasiados candidates activos con asignaciones inútiles.

**Prevención:** minimum effective allocation.

---

## **Blocked starvation**

Rank \#1 bloqueado paraliza todo el sistema.

**Prevención:** activate compatible lower-ranked candidates.

---

## **Blocked demotion**

Rank \#1 bloqueado se baja artificialmente.

**Prevención:** business priority preservada.

---

## **Individual feasibility fallacy**

Tres projects factibles por separado → se activan juntos.

**Prevención:** portfolio feasibility.

---

## **EV portfolio absolutism**

Seleccionar solo combinación con mayor EV.

**Prevención:** constraints/risk/dependencies.

---

## **Fake synergy**

“Estos proyectos combinan bien.”

Sin mecanismo.

**Prevención:** economic interaction refs.

---

## **Capacity exhaustion**

Se asigna 100 % de recursos ignorando buffers.

**Prevención:** portfolio constraints.

---

## **Sunk-cost continuation**

No se detiene candidate porque “ya lleva trabajo”.

**Prevención:** future decision economics.

---

# **95\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| \#1 blocked, \#2 ready | \#2 puede ACTIVE |
| \#1 blocked | mantiene business priority |
| A y B recursos distintos | parallel posible |
| A+B exceden capacity | no joint activation |
| A+B comparten resource con capacidad suficiente | compatible |
| A requires B | B puede actuar como enabler |
| WIP=2 y tres ready | máximo 2 activos salvo override |
| top candidate requiere menos que minimum allocation disponible | no activación parcial inútil |
| portfolio excede cash buffer | inválido/ajuste |
| two mutually exclusive candidates | no concurrent |
| two valid portfolio alternatives | MULTIPLE\_VALID\_PORTFOLIOS |
| no eligible active candidates | NO\_ACTIVE\_PORTFOLIO |
| new critical override | preemption permitido |
| metadata cambia | portfolio estable |
| capacity aumenta | puede recalcular |
| blocker resuelto | queued/blocked puede activar |
| stopped candidate | historial conservado |

---

# **96\. EVALS IA**

### **Ranking/portfolio separation**

¿Evita convertir ranking en roadmap directo?

### **Concurrency eval**

¿Detecta correctamente candidates compatibles?

### **Resource contention eval**

¿Evita sobreasignación?

### **WIP discipline eval**

¿Evita activar demasiado trabajo?

### **Blocked-priority eval**

¿Mantiene importancia de candidates bloqueados?

### **Portfolio interaction eval**

¿Distingue complementariedad real de narrativa vaga?

### **Multiple-solutions eval**

¿Acepta varios portfolios válidos?

### **Boundary eval**

¿Evita generar instrucciones de ejecución?

---

# **97\. EJEMPLO 1 — \#1 BLOQUEADO**

P10:

A \= CRITICAL, rank 1\.

B \= HIGH, rank 2\.

C \= HIGH, rank 3\.

A depende de datos aún no disponibles.

B requiere creative.

C requiere engineering.

P11 podría producir:

A → `BLOCKED`

B → `ACTIVE`

C → `ACTIVE`

No modifica:

A sigue siendo business rank \#1.

---

# **98\. EJEMPLO 2 — MISMO EQUIPO**

A y B:

ambos HIGH.

Ambos requieren 80 % de la misma capacidad de engineering.

No pueden avanzar correctamente simultáneamente.

P11:

`RESOURCE_CONFLICT`

y debe seleccionar/queue según policy y ranking.

---

# **99\. EJEMPLO 3 — PARALELISMO**

A:

critical inventory problem.

B:

important retention issue.

Recursos:

operations vs lifecycle team.

Sin dependencies ni conflicts.

Aunque A rank \#1 y B \#2:

P11 puede activar ambos.

---

# **100\. EJEMPLO 4 — ENABLER**

A:

rank \#1.

B:

rank \#5.

Pero A requiere B como prerequisite.

B puede recibir:

`portfolio_role = ENABLER`

y quedar ACTIVE antes que A.

Eso no convierte B en business rank \#1.

---

# **101\. EJEMPLO 5 — PORTFOLIO SOBRECAPACITADO**

A, B y C son individualmente positivos.

Pero juntos consumen:

130 % de management attention.

Portfolio completo:

`OVER_CAPACITY`.

P11 debe reducir concurrencia.

---

# **102\. EJEMPLO 6 — DOS PORTFOLIOS VÁLIDOS**

Portfolio A:

* más expected value;  
* mayor cash commitment.

Portfolio B:

* menor expected value;  
* mayor reversibility;  
* más buffer.

Si P1/risk policy no define preferencia suficiente:

`MULTIPLE_VALID_PORTFOLIOS`.

No inventar una respuesta única.

---

# **103\. INTERFAZ CON P12**

P11 debe entregar a P12:

* active set;  
* blocked;  
* queue;  
* concurrency;  
* allocation;  
* conflicts;  
* reasons;  
* alternatives;  
* triggers.

Así P12 podrá explicar no solo:

> por qué A es prioritario,

sino también:

> por qué B puede avanzar a la vez,  
> por qué C espera,  
> y por qué D se detiene.

---

# **104\. DEFINITION OF DONE — P11**

P11 está completo cuando el sistema puede responder:

**WHAT IS ACTUALLY ACTIVE?**

Existe active set.

**WHAT CAN RUN AT THE SAME TIME?**

Existen concurrency groups.

**WHAT MUST WAIT?**

Existe queue/deferred state.

**WHAT IS BLOCKED?**

Se conserva por separado.

**DO HIGH PRIORITIES COMPETE FOR THE SAME RESOURCE?**

Existe resource conflict.

**CAN WE AFFORD THE COMBINATION?**

Existe portfolio feasibility.

**ARE WE RUNNING TOO MANY THINGS AT ONCE?**

Existe WIP policy.

**DOES A LOWER-RANKED ITEM NEED TO RUN AS AN ENABLER?**

Existe portfolio role.

**DO WE NEED TO PREEMPT EXISTING WORK?**

Existe preemption.

**ARE THERE MULTIPLE VALID PORTFOLIOS?**

El sistema puede admitirlo.

**WHAT WOULD CHANGE THE ACTIVE SET?**

Existen triggers.

P11 no define cómo resolver cada candidate.

Produce:

> **el conjunto sostenible de prioridades que el negocio puede mantener activas simultáneamente.**

