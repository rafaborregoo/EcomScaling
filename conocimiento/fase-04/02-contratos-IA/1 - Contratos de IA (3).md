# **P3 — URGENCIA Y TIME SENSITIVITY**

## **0\. Propósito**

P3 define cómo debe representar el sistema la dimensión temporal de cada candidato.

Su responsabilidad es responder:

> ¿Qué cambia si esperamos?

P3 NO responde:

* cuánto valor económico tiene el candidato;  
* cuánto esfuerzo requiere;  
* cuánto riesgo tiene actuar;  
* qué dependencia existe;  
* si merece el puesto nº1;  
* qué acción concreta debe realizarse.

P3 determina únicamente:

> cómo evoluciona la relevancia decisional de un candidato en función del tiempo.

---

# **1\. Principio fundamental**

Urgencia no es una propiedad emocional.

No significa:

* parece importante;  
* está funcionando mal;  
* dirección está preocupada;  
* tiene mucho impacto;  
* es un problema grave.

Urgencia significa:

> el coste, riesgo, posibilidad o valor asociado a una decisión cambia materialmente por esperar.

Por tanto:

**IMPORTANCE**

≠

**URGENCY**

---

# **2\. Entidad principal**

La entidad será:

**TIME\_SENSITIVITY\_ASSESSMENT**

Cada `PRIORITY_CANDIDATE` podrá tener como máximo una evaluación vigente de time sensitivity dentro de una ejecución concreta.

Relación:

`PRIORITY_CANDIDATE`

→ `TIME_SENSITIVITY_ASSESSMENT`

P3 será source of truth de la dimensión temporal de Fase 4\.

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `time_sensitivity_id` | Sí | identidad |
| `candidate_id` | Sí | candidato |
| `prioritization_run_id` | Sí | ejecución |
| `assessment_state` | Sí | validez |
| `time_sensitivity_type[]` | Sí | mecanismos temporales |
| `reference_time` | Sí | instante desde el que se evalúa |
| `effective_window` | Opcional | ventana relevante |
| `deadline_ref` | Opcional | deadline |
| `delay_effects[]` | Opcional | consecuencias de esperar |
| `temporal_evidence_refs[]` | Sí | soporte |
| `epistemic_state` | Sí | naturaleza de evidencia |
| `uncertainties[]` | Opcional | incertidumbres |
| `evaluated_at` | Sí | timestamp |
| `policy_version` | Sí | versión de reglas |

---

# **4\. TIME\_SENSITIVITY\_TYPE**

Un candidato puede tener uno o varios mecanismos temporales.

Taxonomía inicial:

`FIXED_DEADLINE`

Existe fecha límite objetiva.

`EXPIRING_WINDOW`

Existe oportunidad o condición que desaparecerá.

`DETERIORATING`

La situación empeora con el tiempo.

`COMPOUNDING`

El daño o pérdida se acumula progresivamente.

`ACCELERATING`

La velocidad de deterioro aumenta.

`DEPENDENT_WINDOW`

La oportunidad depende temporalmente de otra condición.

`SEASONAL`

La relevancia depende de un ciclo temporal.

`EVENT_DRIVEN`

Existe un evento futuro que cambia la decisión.

`RECOVERABLE_DELAY`

Esperar genera coste, pero este puede recuperarse.

`IRREVERSIBLE_DELAY`

Esperar puede generar pérdida no recuperable.

`LOW_TIME_SENSITIVITY`

El paso del tiempo tiene poca relevancia material.

`UNKNOWN`

No puede determinarse.

No deben utilizarse como simples etiquetas decorativas.

Cada tipo debe estar respaldado por evidencia o regla.

---

# **5\. URGENCY\_STATE**

P3 puede producir un estado semántico final:

`IMMEDIATE`

`TIME_CRITICAL`

`TIME_SENSITIVE`

`DELAY_TOLERANT`

`NOT_TIME_SENSITIVE`

`UNKNOWN`

Estos estados NO deben derivarse de una escala arbitraria.

Deben resultar de reglas temporales.

---

# **6\. NO ESCALA ARBITRARIA 1–10**

Queda prohibido utilizar como source of truth:

`urgency_score = 8.7`

si no existe una metodología explícita que produzca ese número.

P3 puede utilizar categorías, rangos o funciones temporales cuando exista evidencia suficiente.

No fabricará precisión.

---

# **7\. DEADLINE**

Entidad:

**DEADLINE**

Campos:

* `deadline_id`;  
* `candidate_id`;  
* `deadline_at`;  
* `deadline_type`;  
* `source_ref`;  
* `certainty`;  
* `consequence_if_missed`.

`deadline_type`:

`LEGAL`

`CONTRACTUAL`

`OPERATIONAL`

`COMMERCIAL`

`CAMPAIGN`

`INVENTORY`

`FINANCIAL`

`STRATEGIC`

`EXTERNAL_EVENT`

`OTHER`

La categoría describe origen.

No prioridad.

---

# **8\. DEADLINE ≠ URGENCIA**

La existencia de un deadline no implica automáticamente:

`IMMEDIATE`.

Ejemplo:

deadline dentro de 9 meses.

Puede existir alta importancia pero baja urgencia actual.

Por tanto P3 debe evaluar:

* tiempo restante;  
* tiempo mínimo necesario de preparación;  
* irreversibilidad;  
* consecuencias;  
* posibilidad de retraso.

---

# **9\. TIME TO DEADLINE**

Podrá calcularse determinísticamente:

`time_to_deadline`

a partir de:

`deadline_at - reference_time`.

Pero este valor no representa por sí solo urgencia.

Debe compararse posteriormente con:

* tiempo de preparación;  
* ventana de actuación;  
* aceleración de consecuencias;  
* capacidad disponible.

La capacidad pertenece principalmente a P6.

P3 solo debe poder referenciarla cuando sea necesaria para interpretar temporalidad.

---

# **10\. EFFECTIVE WINDOW**

Entidad:

**TIME\_WINDOW**

Campos:

* `window_start`;  
* `window_end`;  
* `window_type`;  
* `certainty`;  
* `source_refs[]`.

Tipos:

`ACTION_WINDOW`

`OPPORTUNITY_WINDOW`

`RECOVERY_WINDOW`

`SEASONAL_WINDOW`

`VALIDATION_WINDOW`

`DECISION_WINDOW`

Ejemplo:

> una mejora debe estar desplegada antes del Black Friday para capturar valor.

P3 registra la ventana.

No prescribe la mejora.

---

# **11\. WINDOW ≠ DECISION HORIZON**

Debe mantenerse:

**DECISION\_HORIZON P1**

≠

**ACTION/OPPORTUNITY WINDOW P3**

P1 responde:

> durante qué periodo estamos tomando decisiones.

P3 responde:

> durante qué periodo este candidato mantiene una determinada condición temporal.

---

# **12\. DELAY\_EFFECT**

Entidad:

**DELAY\_EFFECT**

Representa:

> una consecuencia material provocada por esperar.

Campos:

| Campo | Función |
| ----- | ----- |
| `delay_effect_id` | identidad |
| `candidate_id` | candidato |
| `effect_type` | naturaleza |
| `affected_metric_ref` | si existe |
| `affected_state_ref` | si existe |
| `direction` | empeora/mejora/desaparece |
| `time_relationship` | relación temporal |
| `reversibility` | recuperabilidad |
| `evidence_refs[]` | soporte |
| `epistemic_state` | certeza |

---

# **13\. DELAY\_EFFECT\_TYPE**

Tipos iniciales:

`VALUE_LOSS`

`REVENUE_LEAKAGE`

`MARGIN_EROSION`

`CASH_DRAIN`

`RISK_INCREASE`

`CUSTOMER_DAMAGE`

`INVENTORY_DAMAGE`

`CAPACITY_CONSUMPTION`

`STRATEGIC_OPTION_LOSS`

`RECOVERY_COST_INCREASE`

`COMPLIANCE_EXPOSURE`

`DEPENDENCY_DELAY`

`LEARNING_DELAY`

`OTHER`

La taxonomía debe mantenerse conceptual.

No debe convertirse en un catálogo infinito de ecommerce.

---

# **14\. TIME RELATIONSHIP**

Cuando exista evidencia suficiente, P3 puede describir cómo cambia una consecuencia con el tiempo.

Estados:

`CONSTANT`

`LINEAR_APPROXIMATION`

`STEP_CHANGE`

`ACCELERATING`

`DECELERATING`

`THRESHOLD_BASED`

`EVENT_TRIGGERED`

`UNKNOWN`

No debe asumirse linealidad por defecto.

---

# **15\. COST OF DELAY**

P3 puede exponer:

**COST\_OF\_DELAY**

pero no debe confundirlo con expected value completo.

Cost of delay significa:

> pérdida o deterioro atribuible específicamente a esperar.

Puede ser:

* monetario;  
* operativo;  
* estratégico;  
* reputacional;  
* informacional.

Si existe cuantificación defendible:

`estimated_cost_of_delay`

puede almacenarse como:

* valor;  
* rango;  
* función;  
* categoría.

Si no existe:

`UNKNOWN`.

---

# **16\. COST OF DELAY ≠ IMPACT**

Distinción fundamental:

Un candidato puede tener:

alto impacto total

pero bajo cost of delay.

Ejemplo:

una migración tecnológica importante que puede hacerse dentro de seis meses sin pérdida material.

Otro candidato puede tener:

impacto moderado

pero enorme cost of delay.

Ejemplo:

un error de pricing activo que pierde margen cada día.

P4 evaluará impacto.

P3 evalúa sensibilidad temporal.

---

# **17\. COST OF DELAY ≠ INACTION RISK**

P3 puede describir consecuencias temporales.

Pero el análisis completo de:

`ACTION_RISK`

vs

`INACTION_RISK`

pertenece a P7.

P3 solo debe proporcionar la estructura temporal necesaria para que P7 la consuma.

---

# **18\. DELAY INTERVALS**

Para evitar falsa precisión, P3 puede evaluar escenarios por intervalos.

Ejemplo:

`DELAY_24H`

`DELAY_7D`

`DELAY_30D`

`DELAY_TO_WINDOW_END`

Pero dichos intervalos deben derivarse del contexto.

No deben ser universales.

---

# **19\. DELAY\_SCENARIO**

Entidad:

**DELAY\_SCENARIO**

Campos:

* `scenario_id`;  
* `candidate_id`;  
* `delay_duration`;  
* `expected_effects[]`;  
* `assumptions[]`;  
* `evidence_refs[]`;  
* `uncertainties[]`.

Sirve para responder:

> ¿qué cambia si no hacemos nada durante X?

P3 no decide todavía si debemos actuar.

---

# **20\. DETERIORATION**

Un candidato es `DETERIORATING` cuando existe evidencia de que la condición empeora con el paso del tiempo.

Debe distinguirse:

`CURRENT_SEVERITY`

de

`DETERIORATION_RATE`.

Ejemplo:

una incidencia puede ser actualmente moderada pero estar deteriorándose rápidamente.

Otra puede ser grave pero estable.

Estas dos situaciones no son equivalentes.

---

# **21\. VELOCIDAD DE DETERIORO**

Cuando pueda calcularse:

`deterioration_rate`

debe derivarse de datos observados.

Puede expresarse como:

* valor por unidad de tiempo;  
* rango;  
* tendencia;  
* categoría.

Nunca como cifra inventada.

Estados semánticos posibles:

`STABLE`

`SLOW`

`MATERIAL`

`FAST`

`ACCELERATING`

`UNKNOWN`

solo cuando exista política que defina esos términos.

---

# **22\. COMPOUNDING**

Un candidato es `COMPOUNDING` cuando:

> las consecuencias de esperar generan nuevas consecuencias que aumentan el problema acumulado.

Ejemplos conceptuales:

* acumulación de stock no vendido;  
* deterioro progresivo de caja;  
* deuda técnica que bloquea más operaciones;  
* aprendizaje retrasado que retrasa decisiones posteriores.

Compounding no significa automáticamente máxima prioridad.

Es una propiedad temporal que P10 utilizará posteriormente.

---

# **23\. ACCELERATING**

Debe distinguirse:

`COMPOUNDING`

de

`ACCELERATING`.

Compounding:

el daño se acumula.

Accelerating:

la tasa de daño aumenta.

P3 deberá preservar ambas propiedades.

---

# **24\. EXPIRING OPPORTUNITY**

P3 debe permitir time sensitivity positiva.

No todo lo urgente es un problema.

Ejemplo:

* ventana de adquisición barata;  
* temporada comercial;  
* disponibilidad temporal de inventario;  
* oportunidad contractual;  
* ventana estratégica.

Entidad:

`OPPORTUNITY_WINDOW`

con:

* inicio;  
* final;  
* valor condicionado temporalmente;  
* evidencia;  
* recoverability.

---

# **25\. OPTION EXPIRY**

Algunas oportunidades no desaparecen completamente.

Pueden degradarse.

P3 deberá distinguir:

`EXPIRES`

`DEGRADES`

`POSTPONABLE`

`RECURRING`

`UNKNOWN`

Esto evita presentar cualquier ventana como:

> ahora o nunca.

---

# **26\. SEASONALITY**

P3 podrá referenciar estacionalidad cuando sea material.

Campos:

* `seasonality_ref`;  
* `cycle_type`;  
* `current_phase`;  
* `next_transition_at`;  
* `evidence_refs[]`.

Pero no debe copiar modelos estacionales completos si pertenecen a otro sistema analítico.

---

# **27\. RECURRING WINDOWS**

Algunas oportunidades vuelven a aparecer.

Ejemplo:

una campaña anual.

P3 debe distinguir:

> perder esta ventana

de

> perder la oportunidad para siempre.

Campo:

`window_recurrence`.

Valores:

`NON_RECURRING`

`RECURRING`

`IRREGULAR`

`UNKNOWN`

---

# **28\. TIME-BOUND OBLIGATION**

Cuando P2 proporciona:

`OBLIGATION`

P3 puede evaluar:

* deadline;  
* grace period;  
* consecuencias temporales;  
* preparación mínima;  
* irreversibilidad.

La mera existencia de la obligación no debe convertirse automáticamente en un score máximo.

---

# **29\. EVENT-DRIVEN TIME SENSITIVITY**

Algunas prioridades dependen de eventos futuros.

Entidad:

**TEMPORAL\_TRIGGER**

Ejemplos conceptuales:

* renovación de contrato;  
* campaña comercial;  
* lanzamiento;  
* llegada de inventario;  
* modificación regulatoria;  
* vencimiento de financiación.

Campos:

* `trigger_id`;  
* `trigger_type`;  
* `expected_at`;  
* `certainty`;  
* `effect_on_candidate`;  
* `source_refs[]`.

---

# **30\. TRIGGER CERTAINTY**

Un trigger puede ser:

`CONFIRMED`

`EXPECTED`

`PROBABILISTIC`

`UNKNOWN`

Un evento probabilístico no debe convertirse en fecha segura.

---

# **31\. LEAD TIME REFERENCE**

Para interpretar correctamente un deadline puede ser necesario conocer:

> cuánto tiempo mínimo requiere estar preparado antes.

P3 podrá utilizar:

`required_lead_time_ref`

pero P6 seguirá siendo source of truth del esfuerzo/capacidad.

P3 no debe duplicar estimaciones de trabajo.

---

# **32\. SLACK TIME**

Cuando exista lead time conocido puede calcularse:

`temporal_slack`

conceptualmente:

`time_remaining - minimum_required_lead_time`

Estados:

`POSITIVE`

`NEAR_ZERO`

`NEGATIVE`

`UNKNOWN`

Esto permite detectar candidatos que todavía tienen tiempo aparente pero ya deberían estar en marcha.

---

# **33\. NEGATIVE SLACK**

Si:

`temporal_slack < 0`

significa:

> según las condiciones actuales, ya no existe tiempo suficiente para cumplir plenamente el objetivo temporal.

Esto no implica automáticamente abandonar.

Puede implicar:

* validación;  
* mitigación;  
* escalado;  
* replanteamiento.

La decisión corresponde a bloques posteriores.

---

# **34\. TEMPORAL REVERSIBILITY**

P3 debe indicar si el coste de esperar puede recuperarse temporalmente.

Estados:

`FULLY_RECOVERABLE`

`PARTIALLY_RECOVERABLE`

`IRREVERSIBLE`

`UNKNOWN`

Ejemplo:

ventas perdidas durante una campaña pueden ser parcialmente irrecuperables.

Un retraso interno en una tarea puede ser completamente recuperable.

---

# **35\. TEMPORAL UNCERTAINTY**

P3 debe preservar incertidumbre en:

* deadlines;  
* ventanas;  
* tasas de deterioro;  
* eventos;  
* efectos de esperar.

No deberá convertir:

> probablemente dentro de 2–4 semanas

en:

`deadline = 21 días`.

Debe conservar rango o incertidumbre.

---

# **36\. TIME\_ESTIMATE**

Formato conceptual:

**TEMPORAL\_ESTIMATE**

Puede ser:

`EXACT_TIMESTAMP`

`DATE_RANGE`

`DURATION_RANGE`

`ORDERED_CATEGORY`

`UNKNOWN`

Esto permite trabajar con diferentes niveles de precisión.

---

# **37\. CONFIDENCE**

P3 seguirá la política de P0.

No utilizar:

`confidence = 0.82`

sin metodología válida.

Estados:

`SUFFICIENT_TO_ASSESS`

`SUFFICIENT_WITH_LIMITATIONS`

`VALIDATION_REQUIRED`

`INSUFFICIENT`

`UNKNOWN`

---

# **38\. TIME SENSITIVITY OVERRIDE**

Algunas reglas temporales pueden producir override.

Ejemplo:

deadline legal inminente.

Pero P3 no debe definir por sí solo todos los overrides.

Debe producir:

`override_candidate = true`

más:

`override_reason_ref`

cuando una regla configurada lo autorice.

El motor de precedencia P0/P10 decidirá el efecto final.

---

# **39\. HARD TEMPORAL GATE**

Algunas condiciones temporales pueden actuar como gate.

Ejemplo:

la ventana ya ha expirado.

Resultado posible:

`TEMPORAL_GATE.FAIL`

Eso puede convertir un candidato de oportunidad en no ejecutable dentro del contexto actual.

No significa necesariamente eliminarlo históricamente.

---

# **40\. EXPIRED CANDIDATE**

Estado posible:

`EXPIRED`

significa:

> la condición temporal que justificaba el candidato ha desaparecido.

Debe registrarse:

* cuándo expiró;  
* qué ventana expiró;  
* si puede reaparecer;  
* si requiere recontextualización.

---

# **41\. STALE TEMPORAL ASSESSMENT**

Las evaluaciones temporales envejecen especialmente rápido.

P3 deberá soportar:

`assessment_freshness`.

Estados:

`CURRENT`

`AGING`

`STALE`

`INVALID`

Un assessment temporal stale puede obligar a recalcular aunque otros inputs permanezcan iguales.

---

# **42\. RECALCULATION TRIGGERS**

P3 obliga a reconsiderar cuando:

* se acerca un threshold temporal;  
* cambia deadline;  
* aparece un evento relevante;  
* desaparece una ventana;  
* cambia la tasa de deterioro;  
* nueva evidencia cambia el cost of delay;  
* cambia lead time relevante;  
* cambia recoverability;  
* vence la evaluación temporal.

---

# **43\. NON-MATERIAL TEMPORAL CHANGES**

No deben provocar nueva decisión:

* diferencia de segundos irrelevante;  
* refresh técnico de timestamp;  
* cambio de formato horario;  
* actualización de timezone sin cambio semántico;  
* metadata temporal sin efecto decisional.

---

# **44\. TIMEZONE**

Todo timestamp material deberá:

* incluir timezone;  
* normalizarse internamente;  
* conservar zona original cuando sea relevante.

Un deadline no puede quedar ambiguo por timezone.

---

# **45\. BUSINESS CALENDAR**

Cuando sea relevante, P3 deberá poder referenciar:

`business_calendar_ref`

para interpretar:

* días laborables;  
* festivos;  
* cierres;  
* cutoffs;  
* campañas;  
* ventanas operativas.

No debe asumir que:

`7 días = 7 días operativos`.

---

# **46\. OUTPUT DE P3**

Contrato:

**TIME\_SENSITIVITY\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `assessment_state` | validez |
| `urgency_state` | síntesis semántica |
| `time_sensitivity_types[]` | mecanismos |
| `deadline_refs[]` | deadlines |
| `window_refs[]` | ventanas |
| `delay_effect_refs[]` | efectos |
| `temporal_trigger_refs[]` | eventos |
| `cost_of_delay_ref` | si existe |
| `temporal_slack` | si calculable |
| `recoverability` | pérdida temporal |
| `unknowns[]` | incertidumbres |
| `warnings[]` | limitaciones |
| `evidence_refs[]` | soporte |
| `rule_trace_refs[]` | reglas |
| `evaluated_at` | timestamp |

---

# **47\. ASSESSMENT\_STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT_INFORMATION`

`NOT_APPLICABLE`

`STALE`

`INVALID`

---

# **48\. NOT\_APPLICABLE**

P3 puede ser:

`NOT_APPLICABLE`

solo cuando una regla explícita determine que la temporalidad no añade información material.

No debe utilizarse como sustituto de UNKNOWN.

---

# **49\. REASON CODES**

Familia:

`TIME.*`

`DEADLINE.*`

`WINDOW.*`

`DELAY.*`

Ejemplos:

`TIME.IMMEDIATE_ATTENTION`

`TIME.DELAY_TOLERANT`

`TIME.DETERIORATING`

`TIME.ACCELERATING`

`TIME.UNKNOWN`

`DEADLINE.CONFIRMED`

`DEADLINE.APPROACHING`

`DEADLINE.MISSED`

`WINDOW.EXPIRING`

`WINDOW.EXPIRED`

`WINDOW.RECURRING`

`DELAY.VALUE_LOSS`

`DELAY.IRREVERSIBLE`

`DELAY.COST_UNKNOWN`

`TIME.NEGATIVE_SLACK`

---

# **50\. INVARIANTES P3**

1. Urgency no equivale a impact.  
2. Urgency no equivale a severity.  
3. Deadline no equivale automáticamente a urgencia máxima.  
4. Decision horizon no equivale a time sensitivity.  
5. Cost of delay no equivale a expected value.  
6. Cost of delay no equivale a total impact.  
7. Inaction risk no se resuelve completamente en P3.  
8. Un evento incierto no se convierte en fecha cierta.  
9. Una ventana recurrente no se presenta como oportunidad irrepetible.  
10. UNKNOWN no se convierte en baja urgencia.  
11. Una tasa temporal no se inventa.  
12. No se asume linealidad.  
13. No se prescribe estrategia.  
14. Un candidato estable puede seguir teniendo alto impacto.  
15. Un candidato de impacto moderado puede ser altamente time-sensitive.  
16. Toda condición temporal material debe tener evidencia o regla.

---

# **51\. PRECONDICIONES**

P3 necesita:

* candidate válido de P2;  
* decision context P1;  
* reference time;  
* fuentes temporales disponibles;  
* política temporal vigente.

No necesita conocer todavía:

* impacto P4;  
* esfuerzo P6;  
* riesgo completo P7;  
* expected value P8.

---

# **52\. POSTCONDICIONES**

P3 finaliza correctamente cuando el sistema puede declarar:

* si el tiempo importa;  
* por qué importa;  
* qué cambia por esperar;  
* si existe deadline;  
* si existe ventana;  
* si existe deterioro;  
* si existe compounding;  
* si existe irreversibilidad;  
* qué desconocemos;  
* qué evidencia soporta la conclusión.

---

# **53\. FAILURE MODES**

## **Importance-as-urgency**

Problema importante → marcado urgente.

**Prevención:** mechanism-based time sensitivity.

---

## **Deadline absolutism**

Todo deadline → prioridad máxima.

**Prevención:** deadline \+ slack \+ consequence.

---

## **Unknown-as-low**

No sabemos si existe deadline → baja urgencia.

**Prevención:** UNKNOWN explícito.

---

## **Linear assumption**

El sistema asume pérdida constante por día.

**Prevención:** time relationship explícita.

---

## **False countdown**

La IA inventa una fecha límite.

**Prevención:** source \+ certainty.

---

## **Opportunity panic**

Toda ventana temporal → “última oportunidad”.

**Prevención:** recurrence \+ recoverability.

---

## **Severity contamination**

Un problema muy grave se etiqueta urgente aunque sea estable.

**Prevención:** severity fuera de P3.

---

## **Strategy leakage**

“Es urgente lanzar nuevos anuncios.”

**Prevención:** P3 solo evalúa temporalidad del candidato.

---

# **54\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| candidato sin time sensitivity | NOT\_TIME\_SENSITIVE permitido |
| deadline confirmado | DEADLINE registrado |
| deadline lejano \+ amplio slack | no IMMEDIATE |
| deadline cercano \+ negative slack | condición temporal crítica |
| ventana expirada | temporal gate |
| ventana recurrente | no irreversible automáticamente |
| deterioro observado | DETERIORATING |
| daño estable | no ACCELERATING |
| tasa desconocida | UNKNOWN |
| oportunidad desaparece mañana | high time sensitivity |
| alto impacto estable | no inferir urgencia |
| impacto bajo pero pérdida diaria irreversible | puede ser time critical |
| evento probabilístico | conservar incertidumbre |
| timezone ambiguo | validación requerida |
| nueva fecha material | recalculation |
| cambio de formato fecha | no recalculation |
| UNKNOWN deadline | no false |
| deadline inexistente probado | NOT\_APPLICABLE/none según schema |

---

# **55\. EVALS IA**

### **Urgency contamination eval**

¿Evita convertir importancia en urgencia?

### **Deadline extraction eval**

¿Extrae correctamente deadlines explícitos?

### **Temporal hallucination eval**

¿Evita inventar fechas o ventanas?

### **Window recurrence eval**

¿Distingue oportunidad irrepetible de recurrente?

### **Deterioration eval**

¿Distingue estado grave de deterioro progresivo?

### **Delay reasoning eval**

¿Identifica correctamente qué cambia si se espera?

### **Unknown preservation eval**

¿Mantiene incertidumbre temporal?

### **Strategy boundary eval**

¿Evita recomendar acciones?

---

# **56\. EJEMPLO 1 — ERROR DE PRICING**

Candidato:

> producto con pricing incorrecto que reduce margen por cada venta.

P3 puede producir:

`DETERIORATING`

o

`COMPOUNDING`

dependiendo de evidencia.

Delay effect:

> pérdida de margen mientras continúan las ventas.

Si existe estimación defendible:

> rango de pérdida diaria.

P3 NO concluye:

> subir precio un 8 %.

Eso pertenece a Fase 5\.

---

# **57\. EJEMPLO 2 — MIGRACIÓN DE PLATAFORMA**

Candidato:

> limitación tecnológica relevante para escalabilidad.

Impacto potencial:

posiblemente alto.

Pero:

* sin deadline cercano;  
* sistema actual estable;  
* ventana amplia;  
* baja pérdida incremental por esperar.

P3 puede concluir:

`DELAY_TOLERANT`.

Eso no significa prioridad baja.

P10 combinará posteriormente dimensiones.

---

# **58\. EJEMPLO 3 — BLACK FRIDAY**

Candidato:

> brecha importante en preparación comercial para Black Friday.

Existe:

`FIXED_DEADLINE`

* 

`EXPIRING_WINDOW`.

Si faltan 20 días pero preparación mínima requiere 25:

`temporal_slack = NEGATIVE`.

Eso cambia radicalmente la dimensión temporal.

P3 sigue sin decidir:

> qué campaña ejecutar.

---

# **59\. EJEMPLO 4 — CREATIVE FATIGUE**

Candidato:

> deterioro creativo en paid media.

Datos muestran:

* caída de CTR;  
* aumento de frecuencia;  
* empeoramiento progresivo de CAC.

P3 puede inferir:

`DETERIORATING`.

Si los datos muestran que el ritmo de deterioro aumenta:

`ACCELERATING`.

Si solo sabemos que el performance es malo:

no podemos afirmar ninguno.

---

# **60\. INTERFAZ CON P4**

P3 entrega:

> cómo cambia el candidato con el tiempo.

P4 analizará:

> cuánto valor está en juego.

Ejemplo:

P3:

> se pierden aproximadamente X–Y €/día por retraso.

P4:

> el valor total potencial del problema puede ser Z.

Ambas cifras no son equivalentes.

---

# **61\. INTERFAZ CON P5**

P5 podrá utilizar:

* deadlines;  
* windows;  
* triggers;  
* temporal slack;

para razonar sobre secuencias y dependencias.

P3 no crea dependency graph.

---

# **62\. INTERFAZ CON P6**

P6 puede producir:

`minimum_lead_time`

o restricciones de capacidad.

P3 podrá usar esas referencias para recalcular:

`temporal_slack`.

La ownership del dato original sigue en P6.

---

# **63\. INTERFAZ CON P7**

P7 utilizará los delay effects para evaluar:

`INACTION_RISK`.

P3 no debe etiquetar directamente:

`risk = high`

solo porque el tiempo sea crítico.

---

# **64\. INTERFAZ CON P8**

P8 podrá incorporar:

`cost_of_delay`

al análisis económico.

Pero deberá evitar double counting si:

* cost of delay;  
* expected value;  
* lost revenue;

representan parcialmente el mismo pool económico.

---

# **65\. INTERFAZ CON P10**

P10 podrá utilizar P3 como dimensión temporal.

Pero queda prohibido:

`urgency_score` domina automáticamente todo.

P10 deberá respetar:

* gates;  
* overrides;  
* dependencies;  
* confidence;  
* contexto completo.

---

# **66\. DEFINITION OF DONE — P3**

P3 está completo cuando el sistema puede responder:

**DOES TIME MATTER?**

Se conoce si el candidato es time-sensitive.

**WHY DOES TIME MATTER?**

Existe mecanismo temporal explícito.

**WHAT HAPPENS IF WE WAIT?**

Existen delay effects.

**IS THERE A DEADLINE?**

Existe deadline o UNKNOWN.

**IS THERE A WINDOW?**

Existe window o UNKNOWN.

**IS THE SITUATION DETERIORATING?**

Se distingue estado de tendencia.

**IS THE DAMAGE COMPOUNDING?**

Se representa independientemente.

**CAN THE LOST VALUE BE RECOVERED?**

Existe temporal recoverability.

**HOW MUCH TIME DO WE REALLY HAVE?**

Puede calcularse slack si existen inputs.

**WHAT DON'T WE KNOW?**

Se preserva incertidumbre.

**WOULD TIME ALONE CHANGE THE DECISION?**

Puede producir triggers, gates u overrides estructurados cuando una política explícita lo autorice.

P3 no dice todavía:

> este candidato debe ser el nº1.

Solo dice:

> esto es exactamente lo que ocurre con este candidato si el tiempo sigue avanzando.

