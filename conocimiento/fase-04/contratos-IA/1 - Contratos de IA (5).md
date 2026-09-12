# **P5 — CONSTRAINTS Y DEPENDENCIAS**

## **0\. Propósito**

P5 define cómo debe representar el sistema aquello que:

* limita;  
* bloquea;  
* condiciona;  
* restringe;  
* precede;  
* habilita;  
* o invalida

la capacidad real de atender un candidato.

Su responsabilidad es responder:

> ¿Qué está impidiendo, condicionando o secuenciando la captura de valor asociada a este candidato?

P5 NO responde:

* cuánto impacto tiene → P4;  
* cuánto esfuerzo requiere → P6;  
* qué riesgo tiene → P7;  
* cuál es el expected value → P8;  
* cuál debe ir primero → P10;  
* cómo resolver el blocker → Fase 5\.

La regla central es:

> LIMITATION IS NOT THE SAME THING AS SEQUENCE.

Y:

> CAUSALITY IS NOT THE SAME THING AS DEPENDENCY.

---

# **1\. Distinciones protegidas**

P5 debe mantener separadas:

**CONSTRAINT**

≠

**DEPENDENCY**

≠

**BLOCKER**

≠

**PREREQUISITE**

≠

**GATE**

≠

**RESOURCE LIMIT**

≠

**CAUSE**

≠

**ROOT CAUSE**

≠

**EXECUTION ORDER**

---

# **2\. RESPONSABILIDAD DE P5**

P5 será source of truth de:

* constraints decisionales relevantes;  
* dependencies entre candidatos;  
* prerequisites;  
* blockers;  
* dependency satisfaction;  
* secuencias obligatorias;  
* dependency graphs;  
* constraint applicability;  
* constraint hardness;  
* condiciones de desbloqueo.

No será source of truth de:

* causalidad diagnóstica → Fase 3;  
* recursos/estimación de capacidad → P6;  
* legalidad general del sistema → P0/gates específicos;  
* portfolio → P11;  
* estrategia de resolución → Fase 5\.

---

# **3\. ENTIDAD PRINCIPAL DE CONSTRAINT**

Entidad:

**DECISION\_CONSTRAINT**

Representa:

> una condición que limita el espacio de decisión o la capacidad de capturar valor.

Relación:

`PRIORITY_CANDIDATE`

→ `DECISION_CONSTRAINT[]`

Un constraint puede afectar:

* un candidato;  
* varios candidatos;  
* todo el candidate set;  
* toda la ejecución.

---

# **4\. ESTRUCTURA DE DECISION\_CONSTRAINT**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `constraint_id` | Sí | identidad |
| `prioritization_run_id` | Sí | ejecución |
| `constraint_type` | Sí | naturaleza |
| `constraint_scope` | Sí | ámbito |
| `constraint_strength` | Sí | dureza |
| `constraint_state` | Sí | estado |
| `subject_refs[]` | Sí | elementos afectados |
| `source_refs[]` | Sí | procedencia |
| `evidence_refs[]` | Condicional | soporte |
| `limit_definition` | Sí | qué restringe |
| `relaxability` | Sí | si puede relajarse |
| `temporary` | Sí | temporal/permanente |
| `valid_from` | Sí | vigencia |
| `valid_until` | Opcional | fin |
| `epistemic_state` | Sí | conocimiento |
| `policy_version` | Sí | reglas |

---

# **5\. CONSTRAINT\_TYPE**

Taxonomía inicial:

`LEGAL`

`REGULATORY`

`CONTRACTUAL`

`FINANCIAL`

`CASH`

`CAPACITY`

`INVENTORY`

`TECHNICAL`

`OPERATIONAL`

`ORGANIZATIONAL`

`DATA`

`MARKET`

`CUSTOMER`

`STRATEGIC`

`POLICY`

`TIMING`

`OTHER`

No significa prioridad.

Describe naturaleza.

---

# **6\. CONSTRAINT\_STRENGTH**

P5 distinguirá:

`HARD`

`SOFT`

`CONDITIONAL`

`UNKNOWN`

### **HARD**

No puede ignorarse dentro del contexto actual.

### **SOFT**

Limita o penaliza pero puede superarse.

### **CONDITIONAL**

Solo actúa bajo ciertas condiciones.

### **UNKNOWN**

No sabemos todavía si constituye limitación efectiva.

---

# **7\. HARD CONSTRAINT**

Un hard constraint debe actuar como:

> reducción obligatoria del espacio de decisión.

Ejemplo:

presupuesto máximo aprobado.

No significa:

> este candidato es malo.

Significa:

> cualquier alternativa incompatible con este límite no puede tratarse como ejecutable bajo las condiciones actuales.

---

# **8\. SOFT CONSTRAINT**

Ejemplo:

capacidad limitada del equipo.

Puede hacer una opción menos factible.

Pero no necesariamente imposible.

P6 evaluará con precisión la capacidad/esfuerzo.

P5 registra:

> existe una limitación estructural relevante.

---

# **9\. CONSTRAINT ≠ RESOURCE QUANTITY**

P5 NO debe duplicar:

`developer_hours_available = 80`

si P6 ya es source of truth.

Debe usar:

`resource_capacity_ref`.

P5 interpreta:

> esa capacidad constituye un constraint para este candidato.

P6 contiene la cantidad.

---

# **10\. CONSTRAINT\_STATE**

Valores:

`ACTIVE`

`INACTIVE`

`SATISFIED`

`VIOLATED`

`PENDING_VALIDATION`

`EXPIRED`

`UNKNOWN`

Un constraint histórico no debe desaparecer.

---

# **11\. CONSTRAINT\_SCOPE**

Puede afectar:

`GLOBAL`

`CANDIDATE`

`CANDIDATE_GROUP`

`DOMAIN`

`PORTFOLIO`

Ejemplo:

cash disponible puede ser global.

Una API incompatible puede afectar solo a un candidato.

---

# **12\. CONSTRAINT APPLICABILITY**

Entidad conceptual:

**CONSTRAINT\_APPLICATION**

Debe indicar:

* constraint;  
* candidato;  
* applicability;  
* evidence;  
* reason.

Estados:

`APPLIES`

`DOES_NOT_APPLY`

`PARTIALLY_APPLIES`

`UNKNOWN`

---

# **13\. LIMIT DEFINITION**

Todo constraint debe indicar:

> ¿qué limita exactamente?

Ejemplos:

* coste máximo;  
* tiempo;  
* acceso a datos;  
* volumen;  
* capacidad;  
* mercado;  
* canal;  
* legalidad;  
* tecnología.

No basta con:

`constraint = budget`.

---

# **14\. RELAXABILITY**

Valores:

`NON_RELAXABLE`

`RELAXABLE_WITH_AUTHORIZATION`

`RELAXABLE_WITH_COST`

`RELAXABLE_WITH_DELAY`

`CONTEXT_DEPENDENT`

`UNKNOWN`

Esta propiedad es crucial para no tratar toda limitación como absoluta.

---

# **15\. CONSTRAINT RELAXATION ≠ PLAYBOOK**

P5 puede declarar:

> este constraint podría relajarse con autorización.

Pero NO:

> pide a CFO aumentar presupuesto un 20 %.

Eso ya sería estrategia/acción.

---

# **16\. DEPENDENCY**

Entidad:

**DECISION\_DEPENDENCY**

Representa:

> una relación por la cual el estado de un elemento condiciona la posibilidad, validez o secuencia de otro.

Relación conceptual:

`DEPENDENCY_SOURCE`

→ habilita/condiciona →

`DEPENDENCY_TARGET`

---

# **17\. ESTRUCTURA DE DECISION\_DEPENDENCY**

| Campo | Función |
| ----- | ----- |
| `dependency_id` | identidad |
| `source_ref` | elemento antecedente |
| `target_ref` | elemento dependiente |
| `dependency_type` | naturaleza |
| `dependency_strength` | dureza |
| `satisfaction_condition` | condición |
| `dependency_state` | estado |
| `evidence_refs[]` | soporte |
| `source_refs[]` | procedencia |
| `epistemic_state` | certeza |
| `created_at` | timestamp |
| `policy_version` | reglas |

---

# **18\. DEPENDENCY\_TYPE**

Tipos iniciales:

`REQUIRES`

`REQUIRES_VALIDATION_OF`

`REQUIRES_DATA_FROM`

`REQUIRES_RESOURCE_FROM`

`REQUIRES_CAPABILITY_FROM`

`REQUIRES_COMPLETION_OF`

`REQUIRES_DECISION_ON`

`BLOCKED_BY`

`ENABLES`

`SEQUENCES_BEFORE`

`MUTUALLY_BLOCKING`

`CONDITIONAL_ON`

---

# **19\. HARD DEPENDENCY**

`dependency_strength = HARD`

significa:

> target no puede pasar a un estado ejecutable válido hasta que la condición del source sea satisfecha.

Esto genera:

**SEQUENCE**

no score.

---

# **20\. SOFT DEPENDENCY**

`SOFT`

significa:

> avanzar sin el antecedente es posible, pero menos eficiente, más incierto o menos conveniente.

P10/P11 podrán considerar la implicación.

Pero P5 no fuerza la secuencia.

---

# **21\. DEPENDENCY ≠ CAUSALITY**

Ejemplo:

A causa B.

No significa:

A debe ejecutarse antes que B.

Y:

A no causa B.

Pero B puede requerir datos producidos por A.

Por tanto:

**CAUSES**

y

**REQUIRES**

son relaciones conceptualmente distintas.

---

# **22\. DEPENDENCY ≠ PARENT/CHILD**

La jerarquía P2 describe estructura.

La dependencia P5 describe condición operacional/decisional.

Un child puede ejecutarse antes que parent.

Un parent puede no depender del child.

No deben confundirse.

---

# **23\. PREREQUISITE**

Un prerequisite representa:

> una condición que debe existir antes de que el candidato pueda avanzar.

Puede ser:

* dato;  
* decisión;  
* aprobación;  
* capability;  
* recurso;  
* condición externa;  
* validación.

Entidad conceptual:

**PREREQUISITE**

Puede implementarse como tipo especializado de dependency.

No es necesario crear tabla independiente si el schema de dependency lo soporta correctamente.

---

# **24\. BLOCKER**

Un blocker representa:

> una condición actualmente activa que impide avanzar.

Debe distinguirse:

**POTENTIAL DEPENDENCY**

de

**ACTIVE BLOCKER**

Un dependency puede existir y estar satisfecha.

En ese caso no hay blocker.

---

# **25\. BLOCKER\_STATE**

Valores:

`BLOCKING`

`PARTIALLY_BLOCKING`

`RESOLVED`

`NOT_BLOCKING`

`UNKNOWN`

---

# **26\. BLOCKER ≠ CONSTRAINT**

Un constraint limita.

Un blocker impide avanzar actualmente.

Ejemplo:

presupuesto reducido:

constraint.

credenciales inexistentes necesarias para acceso:

blocker.

Puede haber solapamiento conceptual, pero deben registrarse semánticamente.

---

# **27\. GATE ≠ CONSTRAINT**

P0 define gates como mecanismos de validez.

P5 puede producir información que alimente gates.

Ejemplo:

constraint legal violado.

Pero no todo constraint es un gate.

Un constraint de capacidad puede simplemente limitar portfolio.

---

# **28\. DEPENDENCY SATISFACTION**

Toda dependency debe poder evaluarse.

`dependency_state`:

`SATISFIED`

`UNSATISFIED`

`PARTIALLY_SATISFIED`

`NOT_YET_APPLICABLE`

`UNKNOWN`

---

# **29\. SATISFACTION CONDITION**

No debe ser solo texto libre.

Debe permitir:

* rule ref;  
* state requirement;  
* threshold;  
* completion condition;  
* validation result.

Ejemplo:

`requires(candidate_A.status = VALIDATED)`

---

# **30\. DEPENDENCY GRAPH**

P5 deberá construir un:

**DEPENDENCY\_GRAPH**

para candidatos relacionados.

Debe permitir:

* nodos;  
* edges;  
* direction;  
* dependency strength;  
* satisfaction state.

---

# **31\. ACYCLICITY**

Las hard dependencies que impliquen orden estricto deberían formar un grafo acíclico.

Si aparece:

A → B  
B → A

y ambas son hard:

el sistema debe detectar:

`DEPENDENCY_CYCLE`.

No inventará un orden.

---

# **32\. DEPENDENCY CYCLE**

Estado:

`CYCLE_DETECTED`

debe provocar:

* validation;  
* reconsideración del modelado;  
* posible abstención parcial.

No se resuelve automáticamente por score.

---

# **33\. MUTUAL DEPENDENCY**

Algunas dependencias pueden ser realmente recíprocas.

Eso no significa necesariamente error.

Ejemplo:

dos elementos necesitan avanzar conjuntamente.

Debe representarse como:

`MUTUAL_ENABLEMENT`

o

`COORDINATED_DEPENDENCY`

si el dominio lo necesita.

Pero no disfrazarse de dos hard sequence edges.

---

# **34\. SEQUENCE**

P5 puede producir:

**REQUIRED\_SEQUENCE**

cuando las dependencias son suficientes para determinar orden parcial.

Ejemplo:

A

↓

B

↓

C

Pero ese orden representa:

> precedencia necesaria.

No:

> ranking empresarial.

---

# **35\. PARTIAL ORDER**

El resultado más frecuente no será una lista lineal.

Será un:

**PARTIAL ORDER**

Ejemplo:

A → C  
B → C

A y B podrían ejecutarse en paralelo.

P5 no debe fabricar:

A → B → C

si no existe dependencia entre A y B.

---

# **36\. EXECUTION ORDER ≠ BUSINESS PRIORITY**

Un candidate B puede tener:

`business_priority = highest`

pero requerir:

A → B.

Entonces:

A se ejecuta primero

sin convertirse necesariamente en:

> problema empresarial más importante.

Esta distinción debe sobrevivir hasta P10/P11.

---

# **37\. TRANSITIVE DEPENDENCY**

Si:

A → B  
B → C

entonces puede inferirse estructuralmente:

A precede indirectamente a C.

El motor puede calcular:

`transitive_dependency`.

Pero debe conservar los edges originales.

---

# **38\. NO TRANSITIVE CAUSALITY ASSUMPTION**

Que:

A causa B  
B causa C

no autoriza automáticamente una relación operational dependency A → C.

P5 no debe extrapolar causalidad a secuencia.

---

# **39\. CROSS-CANDIDATE DEPENDENCIES**

Un candidate puede depender de:

* otro candidate;  
* un external object;  
* una capability;  
* un approval;  
* una data source;  
* un event.

Por eso `source_ref` y `target_ref` no deben limitarse solo a candidates.

---

# **40\. EXTERNAL DEPENDENCY**

Entidad lógica:

**EXTERNAL\_DEPENDENCY\_REF**

puede referenciar:

* proveedor;  
* plataforma;  
* partner;  
* aprobación;  
* contrato;  
* API;  
* condición de mercado;  
* evento.

P5 no debe duplicar el objeto externo.

---

# **41\. EXTERNAL CONTROL**

Toda dependency deberá poder clasificar:

`control_state`.

`INTERNAL_CONTROL`

`PARTIAL_CONTROL`

`EXTERNAL_CONTROL`

`UNKNOWN`

Esto será importante en P6/P7.

---

# **42\. DEPENDENCY CERTAINTY**

Siguiendo P0:

`CONFIRMED`

`SUPPORTED`

`INFERRED`

`UNKNOWN`

Si una hard dependency solo está inferida y puede cambiar el execution order:

> debe requerir validación.

---

# **43\. TEMPORAL DEPENDENCY**

Una dependency puede depender de tiempo.

Ejemplo:

candidate B solo puede comenzar después de evento X.

P3 será source of truth temporal.

P5 utilizará:

`temporal_trigger_ref`.

---

# **44\. RESOURCE DEPENDENCY**

Un candidate puede requerir un recurso generado/liberado por otro.

Ejemplo:

B requiere capacidad que A liberará.

P5 representa dependency.

P6 representa cantidad de capacidad.

---

# **45\. DATA DEPENDENCY**

Ejemplo:

una decisión no puede validarse hasta disponer de cohort data.

Esto puede conectar:

`UNCERTAINTY candidate`

→ habilita →

otro candidate.

Es una relación especialmente importante para agentes IA.

---

# **46\. VALIDATION DEPENDENCY**

Candidate B puede depender de:

> validar hipótesis A.

Entonces:

`REQUIRES_VALIDATION_OF`.

No significa:

> A es más importante empresarialmente.

Significa:

> B no debe asumirse antes de A.

---

# **47\. STRATEGIC DEPENDENCY**

Puede existir:

> una capability debe existir antes de ejecutar una expansión.

P5 registra esta dependencia.

P9 evaluará fit estratégico.

---

# **48\. CONSTRAINT INTERACTION**

Dos constraints pueden interactuar.

Ejemplo:

* cash limitado;  
* stock mínimo requerido.

Juntos pueden eliminar alternativas que individualmente serían posibles.

Puede existir:

**CONSTRAINT\_INTERACTION**

con:

* constraint refs;  
* interaction type;  
* affected candidates;  
* resulting limitation.

---

# **49\. CONSTRAINT COMBINATION**

No asumir que todos los constraints son independientes.

Tipos:

`INDEPENDENT`

`ADDITIVE`

`JOINT`

`MUTUALLY_EXCLUSIVE`

`UNKNOWN`

Solo usar cuando sea material.

---

# **50\. CONSTRAINT PRECEDENCE**

Algunos constraints tienen precedencia.

Ejemplo conceptual:

legalidad

sobre

preferencia operativa.

Pero P5 no debe reinventar la jerarquía global de P0.

Debe emitir:

`constraint_effect`

y P0 aplica precedencia.

---

# **51\. LIMIT BREACH**

Cuando un candidato viola un hard constraint:

`constraint_state = VIOLATED`

puede producir:

`candidate_feasibility_gate = FAIL`

según policy.

Esto no debe depender de un score.

---

# **52\. CONDITIONAL FEASIBILITY**

Un candidato puede ser:

> factible si se relaja constraint X.

Debe representarse como:

`CONDITIONALLY_FEASIBLE`

pero P6 será quien formalice factibilidad global.

P5 aporta la condición.

---

# **53\. UNLOCK CONDITION**

Todo blocker debería indicar:

`unlock_condition`.

Ejemplo conceptual:

> aprobación recibida.

No:

> enviar email a CFO.

Primero es condición.

Segundo sería acción de Fase 5\.

---

# **54\. RESOLUTION STATE**

P5 puede observar:

`OPEN`

`RESOLVED`

`WAIVED`

`EXPIRED`

`INVALIDATED`

pero no diseña cómo resolver.

---

# **55\. WAIVER**

Algunos constraints pueden ser objeto de waiver autorizado.

Debe existir:

* `waiver_id`;  
* `authorized_by`;  
* `reason`;  
* `valid_until`;  
* `constraint_id`.

Nunca asumir waiver sin evidencia.

---

# **56\. OVERRIDE ≠ WAIVER**

Override:

cambia precedencia decisional.

Waiver:

autoriza ignorar una restricción concreta.

Deben mantenerse separados.

---

# **57\. CONSTRAINT UNKNOWN**

Si no sabemos si un constraint aplica:

`UNKNOWN`.

Nunca:

> probablemente no aplica → ignorar.

Especialmente si podría invalidar un candidato.

---

# **58\. DEPENDENCY UNKNOWN**

Si no sabemos si B depende de A:

`UNKNOWN`.

No crear edge obligatorio.

Pero tampoco afirmar independencia.

---

# **59\. P5 OUTPUT**

Contrato:

**CONSTRAINT\_DEPENDENCY\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `constraint_refs[]` | constraints |
| `dependency_refs[]` | dependencias |
| `blocker_refs[]` | blockers |
| `prerequisite_refs[]` | prerequisites |
| `dependency_graph_ref` | grafo |
| `required_predecessor_refs[]` | precedencias hard |
| `active_blockers[]` | bloqueos |
| `violated_hard_constraints[]` | incumplimientos |
| `constraint_interaction_refs[]` | interacciones |
| `unknowns[]` | incertidumbres |
| `warnings[]` | limitaciones |
| `rule_trace_refs[]` | trazabilidad |
| `assessment_state` | validez |

---

# **60\. ASSESSMENT\_STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`BLOCKED`

`CONSTRAINT_VIOLATION`

`INSUFFICIENT_INFORMATION`

`NOT_APPLICABLE`

`INVALID`

---

# **61\. REASON CODES**

Familias:

`CONSTRAINT.*`

`DEPENDENCY.*`

`BLOCKER.*`

Ejemplos:

`CONSTRAINT.HARD_LIMIT`

`CONSTRAINT.SOFT_LIMIT`

`CONSTRAINT.VIOLATED`

`CONSTRAINT.UNKNOWN`

`CONSTRAINT.RELAXABLE`

`DEPENDENCY.HARD_PREDECESSOR`

`DEPENDENCY.UNSATISFIED`

`DEPENDENCY.CYCLE_DETECTED`

`DEPENDENCY.EXTERNAL`

`DEPENDENCY.REQUIRES_VALIDATION`

`BLOCKER.ACTIVE`

`BLOCKER.RESOLVED`

`BLOCKER.UNKNOWN`

---

# **62\. INVARIANTES P5**

1. Constraint no equivale a dependency.  
2. Dependency no equivale a cause.  
3. Blocker no equivale a constraint.  
4. Prerequisite no equivale a business priority.  
5. Hard dependency genera secuencia, no score.  
6. Hard constraint no puede compensarse con impacto.  
7. Un soft constraint no debe convertirse automáticamente en gate.  
8. Un dependency edge inferido no puede tratarse como hard confirmado.  
9. Dependency cycles deben detectarse.  
10. Los graphs de secuencia no deben linealizarse innecesariamente.  
11. Execution order no equivale a business priority.  
12. P5 no duplica cantidades de recursos de P6.  
13. P5 no redefine causalidad de Fase 3\.  
14. P5 no prescribe cómo desbloquear.  
15. UNKNOWN no equivale a ausencia de constraint/dependency.  
16. Todo waiver requiere autorización explícita.  
17. Toda hard dependency debe tener condición de satisfacción.

---

# **63\. PRECONDICIONES**

P5 necesita:

* candidate válido P2;  
* decision context P1;  
* relationships diagnósticas disponibles;  
* constraints conocidos;  
* fuentes externas relevantes;  
* policies de precedencia.

Puede ejecutarse aunque algunos constraints sean UNKNOWN.

---

# **64\. POSTCONDICIONES**

P5 termina correctamente cuando puede responder:

* qué limita al candidato;  
* qué constraint es hard o soft;  
* qué candidatos dependen de otros;  
* qué prerequisites existen;  
* qué blockers están activos;  
* qué secuencia es obligatoria;  
* qué elementos pueden permanecer paralelos;  
* qué condiciones desbloquean;  
* qué dependencias son inciertas.

---

# **65\. FAILURE MODES**

## **Constraint scoring**

Budget constraint → score \-20.

**Error:** un hard limit no es una penalización.

**Prevención:** constraint strength.

---

## **Causality sequencing**

A causa B → ejecutar A siempre primero.

**Error:** causalidad no determina execution order automáticamente.

---

## **Dependency ranking**

A debe preceder B → A recibe mayor business priority.

**Error:** sequence ≠ priority.

---

## **Everything-is-a-blocker**

Cualquier dificultad se registra como blocker.

**Error:** blocker debe impedir avance real.

---

## **Soft-to-hard inflation**

Limitación operativa se convierte en prohibición.

**Prevención:** HARD/SOFT/CONDITIONAL.

---

## **Linear graph invention**

A y B pueden ejecutarse en paralelo pero runtime produce A→B.

**Prevención:** partial order.

---

## **Unknown-as-independent**

No conocemos relación → se asume independencia.

**Prevención:** UNKNOWN.

---

## **Strategy leakage**

“Para desbloquear esto, contrata un desarrollador.”

**Prevención:** unlock condition ≠ intervention.

---

# **66\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| hard budget limit violado | constraint violation |
| soft capacity limit | no hard gate automático |
| B requires A | hard predecessor |
| A causes B | no dependency automática |
| A→B, B→C | transitive order detectable |
| A→B, B→A hard | cycle detected |
| A y B sin edge | paralelismo posible |
| blocker resuelto | no BLOCKING |
| dependency satisfecha | SATISFIED |
| dependency inferida | no CONFIRMED |
| constraint desconocido | UNKNOWN |
| waiver sin autoridad | rechazo |
| hard constraint \+ huge impact | sigue limitando |
| resource quantity cambia | P6 source of truth |
| unlock condition conocida | registrada sin playbook |
| external dependency | control state EXTERNAL |
| requirement temporal | referencia a P3 |
| same graph \+ same inputs | mismo resultado determinista |

---

# **67\. EVALS IA**

### **Constraint/dependency separation**

¿Distingue limitación de precedencia?

### **Causality/dependency separation**

¿Evita traducir causalidad en secuencia automáticamente?

### **Hard/soft classification**

¿Evita convertir preferencias en prohibiciones?

### **Blocker identification**

¿Reconoce cuándo algo realmente impide avanzar?

### **Graph consistency**

¿Produce dependencias sin ciclos espurios?

### **Unknown preservation**

¿Evita asumir independencia por falta de evidencia?

### **Boundary eval**

¿Evita proponer cómo resolver blockers?

---

# **68\. EJEMPLO 1 — CRO BLOQUEADO POR TRACKING**

Candidate B:

> deterioro de checkout conversion.

Existe:

> tracking insuficiente para identificar punto exacto del abandono.

Puede modelarse:

Candidate A:

`UNCERTAINTY`

> validar comportamiento del funnel.

Dependency:

B

`REQUIRES_VALIDATION_OF`

A

Esto NO significa:

A tiene más impacto empresarial.

Significa:

> cierta decisión sobre B requiere primero información de A.

---

# **69\. EJEMPLO 2 — CASH CONSTRAINT**

Candidate:

> expansión agresiva de paid acquisition.

Constraint:

`CASH`

Strength:

`HARD` o `SOFT` según política real.

Si el negocio no puede financiar el working capital adicional:

la iniciativa puede quedar:

`CONDITIONALLY_FEASIBLE`

o bloqueada.

P5 no propone financiación.

---

# **70\. EJEMPLO 3 — INVENTORY**

Candidate:

> aumentar acquisition sobre SKU estrella.

Constraint:

stock disponible.

P5 puede identificar:

`INVENTORY CONSTRAINT`.

P6 cuantificará la capacidad/recurso.

P8 analizará economics.

P5 no debe decir:

> compra 5.000 unidades adicionales.

---

# **71\. EJEMPLO 4 — SECUENCIA PARCIAL**

Candidates:

A — corregir tracking crítico.

B — validar pérdida en checkout.

C — evaluar expansión de paid spend.

Puede existir:

A → B

A → C

pero no necesariamente:

B → C.

Resultado:

A primero.

Después B y C podrían evaluarse/avanzar en paralelo.

El runtime no debe inventar una cadena completa.

---

# **72\. EJEMPLO 5 — ROOT CAUSE**

Fase 3:

Root cause A causa symptoms B y C.

P5 NO concluye automáticamente:

A → B → C.

Puede incluso ocurrir que:

C requiera contención inmediata mientras A necesita trabajo posterior.

La relación diagnóstica no decide secuencia operativa.

---

# **73\. INTERFAZ CON P6**

P5 identifica:

> existe constraint de recursos.

P6 responderá:

> cuánto recurso requiere el candidato y qué capacidad existe.

Por tanto P5 no debe duplicar:

* horas;  
* headcount;  
* presupuesto operativo;  
* complejidad.

---

# **74\. INTERFAZ CON P7**

P5 puede identificar:

> bypass de un constraint.

P7 deberá valorar:

> qué riesgo genera hacerlo.

P5 no calcula downside.

---

# **75\. INTERFAZ CON P8**

P8 podrá utilizar:

* constraints;  
* blockers;  
* dependency states;

para ajustar:

* capturable value;  
* expected value;  
* opportunity cost.

Pero P8 no podrá ignorar hard constraints porque el EV sea alto.

---

# **76\. INTERFAZ CON P10**

P10 debe respetar:

**HARD CONSTRAINT**

y

**HARD DEPENDENCY**

antes de ranking auxiliar.

Un candidate bloqueado puede mantener:

`business_priority = high`

pero:

`execution_eligibility = blocked`.

---

# **77\. INTERFAZ CON P11**

P11 utilizará el dependency graph para decidir:

* concurrencia;  
* sequencing;  
* portfolio feasibility;  
* shared resources;  
* qué puede correr en paralelo.

P5 construye el grafo.

P11 lo utiliza para portfolio.

---

# **78\. DEFINITION OF DONE — P5**

P5 está completo cuando el sistema puede responder:

**WHAT LIMITS THIS?**

Existen constraints explícitos.

**IS THE LIMIT ABSOLUTE?**

Se distingue HARD/SOFT/CONDITIONAL.

**WHAT MUST HAPPEN FIRST?**

Existen dependencies.

**IS THAT REALLY A DEPENDENCY OR JUST A CAUSE?**

Las relaciones permanecen separadas.

**WHAT IS ACTIVELY BLOCKING PROGRESS?**

Existen blockers.

**WHAT CONDITION WOULD UNBLOCK IT?**

Existe unlock condition.

**WHAT IS ALREADY SATISFIED?**

Existe dependency state.

**CAN SOME THINGS RUN IN PARALLEL?**

El graph conserva partial order.

**ARE THERE CYCLES?**

Se detectan.

**ARE CONSTRAINTS RELAXABLE?**

Existe relaxability.

**WHAT DO WE NOT KNOW?**

UNKNOWN permanece explícito.

P5 no determina todavía:

> qué merece más recursos.

Determina:

> **qué es realmente posible, qué está bloqueado y qué debe preceder a qué.**

