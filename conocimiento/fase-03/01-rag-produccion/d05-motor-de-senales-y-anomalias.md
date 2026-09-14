# Fase 03 · D05 — Motor de señales y anomalías

## Propósito

D5 responde:

> ¿Qué está cambiando de forma suficientemente relevante como para merecer investigación?

El objetivo no es detectar cualquier variación. Es separar:

- ruido;
- variación normal;
- cambio esperado;
- señal;
- anomalía;
- riesgo emergente;
- regresión;
- mejora.

D5 es el sistema sensorial del copiloto.

---

## 1. Observation → Variation → Signal → Anomaly → Symptom

La cadena conceptual es:

`OBSERVATION → VARIATION → SIGNAL → ANOMALY → SYMPTOM`

D5 trabaja principalmente con:

- variation;
- signal;
- anomaly.

D6 transforma conjuntos de señales en síntomas empresariales.

### Observation

Valor medido sin interpretación.

### Variation

Cambio respecto de un baseline.

### Signal

Variation que adquiere relevancia suficiente por magnitud, duración, contexto, exposición o confianza.

### Anomaly

Observación que se desvía significativamente de lo esperado.

### Symptom

Interpretación empresarial de una combinación de señales. Pertenece a D6.

---

## 2. Signal ≠ Anomaly

Puede existir señal sin anomalía puntual:

- deterioro gradual durante varias semanas.

Puede existir anomalía sin deterioro:

- revenue +300 % por colaboración viral.

Por tanto, señal y anomalía no son sinónimos.

---

## 3. Tipos principales de señales

D5 debe reconocer como mínimo:

- `LEVEL_SIGNAL`
- `TREND_SIGNAL`
- `CHANGE_SIGNAL`
- `RATE_SIGNAL`
- `VOLATILITY_SIGNAL`
- `CONCENTRATION_SIGNAL`
- `MIX_SIGNAL`
- `RATIO_SIGNAL`
- `CAPACITY_SIGNAL`
- `DEPENDENCY_SIGNAL`
- `REGRESSION_SIGNAL`
- `POSITIVE_SIGNAL`
- `RISK_SIGNAL`

---

## 4. Level Signal

Detecta que una métrica se encuentra en un nivel anómalo respecto de su rango esperado o baseline.

---

## 5. Trend Signal

Detecta una evolución progresiva sin necesidad de un salto abrupto.

Ejemplo conceptual:

`39 → 41 → 42 → 44 → 46 → 48`

puede representar `DETERIORATING_TREND`.

---

## 6. Step Change

Detecta una ruptura abrupta de nivel.

Un cambio brusco y persistente después de una estabilidad previa puede indicar `STEP_CHANGE`.

---

## 7. Rate-of-Change y Acceleration

No solo importa cuánto cambia una métrica.

También importa:

- velocidad del cambio;
- aceleración del deterioro o mejora.

Conceptualmente pueden analizarse:

- primera derivada;
- segunda derivada.

Una métrica todavía aceptable puede merecer atención si se acerca rápidamente a un límite.

---

## 8. Volatility y Stability Break

Una media estable puede ocultar mucha más volatilidad.

`VOLATILITY_INCREASE` aparece cuando aumenta la dispersión o inestabilidad.

`OPERATIONAL_INSTABILITY` puede aparecer cuando una capability históricamente estable deja de serlo.

---

## 9. Concentration Signals

Detectan dependencia creciente.

Ejemplos:

- creative spend concentration;
- revenue concentration por SKU;
- channel concentration;
- customer concentration.

Una concentración creciente puede ser un `RISK_SIGNAL` aunque el rendimiento actual siga siendo bueno.

---

## 10. Mix Signals

Detectan cambios de composición.

Ejemplos:

- new customer share;
- device mix;
- product mix;
- traffic mix.

El mix puede explicar cambios agregados sin deterioro dentro de segmentos.

D2 contextualiza.  
D5 detecta el cambio.

---

## 11. Ratio Signals

Las relaciones entre métricas pueden ser más informativas que los niveles absolutos.

Ejemplos:

### Funnel
- PDP → ATC
- ATC → Checkout
- Checkout → Payment
- Payment → Order

### Economía
- Contribution / Revenue
- Discount / Revenue
- Ad Spend / Revenue
- Refunds / Revenue
- Inventory / Revenue

Los cambios en ratios ayudan a localizar dónde se produce el deterioro.

---

## 12. Capacity Signals

Detectan presión sobre límites operativos.

Ejemplos:

- warehouse utilization;
- stock coverage;
- task backlog;
- support capacity.

Una capability puede seguir funcionando y estar acercándose a un punto de fragilidad.

---

## 13. Dependency Signals

Detectan dependencia excesiva de:

- un canal;
- un SKU;
- un proveedor;
- una plataforma;
- un segmento.

La dependencia no implica automáticamente fallo, pero aumenta riesgo.

---

## 14. Regression Signal

Una regresión conceptual sigue el patrón:

`previously healthy → event/change → deterioration`

La relación temporal justifica investigación, no causalidad confirmada.

---

## 15. Positive Signals

D5 debe detectar también mejoras:

- CAC mejorando;
- CVR aumentando;
- refunds bajando;
- repeat rate mejorando;
- inventory efficiency mejorando.

Las mejoras deben cumplir el mismo rigor que los deterioros.

Un buen día no confirma un breakthrough.

---

## 16. Risk Signals

Puede existir señal antes de daño material.

Ejemplo:

- stock todavía disponible;
- coverage muy inferior al supplier lead time.

Puede existir `STOCKOUT_RISK` sin stockout actual.

---

## 17. Persistencia temporal

Una señal puede ser:

- transient;
- emerging;
- persistent;
- chronic.

La duración modifica relevancia e interpretación.

También debe diferenciarse:

- fast deterioration;
- slow deterioration.

---

## 18. Signal Onset

D5 debe intentar estimar:

> ¿Cuándo comenzó el cambio?

El onset ayuda a:

- vincular eventos;
- comparar pre/post;
- agrupar señales;
- preparar investigación causal posterior.

---

## 19. Change Point Detection

D5 debe soportar conceptualmente métodos de `CHANGE_POINT_DETECTION` para detectar rupturas de régimen.

No obliga a un algoritmo único.

---

## 20. Regime Shift

Una anomalía temporal no es igual que un cambio de régimen.

### Anomaly
Desviación transitoria.

### Regime Shift
La métrica se estabiliza de forma persistente en un nuevo nivel.

Cuando existe un nuevo régimen real, el baseline puede necesitar adaptación.

---

## 21. Baseline Adaptation

Si el baseline nunca cambia, el sistema puede alertar eternamente sobre una realidad ya normalizada.

Pero adaptar demasiado pronto puede aprender un estado roto como “normal”.

Por tanto:

- detectar candidate regime shift;
- mantener cautela;
- congelar baseline tras eventos materialmente sospechosos;
- adaptar solo con evidencia suficiente.

---

## 22. Multi-baseline Signals

D5 puede comparar una misma métrica con varias referencias:

- WoW;
- mediana histórica;
- YoY;
- forecast;
- baseline contextual.

Una señal es más fuerte cuando varios baselines coinciden.

Si entran en conflicto, la conclusión debe preservar esa ambigüedad.

---

## 23. Expected Range

Puede existir:

- `EXPECTED_LOW`
- `EXPECTED_HIGH`

El rango esperado debería ser contextual y variar según:

- weekday;
- season;
- market;
- channel;
- business stage;
- promotion.

---

## 24. Fixed Thresholds y Business Guardrails

Algunos eventos pueden usar thresholds absolutos, especialmente técnicos.

Pero el concepto preferente es:

- `BUSINESS_GUARDRAIL`

Tipos:

- economic breach;
- operational breach;
- technical breach;
- risk breach.

D5 debe detectar:

- `CROSSING_UP`
- `CROSSING_DOWN`
- `APPROACHING_GUARDRAIL`

No solo el estado final.

---

## 25. Statistical Detection

D5 debe soportar conceptualmente técnicas como:

- z-score;
- robust z-score;
- IQR;
- moving averages;
- EWMA;
- change-point methods;
- seasonal decomposition.

No significa que todas se apliquen a todas las métricas.

---

## 26. Robust Statistics

En ecommerce, medianas y MAD pueden ser más robustas que medias cuando existen picos.

La elección estadística debe respetar la distribución y el dominio.

---

## 27. Small Sample Protection

Con poco volumen, un cambio porcentual extremo puede ser ruido.

D1 puede marcar `LOW_SAMPLE`.

D5 debe degradar la señal cuando el tamaño muestral sea insuficiente.

---

## 28. Volume-adjusted Signal

La relevancia debe considerar:

- event count;
- sample size;
- revenue exposure;
- business exposure.

Un -50 % basado en dos observaciones no equivale a un -50 % sobre miles de eventos.

---

## 29. Statistical Significance ≠ Business Significance

Un cambio estadísticamente significativo puede tener impacto empresarial despreciable.

La señal debe ponderar relevancia para el negocio, no solo significancia matemática.

---

## 30. Signal Deduplication

Un mismo fenómeno puede generar varias señales correlacionadas.

Ejemplo:

- CAC ↑
- ROAS ↓
- MER ↓
- Paid contribution ↓

No deberían convertirse automáticamente en cuatro alertas independientes.

---

## 31. Signal Cluster

D5 puede agrupar señales relacionadas en un:

- `SIGNAL_CLUSTER`

Esto reduce alert fatigue.

D6 puede convertir el cluster en síntoma.

---

## 32. Correlated Signals

Para agrupar señales pueden considerarse:

- temporal correlation;
- scope overlap;
- metric dependency.

---

## 33. Derived Metric Dependency

Métricas derivadas pueden compartir inputs.

No deben tratarse como evidencia totalmente independiente.

D1 aporta lineage.  
D5 debe utilizarlo.

---

## 34. Cross-source Reinforcement

Señales procedentes de fuentes independientes pueden reforzarse.

Ejemplo:

- orders ↓;
- payments ↓;
- shipments ↓.

La corroboración multi-source puede aumentar confidence.

---

## 35. Signal Contradiction

Cuando fuentes relevantes se contradicen, D5 debe preservar el conflicto.

Ejemplo:

- GA4 purchases ↓;
- Shopify orders stable.

Esto puede producir:

- `SIGNAL_CONFLICT`
- posible `DATA_SIGNAL`

y no una business signal fuerte.

---

## 36. Pattern Signals

D5 puede detectar patrones recurrentes:

- backlog cada lunes;
- error spikes periódicos;
- deterioros lentos.

El patrón repetido puede ser más informativo que un punto aislado.

---

## 37. Seasonality-aware Anomalies

No debe alertarse sobre cambios esperados por seasonality.

La anomalía útil es la diferencia entre:

- observed;
- expected contextual value.

Esto produce un residual más informativo.

---

## 38. Residual Anomaly

Conceptualmente:

`observed - expected contextual value = residual`

La anomalía debe evaluarse sobre el residual cuando sea posible.

---

## 39. Trend Residual

Puede existir deterioro emergente aunque el valor actual todavía esté dentro del rango.

Una secuencia de residual cada vez más negativo puede generar `EMERGING_DOWNTREND`.

---

## 40. Multi-dimensional Anomaly

Una señal puede aparecer solo al combinar métricas.

Ejemplo:

- CTR estable;
- CVR estable;
- CAC ↑;
- CPM ↑.

Puede existir `ACQUISITION_COST_INFLATION` sin anomalía aislada en CTR o CVR.

---

## 41. Interaction Signal

D5 puede detectar combinaciones de cambios entre métricas.

D6 será quien interprete el patrón empresarial.

---

## 42. Relationship Break

D5 debe detectar cuando una relación histórica deja de comportarse como antes.

Ejemplo:

Antes:
- Spend ↑ → Customers ↑

Ahora:
- Spend ↑ → Customers estable

Puede existir `RESPONSE_CURVE_BREAK`.

---

## 43. Elasticity y Marginal Signals

En scaling importa analizar:

- cambio de output / cambio de input;
- marginal CAC;
- incremental returns.

El blended average puede ocultar saturación marginal.

---

## 44. Scaling Saturation Signal

Cuando marginal CAC se deteriora notablemente puede aparecer:

- `SCALING_SATURATION_SIGNAL`

---

## 45. Signal Libraries por capability

### Creative

- CTR deterioration;
- hook deterioration;
- thumbstop deterioration;
- creative age increase;
- spend concentration;
- winner concentration;
- creative velocity decline;
- concept diversity decline;
- winner rate decline.

### Acquisition

- CAC deterioration;
- CPM inflation;
- CPC inflation;
- CTR decline;
- new customer volume decline;
- marginal CAC deterioration;
- channel concentration;
- audience saturation.

### Conversion

- PDP engagement decline;
- ATC decline;
- checkout decline;
- payment failure;
- device regression;
- browser regression;
- site latency.

### Offer

- full-price conversion decline;
- promotion dependency increase;
- discount depth increase;
- bundle response deterioration;
- price sensitivity increase.

### Product

- hero SKU decline;
- review deterioration;
- refund increase;
- product concentration;
- sell-through deterioration.

### Retention

- repeat rate decline;
- cohort decay;
- churn increase;
- LTV deterioration;
- email engagement decline;
- flow revenue decline.

### Inventory

- stock coverage decline;
- stockout increase;
- overstock increase;
- dead stock growth;
- forecast bias;
- supplier delay.

### Operations

- fulfillment delay;
- support backlog;
- return processing delay;
- error rate;
- capacity pressure.

### Finance

- cash burn increase;
- gross margin decline;
- contribution decline;
- working capital pressure;
- inventory cash absorption;
- receivable delay.

### Data

- source conflict;
- tracking loss;
- event duplication;
- staleness;
- coverage loss;
- schema drift.

### Technology

- error rate spike;
- latency deterioration;
- uptime issue;
- deployment regression;
- integration failure.

### Team

- task backlog;
- execution delay;
- ownership gap;
- key-person dependency;
- capacity overload.

### Strategy

- goal-resource mismatch;
- contradictory incentives;
- channel-resource misallocation;
- strategy drift.

---

## 46. Signal Topology y Metric Graph

Las señales existen dentro de una red de relaciones conocidas.

Ejemplo simplificado:

- CPM;
- CTR;
- CPC;
- CVR;
- CAC.

D5 debería conocer dependencias matemáticas y semánticas para descomponer cambios.

---

## 47. Mathematical Decomposition

Si CAC sube, D5 puede revisar:

- CPM;
- CTR;
- CVR.

Esto no es causalidad completa, pero ayuda a localizar contribuciones matemáticas.

---

## 48. Revenue Decomposition

Conceptualmente:

`Revenue ≈ Traffic × CVR × AOV`

Si revenue cambia, D5 puede estimar qué componentes contribuyen a la variación.

---

## 49. Contribution Decomposition

Contribution puede descomponerse mediante componentes como:

- Revenue;
- COGS;
- discounts;
- shipping subsidy;
- payment fees;
- media spend;
- refunds.

Esto permite detectar qué componente explica matemáticamente una variación.

---

## 50. Signal Attribution ≠ Causal Attribution

D5 puede estimar contribution matemática de variables.

No debe presentarla como causalidad perfecta.

Las interacciones entre variables deben reconocerse.

---

## 51. Segment Anomaly Detection

D5 debe analizar dimensiones como:

- market;
- device;
- browser;
- channel;
- campaign;
- creative;
- product;
- SKU;
- customer type;
- cohort;
- landing page;
- payment method.

---

## 52. Segment Eligibility

No deben analizarse millones de segmentos indiscriminadamente.

Un segmento debería normalmente cumplir:

- minimum sample;
- minimum business exposure.

Excepción: grupos pequeños pero críticos o de alto valor.

---

## 53. Segment Anomaly Score

Puede considerar:

- magnitude;
- sample;
- exposure;
- persistence.

No debe convertirse en un score opaco.

---

## 54. Localized Anomaly

Una anomalía global pequeña puede esconder un subsegmento gravemente afectado.

Ejemplo:

- Global CVR -6 %;
- Mobile Safari -38 %.

D5 debe localizar el scope real.

---

## 55. Hierarchical Detection

Puede investigarse jerárquicamente:

`Business → Capability → Channel → Market → Device → Metric`

---

## 56. Top-down y Bottom-up Detection

### Top-down
Empieza por anomalías globales y hace drill-down dirigido.

### Bottom-up
Detecta subsegmentos graves aunque el agregado permanezca estable.

La estrategia adecuada es híbrida.

---

## 57. Cross-capability Signals

Algunas señales atraviesan varias capabilities.

Ejemplo:

- support complaints ↑;
- refunds ↑;
- repeat ↓.

D5 detecta las señales.  
D6 interpreta el síntoma.

---

## 58. Multi-modal Signals

No toda señal es numérica.

También pueden existir:

- support tickets;
- reviews;
- user reports;
- deployment logs;
- supplier messages.

---

## 59. Qualitative Signals

El texto puede convertirse en señal mediante clasificación.

Ejemplos de categorías:

- payment;
- shipping;
- quality;
- sizing;
- support;
- refund.

Confidence debe considerar:

- volume;
- classification confidence;
- representativeness.

---

## 60. Event Signals

D2 registra cambios relevantes.

D5 puede transformar ciertos eventos en:

- `IMPORTANT_BUSINESS_EVENT`

aunque no sean anomalías.

---

## 61. Event-response Pairing

Después de un evento material, D5 puede monitorizar variables esperadas.

Ejemplo:

Price change → observar:

- CVR;
- AOV;
- margin.

---

## 62. Post-event Monitoring Window

Cada tipo de evento puede tener un `expected_effect_window`.

No debe utilizarse una ventana universal para todos los dominios.

---

## 63. Event-linked Signal

Puede existir `EVENT_LINKED_SIGNAL` cuando el onset coincide estrechamente con un cambio.

Esto aumenta relevancia, no confirma causa.

---

## 64. Pre/Post Analysis

Comparar:

- `PRE_EVENT_BASELINE`
- `POST_EVENT`

puede ayudar a identificar cambios vinculados temporalmente.

---

## 65. Leading Signal Library

Ejemplos:

- creative velocity ↓;
- stock coverage ↓;
- support backlog ↑;
- forecast error ↑;
- branded demand ↓;
- capacity utilization ↑.

Pueden anticipar problemas mayores.

---

## 66. Leading Signal

Una señal puede marcar:

- `leading_indicator: true`

Una leading signal normalmente tiene menor certeza causal que un daño ya materializado.

---

## 67. Lag Expectation

Cada leading signal puede tener un lag esperado aproximado.

Los lags dependen del dominio y contexto.

---

## 68. Composite Signals

Pueden crearse señales derivadas de varias métricas.

Ejemplo conceptual:

`CREATIVE_FATIGUE_PRESSURE_INDEX`

posibles inputs:

- creative age;
- frequency;
- CTR trend;
- spend concentration.

Los índices deben ser explicables.

Siempre debe poder responderse:

> ¿Qué inputs contribuyeron?

---

## 69. Anomaly Families

D5 debe distinguir:

- `POINT_ANOMALY`
- `CONTEXTUAL_ANOMALY`
- `COLLECTIVE_ANOMALY`

También:

- sequence anomalies;
- periodic anomalies.

---

## 70. Contextual Anomaly

Un valor puede ser normal en general y anómalo dentro de un contexto específico.

Ejemplo:

CVR 2 % puede ser normal para prospecting y anómalo para branded traffic.

---

## 71. Collective Anomaly

Un conjunto de valores moderados puede formar un patrón anómalo.

Ejemplo:

pequeño deterioro diario durante 20 días.

---

## 72. Signal Normalization

Puede existir un `normalized_signal_score` interno para comparar magnitudes heterogéneas.

Pero:

> NO UNIVERSAL SCORE ALONE

No debe presentarse un “Anomaly Score 92” sin explicación.

---

## 73. Signal Card

Una signal card debería poder explicar:

- signal;
- capability;
- state;
- magnitude;
- duration;
- trajectory;
- business relevance;
- data confidence;
- context confidence;
- signal confidence.

---

## 74. Correlation Windows y Domain Lags

Para relacionar señales se necesitan ventanas temporales.

No debe usarse la misma ventana para:

- Payment: minutos/horas;
- Retention: semanas/meses.

---

## 75. Unexpectedness

La fuerza de una anomalía depende también de:

> ¿Qué tan inesperado es este cambio?

Revenue +200 % puede ser esperado en Black Friday y anómalo un martes ordinario.

---

## 76. Novelty

Una señal puede clasificarse como:

- first-ever;
- rare;
- common;
- recurring.

Una señal rara puede merecer investigación aunque su impacto inicial sea pequeño.

---

## 77. Known Patterns

Si una señal ocurre regularmente y está explicada, puede:

- suppress;
- low attention.

Esto reduce ruido y alert fatigue.

---

## 78. Historical Pattern Matching

D5 puede comparar un patrón actual con episodios anteriores.

Ejemplo:

> same pattern occurred before stockout

Esto debe utilizarse como contexto histórico, no causa automática.

---

## 79. Tenant-specific Pattern Library

Cada tienda puede desarrollar:

- `known_signal_patterns`

Los patrones del tenant no deben confundirse con conocimiento ecommerce universal.

---

## 80. Global Patterns

El RAG puede contener patrones comunes de ecommerce.

No deben convertirse automáticamente en diagnóstico.

---

## 81. Expert Knowledge Role

El conocimiento experto puede ayudar a definir:

- qué indicadores importan;
- qué combinaciones merecen atención;
- qué leading indicators suelen preceder problemas.

Pero el motor debe depender de datos y reglas explícitas.

---

## 82. No Guru Thresholds

No deben guardarse thresholds universales sin validez contextual.

Mejor almacenar principios.

Ejemplo:

> Un coste de adquisición creciente se vuelve materialmente peligroso cuando excede la tolerancia económica del cliente adquirido o deteriora persistentemente frente a su baseline.

---

## 83. Signal → Symptom Boundary

D5 puede detectar:

- CTR decline;
- CPC increase;
- concentration increase.

D6 interpreta:

- posible deterioro pre-click.

D5 no debe confirmar todavía una causa como creative fatigue.

---

## 84. D4 ↔ D5 Operational Loop

Puede existir:

- health-triggered signal;
- signal-triggered health update.

Ciclo conceptual:

`METRICS → SIGNALS → HEALTH → HEALTH CHANGE → NEW INVESTIGATION`

D4 y D5 forman un loop operacional sin colapsar sus responsabilidades.

---

## 85. Frequency

No todas las métricas se evalúan con la misma frecuencia.

Ejemplos:

- payments: minutos;
- ads: horas/días;
- retention: semanal;
- finance: diario/semanal/mensual.

---

## 86. Signal Horizons

Puede distinguirse:

### Real-time
- payments;
- uptime.

### Short-term
- CAC;
- CVR;
- creative.

### Medium-term
- inventory;
- retention cohorts;
- margin.

### Long-term
- brand demand;
- market position;
- organizational maturity.

Una capability puede tener señales diferentes en varios horizontes.

---

## 87. Signal Competition

Señales positivas y negativas pueden coexistir.

Ejemplo:

- Revenue +20 %;
- Contribution -10 %.

No deben cancelarse mutuamente.

---

## 88. Anomaly Magnitude ≠ Business Impact

Un cambio porcentual enorme en un segmento mínimo puede tener poca relevancia.

La interpretación debe incorporar exposición.

---

## 89. Weighted Exposure

Una señal debería poder considerar:

- business share affected;
- revenue exposure;
- profit exposure;
- customer exposure;
- operational exposure.

---

## 90. Signal Impact Estimate

D5 puede estimar preliminarmente:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Esto no sustituye a capas posteriores de impacto/priorización.

---

## 91. Signal Combination Patterns

El RAG puede contener patrones compatibles con interpretaciones posteriores.

Ejemplo:

- CTR ↓
- CPM stable
- CVR stable

compatible con deterioro pre-click.

Pero D5 no emite causa final.

---

## 92. Pattern Templates

Una plantilla puede describir:

- required signals;
- supporting signals;
- contradicting signals.

Estas plantillas preparan D6.

---

## 93. Principio final

Un dashboard detecta números diferentes.

D5 detecta cambios relevantes.

Debe distinguir:

- ruido;
- variación normal;
- cambio esperado;
- riesgo emergente;
- anomalía real;
- regresión;
- mejora.

D5 convierte el ecommerce en un organismo monitorizable continuamente.
