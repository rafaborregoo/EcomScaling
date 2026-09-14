# **P10 — MOTOR DE RANKING Y SÍNTESIS DE PRIORIDAD**

## **0\. Propósito**

P10 define cómo debe transformar el sistema las dimensiones decisionales construidas en P1–P9 en una conclusión estructurada sobre prioridad.

Su responsabilidad es responder:

> ¿Qué candidatos merecen más atención que otros, bajo qué reglas y con qué grado de separación o incertidumbre?

P10 es el primer bloque de Fase 4 autorizado a emitir:

* ranking;  
* priority state;  
* dominance relationships;  
* ties;  
* priority bands;  
* relative ordering;  
* reasons for precedence;  
* unresolved ordering.

P10 NO decide todavía:

* qué combinación final ejecutar en paralelo → P11;  
* qué recursos asignar definitivamente al portfolio → P11;  
* explicación narrativa final → P12;  
* playbooks → Fase 5\.

---

# **1\. Principio fundamental**

P10 NO implementará:

`priority_score = Σ(weight_i × factor_i)`

como regla universal.

Debe operar por capas.

Arquitectura:

**VALIDITY**

↓

**GATES**

↓

**HARD CONSTRAINTS**

↓

**HARD DEPENDENCIES**

↓

**AUTHORIZED OVERRIDES**

↓

**COMPARABILITY**

↓

**DOMINANCE**

↓

**MULTI-DIMENSIONAL SYNTHESIS**

↓

**RELATIVE ORDERING**

↓

**PRIORITY STATE**

↓

**UNCERTAINTY / ABSTENTION CHECK**

Los scores, cuando existan, serán auxiliares.

---

# **2\. Entidad principal**

Entidad:

**PRIORITY\_RANKING\_RESULT**

Representa:

> la síntesis estructurada del orden relativo de candidatos dentro de una ejecución determinada.

Relación:

`PRIORITIZATION_RUN`

→ `PRIORITY_RANKING_RESULT`

P10 será source of truth de:

* ranking;  
* priority state;  
* relative order;  
* priority distance class;  
* dominance;  
* unresolved ordering.

---

# **3\. Inputs de P10**

P10 consume:

P1:

`DECISION_CONTEXT_RESULT`

P2:

`CANDIDATE_NORMALIZATION_RESULT`

P3:

`TIME_SENSITIVITY_RESULT`

P4:

`IMPACT_RESULT`

P5:

`CONSTRAINT_DEPENDENCY_RESULT`

P6:

`FEASIBILITY_RESULT`

P7:

`RISK_RESULT`

P8:

`DECISION_ECONOMICS_RESULT`

P9:

`STRATEGIC_FIT_RESULT`

P10 no debe reconstruir ninguno.

---

# **4\. Ranking eligibility**

Antes de ordenar, cada candidato debe recibir:

**RANKING\_ELIGIBILITY**

Estados:

`ELIGIBLE`

`ELIGIBLE_WITH_LIMITATIONS`

`BLOCKED_BUT_BUSINESS_RELEVANT`

`NOT_COMPARABLE`

`REQUIRES_VALIDATION`

`INELIGIBLE`

`EXPIRED`

---

# **5\. ELIGIBLE ≠ EXECUTABLE NOW**

Un candidato puede ser:

`ELIGIBLE`

para comparación empresarial,

pero:

`BLOCKED`

para ejecución.

Esto permite mantener:

**BUSINESS PRIORITY**

≠

**EXECUTION ORDER**

---

# **6\. Hard pre-ranking gates**

P10 deberá aplicar antes de cualquier síntesis:

* candidate validity;  
* scope;  
* hard legality gates;  
* hard policy gates;  
* invalid data gates;  
* expired opportunity gates;  
* hard constraint violations;  
* mandatory dependency state;  
* minimum evidence requirements.

Un candidato que falla un gate no se “penaliza”.

Se cambia su estado.

---

# **7\. GATE OUTCOME**

Cada candidate debe poder quedar:

`PASSED`

`FAILED`

`UNKNOWN`

`NOT_APPLICABLE`

Un FAIL no puede compensarse con:

* high impact;  
* high EV;  
* high urgency;  
* strong strategic fit.

---

# **8\. BLOCKED BUT IMPORTANT**

P10 debe permitir un caso fundamental:

`business_priority = CRITICAL`

y simultáneamente:

`execution_state = BLOCKED`.

Ejemplo:

problema de gran impacto bloqueado por prerequisite.

No debe descender artificialmente su importancia empresarial solo porque no pueda ejecutarse aún.

---

# **9\. Candidate comparison object**

Entidad:

**CANDIDATE\_COMPARISON\_PROFILE**

Debe contener referencias a:

* time sensitivity;  
* impact;  
* constraints;  
* feasibility;  
* risk;  
* economics;  
* strategic fit;  
* evidence quality;  
* decision confidence.

No copia todos los datos.

Los referencia.

---

# **10\. COMPARABILITY**

Antes de comparar A y B, P10 deberá establecer:

`comparison_state`.

Valores:

`DIRECTLY_COMPARABLE`

`COMPARABLE_WITH_LIMITATIONS`

`PARTIALLY_COMPARABLE`

`NON_COMPARABLE`

`INSUFFICIENT_INFORMATION`

---

# **11\. NO FORCED COMPARABILITY**

P10 no debe producir un orden artificial entre dos candidates si:

* utilizan unidades incompatibles;  
* faltan dimensiones materiales;  
* existe incertidumbre dominante;  
* pertenecen a contextos distintos;  
* la comparación requiere preferencias no definidas.

Resultado válido:

`ORDER_UNRESOLVED`.

---

# **12\. Pairwise comparison**

P10 puede utilizar:

**PAIRWISE\_COMPARISON**

entre candidates relevantes.

Entidad:

* `candidate_a`;  
* `candidate_b`;  
* `comparison_result`;  
* `dominance_type`;  
* `material_dimensions[]`;  
* `tradeoffs[]`;  
* `uncertainties[]`;  
* `reason_codes[]`.

---

# **13\. Comparison result**

Estados:

`A_DOMINATES`

`B_DOMINATES`

`A_PREFERRED`

`B_PREFERRED`

`MATERIAL_TIE`

`TRADEOFF_UNRESOLVED`

`NOT_COMPARABLE`

`UNKNOWN`

---

# **14\. DOMINANCE**

Debe distinguirse:

**DOMINANCE**

de

**PREFERENCE**.

Dominance:

> A es igual o mejor en las dimensiones relevantes y no peor de forma material bajo las reglas aplicables.

Preference:

> A debe elegirse según el Decision Context pese a existir trade-offs.

---

# **15\. PARETO DOMINANCE**

P10 debe poder identificar:

`PARETO_DOMINATES`.

Ejemplo:

A:

* mayor expected value;  
* menor effort;  
* igual riesgo;  
* igual urgency;  
* mismo fit.

A domina B.

En este caso no se necesita weighting artificial.

---

# **16\. NO DOMINANCE**

Si:

A tiene mayor value.

B tiene menor risk.

Ninguno domina.

P10 debe utilizar contexto y reglas posteriores de síntesis.

No fingir equivalencia matemática.

---

# **17\. Lexicographic rules**

Cuando P1 defina objetivos lexicográficos, P10 debe respetarlos.

Ejemplo:

1. preservar solvencia;  
2. recuperar margin;  
3. crecer.

No debe permitir que gran upside de crecimiento supere una condición de solvencia si la política lo prohíbe.

---

# **18\. SATISFICING RULES**

Cuando P1 defina mínimos:

ejemplo:

cash runway \>= threshold

P10 debe primero validar el mínimo.

Solo después optimizar otras dimensiones.

---

# **19\. NON-COMPENSATORY RULES**

P10 debe soportar dimensiones no compensatorias.

Ejemplos:

* legal gate;  
* catastrophic risk;  
* hard dependency;  
* minimum feasibility;  
* policy violation;  
* strategic exclusion.

No convertirlas en weights.

---

# **20\. OVERRIDE**

Entidad:

**PRIORITY\_OVERRIDE**

Representa:

> regla autorizada que modifica el ordering normal.

Tipos iniciales:

`LEGAL`

`SAFETY`

`CONTRACTUAL`

`EXECUTIVE`

`TEMPORAL`

`INCIDENT`

`BUSINESS_CONTINUITY`

`OTHER_POLICY`

---

# **21\. Override requirements**

Todo override debe incluir:

* `override_id`;  
* `override_type`;  
* `authority_ref`;  
* `scope`;  
* `reason_code`;  
* `valid_from`;  
* `valid_until`;  
* `evidence_refs[]`;  
* `policy_ref`.

Un override no puede ser inferido libremente por IA.

---

# **22\. Override ≠ arbitrary preference**

“Me parece más importante”

no es override.

Debe existir autoridad y regla.

---

# **23\. Priority dimension synthesis**

Después de gates, constraints y overrides, P10 puede sintetizar:

* urgency;  
* impact;  
* feasibility;  
* risk;  
* economics;  
* strategic fit;  
* evidence/confidence.

Pero conservando cada dimensión.

---

# **24\. Dimension state**

Cada dimensión debe entrar como:

`VALID`

`VALID_WITH_LIMITATIONS`

`UNKNOWN`

`NOT_APPLICABLE`

`BLOCKED`

etc.

No solo como número.

---

# **25\. UNKNOWN handling**

UNKNOWN no debe actuar como:

* neutral;  
* zero;  
* average;  
* low.

P10 debe decidir si el unknown:

`NON_MATERIAL`

`MATERIAL_BUT_TOLERABLE`

`ORDER_SENSITIVE`

`DECISION_BLOCKING`

---

# **26\. ORDER-SENSITIVE UNKNOWN**

Un unknown es:

`ORDER_SENSITIVE`

cuando conocerlo podría cambiar materialmente el ranking.

Esto es crítico.

---

# **27\. DECISION-BLOCKING UNKNOWN**

Si un unknown puede:

* alterar gate;  
* cambiar dominancia;  
* cambiar top priority;  
* alterar tail risk;  
* modificar hard strategic conflict;

P10 puede requerir:

`REQUIRES_VALIDATION`.

---

# **28\. Sensitivity to uncertainty**

Entidad:

**RANKING\_SENSITIVITY**

Debe responder:

> ¿El ranking permanece estable bajo el rango razonable de incertidumbre?

Estados:

`ROBUST`

`MOSTLY_ROBUST`

`SENSITIVE`

`HIGHLY_SENSITIVE`

`UNKNOWN`

---

# **29\. Robust ranking**

Un ranking es robusto cuando:

> cambios razonables en inputs inciertos no alteran materialmente la parte relevante del ordering.

---

# **30\. Fragile ranking**

Si pequeñas variaciones cambian \#1 y \#2:

P10 debe reflejarlo.

No presentar:

\#1 A  
\#2 B

como certeza fuerte.

---

# **31\. RANK ≠ PRIORITY DISTANCE**

Hard rule:

posición ordinal no expresa distancia.

Por tanto P10 debe separar:

`rank_position`

de

`priority_distance`.

---

# **32\. Priority distance**

Estados iniciales:

`DOMINANT_GAP`

`MATERIAL_GAP`

`SMALL_GAP`

`EFFECTIVE_TIE`

`UNRESOLVED`

`UNKNOWN`

No requieren distancia numérica universal.

---

# **33\. Rank confidence**

No usar:

`rank_confidence = 83%`

sin metodología.

Estados:

`HIGHLY_STABLE`

`STABLE`

`LIMITED`

`UNSTABLE`

`UNKNOWN`

---

# **34\. Priority state**

P10 debe emitir una clasificación semántica por candidate.

Entidad:

**PRIORITY\_STATE**

Valores iniciales:

`CRITICAL`

`HIGH`

`MEDIUM`

`LOW`

`DEFER`

`MONITOR`

`VALIDATE`

`BLOCKED`

`STOP`

`UNKNOWN`

Pero estos estados deben tener semántica definida.

---

# **35\. PRIORITY STATE ≠ RANK**

Ejemplo:

A \= HIGH  
B \= HIGH  
C \= MEDIUM

pero:

A rank 1  
B rank 2

A y B pueden pertenecer a la misma banda.

---

# **36\. Priority bands**

P10 puede agrupar candidates en:

**PRIORITY\_BANDS**

Ejemplo:

Band A:

atención prioritaria.

Band B:

relevante pero no dominante.

Band C:

monitorizar/diferir.

Esto es preferible a forzar diferencias falsas entre candidates muy próximos.

---

# **37\. CRITICAL**

`CRITICAL` debería reservarse para candidatos donde exista una combinación estructural que justifique atención excepcional.

Ejemplo:

* severe value at stake;  
* extreme time sensitivity;  
* business continuity threat;  
* non-action tail risk;  
* obligation;  
* hard override.

No debe ser simplemente “score \> 90”.

---

# **38\. HIGH**

Debe significar:

> merece atención prioritaria dentro del contexto, sin constituir necesariamente excepción crítica.

---

# **39\. MEDIUM**

> relevante, pero actualmente superado por alternativas materiales o limitado por economics/context.

---

# **40\. LOW**

> válido pero baja relevancia relativa dentro del contexto actual.

No significa:

> mala idea.

---

# **41\. DEFER**

`DEFER` significa:

> no merece atención inmediata dentro del horizonte actual, pero debe mantenerse como candidato válido.

Debe existir motivo.

---

# **42\. MONITOR**

`MONITOR` significa:

> no actuar todavía, pero cambios en triggers concretos podrían modificar prioridad.

Debe incluir:

`monitor_trigger_refs[]`.

---

# **43\. VALIDATE**

`VALIDATE` significa:

> la siguiente necesidad decisional no es comprometer recursos a la solución, sino reducir incertidumbre material.

Esto conecta con candidatos `UNCERTAINTY`.

---

# **44\. BLOCKED**

Significa:

> business relevance existe, pero execution eligibility está restringida por constraint/dependency.

No debe confundirse con LOW.

---

# **45\. STOP**

`STOP` debe utilizarse con cuidado.

Significa:

> el candidate/iniciativa actual no debería seguir consumiendo atención dentro del contexto por existir una razón estructurada.

Ejemplos:

* economic dominance negativa;  
* strategic conflict;  
* invalid premise;  
* policy violation;  
* opportunity expired.

No prescribe aún el playbook de cierre.

---

# **46\. PRIORITY STATE TRANSITIONS**

P10 debe permitir transiciones:

`MONITOR → HIGH`

`BLOCKED → HIGH`

`VALIDATE → HIGH`

`HIGH → DEFER`

`HIGH → LOW`

`HIGH → STOP`

etc.

Toda transición debe tener trigger.

---

# **47\. PRIORITY TRANSITION TRACE**

Entidad:

**PRIORITY\_TRANSITION**

Campos:

* from\_state;  
* to\_state;  
* changed\_at;  
* trigger\_ref;  
* changed\_input\_refs\[\];  
* rule\_refs\[\];  
* previous\_run\_id;  
* current\_run\_id.

---

# **48\. No silent priority drift**

Una prioridad no puede cambiar sin:

* input material;  
* policy change;  
* override;  
* new evidence;  
* context change.

---

# **49\. Ranking method**

Cada ranking debe declarar:

`ranking_method`.

Ejemplos:

`RULE_BASED`

`LEXICOGRAPHIC`

`PARETO_PLUS_RULES`

`PAIRWISE`

`HYBRID`

`MODEL_ASSISTED`

No usar:

`LLM_JUDGMENT`

como único método para decisiones materiales.

---

# **50\. Hybrid ranking**

Una arquitectura válida puede ser:

1. deterministic gates;  
2. constraint filtering;  
3. dependency classification;  
4. Pareto dominance;  
5. rule-based preference;  
6. model-assisted synthesis únicamente en trade-offs no resolubles determinísticamente.

---

# **51\. MODEL-ASSISTED SYNTHESIS**

La IA puede intervenir cuando:

* no hay regla determinista;  
* las dimensiones son heterogéneas;  
* se requiere juicio contextual.

Pero debe producir:

* candidates comparados;  
* dimensiones consideradas;  
* trade-offs;  
* evidence refs;  
* uncertainties;  
* structured conclusion;  
* inference trace.

---

# **52\. LLM NO TIENE AUTORIDAD ABSOLUTA**

Un modelo no puede:

* ignorar gate;  
* inventar weight;  
* eliminar dependency;  
* cambiar hard constraint;  
* fabricar probability;  
* transformar unknown en dato.

---

# **53\. Deterministic reconciliation**

Si un LLM produce conclusión incompatible con reglas:

la regla determinista prevalece.

Debe registrarse:

`MODEL_RULE_CONFLICT`.

---

# **54\. Multiple-model consistency**

Si se utilizan varios agentes/modelos:

puede existir:

**RANKING\_PROPOSAL**

por modelo.

Luego:

**RANKING\_RECONCILIATION**

---

# **55\. Model disagreement**

Si modelos discrepan y la discrepancia es material:

`MODEL_DISAGREEMENT`.

No elegir silenciosamente uno.

---

# **56\. Deterministic result dominates**

Si el ordering deriva completamente de reglas:

el disagreement generativo es irrelevante para el resultado estructural.

---

# **57\. Ranking candidate set**

P10 deberá guardar explícitamente:

`ranked_candidate_set_ref`.

Nunca debe aparecer un candidate no incluido en P2.

---

# **58\. Excluded candidates**

P10 también debe registrar:

`excluded_from_ranking[]`

con reason codes.

Esto mejora auditabilidad.

---

# **59\. Pairwise trace**

Cuando una comparación altera el ordering debe ser reconstruible.

Ejemplo:

A \> B porque:

* mismo hard eligibility;  
* A time-critical;  
* B delay-tolerant;  
* value comparable;  
* no material risk disadvantage;  
* same scarce resource.

No basta:

`A score 84, B score 76`.

---

# **60\. Dimension precedence**

P10 debe respetar configuraciones explícitas de precedencia.

Ejemplo conceptual:

1. hard legality;  
2. business continuity;  
3. critical temporal conditions;  
4. hard dependencies;  
5. objective alignment;  
6. economic/resource trade-offs.

Pero no existe una jerarquía universal para todas las situaciones salvo las reglas constitucionales de P0.

---

# **61\. Context-specific policy**

Entidad:

**PRIORITY\_POLICY**

Debe permitir configurar:

* hard rules;  
* lexicographic rules;  
* materiality rules;  
* tie rules;  
* required evidence;  
* override rules;  
* abstention rules.

Versionada.

---

# **62\. No hidden weights**

Si existen weights explícitos en algún subproblema:

deben estar:

* documentados;  
* versionados;  
* justificados;  
* limitados a dimensiones compensatorias.

Nunca escondidos en prompt.

---

# **63\. Weighted submodel**

Puede ser válido utilizar scoring dentro de un subconjunto homogéneo.

Ejemplo:

varias alternativas equivalentes sin gates ni dependencies.

Pero deberá declararse:

`auxiliary_scoring_model`.

Nunca source of truth global.

---

# **64\. Score interpretability**

Si existe score:

debe indicar:

* qué mide;  
* qué no mide;  
* input dimensions;  
* normalization;  
* scale;  
* policy version.

No usar score opaco.

---

# **65\. No score laundering**

No convertir categorías cualitativas a números arbitrarios:

HIGH \= 3  
MEDIUM \= 2  
LOW \= 1

y después fingir precisión matemática.

Solo si existe una policy explícita que justifique ese mapping para un propósito concreto.

---

# **66\. Priority tie**

P10 debe aceptar:

`MATERIAL_TIE`.

No forzar desempate.

---

# **67\. Tie-breakers**

Los tie-breakers pueden incluir:

* lower irreversible downside;  
* higher evidence quality;  
* lower scarce-resource consumption;  
* greater reversibility;  
* nearer deadline;  
* strategic fit.

Pero deben estar configurados.

No universalmente aplicados.

---

# **68\. Tie unresolved**

Si no existe tie-breaker defendible:

`TIE_UNRESOLVED`.

P11 podrá quizá tratar ambos en paralelo.

---

# **69\. Business priority vs readiness**

P10 debe emitir al menos dos ejes:

`business_priority_state`

y

`execution_readiness_state`.

Ejemplo:

business priority:

`CRITICAL`

execution readiness:

`BLOCKED`.

---

# **70\. Business priority vs execution rank**

También:

`business_rank`

≠

`execution_sequence_position`.

La segunda procede principalmente de P5/P11.

---

# **71\. Priority without execution**

P10 puede concluir:

> esto es lo más importante

aunque actualmente:

> no pueda ejecutarse.

Esto es necesario para que el sistema no pierda de vista constraints reales.

---

# **72\. Validation priority**

Una uncertainty puede quedar rank \#1.

Esto significa:

> la validación merece atención primero.

No implica:

> la hipótesis subyacente sea verdadera.

---

# **73\. Monitor state**

P10 debe poder decidir que un candidate:

> no merece intervención ahora

pero requiere monitorización porque determinadas variables podrían cambiar el ordering.

Debe contener:

`priority_change_triggers[]`.

---

# **74\. Priority trigger**

Ejemplos:

* CAC supera threshold;  
* stock cae por debajo de límite;  
* runway baja;  
* deadline entra en critical window;  
* new evidence confirms root cause;  
* dependency becomes satisfied.

---

# **75\. Stop state**

P10 debe diferenciar:

`STOP_CURRENT_ATTENTION`

de

`REJECT_CANDIDATE`.

Candidate puede seguir existiendo históricamente aunque deje de consumir recursos.

---

# **76\. Defer until**

Puede existir:

`defer_until_condition`

o

`defer_until_time`.

No es obligatorio siempre.

No inventar fechas.

---

# **77\. Priority stability**

Entidad:

**PRIORITY\_STABILITY**

Puede evaluar:

* estabilidad temporal;  
* sensibilidad a inputs;  
* sensitivity to uncertainty;  
* policy dependence.

---

# **78\. Priority churn**

Debe poder detectarse:

> candidate cambia repetidamente de prioridad ante variaciones pequeñas.

Esto puede indicar:

* thresholds malos;  
* noisy data;  
* fragile ranking;  
* policy instability.

---

# **79\. Hysteresis**

Para evitar cambios constantes alrededor de thresholds puede existir:

`priority_hysteresis_policy`.

No es obligatoria universalmente.

Ejemplo:

no cambiar HIGH↔MEDIUM por oscilaciones insignificantes.

---

# **80\. Material change threshold**

Debe existir policy que defina cuándo un cambio es:

`MATERIAL_FOR_RANKING`.

No debe depender de cualquier fluctuación.

---

# **81\. Cross-run comparability**

P10 debe poder comparar:

ranking actual

vs

ranking anterior.

Campos:

* candidates moved;  
* new candidates;  
* removed candidates;  
* state changes;  
* dominance changes;  
* drivers.

---

# **82\. Rank movement reason**

Toda variación relevante debe poder responder:

> ¿por qué A pasó de \#4 a \#1?

Con refs estructurados.

---

# **83\. Ranking completeness**

Estado:

`COMPLETE`

`COMPLETE_WITH_LIMITATIONS`

`PARTIAL`

`UNRESOLVED`

`INVALID`

No siempre será posible rankear todos los candidates.

---

# **84\. Partial ranking**

Ejemplo válido:

A \> B

A \> C

pero:

B vs C unresolved.

El motor debe soportar:

**PARTIAL ORDER**

No forzar una lista total.

---

# **85\. Total ranking is optional**

Una lista:

1  
2  
3  
4  
5

solo debe producirse cuando está justificada.

En otros casos:

* bands;  
* partial order;  
* ties;  
* unresolved relationships.

son más honestos.

---

# **86\. PRIORITY\_DISTANCE**

Puede existir por pares:

`A materially ahead of B`.

No tiene por qué expresarse numéricamente.

---

# **87\. Dominance graph**

P10 puede construir:

**PRIORITY\_DOMINANCE\_GRAPH**

Nodos:

candidates.

Edges:

A \> B.

Esto es más rico que una simple lista.

---

# **88\. Strong vs weak edge**

Edge puede ser:

`STRONG_DOMINANCE`

`RULE_PREFERENCE`

`CONTEXTUAL_PREFERENCE`

`WEAK_PREFERENCE`

`UNCERTAIN_PREFERENCE`

---

# **89\. Ranking rationale object**

Entidad:

**PRIORITY\_RATIONALE**

Debe ser estructurada.

Campos:

* `candidate_id`;  
* `supports_priority[]`;  
* `limits_priority[]`;  
* `blocking_factors[]`;  
* `dominance_refs[]`;  
* `uncertainties[]`;  
* `counterfactual_change_triggers[]`.

P12 convertirá esto en explicación humana.

---

# **90\. WHY THIS / WHY NOW / WHY BEFORE OTHERS**

P10 debe proporcionar datos estructurados suficientes para que P12 responda:

**WHY THIS?**

→ rationale.

**WHY NOW?**

→ P3/time refs.

**WHY BEFORE OTHERS?**

→ comparisons/dominance.

**WHAT WOULD CHANGE OUR MIND?**

→ triggers/sensitivity.

---

# **91\. No recommendation leakage**

P10 puede decir:

> candidate A es highest priority.

No puede decir:

> implementa un bundle y cambia checkout en tres pasos.

Eso pertenece a Fase 5\.

---

# **92\. Ranking result schema**

**PRIORITY\_RANKING\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `ranking_result_id` | identidad |
| `prioritization_run_id` | ejecución |
| `ranking_state` | validez |
| `ranked_candidate_set_ref` | universo |
| `priority_entries[]` | resultados |
| `priority_band_refs[]` | bandas |
| `dominance_graph_ref` | dominancia |
| `partial_order_ref` | orden |
| `pairwise_comparison_refs[]` | comparaciones |
| `excluded_candidate_refs[]` | excluidos |
| `unresolved_comparisons[]` | conflictos |
| `ranking_sensitivity_ref` | sensibilidad |
| `ranking_stability_ref` | estabilidad |
| `override_refs[]` | overrides |
| `unknowns[]` | desconocidos |
| `warnings[]` | limitaciones |
| `rule_trace_refs[]` | trazabilidad |
| `created_at` | timestamp |
| `policy_version` | reglas |

---

# **93\. Priority entry**

Entidad:

**PRIORITY\_ENTRY**

Campos:

* `candidate_id`;  
* `business_priority_state`;  
* `rank_position`;  
* `priority_band`;  
* `priority_distance_to_next`;  
* `ranking_eligibility`;  
* `execution_readiness_state`;  
* `rationale_ref`;  
* `dominates_refs[]`;  
* `dominated_by_refs[]`;  
* `priority_change_triggers[]`;  
* `confidence_state`.

---

# **94\. RANKING\_STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`PARTIAL`

`REQUIRES_VALIDATION`

`UNRESOLVED`

`NO_RANKABLE_CANDIDATES`

`STALE`

`INVALID`

---

# **95\. No rankable candidates**

Resultado válido:

`NO_RANKABLE_CANDIDATES`

cuando:

* todos están invalidados;  
* todos están fuera de scope;  
* datos son insuficientes;  
* candidate set vacío.

No inventar una prioridad para evitar salida vacía.

---

# **96\. Abstention**

P10 deberá abstenerse de ordenar cuando:

* ordering depende de unknown material;  
* objective conflict sigue sin resolver;  
* candidates no son comparables;  
* evidence insuficiente;  
* model disagreement material no puede reconciliarse;  
* ranking sería arbitrario.

---

# **97\. Abstention scope**

La abstención puede ser:

`FULL`

o

`PARTIAL`.

Ejemplo:

A claramente primero.

B y C unresolved.

No hace falta abstenerse de todo el ranking.

---

# **98\. Reason codes**

Familias:

`RANKING.*`

`PRIORITY.*`

`COMPARISON.*`

`DOMINANCE.*`

`OVERRIDE.*`

Ejemplos:

`RANKING.PARTIAL_ORDER`

`RANKING.INSUFFICIENT_INFORMATION`

`PRIORITY.CRITICAL`

`PRIORITY.BLOCKED`

`PRIORITY.VALIDATE`

`PRIORITY.DEFER`

`COMPARISON.MATERIAL_TIE`

`COMPARISON.NON_COMPARABLE`

`DOMINANCE.PARETO`

`DOMINANCE.CONTEXTUAL`

`OVERRIDE.AUTHORIZED`

`OVERRIDE.EXPIRED`

---

# **99\. Invariantes P10**

1. Hard gate no puede ser compensado por score.  
2. Hard constraint no puede compensarse con high value.  
3. Hard dependency no desaparece por high priority.  
4. Business priority no equivale a execution order.  
5. Ranking no equivale a active portfolio.  
6. Rank no equivale a priority distance.  
7. UNKNOWN no equivale a neutral.  
8. No se fuerza comparabilidad.  
9. No se fuerza total order.  
10. Material ties están permitidos.  
11. Scores son auxiliares.  
12. Weights no pueden estar ocultos.  
13. Dominance debe conservarse.  
14. Priority state no equivale a rank.  
15. A candidate BLOCKED puede seguir siendo business priority \#1.  
16. Strategic fit no puede sobrescribir gates.  
17. EV no determina automáticamente ranking.  
18. Low effort no determina prioridad.  
19. High urgency no domina automáticamente todo.  
20. LLM no puede violar reglas deterministas.  
21. Toda prioridad debe tener structured rationale.  
22. Toda variación material debe ser trazable.  
23. P10 no decide portfolio activo.  
24. P10 no genera playbooks.

---

# **100\. Precondiciones**

P10 necesita:

* P1 context utilizable;  
* P2 candidate set;  
* assessments disponibles P3–P9;  
* priority policy;  
* hard gates evaluables;  
* evidence lineage.

No todas las dimensiones tienen que ser conocidas.

Pero los unknowns materiales deben conservarse.

---

# **101\. Postcondiciones**

P10 termina correctamente cuando el sistema puede indicar:

* qué candidates son rankeables;  
* cuáles están bloqueados;  
* qué candidates dominan a otros;  
* qué candidates están empatados;  
* qué ordering puede defenderse;  
* qué ordering permanece incierto;  
* qué priority state tiene cada candidate;  
* qué podría cambiar la decisión;  
* qué reglas explican el resultado.

---

# **102\. Failure modes**

## **Weighted-sum collapse**

Todo termina en score.

**Prevención:** layered decision architecture.

---

## **Score overrides legality**

Candidate ilegal gana por value.

**Prevención:** gate precedence.

---

## **Blocked-is-low**

Candidate crítico bloqueado cae al final.

**Prevención:** business priority ≠ execution readiness.

---

## **Forced total ranking**

Se obliga a ordenar 1–10 aunque \#2–\#5 sean equivalentes.

**Prevención:** bands \+ partial order \+ ties.

---

## **Unknown-as-neutral**

Dato desconocido no afecta ranking.

**Prevención:** order-sensitive uncertainty.

---

## **EV absolutism**

Mayor EV gana.

**Prevención:** multi-dimensional synthesis.

---

## **Urgency absolutism**

Más urgente gana siempre.

**Prevención:** precedence/policy.

---

## **Strategic-veto subjectivity**

“no encaja estratégicamente” sin evidencia.

**Prevención:** P9 refs obligatorias.

---

## **LLM dictatorship**

Modelo produce ranking sin reglas.

**Prevención:** model-assisted only after deterministic layers.

---

## **Rank-distance illusion**

\#1 parece mucho mejor que \#2 solo por posición.

**Prevención:** priority distance state.

---

# **103\. Tests contractuales**

| Caso | Resultado esperado |
| ----- | ----- |
| hard gate FAIL \+ highest EV | no gana |
| hard dependency pendiente | business priority preservable, execution blocked |
| A Pareto dominates B | dominance |
| A mayor value, B menor risk | trade-off, no dominance automática |
| objective lexicographic | respetar precedencia |
| material tie | tie permitido |
| unknown crítico | REQUIRES\_VALIDATION |
| unknown irrelevante | ranking puede continuar |
| candidates no comparables | no forced rank |
| solo partial ordering | válido |
| explanation cambia | ranking estructural no cambia |
| same inputs/policy | mismo deterministic result |
| model contradice gate | gate prevalece |
| model disagreement material | validation/unresolved |
| change metadata only | no ranking change |
| new deadline critical | ranking puede cambiar |
| candidate blocked | no convertir automáticamente LOW |
| high EV \+ strategic hard conflict | conflict preservado |
| score auxiliary | no override de reglas |
| no candidates rankeables | NO\_RANKABLE\_CANDIDATES |

---

# **104\. Evals IA**

### **Gate compliance eval**

¿Respeta gates incluso cuando otra dimensión parece dominante?

### **Weighted-sum avoidance eval**

¿Evita convertir todo en score?

### **Trade-off reasoning eval**

¿Distingue dominance de preference?

### **Tie honesty eval**

¿Acepta empate cuando corresponde?

### **Partial-order eval**

¿Evita ordenar candidatos sin base?

### **Blocked-priority eval**

¿Conserva importancia empresarial de candidatos bloqueados?

### **Unknown sensitivity eval**

¿Detecta unknowns que podrían cambiar ordering?

### **Model consistency eval**

¿Mantiene reglas estructurales entre diferentes modelos?

### **Boundary eval**

¿Evita generar playbooks?

---

# **105\. Ejemplo 1 — Candidate crítico bloqueado**

A:

problema de cash leakage severo.

Impact:

alto.

Urgency:

alta.

Dependency:

requiere reconciliación de datos previa.

Resultado posible:

`business_priority = CRITICAL`

`rank_position = 1`

`execution_readiness = BLOCKED`

Eso es correcto.

No debe bajar a \#5 solo porque no pueda iniciarse mañana.

---

# **106\. Ejemplo 2 — Pareto dominance**

A:

* EV mayor;  
* effort menor;  
* riesgo igual;  
* strategy fit igual.

B:

peor en todas.

P10:

`A_DOMINATES_B`.

No necesita scoring.

---

# **107\. Ejemplo 3 — Trade-off real**

A:

* EV alto;  
* irreversible downside alto.

B:

* EV moderado;  
* reversible;  
* evidence alta.

No existe dominance.

P10 debe utilizar:

* risk policy;  
* objectives;  
* context.

Si siguen faltando preferencias:

`TRADEOFF_UNRESOLVED`.

---

# **108\. Ejemplo 4 — Urgent but small**

A:

impact pequeño.

urgency crítica.

B:

impact enorme.

urgency baja.

No existe regla universal para afirmar:

A \> B

o

B \> A.

P10 necesita contexto y policy.

---

# **109\. Ejemplo 5 — Validation candidate**

A:

hipótesis que bloquea decisión de €500k.

B:

optimización conocida de €15k.

P8 puede mostrar alto value of information de A.

P10 puede concluir:

A \= `VALIDATE`, rank \#1.

Eso no significa que la hipótesis sea cierta.

---

# **110\. Ejemplo 6 — Material tie**

A y B:

* igual objective relevance;  
* values solapados;  
* resources distintos;  
* ambos factibles;  
* no material risk difference.

Resultado:

`EFFECTIVE_TIE`.

P11 puede determinar que ambos pueden ejecutarse en paralelo.

---

# **111\. Ejemplo 7 — STOP**

Candidate:

iniciativa histórica que sigue consumiendo recursos.

Nueva evidencia:

* NEV futuro negativo;  
* no strategic fit;  
* alternative dominates;  
* no dependency estratégica.

P10 puede producir:

`STOP`.

No porque el proyecto “haya fracasado”, sino porque continuar ya no merece prioridad.

---

# **112\. Interfaz con P11**

P10 responde:

> ¿qué merece prioridad?

P11 responderá:

> dado ese ranking, resources, dependencies y concurrency, ¿qué conjunto queda activo?

P10 puede decir:

A \> B \> C

pero P11 puede concluir:

A \+ B activos

C diferido

porque A y B no compiten por recursos.

---

# **113\. Ranking ≠ active portfolio**

Esta distinción es obligatoria.

Un ranking lineal no responde:

* qué puede correr en paralelo;  
* cuánto WIP soporta el negocio;  
* qué combinación maximiza portfolio value;  
* qué candidates son mutually exclusive.

Eso pertenece a P11.

---

# **114\. Interfaz con P12**

P12 utilizará:

* ranking;  
* rationale;  
* dominance;  
* pairwise comparisons;  
* reason codes;  
* sensitivity;  
* unknowns;  
* triggers.

Para responder narrativamente:

> por qué esto;  
> por qué ahora;  
> por qué antes;  
> qué cambiaría la decisión.

P12 no debe reconstruir lógica.

---

# **115\. Definition of Done — P10**

P10 está completo cuando el sistema puede responder:

**WHO IS ACTUALLY ELIGIBLE TO COMPETE?**

Existe ranking eligibility.

**WHAT RULES APPLY BEFORE COMPARISON?**

Gates, constraints, dependencies y overrides están resueltos.

**DOES ANY CANDIDATE CLEARLY DOMINATE ANOTHER?**

Existe dominance.

**WHERE DO REAL TRADE-OFFS REMAIN?**

Están explícitos.

**CAN WE HONESTLY ORDER EVERYONE?**

Total order solo cuando está justificado.

**ARE THERE MATERIAL TIES?**

Se permiten.

**HOW FAR APART ARE THE PRIORITIES?**

Rank está separado de priority distance.

**WHAT IS EACH CANDIDATE'S PRIORITY STATE?**

Existe CRITICAL/HIGH/MEDIUM/etc. con semántica.

**IS SOMETHING IMPORTANT BUT BLOCKED?**

Business priority permanece separada de execution readiness.

**HOW SENSITIVE IS THE ORDERING TO UNCERTAINTY?**

Existe ranking sensitivity.

**WHAT WOULD CHANGE THE ORDER?**

Existen priority change triggers.

**CAN THE DECISION BE RECONSTRUCTED?**

Existe pairwise/rule/rationale trace.

P10 no produce todavía el portfolio final.

Produce:

> **la estructura defendible de prioridad relativa entre los candidatos.**

