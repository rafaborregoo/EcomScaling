# **P7 — RIESGO, REVERSIBILIDAD Y COSTE DEL ERROR**

## **0\. Propósito**

P7 define cómo debe representar el sistema el downside asociado a una decisión.

Su responsabilidad es responder:

> ¿Qué podemos perder si actuamos, si no actuamos o si decidimos incorrectamente?

P7 debe diferenciar:

* riesgo de actuar;  
* riesgo de no actuar;  
* severidad del daño;  
* probabilidad;  
* exposición;  
* reversibilidad;  
* blast radius;  
* recoverability;  
* coste del error;  
* irreversibilidad;  
* incertidumbre sobre el propio riesgo.

P7 NO responde:

* cuánto valor positivo existe → P4;  
* qué ocurre temporalmente al esperar → P3;  
* cuánto esfuerzo requiere → P6;  
* cuál es el expected value → P8;  
* cuál debe ser la prioridad final → P10;  
* qué acción concreta reduce el riesgo → Fase 5\.

---

# **1\. Principio fundamental**

Debe mantenerse:

**RISK**

≠

**IMPACT**

≠

**UNCERTAINTY**

≠

**PROBABILITY**

≠

**SEVERITY**

≠

**REVERSIBILITY**

≠

**COST OF ERROR**

Y especialmente:

**ACTION RISK**

≠

**INACTION RISK**

Un candidato puede tener:

* alto riesgo de actuar;  
* alto riesgo de no actuar;  
* ambos;  
* ninguno;  
* riesgo desconocido.

---

# **2\. Entidad principal**

Entidad:

**RISK\_ASSESSMENT**

Relación:

`PRIORITY_CANDIDATE`

→ `RISK_ASSESSMENT`

Cada evaluación pertenece a:

* candidate;  
* prioritization run;  
* decision context;  
* periodo;  
* snapshot de evidencia.

P7 será source of truth de la dimensión:

**DOWNSIDE / REVERSIBILITY / ERROR COST**

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `risk_assessment_id` | Sí | identidad |
| `candidate_id` | Sí | candidato |
| `prioritization_run_id` | Sí | ejecución |
| `assessment_state` | Sí | validez |
| `action_risk_refs[]` | Condicional | riesgos de intervenir |
| `inaction_risk_refs[]` | Condicional | riesgos de no intervenir |
| `decision_error_refs[]` | Opcional | riesgos de decidir mal |
| `reversibility_profile_ref` | Sí | reversibilidad |
| `blast_radius_ref` | Opcional | alcance |
| `unknown_risk_refs[]` | Opcional | riesgos desconocidos |
| `evidence_refs[]` | Sí | soporte |
| `assumption_refs[]` | Opcional | supuestos |
| `evaluated_at` | Sí | timestamp |
| `policy_version` | Sí | versión |

---

# **4\. RISK\_EVENT**

Unidad fundamental:

**RISK\_EVENT**

Representa:

> un resultado adverso posible y suficientemente concreto como para ser evaluado.

Ejemplos:

* caída adicional de conversion;  
* pérdida de margen;  
* interrupción operativa;  
* stockout;  
* customer churn;  
* pérdida de datos;  
* deterioro de marca;  
* incumplimiento contractual;  
* bloqueo estratégico.

---

# **5\. Estructura de RISK\_EVENT**

| Campo | Función |
| ----- | ----- |
| `risk_event_id` | identidad |
| `candidate_id` | candidato |
| `risk_direction` | action/inaction/error |
| `risk_type` | naturaleza |
| `event_definition` | qué puede ocurrir |
| `exposure_ref` | qué queda expuesto |
| `likelihood_estimate` | posibilidad |
| `consequence_profile` | magnitud |
| `reversibility_ref` | recuperabilidad |
| `blast_radius_ref` | alcance |
| `time_profile_ref` | temporalidad |
| `evidence_refs[]` | soporte |
| `epistemic_state` | naturaleza |
| `uncertainties[]` | desconocidos |

---

# **6\. RISK\_DIRECTION**

Valores:

`ACTION`

`INACTION`

`DECISION_ERROR`

`BOTH`

No debe deducirse uno a partir del otro.

---

# **7\. ACTION RISK**

Representa:

> downside introducido por intervenir.

Ejemplos:

* romper tracking al modificar checkout;  
* deteriorar CVR al cambiar pricing;  
* sobrecomprar inventario;  
* dañar entregabilidad con una estrategia agresiva;  
* crear deuda técnica.

---

# **8\. INACTION RISK**

Representa:

> downside derivado de mantener el estado actual o posponer intervención.

Ejemplos:

* pérdida continua de margen;  
* deterioro de cash;  
* churn acumulado;  
* pérdida de ventana;  
* crecimiento de backlog.

P3 puede aportar estructura temporal.

P7 evalúa el downside.

---

# **9\. ACTION RISK ≠ INACTION RISK**

Queda prohibido modelar:

`total_risk`

sin conservar ambas direcciones.

Porque pueden existir casos:

### **Caso A**

Action risk alto.

Inaction risk bajo.

### **Caso B**

Action risk bajo.

Inaction risk alto.

### **Caso C**

Ambos altos.

### **Caso D**

Ambos bajos.

Y cada situación requiere decisiones diferentes.

---

# **10\. DECISION ERROR RISK**

Entidad lógica:

**DECISION\_ERROR**

Representa:

> coste potencial de escoger incorrectamente entre alternativas o prioridades.

Ejemplos:

* atacar un síntoma y no la causa;  
* consumir capacidad crítica en candidato equivocado;  
* actuar sobre hipótesis falsa;  
* retrasar iniciativa dominante.

---

# **11\. FALSE POSITIVE COST**

Error tipo:

> creemos que candidate merece atención cuando realmente no.

Puede generar:

* recursos desperdiciados;  
* disruption;  
* opportunity cost;  
* daño operativo.

---

# **12\. FALSE NEGATIVE COST**

Error tipo:

> descartamos o diferimos algo que realmente era importante.

Puede generar:

* pérdida de value;  
* worsening;  
* missed window;  
* increased future cost.

P7 debe permitir distinguir ambos.

---

# **13\. LIKELIHOOD**

Debe mantenerse:

**LIKELIHOOD**

≠

**SEVERITY**

Un evento:

* muy probable y leve;  
* improbable y catastrófico;

no son equivalentes.

---

# **14\. PROBABILIDAD**

Cuando exista metodología válida:

`likelihood_probability`

puede utilizarse.

Pero queda prohibido inventar:

`probability = 0.37`

sin base.

Alternativas:

`OBSERVED_FREQUENCY`

`MODELLED_PROBABILITY`

`ESTIMATED_RANGE`

`ORDINAL_CLASS`

`UNKNOWN`

---

# **15\. LIKELIHOOD CLASS**

Si el sistema usa clases:

`RARE`

`POSSIBLE`

`LIKELY`

`VERY_LIKELY`

etc.

deben existir thresholds/configuración.

No pueden ser etiquetas subjetivas sin definición.

---

# **16\. CONSEQUENCE**

Entidad:

**CONSEQUENCE\_PROFILE**

Describe:

> qué ocurre si el risk event sucede.

Puede contener múltiples dominios:

* financial;  
* customer;  
* operational;  
* strategic;  
* compliance;  
* data;  
* reputation.

---

# **17\. CONSEQUENCE ≠ IMPACT P4**

P4 analiza:

> valor empresarial afectado por el candidato.

P7 analiza:

> downside bajo eventos adversos.

Puede existir solapamiento económico.

Pero no deben sumarse automáticamente.

---

# **18\. SEVERITY**

Cuando proceda puede declararse:

`LIMITED`

`MATERIAL`

`SEVERE`

`CRITICAL`

`CATASTROPHIC`

solo si existe policy que defina cada nivel.

UNKNOWN debe permanecer UNKNOWN.

---

# **19\. RISK MATRIX**

P7 puede utilizar internamente una matriz:

likelihood × consequence

como herramienta auxiliar.

Pero nunca debe convertirse en autoridad universal.

Un evento irreversible de baja frecuencia puede requerir tratamiento especial.

---

# **20\. EXPECTED LOSS**

Si existe probabilidad válida y consecuencia monetaria válida:

puede calcularse conceptualmente:

`expected_loss = probability × loss`

Pero P7 debe tratarlo como componente de riesgo.

El expected value global de la decisión sigue perteneciendo a P8.

---

# **21\. EXPECTED LOSS ≠ RISK COMPLETO**

Dos eventos pueden tener igual expected loss:

A:

50 % × €10k.

B:

1 % × €500k.

Expected loss \= €5k en ambos.

Pero el perfil decisional es radicalmente diferente.

Por eso P7 debe conservar distribución, downside y reversibilidad.

---

# **22\. REVERSIBILITY**

Entidad:

**REVERSIBILITY\_PROFILE**

Representa:

> hasta qué punto una decisión o consecuencia adversa puede deshacerse.

Estados:

`FULLY_REVERSIBLE`

`MOSTLY_REVERSIBLE`

`PARTIALLY_REVERSIBLE`

`DIFFICULT_TO_REVERSE`

`IRREVERSIBLE`

`UNKNOWN`

---

# **23\. REVERSIBILITY ≠ RECOVERABILITY**

Debe distinguirse:

**REVERSIBILITY**

> ¿podemos deshacer la decisión?

de

**RECOVERABILITY**

> ¿podemos recuperar el daño?

Ejemplo:

una campaña puede detenerse fácilmente.

Pero clientes perdidos quizá no puedan recuperarse.

---

# **24\. REVERSIBILITY DIMENSIONS**

Puede depender de:

* technical rollback;  
* financial recovery;  
* customer recovery;  
* contractual rollback;  
* operational recovery;  
* strategic reversibility.

No debe existir necesariamente una sola reversibilidad global.

---

# **25\. REVERSAL COST**

Puede existir:

`reversal_cost`.

Representa:

> coste necesario para volver al estado anterior o equivalente.

Puede ser:

* monetario;  
* temporal;  
* operativo;  
* reputacional.

---

# **26\. TIME TO RECOVER**

Puede existir:

`estimated_recovery_time`.

No pertenece a P3 porque no representa urgencia.

Representa:

> cuánto podría tardarse en recuperar el daño si ocurre.

---

# **27\. BLAST RADIUS**

Entidad:

**BLAST\_RADIUS**

Representa:

> alcance potencial de un error o evento adverso.

Puede afectar:

* una campaña;  
* canal;  
* producto;  
* cohort;  
* país;  
* sistema;  
* organización completa.

---

# **28\. BLAST\_RADIUS DIMENSIONS**

Campos posibles:

* affected\_scope\_refs\[\];  
* customer\_count\_range;  
* revenue\_exposure\_ref;  
* system\_count;  
* geography;  
* duration;  
* propagation\_potential.

No todos son obligatorios.

---

# **29\. BLAST RADIUS ≠ SEVERITY**

Un incidente puede tener:

* pequeño alcance pero enorme gravedad;  
* gran alcance pero impacto pequeño por unidad.

Deben mantenerse separados.

---

# **30\. CONTAINMENT**

Puede existir:

`containability`.

Estados:

`EASILY_CONTAINABLE`

`CONTAINABLE`

`DIFFICULT_TO_CONTAIN`

`UNCONTAINABLE`

`UNKNOWN`

Solo con reglas/evidencia.

---

# **31\. IRREVERSIBLE DECISION**

Una decisión irreversible merece tratamiento especial.

No significa:

> nunca debe hacerse.

Significa:

> el coste de error tiene una estructura distinta.

El motor debe exigir mayor evidencia cuando:

* downside material;  
* irreversibilidad alta;  
* confidence baja.

---

# **32\. REVERSIBILITY ASYMMETRY**

Puede existir:

acción reversible

pero consecuencias parcialmente irreversibles.

Ejemplo:

bajar precio puede revertirse.

Pero clientes condicionados a descuentos o erosión de posicionamiento pueden persistir.

El contrato debe permitir representarlo.

---

# **33\. RISK EXPOSURE**

Debe distinguirse:

**EXPOSURE**

≠

**LOSS**

Ejemplo:

€2M de revenue dependen de plataforma X.

No significa:

riesgo \= €2M.

Es el máximo valor potencialmente expuesto.

---

# **34\. MAXIMUM PLAUSIBLE LOSS**

Puede existir:

`maximum_plausible_loss`

cuando sea defendible.

No significa worst imaginable case.

Debe ser un escenario razonablemente soportado.

---

# **35\. TAIL RISK**

P7 debe permitir registrar:

`TAIL_RISK`

para eventos:

* baja frecuencia;  
* consecuencia extrema.

No deben desaparecer porque su expected loss promedio sea pequeño.

---

# **36\. CATASTROPHIC GATE**

Determinados riesgos pueden activar reglas no compensatorias.

Ejemplo conceptual:

evento:

* irreversible;  
* severidad catastrófica;  
* controles insuficientes.

P7 puede emitir:

`RISK_GATE_REVIEW_REQUIRED`.

P0/P10 decidirán la precedencia.

---

# **37\. RISK TOLERANCE**

P7 podrá consumir:

`risk_tolerance_ref`

del Decision Context o política empresarial.

No debe inventar apetito de riesgo.

---

# **38\. RISK TOLERANCE ≠ OBJECTIVE**

Objetivo:

> crecer internacionalmente.

Risk tolerance:

> no aceptar más de X exposición de cash.

Conceptos diferentes.

---

# **39\. RISK APPETITE**

Si el negocio tiene configuración explícita puede distinguirse:

`risk_appetite`

de

`risk_limit`.

Pero no es obligatorio introducir ambas entidades si no existe uso real.

Evitar sobreingeniería.

---

# **40\. UNCERTAINTY ABOUT RISK**

Debe existir:

**RISK\_UNCERTAINTY**

Porque:

> no saber el riesgo

no equivale a:

> riesgo bajo.

Estados:

`WELL_CHARACTERIZED`

`PARTIALLY_CHARACTERIZED`

`POORLY_CHARACTERIZED`

`UNKNOWN`

---

# **41\. UNKNOWN UNKNOWN**

No podemos representar literalmente todos los unknown unknowns.

Pero P7 puede registrar:

`risk_discovery_gap`

cuando:

* sistema poco conocido;  
* intervención novedosa;  
* evidence limitada;  
* alta complejidad.

No debe convertirse en una penalización automática.

---

# **42\. NOVELTY**

Una intervención asociada posteriormente puede ser novedosa.

P7 en Fase 4 puede registrar:

`evidence_novelty`.

Pero no definir todavía la acción.

Ejemplo:

candidate depende de una decisión para la que no existe experiencia previa.

---

# **43\. EVIDENCE QUALITY**

Risk assessment debe enlazar:

* incidents históricos;  
* experimentos;  
* datos;  
* documentación;  
* reglas;  
* inferencias.

No basta con:

> podría pasar algo malo.

---

# **44\. RISK CAUSALITY**

Todo risk event debe indicar cómo se relaciona con:

* acción;  
* inacción;  
* error.

No debe introducirse riesgo únicamente por asociación vaga.

---

# **45\. RISK PATH**

Puede existir:

**RISK\_PATH**

Ejemplo:

acción

↓

tracking roto

↓

optimización ciega

↓

spend ineficiente

↓

margin loss

Sirve para trazabilidad.

No necesita ser obligatorio en riesgos triviales.

---

# **46\. FIRST-ORDER VS SECOND-ORDER RISK**

Tipos:

`FIRST_ORDER`

`SECOND_ORDER`

`SYSTEMIC`

Ejemplo:

first order:

caída de CVR.

second order:

algoritmo aprende señales erróneas.

systemic:

varios sistemas downstream se deterioran.

---

# **47\. RISK DEPENDENCIES**

Un riesgo puede depender de:

* constraint;  
* resource;  
* timing;  
* external event;  
* other risk.

P7 puede referenciarlos.

No duplicarlos.

---

# **48\. RISK MITIGATION**

P7 NO debe diseñar mitigaciones concretas.

Puede declarar:

`mitigability_state`:

`HIGHLY_MITIGABLE`

`MITIGABLE`

`LIMITED_MITIGATION`

`NON_MITIGABLE`

`UNKNOWN`

Pero:

> cómo mitigarlo

pertenece a Fase 5\.

---

# **49\. SAFEGUARD AVAILABILITY**

Puede existir:

`safeguard_ref`

si ya existe un control conocido.

Ejemplo:

rollback automático.

P7 puede considerar que reduce downside.

No diseña el safeguard.

---

# **50\. ROLLBACK**

Si existe mecanismo real de rollback:

* disponibilidad;  
* tiempo;  
* coste;  
* cobertura;  
* condiciones.

Debe referenciarse.

No asumir rollback por defecto.

---

# **51\. TESTABILITY AND RISK**

La posibilidad de probar algo en scope reducido puede afectar blast radius/reversibility.

Pero P7 solo debe registrar:

> existe mecanismo de limitación del exposure.

La estrategia experimental concreta pertenece a Fase 5\.

---

# **52\. ACTION RISK PROFILE**

Puede sintetizar:

`LOW_DOWNSIDE`

`MANAGEABLE_DOWNSIDE`

`MATERIAL_DOWNSIDE`

`HIGH_DOWNSIDE`

`CRITICAL_DOWNSIDE`

`UNKNOWN`

solo con policy explícita.

---

# **53\. INACTION RISK PROFILE**

Debe tener representación separada.

Nunca reutilizar la misma variable para ambas.

---

# **54\. ASYMMETRIC RISK**

Puede existir:

**UPSIDE / DOWNSIDE ASYMMETRY**

Ejemplo:

acción:

downside máximo pequeño/reversible.

upside significativo.

O al contrario.

P7 registra downside.

P8 integrará economics.

---

# **55\. RISK DOMINANCE**

Un candidato puede contener un risk event que domine decisionalmente.

Ejemplo:

pérdida irreversible y catastrófica.

P7 puede emitir:

`dominant_risk_flag`.

Pero no altera ranking directamente sin policy.

---

# **56\. RISK AGGREGATION**

Múltiples risk events no deben sumarse ingenuamente.

Pueden estar:

* independientes;  
* correlacionados;  
* mutuamente exclusivos;  
* condicionados.

---

# **57\. RISK RELATIONSHIP**

Entidad:

**RISK\_RELATIONSHIP**

Tipos:

`INDEPENDENT`

`CORRELATED`

`CONDITIONAL`

`MUTUALLY_EXCLUSIVE`

`CASCADE`

`UNKNOWN`

---

# **58\. CORRELATED RISKS**

Ejemplo:

margin erosion

y

cash deterioration

pueden proceder del mismo evento.

No deben tratarse como dos pérdidas independientes si comparten causalidad/value pool.

---

# **59\. SHARED DOWNSIDE POOL**

Puede utilizarse concepto similar a P4:

**SHARED\_DOWNSIDE\_POOL**

para evitar double counting.

---

# **60\. NO SIMPLE TOTAL\_RISK**

Queda prohibido usar como source of truth:

`risk_score = 78`

derivado de sumar:

* likelihood;  
* severity;  
* reversibility;  
* blast radius.

La síntesis puede existir como herramienta secundaria.

La estructura completa debe conservarse.

---

# **61\. RISK STATE**

Resultado semántico:

`ACCEPTABLE_WITHIN_POLICY`

`ACCEPTABLE_WITH_CONTROLS`

`REQUIRES_VALIDATION`

`EXCEEDS_POLICY`

`UNACCEPTABLE`

`UNKNOWN`

Solo si existe risk policy explícita.

---

# **62\. RISK WITHOUT POLICY**

Si no existe política empresarial de tolerancia:

P7 puede describir riesgo.

Pero no afirmar:

> riesgo aceptable.

Resultado:

`RISK_CHARACTERIZED`

pero acceptance:

`UNKNOWN`.

---

# **63\. ERROR COST**

Entidad:

**ERROR\_COST**

Puede representar:

* recursos desperdiciados;  
* lost opportunity;  
* irreversible damage;  
* rework;  
* delay;  
* lost learning;  
* strategic setback.

---

# **64\. ERROR COST ≠ IMPLEMENTATION COST**

Implementation cost:

lo que cuesta actuar correctamente.

Error cost:

lo que cuesta haber elegido o ejecutado mal la decisión.

Conceptos diferentes.

---

# **65\. ERROR RECOVERY**

Puede declararse:

`error_recovery_state`:

`EASY`

`MANAGEABLE`

`DIFFICULT`

`VERY_DIFFICULT`

`IMPOSSIBLE`

`UNKNOWN`

solo con policy.

Preferir datos específicos cuando existan.

---

# **66\. LEARNING VALUE INTERFACE**

Una decisión reversible y con error barato puede ser adecuada para experimentar.

Pero P7 no recomendará experimentar.

Solo proporciona:

* reversibility;  
* error cost;  
* exposure.

Fase 5/P8 podrán utilizarlo.

---

# **67\. RISK TEMPORALITY**

P3 puede aportar:

* deterioro;  
* deadline;  
* cost of delay.

P7 puede convertir esos mecanismos en:

`inaction risk events`.

Pero no debe duplicar temporalidad.

---

# **68\. RISK AND CONSTRAINTS**

P5 puede identificar:

> violar constraint X.

P7 evalúa:

> qué downside genera violarlo.

Un hard constraint puede seguir siendo no compensatorio aunque risk estimate parezca bajo.

---

# **69\. RISK AND RESOURCES**

P6 puede revelar:

* capability gaps;  
* overcommitment;  
* insufficient resource.

P7 puede interpretar:

> qué riesgo aumenta por operar bajo esas condiciones.

P7 no duplica capacidad.

---

# **70\. OUTPUT P7**

Contrato:

**RISK\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `assessment_state` | validez |
| `action_risk_refs[]` | downside de actuar |
| `inaction_risk_refs[]` | downside de no actuar |
| `decision_error_refs[]` | coste de equivocarse |
| `reversibility_profile_ref` | reversibilidad |
| `recoverability_profile_ref` | recuperación |
| `blast_radius_ref` | alcance |
| `tail_risk_refs[]` | riesgos extremos |
| `shared_downside_pool_refs[]` | overlaps |
| `risk_acceptance_state` | si existe policy |
| `unknowns[]` | incertidumbres |
| `warnings[]` | limitaciones |
| `evidence_refs[]` | soporte |
| `rule_trace_refs[]` | trazabilidad |

---

# **71\. ASSESSMENT\_STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT_INFORMATION`

`STALE`

`NOT_APPLICABLE`

`INVALID`

---

# **72\. REASON CODES**

Familias:

`RISK.*`

`REVERSIBILITY.*`

`ERROR.*`

Ejemplos:

`RISK.ACTION_MATERIAL`

`RISK.INACTION_MATERIAL`

`RISK.TAIL_EVENT`

`RISK.UNKNOWN`

`RISK.EXCEEDS_POLICY`

`RISK.SHARED_DOWNSIDE`

`REVERSIBILITY.FULL`

`REVERSIBILITY.PARTIAL`

`REVERSIBILITY.IRREVERSIBLE`

`REVERSIBILITY.UNKNOWN`

`ERROR.FALSE_POSITIVE_COST`

`ERROR.FALSE_NEGATIVE_COST`

`ERROR.RECOVERY_DIFFICULT`

---

# **73\. INVARIANTES P7**

1. Action risk no equivale a inaction risk.  
2. Probability no equivale a severity.  
3. Severity no equivale a blast radius.  
4. Reversibility no equivale a recoverability.  
5. Exposure no equivale a expected loss.  
6. Expected loss no representa todo el riesgo.  
7. Un low-probability catastrophic event no desaparece por promedio.  
8. UNKNOWN risk no equivale a low risk.  
9. Un score de riesgo no puede sustituir la estructura.  
10. Riesgos correlacionados no se suman como independientes.  
11. Risk acceptance requiere policy.  
12. Irreversibilidad no implica rechazo automático.  
13. Reversibilidad no implica seguridad automática.  
14. P7 no calcula expected value global.  
15. P7 no prescribe mitigaciones.  
16. P7 no redefine constraints.  
17. P7 conserva evidencia y epistemic state.  
18. Un risk gate no puede ser neutralizado por high impact salvo policy explícita compatible con P0.

---

# **74\. PRECONDICIONES**

P7 necesita:

* candidate válido P2;  
* context P1;  
* temporal refs cuando procedan;  
* constraints/dependencies relevantes;  
* feasibility/resource context;  
* risk evidence disponible.

Puede completar con UNKNOWN cuando la evidencia sea insuficiente.

---

# **75\. POSTCONDICIONES**

P7 termina correctamente cuando el sistema puede responder:

* qué podemos perder actuando;  
* qué podemos perder no actuando;  
* qué errores decisionales importan;  
* qué eventos adversos existen;  
* qué probabilidad conocemos;  
* qué severidad tienen;  
* qué blast radius existe;  
* qué puede revertirse;  
* qué daño puede recuperarse;  
* qué tail risks existen;  
* qué permanece desconocido.

---

# **76\. FAILURE MODES**

## **Risk-as-score**

Todo se reduce a 74/100.

**Prevención:** eventos estructurados.

---

## **Inaction blindness**

Solo se analiza riesgo de cambiar.

**Consecuencia:** status quo parece artificialmente seguro.

---

## **Action blindness**

Solo se analiza coste de esperar.

**Consecuencia:** cualquier problema urgente parece justificar cualquier intervención.

---

## **Probability hallucination**

La IA inventa 35 % de probabilidad.

**Prevención:** likelihood basis.

---

## **Expected-loss blindness**

Dos riesgos con misma media se tratan igual.

**Prevención:** tail risk \+ severity \+ reversibility.

---

## **Reversibility collapse**

“Podemos revertir” se interpreta como “no hay riesgo”.

**Prevención:** recoverability separada.

---

## **Double counting**

Dos consecuencias del mismo evento se suman dos veces.

**Prevención:** shared downside pool.

---

## **Mitigation leakage**

“Para reducir el riesgo debemos hacer X.”

**Prevención:** Fase 5\.

---

# **77\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| action risk alto, inaction bajo | ambos separados |
| action bajo, inaction alto | ambos separados |
| risk UNKNOWN | no LOW |
| probability sin evidencia | rechazo/UNKNOWN |
| 1% × €500k | conservar tail profile |
| reversible action, irreversible customer loss | perfiles separados |
| high blast radius, low severity | no colapsar conceptos |
| low blast radius, catastrophic consequence | preservar |
| correlated risk events | no suma independiente |
| risk tolerance inexistente | no declarar acceptable |
| hard policy exceeded | state correspondiente |
| rollback documentado | reversibility puede mejorar |
| rollback supuesto | no aceptar |
| same inputs | mismo resultado determinista |
| mitigation propuesta por IA | no guardar como risk assessment |

---

# **78\. EVALS IA**

### **Action/inaction separation**

¿Evalúa ambos lados?

### **Probability discipline**

¿Evita inventar probabilidades?

### **Tail-risk eval**

¿Reconoce riesgos extremos aunque su media sea baja?

### **Reversibility eval**

¿Distingue reversibility de recoverability?

### **Blast-radius eval**

¿Separa alcance y gravedad?

### **Unknown preservation**

¿Evita convertir incertidumbre en baja exposición?

### **Risk-policy adherence**

¿Solo declara aceptabilidad cuando existe policy?

### **Boundary eval**

¿Evita proponer mitigación/playbook?

---

# **79\. EJEMPLO 1 — CAMBIO DE CHECKOUT**

Candidate:

> deterioro de conversion checkout.

Action risk:

una modificación profunda podría empeorar conversión.

Inaction risk:

continuar perdiendo pedidos.

Reversibility:

si existe rollback técnico:

posiblemente alta.

Recoverability:

las ventas perdidas durante un error no son necesariamente recuperables.

P7 conserva las cuatro dimensiones.

---

# **80\. EJEMPLO 2 — INCREMENTAR PAID SPEND**

Candidate:

> oportunidad de escalar adquisición rentable.

Action risk:

* CAC deterioration;  
* cash consumption;  
* inventory pressure.

Inaction risk:

* opportunity window perdida.

P7 NO decide si escalar.

---

# **81\. EJEMPLO 3 — STOCK**

Candidate:

> sobrestock severo.

Action risk de ciertas decisiones futuras todavía no corresponde definirlo sin estrategia.

Pero inaction risk puede incluir:

* cash trapped;  
* obsolescence;  
* storage costs.

P3 describe cómo empeoran con tiempo.

P7 describe downside.

---

# **82\. EJEMPLO 4 — DECISIÓN IRREVERSIBLE**

Candidate:

> expansión estructural hacia un nuevo mercado.

Posible:

* high capital exposure;  
* contractual commitments;  
* low reversibility.

Aunque P4 muestre alto upside:

P7 debe preservar downside independiente.

P8 integrará ambos.

---

# **83\. INTERFAZ CON P8**

P7 entrega:

**DOWNSIDE STRUCTURE**

P8 podrá utilizar:

* probabilities válidas;  
* expected loss;  
* tail risk;  
* reversibility;  
* error cost;

para construir expected value y opportunity cost.

P8 no debe reconstruir riesgos desde narrativa.

---

# **84\. INTERFAZ CON P10**

P10 puede considerar P7.

Pero no mediante:

`priority = impact - risk`.

Porque:

* riesgos pueden ser no lineales;  
* algunos son gates;  
* algunos son tail risks;  
* inaction risk puede aumentar prioridad;  
* action risk puede reducir executability;  
* reversibility modifica coste del error.

---

# **85\. DEFINITION OF DONE — P7**

P7 está completo cuando el sistema puede responder:

**WHAT CAN GO WRONG IF WE ACT?**

Existe action risk.

**WHAT CAN GO WRONG IF WE DON'T?**

Existe inaction risk.

**HOW LIKELY IS IT?**

Existe likelihood o UNKNOWN.

**HOW BAD WOULD IT BE?**

Existe consequence profile.

**HOW FAR COULD IT SPREAD?**

Existe blast radius.

**CAN WE UNDO THE DECISION?**

Existe reversibility.

**CAN WE RECOVER THE DAMAGE?**

Existe recoverability.

**WHAT IF WE CHOOSE THE WRONG PRIORITY?**

Existe decision error cost.

**ARE THERE TAIL RISKS?**

Se preservan.

**DO WE KNOW ENOUGH ABOUT THE RISK?**

Existe epistemic state.

P7 no responde:

> ¿merece la pena asumir ese riesgo?

Responde:

> **¿qué downside estamos aceptando al actuar, al esperar o al equivocarnos?**

