# Fase 04 · P05 — Constraints y dependencias

## Propósito

P05 responde:

> ¿Puede realmente atacarse cada cuestión de forma independiente y qué limita actualmente al sistema?

Una prioridad aparentemente excelente puede no producir valor si depende de otra condición.

Regla base:

`HIGH IMPACT + HIGH URGENCY ≠ DO THIS FIRST`

si:

`IT CANNOT CREATE VALUE UNTIL SOMETHING ELSE CHANGES`

---

## 1. Ecommerce como sistema

Un ecommerce es una red de capacidades interdependientes:

`Market → Product → Offer → Creative → Acquisition → Conversion → Payment → Inventory → Fulfillment → Customer Experience → Retention → Cash → Reinvestment`

La realidad añade loops, dependencias laterales y recursos compartidos.

Por tanto:

`LOCAL PERFORMANCE ≠ SYSTEM PERFORMANCE`

---

## 2. Constraint

Un `CONSTRAINT` es:

> La condición que limita materialmente la capacidad del sistema para alcanzar más de su objetivo actual.

No significa simplemente:

- something performing badly;
- weakest metric;
- lowest maturity;
- biggest local problem.

Debe ser algo que:

- limita el sistema;
- reduce throughput respecto al objetivo.

---

## 3. Weakness ≠ Constraint

Una capability puede ser débil sin limitar el throughput.

Ejemplo conceptual:

- Email weak
- Inventory sold out

Email puede estar peor, pero inventory puede ser el constraint.

---

## 4. Constraint ≠ Worst Metric

La métrica más roja no identifica automáticamente el cuello de botella.

La materialidad depende de:

- value concentration;
- system position;
- target;
- throughput effect.

---

## 5. Constraint ≠ Biggest Problem

Un problema muy grave puede no limitar el objetivo principal.

Severity y constraint son conceptos distintos.

---

## 6. Constraint ≠ Low Maturity

`MATURITY GAP ≠ CURRENT CONSTRAINT`

Una capability low maturity puede tener capacidad suficiente hoy.

Una capability high maturity puede estar saturada por escala.

---

## 7. Constraint depende del objetivo

No existe constraint sin:

`SYSTEM GOAL`

Si el objetivo cambia, puede cambiar el constraint aunque el sistema físico sea el mismo.

---

## 8. Binding Constraint

Un `BINDING CONSTRAINT` impide actualmente aumentar materialmente el resultado objetivo.

Test:

> Si mejorásemos cualquier otra cosa mientras esta restricción permanece igual, ¿cuánto podría mejorar realmente el sistema?

---

## 9. Constraint Test

Pregunta:

> IF THIS CAPACITY REMAINED EXACTLY AS IT IS, HOW MUCH FURTHER COULD THE BUSINESS SCALE?

Si:

- NOT MUCH

la hypothesis de constraint gana fuerza.

---

## 10. Counterfactual Constraint Test

Pregunta:

> IF THIS CONSTRAINT DISAPPEARED TOMORROW, WOULD SYSTEM OUTPUT MATERIALLY INCREASE?

Si:
- YES

la hypothesis gana soporte.

---

## 11. Non-Constraint

Un `NON-CONSTRAINT` puede ser subóptimo, pero mejorarlo no eleva materialmente throughput actual.

---

## 12. Local Optimization Trap

Aumentar capacidad local no crea valor si otra cosa limita el sistema.

Ejemplo:
- warehouse 20k orders/day;
- demand 5k/day;
- ampliar a 30k/day;
- +50% local capacity;
- ~0% additional current throughput.

---

## 13. Idle Capacity

Capacidad ociosa no es necesariamente ineficiencia.

Puede ser:

- protective capacity;
- non-binding capacity;
- slack against variability.

---

## 14. Efficiency Trap

Maximizar 100% utilization en todas partes puede crear:

- queues;
- inventory;
- delays;
- inflexibility.

Optimizar cada recurso no equivale a optimizar el sistema.

---

## 15. Throughput Thinking

Pregunta central:

> WHAT CURRENTLY LIMITS MORE PROFITABLE OUTPUT FROM MOVING THROUGH THE SYSTEM?

---

## 16. Constraint Types

Puede existir constraint en:

- DEMAND
- PRODUCT
- OFFER
- CREATIVE
- ACQUISITION
- CONVERSION
- PAYMENT
- INVENTORY
- SUPPLY
- FULFILLMENT
- CUSTOMER SERVICE
- RETENTION
- CASH
- DATA
- TECHNOLOGY
- TEAM
- MANAGEMENT ATTENTION
- MARKET
- POLICY / COMPLIANCE

---

## 17. Demand Constraint

Existe cuando capacidad interna está disponible pero no puede encontrarse demanda adicional suficientemente rentable.

---

## 18. Creative Constraint

Puede existir cuando:
- budget available;
- audience available;
- inventory available;
- historical winners profitable;
- new creative supply insufficient.

El limitante es creative throughput.

---

## 19. Conversion Constraint

Traffic, product e inventory pueden estar sanos, pero funnel/PDP/checkout limitar output.

---

## 20. Inventory Constraint

Más demand generation puede simplemente acelerar stockout cuando supply es binding.

---

## 21. Fulfillment Constraint

Más orders pueden aumentar:
- backlog;
- delays;
- support;
- refunds;

cuando operations está saturado.

---

## 22. Cash Constraint

Puede existir profitable demand y inventory opportunity, pero falta working capital para financiarlos.

---

## 23. Management / Decision Constraint

Si todo requiere founder approval, el constraint puede ser:

`DECISION CAPACITY`

y afectar:
- creative;
- hiring;
- pricing;
- inventory;
- campaigns.

---

## 24. Data Constraint

Data puede limitar:
- allocation;
- forecasting;
- experimentation;
- automation;

aunque no genere ventas directamente.

---

## 25. Technology Constraint

Infraestructura puede limitar peak traffic, transaction volume o complexity.

---

## 26. Policy Constraint

El cuello de botella puede ser una regla.

Ejemplo:
- no campaign launches without founder approval.

---

## 27. Market Constraint

El limitante puede estar fuera de la organización cuando profitable addressable demand está agotada.

---

## 28. Constraint físico o lógico

Puede ser:

- people;
- stock;
- approval;
- rule;
- knowledge;
- cash;
- information;
- coordination;
- decision.

---

## 29. Current / Emerging / Future Constraint

Debe distinguirse:

- CURRENT CONSTRAINT
- EMERGING CONSTRAINT
- FUTURE CONSTRAINT

Una capability puede no limitar hoy pero saturarse bajo planned growth.

---

## 30. Constraint Migration

Al elevar un constraint:

`Constraint A → resolved → Constraint B becomes binding`

Esto es normal.

El objetivo no es eliminar constraints para siempre, sino gestionar correctamente el limitante actual y anticipar el siguiente.

---

## 31. Constraint Whack-a-Mole

Que aparezca otro bottleneck después de resolver el primero no significa fracaso.

Significa que el sistema avanzó hasta su siguiente limitación.

---

## 32. Constraint Sequencing

Puede existir una secuencia:

`Creative → Inventory → Fulfillment → Cash → Management`

pero no existe secuencia universal.

---

## 33. Constraint Stack

A veces varias capacidades están cerca de saturación.

Puede existir:

- PRIMARY CONSTRAINT
- NEAR-CONSTRAINTS

---

## 34. Constraint Shadow

Una segunda capability puede parecer sana porque el primary constraint impide que reciba más carga.

Cuando el primero se eleva, la segunda puede colapsar.

---

## 35. Constraint Forecasting

La IA debe preguntar:

> WHAT LIMITS US NOW?

y:

> IF WE REMOVE IT, WHAT LIMITS US NEXT?

---

## 36. Capacity Buffers

Algo de capacidad por encima del current constraint puede ser necesaria para absorber variabilidad.

No todo slack es waste.

---

## 37. Protect the Constraint

Un recurso crítico escaso no debería consumir capacidad en trabajo de bajo valor.

Pregunta:

> WHAT IS CONSUMING THE SCARCE CONSTRAINT?

---

## 38. Constraint Consumption

Cada iniciativa consume parte del recurso escaso.

Esto convierte priorización en allocation.

---

## 39. Throughput per Constraint Unit

Cuando varias iniciativas compiten por el mismo recurso:

> HOW MUCH SYSTEM VALUE IS CREATED PER UNIT OF THE CONSTRAINT?

No es una fórmula universal, sino un principio de escasez.

---

## 40. Dependency

Una `DEPENDENCY` existe cuando:

> el valor, posibilidad o calidad de una decisión depende materialmente de otra condición.

---

## 41. Dependency ≠ Constraint

Una dependency puede afectar una iniciativa concreta.

Un constraint limita throughput global respecto al objetivo.

---

## 42. Prerequisite

Un `PREREQUISITE` debe existir antes para que otra iniciativa tenga sentido o sea posible.

---

## 43. Hard Dependency

`HARD DEPENDENCY`:

> B cannot meaningfully occur until A exists.

---

## 44. Soft Dependency

`SOFT DEPENDENCY`:

> B can occur without A, but with lower value, higher risk or lower quality.

---

## 45. Enabling Dependency

A puede habilitar B sin ser requisito absoluto.

---

## 46. Blocking Dependency

Un `BLOCKER` impide avanzar hoy.

Pero:

`BLOCKER ≠ PRIORITY`

Su importancia depende de:

> WHAT IT BLOCKS

---

## 47. Blocker Value

El valor de un blocker es fundamentalmente downstream.

Pregunta:

> WHAT HIGH-VALUE OUTCOME CANNOT OCCUR BECAUSE OF THIS BLOCKER?

---

## 48. Unlock Value

Un candidato con poco impacto directo puede tener gran:

`UNLOCK VALUE`

---

## 49. Dependency Chains

Puede existir:

`A → B → C → D`

Ejemplo:

`Data integrity → Reliable attribution → Budget allocation → Profitable scaling`

---

## 50. Chain Length

Cadenas más largas pueden aumentar:

- execution risk;
- coordination;
- latency.

Pero length no determina priority.

---

## 51. Critical Path

`CRITICAL PATH`:

Secuencia de dependencias que determina el mínimo tiempo necesario para conseguir un outcome.

---

## 52. Critical Path Candidate

Una tarea pequeña puede ser importante si retrasarla retrasa todo el high-value outcome.

---

## 53. Slack

`SLACK`:

> cuánto puede retrasarse algo sin retrasar el resultado dependiente.

Zero slack aumenta importancia secuencial.

---

## 54. Parallel Work

No todas las prioridades compiten.

Si usan recursos diferentes:
- engineering;
- creative;
- finance;

pueden ejecutarse simultáneamente.

---

## 55. Decision Graph

F4 necesita:

`GRAPH THINKING`

no solo:

`RANKING LIST`

---

## 56. Precedence

Puede existir:

`A BEFORE B`

aunque B tenga mayor business value.

---

## 57. Priority vs Sequence

Fundamental:

`BUSINESS IMPORTANCE ≠ EXECUTION ORDER`

---

## 58. High Priority but Blocked

Una cuestión puede ser:

- VERY HIGH PRIORITY
- CURRENTLY BLOCKED

simultáneamente.

Blocked no reduce necesariamente importance.

---

## 59. Dependency Inversion

Si:
- A tiene highest ultimate value;
- B tiene lower direct value;
- A depends on B;

B puede requerir atención antes sin ser más estratégicamente valioso.

---

## 60. Upstream Leverage

Resolver un nodo upstream puede eliminar múltiples downstream symptoms.

Eso genera:

`UPSTREAM LEVERAGE`

---

## 61. Upstream ≠ Always First

Una root fix puede tardar meses.

Mientras tanto puede ser necesaria contención downstream.

---

## 62. Root Cause Priority vs Intervention Priority

Regla:

`ROOT CAUSE ≠ ALWAYS FIRST INTERVENTION POINT`

F3 identifica root cause.

F4 decide estructura de atención/secuencia.

---

## 63. Containment vs Constraint Removal

Debe distinguirse:

- CONTAINMENT
- CONSTRAINT REMOVAL

---

## 64. Dependency Types

Puede haber:

- INFORMATION
- RESOURCE
- TECHNICAL
- OPERATIONAL
- FINANCIAL
- SUPPLY
- ORGANIZATIONAL
- APPROVAL
- MARKET
- TEMPORAL
- LEARNING
- VALIDATION

---

## 65. Dependency Strength

Conceptualmente:

- HARD
- STRONG
- MODERATE
- WEAK

---

## 66. Dependency Certainty

Separar:

- CONFIRMED DEPENDENCY
- HYPOTHESIZED DEPENDENCY

---

## 67. Do Not Invent Dependencies

No crear:

`A MUST HAPPEN BEFORE B`

porque “suena ordenado”.

Debe existir lógica causal o empresarial.

---

## 68. Sequential Bias

Un sistema excesivamente rígido puede serializar trabajo que podría ejecutarse en paralelo.

Eso destruye velocidad.

---

## 69. Minimum Viable Prerequisite

Pregunta:

> WHAT IS THE MINIMUM THAT A MUST PROVIDE FOR B TO START SAFELY?

No esperar perfección innecesaria.

---

## 70. Dependency Reduction

Diseñar el trabajo para reducir dependencies puede aumentar:

- parallelism;
- speed;
- optionality.

---

## 71. Shared Resource Conflict

A y B pueden no depender causalmente, pero competir por el mismo scarce resource.

Eso es:

`RESOURCE CONFLICT`

no causal dependency.

---

## 72. Bottleneck Resource

Cuando muchas prioridades esperan el mismo recurso, ese recurso puede convertirse en constraint.

---

## 73. Queue Formation

Cuando arrival rate supera processing capacity:

`QUEUE ↑`

Una queue persistente puede ser evidence de constraint, pero no lo prueba automáticamente.

---

## 74. Constraint Pollution

`CONSTRAINT POLLUTION`:

El bottleneck consume capacidad en tareas que no deberían llegar a él.

El problema puede ser allocation/decision design, no headcount.

---

## 75. Starved Constraint

El constraint puede quedar ocioso porque upstream no entrega inputs.

---

## 76. Blocked Constraint

El recurso puede tener capacidad pero no poder producir output por una limitación downstream.

---

## 77. Symptom Around Constraint

Queue puede aparecer antes del constraint.

Delays pueden aparecer después.

No confundir manifestaciones con el recurso limitante.

---

## 78. Dependency Network

Conceptualmente:

`NODES + EDGES`

Nodes:
- capabilities;
- issues;
- decisions.

Edges:
- dependency relationships.

---

## 79. Dependency Centrality

Un nodo con muchas relaciones downstream puede tener:

`HIGH DEPENDENCY CENTRALITY`

Pero:

`HIGH CENTRALITY ≠ PRIORITY #1`

---

## 80. Single Point of Failure

Un nodo crítico sin alternativa puede ser:

`SINGLE POINT OF FAILURE`

---

## 81. Dependency Concentration

Cuanto más valor depende de un único nodo, mayor fragilidad.

Ejemplos:
- supplier;
- channel;
- employee;
- payment provider;
- warehouse.

---

## 82. Redundancy

Redundancy reduce dependencia cuando otra ruta puede absorber flujo.

Puede ser:
- full;
- partial.

Una alternativa teórica no es redundancia efectiva si no puede utilizarse en tiempo/escala adecuados.

---

## 83. Dependency Substitution

Pregunta:

> IS A THE ONLY WAY TO ENABLE B?

Si no, existe:

`SUBSTITUTION OPTION`

---

## 84. Hidden Dependency / Common-mode Failure

Dos sistemas aparentemente independientes pueden compartir:
- API;
- supplier;
- data source;
- team.

Entonces su redundancy puede ser falsa.

---

## 85. Cross-capability Dependencies

Las cadenas atraviesan departamentos.

Ejemplos:

`Cash → Inventory → Availability → Media Scale → Revenue`

`Data Collection → Data Quality → Metrics → Diagnosis → Decision → Allocation`

---

## 86. Constraint Interaction

Dos constraints pueden reforzarse.

Ejemplo:

`low cash → smaller buys → stockouts → lower revenue → lower cash`

Puede existir:

`SYSTEMIC CONSTRAINT LOOP`

---

## 87. Constraint / Policy Conflict

Dos objetivos/reglas locales pueden crear un sistema imposible.

Ejemplo:
- never stock out;
- keep inventory extremely low.

No puede optimizarse todo simultáneamente.

---

## 88. External Dependencies

Puede existir dependencia sobre:

- suppliers;
- carriers;
- platforms;
- payment providers;
- marketplaces;
- regulators;
- agencies.

---

## 89. Control / Influence

Distinguir:

- controllable;
- influenceable;
- uncontrollable.

Si algo no puede controlarse, el foco pasa a:
- influence;
- mitigation;
- diversification;
- preparedness.

---

## 90. Dependency Risk

Una dependency importa especialmente cuando combina:

`HIGH BUSINESS RELIANCE + LOW CONTROL + LOW REDUNDANCY`

---

## 91. Dependency Health

Puede evaluarse conceptualmente como:

- HEALTHY
- FRAGILE
- CRITICAL

según:

- reliability;
- redundancy;
- control;
- switching cost.

---

## 92. Switching Lead Time

Una alternativa que tarda meses no equivale a redundancy inmediata.

---

## 93. Dependency Optionality

Pregunta:

> HOW MANY REALISTIC ALTERNATIVES REMAIN AVAILABLE?

---

## 94. Constraint + Time

P3 y P5 interactúan.

Un constraint con:
- short time-to-damage;
- long lead time;

puede requerir atención antes del daño visible.

---

## 95. Constraint + Impact

P4 y P5 interactúan.

El constraint debe entenderse por:

> HOW MUCH VALUE IT PREVENTS FROM FLOWING

---

## 96. Constraint Release Value

Pregunta:

> IF THIS CONSTRAINT WERE ELEVATED, WHAT ADDITIONAL VALUE COULD THE SYSTEM ACTUALLY PRODUCE?

---

## 97. Constraint Removal ≠ Infinite Value

Tras elevarlo aparecerá otro límite.

No proyectar throughput infinito.

---

## 98. Constraint Caps Opportunity

Una oportunidad teórica puede quedar capada por otro bottleneck.

`THEORETICAL VALUE ≠ CAPTURABLE VALUE`

---

## 99. Constraint Caps Intervention Value

Incluso mejorar una capability puede crear poco incremental value si otro constraint domina.

---

## 100. Subordination

Non-constraints deberían coordinarse para apoyar:

- system objective;
- current constraint.

No maximizar su KPI local a costa del sistema.

---

## 101. System Objective Comes First

P1 define el objective.

P5 pregunta:

> WHAT LIMITS THAT OBJECTIVE?

---

## 102. Flow Thinking

Constraint identification exige system flow.

Pregunta:

> WHERE DOES VALUE STOP FLOWING?

---

## 103. Flow Clues

### Accumulation
- backlog;
- excess inventory;
- waiting;
- queues;
- unspent budget;
- unused capacity.

### Starvation
Un downstream node no recibe input.

### Excess capacity
Puede señalar limitación upstream.

---

## 104. Constraint Detection

Preguntas clave:

- current objective?
- what limits throughput?
- where does work accumulate?
- where is idle capacity?
- what is saturated?
- what are others waiting for?
- what breaks if demand/CVR increases?
- what constraint appears next?
- what evidence shows binding relation?
- what value is unlocked by elevation?

---

## 105. Opportunity Dependencies

Antes de valorar una oportunidad:

> WHAT MUST EXIST TO CAPTURE IT?

Una oportunidad puede tener:
- HIGH THEORETICAL VALUE
- LOW CURRENT READINESS

por dependencies.

---

## 106. Dependency Debt

Puede existir:

`DEPENDENCY DEBT`

cuando connections rígidas hacen cada cambio más difícil.

Tipos:
- organizational;
- technical;
- supplier;
- channel.

---

## 107. Complexity as Constraint

Cuando dependencies crecen más rápido que organizational capacity:

- execution slows;
- coordination puede convertirse en constraint.

---

## 108. Tool Proliferation

Más software puede aumentar:
- integration complexity;
- data inconsistency;
- friction.

No siempre elimina constraints.

---

## 109. Constraint-first Investment

Antes de:
- automate;
- hire;
- buy stock;
- increase spend;

preguntar:

> WHERE WILL THIS ADDITIONAL CAPACITY ACTUALLY INCREASE SYSTEM OUTPUT?

---

## 110. Decision Rights Constraint

Puede importar más:

> WHO IS ALLOWED TO DECIDE?

que:

> HOW MANY PEOPLE WORK HERE?

---

## 111. Information Constraint

Pregunta:

> DO DECISION MAKERS HAVE THE INFORMATION REQUIRED AT THE TIME THEY NEED IT?

---

## 112. Feedback / Learning Constraint

Un negocio puede ejecutar rápido pero aprender demasiado lento.

Entonces el learning loop puede limitar evolución.

---

## 113. Demand Generation vs Demand Capture

No son lo mismo.

Puede existir demanda que el sistema no puede capturar por:
- stock;
- payment;
- capacity.

O capacidad ociosa porque falta demanda.

---

## 114. Throughput Requires Entire Chain

El resultado está limitado por:

`THE FLOW OF THE WHOLE SYSTEM`

no por average maturity.

---

## 115. Weakest-link Thinking Has Limits

No usar:

`LOWEST SCORE = CONSTRAINT`

La restricción es funcional, no estadística.

---

## 116. Constraint Evidence

Evidencia fuerte puede incluir:

- persistent saturation;
- queues;
- lost throughput;
- capacity ceiling;
- blocked opportunities;
- counterfactual simulations;
- demand > available capacity;
- repeated downstream effects.

---

## 117. Constraint Hypothesis

Si evidence es incompleta:

- POSSIBLE CONSTRAINT

es mejor que falsa certeza.

Pueden coexistir múltiples candidates.

---

## 118. Falsifiability

Pregunta:

> WHAT OBSERVATION WOULD PROVE THIS IS NOT THE CONSTRAINT?

Si nada puede cambiar nuestra opinión, el razonamiento es defectuoso.

---

## 119. False Positive / False Negative

### False positive
Creative parece bottleneck, pero inventory ya capaba spend.

### False negative
Inventory parece healthy en current average, pero campaign forecast muestra future saturation.

---

## 120. Layered Constraint Thinking

Un constraint puede ocultar otro.

La evaluación debe ser por capas y reabrirse tras cada cambio material.

---

## 121. Constraint Removal Test

Después de elevar A:

> DID SYSTEM THROUGHPUT INCREASE?

No basta:
> A improved.

---

## 122. Local Success / System Failure

Una mejora local sin mejora del system output no demuestra constraint release efectivo.

---

## 123. Anti-patterns

- Worst Metric Is Constraint.
- Lowest Maturity Is Constraint.
- Most Expensive Department Is Constraint.
- Founder Says Constraint = proof.
- Everything Is a Constraint.
- Constraint Never Changes.
- Fix All Weaknesses.
- Optimize Non-Constraint.
- Maximize Every Department KPI.
- Always Fix Root Cause First.
- Always Fix Downstream Symptom.
- Dependency Means Sequential.
- Dependency Means Impossible.
- Perfect Prerequisite.
- Blocked = Low Priority.
- High Priority = Immediately Executable.
- Large Direct Value > Unlock Value.
- Department Boundaries Define Dependencies.
- More Capacity Everywhere.
- Eliminate All Slack.
- Redundancy Is Waste.
- Alternative Exists = Dependency Solved.
- Current Constraint = Permanent Strategy.
- Ranking Without Dependency Graph.
- Impact Without Constraint Context.

---

## 124. Constraint Leverage

Pregunta:

> WHERE DOES ONE UNIT OF IMPROVEMENT CREATE THE MOST SYSTEM FLOW?

---

## 125. Dependency Leverage

Pregunta:

> WHICH NODE UNLOCKS THE MOST HIGH-VALUE DOWNSTREAM WORK?

---

## 126. Constraint vs Dependency Matrix

Puede existir:

### HIGH CONSTRAINT IMPORTANCE + HIGH DEPENDENCY CENTRALITY
Nodo extremadamente estructural.

### LOW CONSTRAINT IMPORTANCE + HIGH DEPENDENCY CENTRALITY
Nodo habilitador importante, pero no current system constraint.

---

## 127. Constraint vs Urgency

- Constraint + low urgency → structural priority.
- Constraint + high urgency → immediate pressure.

Urgency sigue siendo dimensión separada.

---

## 128. Constraint vs Feasibility

Un constraint difícil de elevar sigue siendo constraint.

Difficulty no cambia el diagnóstico sistémico.

---

## 129. Dependency vs Feasibility

Un prerequisite difícil puede hacer una ultimate priority no actionable hoy sin reducir su business value.

---

## 130. Healthy Dependency

No toda dependency debe eliminarse.

El problema es:

`DEPENDENCY + MATERIAL EXPOSURE + FRAGILITY + LACK OF ALTERNATIVES`

---

## 131. Dependency Optimization

El objetivo no es:

`ZERO DEPENDENCIES`

sino:

`MANAGE CRITICAL DEPENDENCIES`

---

## 132. Constraint Portfolio Thinking

Antes de invertir entender:

- CURRENT CONSTRAINT
- NEAR CONSTRAINTS
- DEPENDENCIES
- NEXT LIKELY CONSTRAINT

---

## 133. Dynamic Graph

El:

`DECISION GRAPH(t)`

cambia con el negocio.

Si cambia el constraint o se resuelve un blocker:

`PRIORITIES MUST BE RECONSIDERED`

---

## 134. Reglas fundamentales

1. `HIGHER IMPACT ≠ GUARANTEED EARLIER SEQUENCE`
2. `LOW DIRECT IMPACT ≠ LOW DECISIONAL VALUE`
3. `BAD PERFORMANCE ≠ SYSTEM CONSTRAINT`
4. `CURRENT CONSTRAINT ≠ PERMANENT CONSTRAINT`
5. `ROOT CAUSE ≠ AUTOMATIC FIRST INTERVENTION POINT`
6. `DEPENDENCY ≠ AUTOMATICALLY WAIT`

Puede existir:
- parallel work;
- partial execution;
- alternative path;
- minimum prerequisite.

---

## 135. Modelo mental de Constraints

`BUSINESS OBJECTIVE`
↓
`SYSTEM FLOW`
↓
`WHERE DOES VALUE STOP?`
↓
`WHERE DOES DEMAND EXCEED CAPACITY?`
↓
`WHAT IS SATURATED?`
↓
`WHAT IS WAITING?`
↓
`WHAT HAS EXCESS CAPACITY?`
↓
`WHAT LIMITS ADDITIONAL THROUGHPUT?`
↓
`CURRENT CONSTRAINT`

---

## 136. Modelo mental de Dependencias

`CANDIDATE A`
↓
`WHAT DOES IT NEED?`
↓
`PREREQUISITES`
↓
`HARD / SOFT?`
↓
`WHAT BLOCKS IT?`
↓
`WHAT DOES IT BLOCK?`
↓
`ALTERNATIVE PATH?`
↓
`SHARED RESOURCE?`
↓
`CRITICAL PATH?`
↓
`PARALLELISM?`
↓
`DEPENDENCY POSITION`

---

## 137. Modelo conjunto

`DECISION CANDIDATES`
↓
`CONSTRAINT MAP + DEPENDENCY GRAPH`
↓
`UPSTREAM / DOWNSTREAM`
↓
`BLOCKERS`
↓
`CRITICAL PATH`
↓
`SHARED RESOURCES`
↓
`UNLOCK RELATIONSHIPS`
↓
`NEXT-LIKELY CONSTRAINTS`
↓
`DECISIONAL STRUCTURE`

---

## 138. Principio final

La prioridad correcta depende también de:

- dónde se detiene el flow;
- qué es binding;
- qué depende de qué;
- qué está bloqueado;
- qué puede ejecutarse en paralelo;
- qué recurso es escaso;
- qué nodo desbloquea downstream value;
- qué constraint aparecerá después.

El objetivo de P5 es impedir que la IA optimice partes mientras ignora el sistema completo.
