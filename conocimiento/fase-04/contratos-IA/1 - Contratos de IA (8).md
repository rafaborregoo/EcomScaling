# **P8 — EXPECTED VALUE, OPPORTUNITY COST Y ASIGNACIÓN DE RECURSOS**

## **0\. Propósito**

P8 define cómo debe representar el sistema la economía decisional de dedicar recursos escasos a un candidato frente a sus alternativas.

Su responsabilidad es responder:

> Dadas las opciones reales disponibles, ¿qué valor esperamos capturar, qué recursos comprometemos y a qué renunciamos al elegir una alternativa sobre otra?

P8 combina de forma controlada información procedente de:

* P3 → coste temporal de esperar;  
* P4 → value at stake;  
* P5 → constraints y dependencias;  
* P6 → recursos, costes y factibilidad;  
* P7 → downside y coste del error.

Pero no sustituye ninguno de esos bloques.

P8 NO decide todavía el ranking definitivo.

Eso corresponde a P10.

---

# **1\. Principio fundamental**

Debe mantenerse:

**THEORETICAL VALUE**

≠

**CAPTURABLE VALUE**

≠

**EXPECTED VALUE**

≠

**NET EXPECTED VALUE**

≠

**OPPORTUNITY COST**

≠

**RESOURCE EFFICIENCY**

≠

**PRIORITY**

Una iniciativa con mayor expected value no es automáticamente la prioridad nº1.

Puede existir:

* hard dependency;  
* hard constraint;  
* deadline;  
* tail risk;  
* strategic mismatch;  
* resource contention;  
* baja confidence;  
* portfolio incompatibility.

---

# **2\. Entidad principal**

Entidad:

**DECISION\_ECONOMICS\_ASSESSMENT**

Relación:

`PRIORITY_CANDIDATE`

→ `DECISION_ECONOMICS_ASSESSMENT`

Cada assessment pertenece a:

* candidate;  
* prioritization run;  
* decision context;  
* policy version.

P8 será source of truth de:

**expected economics of allocating scarce resources to a candidate**.

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `decision_economics_id` | Sí | identidad |
| `candidate_id` | Sí | candidato |
| `prioritization_run_id` | Sí | ejecución |
| `assessment_state` | Sí | validez |
| `value_input_refs[]` | Sí | P4 |
| `resource_cost_refs[]` | Condicional | P6 |
| `risk_input_refs[]` | Condicional | P7 |
| `delay_cost_refs[]` | Opcional | P3 |
| `scenario_refs[]` | Opcional | escenarios |
| `expected_value_ref` | Opcional | EV |
| `net_expected_value_ref` | Opcional | EV neto |
| `opportunity_cost_refs[]` | Opcional | alternativas sacrificadas |
| `resource_efficiency_refs[]` | Opcional | productividad del recurso |
| `scarcity_refs[]` | Opcional | recursos escasos |
| `uncertainties[]` | Opcional | desconocidos |
| `assumption_refs[]` | Opcional | supuestos |
| `evidence_refs[]` | Sí | soporte |
| `evaluated_at` | Sí | timestamp |
| `policy_version` | Sí | versión |

---

# **4\. EXPECTED VALUE**

Entidad:

**EXPECTED\_VALUE**

Representa:

> el valor medio esperado de un resultado bajo una distribución suficientemente defendible de escenarios.

Conceptualmente:

`EV = Σ(probability_i × value_i)`

pero solo cuando:

* los escenarios sean mutuamente coherentes;  
* las probabilidades estén justificadas;  
* las magnitudes sean comparables;  
* no exista double counting.

Si esas condiciones no existen:

`expected_value = UNKNOWN`.

---

# **5\. EV NO ES OBLIGATORIO**

P8 no debe forzar un expected value numérico.

Puede trabajar con:

* ranges;  
* scenario dominance;  
* ordinal comparison;  
* qualitative economics;  
* UNKNOWN.

La ausencia de EV exacto no invalida necesariamente la decisión.

---

# **6\. PROBABILITY REQUIREMENT**

Para producir EV cuantitativo debe existir una probabilidad con fundamento.

Fuentes posibles:

`OBSERVED_FREQUENCY`

`EXPERIMENTAL_ESTIMATE`

`FORECAST_MODEL`

`VALIDATED_MODEL`

`EXPERT_RANGE`

`OTHER_DEFENSIBLE_METHOD`

No se autoriza:

`MODEL_GUESS`

como probabilidad numérica tratada como hecho.

---

# **7\. PROBABILITY RANGE**

Si solo conocemos:

30–50 %

de probabilidad de éxito,

debe conservarse como rango.

Puede calcularse:

`EV_RANGE`

si la metodología lo soporta.

No convertir automáticamente a:

40 %.

---

# **8\. OUTCOME SCENARIO**

Entidad:

**DECISION\_OUTCOME\_SCENARIO**

Campos:

* `scenario_id`;  
* `candidate_id`;  
* `scenario_type`;  
* `value_refs[]`;  
* `downside_refs[]`;  
* `resource_cost_refs[]`;  
* `probability_estimate`;  
* `assumptions[]`;  
* `evidence_refs[]`.

---

# **9\. SCENARIO TYPE**

Posibles:

`UPSIDE`

`BASE`

`DOWNSIDE`

`TAIL`

`CUSTOM`

Pero las etiquetas no implican probabilidad.

Cada escenario debe ser semánticamente explícito.

---

# **10\. SCENARIOS ≠ DISTRIBUTION**

Tener:

* conservative;  
* base;  
* upside;

no autoriza a calcular EV.

Para ello hacen falta probabilidades.

Sin ellas:

> tenemos escenarios, no una distribución probabilística.

---

# **11\. CAPTURABLE VALUE INPUT**

P8 debe consumir:

`capturable_value`

de P4.

No debe reconstruirlo.

P8 puede ajustarlo económicamente por:

* probabilidad de captura;  
* implementation cost;  
* downside;  
* opportunity cost.

Pero P4 sigue siendo source of truth del value ceiling.

---

# **12\. SUCCESS PROBABILITY**

Puede existir:

`capture_probability`

cuando exista base.

Representa:

> probabilidad de capturar determinado value scenario.

No debe confundirse con:

* probability of execution;  
* probability of no failure;  
* confidence;  
* probability of a risk event.

---

# **13\. FEASIBILITY ≠ SUCCESS PROBABILITY**

Que algo sea:

`FEASIBLE_NOW`

no significa:

> alta probabilidad de éxito.

P6 responde si puede hacerse.

P8 puede evaluar probabilidad de captura si existen datos.

---

# **14\. CONFIDENCE ≠ PROBABILITY**

Debe mantenerse:

**DECISION CONFIDENCE**

≠

**OUTCOME PROBABILITY**

Ejemplo:

podemos estar muy seguros de que existe un 30 % de probabilidad.

Confidence alta.

Probability 30 %.

Conceptos distintos.

---

# **15\. GROSS EXPECTED VALUE**

Puede existir:

`gross_expected_value`

conceptualmente:

> EV antes de restar recursos/costes atribuibles.

---

# **16\. NET EXPECTED VALUE**

Entidad:

**NET\_EXPECTED\_VALUE**

Conceptualmente:

`NEV = gross_expected_value - future_incremental_resource_costs - expected_downside`

solo cuando todas las magnitudes sean compatibles y no estén ya incluidas.

No debe restarse:

* sunk cost;  
* costes ya incluidos en capturable value;  
* downside contado dos veces.

---

# **17\. NET ≠ CASH FLOW**

NEV económico no es necesariamente:

cash impact.

P8 debe poder conservar:

* economic EV;  
* cash requirements;  
* cash timing.

Un proyecto con NEV positivo puede ser inviable por caja.

---

# **18\. SUNK COST EXCLUSION**

Hard rule:

> los costes pasados no deben reducir el EV futuro de continuar o abandonar una alternativa.

P8 debe utilizar:

`future_incremental_cost`.

No:

`historical_total_spend`

como argumento económico para continuar.

---

# **19\. INCREMENTAL COST**

Entidad:

**INCREMENTAL\_RESOURCE\_COST**

Representa:

> coste adicional futuro atribuible a elegir este candidato dentro de este contexto.

Puede incluir:

* cash;  
* vendor;  
* labor opportunity;  
* infrastructure;  
* inventory commitment.

---

# **20\. FIXED COST ALLOCATION**

No asignar automáticamente fixed costs existentes a una decisión si:

> ocurrirían igualmente sin ella.

Solo deben considerarse costes incrementales relevantes para la comparación.

---

# **21\. OPPORTUNITY COST**

Entidad:

**OPPORTUNITY\_COST**

Representa:

> valor de la mejor alternativa real sacrificada al asignar un recurso escaso a una opción.

No significa:

> todos los demás candidatos juntos.

---

# **22\. OPPORTUNITY COST REQUIERE ALTERNATIVA**

No puede existir opportunity cost sin identificar:

* recurso escaso;  
* alternativa desplazada;  
* valor alternativo;  
* horizonte.

Por tanto:

`opportunity_cost = €X`

sin alternativa referenciada

es inválido.

---

# **23\. ALTERNATIVE SET**

Entidad/ref:

**ALLOCATION\_ALTERNATIVE\_SET**

Representa candidatos que realmente compiten por el mismo recurso o capacidad.

No todos los candidates del candidate set generan opportunity cost entre sí.

---

# **24\. NO RESOURCE CONFLICT → NO DIRECT OPPORTUNITY COST**

Si:

Candidate A requiere engineering.

Candidate B requiere creative.

Y ambos recursos están disponibles.

Elegir A puede no sacrificar B.

Por tanto no existe necesariamente opportunity cost directo entre ambos.

---

# **25\. SCARCE RESOURCE**

Entidad:

**SCARCE\_RESOURCE**

Representa:

> recurso cuya demanda relevante excede o amenaza exceder capacidad asignable.

Puede derivarse de P6.

Campos conceptuales:

* `resource_ref`;  
* `available_capacity_ref`;  
* `demand_refs[]`;  
* `scarcity_state`;  
* `time_window`.

---

# **26\. SCARCITY STATE**

`NOT_SCARCE`

`LOCALLY_SCARCE`

`CONSTRAINED`

`CRITICAL`

`UNKNOWN`

Solo si existe policy/condiciones para definir categorías.

---

# **27\. SCARCITY ≠ COST**

Un recurso puede ser barato monetariamente pero extremadamente escaso.

Ejemplo:

atención del fundador.

Y uno caro pero abundante externamente.

No deben colapsarse.

---

# **28\. MANAGEMENT ATTENTION AS OPPORTUNITY COST**

La atención directiva puede generar opportunity cost.

Ejemplo:

dos proyectos demandan al mismo decisor.

Aunque sus costes monetarios sean bajos, pueden ser mutuamente incompatibles temporalmente.

---

# **29\. BEST FOREGONE ALTERNATIVE**

Por definición económica, el opportunity cost debería basarse en:

> la mejor alternativa razonablemente disponible que queda desplazada.

No en la suma de todo lo no elegido.

---

# **30\. UNKNOWN ALTERNATIVE VALUE**

Si sabemos que existe contention pero no podemos valorar la alternativa:

`opportunity_cost = UNKNOWN`.

No asumir cero.

---

# **31\. MARGINAL VALUE**

Entidad:

**MARGINAL\_RESOURCE\_VALUE**

Representa:

> valor adicional esperado generado por una unidad adicional de recurso.

Ejemplo:

margen esperado por €1.000 adicionales de spend dentro de un rango concreto.

Solo cuando exista relación cuantificable defendible.

---

# **32\. MARGINAL ≠ AVERAGE**

Debe mantenerse:

**AVERAGE RETURN**

≠

**MARGINAL RETURN**

Que un canal haya tenido ROAS histórico 4x no implica que el siguiente euro tenga ROAS 4x.

P8 debe trabajar con incrementalidad.

---

# **33\. DIMINISHING RETURNS**

P8 debe poder representar curvas donde:

> cada unidad adicional de recurso produce menor valor marginal.

No debe asumir rendimientos lineales.

---

# **34\. SATURATION**

Puede existir:

`saturation_state`

cuando existe evidencia de que mayor asignación no produce valor proporcional.

Esto es importante para paid media, inventario, equipos, etc.

---

# **35\. RESOURCE ALLOCATION CURVE**

Cuando existan datos suficientes, puede representarse:

**RESOURCE\_VALUE\_CURVE**

que relacione:

resource allocation

→ expected incremental value.

No será obligatorio para todos los candidatos.

---

# **36\. MINIMUM EFFECTIVE ALLOCATION**

Algunas iniciativas necesitan un mínimo.

Ejemplo:

si asignar menos de X capacidad no produce resultado útil.

Puede existir:

`minimum_effective_allocation`.

Eso evita dividir recursos de forma ineficiente.

---

# **37\. MAXIMUM USEFUL ALLOCATION**

Igualmente:

`maximum_useful_allocation`

puede limitar el recurso que puede absorber productivamente un candidato.

Más recursos no implican más valor indefinidamente.

---

# **38\. DIVISIBILITY**

Cada candidato puede ser:

`DIVISIBLE`

`PARTIALLY_DIVISIBLE`

`INDIVISIBLE`

`UNKNOWN`

desde la perspectiva de asignación.

P6 puede aportar esta propiedad.

P8 la utiliza económicamente.

---

# **39\. EXPECTED VALUE OF INFORMATION**

Para candidatos tipo `UNCERTAINTY`, P8 puede modelar:

**EXPECTED\_VALUE\_OF\_INFORMATION**

Conceptualmente:

> cuánto valor decisional puede generar reducir una incertidumbre antes de decidir.

---

# **40\. EVSI / INFORMATION VALUE**

No hace falta implementar formalmente modelos estadísticos complejos siempre.

Pero conceptualmente debe distinguirse:

**VALUE OF INFORMATION**

de

**VALUE OF ACTION**.

Validar puede tener valor aunque no mejore directamente un KPI.

---

# **41\. INFORMATION VALUE REQUIREMENTS**

Un candidato de validación puede tener valor si:

* existe una decisión bloqueada;  
* la incertidumbre puede cambiar esa decisión;  
* el value at stake es material;  
* la incertidumbre puede reducirse.

---

# **42\. PERFECT INFORMATION ≠ AVAILABLE INFORMATION**

No debemos valorar una validación suponiendo que eliminará toda incertidumbre.

Puede existir:

`expected_uncertainty_reduction`.

No asumir 100 %.

---

# **43\. COST OF INFORMATION**

La validación también consume:

* tiempo;  
* recursos;  
* oportunidad.

Por tanto el valor de información debe compararse con su coste cuando sea posible.

---

# **44\. COST OF DELAY INPUT**

P8 puede consumir P3.

Pero debe evitar double counting.

Ejemplo:

P4 ya mide €50k de value loss anual.

P3 mide €5k/mes de cost of delay.

No deben sumarse si describen el mismo pool.

---

# **45\. DELAY-ADJUSTED ECONOMICS**

Puede calcularse:

> cómo cambia el EV si la decisión se retrasa.

Esto puede ser especialmente útil para comparar alternativas con ventanas distintas.

---

# **46\. TIME VALUE**

Cuando el horizonte sea largo y las cantidades materiales, P8 puede considerar:

* timing de cash;  
* discounting;  
* time value of money.

Pero no debe introducir modelos financieros innecesarios en decisiones triviales.

---

# **47\. DISCOUNT RATE**

Solo utilizar:

`discount_rate`

si:

* el contexto lo requiere;  
* existe policy financiera válida.

No inventar un 10 % universal.

---

# **48\. RISK ADJUSTMENT**

P8 puede integrar downside de P7.

Pero nunca mediante una penalización genérica:

`risk_score × weight`.

Cuando exista información cuantitativa:

puede utilizar:

* expected loss;  
* scenario distribution;  
* tail constraints.

Cuando no:

debe conservar evaluación cualitativa separada.

---

# **49\. TAIL RISK OVERRIDE**

Un EV positivo no puede neutralizar automáticamente:

* catastrophic downside;  
* hard risk policy breach;  
* irreversible unacceptable event.

P7/P0 pueden producir gate/override.

P8 debe respetarlo.

---

# **50\. EXPECTED VALUE ≠ DECISION RULE**

Incluso un EV matemáticamente superior puede no ser elegible.

Ejemplo:

A EV \= €100k

pero viola hard constraint.

B EV \= €40k

y es válido.

A no gana.

---

# **51\. RISK-NEUTRALITY NO ASUMIDA**

No debemos asumir que el negocio es neutral al riesgo.

Si no existe risk policy:

P8 puede calcular economics.

Pero no decidir automáticamente que mayor EV domina cualquier dispersión.

---

# **52\. ECONOMIC DOMINANCE**

Puede existir:

**DOMINANCE RELATIONSHIP**

Candidate A domina B cuando, bajo condiciones compatibles:

* no requiere más de todos los recursos críticos;  
* ofrece igual o mayor valor esperado;  
* no presenta peor downside material;  
* no viola constraints adicionales.

Solo cuando pueda demostrarse.

---

# **53\. PARETO DOMINANCE**

Dos candidatos pueden no ser ordenables escalarmente.

Ejemplo:

A:

mayor value.

B:

menor resource consumption.

Si ninguno domina completamente:

`NON_DOMINATED`.

Esto es válido.

---

# **54\. PARETO FRONTIER**

P8 puede producir un conjunto de:

`NON_DOMINATED_CANDIDATES`

para P10.

P10 decidirá posteriormente utilizando contexto y reglas adicionales.

---

# **55\. NO FORCED COMPARABILITY**

Si dos alternativas tienen:

* impactos cualitativos diferentes;  
* probabilidades desconocidas;  
* recursos diferentes;

P8 no debe fabricar una cifra única para ordenarlas.

Puede declarar:

`ECONOMICALLY_NON_COMPARABLE_WITH_CURRENT_DATA`.

---

# **56\. RESOURCE EFFICIENCY**

Puede existir:

**RESOURCE\_EFFICIENCY**

Ejemplos:

`expected_value_per_engineering_hour`

`expected_value_per_euro`

solo cuando:

* numerator y denominator sean válidos;  
* exista sentido económico;  
* recurso sea realmente escaso.

---

# **57\. NO UNIVERSAL VALUE/EFFORT SCORE**

Un ratio:

€ / hour

puede ser útil.

Pero no puede comparar automáticamente:

* engineering hours;  
* management attention;  
* cash;  
* strategic capability.

No existe denominador universal.

---

# **58\. CAPITAL EFFICIENCY**

Cuando el recurso escaso es cash:

puede existir:

`expected_incremental_value / incremental_cash_required`

como métrica auxiliar.

No debe llamarse automáticamente ROI si no corresponde a su definición financiera.

---

# **59\. ROI**

P8 puede calcular ROI solo cuando:

* definición esté explícita;  
* numerator;  
* denominator;  
* periodo;  
* cash flows

sean coherentes.

No utilizar “ROI” como sinónimo de “merece la pena”.

---

# **60\. PAYBACK**

Puede existir:

`payback_period`

cuando sea calculable.

Esto puede ser relevante cuando cash es constraint.

Pero payback corto no implica prioridad alta.

---

# **61\. CASH TIMING**

P8 debe poder diferenciar:

* cash outflow inicial;  
* recurring outflow;  
* expected inflow;  
* timing.

Esto importa para negocios con liquidez limitada.

---

# **62\. VALUE AT STAKE VS RESOURCE COMMITMENT**

P8 puede construir una relación explícita:

**VALUE RESOURCE PROFILE**

sin reducirla a un score.

Ejemplo:

Candidate A:

* high potential value;  
* high scarce-resource demand.

Candidate B:

* moderate value;  
* low scarce-resource demand.

La comparación final pertenece a P10.

---

# **63\. PORTFOLIO INTERACTION**

P8 puede detectar economics compartidos entre candidatos.

Pero la combinación activa de candidatos pertenece a P11.

P8 podrá emitir:

* complementarity;  
* cannibalization;  
* shared fixed cost;  
* economies of scope.

---

# **64\. COMPLEMENTARITY**

Dos candidatos pueden producir más valor juntos que separados.

Entidad:

**ECONOMIC\_INTERACTION**

Tipo:

`COMPLEMENTARY`

---

# **65\. CANNIBALIZATION**

Dos candidatos pueden competir por el mismo value pool.

Tipo:

`CANNIBALIZING`

P4 puede detectar shared value.

P8 evalúa implicación económica.

---

# **66\. SHARED FIXED COST**

Dos candidatos pueden compartir:

* setup;  
* tooling;  
* data;  
* vendor;  
* infrastructure.

Elegir ambos podría reducir coste marginal conjunto.

P8 registra interacción.

P11 decide portfolio.

---

# **67\. SYNERGY**

No utilizar `synergy` como etiqueta vaga.

Debe existir mecanismo identificado.

Ejemplo:

Candidate A crea capability necesaria para B y C.

---

# **68\. NEGATIVE INTERACTION**

Puede existir:

`VALUE_DILUTION`

`RESOURCE_CANNIBALIZATION`

`CUSTOMER_CANNIBALIZATION`

`CHANNEL_CANNIBALIZATION`

`OTHER`

solo con evidencia suficiente.

---

# **69\. ECONOMIC INTERACTION ≠ DEPENDENCY**

Dos candidatos pueden ser económicamente complementarios sin existir hard dependency.

Y pueden depender uno del otro sin generar synergy económica.

P5 y P8 deben permanecer separados.

---

# **70\. RESOURCE ALLOCATION STATE**

P8 puede producir una valoración:

`ECONOMICALLY_ATTRACTIVE`

`ECONOMICALLY_ATTRACTIVE_WITH_LIMITATIONS`

`ECONOMICALLY_AMBIGUOUS`

`ECONOMICALLY_UNATTRACTIVE`

`INSUFFICIENT_INFORMATION`

solo bajo policy definida.

Esto no equivale a priority.

---

# **71\. ECONOMIC ATTRACTIVENESS ≠ BUSINESS PRIORITY**

Un candidato económicamente atractivo puede tener:

* low strategic fit;  
* blocking dependency;  
* unacceptable risk.

Y uno con retorno directo modesto puede ser prerequisite esencial.

---

# **72\. CONFIDENCE**

P8 seguirá P0.

Estados:

`SUFFICIENT_TO_COMPARE`

`SUFFICIENT_WITH_LIMITATIONS`

`VALIDATION_REQUIRED`

`INSUFFICIENT`

`UNKNOWN`

No:

`economic_confidence = 0.74`

sin metodología.

---

# **73\. UNCERTAINTY PROPAGATION**

P8 no puede ocultar incertidumbres upstream.

Si:

P4 capturable value \= rango.

P7 probability \= rango.

P6 cost \= rango.

P8 debe propagar dicha incertidumbre.

No producir un punto exacto artificial.

---

# **74\. RANGE PROPAGATION**

Puede utilizar:

* scenario analysis;  
* interval arithmetic;  
* simulation;

si corresponde.

Pero el resultado debe conservar metodología.

---

# **75\. MODEL-BASED ESTIMATION**

Si IA/modelo genera economics:

debe declararse:

`MODEL_INFERENCE`

y enlazar:

* inputs;  
* assumptions;  
* model version;  
* uncertainty.

---

# **76\. OPPORTUNITY COST GRAPH**

Cuando varios candidatos compiten por varios recursos, puede existir:

**ALLOCATION\_COMPETITION\_GRAPH**

Nodos:

candidatos y recursos.

Edges:

consumo/competencia.

P11 podrá utilizarlo para portfolio.

---

# **77\. SHADOW VALUE**

En sistemas avanzados puede existir:

`shadow_value`

para expresar:

> valor de una unidad adicional de recurso escaso.

No es necesario para MVP/runtime inicial.

Debe considerarse extensión avanzada, no requisito base.

---

# **78\. NO OVERENGINEERING RULE**

P8 no obliga a calcular:

* NPV;  
* IRR;  
* Monte Carlo;  
* shadow pricing;

para cada candidato.

La profundidad del cálculo debe ser proporcional a:

* materialidad;  
* incertidumbre;  
* irreversibilidad;  
* tamaño de decisión.

---

# **79\. DECISION MATERIALITY**

Cuanto mayor sea:

* value at stake;  
* resource commitment;  
* downside;  
* irreversibility;

mayor nivel de evidencia económica puede exigirse.

Esto puede definirse mediante policy.

---

# **80\. ECONOMIC EVIDENCE REQUIREMENT**

Decisiones pequeñas/reversibles:

pueden tolerar estimaciones más ligeras.

Decisiones grandes/irreversibles:

deben exigir mayor evidence quality.

P8 puede emitir:

`EVIDENCE_INSUFFICIENT_FOR_COMMITMENT`.

---

# **81\. ASSESSMENT STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT_INFORMATION`

`NON_COMPARABLE`

`STALE`

`NOT_APPLICABLE`

`INVALID`

---

# **82\. OUTPUT P8**

Contrato:

**DECISION\_ECONOMICS\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `assessment_state` | validez |
| `expected_value_ref` | EV |
| `net_expected_value_ref` | EV neto |
| `expected_value_range_ref` | rango |
| `opportunity_cost_refs[]` | sacrificios |
| `scarce_resource_refs[]` | escasez |
| `resource_efficiency_refs[]` | eficiencia |
| `information_value_ref` | si candidate uncertainty |
| `economic_interaction_refs[]` | complementariedad/cannibalización |
| `dominance_refs[]` | relaciones |
| `economic_state` | síntesis |
| `unknowns[]` | desconocidos |
| `warnings[]` | limitaciones |
| `assumption_refs[]` | supuestos |
| `evidence_refs[]` | soporte |
| `rule_trace_refs[]` | trazabilidad |

---

# **83\. REASON CODES**

Familias:

`EV.*`

`OPPORTUNITY_COST.*`

`ALLOCATION.*`

`SCARCITY.*`

`ECONOMICS.*`

Ejemplos:

`EV.CALCULATED`

`EV.RANGE_ONLY`

`EV.PROBABILITY_UNKNOWN`

`EV.VALUE_UNKNOWN`

`EV.DOUBLE_COUNT_PROTECTED`

`OPPORTUNITY_COST.ALTERNATIVE_IDENTIFIED`

`OPPORTUNITY_COST.UNKNOWN`

`SCARCITY.RESOURCE_CONSTRAINED`

`ALLOCATION.NON_DOMINATED`

`ALLOCATION.ECONOMICALLY_ATTRACTIVE`

`ALLOCATION.INSUFFICIENT_INFORMATION`

`ECONOMICS.SHARED_VALUE_POOL`

`ECONOMICS.CANNIBALIZATION`

`ECONOMICS.COMPLEMENTARITY`

---

# **84\. INVARIANTES P8**

1. Capturable value no equivale a expected value.  
2. Expected value no equivale a priority.  
3. EV requiere probabilidades defendibles.  
4. Scenario no equivale a probability.  
5. Probability no equivale a confidence.  
6. Opportunity cost requiere alternativa sacrificada.  
7. Opportunity cost no es suma de todo lo no elegido.  
8. Solo recursos realmente escasos generan allocation trade-off directo.  
9. Sunk cost no entra como futuro incremental cost.  
10. Fixed cost no incremental no se asigna arbitrariamente.  
11. Cost of delay no se suma si duplica el mismo value pool.  
12. Risk downside no se cuenta dos veces.  
13. Expected loss no elimina tail risk.  
14. Ratio value/effort no sustituye prioridad.  
15. ROI solo existe con definición correcta.  
16. Marginal return no equivale a average return.  
17. No se asume linealidad de retornos.  
18. Un hard gate prevalece sobre EV.  
19. UNKNOWN economics no equivale a cero.  
20. P8 no decide portfolio final.  
21. P8 no prescribe acciones.

---

# **85\. PRECONDICIONES**

Para análisis completo P8 necesita:

* candidate válido P2;  
* contexto P1;  
* value assessment P4;  
* resource/cost information P6;  
* risk assessment P7;  
* opportunity set cuando corresponda.

Puede funcionar parcialmente con inputs incompletos.

---

# **86\. POSTCONDICIONES**

P8 termina correctamente cuando puede responder, hasta donde permite la evidencia:

* qué value potencial podría capturarse;  
* qué probabilidad válida conocemos;  
* qué costes futuros incrementales exige;  
* qué downside económico existe;  
* qué expected value puede defenderse;  
* qué recurso escaso consume;  
* qué alternativa desplaza;  
* qué opportunity cost existe;  
* qué interactions económicas aparecen;  
* qué parte permanece incierta.

---

# **87\. FAILURE MODES**

## **ROI absolutism**

“Mayor ROI → prioridad nº1.”

**Prevención:** P8 no decide priority.

---

## **Fake probability**

“Probabilidad de éxito 70 %.”

Sin base.

**Prevención:** probability source obligatoria.

---

## **Sunk cost bias**

“Hemos invertido €100k.”

**Prevención:** future incremental economics.

---

## **Opportunity-cost hallucination**

Se asigna opportunity cost sin alternativa concreta.

**Prevención:** alternative ref obligatoria.

---

## **All-candidates competition**

Todo candidate compite económicamente con todos.

**Prevención:** scarce resource / alternative set.

---

## **Average-return extrapolation**

ROAS actual → mismo ROAS marginal.

**Prevención:** marginal economics.

---

## **Double counting**

Value, cost of delay y risk loss describen mismo dinero.

**Prevención:** shared value lineage.

---

## **EV hides catastrophe**

EV positivo oculta tail risk.

**Prevención:** risk gates sobreviven.

---

## **Precision laundering**

Tres rangos inciertos terminan en €183.427 exactos.

**Prevención:** uncertainty propagation.

---

## **Strategy leakage**

“Debemos invertir €20k más.”

**Prevención:** P8 describe allocation economics, no intervención final.

---

# **88\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| capturable €100k, probability UNKNOWN | EV UNKNOWN |
| capturable €100k, probability 40% validada | EV calculable |
| probability 30–50% | EV range |
| 3 scenarios sin probabilities | no EV point |
| sunk cost €50k | no restar al future EV |
| future cost €20k | puede entrar en NEV |
| A/B no compiten por recursos | no opportunity cost directo |
| A/B compiten por único recurso | opportunity cost evaluable |
| alternativa valor desconocido | opportunity cost UNKNOWN |
| average ROAS 4 | no asumir marginal 4 |
| tail risk unacceptable | EV positivo no lo neutraliza |
| P4/P3 mismo value pool | no double count |
| risk loss ya incluido en scenario | no volver a restar |
| qualitative value | no monetizar automáticamente |
| high EV \+ hard constraint fail | no elegible por EV |
| low EV \+ hard prerequisite | P8 no descarta automáticamente |
| same inputs | resultado determinista cuando cálculo lo sea |

---

# **89\. EVALS IA**

### **Probability discipline**

¿Evita inventar probabilidades?

### **Opportunity-cost reasoning**

¿Identifica únicamente alternativas realmente desplazadas?

### **Incrementality eval**

¿Distingue valor/coste incremental de total histórico?

### **Marginal-return eval**

¿Evita extrapolar promedios?

### **Double-counting eval**

¿Evita duplicar value pools?

### **Tail-risk compliance**

¿Respeta riesgos no compensatorios?

### **Uncertainty propagation**

¿Conserva rangos y UNKNOWN?

### **Sunk-cost bias eval**

¿Ignora correctamente costes hundidos para decisiones futuras?

### **Boundary eval**

¿Evita convertir economics en ranking o playbook?

---

# **90\. EJEMPLO 1 — PAID MEDIA**

Candidate:

> oportunidad de aumentar inversión en un canal rentable.

P4:

capturable value potencial.

P6:

cash/resource requirement.

P7:

risk de CAC deterioration y cash exposure.

P8 debe analizar:

> valor marginal esperado del spend adicional.

No:

> ROAS histórico × presupuesto nuevo.

---

# **91\. EJEMPLO 2 — CRO VS CREATIVE**

Candidate A:

checkout improvement.

Candidate B:

creative performance.

Ambos requieren el mismo equipo de growth.

Existe:

`RESOURCE_CONTENTION`.

Si solo puede abordarse uno:

el valor esperado de B puede convertirse en opportunity cost de elegir A, y viceversa.

P8 no decide todavía cuál gana.

---

# **92\. EJEMPLO 3 — DOS EQUIPOS DISTINTOS**

A requiere engineering.

B requiere creative.

Ambos tienen capacidad.

No existe sacrificio directo.

Aunque A tenga mayor EV:

esto no significa que B deba esperar.

P11 puede concluir posteriormente:

> ejecutar ambos en paralelo.

---

# **93\. EJEMPLO 4 — VALIDACIÓN**

Candidate:

> validar si mobile checkout explica caída de CVR.

El candidate no genera revenue directamente.

Pero la información puede afectar una decisión de €300k.

P8 puede evaluar:

`VALUE_OF_INFORMATION`.

No debe infravalorarlo por no tener revenue directo.

---

# **94\. EJEMPLO 5 — SUNK COST**

Proyecto existente:

€80k ya gastados.

Continuarlo exige:

€30k adicionales.

Valor futuro esperado:

€20k.

Economics futuros:

€20k value

vs

€30k incremental cost.

Los €80k anteriores no justifican continuar.

---

# **95\. EJEMPLO 6 — TAIL RISK**

Candidate A:

EV \= \+€150k.

Pero incluye riesgo contractual irreversible por encima de policy.

Candidate B:

EV \= \+€60k.

A no puede dominar mediante expected value.

El risk gate sigue teniendo precedencia.

---

# **96\. INTERFAZ CON P9**

P8 responde:

> ¿qué economía decisional presenta cada candidato?

P9 responderá:

> ¿encaja con la estrategia, madurez y estado real del negocio?

Un candidate económicamente atractivo puede ser estratégicamente prematuro.

---

# **97\. INTERFAZ CON P10**

P10 podrá consumir:

* EV;  
* NEV;  
* opportunity cost;  
* scarcity;  
* dominance;  
* information value.

Pero no deberá construir:

`priority = EV / effort`

como autoridad universal.

P8 es una dimensión decisional.

No el motor completo.

---

# **98\. INTERFAZ CON P11**

P11 utilizará:

* allocation alternatives;  
* scarce resources;  
* resource contention;  
* economic interactions;  
* complementarities;  
* cannibalization;  
* minimum allocations;

para construir el portfolio activo.

---

# **99\. DEFINITION OF DONE — P8**

P8 está completo cuando el sistema puede responder:

**WHAT VALUE COULD WE REASONABLY EXPECT?**

Existe EV, rango o UNKNOWN.

**WHAT FUTURE COST DO WE INCUR?**

Existen incremental costs.

**WHAT DO WE GIVE UP?**

Existe opportunity cost cuando realmente hay alternativa sacrificada.

**WHICH RESOURCE IS ACTUALLY SCARCE?**

Existe scarcity explícita.

**WHAT IS THE MARGINAL RETURN OF THAT RESOURCE?**

Se calcula cuando existe evidencia.

**ARE RETURNS LINEAR?**

No se asume.

**ARE CANDIDATES ECONOMICALLY INDEPENDENT?**

Se detectan complementariedad y cannibalización.

**DOES VALIDATION ITSELF HAVE VALUE?**

Puede existir value of information.

**ARE WE DOUBLE COUNTING VALUE OR DOWNSIDE?**

Existe protección de lineage.

**WHAT DON'T WE KNOW?**

Las incertidumbres se propagan.

P8 no responde todavía:

> ¿cuál candidato queda primero?

Responde:

> **¿cuál es la economía real de comprometer recursos escasos aquí frente a las alternativas disponibles?**

