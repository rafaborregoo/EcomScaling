# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D7 — GRAFO CAUSAL DEL ECOMMERCE**

---

# **0\. Propósito de D7**

Hasta ahora el sistema puede:

D1  
validar datos

D2  
contextualizar

D3  
entender madurez

D4  
evaluar salud

D5  
detectar señales

D6  
agrupar señales en síntomas

Pero todavía le falta responder:

> **¿Qué variables pueden provocar qué otras variables dentro de un ecommerce?**

D7 construye ese mapa.

Su objetivo es crear una representación explícita de:

CAUSE  
   ↓  
MECHANISM  
   ↓  
INTERMEDIATE EFFECT  
   ↓  
BUSINESS OUTCOME

---

# **1\. Principio fundamental**

El sistema no debe razonar así:

A cambió  
B cambió

→ A causó B

Debe razonar:

A puede afectar B  
\+  
existe un mecanismo conocido  
\+  
la secuencia temporal es compatible  
\+  
el scope coincide  
\+  
no existen mejores explicaciones  
\+  
la evidencia respalda la relación

Solo entonces la relación causal gana credibilidad.

---

# **2\. El grafo no demuestra causalidad**

Muy importante:

> **D7 define qué relaciones causales son plausibles. No confirma cuál ocurrió en un caso concreto.**

Ejemplo:

CTR ↓

puede afectar:

CPC ↑  
CAC ↑

Pero D7 no concluye:

CTR caused CAC increase

Eso deberá contrastarse en D8 y D9.

---

# **3\. Concepto de grafo**

Representaremos el ecommerce como:

NODES  
\+  
EDGES

Los nodos son variables, capacidades, eventos o estados.

Las aristas representan relaciones posibles.

Ejemplo:

Creative Quality  
      ↓  
CTR  
      ↓  
CPC  
      ↓  
CAC  
      ↓  
Contribution  
      ↓  
Cash

---

# **5\. Ejemplos de nodos métricos**

Revenue  
Traffic  
Sessions  
CTR  
CPM  
CPC  
CVR  
AOV  
CAC  
Gross Margin  
Contribution  
Repeat Rate  
Refund Rate  
Stock Coverage  
Dispatch Time

---

# **6\. Ejemplos de nodos de estado**

Creative Fatigue

Hero SKU Stockout

Payment Failure

Inventory Pressure

Support Backlog

Discount Dependency

---

# **7\. Ejemplos de nodos de evento**

PRICE\_CHANGE

THEME\_DEPLOYMENT

CREATIVE\_LAUNCH

PROMOTION\_START

STOCKOUT

PAYMENT\_CONFIGURATION\_CHANGE

BUDGET\_INCREASE

---

# **8\. Ejemplos de nodos contextuales**

Seasonality  
Market Mix  
Device Mix  
Channel Mix  
Customer Mix

---

# **9\. EDGE**

Una arista debe expresar:

A  
may influence  
B

Nunca:

A always causes B

salvo identidades matemáticas o relaciones deterministas específicas.

---

# **11\. Tipos de relación**

Como mínimo:

MATHEMATICAL

MECHANISTIC

BEHAVIORAL

ECONOMIC

OPERATIONAL

TECHNICAL

STRUCTURAL

TEMPORAL

CONTEXTUAL

---

# **12\. Relación matemática**

Ejemplo:

Revenue  
\=  
Orders × AOV

Aquí no hablamos de correlación.

Existe una relación contable.

---

# **13\. Otra relación matemática**

CAC  
\=  
Acquisition Spend /  
New Customers

Si cambia el numerador o denominador, CAC cambia necesariamente.

---

# **14\. Relación mechanistic**

Ejemplo:

Payment Error Rate ↑  
→  
Payment Success ↓

Existe un mecanismo directo.

---

# **15\. Behavioral relation**

Ejemplo:

Shipping ETA worsens  
→  
Checkout completion may decline

No es matemáticamente necesario.

Pero es comportamiento plausible.

---

# **16\. Economic relation**

Ejemplo:

Discount Depth ↑  
→  
Gross Margin ↓

si todo lo demás permanece constante.

---

# **17\. Operational relation**

Order Volume ↑  
→  
Warehouse Load ↑

---

# **18\. Technical relation**

Site Latency ↑  
→  
Conversion may ↓

---

# **19\. Structural relation**

Creative Capacity  
limits  
Acquisition Scaling Capacity

---

# **20\. Contextual relation**

Device Mix Shift  
→  
Global CVR changes

sin deterioro within-device.

---

# **21\. Dirección causal**

Toda relación debe ser direccional.

A → B

no necesariamente:

B → A

---

# **22\. Bidirectional relationships**

Algunas pueden tener feedback.

Ejemplo:

Poor Reviews  
→  
Conversion ↓

y:

Product Experience ↓  
→  
Poor Reviews ↑

Pero deben modelarse como dos edges distintos.

---

# **23\. Feedback Loop**

Puede existir:

Poor Product Experience  
        ↓  
Reviews ↓  
        ↓  
CVR ↓  
        ↓  
Sales ↓  
        ↓  
Review volume ↓

O incluso bucles de crecimiento positivos.

---

# **24\. Feedback loop no significa círculo lógico**

Debemos diferenciar:

dynamic feedback

de:

circular reasoning

---

# **25\. Expected Sign**

Cada edge puede tener:

POSITIVE

NEGATIVE

NON\_MONOTONIC

CONTEXT\_DEPENDENT

---

# **26\. Positive relation**

Traffic ↑  
→  
Orders ↑

manteniendo CVR constante.

---

# **27\. Negative relation**

Refund Rate ↑  
→  
Net Revenue ↓

---

# **28\. Non-monotonic**

Ejemplo:

Discount Depth

puede:

increase CVR

pero también:

reduce margin

y a partir de cierto punto no seguir mejorando demanda proporcionalmente.

---

# **29\. Context-dependent**

Price ↑  
→  
Revenue ?

Puede:

increase  
decrease  
remain stable

según elasticidad.

---

# **30\. Conditions**

Cada edge puede requerir condiciones.

Ejemplo:

Price ↑  
→  
AOV ↑

solo si:

quantity/order mix does not fall enough

---

# **31\. Conditional Causality**

Ejemplo:

CPM ↑  
→  
CAC ↑

si:

CTR  
CVR

permanecen constantes.

---

# **32\. Mechanism**

Toda relación relevante debería describir:

> ¿A través de qué mecanismo puede A afectar B?

Ejemplo:

Creative quality deterioration  
→  
CTR decline

Mechanism:

ad becomes less compelling  
fewer impressions generate clicks

---

# **33\. Mechanism prevents nonsense**

Sin mechanism field el LLM podría generar conexiones plausibles superficialmente pero incorrectas.

---

# **34\. Causal layers**

Podemos separar:

L0 — BUSINESS OUTCOMES

L1 — ECONOMIC DRIVERS

L2 — COMMERCIAL DRIVERS

L3 — FUNNEL DRIVERS

L4 — OPERATIONAL/TECHNICAL DRIVERS

L5 — ROOT CONDITIONS

---

# **35\. Business outcomes**

Ejemplos:

Revenue  
Contribution  
Cash  
Growth  
Customer Value

---

# **36\. Economic drivers**

AOV  
Gross Margin  
CAC  
Refunds  
Shipping Cost  
Discounts

---

# **37\. Commercial drivers**

Traffic  
New Customers  
Repeat Customers  
Demand  
Offer Response

---

# **38\. Funnel drivers**

CTR  
PDP engagement  
ATC  
Checkout  
Payment

---

# **39\. Operational / technical drivers**

Stock Availability  
Site Speed  
Payment Errors  
Delivery SLA  
Support Capacity

---

# **40\. Root conditions**

Ejemplos:

poor forecasting  
insufficient creative production  
incorrect payment configuration  
supplier dependency  
poor product-market fit

---

# **41\. Outcome decomposition**

Revenue debe tener relaciones conocidas.

Simplificado:

Revenue  
≈  
Traffic  
×  
Conversion  
×  
AOV

---

# **42\. Revenue extended**

También:

Revenue  
\=  
New Customer Revenue  
\+  
Returning Customer Revenue

---

# **43\. Revenue by segment**

Revenue  
\=  
Σ Market Revenue

o:

Σ Product Revenue

---

# **44\. Traffic graph**

Traffic puede depender de:

Paid Traffic  
Organic Traffic  
Direct Traffic  
Email Traffic  
Referral  
Affiliate

---

# **45\. Paid traffic relationships**

Spend ↑  
→  
Impressions ↑

según CPM.

Impressions  
×  
CTR  
→  
Clicks

---

# **46\. CPM graph**

CPM puede verse afectado por:

Auction Competition  
Audience  
Seasonality  
Placement Mix  
Market  
Platform Conditions

---

# **47\. CTR graph**

CTR puede verse afectado por:

Creative  
Audience Match  
Offer  
Brand Recognition  
Placement  
Frequency

---

# **48\. CPC graph**

Simplificadamente:

CPM  
\+  
CTR  
→  
CPC

Con:

CPM ↑  
→ CPC ↑

CTR ↑  
→ CPC ↓

manteniendo otros factores.

---

# **49\. CAC graph**

CPC  
\+  
CVR  
→  
CAC

Simplificación conceptual:

CAC ≈ CPC / CVR

---

# **50\. CAC can deteriorate from different routes**

CPM ↑  
        ↓  
      CPC ↑  
        ↓  
      CAC ↑

o:

CTR ↓  
  ↓  
CPC ↑  
  ↓  
CAC ↑

o:

CVR ↓  
  ↓  
CAC ↑

Esto es precisamente por qué no debe diagnosticarse desde CAC solo.

---

# **51\. Conversion graph**

Sessions  
↓  
PDP  
↓  
ATC  
↓  
Cart  
↓  
Checkout  
↓  
Payment  
↓  
Order

---

# **52\. PDP drivers**

PDP conversion puede verse afectada por:

Product  
Price  
Offer  
Trust  
Reviews  
Stock  
Page Experience  
Traffic Quality  
Device  
Site Performance

---

# **53\. ATC drivers**

Product desirability  
Variant availability  
Price  
Offer  
PDP clarity  
Trust

---

# **54\. Checkout drivers**

Shipping cost  
Shipping ETA  
Checkout UX  
Required fields  
Payment methods  
Trust  
Technical errors

---

# **55\. Payment drivers**

Payment Provider  
Fraud Rules  
Payment Methods  
Technical Errors  
Issuer Declines  
Configuration  
Market Compatibility

---

# **56\. AOV graph**

AOV puede verse afectado por:

Price  
Product Mix  
Units per Order  
Bundles  
Upsells  
Cross-sells  
Discount Structure  
Free Shipping Threshold

---

# **57\. Offer graph**

Offer afecta potencialmente:

CTR  
PDP engagement  
CVR  
AOV  
Margin  
CAC

Por tanto es nodo muy conectado.

---

# **58\. Price graph**

Price ↑  
→  
AOV potentially ↑

Price ↑  
→  
CVR potentially ↓

Price ↑  
→  
margin/order potentially ↑

Son varias relaciones simultáneas.

---

# **59\. Discount graph**

Discount ↑  
→  
CVR potentially ↑

Discount ↑  
→  
AOV behaviour may change

Discount ↑  
→  
Gross Margin ↓

Discount ↑  
→  
Promotion dependency potentially ↑

---

# **60\. Product graph**

Product puede afectar:

Demand  
CTR  
CVR  
Repeat  
Refunds  
Reviews  
AOV  
Word of Mouth

---

# **61\. Product quality graph**

Quality ↓  
→  
Refunds ↑  
→  
Net Revenue ↓

También:

Quality ↓  
→  
Reviews ↓  
→  
CVR ↓

Y:

Quality ↓  
→  
Repeat ↓  
→  
LTV ↓

---

# **62\. Inventory graph**

Inventory tiene enorme importancia cross-capability.

Stock Availability ↓  
→  
PDP Conversion ↓

---

# **63\. Stockout graph**

Hero SKU Stockout  
→  
Conversion ↓  
→  
Orders ↓  
→  
Revenue ↓

---

# **64\. Stockout \+ acquisition**

También:

Stock Availability ↓  
→  
CVR ↓  
→  
CAC ↑

Aunque Meta no haya empeorado.

---

# **65\. Inventory-finance graph**

Inventory ↑  
→  
Cash tied up ↑  
→  
Cash availability ↓

---

# **66\. Overstock**

Overstock ↑  
→  
Discount Pressure ↑  
→  
Margin ↓

posible.

---

# **67\. Forecasting**

Forecast Error ↑  
→  
Inventory Imbalance ↑

---

# **68\. Lead times**

Supplier Lead Time ↑  
→  
Stockout Risk ↑

manteniendo cobertura.

---

# **69\. Operations graph**

Order Volume ↑  
→  
Operational Load ↑

---

# **70\. Capacity saturation**

Operational Load  
\>  
Capacity

puede producir:

Backlog ↑  
Dispatch Time ↑  
Order Errors ↑

---

# **71\. Operations → Customer Experience**

Delivery Delay ↑  
→  
Complaints ↑

---

# **72\. Operations → Retention**

Poor Delivery Experience  
→  
Repeat Purchase ↓

potencialmente.

---

# **73\. Operations → Refunds**

Shipping Damage ↑  
→  
Refunds ↑

---

# **74\. Support graph**

Ticket Volume ↑  
→  
Support Load ↑

---

# **75\. Support saturation**

Support Load \> Capacity  
→  
Response Time ↑  
→  
Customer Experience ↓

---

# **76\. Retention graph**

Repeat puede depender de:

Product Satisfaction  
Delivery Experience  
CRM  
Offer  
Frequency of Need  
Customer Quality

---

# **77\. LTV graph**

Repeat Rate ↑  
→  
LTV ↑

normalmente.

---

# **78\. CAC tolerance**

LTV ↑  
→  
Sustainable CAC ceiling ↑

potencialmente.

---

# **79\. Retention → acquisition economics**

Por tanto:

Retention ↓  
→  
LTV ↓  
→  
CAC tolerance ↓

Puede hacer que adquisición aparentemente igual se vuelva económicamente peor.

---

# **80\. CRM graph**

Email Engagement ↓  
→  
CRM Revenue ↓

---

# **81\. CRM revenue and business**

CRM Revenue ↓  
→  
Returning Revenue ↓

según dependencia.

---

# **82\. Finance graph**

Contribution simplificado:

Revenue  
\-  
Variable Costs  
\-  
Acquisition Cost  
\=  
Contribution

---

# **83\. Contribution drivers**

Revenue  
COGS  
Discounts  
Shipping Subsidy  
Payment Fees  
Refunds  
Ad Spend

---

# **84\. Revenue growth can hurt contribution**

Ejemplo:

Revenue ↑

pero:

CAC ↑↑  
Discount ↑

puede producir:

Contribution ↓

---

# **85\. Cash graph**

Cash puede verse afectado por:

Contribution  
Inventory Purchases  
Payment Terms  
Receivables  
Debt Service  
Taxes  
Capex

---

# **86\. Growth and cash**

Growth ↑  
→  
Inventory Requirement ↑  
→  
Cash Requirement ↑

en modelos físicos.

Por tanto:

growth

puede presionar cash aunque sea rentable.

---

# **87\. Creative graph**

Creative afecta principalmente:

Attention  
CTR  
Traffic Quality  
Demand Perception

---

# **88\. Creative fatigue graph**

Conceptualmente:

Exposure ↑  
\+  
Creative Age ↑  
\+  
Low Refresh  
→  
Audience Response ↓  
→  
CTR ↓  
→  
CPC ↑  
→  
CAC ↑

Esto es ruta causal plausible.

No confirmada automáticamente.

---

# **89\. Creative pipeline graph**

Creative Production Capacity ↓  
→  
New Creative Launches ↓  
→  
Winner Replacement ↓  
→  
Creative Concentration ↑  
→  
Fatigue Risk ↑

---

# **90\. Team → Creative**

Creative Team Capacity ↓  
→  
Creative Output ↓

---

# **91\. Team → Operations**

Staff Capacity ↓  
→  
Backlog ↑

---

# **92\. Team → Decision speed**

Ownership Ambiguity ↑  
→  
Decision Latency ↑

---

# **93\. Decision latency**

Puede afectar:

Recovery Time  
Execution Speed  
Experimentation Velocity

---

# **94\. Technology graph**

Site Latency ↑  
→  
Bounce ↑  
→  
CVR ↓

---

# **95\. Technical error graph**

JS Error ↑  
→  
Functional Failure ↑  
→  
Conversion ↓

si afecta critical path.

---

# **96\. Deployment graph**

Deployment  
→  
Regression

es posibilidad.

No todos los deployments causan regresión.

---

# **97\. Data graph**

Data también tiene relaciones indirectas.

Tracking Quality ↓  
→  
Decision Quality ↓

---

# **98\. Poor measurement**

Data Reliability ↓  
→  
Diagnostic Confidence ↓

Esto sí es relación directa dentro del sistema.

---

# **99\. Data → resource allocation**

Potencialmente:

Incorrect Attribution  
→  
Incorrect Budget Allocation  
→  
Real Performance ↓

Esto puede crear daños empresariales reales.

---

# **100\. Strategy graph**

Objective Clarity ↓  
→  
Resource Misalignment ↑

---

# **101\. Resource misalignment**

Resource Allocation mismatch  
→  
Execution effectiveness ↓

---

# **102\. Strategy → portfolio**

Poor SKU allocation  
→  
Inventory imbalance

posible.

---

# **103\. Cross-capability graph**

La fuerza de D7 está aquí.

Ejemplo:

Creative  
→ Acquisition  
→ Unit Economics  
→ Finance

---

# **104\. Otro**

Inventory  
→ Conversion  
→ Acquisition  
→ Revenue  
→ Finance

---

# **105\. Otro**

Operations  
→ Customer Experience  
→ Retention  
→ LTV  
→ CAC tolerance  
→ Growth capacity

---

# **106\. Otro**

Data  
→ Decisions  
→ Strategy  
→ Resource Allocation  
→ Performance

---

# **107\. Causal chain**

El sistema debe poder generar rutas.

Ejemplo:

Revenue ↓  
←  
Orders ↓  
←  
CVR ↓  
←  
Payment Success ↓  
←  
Payment Errors ↑  
←  
Payment Configuration Change

---

# **108\. Backward traversal**

Ante efecto:

Revenue ↓

D7 permite preguntar:

> ¿Qué nodos upstream podrían producirlo?

---

# **109\. Forward traversal**

Ante evento:

Hero SKU stockout

D7 permite preguntar:

> ¿Qué métricas downstream deberían verse afectadas?

---

# **110\. Esta bidireccionalidad lógica es esencial**

Aunque los edges tengan dirección causal:

cause → effect

el diagnóstico puede recorrer:

effect → candidate causes

para investigar.

---

# **111\. Ancestors**

Para un nodo:

CAC

ancestors posibles:

CPM  
CTR  
CVR  
Audience  
Creative  
Offer  
Inventory  
Technology

---

# **112\. Descendants**

De:

CAC

pueden derivarse:

Contribution  
Payback  
Cash  
Scaling Capacity

---

# **113\. Path Length**

No todas las causas están igual de cerca.

DIRECT\_PARENT

vs:

DISTANT\_ANCESTOR

---

# **114\. Direct cause candidate**

Ejemplo:

Payment Errors ↑

es cercano a:

Payment Success ↓

---

# **115\. Distant root condition**

Poor Change Management

podría estar mucho más arriba.

---

# **116\. Causal depth**

D8/D9 deberán decidir hasta dónde merece investigar.

---

# **117\. Edge strength**

Puede existir:

STRONG

MODERATE

WEAK

CONTEXT\_DEPENDENT

Pero representa fuerza de relación conceptual.

No evidencia del caso concreto.

---

# **118\. Edge Evidence Level**

Podemos clasificar conocimiento causal:

DETERMINISTIC

STRONGLY\_ESTABLISHED

COMMON\_MECHANISM

PLAUSIBLE

SPECULATIVE

---

# **119\. Deterministic**

Ejemplo:

Revenue \= Orders × AOV

---

# **120\. Strongly established**

Payment failure  
→  
completed orders decrease

---

# **121\. Common mechanism**

Site latency  
→  
conversion deterioration

---

# **122\. Plausible**

competitor promotion  
→  
CVR deterioration

puede ser plausible pero requiere evidencia.

---

# **123\. Speculative edges**

Idealmente no deberían utilizarse para diagnósticos fuertes.

---

# **125\. System Logic**

Ejemplo:

Revenue arithmetic

---

# **126\. Internal Evidence**

Relaciones confirmadas repetidamente con datos internos.

---

# **127\. External Knowledge**

Principios generales documentados.

---

# **128\. Expert Heuristic**

Reglas prácticas razonables pero no universales.

---

# **129\. Tenant Learned**

Ejemplo:

For this brand:  
TV appearance  
→  
branded search spike after 2 hours

F9 podrá aprenderlo.

---

# **133\. Example tenant relation**

Influencer X campaigns  
→  
direct traffic surge

es específico del negocio.

---

# **134\. Causal confidence per case**

No confundir:

EDGE PRIOR

con:

CASE CAUSAL CONFIDENCE

---

# **135\. Ejemplo**

Global graph:

Stockout → CVR decline  
relation strength HIGH

Caso concreto:

stockout existed  
but affected only 2% revenue

Case confidence de que explique revenue global:

LOW

---

# **137\. Temporal fit**

Pregunta:

> ¿La causa ocurrió antes que el efecto?

---

# **138\. Temporal precedence**

Regla:

CAUSE  
must precede  
EFFECT

salvo relaciones simultáneas o measurement artifacts específicos.

---

# **139\. Invalid temporal relation**

Ejemplo:

CVR started falling Sept 1

Price changed Sept 5

Entonces el price change no puede explicar el inicio de la caída.

---

# **140\. Lag fit**

Pero no siempre el efecto es inmediato.

Ejemplo:

Creative production declines

puede tardar semanas en reflejarse en CAC.

---

# **142\. Example lag**

Payment config change  
→ payment failure

lag:  
seconds/minutes

---

# **143\. Retention lag**

Poor acquisition cohort quality  
→ repeat decline

lag:  
30–180 days

---

# **144\. Scope fit**

Pregunta:

> ¿La supuesta causa afecta al mismo segmento que el efecto?

---

# **145\. Ejemplo**

Effect:

Spain CVR ↓

Potential cause:

France price increase

Scope fit:

NONE

---

# **146\. Magnitude fit**

Pregunta:

> ¿La magnitud de la causa es suficiente para explicar el efecto?

---

# **147\. Example**

Hero SKU:

2% revenue share

stockout.

Global Revenue:

\-30%

No puede explicar por sí solo \-30%.

---

# **148\. Causal contribution**

Idealmente estimar:

possible contribution to observed change

---

# **149\. Necessary vs sufficient causes**

Algunas causas son:

NECESSARY

SUFFICIENT

CONTRIBUTORY

según contexto.

---

# **150\. Contributory cause**

Ejemplo:

CPM inflation

puede explicar parte del CAC increase.

No necesariamente todo.

---

# **151\. Multiple causality**

Los ecommerce suelen tener:

MULTICAUSALITY

Ejemplo:

CAC \+30%

puede venir de:

CPM \+10%  
CTR \-8%  
CVR \-12%

simultáneamente.

---

# **152\. Causal decomposition**

El sistema debe permitir:

Cause A:  
partial

Cause B:  
partial

Cause C:  
partial

---

# **153\. No single-root-cause obsession**

Aunque D9 busque root causes, un problema puede tener varias.

---

# **154\. Cause interaction**

Dos factores pueden amplificarse.

Ejemplo:

Price ↑  
\+  
Traffic Quality ↓  
→  
CVR ↓↓

---

# **155\. Interaction edge**

Podemos permitir:

INTERACTION

entre varios nodos.

---

# **156\. Hyperedge concept**

Técnicamente algunas relaciones pueden necesitar:

A \+ B → C

no solo:

A → C

---

# **157\. Example**

High Order Volume  
\+  
Low Warehouse Capacity  
→  
Backlog

El volumen alto por sí solo no genera backlog si capacidad sobra.

---

# **158\. Threshold effects**

Algunas relaciones se activan a partir de threshold.

Operational Load  
\>  
Capacity Threshold  
→  
SLA deterioration

---

# **159\. Saturation effects**

Ejemplo:

Spend ↑

puede mejorar customers hasta:

audience saturation

donde marginal CAC empeora.

---

# **160\. Non-linear graph**

Por tanto el grafo no debe asumir relaciones lineales.

---

# **161\. Mediators**

Un mediator es nodo intermedio.

Ejemplo:

Creative fatigue  
→  
CTR ↓  
→  
CPC ↑  
→  
CAC ↑

CTR y CPC median la relación.

---

# **162\. Confounders**

Un confounder puede afectar dos variables.

Ejemplo:

Seasonality  
→ CPM ↑

y también:

Seasonality  
→ CVR ↑

Si vemos CPM y CVR cambiar juntos, no significa que uno cause al otro.

---

# **163\. Confounder node**

Debe modelarse explícitamente.

---

# **164\. D12 profundizará confusores**

Pero D7 debe permitir representarlos.

---

# **165\. Collider risk**

Para razonamiento avanzado, algunas variables pueden ser efecto de varias causas.

Ejemplo:

CAC  
← CTR  
← Creative

y:

CAC  
← CVR  
← Offer

Condicionar indebidamente puede crear falsas relaciones.

No hace falta exponer teoría estadística al usuario, pero el motor debe evitar asociaciones ingenuas.

---

# **166\. Causal Graph ≠ Correlation Graph**

No queremos construir edges porque dos métricas históricamente correlacionen.

---

# **167\. Correlation can generate candidate edge**

Pero debe quedar:

UNVALIDATED\_RELATION

hasta tener mecanismo.

---

# **168\. Mechanism requirement**

Toda relación causal global debe tener:

plausible mechanism

---

# **169\. Evidence requirement**

Toda relación confirmada en un caso debe tener:

case evidence

---

# **170\. Counterfactual reasoning**

Pregunta poderosa:

> Si esta causa no hubiera ocurrido, ¿esperaríamos el mismo efecto?

Ejemplo:

Payment deployment  
→ payment failures

Si otros payment methods no afectados siguen normales, refuerza hipótesis.

---

# **171\. Counterfactual proxy**

No siempre podremos experimentar.

Podemos usar:

unaffected segments  
control markets  
other devices  
previous period

como proxies.

---

# **172\. Natural experiment**

Ejemplo:

New checkout deployed only in Spain

Spain:

CVR ↓

France:

stable

Esto aporta evidencia causal fuerte.

---

# **173\. Control group**

D7 debe permitir edges evaluados con:

CONTROL

cuando exista.

---

# **174\. Difference in Differences concept**

Más adelante podemos utilizar métodos de comparación:

treated segment  
vs  
control segment  
before/after

para mejorar causal inference.

---

# **175\. Experiments**

Experimentos A/B son evidencia causal de alta calidad.

---

# **176\. Experiment edge update**

Si test demuestra:

New PDP  
→ CVR \+8%

podemos aprender relación específica del tenant.

---

# **177\. Case causal evidence hierarchy**

Podemos ordenar:

RANDOMIZED\_EXPERIMENT

NATURAL\_EXPERIMENT

BEFORE\_AFTER\_WITH\_CONTROL

TEMPORAL \+ MECHANISTIC EVIDENCE

MULTI\_SOURCE\_CORROBORATION

CORRELATION\_ONLY

---

# **178\. Confidence should reflect evidence hierarchy**

Correlation-only no debería producir HIGH causal confidence.

---

# **179\. Causal Search**

Ante síntoma:

PAYMENT\_COMPLETION\_FAILURE

el grafo devuelve parents:

Payment Provider  
Payment Configuration  
Fraud Rules  
Payment Method Availability  
Technical Regression  
Issuer Declines  
Market-specific incompatibility

---

# **184\. Example search**

Target:

CAC ↑

Parents:

CPC ↑  
CVR ↓

D5 dice:

CPC ↑  
CVR stable

Entonces el branch:

CVR

pierde peso.

Exploramos:

CPC

Parents:

CPM ↑  
CTR ↓

D5:

CPM stable  
CTR ↓

Entonces exploramos:

CTR

Parents:

Creative  
Audience  
Offer  
Placement  
Frequency

Ahora D8 genera hipótesis.

---

# **185\. Esto es razonamiento estructurado**

No es:

> CAC sube → haz nuevos anuncios.

---

# **195\. Causal chain example**

Payment configuration change  
        ↓ HIGH  
Payment errors increase  
        ↓ HIGH  
Payment success declines  
        ↓ HIGH  
Orders decline  
        ↓ HIGH  
Revenue declines

Path confidence:

HIGH

---

# **196\. Another**

Competitor discount  
      ↓ LOW  
Customer interest ↓  
      ↓ MEDIUM  
CVR ↓

Path confidence:

LOW/MEDIUM

---

# **198\. Rootward traversal**

D7 debe permitir buscar:

deepest supported ancestor

---

# **199\. But D7 does not decide root cause**

D9 lo hará.

---

# **200\. Constraint graph**

También podemos modelar:

LIMITS

relaciones.

Ejemplo:

Creative Production Capacity  
LIMITS  
Acquisition Scaling

---

# **202\. Requires relationship**

Advanced Acquisition Scaling  
REQUIRES  
Reliable Unit Economics

es más estructural que causal.

---

# **203\. Constraint dependency**

Orders  
REQUIRE  
Stock availability

---

# **204\. Scaling graph**

Ejemplo:

Spend ↑  
→ Demand ↑  
→ Orders ↑  
→ Inventory consumption ↑  
→ Operations load ↑

Escalar marketing afecta más que marketing.

---

# **205\. System-wide reasoning**

Esto permite al copiloto anticipar:

If acquisition scales,  
what other capabilities become stressed?

Aunque recomendaciones llegan después.

---

# **206\. Bottleneck candidate**

D7 puede identificar nodos con muchas downstream dependencies.

---

# **207\. Centrality**

Técnicamente podemos calcular:

degree  
betweenness  
critical path centrality

Pero no debemos confundir centralidad del grafo con prioridad del negocio.

---

# **208\. High-centrality node**

Ejemplo:

Inventory

puede afectar muchas áreas.

---

# **209\. But no automatic priority**

Porque puede estar completamente sano.

---

# **210\. Critical Path**

Algunos nodos son obligatorios para transacción.

Site  
Checkout  
Payment  
Inventory  
Fulfillment

dependiendo del modelo.

---

# **211\. Critical Path Graph**

Puede modelarse separado.

---

# **212\. Failure propagation**

Ejemplo:

Payment failure

tiene downstream inmediato.

---

# **213\. Blast radius**

Cada nodo puede tener:

BLAST\_RADIUS

conceptual.

---

# **214\. Blast Radius**

Mide:

> cuántas áreas y qué porcentaje del negocio puede afectar una falla.

---

# **215\. Example**

One minor email flow

blast radius bajo.

Primary payment provider

blast radius alto.

---

# **216\. Causal graph \+ exposure**

D7 debería combinar estructura con D4 exposure.

---

# **217\. Example**

Dos payment providers:

Provider A:  
90% transactions

Provider B:  
10%

La misma falla tiene impacto distinto.

---

# **219\. Scoped node**

Ejemplo:

CVR\[Spain\]\[Mobile\]

---

# **221\. Template graph**

Ejemplo:

STOCK\_AVAILABILITY  
→  
CVR

Runtime:

SKU\_123 availability  
→  
SKU\_123 PDP CVR

---

# **222\. Graph inheritance**

Relaciones generales se instancian por scope.

---

# **223\. Capability graph**

También puede existir nivel superior:

Product  
→ Conversion  
→ Acquisition Economics

---

# **224\. Metric graph**

Más preciso:

Stock Rate  
→ PDP CVR  
→ CAC

---

# **226\. Coarse reasoning**

Para resumen ejecutivo.

---

# **227\. Fine reasoning**

Para diagnóstico profundo.

---

# **228\. Event-to-metric graph**

Ejemplo:

PRICE\_CHANGE  
→  
AOV  
CVR  
Margin

---

# **229\. Deployment graph**

THEME\_DEPLOYMENT  
→  
Site Errors  
Page Speed  
PDP UX  
Checkout UX  
Tracking

---

# **230\. Campaign event graph**

BUDGET\_INCREASE  
→  
Spend  
→  
Impressions  
→  
Clicks  
→  
Customers

---

# **231\. Promotion event graph**

PROMOTION\_START  
→  
CVR ↑  
Orders ↑  
AOV ?  
Margin ↓  
Inventory depletion ↑

---

# **232\. Promotion downstream second-order effects**

Inventory depletion ↑  
→  
Stockout risk ↑

---

# **233\. Post-promotion effect**

Promotion  
→  
Demand pull-forward  
→  
Post-promotion demand ↓

D12 controlará confusión.

---

# **234\. External factors**

D7 debe permitir nodos como:

Competitor Action  
Platform Auction Pressure  
Macro Demand  
Weather  
Holiday

---

# **235\. External factors have lower observability**

Y por tanto muchas veces:

confidence lower

---

# **236\. Market demand graph**

Category Demand ↓  
→  
Traffic Potential ↓

---

# **237\. Brand demand graph**

Brand Demand ↓  
→  
Direct Traffic ↓  
→  
Organic Branded Traffic ↓

---

# **238\. Brand demand \+ acquisition**

A menor branded demand:

blended conversion

puede cambiar por tráfico mix.

---

# **239\. Data quality edges**

D1 también debe aparecer:

Tracking Failure  
→  
Observed Purchase Events ↓

Pero:

Actual Orders

puede mantenerse.

---

# **240\. Observed vs real metrics**

El grafo debe distinguir:

REAL\_WORLD\_VARIABLE

y:

OBSERVED\_METRIC

Esto es esencial.

---

# **241\. Example**

Actual Purchases  
→  
Shopify Orders Observed

y:

Tracking Configuration  
→  
GA Purchases Observed

---

# **242\. Measurement layer**

Puede modelarse como:

REAL BUSINESS  
     ↓  
MEASUREMENT SYSTEM  
     ↓  
OBSERVED DATA

---

# **243\. Measurement error causal path**

Pixel removed  
→  
Tracked purchase ↓

sin:

Actual purchase ↓

---

# **244\. Critical anti-hallucination feature**

Esto permite distinguir:

business deterioration

de:

measurement deterioration

---

# **246\. Example**

EDGE:  
Payment Errors → Payment Success

Support:  
Errors \+180%  
Success \-25%  
same onset  
same market

Contradictions:  
none

---

# **247\. Edge confidence**

HIGH

---

# **248\. Another edge**

Payment Config Change → Payment Errors

Support:  
temporal proximity

Contradictions:  
no config diff available

Confidence:  
MEDIUM

Entonces root cause no debería todavía ser HIGH.

---

# **249\. Causal explanation should expose weak links**

Ejemplo:

> El vínculo entre errores de pago y caída de payment success es fuerte. La relación con el cambio de configuración es probable, pero todavía menos sólida porque falta validar el diff de configuración.

Eso es pensamiento excelente.

---

# **250\. Causal ambiguity**

Puede haber:

CAUSE\_A  
CAUSE\_B  
CAUSE\_C

todos compatibles.

D7 debe preservar el branching.

---

# **251\. Competing paths**

Ejemplo:

CAC ↑

Path A:

CTR ↓  
→ CPC ↑  
→ CAC ↑

Path B:

CVR ↓  
→ CAC ↑

Path C:

CPM ↑  
→ CPC ↑  
→ CAC ↑

---

# **252\. Signals prune paths**

Si:

CVR stable  
CPM stable  
CTR ↓

Path A gana peso.

---

# **253\. D8 formalizará hipótesis**

Cada remaining path puede convertirse en hypothesis.

---

# **257\. Edge condition example**

FROM:  
CPM

TO:  
CPC

SIGN:  
positive

CONDITION:  
CTR held approximately constant

---

# **259\. Metric lineage \+ causal graph**

Son conceptos diferentes.

LINEAGE:  
how metric is calculated

CAUSAL GRAPH:  
what may influence metric

---

# **260\. Example**

CAC lineage:

Spend / New Customers

Causal parents:

CPM  
CTR  
CVR  
Traffic Quality

---

# **261\. Formula decomposition should be high confidence**

Porque mathematically constrained.

---

# **262\. Behavioral edges require more caution**

---

# **263\. RAG role**

RAG debe contener:

causal principles  
mechanisms  
common causal chains  
conditions  
exceptions

---

# **278\. Example full diagnosis setup**

Target:

Revenue \-18%

D5:

Traffic stable  
AOV stable  
CVR ↓

D6:

Conversion-driven revenue deterioration

D7:

Revenue  
← Orders  
← CVR

Después:

CVR  
← PDP  
← Checkout  
← Payment

D5 indica:

PDP stable  
ATC stable  
Checkout stable  
Payment ↓

D6:

Payment-stage failure

D7 parents:

Provider  
Configuration  
Fraud  
Payment Method  
Technical Regression

Ahora D8 puede crear hipótesis.

---

# **279\. Another full example**

Target:

CAC \+30%

D5:

CPM stable  
CTR \-20%  
CPC \+22%  
CVR stable

D6:

Pre-click acquisition deterioration

D7 path:

Creative/Audience/Offer  
→ CTR  
→ CPC  
→ CAC

Ahora D8 compara:

Creative fatigue  
Audience saturation  
Offer weakening  
Traffic mix

---

# **280\. Another example: margin**

Target:

Contribution \-20%

D5:

Revenue \+5%  
Discounts \+40%  
Shipping subsidy \+15%  
CAC \+12%

D6:

Margin/contribution compression

D7:

Discount ↑  
Shipping Cost ↑  
CAC ↑  
        ↓  
Contribution ↓

Puede haber multicausalidad.

---

# **281\. Causal graph should support positive outcomes**

Ejemplo:

Creative winner  
→ CTR ↑  
→ CPC ↓  
→ CAC ↓  
→ Contribution ↑

---

# **282\. Learning from success**

F9 puede analizar:

what causal paths preceded improvement

---

# **283\. Counterfactual business reasoning**

Una función futura podría responder:

> Si CVR hubiera permanecido en baseline, ¿cuánto revenue habríamos esperado?

Eso combina causal structure y decomposition.

---

# **284\. But not all counterfactuals are causal certainty**

Debe mostrar assumptions.

---

# **285\. Causal simulation readiness**

D7 prepara futura capacidad para:

what-if analysis

pero simulación pertenece más adelante.

---

# **286\. Constraint detection readiness**

D9 podrá preguntar:

Which upstream node currently caps downstream performance?

---

# **287\. Root cause readiness**

D9 podrá buscar:

deepest supported actionable ancestor

---

# **288\. Actionable root cause**

No necesariamente el nodo filosóficamente más profundo.

Ejemplo:

Poor management

es demasiado abstracto.

Payment config deployment introduced invalid settings

es diagnósticamente útil.

---

# **289\. Root cause depth constraint**

Más adelante deberemos parar cuando:

further depth adds little diagnostic utility

---

# **290\. Graph anti-pattern: everything connected**

Si conectamos todo con todo:

graph becomes useless

---

# **291\. Edge discipline**

Solo edge si existe:

mechanism  
conditions  
diagnostic usefulness

---

# **292\. Graph anti-pattern: vague nodes**

Evitar:

Bad Marketing

como nodo.

Mejor:

CTR  
Creative Response  
Traffic Quality

---

# **293\. Graph anti-pattern: recommendations as nodes**

No:

Launch Creatives

como causa del problema actual.

Acciones están fuera del diagnóstico.

---

# **294\. Graph anti-pattern: subjective labels**

Evitar:

Great Brand  
Bad Team

sin definición observable.

---

# **295\. Graph anti-pattern: expert slogans**

No guardar doctrinas genéricas como edges si no existe mecanismo.

---

# **296\. Graph granularity governance**

Un nodo debe ser suficientemente:

specific  
observable  
useful

---

# **297\. Node observability**

Puede clasificarse:

DIRECTLY\_OBSERVED

DERIVED

LATENT

EXTERNAL

---

# **298\. Directly observed**

Payment Error Rate

---

# **299\. Derived**

CAC

---

# **300\. Latent**

Creative Fatigue

se infiere de indicadores.

---

# **301\. External**

Competitor Pressure

---

# **302\. Latent nodes require more evidence**

Nunca deben convertirse en high confidence desde una sola señal.

---

# **303\. Causal Node Health**

Un node también puede tener:

current\_state

pero debe evitar duplicación con D4.

---

# **304\. Better approach**

D4 maneja health de capacidades.

D7 maneja causal topology.

---

# **305\. Causal pathways by capability**

## **Acquisition**

Auction  
Creative  
Audience  
Offer  
Conversion  
→  
CAC

---

# **306\. Creative**

Production Capacity  
Testing Velocity  
Concept Diversity  
Exposure  
→  
Creative Response

---

# **307\. Conversion**

Traffic Quality  
Product  
Offer  
Price  
Inventory  
UX  
Technology  
Payment  
Shipping  
→  
CVR

---

# **308\. Retention**

Product Satisfaction  
Delivery Experience  
Support  
CRM  
Customer Quality  
→  
Repeat/LTV

---

# **309\. Inventory**

Demand  
Forecasting  
Lead Time  
Purchase Orders  
Supplier Reliability  
→  
Availability

---

# **310\. Operations**

Order Load  
Capacity  
Process Quality  
Carrier  
Staff  
→  
SLA

---

# **311\. Finance**

Revenue  
Margin  
CAC  
Inventory  
Working Capital  
→  
Cash

---

# **312\. Data**

Tracking  
Integrations  
Definitions  
Sync  
→  
Observed Metrics  
→  
Decision Reliability

---

# **313\. Technology**

Deployments  
Architecture  
Traffic Load  
Third-party Apps  
→  
Errors/Latency  
→  
Business Funnel

---

# **314\. Team**

Capacity  
Skill  
Ownership  
Process  
→  
Execution Velocity

---

# **315\. Strategy**

Objectives  
Tradeoffs  
Resource Allocation  
→  
Execution Pattern  
→  
Business Outcomes

---

# **316\. Cross-capability causal map**

Simplificado:

MARKET  
  ↓  
PRODUCT  
  ↓  
OFFER  
  ↓  
ACQUISITION  
  ↓  
CONVERSION  
  ↓  
CUSTOMER  
  ↓  
RETENTION

INVENTORY ───────→ CONVERSION  
     ↓  
OPERATIONS ──────→ RETENTION

UNIT ECONOMICS ──→ FINANCE

DATA ────────────→ ALL DECISIONS

TECHNOLOGY ──────→ ACQUISITION / CONVERSION / OPERATIONS

TEAM ────────────→ EXECUTION

STRATEGY ────────→ RESOURCE ALLOCATION

---

# **317\. This is not strictly linear**

El ecommerce real es una red.

No un funnel único.

---

# **318\. Demand loop**

Product Quality  
→ Reviews  
→ Conversion  
→ Customers  
→ Reviews

---

# **319\. Retention loop**

Customer Satisfaction  
→ Repeat  
→ Revenue  
→ ability to invest in experience

---

# **320\. Scale loop**

Acquisition  
→ Orders  
→ Data  
→ Learning  
→ Acquisition

en organizaciones maduras.

---

# **321\. Failure loop**

Low Cash  
→ Inventory underbuy  
→ Stockout  
→ Revenue ↓  
→ Cash ↓

Puede crear círculo vicioso.

---

# **322\. Reinforcing loop**

Debe poder marcarse:

REINFORCING\_LOOP

---

# **323\. Balancing loop**

Ejemplo:

Spend ↑  
→ CAC ↑  
→ scaling reduced  
→ CAC stabilizes

---

# **324\. Loop analysis**

No es prioritario para primera implementación, pero el modelo debe soportarlo.

---

# **326\. Example output**

TARGET:  
CAC increase

SUPPORTED PATH:

Creative Response ↓  
→ CTR ↓  
→ CPC ↑  
→ CAC ↑

Confidence:  
MEDIUM\_HIGH

ALTERNATIVE PATH:

Auction Pressure ↑  
→ CPM ↑  
→ CPC ↑  
→ CAC ↑

Status:  
CONTRADICTED  
because CPM stable.

UNTESTED PATH:

Audience Saturation  
→ CTR ↓

Missing:  
audience reach/frequency.

---

# **327\. This is already highly useful**

Pero todavía no decimos:

Root Cause \= Creative Fatigue

---

# **329\. D8 then asks**

> ¿Qué explicaciones concretas pueden generar estas rutas?

---

# **340\. Relación con D0**

D0 exige:

causal traceability

D7 proporciona la estructura.

---

# **341\. Relación con D1**

D1 determina qué nodos observados son fiables.

---

# **342\. Relación con D2**

D2 aporta:

events  
context  
seasonality  
mix

como posibles nodos y confounders.

---

# **343\. Relación con D3**

D3 aporta relaciones estructurales:

requires  
limits  
maturity dependency

---

# **344\. Relación con D4**

D4 muestra qué capacidades están enfermas.

D7 puede explicar cómo una capacidad enferma puede afectar otras.

---

# **345\. Relación con D5**

D5 aporta:

which nodes changed

---

# **346\. Relación con D6**

D6 aporta:

which patterns currently exist

---

# **347\. Relación con D8**

D8 utilizará el grafo para convertir:

candidate causal branches

en:

explicit hypotheses

---

# **348\. Relación con D9**

D9 recorrerá y contrastará esas ramas para encontrar:

root causes  
constraints

---

# **349\. Relación con D12**

D12 aportará:

confounder detection  
false causal interpretations

---

# **350\. Relación con F5**

Más adelante los playbooks podrán enlazarse con:

validated root cause

Nunca directamente con surface metric.

---

# **351\. RAG Structure**

Chunks recomendados:

causal\_graph\_principles

metric\_causal\_graph

acquisition\_causality

creative\_causality

conversion\_causality

product\_causality

offer\_causality

retention\_causality

inventory\_causality

operations\_causality

finance\_causality

data\_measurement\_causality

technology\_causality

team\_causality

strategy\_causality

cross\_capability\_causality

confounders

causal\_evidence

causal\_invariants

Metadata:

phase:  
F3

block:  
D7

domain:  
causal\_reasoning

knowledge\_type:  
causal\_rule

---

# **357\. Example trace**

TARGET:  
CAC \+28%

PATH A:  
CPM ↑ → CPC ↑ → CAC ↑

REJECTED  
CPM stable.

PATH B:  
CVR ↓ → CAC ↑

REJECTED  
CVR stable.

PATH C:  
CTR ↓ → CPC ↑ → CAC ↑

SUPPORTED  
CTR \-21%  
CPC \+24%  
same scope/time.

Next branch:

Creative  
Audience  
Offer  
Frequency

to D8.

---

# **358\. Value for the copilot**

Esto hace que el copiloto pueda decir:

> El aumento de CAC se explica matemáticamente por el incremento del CPC, no por la conversión. El CPC está aumentando principalmente porque el CTR se ha deteriorado mientras el CPM permanece estable. Esto localiza el origen observable del problema antes del clic. Las explicaciones todavía abiertas se concentran ahora en creatividad, audiencia, oferta o exposición.

Eso es muchísimo más preciso que:

> “El CAC ha subido, revisa tus anuncios.”

---

# **360\. Arquitectura acumulada**

Ahora la Fase 3 ya puede hacer:

D1  
¿Puedo creerlo?

D2  
¿Qué significa en contexto?

D3  
¿Qué capacidad debería existir?

D4  
¿Qué está sano o enfermo?

D5  
¿Qué ha cambiado?

D6  
¿Qué patrón forman esos cambios?

D7  
¿Qué relaciones causales podrían explicar ese patrón?

El siguiente paso es:

# **D8 — GENERADOR Y CONTRASTE DE HIPÓTESIS**

Porque D7 puede decir:

CTR deterioration  
puede estar relacionado con:

Creative  
Audience  
Offer  
Frequency  
Placement  
Market

Pero necesitamos convertir esas ramas en hipótesis explícitas:

H1 — Creative fatigue  
H2 — Audience saturation  
H3 — Offer weakening  
H4 — Placement mix deterioration  
H5 — Tracking distortion

y después obligar al sistema a buscar:

evidence for

evidence against

missing evidence

falsification tests

antes de aceptar ninguna.

---

# **361\. Principio final**

D6 sabe:

> qué patrón estamos viendo.

D7 sabe:

> qué mecanismos podrían producirlo.

Eso convierte al copiloto de un simple analista de KPIs en un sistema con un **modelo interno del funcionamiento del ecommerce**.

Pero todavía debe conservar una disciplina:

PLAUSIBLE  
≠  
PROVEN

El grafo no existe para darle más seguridad al modelo.

Existe para limitarlo a **causas que tengan sentido estructural y que puedan ser contrastadas con evidencia**.

