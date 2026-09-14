# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D5 — MOTOR DE SEÑALES Y ANOMALÍAS**

---

# **0\. Propósito de D5**

D1 valida los datos.

D2 los contextualiza.

D3 interpreta qué nivel estructural debería existir.

D4 determina la salud actual de cada capacidad.

D5 responde:

> **¿Qué está cambiando de forma suficientemente relevante como para merecer investigación?**

El objetivo no es detectar cualquier variación.

El objetivo es detectar:

CHANGES THAT MATTER

Una tienda genera miles de cambios cada día.

La mayoría son ruido.

D5 debe separar:

NOISE

de:

SIGNAL

---

# **1\. Principio central**

No todo cambio es una señal.

Y no toda señal es un problema.

Debemos separar:

OBSERVATION  
↓  
VARIATION  
↓  
SIGNAL  
↓  
ANOMALY  
↓  
SYMPTOM

D5 se ocupa principalmente de:

VARIATION  
SIGNAL  
ANOMALY

D6 transformará conjuntos de señales en síntomas empresariales.

---

# **2\. Observation**

Una observación es simplemente un valor medido.

Ejemplo:

CAC:  
€48

No contiene todavía interpretación.

---

# **3\. Variation**

Comparado con baseline:

CAC:  
€42 → €48

Tenemos:

variation:  
\+14.3%

Sigue sin significar necesariamente que exista problema.

---

# **4\. Signal**

La variación se convierte en señal cuando tiene relevancia suficiente.

Ejemplo:

CAC:  
\+14%

duration:  
17 days

context:  
no major scaling

margin:  
unchanged

confidence:  
HIGH

Puede generar:

SIGNAL:  
CAC\_DERIORATION

---

# **5\. Anomaly**

Una anomalía es una observación que se desvía significativamente de lo esperado.

Ejemplo:

Normal payment success:  
96–98%

Current:  
71%

Resultado:

ANOMALY:  
PAYMENT\_SUCCESS\_COLLAPSE

---

# **6\. Signal ≠ anomaly**

Puede existir señal sin anomalía.

Ejemplo:

Creative launch cadence:  
declining gradually for 6 weeks

No hay un punto extremo.

Pero existe:

TREND SIGNAL

También puede existir anomalía sin deterioro.

Ejemplo:

Revenue:  
\+300%

por una colaboración viral.

Es anomalía positiva.

---

# **7\. Tipos principales de señales**

D5 debe soportar como mínimo:

LEVEL\_SIGNAL  
TREND\_SIGNAL  
CHANGE\_SIGNAL  
RATE\_SIGNAL  
VOLATILITY\_SIGNAL  
CONCENTRATION\_SIGNAL  
MIX\_SIGNAL  
RATIO\_SIGNAL  
CAPACITY\_SIGNAL  
DEPENDENCY\_SIGNAL  
REGRESSION\_SIGNAL  
POSITIVE\_SIGNAL  
RISK\_SIGNAL

---

# **8\. Level Signal**

Detecta que una métrica está en un nivel anómalo.

Ejemplo:

Refund rate:  
18%

frente a:

historical normal:  
5–8%

---

# **9\. Trend Signal**

Detecta cambio progresivo.

Ejemplo:

CAC:  
39  
41  
42  
44  
46  
48

No existe un único salto extremo.

Pero sí:

DETERIORATING\_TREND

---

# **10\. Step Change**

Detecta ruptura abrupta.

Ejemplo:

CVR:  
2.9%  
2.8%  
2.9%  
2.8%  
1.7%  
1.6%  
1.7%

Puede existir:

STEP\_CHANGE

---

# **11\. Rate-of-Change Signal**

No solo importa cuánto cambia.

También:

> ¿A qué velocidad?

Ejemplo:

Stock coverage:  
40 → 35 → 30 → 20 → 11 days

La aceleración puede ser más relevante que el nivel.

---

# **12\. Acceleration Signal**

Podemos detectar:

FIRST\_DERIVATIVE

y conceptualmente:

SECOND\_DERIVATIVE

Ejemplo:

CAC deterioration accelerating

---

# **13\. Volatility Signal**

Ejemplo:

Antes:

Daily revenue variance:  
low

Ahora:

Daily revenue swings:  
±45%

Puede existir:

VOLATILITY\_INCREASE

aunque la media permanezca estable.

---

# **14\. Stability Break**

Una capacidad que históricamente era estable puede dejar de serlo.

Ejemplo:

Fulfillment time:  
1.2–1.5 days

ahora:

1.1  
2.8  
1.3  
4.0  
2.2

Señal:

OPERATIONAL\_INSTABILITY

---

# **15\. Concentration Signal**

Detecta dependencia creciente.

Ejemplo:

Top creative spend share:  
28% → 67%

Aunque performance todavía sea buena:

CREATIVE\_CONCENTRATION\_RISK

---

# **16\. Revenue Concentration**

Ejemplo:

Top SKU:  
35% → 62% revenue

Puede generar:

PRODUCT\_CONCENTRATION\_SIGNAL

---

# **17\. Channel Concentration**

Meta:  
45% → 81% new customers

Puede aumentar:

ACQUISITION\_DEPENDENCY\_RISK

---

# **18\. Customer Concentration**

En ciertos modelos:

Top customer segment:  
increasing revenue concentration

también puede representar riesgo.

---

# **19\. Mix Signal**

Detecta cambios de composición.

Ejemplo:

New customer share:  
52% → 71%

o:

Mobile share:  
48% → 68%

El mix puede explicar métricas agregadas.

D2 contextualiza.

D5 detecta el cambio.

---

# **20\. Product Mix Signal**

Premium SKU share:  
60% → 34%

Puede explicar:

AOV ↓  
Margin ↓

---

# **21\. Traffic Mix Signal**

Ejemplo:

Prospecting sessions:  
\+45%

Organic:  
\-20%

Puede alterar:

CVR  
CAC  
AOV

---

# **22\. Ratio Signal**

Algunas relaciones entre métricas son más informativas que los niveles.

Ejemplo:

Spend ↑  
New customers →

Resultado:

ACQUISITION\_EFFICIENCY\_SIGNAL

---

# **23\. Funnel Ratio Signals**

Ejemplos:

PDP → ATC  
ATC → Checkout  
Checkout → Payment  
Payment → Order

Cambios en ratios pueden localizar deterioro.

---

# **24\. Economic Ratio Signals**

Ejemplos:

Contribution / Revenue  
Discount / Revenue  
Ad Spend / Revenue  
Refunds / Revenue  
Inventory / Revenue

---

# **25\. Capacity Signals**

Ejemplo:

Warehouse utilization:  
72% → 94%

Aunque SLA siga estable:

CAPACITY\_PRESSURE

---

# **26\. Inventory Capacity**

stock coverage:  
30 → 12 days

puede generar:

INVENTORY\_CAPACITY\_RISK

---

# **27\. Team Capacity**

Ejemplo:

open tasks \+70%  
delivery capacity unchanged

puede indicar:

TEAM\_CAPACITY\_PRESSURE

---

# **28\. Dependency Signal**

Cuando una capacidad depende crecientemente de una sola fuente.

Ejemplo:

90% revenue generated by one hero SKU

o:

95% acquisition from one platform

---

# **29\. Regression Signal**

Una regresión implica:

previously healthy  
→ event/change  
→ deterioration

Ejemplo:

Checkout completion:  
stable

theme deployment

checkout completion:  
\-22%

Resultado:

REGRESSION\_SIGNAL

---

# **30\. Positive Signals**

D5 no debe detectar únicamente problemas.

Ejemplos:

CAC improving  
CVR increasing  
refunds falling  
repeat rate improving  
stock efficiency improving

Esto permite aprender qué está funcionando.

---

# **31\. Improvement Signal**

IMPROVEMENT\_SIGNAL

debe seguir el mismo rigor que un deterioro.

No afirmar:

creative breakthrough

por un día bueno.

---

# **32\. Risk Signal**

Puede aparecer antes de que haya daño real.

Ejemplo:

Hero SKU coverage:  
16 days

supplier lead time:  
75 days

Señal:

STOCKOUT\_RISK

aunque todavía esté en stock.

---

# **42\. Transient**

Ejemplo:

traffic spike 2 hours

---

# **43\. Emerging**

Ejemplo:

3–5 periods moving consistently

---

# **44\. Persistent**

Ejemplo:

deterioration 3 weeks

---

# **45\. Chronic**

Ejemplo:

poor repeat rate for 9 months

---

# **47\. Fast deterioration**

Ejemplo:

payment success:  
97% → 65%  
within 30 min

---

# **48\. Slow deterioration**

brand search:  
\-2% monthly  
for 8 months

Puede ser menos urgente pero estructuralmente relevante.

---

# **49\. Signal Onset**

D5 debe estimar:

when did the change begin?

Ejemplo:

detected\_onset:  
Sep 3 14:00

---

# **50\. Change Point Detection**

Conceptualmente debemos permitir algoritmos de:

CHANGE\_POINT\_DETECTION

para localizar rupturas de régimen.

---

# **51\. Regime**

Una métrica puede pasar de:

NORMAL\_REGIME

a:

NEW\_REGIME

Ejemplo:

CAC historically €35–€45

y durante 6 semanas:

€55–€65

Eso puede representar nueva realidad.

---

# **52\. Temporary anomaly vs regime shift**

Debemos distinguir:

ANOMALY

de:

REGIME\_SHIFT

---

# **53\. Regime Shift**

Ejemplo:

post-price increase  
AOV stabilizes permanently higher  
CVR stabilizes permanently lower

El baseline deberá eventualmente cambiar.

---

# **54\. Baseline adaptation**

Si nunca actualizamos baseline, el sistema seguirá alertando eternamente sobre un cambio ya normalizado.

---

# **55\. Baseline Freeze after event**

Sin embargo, tampoco debe adaptar baseline demasiado pronto.

Si checkout se rompe durante 2 semanas, no debemos aprender:

broken checkout \= new normal

---

# **58\. Multi-baseline signals**

D5 puede comparar contra varios baselines.

Ejemplo:

CAC:  
\+18% WoW  
\+21% vs 8-week median  
\+3% YoY

Esto aporta contexto.

---

# **59\. Consensus Signal**

Una señal es más fuerte cuando varios baselines coinciden.

---

# **60\. Conflicting Baseline Signal**

Ejemplo:

Revenue:  
\-20% WoW  
\+12% YoY  
\+3% vs forecast

No debe presentarse simplemente como:

REVENUE DETERIORATION

---

# **61\. Expected Range**

Para cada métrica puede existir:

EXPECTED\_LOW  
EXPECTED\_HIGH

Señal si sale del rango.

---

# **62\. Dynamic Expected Range**

Debe variar por:

weekday  
season  
market  
channel  
business stage  
promotion

---

# **63\. Fixed threshold signals**

Algunos eventos sí pueden tener threshold absoluto.

Ejemplo:

payment success \< 80%

podría ser grave casi universalmente.

Pero aun así debe configurarse por sistema.

---

# **64\. Business Guardrail**

Mejor concepto:

BUSINESS\_GUARDRAIL

Ejemplo:

maximum sustainable CAC:  
€55

Si current:

€63

signal:

GUARDRAIL\_BREACH

---

# **66\. Economic breach**

CAC \> max sustainable CAC

---

# **67\. Operational breach**

warehouse capacity \> safe operating limit

---

# **68\. Technical breach**

error rate \> tolerance

---

# **69\. Risk breach**

stock coverage \< supplier lead time buffer

---

# **70\. Threshold Crossing**

D5 debe detectar:

CROSSING\_UP  
CROSSING\_DOWN

No solo estado actual.

---

# **71\. Near-threshold signal**

También:

APPROACHING\_GUARDRAIL

Ejemplo:

CAC:  
€52

limit:  
€55

trajectory:  
fast deterioration

Puede merecer warning.

---

# **73\. Statistical detection**

D5 debe tener soporte conceptual para:

z-score  
robust z-score  
IQR  
moving averages  
EWMA  
change-point methods  
seasonal decomposition

No significa que todo se aplique a todo.

---

# **74\. Robust statistics**

Para ecommerce, medianas y MAD pueden ser más robustas que medias cuando hay picos.

---

# **75\. Small sample protection**

Con poco volumen:

extreme percentage change

puede ser falso positivo.

D1 debe marcar:

LOW\_SAMPLE

y D5 degradar la señal.

---

# **76\. Example**

Orders:  
2 → 1

change:  
\-50%

No significa:

CRITICAL REVENUE ANOMALY

---

# **77\. Volume-adjusted signal**

Signal significance debería considerar:

event count  
revenue exposure  
sample size

---

# **78\. Business significance**

Un cambio estadísticamente significativo puede no importar empresarialmente.

Ejemplo:

Metric improves 0.2%

con enorme muestra.

Pero impacto económico mínimo.

---

# **79\. Statistical significance ≠ business significance**

Regla esencial.

---

# **83\. Signal deduplication**

Un mismo fenómeno puede generar muchas señales correlacionadas.

Ejemplo:

CAC ↑  
ROAS ↓  
MER ↓  
Paid contribution ↓

Podrían provenir del mismo deterioro.

No queremos cuatro alertas independientes al usuario.

---

# **84\. Signal Cluster**

D5 puede crear:

SIGNAL\_CLUSTER

Ejemplo:

Paid Acquisition Efficiency Deterioration

D6 convertirá cluster en síntoma.

---

# **85\. Correlated Signals**

Debe calcularse:

temporal correlation  
scope overlap  
metric dependency

para agrupar.

---

# **86\. Avoid double counting derived metrics**

Ejemplo:

CAC

y:

New Customer Contribution

pueden compartir inputs.

No deben considerarse dos evidencias completamente independientes.

---

# **87\. Derived Metric Dependency**

D1 aporta lineage.

D5 debe usarlo.

---

# **89\. Cross-source reinforcement**

En cambio:

Shopify orders ↓  
Stripe payments ↓  
Warehouse shipments ↓

son evidencias más independientes.

---

# **90\. Signal corroboration**

Podemos elevar confidence si varias fuentes independientes coinciden.

---

# **91\. Signal contradiction**

Ejemplo:

GA4 purchases ↓  
Shopify orders stable

Debe generar:

SIGNAL\_CONFLICT

o posible:

DATA\_SIGNAL

no business signal fuerte.

---

# **103\. Pattern Signal**

Ejemplo:

Support backlog spikes every Monday

puede indicar problema de staffing/cadence.

---

# **104\. Seasonality-aware anomalies**

No alertar sobre cambios esperados.

D2 debe aportar perfiles estacionales.

---

# **105\. Example**

Sunday revenue:  
\-20% vs Saturday

si histórico muestra:

Sunday normally \-18%

No anomaly.

---

# **106\. Context-adjusted anomaly**

Idealmente:

observed  
\-  
expected contextual value  
\=  
residual

Anomalía sobre residual.

---

# **107\. Residual anomaly**

Ejemplo:

expected revenue:  
€100k

actual:  
€72k

Residual:

\-28%

Eso es más útil que simple WoW.

---

# **108\. Trend residual**

Puede existir deterioro incluso si actual sigue dentro de rango.

Ejemplo:

residual:  
\-2%  
\-5%  
\-8%  
\-11%

Signal:

EMERGING\_DOWNTREND

---

# **109\. Multi-dimensional anomaly**

Una señal puede aparecer únicamente en combinación.

Ejemplo:

CTR stable  
CVR stable  
CAC ↑

si CPM ↑.

No hay anomalía individual en CTR/CVR.

Pero sí:

ACQUISITION\_COST\_INFLATION

---

# **110\. Interaction Signal**

D5 puede detectar relaciones como:

A ↑  
B →  
C ↓

Aunque D6 interpretará patrón.

---

# **111\. Relationship Break**

Ejemplo:

Históricamente:

Spend ↑  
Customers ↑

Ahora:

Spend ↑  
Customers →

Se rompe relación histórica.

Esto puede ser:

RESPONSE\_CURVE\_BREAK

---

# **112\. Elasticity signal**

Conceptualmente:

ΔOutput / ΔInput

Ejemplo:

new customers gained per €1k incremental spend

puede deteriorarse.

---

# **113\. Marginal Signals**

Extremadamente importantes en scaling.

No solo:

average CAC

también:

marginal CAC

---

# **114\. Example**

Spend:

€100k → €150k

Customers:

2,500 → 3,000

Incremental:

€50k / 500  
\=  
€100 marginal CAC

aunque blended CAC sea menor.

---

# **115\. Scaling Saturation Signal**

Si marginal CAC se deteriora mucho:

SCALING\_SATURATION\_SIGNAL

---

# **116\. Creative Signals**

D5 debería soportar como mínimo:

CTR deterioration  
hook deterioration  
thumbstop deterioration  
creative age increase  
spend concentration  
winner concentration  
creative velocity decline  
concept diversity decline  
winner rate decline

---

# **117\. Acquisition Signals**

CAC deterioration  
CPM inflation  
CPC inflation  
CTR decline  
new customer volume decline  
marginal CAC deterioration  
channel concentration  
audience saturation

---

# **118\. Conversion Signals**

PDP engagement decline  
ATC decline  
checkout decline  
payment failure  
device regression  
browser regression  
site latency

---

# **119\. Offer Signals**

full-price conversion decline  
promotion dependency increase  
discount depth increase  
bundle response deterioration  
price sensitivity increase

---

# **120\. Product Signals**

hero SKU decline  
review deterioration  
refund increase  
product concentration  
sell-through deterioration

---

# **121\. Retention Signals**

repeat rate decline  
cohort decay  
churn increase  
LTV deterioration  
email engagement decline  
flow revenue decline

---

# **122\. Inventory Signals**

stock coverage decline  
stockout increase  
overstock increase  
dead stock growth  
forecast bias  
supplier delay

---

# **123\. Operations Signals**

fulfillment delay  
support backlog  
return processing delay  
error rate  
capacity pressure

---

# **124\. Finance Signals**

cash burn increase  
gross margin decline  
contribution decline  
working capital pressure  
inventory cash absorption  
receivable delay

---

# **125\. Data Signals**

source conflict  
tracking loss  
event duplication  
staleness  
coverage loss  
schema drift

---

# **126\. Technology Signals**

error rate spike  
latency deterioration  
uptime issue  
deployment regression  
integration failure

---

# **127\. Team Signals**

task backlog  
execution delay  
ownership gap  
key-person dependency  
capacity overload

---

# **128\. Strategy Signals**

Más cualitativas:

goal-resource mismatch  
contradictory incentives  
channel-resource misallocation  
strategy drift

---

# **151\. Signal Topology**

Las señales se conectan por relaciones conocidas.

Ejemplo:

CPM  
CTR  
CPC  
CVR  
CAC

---

# **152\. Metric Graph**

D5 debería conocer dependencias matemáticas.

Ejemplo simplificado:

CPC ≈ CPM / CTR  
CAC ≈ CPC / CVR

No necesariamente con fórmula exacta para todos los casos, pero sí relaciones.

---

# **153\. Mathematical decomposition**

Si:

CAC ↑

D5 puede revisar:

CPM  
CTR  
CVR

para localizar drivers.

Eso prepara D6.

---

# **154\. Revenue decomposition**

Revenue  
≈  
Traffic × CVR × AOV

Si revenue cae:

signal decomposition

puede detectar qué componentes explican la variación.

---

# **155\. Contribution decomposition**

Revenue  
\- COGS  
\- discounts  
\- shipping subsidy  
\- payment fees  
\- media spend  
\- refunds

D5 puede detectar cuál componente cambió.

---

# **156\. Decomposition signal**

Ejemplo:

Contribution \-20%

Revenue \+5%  
COGS stable  
Discounts \+45%

Señal:

DISCOUNT\_MARGIN\_PRESSURE

---

# **157\. Signal attribution**

No causal attribution todavía.

Pero sí:

change contribution

matemática.

---

# **158\. Contribution Analysis**

Ejemplo:

Revenue delta:

\-€100k

Estimación:

Traffic effect:  
\-€10k

CVR effect:  
\-€80k

AOV effect:  
\-€10k

Puede orientar investigación.

---

# **159\. Interaction caveat**

Las descomposiciones pueden tener interacción.

No presentarlas como causalidad perfecta.

---

# **160\. Segment anomaly detection**

D5 debe analizar no solo global.

Dimensiones:

market  
device  
browser  
channel  
campaign  
creative  
product  
SKU  
customer type  
cohort  
landing page  
payment method

---

# **161\. Segment search**

Pero no puede analizar millones de segmentos indiscriminadamente.

---

# **162\. Segment eligibility**

Un segmento debería tener:

minimum sample  
minimum business exposure

para producir señal.

---

# **163\. High-severity exception**

Segmento pequeño puede importar si:

critical customer group  
high-value segment

---

# **164\. Segment anomaly score**

Puede considerar:

magnitude  
sample  
exposure  
persistence

---

# **165\. Segment localization**

Ejemplo:

Global CVR:  
\-6%

pero:

Mobile Safari:  
\-38%

D5 debe localizar:

LOCALIZED\_ANOMALY

---

# **166\. Hierarchical detection**

Podemos investigar:

Business  
→ Capability  
→ Channel  
→ Market  
→ Device  
→ Metric

---

# **167\. Drill-down only when needed**

Para ahorrar computación:

global anomaly  
→ candidate dimensions  
→ targeted drilldown

---

# **168\. Top-down detection**

Empieza global.

---

# **169\. Bottom-up detection**

También podemos detectar subsegmento grave aunque global esté estable.

Ejemplo:

Safari checkout:  
\-70%

pero solo 8% tráfico.

---

# **170\. Hybrid approach**

Necesitamos ambos:

TOP\_DOWN  
BOTTOM\_UP

---

# **171\. Cross-capability signals**

Ejemplo:

support complaints ↑  
refunds ↑  
repeat ↓

Puede cruzar:

Product  
Operations  
Retention

D6 lo convertirá en síntoma.

---

# **172\. Multi-modal signals**

No todo es métrica numérica.

También:

support tickets  
reviews  
user reports  
deployment logs  
supplier messages

---

# **173\. Qualitative Signal**

Ejemplo:

complaints mentioning "late delivery"  
\+220%

Señal:

DELIVERY\_COMPLAINT\_SPIKE

---

# **174\. Text classification**

Puede clasificarse automáticamente:

payment  
shipping  
quality  
sizing  
support  
refund

---

# **175\. Qualitative signal confidence**

Debe depender de:

volume  
classification confidence  
representativeness

---

# **176\. Event signals**

D2 registra cambios.

D5 puede detectar:

IMPORTANT\_BUSINESS\_EVENT

Ejemplo:

price \+25%

No es anomalía, pero sí señal contextual importante.

---

# **177\. Event-response pairing**

Después de un evento:

price change

D5 puede vigilar:

CVR  
AOV  
margin

---

# **178\. Post-event monitoring window**

Cada tipo de evento puede tener:

expected\_effect\_window

---

# **179\. Event-linked signal**

EVENT\_LINKED\_SIGNAL

Ejemplo:

payment decline begins 30 min after deployment

---

# **180\. Pre/post signal**

Comparar:

PRE\_EVENT\_BASELINE  
POST\_EVENT

---

# **181\. Leading signal library**

Muy importante para copiloto 24/7.

Ejemplos:

creative velocity ↓  
stock coverage ↓  
support backlog ↑  
forecast error ↑  
branded demand ↓  
capacity utilization ↑

pueden anticipar problemas mayores.

---

# **182\. Leading Signal**

Debe marcar:

leading\_indicator:  
true

---

# **183\. Lag expectation**

Ejemplo:

creative velocity decline  
expected lag:  
1–4 weeks before CAC deterioration

---

# **184\. Early warning confidence**

Una señal adelantada normalmente tendrá menor confianza causal que un fallo ya materializado.

---

# **185\. Composite Signals**

Podemos crear señales derivadas de varias métricas.

Ejemplo:

CREATIVE\_FATIGUE\_PRESSURE\_INDEX

basado en:

creative age  
frequency  
CTR trend  
spend concentration

---

# **186\. Composite signal caution**

Los índices deben ser explicables.

No crear scores opacos.

---

# **187\. Composite Signal Explanation**

Siempre poder responder:

which inputs contributed?

---

# **195\. Anomaly families**

D5 debe reconocer:

POINT\_ANOMALY  
CONTEXTUAL\_ANOMALY  
COLLECTIVE\_ANOMALY

---

# **196\. Point anomaly**

Un valor extremo individual.

---

# **197\. Contextual anomaly**

Valor normal en general, anormal bajo contexto.

Ejemplo:

CVR 2%

puede ser normal en prospecting.

Pero raro para branded traffic.

---

# **198\. Collective anomaly**

Conjunto de valores que forma patrón.

Ejemplo:

small daily deterioration for 20 days

---

# **199\. Sequence anomalies**

También:

normal values in abnormal order/pattern

Ejemplo:

repeated payment error spikes every 15 min

---

# **200\. Periodic anomalies**

Patrón recurrente.

---

# **201\. Signal normalization**

Para comparar señales entre métricas diferentes, puede existir:

normalized\_signal\_score

pero solo interno.

---

# **202\. No universal score alone**

No reducir todo a:

Anomaly Score 92

sin explicación.

---

# **203\. Signal Card**

Ejemplo:

SIGNAL

Creative Velocity Decline

Capability:  
Creative

State:  
CONFIRMED

Magnitude:  
\-41%

Duration:  
4 weeks

Trajectory:  
DETERIORATING

Business relevance:  
HIGH

Data confidence:  
HIGH

Context confidence:  
HIGH

Signal confidence:  
HIGH

---

# **204\. Another**

SIGNAL

Payment Success Collapse

Capability:  
Conversion

Magnitude:  
\-31 pp

Duration:  
2 hours

Velocity:  
EXTREME

Business relevance:  
CRITICAL

Confidence:  
HIGH

---

# **205\. Signal Correlation Window**

Para relacionar señales temporalmente necesitamos ventanas.

Ejemplo:

±24h  
±7d  
±30d

dependiendo del dominio.

---

# **206\. Domain lags**

Payment:

minutes/hours

Retention:

weeks/months

No usar misma ventana.

---

# **210\. Unexpectedness**

Anomaly strength debe incluir:

how unexpected is this?

---

# **211\. Example**

Revenue \+200%

Black Friday:

EXPECTED

Un martes cualquiera:

UNEXPECTED

---

# **212\. Signal novelty**

También puede medirse:

first-ever  
rare  
common  
recurring

---

# **213\. Rare signal**

Una anomalía nunca vista puede merecer investigación incluso con impacto todavía pequeño.

---

# **214\. Known pattern**

Si ocurre cada semana y ya está explicado:

SUPPRESS / LOW ATTENTION

---

# **215\. Historical Pattern Matching**

D5 puede comparar con casos anteriores.

Ejemplo:

same pattern occurred before stockout

Esto será más potente en F9.

---

# **216\. Tenant-specific pattern library**

Cada tienda puede desarrollar:

known\_signal\_patterns

---

# **217\. Global patterns**

El RAG puede contener:

common ecommerce signal patterns

pero no convertirlos automáticamente en diagnosis.

---

# **218\. Expert knowledge role**

Los marcos de especialistas pueden ayudar a definir:

which indicators matter  
which combinations deserve attention  
which leading signals precede scaling problems

Pero el signal engine debe depender de datos y reglas explícitas.

---

# **219\. No guru thresholds**

No debemos guardar:

A metric must always be X

si no existe validez contextual.

Mejor:

PRINCIPLE:  
A rising acquisition cost becomes materially dangerous when it exceeds the economic tolerance of acquired customers or deteriorates persistently relative to its baseline.

---

# **220\. Signal to Symptom boundary**

D5 puede decir:

CTR decline  
CPC increase  
creative concentration increase

D6 será quien diga:

possible creative deterioration

Esta frontera debe respetarse.

---

# **221\. No premature causality**

D5 nunca:

CTR ↓  
→ Creative fatigue

Debe limitarse a:

CTR deterioration signal

---

# **222\. No premature recommendation**

Tampoco:

CTR ↓  
→ create new ads

---

# **233\. Health-triggered signal**

D4 state change puede generar señal.

Ejemplo:

Inventory:  
HEALTHY → FRAGILE

Signal:

CAPABILITY\_HEALTH\_DEGRADATION

---

# **234\. Signal-triggered health**

También al revés:

varias señales D5 pueden provocar actualización D4.

Por tanto D4 y D5 forman un loop operativo.

---

# **235\. Conceptual loop**

METRICS  
↓  
SIGNALS  
↓  
HEALTH  
↓  
HEALTH CHANGE  
↓  
NEW INVESTIGATION

---

# **236\. Frequency**

No todas las métricas se evalúan con misma frecuencia.

Ejemplos:

payments:  
minutes

ads:  
hourly/daily

retention:  
weekly

finance:  
daily/weekly/monthly

---

# **239\. Instant signals**

Algunos eventos sí admiten detección inmediata:

checkout outage  
payment failure  
integration disconnect

---

# **240\. Batch signals**

Otros requieren:

daily  
weekly

---

# **241\. Slow signals**

Ejemplo:

brand demand erosion

puede evaluarse mensualmente.

---

# **243\. Real-time**

payments  
site uptime

---

# **244\. Short-term**

CAC  
CVR  
creative

---

# **245\. Medium-term**

inventory  
retention cohorts  
margin

---

# **246\. Long-term**

brand demand  
market position  
organizational maturity

---

# **247\. Multi-horizon detection**

Una capacidad puede tener señales diferentes por horizonte.

---

# **248\. Example**

Acquisition:

1D:  
healthy

14D:  
deteriorating

90D:  
structurally stable

---

# **256\. Example output**

SIGNALS

S1  
CAC deterioration  
STRONG  
CONFIDENCE HIGH

S2  
Creative concentration increase  
MODERATE  
CONFIDENCE HIGH

S3  
Creative launch velocity decline  
STRONG  
CONFIDENCE MEDIUM

S4  
CVR stable  
POSITIVE/STABILITY

S5  
CPM stable  
NEUTRAL

D6 podrá combinar:

S1 \+ S2 \+ S3 \+ S4 \+ S5

en un síntoma.

---

# **257\. Example — Creative pattern**

Input:

CTR:  
\-21%

CPM:  
stable

Frequency:  
\+35%

Creative age:  
\+42%

New creative launches:  
\-50%

CVR:  
stable

D5 outputs:

CTR deterioration  
frequency increase  
creative aging  
creative velocity decline  
post-click stability

No:

Creative fatigue confirmed

todavía.

---

# **258\. Example — Payment issue**

Traffic:  
stable

ATC:  
stable

Checkout:  
stable

Payment success:  
\-25%

Payment error:  
\+190%

D5:

PAYMENT\_SUCCESS\_COLLAPSE  
PAYMENT\_ERROR\_SPIKE  
UPSTREAM\_FUNNEL\_STABILITY

D6 construirá síntoma.

---

# **259\. Example — Stock risk**

Hero SKU stock:  
18 days

Lead time:  
75 days

Sales velocity:  
\+25%

D5:

STOCK\_COVERAGE\_DECLINE  
SUPPLY\_LEAD\_TIME\_MISMATCH  
STOCKOUT\_RISK

---

# **260\. Example — Margin compression**

Revenue:  
\+12%

Discount:  
\+40%

Shipping subsidy:  
\+35%

Contribution:  
\-18%

D5:

DISCOUNT\_PRESSURE  
SHIPPING\_COST\_PRESSURE  
CONTRIBUTION\_DECLINE

---

# **261\. Example — Traffic mix distortion**

Global CVR:  
\-16%

Segment CVRs:  
stable

Mobile mix:  
\+28%

D5:

DEVICE\_MIX\_SHIFT  
GLOBAL\_CVR\_DECLINE  
WITHIN\_SEGMENT\_STABILITY

D6 puede clasificarlo como mix-driven symptom.

---

# **262\. Example — Data anomaly**

GA purchase:  
\-60%

Shopify orders:  
stable

D5:

SOURCE\_DIVERGENCE

No:

conversion collapse

---

# **263\. Positive Pattern**

CAC:  
\-15%

CVR:  
\+10%

AOV:  
\+5%

Contribution:  
\+22%

D5:

ACQUISITION\_EFFICIENCY\_IMPROVEMENT  
CONVERSION\_IMPROVEMENT  
AOV\_IMPROVEMENT  
ECONOMIC\_IMPROVEMENT

F9 podrá aprender qué cambió antes.

---

# **264\. Signal competition**

Pueden coexistir señales opuestas.

Ejemplo:

Revenue:  
\+20%

Contribution:  
\-10%

No cancelar una con otra.

---

# **265\. Different dimensions**

Cada señal afecta distinta capa.

---

# **266\. Anomaly severity vs business output**

No asumir que gran porcentaje \= gran impacto.

Ejemplo:

Tiny campaign CAC \+200%

con 0.5% spend.

Baja relevancia.

---

# **267\. Weighted exposure**

Signal object debería guardar:

business\_share\_affected

---

# **268\. Revenue-weighted exposure**

Ejemplo:

Hero SKU:  
65% revenue

le da peso alto a señal de stock.

---

# **269\. Margin-weighted exposure**

Algunos productos aportan poco revenue pero mucho margin.

Debe poder usarse:

profit\_exposure

---

# **270\. Customer exposure**

Payment bug afecta:

35% checkout users

---

# **271\. Operational exposure**

Warehouse issue:

80% orders

---

# **272\. Signal Impact Estimate**

D5 puede estimar preliminarmente:

LOW  
MEDIUM  
HIGH  
CRITICAL

No reemplaza D10.

---

# **273\. Signal combinations library**

RAG puede contener patrones como:

CTR ↓ \+ CPM stable \+ CVR stable

compatible con:

pre-click deterioration

Pero D5 no genera causa final.

---

# **274\. Pattern templates**

Ejemplo:

TEMPLATE:  
Paid acquisition pre-click deterioration

required signals:  
CTR decline

supporting:  
CPC increase  
CPM stable

contradicting:  
CVR decline

D6 utilizará estas plantillas.

---

# **299\. RAG Structure**

Chunks recomendados:

signal\_definition  
anomaly\_types  
trend\_detection  
change\_point  
volatility  
concentration  
mix\_signals  
capacity\_signals  
regression\_signals  
leading\_indicators  
signal\_confidence  
signal\_suppression  
alert\_logic  
signal\_invariants

Metadata:

phase:  
F3

block:  
D5

domain:  
signals\_anomalies

knowledge\_type:  
detection\_rule

---

# **308\. Copilot behavior**

Ejemplo de salida natural:

> He detectado un deterioro sostenido en adquisición durante los últimos 12 días. El CAC ha aumentado un 19 % frente al baseline contextual, mientras el CPM permanece estable y el CTR se ha reducido un 17 %. La conversión post-click continúa estable. Hay suficiente evidencia para investigar un deterioro pre-click, aunque todavía no para atribuirlo a una causa concreta.

Eso es D5 funcionando correctamente.

---

# **309\. Another behavior**

> No considero significativa la caída de revenue de hoy. El periodo todavía está abierto y, ajustando por hora del día y comportamiento histórico de los jueves, el rendimiento está dentro del rango esperado.

También es D5.

---

# **310\. Another**

> Aunque Inventory continúa en estado Healthy, la cobertura del principal SKU ha caído de 41 a 18 días mientras el lead time actual es de 62 días. Lo clasifico como una señal adelantada de riesgo, no como un stockout actual.

Eso es especialmente valioso.

---

---

# **312\. Resultado acumulado hasta D5**

Ahora ya tenemos:

D1  
¿Puedo creer los datos?

D2  
¿Los estoy interpretando bien?

D3  
¿Qué nivel estructural tiene este negocio?

D4  
¿Cómo está funcionando cada capacidad?

D5  
¿Qué está cambiando ahora mismo?

Todavía falta una pieza esencial:

¿QUÉ SIGNIFICAN JUNTAS ESAS SEÑALES?

Ese es el trabajo del siguiente bloque:

# **D6 — MOTOR DE SÍNTOMAS**

D5 puede detectar:

CTR ↓  
CPC ↑  
CPM →  
CVR →  
Creative concentration ↑

Pero D6 debe ser capaz de decir:

SYMPTOM:  
Deterioro de eficiencia pre-click compatible con debilidad creativa.

Sin afirmar todavía que la causa sea definitivamente fatiga creativa.

---

# **313\. Principio final**

Un dashboard detecta:

números diferentes

Un motor de señales detecta:

cambios relevantes

Un buen sistema diagnóstico además sabe distinguir:

ruido  
variación normal  
cambio esperado  
riesgo emergente  
anomalía real  
regresión  
mejora

D5 es el sistema sensorial del copiloto.

Es la capa que hace que el ecommerce deje de ser una colección de dashboards y pase a convertirse en un organismo que puede ser monitorizado continuamente.

