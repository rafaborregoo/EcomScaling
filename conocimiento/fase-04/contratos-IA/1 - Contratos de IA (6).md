# **P6 — ESFUERZO, RECURSOS Y FACTIBILIDAD**

## **0\. Propósito**

P6 define cómo debe representar el sistema:

* los recursos necesarios para atender un candidato;  
* la capacidad disponible;  
* el esfuerzo requerido;  
* la complejidad operativa;  
* el tiempo de movilización;  
* las capacidades necesarias;  
* la factibilidad real dentro del contexto actual.

Su responsabilidad es responder:

> ¿Qué necesitamos para poder abordar este candidato y hasta qué punto es realmente factible hacerlo?

P6 NO responde:

* cuánto valor tiene → P4;  
* qué dependencia existe → P5;  
* qué riesgo asumimos → P7;  
* si económicamente merece la pena → P8;  
* qué candidato debe ganar → P10;  
* cómo implementar la solución → Fase 5\.

---

# **1\. Principio fundamental**

Debe mantenerse:

**EFFORT**

≠

**COST**

≠

**COMPLEXITY**

≠

**RESOURCE REQUIREMENT**

≠

**CAPACITY**

≠

**FEASIBILITY**

≠

**PRIORITY**

Un candidato puede ser:

* barato pero imposible;  
* caro pero altamente factible;  
* sencillo conceptualmente pero sin capacidad disponible;  
* complejo pero estratégico;  
* rápido pero de escaso valor.

Por tanto:

> LOW EFFORT DOES NOT IMPLY HIGH PRIORITY.

Y:

> HIGH EFFORT DOES NOT IMPLY LOW PRIORITY.

---

# **2\. Entidad principal**

Entidad:

**FEASIBILITY\_ASSESSMENT**

Relación:

`PRIORITY_CANDIDATE`

→ `FEASIBILITY_ASSESSMENT`

Cada assessment pertenece a:

* un candidate;  
* un prioritization run;  
* un decision context;  
* un snapshot de recursos/capacidades.

P6 será source of truth de la dimensión:

**RESOURCE / EFFORT / FEASIBILITY**

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `feasibility_assessment_id` | Sí | identidad |
| `candidate_id` | Sí | candidato |
| `prioritization_run_id` | Sí | ejecución |
| `assessment_state` | Sí | validez |
| `resource_requirement_refs[]` | Sí | recursos necesarios |
| `capacity_snapshot_ref` | Condicional | capacidad disponible |
| `capability_requirement_refs[]` | Opcional | capacidades necesarias |
| `effort_estimate_ref` | Condicional | esfuerzo |
| `complexity_profile_ref` | Opcional | complejidad |
| `feasibility_state` | Sí | síntesis |
| `resource_gap_refs[]` | Opcional | déficits |
| `lead_time_ref` | Opcional | tiempo mínimo |
| `assumptions[]` | Opcional | supuestos |
| `unknowns[]` | Opcional | desconocidos |
| `evidence_refs[]` | Sí | soporte |
| `evaluated_at` | Sí | timestamp |
| `policy_version` | Sí | versión |

---

# **4\. RESOURCE\_REQUIREMENT**

Entidad:

**RESOURCE\_REQUIREMENT**

Representa:

> un recurso necesario para poder avanzar con un candidato.

Campos:

* `resource_requirement_id`;  
* `candidate_id`;  
* `resource_type`;  
* `resource_ref`;  
* `required_amount`;  
* `measurement_unit`;  
* `required_from`;  
* `required_until`;  
* `criticality`;  
* `substitutability`;  
* `source_refs[]`;  
* `epistemic_state`.

---

# **5\. RESOURCE\_TYPE**

Taxonomía inicial:

`BUDGET`

`CASH`

`PEOPLE`

`ROLE_CAPACITY`

`TIME`

`TECHNICAL_CAPACITY`

`DATA`

`INVENTORY`

`SYSTEM`

`TOOL`

`VENDOR`

`MANAGEMENT_ATTENTION`

`SPECIALIZED_KNOWLEDGE`

`PHYSICAL_CAPACITY`

`OTHER`

No crear un enum para cada puesto o herramienta.

Los objetos específicos se referencian mediante `resource_ref`.

---

# **6\. RESOURCE REQUIREMENT ≠ CONSTRAINT**

P6 dice:

> este candidato necesita X recurso.

P5 dice:

> la disponibilidad o limitación de ese recurso constituye un constraint.

Ejemplo:

P6:

> requiere capacidad de ingeniería.

P5:

> existe un hard constraint porque no hay capacidad técnica disponible.

No duplicar ownership.

---

# **7\. CAPACITY SNAPSHOT**

Entidad:

**RESOURCE\_CAPACITY\_SNAPSHOT**

Representa:

> capacidad realmente disponible en el momento de la decisión.

Puede incluir:

* recursos totales;  
* recursos comprometidos;  
* capacidad libre;  
* disponibilidad temporal;  
* reservas;  
* incertidumbre.

Debe ser snapshot/versionado.

---

# **8\. AVAILABLE ≠ TOTAL CAPACITY**

Debe mantenerse:

**TOTAL CAPACITY**

≠

**AVAILABLE CAPACITY**

Ejemplo:

equipo:

160 horas/mes totales.

Pero:

130 ya comprometidas.

Capacidad potencialmente disponible:

30. 

No puede utilizarse 160 en el cálculo de factibilidad.

---

# **9\. AVAILABLE ≠ ALLOCATABLE**

Incluso la capacidad libre puede no ser asignable.

Por tanto:

**AVAILABLE CAPACITY**

≠

**ALLOCATABLE CAPACITY**

Puede existir capacidad libre pero reservada para:

* operaciones críticas;  
* incidentes;  
* compromisos previos;  
* obligaciones.

P6 deberá poder distinguirla.

---

# **10\. RESOURCE CRITICALITY**

Estados:

`MANDATORY`

`STRONGLY_REQUIRED`

`SUBSTITUTABLE`

`OPTIONAL`

Si falta un recurso `MANDATORY`, el candidate puede ser:

`NOT_CURRENTLY_FEASIBLE`.

---

# **11\. RESOURCE SUBSTITUTABILITY**

Valores:

`NON_SUBSTITUTABLE`

`PARTIALLY_SUBSTITUTABLE`

`FULLY_SUBSTITUTABLE`

`UNKNOWN`

Ejemplo:

un conocimiento especializado podría sustituirse mediante:

* recurso interno;  
* proveedor;  
* herramienta.

P6 registra posibilidad de sustitución.

No prescribe cuál contratar.

---

# **12\. RESOURCE GAP**

Entidad:

**RESOURCE\_GAP**

Conceptualmente:

`requirement - allocatable_capacity`

cuando la medida sea cuantificable.

Puede expresarse como:

* valor exacto;  
* rango;  
* categoría;  
* UNKNOWN.

---

# **13\. RESOURCE GAP ≠ BLOCKER**

Un resource gap puede convertirse en blocker.

Pero no siempre.

Ejemplo:

requiere 50 horas.

Disponibles 40\.

Puede existir:

* reducción de scope;  
* secuenciación;  
* capacidad posterior.

P5 determinará si la situación actúa como blocker/constraint.

P6 describe el gap.

---

# **14\. EFFORT\_ESTIMATE**

Entidad:

**EFFORT\_ESTIMATE**

Debe representar:

> cantidad de trabajo necesario para mover el candidato desde su estado actual hasta un estado decisionalmente relevante.

No necesariamente hasta “solución completa”.

Campos:

* `effort_estimate_id`;  
* `candidate_id`;  
* `effort_dimensions[]`;  
* `estimate_type`;  
* `estimate_range`;  
* `unit`;  
* `assumptions[]`;  
* `source_refs[]`;  
* `epistemic_state`.

---

# **15\. NO FALSA PRECISIÓN**

No utilizar:

`effort_score = 6.8`

sin metodología.

Preferir:

* horas/días cuando puedan estimarse;  
* rangos;  
* categorías definidas;  
* UNKNOWN.

Ejemplo:

`80–120 engineering_hours`

es mejor que:

`effort = 74/100`.

---

# **16\. EFFORT DIMENSIONS**

Esfuerzo puede tener distintas dimensiones:

`HUMAN_EFFORT`

`FINANCIAL_EFFORT`

`COORDINATION_EFFORT`

`TECHNICAL_EFFORT`

`OPERATIONAL_EFFORT`

`MANAGEMENT_EFFORT`

`CHANGE_EFFORT`

`LEARNING_EFFORT`

No deben sumarse automáticamente.

---

# **17\. EFFORT ≠ FINANCIAL COST**

100 horas de equipo interno:

es esfuerzo.

El coste económico de esas horas:

es otra representación.

Puede calcularse si existe metodología válida.

No automáticamente.

---

# **18\. IMPLEMENTATION COST**

P6 puede almacenar:

**RESOURCE\_COST**

cuando existe coste para movilizar recursos.

Ejemplos:

* proveedor;  
* software;  
* horas externas;  
* infraestructura;  
* contratación.

Pero:

`implementation_cost`

no es todavía:

`net expected value`.

P8 utilizará esos costes.

---

# **19\. SUNK COST**

Los costes ya incurridos no deben aumentar artificialmente prioridad.

Debe distinguirse:

`SUNK_COST`

de

`FUTURE_REQUIRED_COST`.

P6 podrá registrar sunk cost como contexto.

Pero P8 no debe tratarlo como razón para continuar automáticamente.

---

# **20\. COMMITMENT**

Puede existir:

`already_committed_resource`.

Esto afecta capacidad.

Pero:

> “ya hemos invertido mucho”

no debe convertirse automáticamente en:

> debemos terminar.

El runtime debe evitar sunk cost bias.

---

# **21\. COMPLEXITY PROFILE**

Entidad:

**COMPLEXITY\_PROFILE**

Puede representar:

* número de sistemas implicados;  
* equipos;  
* dependencias;  
* incertidumbre técnica;  
* coordinación;  
* integraciones;  
* cambios organizativos.

P6 puede clasificar complejidad.

Pero:

**COMPLEXITY**

≠

**EFFORT**

---

# **22\. COMPLEXITY ≠ DIFFICULTY**

Una intervención puede involucrar muchos sistemas y ser técnicamente rutinaria.

Otra puede afectar un único componente pero ser extremadamente difícil.

P6 deberá evitar una sola etiqueta genérica.

---

# **23\. COMPLEXITY DIMENSIONS**

Valores iniciales:

`TECHNICAL`

`ORGANIZATIONAL`

`CROSS_FUNCTIONAL`

`DATA`

`PROCESS`

`INTEGRATION`

`COORDINATION`

`CHANGE_MANAGEMENT`

No generan prioridad.

---

# **24\. CAPABILITY REQUIREMENT**

Entidad:

**CAPABILITY\_REQUIREMENT**

Representa:

> una capacidad que debe existir para abordar un candidato responsablemente.

Ejemplos:

* analytics fiable;  
* expertise técnico;  
* creative production;  
* financial modeling;  
* supply-chain planning.

---

# **25\. CAPABILITY STATE**

Comparación entre requirement y business capability:

`AVAILABLE`

`AVAILABLE_WITH_LIMITATIONS`

`DEVELOPABLE`

`EXTERNALLY_ACQUIRABLE`

`UNAVAILABLE`

`UNKNOWN`

---

# **26\. CAPABILITY GAP**

Debe mantenerse:

**CAPABILITY GAP**

≠

**RESOURCE GAP**

Puede existir:

personas disponibles

pero sin conocimiento necesario.

O:

capability existente

pero sin capacidad horaria.

---

# **27\. FEASIBILITY**

P6 sintetiza mediante:

`feasibility_state`.

Estados:

`FEASIBLE_NOW`

`FEASIBLE_WITH_LIMITATIONS`

`CONDITIONALLY_FEASIBLE`

`FEASIBLE_LATER`

`NOT_CURRENTLY_FEASIBLE`

`NOT_FEASIBLE_IN_CONTEXT`

`UNKNOWN`

---

# **28\. FEASIBLE NOW**

Significa:

> los recursos y capacidades mínimas necesarias existen o pueden asignarse dentro del contexto actual.

No significa:

> conviene hacerlo.

---

# **29\. CONDITIONALLY FEASIBLE**

Significa:

> puede realizarse si se cumplen determinadas condiciones conocidas.

Debe contener:

`feasibility_conditions[]`.

Ejemplo:

* liberar capacidad;  
* obtener aprobación;  
* disponer de datos;  
* alcanzar determinada fecha.

Las condiciones pueden referenciar P5.

---

# **30\. NOT CURRENTLY FEASIBLE**

Significa:

> bajo el estado actual no existen recursos/capacidades suficientes.

No significa:

> nunca debe hacerse.

---

# **31\. NOT FEASIBLE IN CONTEXT**

Más fuerte:

> existe incompatibilidad material con las condiciones actuales del Decision Context.

Ejemplo:

una iniciativa requiere recursos que no pueden existir dentro del horizonte relevante.

---

# **32\. FEASIBILITY ≠ EXECUTABILITY**

Conviene distinguir:

**FEASIBILITY**

> ¿puede hacerse?

de

**EXECUTION READINESS**

> ¿puede comenzar ahora mismo?

Un candidato puede ser factible pero todavía:

* bloqueado;  
* esperando dependencia;  
* sin autorización.

Execution readiness se consumirá posteriormente.

---

# **33\. EXECUTION READINESS SIGNAL**

P6 puede emitir un estado auxiliar:

`READY_RESOURCE_WISE`

`RESOURCE_PREPARATION_REQUIRED`

`RESOURCE_BLOCKED`

`UNKNOWN`

Pero no sustituye P5/P11.

---

# **34\. LEAD TIME**

Entidad:

**MOBILIZATION\_LEAD\_TIME**

Representa:

> tiempo mínimo necesario para disponer de recursos/capacidades y poder iniciar razonablemente el trabajo.

No es:

> duración total de la futura intervención.

Porque la acción todavía pertenece a Fase 5\.

---

# **35\. LEAD TIME ≠ DURATION**

Ejemplo:

podemos necesitar:

3 semanas para disponer de un especialista.

Eso es mobilization lead time.

La duración del proyecto posterior puede ser:

8 semanas.

P6 en Fase 4 no necesita necesariamente conocer el playbook completo.

---

# **36\. INTERFAZ TEMPORAL CON P3**

P6 puede producir:

`mobilization_lead_time`.

P3 puede utilizarlo para calcular:

`temporal_slack`.

Ownership:

P6 → lead time.

P3 → relación temporal con deadline/window.

---

# **37\. ESTIMACIÓN POR RANGO**

Cuando exista incertidumbre:

`effort_estimate = 2–4 semanas`

en vez de:

`3 semanas`

si 3 no está fundamentado.

El rango debe incluir:

* lower;  
* upper;  
* unidad;  
* assumptions.

---

# **38\. ESTIMATE BASIS**

Toda estimación significativa deberá indicar:

`estimate_basis`.

Tipos:

`HISTORICAL_ACTUAL`

`ANALOGOUS_WORK`

`RESOURCE_PLAN`

`VENDOR_ESTIMATE`

`EXPERT_ESTIMATE`

`MODEL_INFERENCE`

`UNKNOWN`

---

# **39\. MODEL ESTIMATE**

Una estimación realizada por IA:

`estimate_basis = MODEL_INFERENCE`

no puede presentarse como planificación confirmada.

Deberá indicar:

* evidence refs;  
* assumptions;  
* uncertainty;  
* validation state.

---

# **40\. COST RANGE**

Igual que esfuerzo:

coste puede ser:

`EXACT`

`ESTIMATED_RANGE`

`SCENARIO_BASED`

`UNKNOWN`

No usar cifras artificialmente exactas.

---

# **41\. RESOURCE CONTENTION**

P6 debe poder detectar que múltiples candidatos necesitan el mismo recurso escaso.

Entidad:

**RESOURCE\_CONTENTION**

Campos:

* `resource_ref`;  
* `candidate_refs[]`;  
* `capacity_ref`;  
* `combined_demand`;  
* `available_capacity`;  
* `contention_state`.

---

# **42\. CONTENTION\_STATE**

`NONE`

`POTENTIAL`

`ACTIVE`

`OVER_CAPACITY`

`UNKNOWN`

Esta información será fundamental para P11.

---

# **43\. CONTENTION ≠ PRIORITY CONFLICT**

Dos candidatos pueden competir por el mismo diseñador.

Eso crea:

resource contention.

Pero todavía no sabemos:

> cuál merece el recurso.

Eso lo resolverán P10/P11.

---

# **44\. PARALLEL CAPACITY**

P6 debe proporcionar información para saber si candidatos pueden desarrollarse simultáneamente desde la perspectiva de recursos.

Ejemplo:

A usa engineering.

B usa creative.

Podrían no competir por recursos.

Pero P11 decidirá concurrencia real considerando también dependencias y portfolio.

---

# **45\. RESOURCE EXCLUSIVITY**

Puede existir:

`EXCLUSIVE`

`SHARED`

`DIVISIBLE`

`PARTIALLY_DIVISIBLE`

`UNKNOWN`

Esto evita asumir que toda capacidad puede repartirse arbitrariamente.

---

# **46\. MANAGEMENT ATTENTION**

Debe tratarse como recurso real.

Un negocio puede tener:

* dinero;  
* equipo;  
* tecnología;

pero capacidad limitada de dirección.

P6 puede modelar:

`MANAGEMENT_ATTENTION`

sin convertirlo en metáfora.

---

# **47\. CONTEXT SWITCHING**

Cuando múltiples iniciativas consumen el mismo equipo, puede existir:

`coordination/context_switching overhead`.

Solo debe considerarse si existe evidencia o policy.

No inventar porcentajes universales de pérdida de productividad.

---

# **48\. MINIMUM VIABLE RESOURCE PACKAGE**

Puede existir:

**MINIMUM\_RESOURCE\_SET**

Representa:

> conjunto mínimo de recursos necesarios para que el candidato sea realmente movilizable.

Esto evita:

> “tenemos parte del equipo, por tanto es factible”.

---

# **49\. PARTIAL FEASIBILITY**

Algunos candidatos pueden abordarse parcialmente.

Debe poder declararse:

`PARTIAL_SCOPE_FEASIBLE`

si existe un subconjunto claramente separable.

Pero P6 no debe diseñar el scope de la intervención.

Solo declarar la condición.

---

# **50\. RESOURCES AT RISK OF OVERCOMMITMENT**

P6 debe detectar:

`OVERCOMMITTED_RESOURCE`

cuando:

`current_commitments + required_demand > allocatable_capacity`

si los datos son comparables.

No compensar mediante optimismo de IA.

---

# **51\. CAPACITY BUFFER**

Si existe una política empresarial de reserva:

`capacity_buffer_ref`

debe respetarse.

Ejemplo:

20 % de engineering reservado a incidentes.

No debe utilizarse como disponible salvo override autorizado.

---

# **52\. RESOURCE CALENDAR**

Los recursos pueden tener disponibilidad temporal.

Entidad/ref:

`resource_calendar_ref`.

Ejemplo:

capacidad disponible:

* noviembre: baja;  
* diciembre: alta.

P6 no debe reducir todo a:

`available_hours = 100`

si la temporalidad cambia la factibilidad.

---

# **53\. EXTERNAL RESOURCES**

Puede existir capacidad externa:

* proveedor;  
* agencia;  
* freelance;  
* partner;  
* plataforma.

P6 puede considerar:

`externally_acquirable_capacity`.

Pero debe distinguir:

**AVAILABLE NOW**

de

**POTENTIALLY ACQUIRABLE**.

---

# **54\. PROCUREMENT LEAD TIME**

Una capacidad externamente adquirible puede tener:

* coste;  
* lead time;  
* uncertainty.

No es equivalente a capacidad interna disponible.

---

# **55\. UNKNOWN RESOURCE REQUIREMENT**

Si no sabemos cuánto esfuerzo requiere:

`UNKNOWN`.

No convertirlo automáticamente en:

`HIGH`.

Alto esfuerzo y esfuerzo desconocido son conceptos distintos.

---

# **56\. UNKNOWN CAPACITY**

Igualmente:

si no conocemos capacidad:

`UNKNOWN`.

No asumir:

* cero;  
* ilimitada;  
* “capacidad normal”.

---

# **57\. FEASIBILITY CONFIDENCE**

Siguiendo P0:

`SUFFICIENT_TO_ASSESS`

`SUFFICIENT_WITH_LIMITATIONS`

`VALIDATION_REQUIRED`

`INSUFFICIENT`

`UNKNOWN`

---

# **58\. NO PRIORITY BY EASE**

Hard rule:

Un candidato no puede ganar prioridad únicamente porque:

* sea rápido;  
* barato;  
* sencillo;  
* tenga recursos disponibles.

P10 puede considerar factibilidad.

Pero debe combinarla con el resto de la arquitectura.

---

# **59\. NO PENALTY BY DIFFICULTY**

Asimismo:

un candidato no puede perder automáticamente porque:

* sea complejo;  
* caro;  
* demande varios equipos.

Puede tratarse del constraint central del negocio.

---

# **60\. QUICK WIN**

`QUICK_WIN` no debería ser una entidad fundamental.

Puede ser una clasificación derivada posteriormente cuando coincidan:

* valor material;  
* esfuerzo relativamente bajo;  
* factibilidad;  
* tiempo;  
* riesgo.

P6 por sí solo no puede declarar:

> esto es un quick win.

---

# **61\. RESOURCE EFFICIENCY**

P6 no debe calcular:

`value / effort`

como prioridad.

Eso sería una síntesis prematura.

P8/P10 podrán evaluar eficiencia decisional si corresponde.

---

# **62\. BUDGET**

Debe distinguirse:

`BUDGET_AUTHORIZED`

`BUDGET_AVAILABLE`

`CASH_AVAILABLE`

No son equivalentes.

Una empresa puede tener presupuesto aprobado pero no caja.

P5/P6 deben preservar esa diferencia.

---

# **63\. FINANCIAL RESOURCE**

P6 puede referenciar:

* approved budget;  
* cash;  
* credit;  
* committed spending.

Pero no realiza análisis financiero completo del negocio.

Consume datos existentes.

---

# **64\. HUMAN RESOURCE**

Para capacidad humana no basta:

`headcount = 5`.

Debe poder considerar:

* rol;  
* skills;  
* allocatable time;  
* calendario;  
* commitments.

Cinco personas no equivalen automáticamente a cinco unidades intercambiables.

---

# **65\. DATA AS RESOURCE**

Datos pueden ser un recurso.

Debe distinguirse:

`DATA_EXISTS`

`DATA_ACCESSIBLE`

`DATA_USABLE`

`DATA_TRUSTWORTHY`

Una fuente puede existir pero no ser utilizable.

---

# **66\. TOOL/SYSTEM AVAILABILITY**

Debe distinguirse:

* herramienta disponible;  
* acceso disponible;  
* integración disponible;  
* capability operativa disponible.

Tener una cuenta de software no significa poder ejecutar una iniciativa.

---

# **67\. ORGANIZATIONAL READINESS**

Puede existir:

`organizational_readiness`.

Pero no debería convertirse en un score arbitrario.

Puede depender de condiciones observables:

* ownership;  
* approval;  
* responsible team;  
* operating capacity;  
* governance.

---

# **68\. OWNERSHIP**

Un candidato sin owner no es necesariamente inviable.

Pero puede tener:

`ownership_gap`.

Esto puede afectar mobilization.

No debe confundirse:

`no owner`

con

`low priority`.

---

# **69\. ASSESSMENT\_STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT_INFORMATION`

`STALE`

`NOT_APPLICABLE`

`INVALID`

---

# **70\. OUTPUT P6**

Contrato:

**FEASIBILITY\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `assessment_state` | validez |
| `feasibility_state` | factibilidad |
| `resource_requirement_refs[]` | demanda |
| `resource_gap_refs[]` | gaps |
| `capability_requirement_refs[]` | capacidades |
| `effort_estimate_ref` | esfuerzo |
| `resource_cost_refs[]` | coste |
| `complexity_profile_ref` | complejidad |
| `mobilization_lead_time_ref` | tiempo de movilización |
| `contention_refs[]` | recursos compartidos |
| `feasibility_conditions[]` | condiciones |
| `unknowns[]` | desconocidos |
| `warnings[]` | limitaciones |
| `evidence_refs[]` | soporte |
| `rule_trace_refs[]` | trazabilidad |

---

# **71\. REASON CODES**

Familias:

`RESOURCE.*`

`EFFORT.*`

`CAPACITY.*`

`CAPABILITY.*`

`FEASIBILITY.*`

Ejemplos:

`RESOURCE.MANDATORY_MISSING`

`RESOURCE.SHARED_CONTENTION`

`RESOURCE.EXTERNALLY_ACQUIRABLE`

`CAPACITY.INSUFFICIENT`

`CAPACITY.OVERCOMMITTED`

`CAPACITY.UNKNOWN`

`CAPABILITY.MISSING`

`CAPABILITY.DEVELOPABLE`

`EFFORT.RANGE_ESTIMATE`

`EFFORT.UNKNOWN`

`FEASIBILITY.FEASIBLE_NOW`

`FEASIBILITY.CONDITIONAL`

`FEASIBILITY.NOT_CURRENTLY_FEASIBLE`

---

# **72\. INVARIANTES P6**

1. Effort no equivale a priority.  
2. Complexity no equivale a effort.  
3. Cost no equivale a effort.  
4. Resource requirement no equivale a constraint.  
5. Capacity total no equivale a capacidad asignable.  
6. Resource gap no equivale automáticamente a blocker.  
7. Feasible no equivale a recomendable.  
8. Infeasible ahora no equivale a inútil.  
9. UNKNOWN effort no equivale a high effort.  
10. UNKNOWN capacity no equivale a cero.  
11. No se inventan horas/costes.  
12. No se suman dimensiones heterogéneas de esfuerzo sin metodología.  
13. P6 no calcula expected value.  
14. P6 no divide impact entre effort para generar prioridad.  
15. Sunk cost no incrementa prioridad.  
16. Management attention puede ser recurso.  
17. Resource contention debe conservarse para P11.  
18. Mobilization lead time no equivale a duración total de ejecución.  
19. P6 no prescribe cómo adquirir recursos.  
20. P6 no diseña el playbook.

---

# **73\. PRECONDICIONES**

P6 necesita:

* candidate válido P2;  
* decision context P1;  
* constraints/dependencies relevantes P5;  
* resource snapshots disponibles;  
* capability information cuando sea necesaria;  
* horizonte temporal.

Puede funcionar con información incompleta y producir UNKNOWN.

---

# **74\. POSTCONDICIONES**

P6 termina correctamente cuando puede responder:

* qué recursos requiere el candidato;  
* qué capacidad existe;  
* qué gaps aparecen;  
* qué capabilities faltan;  
* qué esfuerzo puede estimarse;  
* qué coste puede estimarse;  
* cuánto tiempo requiere movilizar recursos;  
* si existe contention;  
* bajo qué condiciones resulta factible;  
* qué permanece desconocido.

---

# **75\. FAILURE MODES**

## **Easy-first bias**

“Esto tarda dos horas, hagámoslo primero.”

**Prevención:** effort ≠ priority.

---

## **Hard-is-bad bias**

“Esto requiere tres meses, por tanto baja prioridad.”

**Prevención:** feasibility separada de business importance.

---

## **Headcount fallacy**

“Tenemos cinco personas disponibles.”

Sin considerar skill/capacidad/commitments.

**Prevención:** resource requirements estructurados.

---

## **Total-capacity fallacy**

Se utiliza capacidad total como disponible.

**Prevención:** allocatable capacity.

---

## **Sunk-cost bias**

“Hemos invertido €50k, debemos continuar.”

**Prevención:** sunk cost separado.

---

## **Point-estimate hallucination**

La IA decide:

“72 horas de desarrollo”.

**Prevención:** estimate basis \+ ranges \+ epistemic state.

---

## **Resource duplication**

P5 y P6 almacenan cifras diferentes de disponibilidad.

**Prevención:** P6 source of truth cuantitativa.

---

## **Playbook leakage**

“Necesitamos contratar dos developers.”

**Prevención:** P6 puede decir capability/resource gap; Fase 5 decide intervención.

---

# **76\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| required 100h, allocatable 150h | recurso suficiente |
| required 100h, allocatable 50h | resource gap |
| capacidad total 200h, 180h comprometidas | no usar 200h |
| skill obligatorio ausente | capability gap |
| recurso externamente adquirible | conditional feasibility |
| requirement UNKNOWN | no high effort automático |
| capacity UNKNOWN | validation/unknown |
| candidato fácil y bajo valor | P6 no eleva prioridad |
| candidato complejo y crítico | P6 no lo descarta |
| dos candidates usan mismo recurso | contention |
| recursos distintos | no contention automática |
| sunk cost elevado | no cambia feasibility futura por sí solo |
| estimación IA | marcada inferred |
| coste exacto documentado | CALCULATED/OBSERVED según origen |
| rango 80–120h | conservar rango |
| lead time 3 semanas | no convertir en total duration |
| mismo snapshot | mismo resultado determinista |

---

# **77\. EVALS IA**

### **Effort estimation discipline**

¿Evita inventar estimaciones exactas?

### **Resource reasoning**

¿Distingue recurso necesario de capacidad disponible?

### **Capacity reasoning**

¿Considera compromisos existentes?

### **Capability/resource separation**

¿Distingue falta de skill de falta de tiempo?

### **Easy-first bias eval**

¿Evita recomendar algo solo porque sea fácil?

### **Sunk-cost bias eval**

¿Evita justificar continuidad por inversión pasada?

### **Feasibility semantics eval**

¿Distingue “no ahora” de “nunca”?

### **Boundary eval**

¿Evita diseñar la forma concreta de conseguir recursos?

---

# **78\. EJEMPLO 1 — CRO**

Candidate:

> deterioro significativo de checkout mobile.

P6 podría detectar:

Resource requirements:

* analytics capacity;  
* technical capacity;  
* product/design capacity.

Si existen:

`FEASIBLE_NOW`.

P6 NO concluye:

> hacerlo primero.

---

# **79\. EJEMPLO 2 — NUEVO MERCADO**

Candidate:

> oportunidad de expansión internacional.

P6 puede detectar:

* capacidad operativa insuficiente;  
* knowledge gap;  
* integration requirement;  
* management attention elevado.

Resultado:

`CONDITIONALLY_FEASIBLE`.

P6 no concluye si merece la inversión.

---

# **80\. EJEMPLO 3 — CREATIVE PRODUCTION**

Candidate:

> deterioro de performance creativo.

Resources:

* creative team;  
* production capacity;  
* approval capacity.

Si el equipo está al 100 %:

`RESOURCE_CONTENTION`.

No significa:

> baja prioridad.

Significa:

> existe un problema de asignación que P11 tendrá que resolver.

---

# **81\. EJEMPLO 4 — DOS CANDIDATOS**

Candidate A:

requiere engineering.

Candidate B:

requiere creative.

No existe resource contention directa.

Por tanto podrían ser compatibles desde P6.

P11 deberá comprobar además:

* dependencias;  
* riesgos;  
* portfolio;  
* capacidad directiva.

---

# **82\. INTERFAZ CON P3**

P6 proporciona:

`mobilization_lead_time`.

P3 compara ese tiempo con:

* deadline;  
* window;  
* temporal slack.

Así evitamos que P3 invente effort.

---

# **83\. INTERFAZ CON P5**

P6:

> faltan 60 horas de ingeniería.

P5:

> ese gap actúa como constraint/blocker.

Una sola fuente cuantitativa.

Dos interpretaciones distintas.

---

# **84\. INTERFAZ CON P7**

P6 puede decir:

> técnicamente factible.

P7 puede decir:

> pero muy arriesgado.

Factibilidad no implica seguridad.

---

# **85\. INTERFAZ CON P8**

P8 podrá consumir:

* implementation costs;  
* resource requirements;  
* capacity scarcity;  
* lead time;  
* feasibility.

Para construir economics decisionales.

P6 no calcula ROI ni EV.

---

# **86\. INTERFAZ CON P10**

P10 puede considerar factibilidad.

Pero debe respetar:

> “ser fácil” no crea prioridad.

Un candidate puede ocupar alta business priority y permanecer:

`NOT_CURRENTLY_FEASIBLE`.

---

# **87\. INTERFAZ CON P11**

P11 será el principal consumidor de:

* resource contention;  
* shared capacity;  
* exclusivity;  
* temporal availability;  
* capacity gaps.

P6 responde:

> ¿qué necesita cada candidato?

P11:

> ¿qué combinación podemos permitirnos simultáneamente?

---

# **88\. DEFINITION OF DONE — P6**

P6 está completo cuando el sistema puede responder:

**WHAT DOES THIS REQUIRE?**

Existen resource requirements.

**DO WE ACTUALLY HAVE IT?**

Existe capacity snapshot.

**WHAT IS MISSING?**

Existen resource/capability gaps.

**HOW MUCH EFFORT IS INVOLVED?**

Existe estimación defendible o UNKNOWN.

**HOW MUCH WILL RESOURCE MOBILIZATION COST?**

Existe cost cuando puede conocerse.

**HOW COMPLEX IS IT?**

Complejidad está separada del esfuerzo.

**HOW LONG BEFORE WE CAN REALISTICALLY START?**

Existe mobilization lead time.

**ARE OTHER CANDIDATES COMPETING FOR THE SAME RESOURCES?**

Existe resource contention.

**CAN THIS BE DONE NOW?**

Existe feasibility state.

**UNDER WHAT CONDITIONS?**

Existen feasibility conditions.

**WHAT DON'T WE KNOW?**

La incertidumbre permanece explícita.

P6 no responde:

> ¿merece la pena?

Responde:

> **¿qué exige realmente este candidato y puede el negocio movilizarlo dentro del contexto actual?**

