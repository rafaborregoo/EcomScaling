# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D10 — SEVERIDAD E IMPACTO**

---

# **0\. Propósito de D10**

Hasta D9 el sistema puede determinar:

WHAT HAPPENED

WHERE

WHY

ROOT CAUSE

CURRENT CONSTRAINT

D10 responde:

> **¿Cuánto importa realmente este problema para el negocio?**

Porque dos problemas con el mismo porcentaje de deterioro pueden tener impactos completamente diferentes.

---

# **1\. Distinción fundamental**

Debemos mantener separados:

HEALTH  
≠  
SEVERITY  
≠  
IMPACT  
≠  
PRIORITY

`HEALTH`

Describe el estado de una capacidad.

`SEVERITY`

Describe la gravedad del diagnóstico actual.

`IMPACT`

Describe qué daño empresarial está produciendo o puede producir.

`PRIORITY`

Decide qué abordar primero.

La prioridad pertenece a Fase 4\.

---

# **2\. Ejemplo**

Problema A:

Instagram Organic Reach:  
\-60%

Revenue exposure:  
1%

Problema B:

Payment completion:  
\-8%

Revenue exposure:  
90%

Aunque:

\-60% \> \-8%

B puede ser muchísimo más grave.

---

# **3\. Porcentaje de cambio ≠ severidad**

Regla:

MAGNITUDE OF METRIC CHANGE  
≠  
BUSINESS SEVERITY

La severidad debe entender:

what changed  
where  
for how long  
how much business depends on it  
what economic damage it creates  
how fast it spreads  
whether it threatens continuity

---

# **5\. INFO**

Existe una condición relevante pero sin daño material actual.

Ejemplo:

Minor concentration increase  
without performance deterioration

---

# **6\. LOW**

Impacto limitado y localizado.

Ejemplo:

Small campaign deterioration

1% of total spend

---

# **7\. MODERATE**

Existe daño empresarial real pero contenido.

Ejemplo:

AOV deterioration  
affecting 12% of revenue

---

# **8\. HIGH**

Existe impacto material sobre una parte significativa del negocio.

Ejemplo:

CAC materially above sustainable level  
on 45% of new customer acquisition

---

# **9\. CRITICAL**

Existe deterioro severo sobre una función importante.

Ejemplo:

Hero SKU stockout  
representing 55% of revenue

---

# **10\. BUSINESS\_THREAT**

Reservado para situaciones capaces de comprometer:

business continuity

liquidity

ability to transact

major customer trust

legal/operational continuity

Ejemplos:

checkout unavailable

insufficient cash for critical obligations

primary fulfillment operation stopped

---

# **11\. BUSINESS\_THREAT debe ser excepcional**

No utilizar lenguaje extremo por:

ROAS below target for three days

---

# **13\. Revenue Impact**

Pregunta:

> ¿Qué revenue está perdiéndose, degradándose o quedando expuesto?

---

# **14\. Direct Revenue Impact**

Ejemplo:

Payment failure  
→ failed transactions  
→ lost revenue

---

# **15\. Indirect Revenue Impact**

Ejemplo:

Shipping deterioration  
→ customer dissatisfaction  
→ future repeat decline

---

# **16\. Revenue-at-risk**

Además del daño realizado:

REALIZED\_LOSS

debemos poder distinguir:

REVENUE\_AT\_RISK

---

# **17\. Example**

Hero SKU todavía tiene:

5 days inventory

No existe revenue perdido aún.

Pero:

Revenue at risk:  
high

---

# **19\. Realized**

Ya ocurrió.

---

# **20\. Ongoing**

Está ocurriendo ahora.

---

# **21\. Potential**

Puede ocurrir si condición continúa.

---

# **22\. Projected**

Existe estimación razonable de futuro impacto.

---

# **23\. Contribution Impact**

Revenue no es suficiente.

Ejemplo:

Revenue:  
stable

Discount:  
↑

CAC:  
↑

Contribution:  
↓

El impacto económico real puede ser considerable aunque ventas no cambien.

---

# **24\. Contribution-at-risk**

Podemos estimar:

lost contribution

contribution compression

future contribution exposure

---

# **25\. Example**

€100k revenue lost

no equivale necesariamente a:

€100k economic loss

Debemos considerar contribution.

---

# **26\. Gross vs Net Impact**

Distinguir:

GROSS\_REVENUE\_IMPACT

NET\_REVENUE\_IMPACT

CONTRIBUTION\_IMPACT

---

# **27\. Refund Example**

€50k de ventas afectadas por refunds no equivale a €50k de pérdida económica directa sin conocer:

COGS recovery

inventory recovery

payment fees

shipping

return cost

---

# **28\. Cash Impact**

Pregunta:

> ¿Está reduciendo liquidez o aumentando consumo de caja?

---

# **29\. Cash impact can differ from profit impact**

Ejemplo:

Profitable growth

puede provocar:

Cash pressure

por inventario.

---

# **30\. Cash Impact Types**

CASH\_BURN

WORKING\_CAPITAL\_PRESSURE

CASH\_LOCKUP

PAYMENT\_DELAY

LIQUIDITY\_RISK

---

# **31\. Liquidity Exposure**

D10 debe prestar especial atención a problemas que pueden impedir:

supplier payments

payroll

tax payments

media spend

inventory replenishment

---

# **32\. Customer Impact**

Pregunta:

> ¿Cuántos clientes están afectados y con qué intensidad?

---

# **33\. Customer Exposure**

Puede expresarse como:

users affected

orders affected

customers affected

% checkout users affected

% active customers affected

---

# **34\. Customer Impact Types**

FRICTION

FAILED\_PURCHASE

DELAY

POOR\_EXPERIENCE

REFUND

CHURN\_RISK

TRUST\_DAMAGE

---

# **35\. Example**

Payment issue:

14% payment attempts fail

Eso puede tener:

Customer Impact:  
HIGH

aunque revenue impact todavía sea moderado.

---

# **36\. Operational Impact**

Pregunta:

> ¿Cuánto afecta a capacidad de ejecutar pedidos, soporte, devoluciones u otras operaciones?

---

# **37\. Operational Impact**

Ejemplos:

backlog

SLA breach

capacity loss

manual workload

error propagation

service interruption

---

# **38\. Operational Cascade**

Ejemplo:

Warehouse backlog  
→ dispatch delay  
→ tickets  
→ refunds  
→ retention

D10 debe considerar no solo el primer efecto.

---

# **39\. Brand Impact**

Algunos problemas pueden afectar:

reviews

word of mouth

trust

brand demand

future conversion

---

# **40\. Brand impact usually has longer lag**

Por tanto puede tener:

low immediate impact  
high long-term impact

---

# **41\. Strategic Impact**

Pregunta:

> ¿El problema bloquea una iniciativa estratégica importante?

Ejemplo:

US expansion

bloqueada por:

fulfillment incompatibility

---

# **42\. Strategic Impact ≠ Revenue Impact**

Una iniciativa nueva puede representar poco revenue actual pero gran relevancia futura.

---

# **43\. Continuity Impact**

Dimensión crítica.

Pregunta:

> ¿Puede esta condición impedir que el negocio continúe operando?

---

# **44\. Continuity examples**

checkout outage

cash insolvency risk

warehouse shutdown

critical database failure

complete inventory depletion

---

# **47\. Example**

Safari checkout failure

Impact scope:

12% of sessions

No global.

---

# **48\. Business Exposure**

Una métrica central:

BUSINESS\_EXPOSURE

Representa qué proporción relevante del negocio está conectada al problema.

---

# **49\. Exposure can use different denominators**

Según caso:

revenue share

gross profit share

contribution share

spend share

order share

customer share

traffic share

inventory value share

---

# **50\. Correct denominator matters**

Ejemplo:

Una campaña representa:

4% spend

pero:

25% new customers

Dependiendo del diagnóstico, customer exposure puede ser más informativo.

---

# **52\. Blast Radius**

D7 introdujo:

BLAST\_RADIUS

D10 lo convierte en dimensión de impacto.

---

# **53\. Blast Radius Definition**

> ¿Cuántas capacidades downstream puede afectar el problema?

---

# **54\. Low Blast Radius**

Ejemplo:

Minor email subject-line issue

---

# **55\. High Blast Radius**

Ejemplo:

Inventory shortage

puede afectar:

Conversion  
Acquisition  
Revenue  
Cash  
Customer Experience

---

# **57\. Direct Impact**

Payment failure  
→ lost orders

---

# **58\. Second-order**

Failed payment  
→ customer frustration

---

# **59\. Cascade**

Stockout  
→ revenue ↓  
→ cash ↓  
→ future purchasing ↓  
→ more stockouts

---

# **61\. Systemic impact**

Una incidencia puede empezar localizada y propagarse por todo el organismo.

---

# **62\. Example**

Poor forecasting  
→ stockout  
→ revenue decline  
→ cash pressure  
→ underbuy  
→ further stockouts

Esto puede producir:

SYSTEMIC PROPAGATION RISK

---

# **63\. Duration**

D10 debe considerar cuánto tiempo lleva activo el problema.

---

# **65\. Duration changes severity**

Ejemplo:

CVR \-15%  
for 1 hour

no equivale a:

CVR \-15%  
for 3 months

---

# **66\. But critical-path failures can be severe immediately**

Ejemplo:

Payment completion \= 0%

durante:

10 minutes

ya puede ser CRITICAL.

---

# **68\. Velocity**

Pregunta:

> ¿Qué tan rápido está empeorando?

---

# **69\. Severity escalation**

Problema:

MODERATE

pero:

rapidly deteriorating

puede requerir classification:

HIGH

según exposición.

---

# **71\. Severity \+ Trajectory**

Ejemplo:

Current severity:  
HIGH

Trajectory:  
RECOVERING

muy distinto a:

HIGH  
RAPIDLY\_DETERIORATING

---

# **72\. Reversibility**

D9 introduce:

reversibility

D10 debe incorporarla.

---

# **74\. Example**

Tracking regression:

high apparent impact  
easy reversible

---

# **75\. Product reputation damage**

Puede ser:

slowly reversible

---

# **76\. Permanent loss**

Algunas ventas perdidas por outage no pueden recuperarse.

Aunque el sistema se arregle.

---

# **78\. Example**

Payment bug:

Root cause:  
easy to reverse

Pero:

lost orders:  
not fully recoverable

---

# **80\. Time-to-Damage**

Muy importante para alerting.

Pregunta:

> ¿Cuánto tiempo puede permanecer activo antes de generar daño material?

---

# **82\. Example**

Checkout failure:

IMMEDIATE

---

# **83\. Creative pipeline decline:**

WEEKS

antes de que probablemente dañe CAC.

---

# **84\. Inventory risk:**

Puede depender de:

days of cover

---

# **86\. Example**

Hero SKU:

9 days cover  
lead time 60 days

Si no hay inbound stock:

time to stockout ≈ 9 days

---

# **87\. Actual Damage vs Risk**

No mezclar:

CURRENT\_IMPACT

con:

FUTURE\_RISK

---

# **88\. Example**

Inventory health:  
FRAGILE

Current lost revenue:  
€0

Revenue at risk:  
HIGH

---

# **89\. Severity can reflect prospective threat**

Pero debe etiquetarse claramente.

Ejemplo:

Current severity:  
MODERATE

Forward risk:  
CRITICAL

---

# **91\. Severity is target-dependent**

Un problema puede tener:

Revenue Impact:  
LOW

Cash Impact:  
CRITICAL

Ejemplo:

inventory overbuy

---

# **92\. Multi-dimensional severity**

No reducir todo inmediatamente a un único score.

---

# **93\. Severity Vector**

Ejemplo:

Revenue:  
MODERATE

Contribution:  
HIGH

Cash:  
CRITICAL

Customer:  
LOW

Operations:  
MODERATE

Continuity:  
HIGH

---

# **95\. Critical Dimension Dominance**

Algunas dimensiones pueden dominar.

Ejemplo:

Revenue LOW  
Cash BUSINESS\_THREAT

Overall:

BUSINESS\_THREAT

puede ser correcto.

---

# **96\. Critical Path Dominance**

Si:

ability to transact

está afectada severamente:

overall severity puede ser alta aunque otras dimensiones estén sanas.

---

# **100\. Impact Quantification**

Siempre que sea posible debemos cuantificar.

---

# **102\. Exact**

Ejemplo:

€23,410 refunded

---

# **103\. Estimated**

Ejemplo:

Estimated lost revenue:  
€18k/day

---

# **104\. Range**

Mejor:

€15k–€22k/day

si existe incertidumbre.

---

# **105\. Directional**

Material negative contribution impact

si cuantificación fiable no es posible.

---

# **106\. Unknown**

No inventar.

---

# **108\. Counterfactual Impact**

Muchas pérdidas se estiman comparando:

expected outcome  
vs  
observed outcome

---

# **109\. Example**

Expected orders:

1,200

Observed:

900

Estimated lost orders:

300

solo si baseline/counterfactual es suficientemente fiable.

---

# **112\. Example**

metric:  
net\_revenue

estimated\_value:  
\-€21,000/day

range:  
\-€17,000 to \-€25,000

method:  
context-adjusted expected revenue

confidence:  
MEDIUM\_HIGH

---

# **113\. Avoid false financial certainty**

No:

This bug costs exactly €21,378.42/day

si estamos usando modelo.

---

# **114\. Revenue Loss Rate**

Puede calcularse:

LOSS\_PER\_HOUR

LOSS\_PER\_DAY

LOSS\_PER\_WEEK

cuando problema está activo.

---

# **115\. Loss velocity**

Muy útil para outages.

---

# **116\. Example**

Payment issue:

estimated revenue loss:  
€1,900/hour

---

# **117\. Accumulated Loss**

estimated cumulative loss since onset

---

# **118\. But settlement lag matters**

No cuantificar periodos abiertos incorrectamente.

D1/D2 siguen aplicando.

---

# **119\. Contribution Loss Rate**

Para economics:

€ contribution lost/day

puede ser más útil que revenue.

---

# **120\. Cash Burn Rate**

Para finance:

incremental cash burn/week

---

# **121\. Customer Damage Rate**

Ejemplo:

failed checkouts/hour

late orders/day

complaints/week

---

# **122\. Operations Damage Rate**

backlog growth/day

---

# **123\. Impact Acceleration**

No solo cuánto se pierde.

También:

is loss rate increasing?

---

# **124\. Example**

Monday:  
€5k/day loss

Tuesday:  
€10k/day

Wednesday:  
€18k/day

Severity higher due acceleration.

---

# **125\. Impact Concentration**

Puede estar:

concentrated

en:

hero product  
VIP customers  
key geography  
high-margin channel

---

# **126\. Critical Segment**

No asumir que 5% exposure es bajo impacto.

Ejemplo:

5% customers  
\=  
40% contribution

---

# **127\. Customer Value Weighting**

Cuando sea relevante:

affected LTV

puede ser más importante que customer count.

---

# **128\. Margin Weighting**

Producto de poco revenue pero gran contribution puede tener gran impacto económico.

---

# **129\. Strategic Weighting**

Nuevo mercado pequeño pero estratégico puede merecer high strategic impact.

De nuevo:

No priority todavía.

---

# **130\. Opportunity Cost**

Algunos problemas no producen pérdida visible.

Impiden capturar crecimiento.

Ejemplo:

Creative supply constraint

puede generar:

OPPORTUNITY\_COST

---

# **131\. Opportunity Cost ≠ Realized Loss**

Debe distinguirse.

---

# **132\. Example**

Current acquisition:

profitable

pero creative capacity impide aumentar spend.

No tenemos:

revenue loss

confirmado.

Tenemos:

growth opportunity constrained

---

# **133\. Opportunity Cost Confidence**

Normalmente menor que realized impact.

---

# **135\. Severity does not require monetary quantification**

Un checkout roto puede ser CRITICAL incluso antes de calcular € exactos.

---

# **136\. Economic impact should still be estimated if reliable**

Porque ayuda después en F4.

---

# **138\. Example**

Sabemos:

Revenue lost:  
HIGH confidence

pero:

why:  
MEDIUM confidence

---

# **139\. Another**

Root cause:

HIGH confidence

pero lifetime brand impact:

LOW confidence

---

# **141\. Severity can be high despite uncertain cause**

Ejemplo:

Orders down 70%

La causa es desconocida.

Severity:

CRITICAL / HIGH confidence

Root cause confidence:

LOW

---

# **142\. This distinction is essential**

No necesitamos conocer la causa para saber que un incendio es grave.

---

# **146\. Severity can use direct business evidence**

Ejemplo:

checkout failure affects 90%

suficiente para CRITICAL aunque root todavía UNKNOWN.

---

# **149\. Example inventory risk**

If inbound PO arrives on time:  
LOW impact

If delayed 2 weeks:  
HIGH impact

---

# **151\. Expected Value caution**

No calcular probabilidades falsas.

Si no tenemos probabilidades calibradas:

usar:

scenario ranges

---

# **152\. Risk \= Probability × Impact?**

Conceptualmente sí.

Pero D10 no debe fingir:

13.7% probability

sin modelo válido.

---

# **153\. Risk Matrix**

Puede utilizar:

LIKELIHOOD:  
LOW / MEDIUM / HIGH

IMPACT:  
LOW / MEDIUM / HIGH / CRITICAL

---

# **154\. Likelihood source**

Debe derivar de:

trajectory  
leading indicators  
known constraints  
historical recurrence

---

# **155\. D10 focus is severity, not full risk-management system**

Pero necesita incorporar riesgo suficiente para amenazas emergentes.

---

# **156\. Recurrence**

Problema recurrente puede elevar severidad estructural.

---

# **157\. Example**

Payment bug:

third recurrence in 30 days

Aunque cada incidente sea corto:

systemic severity higher

---

# **159\. Chronic Damage**

Una debilidad moderada durante un año puede acumular más daño que un incidente crítico de cinco minutos.

---

# **160\. Cumulative Impact**

D10 debe poder considerar:

instantaneous severity

y:

cumulative impact

por separado.

---

# **161\. Example**

Margin leakage:  
\-2 pp  
for 12 months

puede representar impacto económico enorme.

---

# **162\. Acute Severity**

how severe right now?

---

# **163\. Cumulative Severity**

how much damage has accumulated?

---

# **164\. Structural Severity**

how dangerous is recurrence / persistence?

---

# **166\. Example**

Creative pipeline weakness:

acute:  
LOW

cumulative:  
MODERATE

forward risk:  
HIGH

structural:  
HIGH

---

# **167\. Example Payment Outage**

acute:  
CRITICAL

cumulative:  
MODERATE

forward risk:  
CRITICAL if active

structural:  
LOW

si incidente único.

---

# **168\. This richness matters**

Ambos problemas podrían acabar en:

HIGH

con razones totalmente diferentes.

---

# **169\. Criticality of Capability**

D4/D7 aportan:

BUSINESS\_CRITICALITY

de cada capacidad.

---

# **170\. Criticality ≠ Current Impact**

Payment es critical capability.

Pero si backup provider absorbe todo:

current impact:  
LOW

---

# **171\. Redundancy**

D10 debe considerar:

REDUNDANCY

---

# **172\. Example**

Primary warehouse outage.

Si secondary warehouse absorbe:

blast radius reduced

---

# **173\. Resilience Buffer**

Puede incluir:

backup provider

safety stock

cash buffer

alternate channel

spare capacity

redundant systems

---

# **174\. Buffer reduces severity**

Misma causa, distinta severidad.

---

# **175\. Example**

Supplier failure.

Business A:

120 days safety stock

Business B:

5 days stock

Severity completely different.

---

# **176\. Severity is business-specific**

No universalizar desde causa.

---

# **177\. Impact Absorption**

Concepto:

ABSORPTION\_CAPACITY

Qué capacidad tiene el negocio de absorber el shock.

---

# **178\. Absorption Capacity dimensions**

cash buffer

inventory buffer

operational redundancy

channel diversification

supplier redundancy

technical redundancy

---

# **179\. Shock × Buffer**

Misma anomalía puede:

barely matter

o:

threaten continuity

dependiendo del buffer.

---

# **180\. Severity Escalation Conditions**

Ejemplo:

problem persists

exposure expands

trajectory worsens

buffers decline

secondary effects appear

pueden escalar severity.

---

# **181\. Severity De-escalation**

problem contained

scope shrinks

recovery begins

redundancy activated

impact stops accumulating

---

# **184\. Impact Timeline**

Ejemplo:

10:00 anomaly starts  
10:10 checkout degradation  
10:20 lost-order impact becomes material  
11:00 severity CRITICAL

---

# **185\. Escalation Trigger**

Cambios en severity pueden generar alerts.

Pero notification policy pertenece a monitor/runtime.

---

# **186\. D10 is not alert policy**

Aunque produce inputs necesarios.

---

# **200\. Hard Technical Example**

Checkout unavailable

tiene alta severity por critical path.

---

# **201\. Business-Specific Example**

Hero SKU unavailable

severity depende de revenue share.

---

# **202\. Historical Example**

Refunds \+20%

severity depende de base rate y economics.

---

# **203\. Economic Example**

CAC \> contribution before acquisition

puede implicar adquisición económicamente destructiva.

---

# **204\. Severity by Capability**

Cada capacidad puede tener reglas propias.

---

# **205\. Acquisition Severity**

Considerar:

new customer volume

CAC economics

spend exposure

marginal economics

channel dependency

---

# **206\. Creative Severity**

Considerar:

paid spend dependent on affected creatives

replacement availability

performance propagation

creative pipeline

---

# **207\. Conversion Severity**

Considerar:

funnel stage

traffic affected

lost purchase probability

critical-path position

---

# **208\. Inventory Severity**

Considerar:

revenue share of unavailable stock

days cover

lead time

replacement product availability

cash exposure

---

# **209\. Operations Severity**

Considerar:

orders affected

backlog

SLA

capacity

customer impact

---

# **210\. Finance Severity**

Considerar:

cash runway

negative contribution

working capital

obligations

liquidity

---

# **211\. Data Severity**

Considerar:

which decisions are blocked

which diagnoses are unreliable

scope of measurement distortion

---

# **212\. Technology Severity**

Considerar:

business function affected

availability

errors

scope

redundancy

---

# **213\. Team Severity**

Considerar:

critical ownership

execution backlog

dependency

capacity

---

# **214\. Strategic Severity**

Considerar:

strategic initiative blocked

resource waste

duration

business dependence

---

# **215\. Severity can differ from Health**

Example:

Creative Health:  
BAD

pero:

Severity:  
MODERATE

si paid acquisition represents only 5% revenue.

---

# **216\. Another**

Technology Health:  
HEALTHY overall

pero:

one checkout incident:  
CRITICAL severity

---

# **217\. Local Critical Incident**

Parent capability need not become DISASTER if issue scope small.

---

# **219\. Severity Globalization Test**

Antes de decir:

BUSINESS CRITICAL

preguntar:

> ¿El impacto realmente alcanza una parte material del negocio global?

---

# **220\. Exception: Continuity**

Una amenaza de liquidez puede ser global aunque actualmente afecte pocas transacciones.

---

# **221\. Severity and Uncertainty**

High uncertainty should not automatically mean low severity.

---

# **222\. Example**

Potential security/checkout problem.

Impact:

possibly critical

Evidence incomplete.

Correct representation:

Potential Severity:  
CRITICAL

Severity Confidence:  
LOW/MEDIUM

No:

Severity LOW

solo porque no sabemos.

---

# **228\. Observed Impact**

Ejemplo:

214 failed payments

---

# **229\. Estimated**

€18k lost sales

usando average order value.

---

# **230\. Inferred**

likely future retention damage

---

# **231\. Forecast**

stockout expected in 8 days

---

# **232\. Keep layers visible**

No mezclar todas como hechos.

---

# **233\. Example — Payment failure**

Data:

Payment success:  
97% → 70%

Checkout exposure:  
92%

AOV:  
€84

Duration:  
3 hours

D10:

Revenue Impact:  
CRITICAL

Customer Impact:  
CRITICAL

Operational Impact:  
LOW

Continuity Risk:  
HIGH

Overall Severity:  
CRITICAL

Trajectory:  
ACTIVE / stable at bad level

Reversibility:  
HIGH

Lost-sales recoverability:  
LOW

---

# **234\. Example — Creative deterioration**

CAC \+18%  
Paid channel:  
35% new customer revenue

Contribution remains positive

Duration:  
3 weeks

D10:

Revenue Impact:  
LOW/MODERATE

Contribution Impact:  
MODERATE

Forward Risk:  
HIGH

Overall Severity:  
MODERATE/HIGH

Propagation:  
MEDIUM

---

# **235\. Example — Inventory**

Hero SKU:  
52% revenue

Stockout:  
active

Restock:  
21 days

D10:

Revenue:  
CRITICAL

Contribution:  
CRITICAL

Customer:  
HIGH

Cash:  
HIGH

Propagation:  
HIGH

Overall:  
CRITICAL

---

# **236\. Example — Overstock**

Revenue:  
stable

Inventory:  
\+80%

Cash:  
\-40%

Slow-moving:  
high

D10:

Revenue impact:  
LOW

Cash impact:  
CRITICAL

Working capital:  
CRITICAL

Continuity:  
potentially HIGH

Overall:  
HIGH / CRITICAL

---

# **237\. Example — Tracking failure**

Shopify healthy

GA purchases \-60%

Meta measurement distorted

D10:

Direct Revenue Impact:  
NONE CONFIRMED

Data Impact:  
CRITICAL

Decision Impact:  
HIGH

Business Performance Impact:  
UNKNOWN

Severity:  
HIGH

Importantísimo:

No atribuir revenue loss inexistente.

---

# **238\. Example — Support backlog**

Tickets \+80%

Response time:  
6h → 30h

Refunds stable

Repeat not yet affected

D10:

Operational:  
HIGH

Customer:  
HIGH

Revenue current:  
LOW

Retention risk:  
MEDIUM/HIGH

Overall:  
HIGH

---

# **239\. Example — Small local bug**

Browser:  
Firefox

Traffic share:  
1.2%

CVR \-70%

D10:

Local symptom:  
CRITICAL

Business severity:  
LOW

Esta distinción es esencial.

---

# **241\. Example**

Firefox checkout:  
DISASTER locally

Overall business:  
LOW impact

---

# **242\. Example — Cash threat**

Revenue healthy

Contribution positive

Cash runway:  
18 days

Supplier obligations:  
material

D10 puede devolver:

Revenue:  
HEALTHY

Finance Impact:  
BUSINESS\_THREAT

Continuity:  
HIGH/IMMINENT

Overall Severity:  
BUSINESS\_THREAT

---

# **243\. This is why topline cannot dominate**

---

# **244\. Example — Brand deterioration**

Negative reviews:  
\+60%

Refunds:  
\+25%

Repeat:  
starting to decline

Revenue:  
stable

D10:

Current Revenue Impact:  
LOW

Customer:  
HIGH

Brand:  
HIGH

Forward Revenue Risk:  
HIGH

Overall:  
HIGH

---

# **245\. Example — Market decline**

Category demand:  
\-30%

Business revenue:  
\-18%

market exposure:  
90%

D10:

Revenue:  
HIGH

Strategic:  
HIGH

Controllability:  
LOW

Overall:  
HIGH

External cause can still be severe.

---

# **252\. Severity Profile Example**

acute:  
CRITICAL

cumulative:  
MODERATE

forward:  
CRITICAL

structural:  
LOW

overall:  
CRITICAL

---

# **253\. Impact Vector Example**

Revenue:  
CRITICAL

Contribution:  
HIGH

Cash:  
MEDIUM

Customer:  
CRITICAL

Operations:  
LOW

Brand:  
MEDIUM

Strategic:  
LOW

Continuity:  
HIGH

---

# **254\. Human Diagnostic Summary**

> El fallo de pagos afecta aproximadamente al 88 % del checkout y está reduciendo directamente la capacidad de completar pedidos. El impacto actual sobre revenue y experiencia de cliente es crítico. La incidencia es técnicamente reversible, pero las ventas perdidas durante el periodo de fallo son solo parcialmente recuperables. Mientras permanezca activa, el daño económico continúa acumulándose.

Esto es D10.

---

# **259\. Severity ≠ Priority Example**

Problem A:

Severity:  
CRITICAL

Impact:  
€20k

Easy recovery  
Localized

Problem B:

Severity:  
HIGH

Impact:  
€500k over 6 months

Systemic

Cuál atacar primero requiere F4.

---

# **260\. Priority will use more variables**

Probablemente:

Severity  
Impact  
Urgency  
Confidence  
Effort  
Reversibility  
Dependency  
Strategic value

pero todavía no estamos ahí.

---

# **265\. Buffer Exhaustion**

Example:

Cash buffer:  
40 days

with:

burn:  
accelerating

D10 can estimate:

buffer exhaustion horizon

---

# **266\. Inventory Buffer**

days cover

is natural buffer.

---

# **267\. Capacity Buffer**

warehouse spare capacity

---

# **268\. Creative Buffer**

unused high-performing creative inventory

conceptually.

---

# **270\. Thin buffer increases forward severity**

---

# **272\. Example**

Inventory risk

Sep 1:  
MODERATE

Sep 5:  
HIGH

Sep 8:  
CRITICAL

because:

coverage fell  
PO delayed

---

# **282\. Example Admin Trace**

DIAG-1048

ROOT CAUSE:  
Hero SKU stockout

CURRENT SEVERITY:  
CRITICAL

REVENUE EXPOSURE:  
54%

ESTIMATED LOST REVENUE:  
€17k–€23k/day

CONTRIBUTION IMPACT:  
HIGH

CUSTOMER IMPACT:  
HIGH

CASH IMPACT:  
MEDIUM

PROPAGATION:  
HIGH

RESTOCK:  
18 days

RECOVERABILITY:  
PARTIAL

IMPACT CONFIDENCE:  
MEDIUM\_HIGH

---

# **287\. Cross-capability impact**

Example:

Root:

Inventory shortage

Inventory Agent:

stock exposure

Conversion Agent:

CVR impact

Finance Agent:

cash/contribution impact

Orchestrator builds one impact graph.

---

# **288\. Impact Graph**

Conceptually:

ROOT CAUSE  
    ↓  
DIRECT IMPACT  
    ↓  
SECONDARY IMPACT  
    ↓  
BUSINESS OUTCOME

---

# **289\. Impact Graph vs Causal Graph**

D7 asks:

what can cause what?

D10 asks:

how much damage is flowing through that path?

---

# **290\. Economic propagation**

Example:

Stockout  
→ 300 lost orders  
→ €24k revenue  
→ €8k contribution  
→ reduced cash

---

# **297\. RAG Structure**

Recommended semantic chunks:

severity\_principles

severity\_vs\_priority

impact\_dimensions

revenue\_impact

contribution\_impact

cash\_impact

customer\_impact

operational\_impact

continuity\_impact

business\_exposure

blast\_radius

propagation

reversibility

recoverability

buffers

impact\_quantification

severity\_invariants

Metadata:

phase:  
F3

block:  
D10

domain:  
severity\_impact

knowledge\_type:  
diagnostic\_evaluation

---

# **325\. Example Final D10 Result**

DIAGNOSIS:  
Hero SKU inventory failure

ROOT CAUSE:  
Promo-adjusted demand was omitted from replenishment forecast

CONSTRAINT:  
Inventory availability

BUSINESS EXPOSURE:  
54% revenue

CURRENT IMPACT:  
CRITICAL

REVENUE IMPACT:  
€17k–€23k estimated daily revenue loss

CONTRIBUTION IMPACT:  
HIGH

CASH IMPACT:  
HIGH

CUSTOMER IMPACT:  
HIGH

OPERATIONS IMPACT:  
MODERATE

PROPAGATION RISK:  
HIGH

CONTINUITY RISK:  
MODERATE

RECOVERABILITY:  
PARTIAL

ROOT CAUSE CONFIDENCE:  
HIGH

IMPACT CONFIDENCE:  
MEDIUM\_HIGH

BUSINESS SEVERITY:  
CRITICAL

---

# **326\. Final Principle**

Una IA superficial observa:

CVR \-20%

y dice:

> “Es grave.”

Un sistema diagnóstico serio pregunta:

¿Dónde cayó?

¿Cuánto negocio afecta?

¿Cuántos pedidos se pierden?

¿Cuánto revenue?

¿Cuánta contribution?

¿Qué ocurre con cash?

¿Se está propagando?

¿Cuánto tiempo puede aguantar el negocio?

¿El daño puede recuperarse?

¿Está empeorando?

¿Y con qué seguridad puedo cuantificar todo lo anterior?

D10 convierte un diagnóstico causal en una **medida real de impacto empresarial**.

Y, todavía, no decide qué hacer primero.

