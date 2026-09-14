# Fase 03 · D07 — Grafo causal del ecommerce

## Propósito

D7 responde:

> ¿Qué variables pueden provocar qué otras variables dentro de un ecommerce?

Su función es representar explícitamente rutas plausibles del tipo:

`CAUSE → MECHANISM → INTERMEDIATE EFFECT → BUSINESS OUTCOME`

D7 no confirma causalidad en un caso concreto. Define qué relaciones tienen sentido estructural y pueden ser contrastadas posteriormente con evidencia.

---

# 1. Plausible ≠ Proven

Regla fundamental:

> PLAUSIBLE ≠ PROVEN

El sistema no debe razonar:

`A cambió + B cambió → A causó B`

Debe exigir, como mínimo:

- mecanismo conocido;
- precedencia temporal compatible;
- scope compatible;
- magnitud plausible;
- ausencia de explicaciones claramente mejores;
- evidencia del caso.

D7 restringe el espacio causal. D8/D9 contrastan qué explicación ocurrió realmente.

---

# 2. Grafo causal

El ecommerce puede modelarse mediante:

- `NODES`
- `EDGES`

Los nodos pueden representar:

- métricas;
- estados;
- eventos;
- variables contextuales;
- condiciones estructurales;
- outcomes.

Las aristas representan relaciones posibles y direccionales.

---

# 3. Tipos de nodos

## Métricos

Ejemplos:

- Revenue
- Traffic
- Sessions
- CTR
- CPM
- CPC
- CVR
- AOV
- CAC
- Gross Margin
- Contribution
- Repeat Rate
- Refund Rate
- Stock Coverage
- Dispatch Time

## Estados

Ejemplos:

- Creative Fatigue
- Hero SKU Stockout
- Payment Failure
- Inventory Pressure
- Support Backlog
- Discount Dependency

## Eventos

Ejemplos:

- `PRICE_CHANGE`
- `THEME_DEPLOYMENT`
- `CREATIVE_LAUNCH`
- `PROMOTION_START`
- `STOCKOUT`
- `PAYMENT_CONFIGURATION_CHANGE`
- `BUDGET_INCREASE`

## Contextuales

Ejemplos:

- Seasonality
- Market Mix
- Device Mix
- Channel Mix
- Customer Mix

---

# 4. Edge

Una arista significa:

> A may influence B

No:

> A always causes B

salvo identidades matemáticas o relaciones deterministas específicas.

---

# 5. Tipos de relación

Como mínimo:

- `MATHEMATICAL`
- `MECHANISTIC`
- `BEHAVIORAL`
- `ECONOMIC`
- `OPERATIONAL`
- `TECHNICAL`
- `STRUCTURAL`
- `TEMPORAL`
- `CONTEXTUAL`

---

# 6. Mathematical Relations

Ejemplos:

`Revenue = Orders × AOV`

`CAC = Acquisition Spend / New Customers`

Estas relaciones están matemáticamente restringidas y tienen mayor certeza estructural que una heurística.

---

# 7. Mechanistic Relations

Ejemplo:

`Payment Error Rate ↑ → Payment Success ↓`

Existe mecanismo directo.

---

# 8. Behavioral Relations

Ejemplo:

`Shipping ETA worsens → Checkout completion may decline`

No es determinista, pero existe mecanismo conductual plausible.

---

# 9. Economic Relations

Ejemplo:

`Discount Depth ↑ → Gross Margin ↓`

manteniendo otros factores.

---

# 10. Operational Relations

Ejemplo:

`Order Volume ↑ → Warehouse Load ↑`

---

# 11. Technical Relations

Ejemplo:

`Site Latency ↑ → Conversion may ↓`

---

# 12. Structural Relations

Ejemplo:

`Creative Production Capacity LIMITS Acquisition Scaling Capacity`

---

# 13. Contextual Relations

Ejemplo:

`Device Mix Shift → Global CVR changes`

aunque el CVR dentro de dispositivo no cambie.

---

# 14. Dirección causal

Toda relación debe tener dirección:

`A → B`

No implica automáticamente:

`B → A`

Si existen feedback effects, deben modelarse como edges distintos.

---

# 15. Feedback loops

Los ecommerce contienen loops dinámicos.

Ejemplos:

- Product Experience ↓ → Reviews ↓ → CVR ↓ → Sales ↓ → Review Volume ↓
- Low Cash → Inventory Underbuy → Stockout → Revenue ↓ → Cash ↓
- Acquisition → Orders → Data → Learning → Acquisition

Debe distinguirse:

- dynamic feedback;
- circular reasoning.

---

# 16. Expected Sign

Cada edge puede tener:

- `POSITIVE`
- `NEGATIVE`
- `NON_MONOTONIC`
- `CONTEXT_DEPENDENT`

---

# 17. Non-monotonic y Context-dependent

Ejemplo:

Discount ↑ puede aumentar CVR, reducir margin y llegar a saturarse.

Price ↑ puede aumentar, reducir o dejar estable revenue según elasticidad.

Por tanto, el grafo no debe asumir linealidad universal.

---

# 18. Conditions

Un edge puede requerir condiciones.

Ejemplo:

`CPM ↑ → CAC ↑`

solo si CTR y CVR permanecen aproximadamente constantes.

La condición forma parte del significado causal.

---

# 19. Mechanism

Toda relación relevante debería responder:

> ¿A través de qué mecanismo puede A afectar B?

Ejemplo:

Creative quality deterioration → CTR decline

Mechanism:

- ad becomes less compelling;
- fewer impressions generate clicks.

El mecanismo reduce conexiones superficiales o alucinadas.

---

# 20. Causal Layers

Capas conceptuales:

- L0 — Business Outcomes
- L1 — Economic Drivers
- L2 — Commercial Drivers
- L3 — Funnel Drivers
- L4 — Operational / Technical Drivers
- L5 — Root Conditions

---

# 21. Business Outcomes

Ejemplos:

- Revenue
- Contribution
- Cash
- Growth
- Customer Value

---

# 22. Economic Drivers

Ejemplos:

- AOV
- Gross Margin
- CAC
- Refunds
- Shipping Cost
- Discounts

---

# 23. Commercial Drivers

Ejemplos:

- Traffic
- New Customers
- Repeat Customers
- Demand
- Offer Response

---

# 24. Funnel Drivers

Ejemplos:

- CTR
- PDP engagement
- ATC
- Checkout
- Payment

---

# 25. Operational / Technical Drivers

Ejemplos:

- Stock Availability
- Site Speed
- Payment Errors
- Delivery SLA
- Support Capacity

---

# 26. Root Conditions

Ejemplos:

- poor forecasting;
- insufficient creative production;
- incorrect payment configuration;
- supplier dependency;
- poor product-market fit.

---

# 27. Revenue Graph

Relación simplificada:

`Revenue ≈ Traffic × CVR × AOV`

También:

`Revenue = New Customer Revenue + Returning Customer Revenue`

Y puede descomponerse por:

- market;
- product;
- segment.

---

# 28. Traffic Graph

Traffic puede depender de:

- Paid
- Organic
- Direct
- Email
- Referral
- Affiliate

---

# 29. Paid Traffic Relationships

`Spend ↑ → Impressions ↑` según CPM.

`Impressions × CTR → Clicks`

---

# 30. CPM Graph

CPM puede verse afectado por:

- Auction Competition
- Audience
- Seasonality
- Placement Mix
- Market
- Platform Conditions

---

# 31. CTR Graph

CTR puede verse afectado por:

- Creative
- Audience Match
- Offer
- Brand Recognition
- Placement
- Frequency

---

# 32. CPC Graph

Simplificación:

- CPM ↑ → CPC ↑
- CTR ↑ → CPC ↓

manteniendo otros factores.

---

# 33. CAC Graph

Simplificación:

`CAC ≈ CPC / CVR`

Puede deteriorarse por varias rutas:

- CPM ↑ → CPC ↑ → CAC ↑
- CTR ↓ → CPC ↑ → CAC ↑
- CVR ↓ → CAC ↑

Esto impide diagnosticar desde CAC aislado.

---

# 34. Conversion Graph

Ruta conceptual:

`Sessions → PDP → ATC → Cart → Checkout → Payment → Order`

---

# 35. PDP Drivers

Puede verse afectada por:

- Product
- Price
- Offer
- Trust
- Reviews
- Stock
- Page Experience
- Traffic Quality
- Device
- Site Performance

---

# 36. Checkout Drivers

Puede verse afectada por:

- Shipping Cost
- Shipping ETA
- Checkout UX
- Required Fields
- Payment Methods
- Trust
- Technical Errors

---

# 37. Payment Drivers

Ejemplos:

- Payment Provider
- Fraud Rules
- Payment Methods
- Technical Errors
- Issuer Declines
- Configuration
- Market Compatibility

---

# 38. AOV Graph

AOV puede verse afectado por:

- Price
- Product Mix
- Units per Order
- Bundles
- Upsells
- Cross-sells
- Discount Structure
- Free Shipping Threshold

---

# 39. Offer Graph

Offer puede afectar:

- CTR
- PDP engagement
- CVR
- AOV
- Margin
- CAC

Es un nodo altamente conectado.

---

# 40. Price Graph

Price ↑ puede:

- aumentar AOV;
- reducir CVR;
- aumentar margin/order.

Son relaciones simultáneas y contextuales.

---

# 41. Discount Graph

Discount ↑ puede:

- aumentar CVR;
- alterar AOV;
- reducir Gross Margin;
- aumentar Promotion Dependency.

---

# 42. Product Graph

Product puede afectar:

- Demand
- CTR
- CVR
- Repeat
- Refunds
- Reviews
- AOV
- Word of Mouth

---

# 43. Product Quality Graph

Ejemplos:

`Quality ↓ → Refunds ↑ → Net Revenue ↓`

`Quality ↓ → Reviews ↓ → CVR ↓`

`Quality ↓ → Repeat ↓ → LTV ↓`

---

# 44. Inventory Graph

Inventory tiene fuerte efecto cross-capability.

Ejemplo:

`Stock Availability ↓ → PDP Conversion ↓`

---

# 45. Stockout Graph

`Hero SKU Stockout → Conversion ↓ → Orders ↓ → Revenue ↓`

También:

`Stock Availability ↓ → CVR ↓ → CAC ↑`

aunque media buying no haya empeorado.

---

# 46. Inventory ↔ Finance

`Inventory ↑ → Cash tied up ↑ → Cash availability ↓`

`Overstock ↑ → Discount Pressure ↑ → Margin ↓`

---

# 47. Forecasting y Lead Time

`Forecast Error ↑ → Inventory Imbalance ↑`

`Supplier Lead Time ↑ → Stockout Risk ↑`

manteniendo coverage.

---

# 48. Operations Graph

`Order Volume ↑ → Operational Load ↑`

Cuando:

`Operational Load > Capacity`

puede producir:

- Backlog ↑
- Dispatch Time ↑
- Order Errors ↑

---

# 49. Operations → Customer Experience

`Delivery Delay ↑ → Complaints ↑`

---

# 50. Operations → Retention

`Poor Delivery Experience → Repeat Purchase ↓`

potencialmente.

---

# 51. Support Graph

`Ticket Volume ↑ → Support Load ↑`

Si:

`Support Load > Capacity`

puede producir:

`Response Time ↑ → Customer Experience ↓`

---

# 52. Retention Graph

Repeat puede depender de:

- Product Satisfaction
- Delivery Experience
- CRM
- Offer
- Frequency of Need
- Customer Quality

---

# 53. LTV y CAC Tolerance

`Repeat Rate ↑ → LTV ↑`

`LTV ↑ → Sustainable CAC Ceiling ↑`

Por tanto:

`Retention ↓ → LTV ↓ → CAC tolerance ↓`

Una adquisición que parecía igual puede volverse económicamente peor.

---

# 54. Finance Graph

Conceptualmente:

`Revenue - Variable Costs - Acquisition Cost = Contribution`

Drivers:

- Revenue
- COGS
- Discounts
- Shipping Subsidy
- Payment Fees
- Refunds
- Ad Spend

---

# 55. Revenue Growth vs Contribution

Revenue puede aumentar mientras:

- CAC ↑;
- Discounts ↑;

y Contribution ↓.

Growth no implica mejora económica.

---

# 56. Cash Graph

Cash puede verse afectado por:

- Contribution
- Inventory Purchases
- Payment Terms
- Receivables
- Debt Service
- Taxes
- Capex

En ecommerce físico:

`Growth ↑ → Inventory Requirement ↑ → Cash Requirement ↑`

---

# 57. Creative Graph

Creative afecta principalmente:

- Attention
- CTR
- Traffic Quality
- Demand Perception

Ruta plausible de fatigue:

`Exposure ↑ + Creative Age ↑ + Low Refresh → Audience Response ↓ → CTR ↓ → CPC ↑ → CAC ↑`

No se confirma automáticamente en un caso.

---

# 58. Creative Pipeline Graph

`Creative Production Capacity ↓ → New Creative Launches ↓ → Winner Replacement ↓ → Creative Concentration ↑ → Fatigue Risk ↑`

---

# 59. Team Graph

Ejemplos:

`Creative Team Capacity ↓ → Creative Output ↓`

`Staff Capacity ↓ → Backlog ↑`

`Ownership Ambiguity ↑ → Decision Latency ↑`

Decision Latency puede afectar:

- Recovery Time
- Execution Speed
- Experimentation Velocity

---

# 60. Technology Graph

Ejemplos:

`Site Latency ↑ → Bounce ↑ → CVR ↓`

`JS Errors ↑ → Functional Failure ↑ → Conversion ↓`

si afecta critical path.

Deployment → Regression es posibilidad, no certeza.

---

# 61. Data Graph

Distinguir:

- business reality;
- measurement system;
- observed data.

Ejemplo:

`Tracking Failure → Observed Purchase Events ↓`

sin necesidad de:

`Actual Orders ↓`

Esta separación es una defensa crítica contra diagnósticos alucinados.

---

# 62. Observed vs Real Metrics

Debe diferenciarse:

- `REAL_WORLD_VARIABLE`
- `OBSERVED_METRIC`

Modelo conceptual:

`REAL BUSINESS → MEASUREMENT SYSTEM → OBSERVED DATA`

---

# 63. Measurement Error Path

Ejemplo:

`Pixel removed → Tracked Purchase ↓`

sin:

`Actual Purchase ↓`

Esto permite diferenciar business deterioration de measurement deterioration.

---

# 64. Strategy Graph

`Objective Clarity ↓ → Resource Misalignment ↑`

`Resource Allocation mismatch → Execution Effectiveness ↓`

`Poor SKU allocation → Inventory Imbalance`

posiblemente.

---

# 65. Cross-capability Graph

Ejemplos:

`Creative → Acquisition → Unit Economics → Finance`

`Inventory → Conversion → Acquisition → Revenue → Finance`

`Operations → Customer Experience → Retention → LTV → CAC tolerance → Growth capacity`

`Data → Decisions → Strategy → Resource Allocation → Performance`

---

# 66. Causal Chains

D7 debe poder generar rutas.

Ejemplo:

`Payment Configuration Change → Payment Errors ↑ → Payment Success ↓ → Orders ↓ → Revenue ↓`

---

# 67. Backward Traversal

Ante un efecto:

`Revenue ↓`

D7 debe poder preguntar:

> ¿Qué nodos upstream podrían producirlo?

---

# 68. Forward Traversal

Ante un evento:

`Hero SKU Stockout`

D7 debe poder preguntar:

> ¿Qué downstream variables deberían verse afectadas?

---

# 69. Ancestors y Descendants

Para un target como CAC:

Ancestors posibles:

- CPM
- CTR
- CVR
- Audience
- Creative
- Offer
- Inventory
- Technology

Descendants:

- Contribution
- Payback
- Cash
- Scaling Capacity

---

# 70. Path Length y Causal Depth

Distinguir:

- direct parent;
- intermediate ancestor;
- distant root condition.

No todas las causas están igual de cerca.

---

# 71. Edge Strength

Puede existir:

- `STRONG`
- `MODERATE`
- `WEAK`
- `CONTEXT_DEPENDENT`

Representa fuerza conceptual del edge, no evidencia del caso actual.

---

# 72. Edge Evidence Level

Niveles posibles:

- `DETERMINISTIC`
- `STRONGLY_ESTABLISHED`
- `COMMON_MECHANISM`
- `PLAUSIBLE`
- `SPECULATIVE`

Los edges especulativos no deben sostener diagnósticos fuertes.

---

# 73. Sources of Causal Knowledge

Puede distinguirse:

- System Logic
- Internal Evidence
- External Knowledge
- Expert Heuristic
- Tenant Learned

No tienen el mismo peso epistemológico.

---

# 74. Edge Prior ≠ Case Causal Confidence

Un edge global puede ser conceptualmente fuerte y, sin embargo, explicar muy poco un caso concreto.

Ejemplo:

Stockout → CVR decline puede ser HIGH como relación global.

Pero si el SKU afectado representa 2 % del revenue, puede ser LOW como explicación del revenue global.

---

# 75. Temporal Fit

La causa debe preceder al efecto.

Si CVR cae antes de un price change, ese cambio no puede explicar el inicio.

Hay excepciones de simultaneidad o measurement artifacts que deben modelarse explícitamente.

---

# 76. Lag Fit

Los efectos pueden tener lags distintos.

Ejemplos:

- Payment config → failure: segundos/minutos.
- Poor acquisition cohort quality → repeat decline: semanas/meses.

El grafo debe conocer expected lag ranges cuando sea posible.

---

# 77. Scope Fit

Una causa debe afectar al mismo scope relevante que el efecto.

Spain CVR ↓ no puede explicarse por France price increase sin vínculo adicional.

---

# 78. Magnitude Fit

La magnitud de la causa debe poder explicar razonablemente la magnitud del efecto.

Un stockout sobre 2 % del revenue no explica por sí solo una caída global de 30 %.

---

# 79. Causal Contribution

Idealmente debe poder estimarse:

> possible contribution to observed change

Una causa puede ser parcial.

---

# 80. Necessary / Sufficient / Contributory

Según contexto, una causa puede ser:

- `NECESSARY`
- `SUFFICIENT`
- `CONTRIBUTORY`

Los ecommerce suelen mostrar multicausalidad.

---

# 81. Multiple Causality

Un CAC +30 % puede venir simultáneamente de:

- CPM +10 %
- CTR -8 %
- CVR -12 %

No debe existir obsesión por una única root cause.

---

# 82. Interaction Effects

Dos factores pueden amplificarse.

Ejemplo:

`Price ↑ + Traffic Quality ↓ → CVR ↓↓`

Algunas relaciones requieren:

`A + B → C`

y no solo edges simples.

---

# 83. Hyperedges

El modelo debe soportar conceptualmente relaciones combinadas.

Ejemplo:

`High Order Volume + Low Warehouse Capacity → Backlog`

---

# 84. Threshold Effects

Algunas relaciones solo se activan a partir de un límite.

Ejemplo:

`Operational Load > Capacity Threshold → SLA deterioration`

---

# 85. Saturation Effects

Spend puede mejorar customers hasta llegar a saturation, donde marginal CAC empeora.

El grafo debe soportar no linealidad.

---

# 86. Mediators

Un mediator es un nodo intermedio.

Ejemplo:

`Creative Fatigue → CTR ↓ → CPC ↑ → CAC ↑`

CTR y CPC median la relación.

---

# 87. Confounders

Un confounder afecta a múltiples variables y puede crear asociaciones engañosas.

Ejemplo:

Seasonality puede afectar simultáneamente CPM y CVR.

La co-variación no demuestra que una cause a la otra.

---

# 88. Collider Risk

Algunas variables son efecto de múltiples causas.

El motor debe evitar asociaciones ingenuas producidas por conditioning indebido.

---

# 89. Causal Graph ≠ Correlation Graph

No deben crearse causal edges solo porque dos métricas correlacionen.

La correlación puede generar:

- `UNVALIDATED_RELATION`

hasta que exista mecanismo.

---

# 90. Mechanism Requirement

Todo edge causal global debe tener:

- plausible mechanism.

Toda relación confirmada en un caso debe tener:

- case evidence.

---

# 91. Counterfactual Reasoning

Pregunta útil:

> Si esta causa no hubiera ocurrido, ¿esperaríamos el mismo efecto?

No siempre habrá experimentos reales.

Proxies posibles:

- unaffected segments;
- control markets;
- other devices;
- previous period.

---

# 92. Natural Experiments y Controls

Ejemplo:

Nuevo checkout solo en Spain.

- Spain CVR ↓
- France stable

Esto aporta evidencia causal más fuerte.

---

# 93. Difference-in-Differences Concept

Comparar:

- treated vs control;
- before vs after;

puede mejorar causal inference.

No implica que D7 deba ejecutar automáticamente el método.

---

# 94. Experiments

A/B tests constituyen evidencia causal de alta calidad.

Si un experimento demuestra:

`New PDP → CVR +8 %`

puede aprenderse una relación específica del tenant.

---

# 95. Case Causal Evidence Hierarchy

Orden conceptual:

1. `RANDOMIZED_EXPERIMENT`
2. `NATURAL_EXPERIMENT`
3. `BEFORE_AFTER_WITH_CONTROL`
4. `TEMPORAL + MECHANISTIC EVIDENCE`
5. `MULTI_SOURCE_CORROBORATION`
6. `CORRELATION_ONLY`

Correlation-only no debe producir HIGH causal confidence.

---

# 96. Causal Search

Ante un síntoma, D7 devuelve candidate parents.

Ejemplo:

`PAYMENT_COMPLETION_FAILURE`

Parents posibles:

- Payment Provider
- Payment Configuration
- Fraud Rules
- Payment Method Availability
- Technical Regression
- Issuer Declines
- Market incompatibility

---

# 97. Path Pruning

Las señales actuales deben podar ramas.

Ejemplo para CAC ↑:

- CVR stable → branch CVR pierde peso.
- CPM stable → branch CPM pierde peso.
- CTR ↓ → branch CTR gana peso.

D8 genera hipótesis sobre parents todavía abiertos.

---

# 98. Rootward Traversal

D7 debe permitir buscar:

- deepest supported ancestor

sin decidir todavía root cause.

D9 realizará esa decisión.

---

# 99. Constraint Graph

También pueden existir relaciones:

- `LIMITS`
- `REQUIRES`

Ejemplos:

`Creative Production Capacity LIMITS Acquisition Scaling`

`Advanced Acquisition Scaling REQUIRES Reliable Unit Economics`

---

# 100. System-wide Scaling Graph

Escalar marketing puede estresar otras capacidades:

`Spend ↑ → Demand ↑ → Orders ↑ → Inventory Consumption ↑ → Operations Load ↑`

El ecommerce debe modelarse como sistema, no como silo.

---

# 101. Centrality

Puede calcularse conceptualmente:

- degree;
- betweenness;
- critical path centrality.

Pero:

> GRAPH CENTRALITY ≠ BUSINESS PRIORITY

Un nodo central puede estar completamente sano.

---

# 102. Critical Path

Algunos nodos pueden ser obligatorios para la transacción:

- Site
- Checkout
- Payment
- Inventory
- Fulfillment

dependiendo del modelo.

---

# 103. Blast Radius

Cada nodo puede tener un `BLAST_RADIUS` conceptual:

> cuántas áreas y qué porcentaje del negocio puede afectar una falla.

Debe combinarse con exposure.

---

# 104. Scoped Nodes

Los nodos pueden instanciarse por scope.

Ejemplo:

`CVR[Spain][Mobile]`

Una relación general puede heredarse al scope específico.

---

# 105. Coarse vs Fine Reasoning

Puede existir:

- capability graph para executive reasoning;
- metric graph para diagnóstico profundo.

Ambos representan abstracciones del mismo sistema.

---

# 106. Event-to-Metric Graph

Ejemplos:

`PRICE_CHANGE → AOV / CVR / Margin`

`THEME_DEPLOYMENT → Errors / Speed / PDP UX / Checkout UX / Tracking`

`BUDGET_INCREASE → Spend → Impressions → Clicks → Customers`

`PROMOTION_START → CVR ↑ / Orders ↑ / AOV ? / Margin ↓ / Inventory depletion ↑`

---

# 107. External Factors

Puede haber nodos como:

- Competitor Action
- Platform Auction Pressure
- Macro Demand
- Weather
- Holiday

Suelen tener menor observabilidad y confidence.

---

# 108. Market Demand Graph

`Category Demand ↓ → Traffic Potential ↓`

`Brand Demand ↓ → Direct Traffic ↓ → Organic Branded Traffic ↓`

---

# 109. Measurement Layer

El grafo debe distinguir:

`REAL BUSINESS → MEASUREMENT SYSTEM → OBSERVED DATA`

Esta separación evita confundir tracking deterioration con business deterioration.

---

# 110. Causal Explanation

Una explicación causal buena debe exponer:

- supported links;
- weak links;
- contradictions;
- missing evidence;
- alternative paths.

No debe ocultar incertidumbre.

---

# 111. Causal Ambiguity

Puede haber:

- Cause A
- Cause B
- Cause C

todos compatibles.

D7 debe preservar branching.

---

# 112. Competing Paths

Ejemplo para CAC ↑:

### Path A
CTR ↓ → CPC ↑ → CAC ↑

### Path B
CVR ↓ → CAC ↑

### Path C
CPM ↑ → CPC ↑ → CAC ↑

Las señales actuales aumentan o reducen soporte de cada path.

---

# 113. Metric Lineage ≠ Causal Graph

`LINEAGE` responde:

> ¿Cómo se calcula una métrica?

`CAUSAL GRAPH` responde:

> ¿Qué puede influir en ella?

Ejemplo CAC:

- lineage: Spend / New Customers;
- causal parents: CPM, CTR, CVR, Traffic Quality.

---

# 114. Formula Decomposition

Las relaciones matemáticas deberían tener alta confianza estructural.

Los behavioral edges requieren mayor cautela.

---

# 115. Positive Causal Paths

El grafo también debe modelar mejoras.

Ejemplo:

`Creative Winner → CTR ↑ → CPC ↓ → CAC ↓ → Contribution ↑`

---

# 116. Learning from Success

El historial puede permitir estudiar:

> qué causal paths precedieron mejoras.

Esto alimenta aprendizaje posterior, no causal certainty automática.

---

# 117. Counterfactual Readiness

D7 prepara capacidades futuras de:

- what-if analysis;
- counterfactual estimation;
- simulation.

Pero la simulación pertenece a fases posteriores.

---

# 118. Root Cause Readiness

D7 prepara D9 para buscar:

- deepest supported actionable ancestor.

La root cause útil no siempre es la más filosóficamente profunda.

---

# 119. Graph Anti-patterns

## Everything connected

Si todo conecta con todo, el grafo pierde valor.

Solo crear edge si existe:

- mechanism;
- conditions;
- diagnostic usefulness.

## Vague nodes

Evitar:

- Bad Marketing;
- Great Brand;
- Bad Team.

Preferir variables específicas y observables.

## Recommendations as nodes

No usar acciones como:

- Launch Creatives

como causas del estado actual.

## Expert slogans

No convertir doctrinas vagas en edges sin mecanismo.

---

# 120. Node Observability

Los nodos pueden clasificarse:

- `DIRECTLY_OBSERVED`
- `DERIVED`
- `LATENT`
- `EXTERNAL`

Los latent nodes requieren más evidencia.

Ejemplo:

- Payment Error Rate = directly observed;
- CAC = derived;
- Creative Fatigue = latent;
- Competitor Pressure = external.

---

# 121. D4 vs D7

D4 maneja health de capabilities.

D7 maneja causal topology.

No deben duplicarse responsabilidades.

---

# 122. Capability-level Causal Maps

## Acquisition
Auction / Creative / Audience / Offer / Conversion → CAC

## Creative
Production Capacity / Testing Velocity / Concept Diversity / Exposure → Creative Response

## Conversion
Traffic Quality / Product / Offer / Price / Inventory / UX / Technology / Payment / Shipping → CVR

## Retention
Product Satisfaction / Delivery / Support / CRM / Customer Quality → Repeat/LTV

## Inventory
Demand / Forecasting / Lead Time / Purchase Orders / Supplier Reliability → Availability

## Operations
Order Load / Capacity / Process Quality / Carrier / Staff → SLA

## Finance
Revenue / Margin / CAC / Inventory / Working Capital → Cash

## Data
Tracking / Integrations / Definitions / Sync → Observed Metrics → Decision Reliability

## Technology
Deployments / Architecture / Traffic Load / Third-party Apps → Errors/Latency → Funnel

## Team
Capacity / Skill / Ownership / Process → Execution Velocity

## Strategy
Objectives / Tradeoffs / Resource Allocation → Execution Pattern → Outcomes

---

# 123. Cross-capability Causal Map

El ecommerce real es una red, no un funnel único.

Ejemplos:

- Inventory → Conversion
- Operations → Retention
- Unit Economics → Finance
- Data → Decisions
- Technology → Acquisition / Conversion / Operations
- Team → Execution
- Strategy → Resource Allocation

---

# 124. Reinforcing y Balancing Loops

Pueden existir:

- `REINFORCING_LOOP`
- balancing loop

Ejemplos:

`Low Cash → Underbuy → Stockout → Revenue ↓ → Cash ↓`

o:

`Spend ↑ → CAC ↑ → scaling reduced → CAC stabilizes`

El modelo debe soportarlos aunque no sean prioritarios en la primera implementación.

---

# 125. Principio final

D6 sabe qué patrón observamos.

D7 sabe qué mecanismos podrían producirlo.

El grafo no existe para dar más seguridad al modelo.

Existe para limitarlo a:

- causas estructuralmente plausibles;
- mecanismos explicables;
- relaciones condicionadas;
- rutas que puedan contrastarse con evidencia.
