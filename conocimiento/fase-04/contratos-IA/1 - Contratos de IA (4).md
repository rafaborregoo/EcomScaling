# **P4 — IMPACTO DECISIONAL / VALUE AT STAKE**

## **0\. Propósito**

P4 define cómo debe representar el sistema el valor empresarial potencialmente afectado por cada candidato.

Su responsabilidad es responder:

> ¿Qué está realmente en juego si este candidato se resuelve, empeora, permanece igual o deja de existir?

P4 NO responde:

* qué candidato debe ir primero;  
* qué ocurre específicamente por esperar → P3;  
* qué bloquea la captura del valor → P5;  
* cuánto esfuerzo cuesta → P6;  
* qué riesgo tiene actuar → P7;  
* cuál es el expected value final → P8;  
* qué encaja estratégicamente mejor → P9;  
* qué acción concreta ejecutar → Fase 5\.

P4 describe:

> **la magnitud y naturaleza del valor empresarial afectado**.

---

# **1\. Principio fundamental**

Debe mantenerse:

**SIZE OF PROBLEM**

≠

**VALUE AT STAKE**

≠

**GROSS VALUE**

≠

**INCREMENTAL VALUE**

≠

**CAPTURABLE VALUE**

≠

**EXPECTED VALUE**

Un ecommerce puede tener un área económicamente enorme cuyo valor incremental disponible sea pequeño.

Y un problema aparentemente pequeño puede controlar una cantidad significativa de valor incremental.

---

# **2\. Entidad principal**

Entidad:

**IMPACT\_ASSESSMENT**

Relación:

`PRIORITY_CANDIDATE`

→ `IMPACT_ASSESSMENT`

Cada evaluación pertenece a:

* un candidate;  
* un prioritization run;  
* un decision context;  
* un periodo de referencia.

P4 será source of truth de la dimensión:

**VALUE AT STAKE**

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `impact_assessment_id` | Sí | identidad |
| `candidate_id` | Sí | candidato |
| `prioritization_run_id` | Sí | ejecución |
| `assessment_state` | Sí | validez |
| `impact_domains[]` | Sí | áreas afectadas |
| `value_components[]` | Sí | componentes de valor |
| `impact_scope` | Sí | alcance |
| `baseline_refs[]` | Condicional | estado actual |
| `counterfactual_refs[]` | Condicional | comparación |
| `shared_value_pool_refs[]` | Opcional | prevención double counting |
| `uncertainties[]` | Opcional | desconocidos |
| `evidence_refs[]` | Sí | soporte |
| `evaluated_at` | Sí | timestamp |
| `policy_version` | Sí | versión |

---

# **4\. VALUE\_COMPONENT**

La unidad elemental será:

**VALUE\_COMPONENT**

Representa una consecuencia empresarial material asociada al candidato.

Ejemplos:

* margen perdido;  
* cash inmovilizado;  
* ventas afectadas;  
* clientes expuestos;  
* capacidad operativa consumida;  
* riesgo sobre revenue recurrente;  
* posibilidad estratégica restringida.

Cada componente deberá evaluarse por separado antes de sintetizar.

---

# **5\. Estructura de VALUE\_COMPONENT**

| Campo | Función |
| ----- | ----- |
| `value_component_id` | identidad |
| `candidate_id` | candidato |
| `value_type` | naturaleza |
| `direction` | upside/downside |
| `measurement_type` | cómo se expresa |
| `baseline_ref` | estado actual |
| `comparison_ref` | estado alternativo |
| `gross_value` | valor bruto si existe |
| `incremental_value` | diferencia atribuible |
| `capturable_value` | parte potencialmente capturable |
| `value_range` | incertidumbre |
| `currency` | si monetario |
| `period` | periodo |
| `evidence_refs[]` | soporte |
| `assumption_refs[]` | supuestos |
| `epistemic_state` | naturaleza del dato |

---

# **6\. VALUE\_TYPE**

Taxonomía inicial:

`REVENUE`

`GROSS_MARGIN`

`CONTRIBUTION_MARGIN`

`PROFIT`

`CASH`

`WORKING_CAPITAL`

`CUSTOMER_VALUE`

`RETENTION_VALUE`

`INVENTORY_VALUE`

`OPERATIONAL_CAPACITY`

`COST_AVOIDANCE`

`RISK_AVOIDANCE_VALUE`

`STRATEGIC_OPTION_VALUE`

`CAPABILITY_VALUE`

`OTHER_MEASURABLE_VALUE`

No debe crearse un enum para cada KPI existente.

`value_type` describe naturaleza económica o empresarial.

La métrica concreta se referencia aparte.

---

# **7\. MONETARY ≠ NON-MONETARY**

P4 debe admitir dos grandes familias:

### **MONETARY**

Puede expresarse responsablemente en dinero.

### **NON\_MONETARY**

Tiene impacto empresarial material pero no existe conversión monetaria defendible.

Ejemplos no monetarios:

* capacidad crítica;  
* dependencia estructural;  
* customer trust;  
* optionality estratégica;  
* resiliencia operativa.

Queda prohibido monetizar automáticamente todo para hacer comparables los candidatos.

---

# **8\. MEASUREMENT\_TYPE**

Estados:

`EXACT`

`CALCULATED`

`ESTIMATED_POINT`

`ESTIMATED_RANGE`

`ORDINAL`

`QUALITATIVE`

`UNKNOWN`

Preferencia:

**rango defendible \> punto inventado**.

---

# **9\. GROSS VALUE**

**GROSS\_VALUE**

representa:

> la totalidad del valor económico asociado al área o flujo afectado.

Ejemplo:

un canal genera:

€500.000 / mes.

Eso NO significa:

> el candidato vale €500.000.

Los €500.000 pueden ser únicamente el gross value expuesto.

---

# **10\. INCREMENTAL VALUE**

**INCREMENTAL\_VALUE**

representa:

> la diferencia atribuible entre el estado relevante actual y un estado alternativo razonable.

Conceptualmente:

`incremental_value = counterfactual_value - baseline_value`

según dirección.

Pero solo podrá calcularse cuando:

* baseline sea válido;  
* counterfactual sea defendible;  
* comparabilidad sea válida.

---

# **11\. COUNTERFACTUAL**

P4 necesita una representación explícita del estado comparativo.

Entidad:

**VALUE\_COUNTERFACTUAL**

No representa todavía una estrategia.

Representa:

> qué estado alternativo utilizamos para medir la diferencia.

Ejemplos:

* performance histórico reciente;  
* benchmark interno;  
* estado previo al deterioro;  
* capacidad contractual;  
* target aprobado;  
* escenario conservador documentado.

---

# **12\. COUNTERFACTUAL ≠ PLAYBOOK**

Ejemplo válido:

> CVR vuelve al rango histórico normal.

Ejemplo inválido:

> rediseñamos PDP, checkout y creatividades.

El primero define un estado.

El segundo prescribe cómo alcanzarlo.

Eso pertenece a Fase 5\.

---

# **13\. COUNTERFACTUAL\_SOURCE**

Todo counterfactual deberá indicar origen:

`OBSERVED_HISTORICAL`

`INTERNAL_BENCHMARK`

`APPROVED_TARGET`

`EXTERNAL_BENCHMARK`

`MODEL_ESTIMATE`

`SCENARIO_ASSUMPTION`

`UNKNOWN`

Su autoridad dependerá de la evidencia.

---

# **14\. THEORETICAL VALUE**

Puede existir:

**THEORETICAL\_VALUE**

Representa:

> valor máximo que existiría bajo condiciones idealizadas o sin considerar límites reales de captura.

Sirve como techo conceptual.

Nunca debe presentarse directamente como:

> valor de la oportunidad.

---

# **15\. CAPTURABLE VALUE**

**CAPTURABLE\_VALUE**

representa:

> parte del valor incremental que podría potencialmente recuperarse o aprovecharse dentro del contexto definido.

Debe mantenerse:

`THEORETICAL_VALUE >= POTENTIAL_CAPTURABLE_VALUE`

cuando ambos sean cuantificables sobre la misma base.

---

# **16\. CAPTURABLE VALUE NO ES EXPECTED VALUE**

Esto es crítico.

P4 NO debe hacer:

`capturable_value × probability_of_success`

Eso pertenece a P8.

P4 puede estimar:

> techo potencialmente capturable dadas las características conocidas del value pool.

P8 decidirá posteriormente:

> cuánto valor esperamos realmente capturar dadas probabilidades, alternativas y opportunity cost.

---

# **17\. CAPTURE ASSUMPTIONS**

Toda estimación de capturable value deberá declarar:

`capture_assumptions[]`.

Ejemplo:

* solo parte del tráfico está afectado;  
* solo determinados SKUs;  
* deterioro parcialmente recuperable;  
* clientes perdidos no recuperables;  
* margen máximo limitado.

Los assumptions deben ser visibles.

---

# **18\. IMPACT SCOPE**

Entidad:

**IMPACT\_SCOPE**

Puede expresar:

* negocio completo;  
* mercado;  
* canal;  
* cohort;  
* customer segment;  
* producto;  
* SKU;  
* proceso;  
* equipo;  
* inventory pool;  
* revenue stream.

P4 debe saber:

> sobre qué universo aplica el valor calculado.

---

# **19\. AFFECTED BASE**

Debe existir cuando proceda:

`affected_base_ref`.

Ejemplos:

* sesiones afectadas;  
* pedidos;  
* clientes;  
* revenue;  
* unidades;  
* horas;  
* inventario.

No copiar innecesariamente la métrica original.

Referenciar source of truth.

---

# **20\. EXPOSURE ≠ LOSS**

Debe mantenerse:

**VALUE EXPOSED**

≠

**VALUE LOST**

Ejemplo:

€1M de revenue puede estar expuesto a un problema.

No significa que el problema destruya €1M.

El contrato debe impedir:

`affected_revenue = estimated_loss`.

---

# **21\. VALUE\_AT\_RISK**

Puede existir:

**VALUE\_AT\_RISK**

como valor potencialmente afectable.

Pero P4 no debe convertir automáticamente exposición en pérdida esperada.

Ejemplo:

€200k de revenue dependen de un proveedor.

Eso representa exposición.

El expected downside requiere probabilidad y riesgo → P7/P8.

---

# **22\. UPSIDE Y DOWNSIDE**

Cada componente deberá declarar:

`direction`.

Valores:

`UPSIDE`

`DOWNSIDE`

`MIXED`

P4 debe poder representar:

* valor recuperable;  
* crecimiento potencial;  
* pérdida evitable;  
* valor protegido.

---

# **23\. VALUE PROTECTION**

Un candidato puede tener valor sin generar revenue adicional.

Ejemplo:

> prevenir churn de una cohorte rentable.

Valor:

`VALUE_PROTECTED`.

No debemos favorecer sistemáticamente iniciativas de crecimiento frente a protección de valor existente.

---

# **24\. COST AVOIDANCE**

Debe distinguirse:

**COST SAVING**

de

**COST AVOIDANCE**.

Cost saving:

reduce coste actualmente existente.

Cost avoidance:

evita un coste futuro que probablemente aparecería.

Ambos requieren baseline/counterfactual distintos.

---

# **25\. CASH IMPACT**

P4 debe permitir diferenciar:

`ECONOMIC_VALUE`

de

`CASH_IMPACT`.

Ejemplo:

una mejora puede aumentar beneficio pero empeorar caja temporalmente.

Por tanto no debe existir un único campo:

`financial_impact`.

---

# **26\. REVENUE ≠ PROFIT**

Queda prohibido transformar:

€100k de revenue incremental

en

€100k de valor económico.

Cuando sea relevante deberán utilizarse:

* gross margin;  
* contribution margin;  
* variable costs;  
* refunds;  
* fulfillment;  
* payment fees;  
* otros costes atribuibles.

Pero P4 solo utilizará datos disponibles.

No inventará márgenes faltantes.

---

# **27\. MARGIN BASIS**

Toda valoración monetaria basada en margen deberá declarar:

`margin_basis`.

Ejemplos:

`GROSS_MARGIN`

`CONTRIBUTION_MARGIN_1`

`CONTRIBUTION_MARGIN_2`

`NET_PROFIT`

o referencias equivalentes definidas por el sistema.

Esto evita comparar:

€50k revenue

contra

€30k contribution margin

como si fueran la misma magnitud.

---

# **28\. PERIOD**

Todo valor deberá incluir periodo.

Ejemplo:

€50k

sin periodo

es contractual y decisionalmente incompleto.

Debe declararse:

* diario;  
* semanal;  
* mensual;  
* anual;  
* lifetime;  
* window-specific;  
* one-off.

Preferentemente mediante fechas concretas cuando existan.

---

# **29\. STOCK VS FLOW**

P4 debe distinguir:

`STOCK_VALUE`

de

`FLOW_VALUE`.

Ejemplo:

€300k de inventario inmovilizado

es stock.

€20k/mes de margen perdido

es flujo.

No deben sumarse sin normalización temporal/económica apropiada.

---

# **30\. ONE-OFF VS RECURRING**

Cada value component deberá indicar:

`value_recurrence`.

Estados:

`ONE_OFF`

`RECURRING`

`TEMPORARY`

`SEASONAL`

`UNKNOWN`

Esto prepara correctamente P8.

---

# **31\. DURABILITY**

El impacto potencial puede durar:

* una única transacción;  
* semanas;  
* meses;  
* indefinidamente.

Puede existir:

`expected_value_duration`

como:

* rango;  
* periodo;  
* UNKNOWN.

No debe inferirse duración perpetua.

---

# **32\. ANNUALIZATION GUARDRAIL**

Queda prohibido:

> detectar una mejora durante 7 días y multiplicarla automáticamente ×52.

Toda anualización deberá:

* estar explícitamente autorizada;  
* declarar assumptions;  
* considerar estacionalidad;  
* reconocer incertidumbre.

---

# **33\. VALUE RANGE**

Cuando exista incertidumbre:

`value_range`

deberá contener:

* lower bound;  
* upper bound;  
* unidad;  
* periodo;  
* metodología;  
* assumptions.

No debe producirse midpoint automáticamente como verdad.

---

# **34\. RANGE SEMANTICS**

El rango debe declarar qué representa:

`PLAUSIBLE_RANGE`

`OBSERVED_RANGE`

`SCENARIO_RANGE`

`CONFIDENCE_INTERVAL`

solo si estadísticamente corresponde.

Nunca llamar `confidence interval` a un rango subjetivo.

---

# **35\. QUALITATIVE IMPACT**

Cuando no pueda cuantificarse:

pueden utilizarse categorías estructuradas.

Ejemplo:

`MATERIAL`

`LIMITED`

`SYSTEMIC`

etc.

Pero únicamente si una policy define su significado.

No deben usarse:

HIGH / MEDIUM / LOW

como maquillaje de un desconocido.

---

# **36\. SYSTEMIC IMPACT**

Algunos candidatos afectan múltiples sistemas.

P4 podrá declarar:

`impact_propagation_refs[]`

cuando exista evidencia de que el impacto se extiende a:

* adquisición;  
* margen;  
* retention;  
* fulfillment;  
* cash;  
* otros sistemas.

Esto no significa sumar todos los impactos automáticamente.

---

# **37\. DIRECT VS INDIRECT IMPACT**

Cada value component tendrá:

`impact_path`.

Valores:

`DIRECT`

`INDIRECT`

`SECOND_ORDER`

`UNKNOWN`

Ejemplo:

stockout:

DIRECT:

ventas perdidas.

INDIRECT:

deterioro de customer experience.

SECOND\_ORDER:

posible reducción futura de repeat rate.

Los tres requieren evidencias distintas.

---

# **38\. CAUSALITY REQUIREMENT**

Para atribuir `incremental_value` a un candidato debe existir una base causal suficiente o declararse la incertidumbre.

Correlación por sí sola no autoriza:

> este problema causa €X.

P4 debe respetar:

CORRELATION ≠ CAUSATION.

---

# **39\. ATTRIBUTION STATE**

Estados:

`DIRECTLY_ATTRIBUTABLE`

`SUPPORTED_ATTRIBUTION`

`PARTIAL_ATTRIBUTION`

`UNCERTAIN_ATTRIBUTION`

`NOT_ATTRIBUTABLE`

Esto permite valorar sin fingir certeza causal.

---

# **40\. SHARED VALUE POOL**

Entidad:

**SHARED\_VALUE\_POOL**

Representa:

> un mismo valor económico que puede estar relacionado con varios candidatos.

Ejemplo:

€100k de margin leakage

puede estar asociado simultáneamente a:

* discounting;  
* CAC;  
* shipping subsidies.

Los tres candidatos no pueden reclamar automáticamente €100k cada uno.

---

# **41\. Estructura SHARED\_VALUE\_POOL**

Campos:

* `shared_value_pool_id`;  
* `value_type`;  
* `total_value`;  
* `candidate_refs[]`;  
* `attribution_state`;  
* `overlap_rule`;  
* `evidence_refs[]`.

---

# **42\. DOUBLE COUNTING HARD RULE**

Si dos value components comparten total o parcialmente el mismo value pool:

> el sistema no podrá agregarlos como independientes sin resolver previamente el solapamiento.

Esto será una invariante.

---

# **43\. OVERLAP\_STATE**

Valores:

`NONE`

`PARTIAL`

`SUBSTANTIAL`

`FULL`

`UNKNOWN`

UNKNOWN debe impedir agregación ingenua.

---

# **44\. VALUE DECOMPOSITION**

Cuando el valor pueda descomponerse de forma defendible:

**TOTAL VALUE**

→ COMPONENT A  
→ COMPONENT B  
→ COMPONENT C

P4 puede mantener dichos componentes separados.

Ejemplo:

contribution margin erosion:

* higher CAC;  
* discount increase;  
* fulfillment cost.

Solo si existe atribución suficiente.

---

# **45\. NO ARBITRARY ALLOCATION**

Queda prohibido hacer:

> como hay tres candidatos, asignamos 33,3 % del valor a cada uno.

Si attribution es desconocida:

`UNKNOWN`.

---

# **46\. BASELINE**

Toda valoración incremental debe utilizar:

`baseline_ref`.

El baseline puede ser:

* estado actual;  
* histórico;  
* periodo equivalente;  
* cohort comparable;  
* business plan aprobado.

Debe registrarse su tipo.

---

# **47\. BASELINE\_VALIDITY**

Estados:

`VALID`

`VALID_WITH_LIMITATIONS`

`STALE`

`NON_COMPARABLE`

`UNKNOWN`

Un baseline no comparable no puede utilizarse para calcular incremental value sin advertencia o ajuste explícito.

---

# **48\. COUNTERFACTUAL VALIDITY**

Igualmente:

`VALID`

`VALID_WITH_LIMITATIONS`

`SPECULATIVE`

`UNSUPPORTED`

`UNKNOWN`

Si counterfactual es speculative:

la valoración debe conservar dicha limitación.

---

# **49\. IMPACT CONFIDENCE**

Siguiendo P0:

`SUFFICIENT_TO_ASSESS`

`SUFFICIENT_WITH_LIMITATIONS`

`VALIDATION_REQUIRED`

`INSUFFICIENT`

`UNKNOWN`

No inventar:

`impact_confidence = 78%`.

---

# **50\. VALUE EVIDENCE**

Toda cifra material deberá poder enlazar a:

* metric snapshot;  
* transaction data;  
* finance data;  
* customer data;  
* inventory data;  
* experiment;  
* forecast;  
* approved business assumption;  
* inferencia explícita.

---

# **51\. SOURCE PRIORITY**

Cuando existan valores contradictorios:

P4 no decidirá arbitrariamente cuál usar.

Debe aplicar una política explícita basada en:

* autoridad;  
* frescura;  
* granularidad;  
* metodología;  
* comparabilidad.

Si el conflicto sigue siendo material:

`REQUIRES_VALIDATION`.

---

# **52\. IMPACT SCENARIO**

Puede existir:

**IMPACT\_SCENARIO**

para representar alternativas.

Ejemplo:

`CONSERVATIVE`

`BASE`

`UPPER`

Pero esas etiquetas solo son válidas si cada escenario contiene assumptions explícitos.

No deben convertirse en tres números inventados.

---

# **53\. SCENARIO ≠ PROBABILITY**

Tres escenarios no implican:

* 25 %;  
* 50 %;  
* 25 %.

Probabilidad pertenece a P8 cuando exista base.

---

# **54\. VALUE CEILING**

P4 puede calcular:

`value_ceiling`

cuando exista un límite objetivo.

Ejemplo:

si solo €40k de contribution margin están afectados:

una oportunidad no puede reclamar €200k de recuperación dentro del mismo periodo sin justificar una segunda fuente de valor.

---

# **55\. VALUE FLOOR**

Puede existir:

`defensible_value_floor`

solo cuando exista evidencia suficiente.

No es obligatorio.

Un desconocido no necesita artificialmente:

`floor = 0`.

---

# **56\. NEGATIVE VALUE**

P4 debe permitir valores negativos.

No todas las oportunidades generan upside.

Un candidato puede representar:

* pérdida;  
* exposición;  
* destrucción de margen;  
* cash leakage.

La dirección debe ser explícita.

---

# **57\. CROSS-METRIC COMPARABILITY**

No todos los impactos pueden sumarse.

Ejemplo:

€50k de margin

* 

3.000 horas operativas

* 

riesgo reputacional

no produce un único:

`impact = 87`.

P4 conserva dimensiones.

P10 deberá sintetizar sin destruirlas.

---

# **58\. IMPACT DOMAIN**

Metadata funcional:

`FINANCIAL`

`CUSTOMER`

`OPERATIONAL`

`STRATEGIC`

`CAPABILITY`

`COMPLIANCE`

`OTHER`

Puede haber varios por candidato.

No determina prioridad.

---

# **59\. CUSTOMER IMPACT**

Cuando exista:

puede expresarse mediante:

* customers affected;  
* cohorts;  
* LTV exposure;  
* churn exposure;  
* service degradation.

Pero no deberá convertir automáticamente customer count en monetary value.

---

# **60\. OPERATIONAL IMPACT**

Puede incluir:

* horas perdidas;  
* throughput;  
* backlog;  
* error rate;  
* capacity consumed;  
* service level.

Si posteriormente puede monetizarse con una metodología válida, podrá existir un componente monetario relacionado.

No automáticamente.

---

# **61\. STRATEGIC OPTION VALUE**

Algunas decisiones preservan o crean opciones futuras.

Ejemplo:

una capability que habilita expansión.

Puede existir:

`STRATEGIC_OPTION_VALUE`

pero normalmente será:

* cualitativo;  
* scenario-based;  
* range-based.

No debe monetizarse artificialmente.

---

# **62\. VALUE OF INFORMATION**

Un candidato P2 de tipo `UNCERTAINTY` puede tener impacto.

Pero P4 no debería calcular todavía expected value of information completo.

Puede registrar:

* decision value exposed;  
* decisions blocked;  
* size of affected value pool.

P8 podrá valorar posteriormente el EV de reducir esa incertidumbre.

---

# **63\. TEMPORAL INTERFACE CON P3**

P3 puede entregar:

`cost_of_delay`.

P4 no debe sumarlo automáticamente al impact.

Ejemplo:

* total capturable value \= €100k;  
* cost of delay \= €10k/mes.

No significa:

€110k de impacto.

Puede tratarse del mismo pool económico en distintas perspectivas.

---

# **64\. CONSTRAINT INTERFACE CON P5**

P5 puede revelar que parte del theoretical value no es accesible por constraints.

En ese caso:

P4 puede ser recalculado o enriquecido para reducir:

`potential_capturable_value`.

Pero la existencia y autoridad del constraint pertenece a P5.

---

# **65\. EFFORT INTERFACE CON P6**

P4 no resta:

* horas;  
* headcount;  
* coste de implementación.

Esos costes pertenecen a P6/P8.

Por tanto:

`capturable_value`

NO significa:

`net_value_after_effort`.

---

# **66\. RISK INTERFACE CON P7**

P4 no debe multiplicar valor por:

`probability_of_failure`.

Tampoco descontar downside probabilístico.

Eso pertenece a riesgo/EV.

---

# **67\. EXPECTED VALUE INTERFACE CON P8**

P4 entrega:

* value pools;  
* incremental value;  
* capturable ceiling;  
* ranges;  
* assumptions;  
* overlap;  
* attribution.

P8 podrá posteriormente construir:

> expected economic value de priorizar una alternativa.

P8 NO deberá reconstruir P4 desde cero.

---

# **68\. MATERIALITY**

P4 puede utilizar:

`materiality_state`.

Ejemplos:

`MATERIAL`

`POTENTIALLY_MATERIAL`

`IMMATERIAL`

`UNKNOWN`

Solo si existen thresholds configurados por:

* negocio;  
* tamaño;  
* objective;  
* period.

No existe una definición universal de “material”.

---

# **69\. MATERIALITY ≠ PRIORITY**

Un impacto material puede no ser prioritario:

* no urgente;  
* bloqueado;  
* enorme esfuerzo;  
* bajo probability of capture.

Un impacto relativamente pequeño puede ganar prioridad por otras razones.

---

# **70\. IMPACT ASSESSMENT STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT_INFORMATION`

`NOT_APPLICABLE`

`STALE`

`INVALID`

---

# **71\. OUTPUT DE P4**

Contrato:

**IMPACT\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `assessment_state` | validez |
| `impact_domain[]` | áreas |
| `value_component_refs[]` | componentes |
| `gross_value_refs[]` | exposición |
| `incremental_value_refs[]` | diferencia |
| `capturable_value_refs[]` | potencial capturable |
| `shared_value_pool_refs[]` | overlaps |
| `materiality_state` | si aplicable |
| `attribution_state` | causalidad |
| `baseline_refs[]` | referencias |
| `counterfactual_refs[]` | comparación |
| `uncertainties[]` | desconocidos |
| `warnings[]` | limitaciones |
| `evidence_refs[]` | soporte |
| `rule_trace_refs[]` | reglas |

---

# **72\. REASON CODES**

Familias:

`IMPACT.*`

`VALUE.*`

`ATTRIBUTION.*`

`BASELINE.*`

`COUNTERFACTUAL.*`

Ejemplos:

`VALUE.GROSS_ONLY`

`VALUE.INCREMENTAL_CALCULATED`

`VALUE.CAPTURABLE_ESTIMATED`

`VALUE.CAPTURABLE_UNKNOWN`

`VALUE.SHARED_POOL`

`VALUE.POTENTIAL_DOUBLE_COUNT`

`VALUE.NON_MONETARY`

`VALUE.RANGE_REQUIRED`

`ATTRIBUTION.UNCERTAIN`

`BASELINE.STALE`

`BASELINE.NON_COMPARABLE`

`COUNTERFACTUAL.SPECULATIVE`

`IMPACT.MATERIAL`

`IMPACT.INSUFFICIENT_INFORMATION`

---

# **73\. INVARIANTES P4**

1. Gross value no equivale a incremental value.  
2. Incremental value no equivale a capturable value.  
3. Capturable value no equivale a expected value.  
4. Revenue no equivale a profit.  
5. Exposure no equivale a loss.  
6. Cost of delay no debe sumarse automáticamente al total impact.  
7. Shared value pools no pueden agregarse varias veces.  
8. UNKNOWN no equivale a cero.  
9. Un rango no debe convertirse automáticamente en midpoint.  
10. Un escenario no implica probabilidad.  
11. Un valor monetario debe incluir periodo y currency.  
12. Un flow y un stock no se suman ingenuamente.  
13. No se anualiza sin regla explícita.  
14. No se monetiza un impacto cualitativo sin metodología.  
15. Toda atribución material conserva evidencia causal.  
16. Correlation no equivale a causation.  
17. Ningún candidate puede reclamar más valor que su value ceiling sin evidencia adicional.  
18. P4 no descuenta esfuerzo.  
19. P4 no calcula expected value.  
20. P4 no prescribe soluciones.

---

# **74\. PRECONDICIONES**

P4 necesita:

* candidate válido P2;  
* decision context P1;  
* scope definido;  
* métricas/fuentes disponibles;  
* periodo de evaluación;  
* baseline cuando el cálculo lo requiera.

P4 puede producir:

`INSUFFICIENT_INFORMATION`

si no existe base económica suficiente.

Eso no es un fallo.

---

# **75\. POSTCONDICIONES**

P4 termina correctamente cuando el sistema conoce, hasta donde permite la evidencia:

* qué tipos de valor están afectados;  
* cuánto valor bruto existe;  
* qué parte es incremental;  
* qué parte podría ser capturable;  
* qué no puede monetizarse;  
* qué value pools se solapan;  
* qué assumptions existen;  
* qué parte es incierta;  
* qué baseline y counterfactual se utilizaron.

---

# **76\. FAILURE MODES**

## **Revenue inflation**

Canal genera €1M.

Motor concluye:

> oportunidad \= €1M.

**Prevención:** gross vs incremental.

---

## **Perfect-recovery assumption**

Existe pérdida de €100k.

Motor concluye:

> recuperaremos €100k.

**Prevención:** capturable value separado.

---

## **EV leakage**

Motor multiplica por probability of success.

**Prevención:** reservado a P8.

---

## **Double counting**

Tres candidatos reclaman el mismo margen deteriorado.

**Prevención:** shared value pools.

---

## **Arbitrary annualization**

Mejora semanal ×52.

**Prevención:** annualization guardrail.

---

## **Revenue/profit confusion**

Se comparan revenue y margin como equivalentes.

**Prevención:** value type y margin basis.

---

## **Monetary coercion**

Se inventa precio a resiliencia, reputación o optionality.

**Prevención:** non-monetary impact válido.

---

## **Attribution hallucination**

Correlación se transforma en €X de impacto causal.

**Prevención:** attribution state.

---

## **Best-case prioritization**

Solo se utiliza scenario superior.

**Prevención:** scenario \+ assumptions \+ ranges.

---

## **Strategy contamination**

Counterfactual contiene una solución.

**Prevención:** state-based counterfactual.

---

# **77\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| €100k revenue afectado | gross/exposed value, no incremental automático |
| pérdida demostrada €20k | incremental downside permitido |
| recovery desconocido | capturable UNKNOWN |
| rango €10k–€30k | conservar rango |
| midpoint no solicitado | no crear €20k como verdad |
| mismo value pool en dos candidates | overlap detectado |
| overlap desconocido | no agregar |
| revenue \+ margin | mantener value types |
| valor sin periodo | invalidación/validation |
| valor sin currency monetaria | validation |
| qualitative strategic impact | permitido |
| monetary conversion sin método | rechazo |
| causalidad incierta | attribution uncertain |
| baseline stale | limitation |
| counterfactual especulativo | limitation |
| 7 días de uplift | no anualizar automáticamente |
| theoretical €200k, ceiling €50k | capturable \<= ceiling |
| effort elevado | no descontar en P4 |
| probability 40% | no aplicar en P4 |
| high impact | no convertir en high priority |

---

# **78\. EVALS IA**

### **Gross/incremental separation**

¿Evita usar revenue total como oportunidad incremental?

### **Capturability eval**

¿Evita asumir recuperación del 100 %?

### **Attribution eval**

¿Distingue causalidad de correlación?

### **Double-counting eval**

¿Reconoce value pools compartidos?

### **Range discipline eval**

¿Conserva rangos sin inventar puntos?

### **Financial semantics eval**

¿Distingue revenue, margin, profit y cash?

### **Annualization eval**

¿Evita extrapolaciones no justificadas?

### **Non-monetary impact eval**

¿Mantiene impactos cualitativos cuando no existe monetización defendible?

### **Strategy boundary eval**

¿Evita introducir playbooks dentro del counterfactual?

---

# **79\. EJEMPLO 1 — CAC**

Datos:

* paid media revenue \= €500k/mes;  
* CAC ha aumentado;  
* contribution margin se deteriora €35k/mes frente al baseline comparable.

Incorrecto:

`impact = €500k`.

Correcto:

**Gross/exposed value**

€500k revenue/mes.

**Incremental downside**

≈ €35k contribution margin/mes, si la atribución está soportada.

**Capturable value**

UNKNOWN o rango defendible.

P4 no decide cuánto podremos recuperar.

---

# **80\. EJEMPLO 2 — STOCKOUT**

Candidate:

> stockouts recurrentes de SKU principal.

Puede existir:

**Revenue exposed**

€150k/mes.

**Estimated incremental lost revenue**

€20k–€30k/mes.

**Contribution margin effect**

€8k–€12k/mes.

No sumar:

€150k \+ €30k \+ €12k.

Son distintas representaciones parcialmente superpuestas.

---

# **81\. EJEMPLO 3 — RETENTION**

Candidate:

> deterioro de repeat purchase.

Gross value:

customer base completa.

Impact value:

solo diferencia incremental frente a cohortes/baseline comparables.

Capturable value:

debe considerar la parte potencialmente recuperable.

No asumir:

> todo LTV futuro perdido puede recuperarse.

---

# **82\. EJEMPLO 4 — CAPABILITY GAP**

Candidate:

> ausencia de forecasting fiable de inventario.

Puede no existir monetización defendible.

P4 puede registrar:

**OPERATIONAL\_CAPACITY**

impact material.

**INVENTORY\_VALUE**

value pool potencialmente expuesto.

**CASH**

posible exposición.

Pero no inventar:

> impacto \= €127.450.

---

# **83\. EJEMPLO 5 — DOS CANDIDATOS, MISMO VALUE POOL**

Candidate A:

> discounting excesivo.

Candidate B:

> contribution margin deteriorado.

Si ambos están parcialmente describiendo:

€60k/mes de margin erosion,

P4 debe crear:

`SHARED_VALUE_POOL`.

Nunca:

A \= €60k  
B \= €60k  
Total \= €120k.

---

# **84\. INTERFAZ CON P5**

P4 entrega el valor potencial.

P5 preguntará:

> ¿qué constraints y dependencias impiden o condicionan capturarlo?

Un constraint posterior puede reducir lo realmente accesible.

---

# **85\. INTERFAZ CON P6**

P4 dice:

> potencialmente hay €X de valor.

P6 dice:

> hacen falta estos recursos/capacidad.

P4 no divide valor entre esfuerzo.

---

# **86\. INTERFAZ CON P7**

P4 dice:

> esto es lo que está en juego.

P7 preguntará:

> ¿qué podemos perder actuando o no actuando?

No deben fusionarse.

---

# **87\. INTERFAZ CON P8**

Esta frontera es especialmente importante.

P4 proporciona:

**VALUE SPACE**

P8 construirá:

**DECISIONAL ECONOMICS**

P8 podrá combinar:

* capturable value;  
* probability;  
* resource cost;  
* opportunity cost;  
* alternatives;  
* uncertainty.

Solo entonces podrá hablarse propiamente de expected value.

---

# **88\. INTERFAZ CON P10**

P10 podrá utilizar P4 como:

**VALUE DIMENSION**

pero nunca mediante:

> mayor € \= automáticamente mayor prioridad.

Porque todavía existen:

* urgency;  
* constraints;  
* dependencies;  
* feasibility;  
* risk;  
* confidence;  
* strategic fit.

---

# **89\. DEFINITION OF DONE — P4**

P4 está completo cuando el sistema puede responder:

**WHAT VALUE IS EXPOSED?**

Existe gross/exposed value.

**WHAT PART IS ACTUALLY DIFFERENT?**

Existe incremental value o UNKNOWN.

**WHAT PART COULD POTENTIALLY BE CAPTURED?**

Existe capturable value o UNKNOWN.

**ARE WE TALKING ABOUT REVENUE, MARGIN, PROFIT OR CASH?**

La semántica financiera es explícita.

**OVER WHAT PERIOD?**

Existe periodo.

**WHAT IS THE BASELINE?**

Existe referencia.

**WHAT ARE WE COMPARING AGAINST?**

Existe counterfactual.

**HOW MUCH IS DIRECTLY ATTRIBUTABLE?**

Existe attribution state.

**ARE MULTIPLE CANDIDATES CLAIMING THE SAME VALUE?**

Existen shared value pools.

**WHAT CANNOT BE RESPONSIBLY MONETIZED?**

Se preserva impacto cualitativo.

**WHAT DON'T WE KNOW?**

La incertidumbre permanece visible.

P4 no responde todavía:

> ¿merece la pena hacer algo?

Responde únicamente:

> **¿cuánto y qué tipo de valor empresarial está realmente en juego?**

