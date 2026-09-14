# Fase 03 · D04 — Diagnóstico de salud por capacidad

## Propósito

D4 convierte la anatomía del ecommerce en un sistema de salud empresarial.

D1 responde si los datos son fiables.  
D2 contextualiza esos datos.  
D3 determina la madurez estructural y las capacidades que deberían existir.  
D4 responde:

> ¿Cómo está funcionando ahora mismo cada capacidad?

La salud describe el estado funcional actual de una capacidad y debe mantenerse separada de madurez, causa raíz, severidad de un hallazgo, prioridad y oportunidad de optimización.

---

## 1. Maturity ≠ Health

> MATURITY ≠ HEALTH

**Madurez** describe cuánto ha desarrollado una capacidad el negocio.

**Salud** describe cómo está funcionando esa capacidad en este momento.

Una capacidad avanzada puede estar crítica por un fallo puntual.  
Una capacidad temprana puede estar sana para su etapa.

Por tanto:

- alta maturity no garantiza health;
- baja maturity no implica enfermedad;
- un incidente actual no debe reclasificar automáticamente la madurez estructural.

---

## 2. Health Model

Estados principales:

- `ELITE`
- `HEALTHY`
- `FRAGILE`
- `BAD`
- `CRITICAL`
- `DISASTER`

Estados de falta de evaluación:

- `UNKNOWN`
- `NOT_ASSESSABLE`

### ELITE

Funcionamiento excepcionalmente sólido para el contexto y madurez del negocio, con estabilidad, resiliencia y pocas señales materiales de riesgo.

No significa perfección absoluta.

### HEALTHY

La capacidad cumple razonablemente su función, sin deterioro material.

### FRAGILE

La capacidad todavía funciona, pero muestra vulnerabilidad, concentración, dependencia, deterioro inicial o poco margen de seguridad.

### BAD

Existe deterioro material que ya afecta resultados o funcionamiento, sin comprometer todavía de forma severa la continuidad.

### CRITICAL

El fallo causa daño grave, rápido o ampliamente propagado y requiere atención diagnóstica inmediata.

### DISASTER

Estado excepcional reservado para condiciones como:

- función central indisponible;
- motor principal de revenue roto;
- supervivencia de caja amenazada;
- impacto masivo en clientes;
- operaciones bloqueadas.

Debe utilizarse con prudencia.

---

## 3. One KPI ≠ Capability Health

> ONE KPI ≠ CAPABILITY HEALTH

Una capability no debe clasificarse por una sola métrica.

Ejemplo: ROAS bajo no basta para declarar Acquisition BAD.

La evaluación debe integrar señales coherentes con el dominio:

- performance;
- economics;
- trend;
- stability;
- quality;
- context;
- dependencies;
- exposure.

---

## 4. Health es multidimensional

Dimensiones principales:

- Performance
- Efficiency
- Stability
- Trend
- Reliability
- Resilience
- Capacity
- Exposure
- Dependency
- Control

Estas dimensiones permiten diferenciar capacidades con una media similar pero perfiles de riesgo muy distintos.

---

## 5. Market Health

Pregunta:

> ¿Existe suficiente demanda y sigue comportándose de forma saludable?

Señales:

- brand demand;
- category demand;
- search demand;
- market growth;
- competitive pressure;
- saturation;
- new customer acquisition potential.

### HEALTHY

- demanda estable o creciente;
- branded demand estable;
- posición competitiva razonablemente estable;
- adquisición de nuevos clientes viable.

### FRAGILE

- branded search debilitándose;
- presión competitiva creciendo;
- dependencia geográfica;
- crecimiento de mercado desacelerándose.

### BAD / CRITICAL

- category demand colapsando;
- restricción regulatoria material;
- deterioro severo del mercado principal;
- caída estructural de brand demand.

---

## 6. Product Health

Pregunta:

> ¿Los productos generan demanda, satisfacción y economía sostenibles?

Señales:

- SKU revenue;
- sell-through;
- repeat behavior;
- refunds;
- reviews;
- defect rate;
- product concentration;
- lifecycle.

Alta venta no implica automáticamente producto sano.

Un hero SKU dominante puede ser saludable comercialmente y, a la vez, crear fragilidad por concentración.

---

## 7. Offer Health

Pregunta:

> ¿La propuesta económica y comercial sigue siendo suficientemente atractiva y sostenible?

Señales:

- conversion response;
- discount dependency;
- price sensitivity;
- bundle performance;
- promotion dependency;
- differentiation;
- margin impact.

### FRAGILE

Revenue estable solo bajo descuento puede indicar:

- `DISCOUNT_DEPENDENCY`

### BAD

Patrones posibles:

- full-price CVR deteriorándose;
- promoción cada vez más profunda;
- AOV estancado;
- compresión de margen.

---

## 8. Unit Economics Health

Pregunta:

> ¿Cada unidad económica genera suficiente valor para sostener crecimiento?

Señales:

- gross margin;
- contribution margin;
- CAC;
- LTV;
- payback;
- refunds;
- shipping subsidy;
- payment fees;
- discounts.

Revenue puede crecer mientras contribution/order cae.

Por tanto:

> SALES GROWTH ≠ HEALTHY UNIT ECONOMICS

### CRITICAL

Señales posibles:

- contribution de nuevo cliente negativa;
- payback extendiéndose;
- consumo de caja creciente;
- escala aumentando pérdidas.

---

## 9. Acquisition Health

Pregunta:

> ¿El sistema adquiere clientes con volumen, calidad y economía aceptables?

Señales:

- spend;
- new customers;
- CAC;
- marginal CAC;
- MER;
- incrementality;
- channel concentration;
- traffic quality.

### HEALTHY

- volumen de clientes saludable;
- CAC dentro de tolerancia económica;
- marginal efficiency aceptable;
- estabilidad razonable.

### FRAGILE

- CAC todavía viable pero subiendo;
- dependencia alta de un canal;
- concentración creativa creciente.

### BAD

- CAC materialmente por encima de economía sostenible;
- deterioro de clientes nuevos;
- imposibilidad de escalar rentablemente.

---

## 10. Creative Health

Pregunta:

> ¿Existe suficiente capacidad creativa y los assets mantienen eficiencia?

Señales:

- CTR;
- hook rate;
- thumbstop;
- creative age;
- spend concentration;
- hit rate;
- creative velocity;
- concept diversity.

### HEALTHY

- output consistente;
- varios winners;
- rotación sana;
- rendimiento estable.

### FRAGILE

- uno o dos assets concentran el gasto;
- refresh cadence cae;
- CTR empieza a deteriorarse.

### BAD

- deterioro amplio;
- ausencia de nuevos winners;
- fatiga generalizada;
- impacto upstream en CAC.

---

## 11. Conversion Health

Pregunta:

> ¿El tráfico avanza correctamente hacia compra?

Señales:

- PDP engagement;
- ATC;
- checkout initiation;
- payment success;
- CVR;
- site speed;
- device/browser conversion.

Nunca debe hacerse:

> CVR down → Conversion BAD

sin revisar:

- traffic mix;
- device mix;
- product mix;
- inventory;
- price;
- offer.

D2 debe contextualizar previamente.

### CRITICAL

Ejemplo: caída severa de checkout completion en una proporción material del tráfico por regresión técnica.

---

## 12. Retention Health

Pregunta:

> ¿Los clientes siguen generando valor después de la primera compra?

Señales:

- repeat purchase;
- cohort retention;
- LTV;
- subscription retention;
- churn;
- email/SMS contribution;
- customer satisfaction.

Debe ser cohort-aware.

No interpretar repeat rate sin:

- cohort mix;
- acquisition source;
- promotion exposure;
- time horizon.

Una cohorte reciente debilitándose puede ser una señal adelantada aunque el agregado siga estable.

---

## 13. Inventory Health

Pregunta:

> ¿Existe producto suficiente, en los SKUs correctos, en el momento correcto y sin exceso económico peligroso?

Señales:

- stock coverage;
- stockouts;
- overstock;
- hero SKU availability;
- dead stock;
- inventory turns;
- forecast variance.

Tiene dos direcciones de fallo:

- `UNDERSTOCK`
- `OVERSTOCK`

Ambas pueden destruir salud.

### FRAGILE

Puede existir antes de un stockout si:

- cobertura baja;
- lead time largo;
- forecast uncertainty alta.

---

## 14. Operations Health

Pregunta:

> ¿Puede la empresa absorber y ejecutar correctamente el volumen actual?

Señales:

- fulfillment SLA;
- delivery time;
- warehouse backlog;
- support backlog;
- return processing;
- order error rate;
- capacity utilization.

Una operación puede seguir cumpliendo SLA y ser FRAGILE si opera casi sin margen de capacidad.

---

## 15. Finance Health

Pregunta:

> ¿La empresa convierte actividad comercial en rentabilidad, liquidez y capacidad financiera sostenible?

Señales:

- cash position;
- cash generation;
- working capital;
- gross margin;
- contribution;
- P&L;
- inventory exposure;
- receivables;
- payables.

> FINANCE HEALTH ≠ REVENUE

Revenue puede crecer mientras la caja empeora.

### CRITICAL

Señales:

- runway bajo;
- obligaciones crecientes;
- commitments grandes;
- contribution negativa.

---

## 16. Data Health

D1 produce gran parte de esta información, pero D4 debe tratar Data como una capacidad empresarial.

Data CRITICAL puede implicar management blindness.

---

## 17. Technology Health

Pregunta:

> ¿La infraestructura tecnológica soporta correctamente el negocio?

Señales:

- uptime;
- errors;
- latency;
- checkout availability;
- integration failures;
- deployment incidents;
- security issues;
- technical debt.

### FRAGILE

Sistema operativo pero con fallos repetidos y recuperación manual.

### CRITICAL

- checkout unavailable;
- order ingestion broken;
- payment integration failing.

---

## 18. Team Health

Pregunta:

> ¿El equipo puede ejecutar correctamente las funciones necesarias?

Señales:

- capacity;
- ownership;
- turnover;
- key-person dependency;
- role clarity;
- decision latency;
- execution backlog.

Team Health no es un happiness score.

Mide capacidad operativa.

---

## 19. Strategy Health

Pregunta:

> ¿Existe coherencia entre objetivos, recursos y decisiones actuales?

Señales:

- objective clarity;
- resource allocation;
- channel alignment;
- market focus;
- product focus;
- capital allocation;
- execution consistency.

Una contradicción entre “profitability-first” y recompensas exclusivamente basadas en revenue es evidencia de mala salud estratégica.

---

## 20. Performance

Pregunta:

> ¿Qué output produce actualmente la capacidad?

Debe compararse contra baseline ajustado.

---

## 21. Efficiency

Pregunta:

> ¿Cuántos recursos necesita para producir ese output?

Output estable con input mucho mayor puede indicar deterioro de eficiencia.

---

## 22. Stability

Pregunta:

> ¿El rendimiento es consistente o extremadamente volátil?

La misma media puede esconder perfiles de riesgo muy diferentes.

---

## 23. Trajectory

Estados conceptuales:

- `IMPROVING`
- `STABLE`
- `DETERIORATING`
- `RAPIDLY_DETERIORATING`
- `RECOVERING`
- `VOLATILE`

Health y trajectory deben mantenerse separadas.

Es posible:

- HEALTHY + RAPIDLY_DETERIORATING
- BAD + RECOVERING

---

## 24. Resilience

Pregunta:

> ¿Cuánto margen de seguridad existe?

Una capability puede funcionar hoy y ser FRAGILE por:

- single supplier;
- lead time largo;
- falta de safety stock;
- dependencia excesiva.

---

## 25. Exposure

Pregunta:

> ¿Qué parte del negocio depende de esta capacidad?

Una misma anomalía tiene impacto distinto según el peso económico o operativo.

---

## 26. Dependency

Algunas capabilities sostienen otras.

Ejemplo: Data afecta Finance, Acquisition, Inventory y Strategy.

La salud debe considerar efectos de dependencia.

---

## 27. Propagation Risk

`PROPAGATION_RISK` describe la posibilidad de que un deterioro se extienda a otras capacidades.

Ejemplo:

Inventory shortage puede propagarse a:

- Conversion;
- Acquisition;
- Revenue;
- Cash;
- Customer Experience.

D4 debe conservar esta relación potencial sin afirmar todavía causalidad formal.

---

## 28. Capacity

Pregunta:

> ¿Puede absorber el volumen actual y futuro inmediato?

Una capacidad al 95 % puede funcionar hoy y ser frágil.

---

## 29. Control

Pregunta:

> ¿La empresa puede detectar y controlar cambios en esta capability?

Dos negocios con el mismo CAC no tienen el mismo health profile si uno entiende sus drivers y el otro no.

---

## 30. Health es contextual

No existe una clasificación universal basada en un número aislado.

Ejemplos incorrectos:

- CAC €50 → BAD
- CVR 1,5 % → BAD
- refund rate 8 % → BAD

sin economía, producto, vertical, baseline y contexto.

---

## 31. Historical baseline y business target

Antes de benchmarks externos, dos referencias muy valiosas son:

- `SELF_BASELINE`
- `TARGET`

Un current value puede evaluarse contra su mediana histórica o contra un límite económico propio.

D4 debe poder funcionar sin depender completamente de benchmarks externos.

---

## 32. Health ≠ Diagnosis ≠ Cause

D4 puede declarar:

- Conversion CRITICAL

sin saber todavía por qué.

> STATE ≠ CAUSE

La causalidad se profundiza en bloques posteriores.

---

## 33. Primary vs downstream deterioration

Debe permitirse distinguir:

- `PRIMARY_HEALTH_ISSUE`
- `DOWNSTREAM_HEALTH_EFFECT`

Ejemplo conceptual:

Inventory BAD → Conversion BAD → Acquisition FRAGILE.

D4 puede registrar correlación o relación plausible, pero no cerrar causalidad.

---

## 34. Structural Health

Una capability puede estar HEALTHY hoy y presentar un maturity gap alto.

Resultado posible:

- Current Health: HEALTHY
- Structural Risk: HIGH

Esto conecta D3 con D4 sin mezclar maturity y health.

---

## 35. Four-state model

Una representación útil combina:

- MATURITY
- HEALTH
- RISK
- TRAJECTORY

Esto es más informativo que un único score.

---

## 36. Healthy but constrained

Una capability puede estar HEALTHY pero no tener capacidad suficiente para escalar.

Por tanto:

> CURRENT_HEALTH ≠ SCALING_READINESS

---

## 37. Health horizon

Puede diferenciarse:

- `CURRENT_HEALTH`
- `NEAR_TERM_RISK`

Horizontes conceptuales:

- NOW
- 7D
- 30D
- 90D

Esto no equivale a forecasting completo: representa exposición conocida.

---

## 38. Early Warning

D4 debe poder emitir `EARLY_WARNING` antes de daño material.

Ejemplo creativo:

- launch cadence cae;
- concentración sube;
- CTR empieza a ablandarse;
- current health aún sana.

Esto permite reconocer fragilidad emergente.

---

## 39. Leading vs Lagging indicators

### Leading indicators

Ejemplos:

- creative velocity;
- concentration;
- frequency;
- days of cover;
- supplier delays;
- forecast bias;
- capacity utilization;
- backlog.

### Lagging indicators

Ejemplos:

- Revenue;
- Refunds;
- Churn;
- Cash.

Un sistema que utiliza solo lagging indicators detecta demasiado tarde.

---

## 40. Health decomposition

Una capability puede descomponerse en subcapacidades.

Ejemplo Conversion:

- PDP;
- Cart;
- Checkout;
- Payment;
- Performance;
- Trust.

El health global debe conservar heterogeneidad interna.

---

## 41. Exposure-weighted aggregation

Un problema en un subcanal con 10 % del peso puede afectar menos al health global que el mismo estado en uno con 80 %.

> BUSINESS EXPOSURE MATTERS

La agregación debe preservar health local y peso.

---

## 42. Localized issues

Puede existir:

- Parent: HEALTHY
- Subcapability: CRITICAL

si la exposición es pequeña.

> Global healthy does not erase local disaster.

No debe ocultarse un problema localizado por el agregado.

---

## 43. Health heterogeneity

Una capability puede ser:

- Elite en VIP;
- Healthy en Organic;
- Bad en Discount customers;
- Critical en Black Friday cohort;

mientras el agregado permanece Healthy.

Debe conservarse la varianza entre segmentos.

---

## 44. Health conflict

Revenue fuerte y margins débiles no es una contradicción.

Son dimensiones distintas.

> SALES PERFORMANCE ≠ BUSINESS HEALTH

---

## 45. Growth masking

`GROWTH_MASKING` ocurre cuando el crecimiento de topline oculta deterioro interno.

Ejemplo:

- Revenue ↑
- CAC ↑ más rápido
- Margin ↓
- Refunds ↑
- Cash ↓

Crecimiento no garantiza salud.

---

## 46. Subsidized Health

Una capability puede aparentar salud porque otra compensa su deterioro.

Ejemplo:

Conversion BAD + Traffic +80 % → Revenue estable.

Eso no vuelve sana Conversion.

---

## 47. Hidden deterioration

Puede existir simultáneamente:

- HEALTH: BAD
- BUSINESS OUTPUT: STABLE

La estabilidad de output no invalida el deterioro subyacente.

---

## 48. Critical capability registry

Algunas capabilities son más críticas según el modelo de negocio.

Ejemplos conceptuales:

### DTC físico
- Payment
- Inventory
- Fulfillment
- Acquisition

### Subscription
- Retention
- Billing

### Marketplace
- supply liquidity
- demand liquidity
- matching

El health engine debe adaptarse al modelo de negocio.

---

## 49. Economic guardrails

Un valor absoluto no define health.

CAC €75 puede ser sano si sustainable CAC = €100.

CAC €25 puede ser crítico si contribution before acquisition = €18.

Health debe comprender Unit Economics.

---

## 50. Relative deterioration

Una métrica puede seguir dentro del guardrail y estar deteriorándose.

Ejemplo:

- CAC €25 → €37
- Guardrail €50

Resultado posible:

- Health: HEALTHY
- Trajectory: DETERIORATING
- Warning: yes

---

## 51. Severity ≠ Health

Health describe el estado de la capability.

Severity describe el daño de un problema concreto.

Una capability BAD puede contener un finding CRITICAL.

---

## 52. Multiple findings per capability

Una capability puede contener varios findings, incluso con evidencia mixta.

Ejemplo Creative FRAGILE:

- concentración alta;
- velocity bajando;
- hit rate estable.

La clasificación debe integrar supporting y contradicting evidence.

---

## 53. Positive evidence matters

La evaluación no debe recoger solo anomalías.

Si una capability es HEALTHY, debe poder explicar por qué.

La evidencia positiva aumenta explainability y evita sesgo hacia problemas.

---

## 54. Contradicting evidence

Una hipótesis puede tener señales supporting y contradicting.

Ejemplo:

- CTR deteriora;
- CAC estable;
- CVR estable;
- nuevos creatives estables.

Resultado razonable: FRAGILE, no BAD.

---

## 55. Acute vs chronic

### `ACUTE_FAILURE`

Fallo reciente y brusco, como un payment outage.

### `CHRONIC_WEAKNESS`

Estado BAD mantenido durante meses.

### Chronic Fragility

Dependencia persistente de un único winner u otra vulnerabilidad prolongada.

Esta distinción será relevante para root cause y playbooks.

---

## 56. Health Debt

Si una capability permanece FRAGILE o BAD sin corregirse, puede acumular:

- `HEALTH_DEBT`

El deterioro crónico aumenta riesgo futuro.

---

## 57. Health + Maturity Matrix

Casos conceptuales:

- High Maturity + Healthy → avanzada y sana.
- High Maturity + Critical → sofisticada con fallo grave actual.
- Low Maturity + Healthy → básica pero apropiada a su etapa.
- Low Maturity + Bad → inmadura y funcionando mal.
- Low Maturity + Healthy + Required High → funciona hoy, pero no está preparada.

---

## 58. Current Health vs Readiness

`CURRENT_HEALTH` y `SCALING_READINESS` deben permanecer separados.

Puede representarse:

- Health: HEALTHY
- Risk: HIGH

sin inventar un estado artificial.

---

## 59. Criticality

El impacto de un finding depende de:

> MAGNITUDE × BUSINESS CRITICALITY × EXPOSURE

Una variación pequeña en Payment puede importar más que una gran caída en una función secundaria.

---

## 60. Impact channels

Health puede afectar:

- Revenue;
- Contribution;
- Cash;
- Customer Experience;
- Operations;
- Brand;
- Risk;
- Continuity.

---

## 61. Health Impact Vector

Una capability o finding puede impactar varias dimensiones con intensidad distinta.

Ejemplo conceptual:

- revenue: HIGH
- contribution: HIGH
- cash: MEDIUM
- customer: HIGH
- operations: LOW

---

## 62. Capability Health Card

Una salida rica por capability puede incluir:

- capability;
- health;
- maturity;
- required maturity;
- trajectory;
- confidence;
- scope;
- primary signals;
- business exposure;
- current impact;
- structural risk;
- current failure.

Esto debe conservar evidencia, no solo presentar un semáforo.

---

## 63. Business Health Matrix

La salida global puede combinar por capability:

- maturity;
- health;
- trajectory;
- risk.

La matriz ayuda a visualizar el organismo, pero no sustituye el razonamiento.

> HEATMAP = PRESENTATION, NOT REASONING

---

## 64. Overall Health Narrative

La IA debe poder explicar la salud global en lenguaje consultivo:

- qué permanece sano;
- dónde se concentra deterioro;
- qué está empeorando;
- qué debilidad es estructural;
- qué riesgo existe;
- sin recomendar todavía acciones.

---

## 65. Health ≠ Priority

> WORST HEALTH ≠ HIGHEST PRIORITY AUTOMATICALLY

D4 no decide qué atacar primero.

La priorización pertenece a F4.

---

## 66. Monitoring

D4 puede servir como base de monitorización continua del ecommerce.

El objetivo no es volver a diagnosticar desde cero cada vez, sino mantener estado actualizado.

---

## 67. Baseline learning

El histórico de health puede permitir aprender:

- normal state;
- typical volatility;
- recovery patterns.

Este aprendizaje se profundiza posteriormente.

---

## 68. Not assessable

Si no existe evidencia suficiente o integración necesaria:

- `NOT_ASSESSABLE`

No debe sustituirse por HEALTHY.

Ausencia de datos no equivale a salud.

---

## 69. Capability interactions

D4 debe evitar degradar automáticamente una capability porque cae el output global.

Ejemplo:

- Acquisition HEALTHY
- Creative HEALTHY
- Conversion BAD
- Revenue ↓

No debe degradarse Acquisition por asociación superficial.

---

## 70. D4 sets the battlefield

D4 responde:

> WHERE IS THE ORGANISM UNHEALTHY?

D6–D9 profundizan:

> WHY?

---

## 71. Explainability

Cada health state debe poder explicar las principales razones.

Ejemplo conceptual:

Creative — FRAGILE porque:

- gran concentración de spend;
- menor cadence;
- CTR empieza a deteriorarse;
- CAC aún permanece dentro de guardrail.

---

## 72. Health asymmetry

El negocio puede mostrar:

- Topline ELITE
- Economics BAD
- Cash CRITICAL

La salud debe representar esta asimetría y no reducirse a revenue.

---

## 73. False health

Un ecommerce puede aparentar salud porque revenue crece mientras:

- cash se agota;
- margin erosiona;
- refunds suben;
- inventory se acumula.

---

## 74. Business Health Layers

Capas útiles:

### Commercial Health

- Market
- Product
- Offer
- Acquisition
- Creative
- Conversion
- Retention

### Economic Health

- Unit Economics
- Finance
- Inventory

### Operating Health

- Operations
- Technology
- Team

### Structural Health

- Maturity gaps
- Strategy
- Dependencies

### Data Health

- Data
- Tracking
- Observability

Estas capas facilitan executive summaries.

---

## 75. Health clusters

D4 puede agrupar `RELATED_HEALTH_FINDINGS` sin afirmar causalidad.

La deduplicación causal pertenece a fases posteriores.

---

## 76. Continuous state / Business Digital Twin

Conceptualmente, D4 mantiene un estado vivo por capability.

Esto permite que la IA pase de responder preguntas aisladas a mantener una representación del organismo.

---

## 77. Stateful consulting

El copiloto debería saber que una capability lleva semanas deteriorándose en lugar de analizarla como si fuera una observación nueva.

---

## 78. Health memory

El histórico puede ayudar a aprender:

- qué deterioros suelen preceder a otros;
- cuánto tardan las capabilities en recuperarse;
- qué patrones se repiten.

---

## 79. General expert knowledge vs business-specific evidence

El conocimiento experto puede definir:

- failure modes;
- health dimensions;
- leading indicators;
- fragility patterns;
- economic relationships;
- warning signs.

Pero nunca debe imponer business-specific health sin evidencia del tenant.

> BUSINESS-SPECIFIC EVIDENCE WINS

---

## 80. Healthy ≠ Optimized

Una capability puede ser HEALTHY y tener oportunidades de mejora.

> NOT OPTIMAL ≠ UNHEALTHY

D4 diagnostica salud, no perfección.

Las oportunidades, estrategia, recomendación y prioridad vienen después.

---

## 81. Principio final

Un dashboard muestra métricas.

Un sistema de diagnóstico mantiene estados.

D4 debe construir una representación viva de la salud del ecommerce, indicando:

- dónde está sano;
- dónde es frágil;
- dónde está fallando;
- cómo cambia;
- con qué nivel de confianza;
- sin confundir health con causa o prioridad.
