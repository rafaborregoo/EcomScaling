# **P12 — SALIDA, EXPLICABILIDAD, TRAZABILIDAD Y VALIDACIÓN DECISIONAL**

## **0\. Propósito**

P12 define cómo debe salir del sistema una decisión de priorización completa, explicable, verificable y reconstruible.

Su responsabilidad es responder:

> ¿Qué decidió el sistema, por qué lo decidió, con qué evidencia, qué reglas intervinieron, qué incertidumbres permanecen y qué tendría que cambiar para modificar la decisión?

P12 NO vuelve a priorizar.

No debe:

* recalcular impacto;  
* reinterpretar urgency;  
* crear dependencies;  
* modificar feasibility;  
* inventar expected value;  
* alterar ranking;  
* cambiar portfolio;  
* generar playbooks.

P12 convierte el resultado estructural de P0–P11 en:

**DECISION OUTPUT**

* 

**EXPLANATION**

* 

**TRACEABILITY**

* 

**VALIDATION**

* 

**AUDIT PACKAGE**

---

# **1\. Principio fundamental**

Debe mantenerse:

**DECISION**

≠

**EXPLANATION**

≠

**NARRATIVE**

≠

**EVIDENCE**

≠

**TRACE**

≠

**VALIDATION**

La explicación humana nunca puede convertirse en source of truth de la decisión.

La source of truth permanece en los objetos estructurados generados por P0–P11.

---

# **2\. Entidad principal**

Entidad:

**PRIORITIZATION\_DECISION\_OUTPUT**

Representa:

> la salida formal de una ejecución completa de Fase 4\.

Relación:

`PRIORITIZATION_RUN`

→ `PRIORITIZATION_DECISION_OUTPUT`

P12 será source of truth de:

* presentación final;  
* explanation refs;  
* validation state;  
* trace package;  
* audit package;  
* decision summary.

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `decision_output_id` | Sí | identidad |
| `prioritization_run_id` | Sí | ejecución origen |
| `decision_status` | Sí | validez |
| `ranking_result_ref` | Condicional | P10 |
| `portfolio_result_ref` | Condicional | P11 |
| `decision_summary_ref` | Sí | síntesis |
| `explanation_ref` | Sí | explicación |
| `validation_result_ref` | Sí | validación |
| `trace_package_ref` | Sí | trazabilidad |
| `audit_package_ref` | Sí | auditabilidad |
| `uncertainty_summary_ref` | Condicional | unknowns |
| `change_trigger_refs[]` | Opcional | qué cambiaría decisión |
| `created_at` | Sí | timestamp |
| `schema_version` | Sí | contrato |
| `policy_version` | Sí | reglas |

---

# **4\. DECISION STATUS**

Estados:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`PARTIAL`

`ABSTAINED`

`STALE`

`INVALID`

Debe ser coherente con P0.

P12 no puede elevar una decisión:

`REQUIRES_VALIDATION`

a

`VALID`

solo porque pueda redactar una explicación convincente.

---

# **5\. DECISION SUMMARY**

Entidad:

**DECISION\_SUMMARY**

Debe expresar de forma estructurada:

* qué merece mayor atención;  
* qué está activo;  
* qué está bloqueado;  
* qué debe validarse;  
* qué puede correr en paralelo;  
* qué está diferido;  
* qué debe detenerse;  
* qué incertidumbres son materiales.

No debe contener todavía el playbook de resolución.

---

# **6\. DECISION SUMMARY ≠ FREE TEXT**

Debe existir representación estructurada.

Ejemplo conceptual:

`top_priority_refs[]`

`active_portfolio_refs[]`

`blocked_refs[]`

`validation_refs[]`

`monitor_refs[]`

`deferred_refs[]`

`stop_refs[]`

`unresolved_refs[]`

La narrativa será una vista.

No la decisión.

---

# **7\. EXPLANATION**

Entidad:

**DECISION\_EXPLANATION**

Debe responder como mínimo:

**WHY THIS?**

**WHY NOW?**

**WHY BEFORE OTHERS?**

**WHY NOT THE ALTERNATIVES?**

**WHAT IS BLOCKING IT?**

**WHAT CAN RUN IN PARALLEL?**

**WHAT MUST WAIT?**

**WHAT WOULD CHANGE OUR MIND?**

---

# **8\. EXPLANATION LAYERS**

Conviene separar explicación en capas.

### **EXECUTIVE**

Resumen ejecutivo.

### **DECISIONAL**

Razones principales.

### **TECHNICAL**

Rules, comparisons, evidence.

### **AUDIT**

Trazabilidad completa.

No todos los usuarios necesitan ver la misma profundidad.

---

# **9\. EXECUTIVE EXPLANATION**

Debe ser capaz de decir:

> “A es la prioridad principal porque combina X, Y y Z; B puede avanzar en paralelo; C está bloqueado por D; la decisión cambiaría si ocurre E.”

Sin entrar todavía en todos los detalles del engine.

---

# **10\. TECHNICAL EXPLANATION**

Debe incluir referencias a:

* candidate;  
* dimensions;  
* rule traces;  
* dominance;  
* constraints;  
* dependency states;  
* uncertainties;  
* overrides;  
* portfolio conflicts.

---

# **11\. NARRATIVE GENERATION**

La IA puede redactar la explicación.

Pero debe utilizar únicamente:

* structured result;  
* evidence refs;  
* reason codes;  
* rule traces;  
* uncertainty states.

No puede introducir razones nuevas.

---

# **12\. NO POST-HOC REASONING**

Hard rule:

> la explicación no puede inventar a posteriori una justificación que no haya participado realmente en la decisión.

Debe existir:

`explanation_claim → decision_trace_ref`.

---

# **13\. EXPLANATION CLAIM**

Entidad:

**EXPLANATION\_CLAIM**

Representa una afirmación material de la explicación.

Campos:

* `claim_id`;  
* `claim_type`;  
* `claim_text`;  
* `supporting_rule_refs[]`;  
* `evidence_refs[]`;  
* `candidate_refs[]`;  
* `confidence_state`;  
* `validation_state`.

---

# **14\. CLAIM TYPES**

Tipos:

`PRIORITY_REASON`

`TEMPORAL_REASON`

`VALUE_REASON`

`CONSTRAINT_REASON`

`FEASIBILITY_REASON`

`RISK_REASON`

`ECONOMIC_REASON`

`STRATEGIC_REASON`

`COMPARISON_REASON`

`PORTFOLIO_REASON`

`UNCERTAINTY_REASON`

---

# **15\. CLAIM SUPPORT REQUIREMENT**

Toda afirmación material deberá estar soportada por:

* rule trace;  
* source;  
* evidence;  
* structured field.

Si no existe soporte:

no debe aparecer como afirmación factual.

---

# **16\. EVIDENCE ≠ REASON**

Ejemplo:

“CAC ha aumentado un 25 %”

es evidencia/data.

“Esto aumenta prioridad porque el deterioro está acelerándose”

es razonamiento.

P12 debe distinguir ambos.

---

# **17\. REASON CODE ≠ EXPLANATION**

`TIME.ACCELERATING`

es código estructurado.

No es todavía una explicación adecuada para usuario.

P12 traduce reason codes a lenguaje.

Pero conserva el código.

---

# **18\. TRACE PACKAGE**

Entidad:

**DECISION\_TRACE\_PACKAGE**

Representa:

> la cadena completa necesaria para reconstruir la decisión.

Debe permitir navegar:

SOURCE

↓

DATA

↓

FACT

↓

INFERENCE

↓

DIAGNOSIS

↓

CANDIDATE

↓

P1–P9 DIMENSIONS

↓

P10 COMPARISON

↓

PRIORITY

↓

P11 PORTFOLIO

↓

P12 OUTPUT

---

# **19\. TRACE NODE**

Entidad:

**TRACE\_NODE**

Campos:

* `trace_node_id`;  
* `entity_type`;  
* `entity_ref`;  
* `source_type`;  
* `created_at`;  
* `version`;  
* `epistemic_state`.

---

# **20\. TRACE EDGE**

Entidad:

**TRACE\_EDGE**

Campos:

* `from_node`;  
* `to_node`;  
* `relationship_type`;  
* `rule_ref`;  
* `created_at`.

---

# **21\. TRACE RELATIONSHIP TYPES**

Ejemplos:

`DERIVED_FROM`

`INFERRED_FROM`

`CALCULATED_FROM`

`SUPPORTED_BY`

`NORMALIZED_FROM`

`EVALUATED_BY`

`COMPARED_WITH`

`DOMINATES`

`BLOCKED_BY`

`DEPENDS_ON`

`SELECTED_IN`

`EXCLUDED_FROM`

---

# **22\. TRACE COMPLETENESS**

Estado:

`COMPLETE`

`COMPLETE_WITH_LIMITATIONS`

`PARTIAL`

`BROKEN`

`UNKNOWN`

Una decisión material con trace:

`BROKEN`

no debería presentarse como completamente auditable.

---

# **23\. SOURCE LINEAGE**

Debe conservar:

* origen;  
* timestamp;  
* versión;  
* source system;  
* authority;  
* freshness.

P12 no necesita copiar el dato.

Necesita referenciarlo correctamente.

---

# **24\. AUDIT PACKAGE**

Entidad:

**DECISION\_AUDIT\_PACKAGE**

Debe contener suficiente información para responder:

> si mañana alguien cuestiona esta prioridad, ¿podemos reconstruir exactamente bajo qué información y reglas se tomó?

Campos:

* run id;  
* input fingerprint;  
* source refs;  
* rule versions;  
* policy versions;  
* model versions;  
* prompt/policy versions;  
* timestamps;  
* structured outputs;  
* overrides;  
* unknowns;  
* validation state.

---

# **25\. HISTORICAL REPRODUCIBILITY**

Una decisión histórica debe poder examinarse con:

* inputs de ese momento;  
* reglas de ese momento;  
* modelos de ese momento;  
* contexto de ese momento.

No con la configuración actual.

---

# **26\. REPRODUCIBILITY ≠ RE-EXECUTION**

Puede ocurrir que un modelo antiguo ya no esté disponible.

Aun así debe ser posible:

> reconstruir por qué se tomó la decisión.

No necesariamente volver a ejecutar idénticamente el modelo.

---

# **27\. MODEL TRACE**

Toda intervención probabilística material debe registrar:

* model id;  
* model version;  
* inference id;  
* prompt/policy version;  
* input refs;  
* output estructurado.

No es necesario almacenar chain-of-thought privada.

---

# **28\. EXPLANATION WITHOUT CHAIN OF THOUGHT**

La auditabilidad debe construirse mediante:

* reglas;  
* evidence;  
* reason codes;  
* structured inference;  
* comparisons;  
* outcomes.

No depender de razonamientos internos libres del modelo.

---

# **29\. VALIDATION**

Entidad:

**DECISION\_VALIDATION\_RESULT**

Responde:

> ¿La decisión cumple las condiciones contractuales necesarias para ser utilizada?

---

# **30\. VALIDATION DIMENSIONS**

Debe comprobar:

`INPUT_VALIDITY`

`CONTRACT_VALIDITY`

`EVIDENCE_SUFFICIENCY`

`RULE_COMPLIANCE`

`TRACE_COMPLETENESS`

`UNCERTAINTY_HANDLING`

`MODEL_COMPLIANCE`

`OUTPUT_CONSISTENCY`

---

# **31\. VALIDATION RESULT**

Estados:

`PASSED`

`PASSED_WITH_WARNINGS`

`REQUIRES_REVIEW`

`FAILED`

---

# **32\. INPUT VALIDATION**

Comprueba:

* run válido;  
* context válido;  
* candidate set válido;  
* schemas compatibles;  
* fingerprints;  
* versions.

---

# **33\. RULE COMPLIANCE**

Comprueba:

* hard gates respetados;  
* dependencies respetadas;  
* constraints respetados;  
* overrides autorizados;  
* no hidden weight violations;  
* no prohibited compensation.

---

# **34\. EVIDENCE SUFFICIENCY**

Debe comprobar si las afirmaciones materiales tienen soporte suficiente.

Especialmente:

* ranking top;  
* STOP;  
* BLOCKED;  
* strategic conflict;  
* high risk;  
* quantitative EV.

---

# **35\. TRACE VALIDATION**

Debe detectar:

* missing source ref;  
* broken lineage;  
* rule without inputs;  
* decision without reason code;  
* narrative claim without support.

---

# **36\. UNKNOWN VALIDATION**

Debe comprobar:

> ¿algún UNKNOWN fue transformado silenciosamente en valor?

Si sí:

`FAILED`.

---

# **37\. INFERENCE VALIDATION**

Debe comprobar:

* inference marcada como tal;  
* model trace;  
* evidence refs;  
* uncertainty preserved;  
* no overwrite de observed data.

---

# **38\. CROSS-BLOCK CONSISTENCY**

P12 debe detectar contradicciones entre bloques.

Ejemplos:

P5:

`BLOCKED`

pero P11:

`ACTIVE`

sin override válido.

P7:

`UNACCEPTABLE`

pero P10:

`HIGH`

sin policy/override.

P2:

`OUT_OF_SCOPE`

pero P10:

rank \#1.

---

# **39\. CONSISTENCY RULE**

Cuando exista contradicción:

P12 no debe “explicarla”.

Debe:

`VALIDATION_FAILED`

o

`REQUIRES_REVIEW`

según severidad.

---

# **40\. DECISION INVARIANT VALIDATION**

Debe validar invariantes globales de P0.

Entre ellas:

* hard gate precedence;  
* unknown safety;  
* source of truth;  
* no strategy leakage;  
* immutable history;  
* deterministic precedence.

---

# **41\. MODEL CONSISTENCY**

Si distintos agentes/modelos intervienen:

P12 debe registrar:

* agreements;  
* disagreements;  
* deterministic reconciliation;  
* unresolved conflict.

---

# **42\. MODEL DISAGREEMENT**

Entidad:

**MODEL\_DISAGREEMENT**

Campos:

* inference refs;  
* conflict type;  
* materiality;  
* affected candidate;  
* affected decision;  
* resolution state.

---

# **43\. MATERIAL MODEL DISAGREEMENT**

Si el desacuerdo afecta:

* top priority;  
* risk acceptance;  
* candidate validity;  
* dependency;  
* strategic fit;  
* portfolio composition;

y no existe regla determinista que lo resuelva:

`REQUIRES_REVIEW`.

---

# **44\. NON-MATERIAL DISAGREEMENT**

Si modelos solo difieren en redacción:

no afecta decision validity.

---

# **45\. DETERMINISTIC VS NARRATIVE CONSISTENCY**

Mismo structured decision puede producir textos distintos.

Eso es aceptable.

Lo que no puede cambiar es:

* rank;  
* state;  
* reason codes;  
* gates;  
* portfolio.

---

# **46\. DECISION CONFIDENCE**

P12 puede emitir una síntesis de confianza decisional.

Estados:

`HIGHLY_SUPPORTED`

`SUPPORTED`

`SUPPORTED_WITH_LIMITATIONS`

`VALIDATION_REQUIRED`

`INSUFFICIENT`

`UNKNOWN`

No confundir con probability of success.

---

# **47\. DECISION CONFIDENCE BASIS**

Debe explicar qué fundamenta la confianza:

* completeness;  
* evidence;  
* stability;  
* uncertainty;  
* model agreement;  
* trace completeness.

---

# **48\. CONFIDENCE ≠ GOOD OUTCOME**

Una decisión bien soportada puede producir mal outcome.

Una decisión débil puede producir buen outcome por azar.

Debe mantenerse:

**GOOD OUTCOME ≠ GOOD DECISION**

y

**BAD OUTCOME ≠ BAD DECISION**

---

# **49\. DECISION QUALITY**

P12 puede validar la calidad ex ante de la decisión.

No puede juzgar todavía el resultado real.

Eso corresponderá a Fase 9\.

---

# **50\. OUTCOME BLINDNESS**

La validación P12 no debe usar outcomes futuros para reescribir si la decisión fue buena.

La evaluación posterior debe comparar:

> lo que se sabía en ese momento.

---

# **51\. UNCERTAINTY SUMMARY**

Entidad:

**UNCERTAINTY\_SUMMARY**

Debe agrupar:

* unknowns;  
* ranges;  
* speculative assumptions;  
* conflicting evidence;  
* order-sensitive unknowns;  
* decision-blocking unknowns.

---

# **52\. MATERIAL UNCERTAINTY**

P12 debe distinguir:

`NON_MATERIAL`

`MATERIAL`

`ORDER_SENSITIVE`

`DECISION_BLOCKING`

No todas las incertidumbres justifican detener decisión.

---

# **53\. WHAT WOULD CHANGE OUR MIND**

Entidad:

**DECISION\_CHANGE\_TRIGGER**

Representa:

> condición observable que podría alterar la decisión.

Ejemplos:

* deadline cambia;  
* dependency satisfied;  
* new evidence;  
* risk event probability revised;  
* capacity freed;  
* objective changed;  
* value estimate materially updated.

---

# **54\. CHANGE TRIGGER STRUCTURE**

Campos:

* `trigger_id`;  
* `trigger_type`;  
* `condition`;  
* `affected_decision_refs[]`;  
* `expected_effect`;  
* `source_ref`;  
* `monitoring_required`;  
* `valid_until`.

---

# **55\. TRIGGER ≠ PREDICTION**

Un trigger dice:

> si ocurre X, reconsiderar.

No:

> X ocurrirá.

---

# **56\. REVIEW CONDITION**

Puede existir:

`review_required_when`.

Especialmente para:

* MONITOR;  
* DEFER;  
* BLOCKED;  
* VALIDATE.

---

# **57\. STALENESS**

P12 debe detectar si alguno de los inputs materiales ha quedado stale.

Resultado:

`DECISION_STALE`.

No se debe seguir presentando como current.

---

# **58\. DECISION TTL**

Puede existir:

`decision_valid_until`

solo cuando exista fundamento temporal.

No debe inventarse un TTL universal.

---

# **59\. FRESHNESS BY COMPONENT**

No todas las dimensiones envejecen igual.

Ejemplo:

* strategy puede durar meses;  
* capacity puede cambiar semanalmente;  
* paid media performance diariamente.

P12 puede consultar freshness upstream.

---

# **60\. DECISION DRIFT**

Entidad:

**DECISION\_DRIFT\_EVENT**

Debe detectar:

> resultados diferentes bajo inputs semánticamente equivalentes y mismas reglas.

---

# **61\. STRUCTURAL DRIFT**

Cambian:

* ranking;  
* state;  
* portfolio;  
* gate;

sin cambio material.

Debe investigarse.

---

# **62\. NARRATIVE DRIFT**

Cambia redacción pero no decisión.

Normalmente permitido.

---

# **63\. DRIFT CLASSIFICATION**

Estados:

`EXPECTED`

`EXPLAINED`

`UNEXPLAINED`

`MODEL_VARIANCE`

`POLICY_CHANGE`

`INPUT_CHANGE`

---

# **64\. OBSERVABILITY**

P12 debe emitir telemetry suficiente para panel admin.

Métricas mínimas:

* runs completed;  
* abstention rate;  
* validation failures;  
* stale decisions;  
* broken traces;  
* top reason codes;  
* unknown rate;  
* model disagreement;  
* ranking drift;  
* portfolio churn.

---

# **65\. DECISION LATENCY**

Debe medirse:

* run start;  
* run complete;  
* decision output complete.

Sirve para observabilidad.

No altera prioridad.

---

# **66\. TRACE LATENCY**

Puede medirse cuánto tarda cada bloque.

Útil para debugging.

---

# **67\. FAILURE LOCATION**

P12 debe poder indicar:

`failure_stage`

P0–P12.

No devolver simplemente:

> “No se pudo generar recomendación.”

---

# **68\. FAILURE TYPE**

Tipos:

`INPUT`

`VALIDATION`

`POLICY`

`RULE`

`MODEL`

`DATA_SOURCE`

`TRACE`

`CONSISTENCY`

`SYSTEM`

---

# **69\. USER-FACING ERROR**

La salida al usuario debe distinguir:

* no hay datos suficientes;  
* decisión bloqueada;  
* sistema falló;  
* conflicto requiere validación;  
* decision stale.

No usar mensaje genérico.

---

# **70\. ABSTENTION EXPLANATION**

Si el sistema se abstiene debe explicar:

* qué falta;  
* por qué es material;  
* qué decision afecta;  
* qué evidencia permitiría continuar.

Sin inventar la respuesta provisional.

---

# **71\. PARTIAL DECISION**

P12 debe soportar:

> conocemos parte de la decisión, pero no toda.

Ejemplo:

A claramente primero.

B y C unresolved.

Salida válida:

`PARTIAL`.

---

# **72\. WHY NOT B?**

Una buena explicación debe poder responder:

> por qué A está antes que B.

Necesita:

* pairwise refs;  
* dominance refs;  
* trade-offs;  
* blockers;  
* uncertainty.

---

# **73\. WHY NOT NOW?**

Para candidates diferidos:

P12 debe poder explicar:

* low time sensitivity;  
* resource contention;  
* dependency;  
* strategic mismatch;  
* insufficient evidence.

No usar:

> “porque tiene menor score.”

---

# **74\. WHY BLOCKED?**

Para BLOCKED:

explicar:

* blocker;  
* prerequisite;  
* constraint;  
* unlock condition.

Sin prescribir playbook.

---

# **75\. WHY STOP?**

Para STOP:

debe existir soporte especialmente fuerte.

P12 debe mostrar:

* invalid premise;  
* dominance;  
* strategic conflict;  
* negative economics;  
* expiry;  
* policy violation.

No utilizar lenguaje arbitrario.

---

# **76\. WHY VALIDATE?**

Debe explicar:

* incertidumbre;  
* decision at stake;  
* qué podría cambiar;  
* evidencia faltante.

No confundir validación con falta de capacidad.

---

# **77\. WHY MONITOR?**

Debe indicar:

* candidate no requiere intervención ahora;  
* trigger relevante;  
* variable a observar;  
* condición que modificaría priority.

---

# **78\. EXPLANATION PRIORITY**

La explicación debe enfocarse en factores decisionales materiales.

No listar todos los inputs.

---

# **79\. EXPLANATION MINIMALITY**

Evitar:

> “A es primero por 37 razones.”

Debe destacar razones necesarias para entender la decisión.

Audit package conserva el detalle completo.

---

# **80\. EXPLANATION FAITHFULNESS**

Hard rule:

> every material explanation claim must map to actual decision logic.

Esto debe evaluarse.

---

# **81\. CONTRASTIVE EXPLANATION**

P12 debe favorecer explicación contrastiva:

> “A antes que B porque…”

Es más útil que:

> “A es importante porque…”

---

# **82\. COUNTERFACTUAL EXPLANATION**

Debe poder decir:

> “Si X dejara de ser cierto, B podría superar a A.”

Esto mejora comprensión del sistema.

---

# **83\. USER OVERRIDE**

Si usuario autorizado decide diferente:

P12 debe distinguir:

**SYSTEM\_DECISION**

de

**HUMAN\_OVERRIDE\_DECISION**

---

# **84\. HUMAN OVERRIDE**

Entidad:

**DECISION\_OVERRIDE\_RECORD**

Campos:

* `override_id`;  
* `original_decision_ref`;  
* `new_decision`;  
* `authorized_by`;  
* `reason`;  
* `created_at`;  
* `valid_until`.

No borrar decisión original.

---

# **85\. DISAGREEMENT WITH SYSTEM**

El sistema debe permitir registrar:

> humano no está de acuerdo.

Eso no debe reescribir retroactivamente el engine.

---

# **86\. MANUAL VALIDATION**

Puede existir:

`review_status`

`NOT_REQUIRED`

`PENDING`

`APPROVED`

`REJECTED`

`OVERRIDDEN`

---

# **87\. APPROVAL ≠ MODEL CORRECTNESS**

Una aprobación humana significa:

> se autoriza el uso.

No demuestra que la inferencia sea objetivamente cierta.

---

# **88\. VERSIONADO DE OUTPUT**

P12 debe registrar:

* schema version;  
* policy version;  
* explanation template version;  
* model version;  
* localization version si afecta wording.

---

# **89\. LANGUAGE**

La salida puede generarse en varios idiomas.

Cambio de idioma no debe cambiar:

* decision;  
* state;  
* reason codes;  
* ranking;  
* portfolio.

---

# **90\. FORMAT**

Puede existir:

* UI;  
* API JSON;  
* PDF;  
* chat;  
* dashboard.

Todos deben consumir el mismo structured output.

---

# **91\. SINGLE SOURCE OF TRUTH**

La UI no debe recalcular priority.

El PDF no debe reinterpretarla.

El agente conversacional no debe rehacer ranking.

Todos consumen:

`PRIORITIZATION_DECISION_OUTPUT`.

---

# **92\. API OUTPUT**

El contrato de API debe poder devolver:

* structured result;  
* explanation;  
* validation;  
* warnings;  
* refs.

Pero P12 conceptual no obliga todavía a un formato JSON final de implementación.

---

# **93\. SECURITY / ACCESS**

Audit trail puede contener información sensible.

P12 debe permitir separar:

* user-visible explanation;  
* internal trace;  
* admin audit.

No todos los usuarios deben ver todas las fuentes.

---

# **94\. REDACTION**

Puede existir:

`redaction_policy_ref`.

Debe preservar la lógica aunque ciertas fuentes estén ocultas al usuario.

---

# **95\. EXPLANATION WITH REDACTED SOURCE**

Puede decir:

> decisión soportada por fuente interna restringida.

Sin revelar contenido no autorizado.

---

# **96\. AUDIT IMMUTABILITY**

Una vez finalizado el run:

audit package debe ser inmutable.

Nuevas decisiones generan nuevos packages.

---

# **97\. HASH / FINGERPRINT**

Puede incluir:

`audit_fingerprint`

para detectar alteraciones.

No es imprescindible definir aún tecnología criptográfica.

---

# **98\. VALIDATION ORDER**

Orden recomendado:

1. schema validation;  
2. input lineage validation;  
3. rule compliance;  
4. cross-block consistency;  
5. uncertainty validation;  
6. trace completeness;  
7. explanation fidelity;  
8. output validation.

---

# **99\. REJECTION CONDITIONS**

P12 debe rechazar output final cuando:

* ranking contradice hard gate;  
* missing critical lineage;  
* candidate inválido aparece activo;  
* narrative añade hechos inexistentes;  
* unknown convertido en certeza;  
* policy version desconocida;  
* cross-block contradiction material.

---

# **100\. WARNINGS**

No todo problema invalida.

Puede existir:

**DECISION\_WARNING**

Ejemplos:

`LIMITED_DATA`

`STALE_NON_CRITICAL_SOURCE`

`MODEL_DISAGREEMENT_NON_MATERIAL`

`RANGE_WIDE`

`STRATEGY_CONTEXT_PARTIAL`

---

# **101\. WARNING ≠ FAILURE**

Decision puede ser:

`VALID_WITH_LIMITATIONS`.

Debe mostrar las limitaciones.

---

# **102\. OUTPUT CONSISTENCY**

Todas las representaciones deben coincidir.

Si API dice:

A rank 1

y chat dice:

B es prioridad principal

eso es fallo.

---

# **103\. EXPLANATION REGENERATION**

La narrativa puede regenerarse.

El structured decision no debe cambiar.

---

# **104\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| structured rank A\#1, narrative A\#1 | válido |
| structured A\#1, narrative B\#1 | failure |
| explanation claim sin evidence | validation failure/warning según materialidad |
| candidate blocked pero output dice active | cross-block failure |
| UNKNOWN transformado en “bajo” | failure |
| same decision, different wording | permitido |
| trace incompleto material | review/fail |
| user override | conservar system decision |
| model disagreement material | review |
| model disagreement solo textual | no impacto |
| decision stale | no presentar como current |
| PARTIAL ranking | output partial permitido |
| abstention | explicación de por qué |
| STOP sin strong reason trace | validation failure |
| same inputs/rules | same structured output |
| different language | same structured output |

---

# **105\. EVALS IA**

### **Explanation faithfulness**

¿La explicación refleja realmente las reglas?

### **Unsupported claim eval**

¿Evita introducir razones nuevas?

### **Contrastive explanation eval**

¿Puede explicar A vs B?

### **Counterfactual explanation eval**

¿Puede decir qué cambiaría la decisión?

### **Uncertainty fidelity**

¿Mantiene unknowns visibles?

### **Cross-block consistency eval**

¿Detecta contradicciones?

### **Abstention explanation eval**

¿Explica correctamente por qué no puede decidir?

### **Narrative invariance eval**

¿Distintas redacciones mantienen la misma decisión?

### **Boundary eval**

¿Evita generar playbooks?

---

# **106\. EJEMPLO 1 — PRIORIDAD CON BLOQUEO**

P10:

A \= rank \#1, CRITICAL.

P11:

A \= BLOCKED.

B \= ACTIVE.

P12 debe explicar:

> A sigue siendo la prioridad empresarial principal, pero actualmente está bloqueada por dependency X. Mientras se resuelve, B puede avanzar porque no compite por el mismo recurso.

No debe decir:

> B es ahora la prioridad nº1.

---

# **107\. EJEMPLO 2 — MATERIAL TIE**

P10:

A y B \= EFFECTIVE\_TIE.

P11:

ambos compatibles.

P12:

> No existe diferencia material suficiente para justificar una precedencia fuerte. Ambos pueden permanecer activos.

No inventar:

> A es ligeramente mejor.

---

# **108\. EJEMPLO 3 — VALIDATE**

Candidate A:

incertidumbre crítica.

P10:

VALIDATE.

P12:

> La principal necesidad decisional es reducir la incertidumbre sobre X porque su resolución puede cambiar la prioridad entre A y B.

No debe afirmar:

> X es la causa.

---

# **109\. EJEMPLO 4 — STOP**

Proyecto actual:

P10:

STOP.

P12 debe poder mostrar:

* economics futuros;  
* alternative dominance;  
* strategic conflict;  
* ausencia de dependency justificante.

No:

> “porque el proyecto no funciona”.

---

# **110\. EJEMPLO 5 — DECISION SENSITIVE**

A rank \#1.

B rank \#2.

Pero una variable UNKNOWN podría invertir el orden.

P12:

`VALID_WITH_LIMITATIONS`

y explicación:

> A ocupa actualmente la primera posición, pero la decisión es sensible a X. Si X supera/cae bajo determinada condición, B debe reevaluarse.

---

# **111\. EJEMPLO 6 — HUMAN OVERRIDE**

Sistema:

A \#1.

Usuario autorizado:

elige B.

P12 guarda:

SYSTEM\_DECISION:

A \#1.

HUMAN\_OVERRIDE:

B activo.

Reason:

decisión ejecutiva.

Nunca reescribe A como si el engine hubiera elegido B.

---

# **112\. OUTPUT PARA UI**

La UI podría mostrar:

## **Prioridad principal**

Candidate A.

## **Por qué**

* high value at stake;  
* time-sensitive;  
* strong strategic fit.

## **Estado**

BLOCKED.

## **Mientras tanto**

B ACTIVE.

## **Qué cambiaría la decisión**

* dependency X satisfied;  
* value assumption Y revised;  
* risk threshold Z exceeded.

Todo derivado del mismo structured output.

---

# **113\. OUTPUT PARA ADMIN**

Admin puede ver:

* run id;  
* input fingerprint;  
* source lineage;  
* reason codes;  
* rule traces;  
* model inferences;  
* disagreements;  
* overrides;  
* validation warnings;  
* prior run comparison.

---

# **114\. OUTPUT PARA AGENTE IA**

El siguiente agente no debería recibir únicamente narrativa.

Debe recibir:

* structured priority states;  
* ranking;  
* portfolio states;  
* constraints;  
* change triggers;  
* validation state.

Esto reduce pérdida semántica entre agentes.

---

# **115\. CONTRATO CON FASE 5**

P12 será el boundary output de Fase 4\.

Fase 5 debe recibir:

**WHAT DESERVES ATTENTION**

* 

**WHY**

* 

**WHAT STATE IT IS IN**

* 

**WHAT CONSTRAINTS APPLY**

Pero no debería recalcular prioridad desde cero.

---

# **116\. FASE 5 INPUT HANDOFF**

Conceptualmente:

`PRIORITIZATION_DECISION_OUTPUT`

→

`STRATEGY_PLAYBOOK_CONTEXT`

Fase 5 podrá preguntar:

> dado que A es prioridad y tiene estas constraints/risk/conditions, ¿cómo lo resolvemos?

---

# **117\. P12 NO DEBE ADELANTAR FASE 5**

Queda prohibido incluir:

* steps;  
* tactics;  
* interventions;  
* experiment design;  
* implementation plan;  
* tool recommendations.

P12 explica decisión.

No la ejecuta.

---

# **118\. CONTRATO CON FASE 8**

En el futuro Fase 8 podrá consumir:

* active portfolio;  
* execution readiness;  
* constraints;  
* approved states.

Pero P12 no autoriza ejecución automática por sí mismo.

---

# **119\. CONTRATO CON FASE 9**

Fase 9 podrá relacionar:

DECISION

→ EXECUTION

→ OUTCOME

→ VALIDATION

→ LEARNING

P12 prepara la primera mitad de esa trazabilidad.

---

# **120\. DECISION RECORD FOR LEARNING**

Debe conservar:

* qué se sabía;  
* qué se asumió;  
* qué se decidió;  
* por qué;  
* qué incertidumbre existía.

Así Fase 9 podrá evaluar posteriormente:

> calidad de la decisión

sin hindsight bias.

---

# **121\. HINDSIGHT BIAS PROTECTION**

Una mala outcome no debe modificar retrospectivamente la decisión original.

Debe compararse:

**decision quality at time T**

vs

**outcome observed later**.

---

# **122\. OBSERVABILITY EVENTS**

P12 puede emitir eventos conceptuales:

`decision.created`

`decision.validated`

`decision.abstained`

`decision.invalidated`

`decision.stale`

`decision.overridden`

`decision.recalculation_required`

---

# **123\. RECOMPUTE SIGNAL**

P12 puede emitir:

`RECOMPUTE_REQUIRED`

cuando un trigger material se activa.

No recalcula por sí mismo.

Inicia nuevo run P0.

---

# **124\. CLOSED LOOP**

Arquitectura:

P12 output

↓

monitoring / external changes

↓

material trigger

↓

new P0 run

↓

P1–P12

Esto mantiene historial.

---

# **125\. DECISION VERSION CHAIN**

Debe poder existir:

Run 101

→ superseded by Run 118

→ superseded by Run 144\.

Sin borrar anteriores.

---

# **126\. REASON FOR SUPERSESSION**

Cada nueva decisión debería registrar:

* changed objective;  
* new evidence;  
* deadline change;  
* capacity change;  
* dependency resolved;  
* policy change;  
* other material trigger.

---

# **127\. DEFINITION OF DONE — P12**

P12 está completo cuando el sistema puede responder:

**WHAT DID WE DECIDE?**

Existe structured decision output.

**WHY THIS?**

Existe structured rationale.

**WHY NOW?**

Existen temporal reasons.

**WHY BEFORE THE OTHERS?**

Existen comparisons/dominance.

**WHY NOT SOMETHING ELSE?**

Existen contrastive reasons.

**WHAT IS BLOCKED?**

Existe estado y blocker trace.

**WHAT CAN RUN IN PARALLEL?**

Existe portfolio explanation.

**WHAT DON'T WE KNOW?**

Existe uncertainty summary.

**HOW CONFIDENT ARE WE IN THE DECISION?**

Existe decision confidence semántica.

**WHAT WOULD CHANGE OUR MIND?**

Existen decision change triggers.

**CAN WE RECONSTRUCT THE DECISION?**

Existe trace package.

**CAN WE AUDIT IT LATER?**

Existe immutable audit package.

**DID THE SYSTEM FOLLOW ITS OWN RULES?**

Existe validation result.

**DID THE NARRATIVE STAY FAITHFUL TO THE ENGINE?**

Existe explanation validation.

**CAN ANOTHER AGENT CONSUME THE RESULT WITHOUT REINTERPRETING IT?**

Existe structured handoff.

**CAN FUTURE LEARNING COMPARE DECISION AND OUTCOME?**

Existe historical decision record.

P12 no resuelve el problema del ecommerce.

Cierra correctamente la pregunta de Fase 4:

> **¿Qué merece atención primero, por qué, bajo qué condiciones y con qué trazabilidad?**

