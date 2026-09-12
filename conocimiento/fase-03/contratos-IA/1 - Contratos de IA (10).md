D10 — SEVERIDAD E IMPACTO — CONTRATO / RUNTIME

0\. Propósito  
D10 recibe el diagnóstico ya contextualizado y debe determinar cuánto daño empresarial existe, cuánto está acumulándose y cuánto valor permanece expuesto. D10 no decide qué atacar primero ni recomienda acciones.

Distinciones obligatorias:  
HEALTH ≠ SEVERITY ≠ IMPACT ≠ PRIORITY  
MAGNITUDE OF METRIC CHANGE ≠ BUSINESS SEVERITY  
ROOT\_CAUSE\_CONFIDENCE ≠ IMPACT\_CONFIDENCE ≠ SEVERITY\_CONFIDENCE  
ROOT\_CAUSE\_REVERSIBILITY ≠ IMPACT\_RECOVERABILITY  
CURRENT\_IMPACT ≠ FUTURE\_RISK  
OPPORTUNITY\_COST ≠ REALIZED\_LOSS  
LOCAL\_SEVERITY ≠ BUSINESS\_SEVERITY

La prioridad pertenece a Fase 4\.

1\. Inputs mínimos  
D10 debe consumir, cuando existan:  
\- diagnostic\_id y diagnostic target.  
\- affected\_scope.  
\- root cause / immediate causes / constraint desde D9.  
\- business exposure y capability criticality.  
\- data quality y confidence caps de D1.  
\- contexto y baseline válidos de D2.  
\- maturity/complexity de D3.  
\- health de D4.  
\- magnitude, velocity, persistence y trajectory de D5.  
\- causal paths / blast radius de D7.  
\- hipótesis y alternativas cuando la causa no esté cerrada.  
\- timestamps, duration y evidencias de impacto observadas.

La ausencia de ROOT\_CAUSE confirmada no bloquea el cálculo de impacto cuando existe evidencia directa suficiente del daño.

2\. Escala canónica de severidad  
SEVERITY:  
INFO  
LOW  
MODERATE  
HIGH  
CRITICAL  
BUSINESS\_THREAT

Reglas semánticas mínimas:  
\- INFO: condición relevante sin daño material actual.  
\- LOW: impacto limitado/localizado.  
\- MODERATE: daño empresarial real pero contenido.  
\- HIGH: daño material sobre una parte significativa del negocio.  
\- CRITICAL: deterioro severo de una función central o exposición económica importante.  
\- BUSINESS\_THREAT: reservado para amenazas materiales a continuidad, liquidez, capacidad de transaccionar, confianza crítica del cliente o continuidad operativa/legal.

BUSINESS\_THREAT debe ser excepcional y estar soportado por evidencia de continuidad o supervivencia operativa/económica; no puede asignarse por lenguaje alarmista ni por una sola métrica fuera de objetivo.

3\. Impact Vector  
Todo diagnóstico evaluable debe producir un vector multidimensional antes de sintetizar una severidad global.

IMPACT\_VECTOR  
revenue  
contribution  
cash  
customer  
operations  
brand  
strategic  
continuity

Cada dimensión puede tener:  
\- status/severity propia.  
\- current impact.  
\- potential/forward impact.  
\- evidence.  
\- confidence.  
\- scope.  
\- quantification cuando sea fiable.

No reducir el impacto a revenue ni a un score opaco único.

4\. Impact Type  
IMPACT\_TYPE:  
REALIZED\_LOSS  
EFFICIENCY\_LOSS  
MARGIN\_COMPRESSION  
CASH\_ABSORPTION  
CUSTOMER\_HARM  
OPERATIONAL\_LOAD  
CONTINUITY\_RISK  
OPPORTUNITY\_COST  
FUTURE\_RISK

Impact lifecycle / temporal classification:  
REALIZED  
ONGOING  
POTENTIAL  
PROJECTED  
UNKNOWN

Measurement layer:  
OBSERVED  
ESTIMATED  
INFERRED  
FORECAST

Estas capas deben permanecer visibles. ESTIMATED, INFERRED y FORECAST nunca se presentan como hechos observados.

5\. Continuity Risk  
CONTINUITY\_RISK:  
NONE  
LOW  
MODERATE  
HIGH  
IMMINENT

Continuity puede dominar la severidad global aunque revenue actual todavía sea bajo cuando existe evidencia de amenaza a liquidez, capacidad de pago, checkout, fulfillment crítico u otra función necesaria para continuar operando.

6\. Scope y Business Exposure  
IMPACT\_SCOPE:  
GLOBAL  
MARKET  
CHANNEL  
PRODUCT  
CUSTOMER\_SEGMENT  
DEVICE  
OPERATION  
FUNCTION

EXPOSURE  
\- dimension  
\- value  
\- denominator  
\- period  
\- confidence

El denominador debe corresponder al fenómeno evaluado: revenue share, gross profit share, contribution share, spend share, order share, customer share, traffic share, inventory value share u otro denominador explícito y justificado.

Una severidad local extrema no puede globalizarse automáticamente. Antes de declarar BUSINESS CRITICAL/CRITICAL global debe probarse que el alcance afecta una parte material del negocio o una función crítica de continuidad.

7\. Propagación y Blast Radius  
Impact propagation:  
DIRECT\_IMPACT  
SECOND\_ORDER\_IMPACT  
CASCADE\_RISK

PROPAGATION\_RISK:  
LOW  
MEDIUM  
HIGH  
SYSTEMIC

D10 debe utilizar los caminos causales válidos de D7/D9 para estimar blast radius y efectos downstream.

Regla de contabilidad causal:  
Un mismo daño no puede contarse varias veces por aparecer en distintos nodos de la misma cadena.

PRIMARY\_IMPACT y DOWNSTREAM\_IMPACT deben mantenerse separados.

Impact Accounting Boundary debe declarar qué se está contando. Revenue loss y contribution loss son vistas económicas relacionadas y no se suman como si fueran pérdidas independientes salvo que exista un modelo contable que lo justifique.

8\. Duración, Persistencia y Trajectory  
DURATION\_CLASS:  
MINUTES  
HOURS  
DAYS  
WEEKS  
MONTHS  
CHRONIC

TRAJECTORY consumida:  
IMPROVING  
STABLE  
DETERIORATING  
RAPIDLY\_DETERIORATING  
RECOVERING  
VOLATILE  
UNKNOWN

La duración y la trajectory modifican la severidad, pero un fallo de critical path puede ser CRITICAL inmediatamente aunque lleve pocos minutos.

9\. Reversibility y Recoverability  
REVERSIBILITY:  
EASY  
MODERATE  
DIFFICULT  
IRREVERSIBLE\_OR\_LONG\_LIVED  
UNKNOWN

IMPACT\_RECOVERABILITY:  
FULLY\_RECOVERABLE  
PARTIALLY\_RECOVERABLE  
MOSTLY\_IRREVERSIBLE  
UNKNOWN

Debe distinguirse siempre la facilidad de corregir la causa de la capacidad de recuperar el daño ya producido.

10\. Time-to-Damage y Forward Severity  
TIME\_TO\_DAMAGE:  
IMMEDIATE  
HOURS  
DAYS  
WEEKS  
MONTHS  
UNKNOWN

Cuando pueda estimarse, registrar TIME\_TO\_CRITICAL\_STATE.

SEVERITY\_HORIZON soportado:  
NOW  
7D  
30D  
90D

FORWARD\_SEVERITY debe incluir confidence. No se generarán horizontes ni forecasts si el baseline o la proyección no son suficientemente fiables.

CURRENT\_CONFIRMED\_IMPACT y CREDIBLE\_WORST\_CASE deben permanecer separados.

Worst credible case solo puede existir si es causalmente plausible y cuenta con evidencia suficiente; no se permite catastrophizing.

11\. Severity Profile  
SEVERITY\_PROFILE  
\- acute  
\- cumulative  
\- forward\_risk  
\- structural  
\- overall

La severidad aguda, acumulada y estructural no son equivalentes. Una fuga pequeña mantenida durante meses puede producir más daño acumulado que un incidente breve de severidad aguda alta.

12\. Agregación de severidad  
OVERALL\_SEVERITY se calcula después del vector multidimensional.

Prohibido:  
severity \= average(dimensions)

La agregación debe considerar como mínimo:  
\- impact magnitude.  
\- business exposure.  
\- critical-path status.  
\- duration.  
\- trajectory.  
\- propagation risk.  
\- continuity risk.  
\- reversibility.  
\- recoverability.  
\- buffers / resilience.  
\- confidence.

Critical Dimension Dominance:  
Una dimensión de continuidad o critical path puede dominar la severidad global cuando existe evidencia suficiente.

La implementación puede usar reglas/weights configurables, pero debe conservar las dimensiones originales y la explicación de por qué se obtuvo la severidad final.

13\. Severity Rule Registry  
SEVERITY\_RULE  
\- diagnostic\_family  
\- impact\_dimension  
\- threshold\_type  
\- criticality  
\- escalation\_conditions  
\- deescalation\_conditions  
\- applicable\_scope  
\- version

Threshold sources permitidos:  
HARD\_TECHNICAL  
BUSINESS\_SPECIFIC  
HISTORICAL  
ECONOMIC  
CONTEXTUAL

No aplicar thresholds universales cuando el efecto depende de business exposure, economics, contexto o criticality.

14\. Impact Quantification  
QUANTIFICATION\_LEVEL:  
EXACT  
ESTIMATED  
RANGE  
DIRECTIONAL  
UNKNOWN

Reglas:  
\- EXACT solo cuando el dato es directamente calculable y fiable.  
\- ESTIMATED debe exponer método, baseline y assumptions.  
\- RANGE es preferible a falsa precisión cuando existe incertidumbre material.  
\- DIRECTIONAL se usa cuando solo puede sostenerse dirección/magnitud cualitativa.  
\- UNKNOWN es una salida válida. No inventar.

Si existe cálculo fiable: code calculates; LLM explains.  
El LLM no debe adivinar impacto financiero.

15\. IMPACT\_ESTIMATE  
IMPACT\_ESTIMATE  
\- metric  
\- impact\_type  
\- measurement\_layer  
\- estimated\_value  
\- lower\_bound  
\- upper\_bound  
\- unit  
\- method  
\- baseline  
\- period  
\- confidence  
\- assumptions  
\- source\_evidence

Un counterfactual solo puede utilizarse cuando el baseline/contexto es suficientemente fiable. La confianza del counterfactual debe acompañar la estimación.

Impact Confidence Cap:  
D1 y D2 pueden limitar la confidence máxima de una estimación. Un baseline degradado reduce impact\_confidence aunque el problema sea real.

16\. Rates y acumulación  
Cuando los datos lo permitan D10 puede calcular:  
LOSS\_PER\_HOUR  
LOSS\_PER\_DAY  
LOSS\_PER\_WEEK  
CONTRIBUTION\_LOSS\_RATE  
CASH\_BURN\_RATE  
CUSTOMER\_DAMAGE\_RATE  
OPERATIONS\_DAMAGE\_RATE  
CUMULATIVE\_IMPACT

Debe poder registrar impact acceleration por separado del nivel actual.

Periodos abiertos, settlement lag y late-arriving data siguen las reglas de D1/D2; no se extrapolan como periodos cerrados.

17\. Opportunity Cost y Future Risk  
OPPORTUNITY\_COST no es REALIZED\_LOSS.

Un constraint puede impedir capturar crecimiento sin que exista revenue perdido confirmado. En ese caso se representará como oportunidad restringida/forward impact, con confidence propia.

No calcular probabilidades numéricas falsas. Si no existe un modelo probabilístico calibrado, utilizar escenarios/rangos y likelihood cualitativa.

LIKELIHOOD:  
LOW  
MEDIUM  
HIGH  
UNKNOWN

La likelihood puede derivar de trajectory, leading indicators, known constraints e historical recurrence.

18\. Confidence Contract  
Mantener separadas como mínimo:  
problem\_confidence  
root\_cause\_confidence  
impact\_confidence  
severity\_confidence

Reglas:  
\- Severity puede ser CRITICAL con root\_cause\_confidence LOW/INSUFFICIENT si el daño está directamente observado.  
\- Impact confidence no eleva root cause confidence.  
\- Una causa muy confirmada no hace fiable automáticamente una proyección de impacto.  
\- Alta incertidumbre no equivale automáticamente a baja severidad.  
\- Impact uncertainty debe expresarse mediante confidence y/o rango.

19\. Recurrence  
RECURRENCE:  
FIRST\_OCCURRENCE  
OCCASIONAL  
RECURRING  
SYSTEMATIC

La recurrencia puede elevar structural severity, pero no sustituye la medición de current impact.

20\. Criticality, Redundancy y Buffers  
BUSINESS\_CRITICALITY y CURRENT\_IMPACT son dimensiones distintas.

REDUNDANCY / resilience buffers deben incorporarse cuando existan:  
backup provider  
safety stock  
cash buffer  
alternate channel  
spare capacity  
redundant systems

ABSORPTION\_CAPACITY representa cuánto shock puede absorber el negocio.

BUFFER\_STRENGTH:  
STRONG  
ADEQUATE  
THIN  
EXHAUSTED  
UNKNOWN

Un buffer fuerte puede reducir current/forward severity; un buffer fino o agotado puede elevarla. No inferir buffer inexistente.

21\. Severity lifecycle  
SEVERITY\_CHANGE  
\- from  
\- to  
\- reason  
\- timestamp  
\- evidence\_refs

La historia debe preservar cambios de severidad, no sobrescribirlos silenciosamente.

Severity timeline:  
\- first\_detected  
\- first\_material\_impact  
\- peak\_severity  
\- current\_severity

Escalation puede ocurrir cuando aumenta exposure, empeora trajectory, se agotan buffers, persiste el problema o aparecen secondary effects.  
De-escalation puede ocurrir cuando el problema se contiene, el scope se reduce, comienza recovery, entra redundancia o deja de acumularse impacto.

22\. Impact Ledger y assumptions  
IMPACT\_LEDGER  
\- impact\_id  
\- diagnostic\_id  
\- dimension  
\- type  
\- measurement\_layer  
\- value / range  
\- method  
\- confidence  
\- period  
\- causal\_path\_ref  
\- source\_evidence  
\- model\_version

Assumption Ledger debe conservar las assumptions relevantes, especialmente en impactos financieros:  
\- AOV assumed.  
\- margin assumed.  
\- baseline period.  
\- attribution assumptions.  
\- otros supuestos materiales.

No cambiar assumptions silenciosamente.

23\. Versioning y reproducibilidad  
Guardar impact\_model\_version.

Mismo:  
\- data snapshot.  
\- context snapshot.  
\- root cause result.  
\- impact model version.  
\- assumptions.

debe permitir reconstruir D10 o explicar por qué una revisión produjo un resultado distinto.

24\. IMPACT\_RESULT  
IMPACT\_RESULT  
\- diagnostic\_id  
\- current\_impact  
\- potential\_impact  
\- impact\_vector  
\- exposure  
\- estimated\_loss  
\- loss\_rate  
\- cumulative\_impact  
\- blast\_radius  
\- propagation\_risk  
\- continuity\_risk  
\- reversibility  
\- recoverability  
\- buffers  
\- trajectory  
\- severity  
\- severity\_confidence  
\- impact\_confidence  
\- assumptions  
\- limitations

25\. SEVERITY\_RESULT  
SEVERITY\_RESULT  
\- diagnostic\_id  
\- local\_severity  
\- business\_severity  
\- severity\_profile  
\- affected\_scope  
\- business\_exposure  
\- impact\_vector  
\- impact\_estimates  
\- trajectory  
\- duration  
\- propagation\_risk  
\- continuity\_risk  
\- reversibility  
\- recoverability  
\- buffer\_strength  
\- time\_sensitivity  
\- forward\_severity  
\- confidence  
\- limitations

26\. Time Sensitivity  
TIME\_SENSITIVITY:  
LOW  
MEDIUM  
HIGH  
IMMEDIATE

TIME\_SENSITIVITY ≠ PRIORITY.  
D10 puede describir cuánto daño adicional puede acumularse con el tiempo, pero no ordenar acciones ni calcular ROI de soluciones.

27\. Attribution rules  
Cuando root cause es conocida, puede registrarse ROOT\_CAUSE\_IMPACT.  
Cuando no lo es, utilizar DIAGNOSTIC\_TARGET\_IMPACT y no forzar atribución causal.

Causal Deduplication:  
Si stockout → CVR decline → CAC deterioration representa una sola cadena, no sumar cada cambio downstream como pérdida independiente.

28\. Multi-agent contract  
Los especialistas pueden calcular impactos de dominio, pero deben emitir objetos IMPACT\_ESTIMATE compatibles.

El orquestador debe:  
\- reconciliar estimates cross-capability.  
\- detectar overlap/double counting.  
\- construir una vista de impacto única.  
\- preservar source agent/evidence.  
\- no sumar impactos downstream duplicados.

29\. Runtime vs LLM  
Runtime / código debe calcular cuando sea posible:  
\- affected share.  
\- lost orders.  
\- revenue delta.  
\- contribution delta.  
\- duration.  
\- loss rate.  
\- capacity ratios.  
\- days cover.  
\- cash runway.  
\- customer count.  
\- scope.  
\- dedup/accounting boundaries.  
\- confidence caps deterministas.

LLM puede:  
\- sintetizar impact vector.  
\- interpretar propagation.  
\- explicar severity.  
\- distinguir direct/indirect effects.  
\- describir realized vs potential impact.  
\- explicar limitations.

El LLM no puede crear cifras que no procedan de datos/cálculos/evidencia.

30\. Observabilidad admin  
Para cada diagnóstico debe ser reconstruible:  
\- Severity y reason.  
\- Current impact y Future exposure.  
\- Revenue / Contribution / Cash afectados.  
\- Customers / Operations afectados.  
\- Blast radius y propagation.  
\- Duration / trajectory.  
\- Buffers / redundancy.  
\- Reversibility / recoverability.  
\- Impact assumptions.  
\- Impact/severity confidence.  
\- estimate/model version.  
\- source evidence.  
\- cambios históricos de clasificación.

D10 no envía alerts; sus outputs pueden alimentar posteriormente una política de alerting/routing.

31\. Handoff  
D10 debe entregar a D11 y a capas posteriores:  
\- IMPACT\_RESULT.  
\- SEVERITY\_RESULT.  
\- impact\_confidence.  
\- severity\_confidence.  
\- assumptions.  
\- limitations.  
\- evidence lineage.

D10 no decide prioridad, recomendación, effort ni ROI de una solución.

32\. Tests mínimos  
\- test\_large\_percentage\_low\_exposure  
\- test\_small\_percentage\_high\_exposure  
\- test\_revenue\_vs\_contribution\_impact  
\- test\_cash\_threat\_with\_revenue\_healthy  
\- test\_local\_disaster\_global\_low\_impact  
\- test\_business\_threat  
\- test\_forward\_risk\_without\_current\_damage  
\- test\_reversibility\_vs\_recoverability  
\- test\_propagation\_risk  
\- test\_impact\_range\_not\_false\_precision  
\- test\_no\_double\_counting  
\- test\_severity\_without\_root\_cause  
\- test\_low\_confidence\_impact  
\- test\_buffer\_reduces\_severity  
\- test\_rapid\_deterioration\_escalates

33\. Evals / Fixtures  
Fixture 1 — Small segment  
Input: Firefox CVR \-80%; traffic share 0.5%.  
Expected: local severity CRITICAL; business severity LOW.

Fixture 2 — Payment  
Input: payment completion \-10%; checkout exposure 95%.  
Expected: business severity HIGH/CRITICAL dependiendo de impacto absoluto.

Fixture 3 — Cash  
Input: revenue \+20%; contribution positive; cash runway 14 days.  
Expected: Finance Severity BUSINESS\_THREAT/CRITICAL si obligations generan continuity risk.

Fixture 4 — Stock Risk  
Input: stockout not yet; coverage 6 days; lead time 60 days; hero SKU share 55%.  
Expected: current realized impact LOW/NONE; Forward Severity CRITICAL.

Fixture 5 — Tracking  
Input: GA conversions \-60%; Shopify stable.  
Expected: revenue loss NONE CONFIRMED; Data/Decision Severity HIGH.

Fixture 6 — Buffer  
Input A: supplier outage; safety stock 120 days.  
Expected A: current severity LOW/MODERATE.  
Input B: supplier outage; coverage 4 days.  
Expected B: HIGH/CRITICAL.

Fixture 7 — Irrecoverable Impact  
Input: checkout down 3 hours; service restored.  
Expected: root cause/current technical impact resolved; cumulative lost sales material y parcialmente irrecoverable.

Fixture 8 — Chronic Leak  
Input: contribution \-2pp vs expected durante 12 months.  
Expected: acute severity LOW/MODERATE; cumulative impact HIGH.

Fixture 9 — Propagation  
Input: Stockout → CVR ↓ → CAC ↑ → contribution ↓.  
Expected: una causal impact chain; no sumar cada cambio downstream como independent loss.

Fixture 10 — Unknown Cause  
Input: Orders \-70%; root cause unknown.  
Expected: problem confidence HIGH; severity CRITICAL; root cause confidence INSUFFICIENT.

34\. Invariantes D10  
El sistema nunca debe:  
\- Confundir severity con priority.  
\- Usar percentage change por sí solo para determinar severity.  
\- Usar revenue como única dimensión de impacto.  
\- Ignorar contribution, cash, customer, operations o continuity cuando sean materiales.  
\- Generalizar local severity a global severity sin evidencia.  
\- Confundir realized impact con future risk.  
\- Confundir opportunity cost con realized loss.  
\- Presentar estimates como exact facts.  
\- Inventar financial impact cuando los datos son insuficientes.  
\- Double-count downstream impacts de la misma causal chain.  
\- Ignorar duration, trajectory, propagation risk, buffers o redundancy.  
\- Confundir reversibility de la causa con recoverability del daño.  
\- Reducir severity solo porque root cause sea incierta.  
\- Aumentar causal confidence porque impact sea severo.  
\- Confundir critical capability con critical current impact.  
\- Confundir controllability con severity.  
\- Recomendar acciones.  
\- Decidir business priority.  
\- Aplicar universal impact thresholds sin contexto.  
\- Ocultar assumptions o uncertainty ranges.  
\- Colapsar todas las dimensiones en un opaque score.

35\. Definition of Done  
D10 está correctamente construido cuando puede responder, con evidencia y confidence explícitas:  
\- How severe is the diagnosis?  
\- Is severity local or business-wide?  
\- What percentage of the business is exposed?  
\- What revenue/contribution/cash are affected?  
\- How many customers and operations are affected?  
\- Is there brand/strategic/continuity impact?  
\- What damage is realized, ongoing or still at risk?  
\- What is the blast radius and propagation risk?  
\- How long has it existed and how quickly is it changing?  
\- Is the cause reversible and is the damage recoverable?  
\- What buffers exist?  
\- What impact can be quantified and at what quantification level?  
\- What assumptions support the estimate?  
\- What is impact confidence?  
\- What is severity confidence?

D10 must finish with measurement of business damage, not a recommendation or priority decision.  
