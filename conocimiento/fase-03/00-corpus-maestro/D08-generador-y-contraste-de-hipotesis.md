# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D8 — GENERADOR Y CONTRASTE DE HIPÓTESIS**

---

# **0\. Propósito de D8**

Hasta ahora:

D5  
detecta señales

D6  
construye síntomas

D7  
identifica rutas causales plausibles

D8 responde:

> **¿Qué explicaciones concretas podrían estar causando este patrón, cuál encaja mejor con la evidencia y cuáles deben descartarse?**

El objetivo no es generar muchas ideas.

El objetivo es construir un proceso disciplinado de:

GENERATE  
↓  
TEST  
↓  
COMPARE  
↓  
FALSIFY  
↓  
UPDATE

---

# **1\. Principio fundamental**

Nunca:

SYMPTOM  
→  
FIRST PLAUSIBLE CAUSE  
→  
DIAGNOSIS

Siempre:

SYMPTOM  
↓  
MULTIPLE HYPOTHESES  
↓  
EVIDENCE FOR  
↓  
EVIDENCE AGAINST  
↓  
MISSING EVIDENCE  
↓  
COMPARISON  
↓  
BEST CURRENT EXPLANATION

---

# **2\. Why multiple hypotheses matter**

Ejemplo:

CAC \+30%  
CTR \-20%  
CPM stable  
CVR stable

Una explicación superficial sería:

Creative fatigue

Pero también pueden existir:

Audience saturation

Offer response deterioration

Placement mix deterioration

Market mix change

Creative-message mismatch

Tracking distortion

D8 debe impedir que el copiloto se enamore de la primera explicación.

---

# **4\. Hypothesis statement**

Debe ser concreta y verificable.

Mala:

Marketing is bad.

Buena:

The increase in CAC is primarily driven by deterioration in paid-social click-through response rather than post-click conversion.

Más específica:

The decline in Meta prospecting CTR is primarily explained by deterioration in creative response across mature high-spend assets.

---

# **7\. Confirmed should be rare**

`CONFIRMED` debería reservarse para casos con evidencia muy fuerte.

Ejemplos:

Payment error logs identify exact failing configuration.

Controlled rollback restores conversion.

A/B test proves causal effect.

System outage directly matches failure.

En muchos diagnósticos reales el estado correcto será:

SUPPORTED

o:

MOST\_LIKELY

---

# **8\. Hypothesis types**

Como mínimo:

DIRECT\_CAUSE

CONTRIBUTORY\_CAUSE

ROOT\_CAUSE\_CANDIDATE

CONTEXTUAL\_EXPLANATION

DATA\_QUALITY\_EXPLANATION

STRUCTURAL\_EXPLANATION

EXTERNAL\_EXPLANATION

INTERACTION\_HYPOTHESIS

---

# **9\. Direct Cause**

Ejemplo:

Payment errors increased because payment configuration is invalid.

---

# **10\. Contributory Cause**

Ejemplo:

Higher CPM explains part of the CAC increase.

---

# **11\. Root Cause Candidate**

Ejemplo:

Creative production slowdown created insufficient asset renewal, leading to concentration and subsequent response deterioration.

---

# **12\. Contextual Explanation**

Ejemplo:

The apparent revenue decline is largely explained by post-promotion normalization.

---

# **13\. Data Quality Explanation**

Ejemplo:

The apparent drop in paid conversions is primarily a measurement regression rather than a real business decline.

---

# **14\. Structural Explanation**

Ejemplo:

Recurring stockouts are driven by inventory planning maturity lagging behind current order complexity.

---

# **15\. External Explanation**

Ejemplo:

Auction cost inflation is materially contributing to acquisition deterioration.

---

# **16\. Interaction Hypothesis**

Ejemplo:

The conversion decline is caused by the interaction of a price increase and a simultaneous shift toward colder traffic.

---

# **17\. Hypothesis generation sources**

Las hipótesis pueden provenir de:

Causal graph

Symptom templates

Historical tenant cases

Known business events

Cross-source patterns

General expert knowledge

LLM reasoning

Pero ninguna fuente por sí sola confirma una hipótesis.

---

# **18\. Hypothesis generation from D7**

D7 entrega:

candidate upstream branches

D8 transforma cada rama relevante en:

explicit testable explanation

---

# **19\. Example**

D7:

CTR may be affected by:  
Creative  
Audience  
Offer  
Placement  
Frequency

D8 genera:

H1 — Creative response deterioration  
H2 — Audience saturation  
H3 — Offer-message weakening  
H4 — Placement mix deterioration  
H5 — Excessive frequency

---

# **20\. Hypothesis count**

No queremos:

25 hypotheses

por cada problema.

Tampoco:

1 hypothesis

La cantidad debe ser suficiente para cubrir explicaciones razonables.

---

# **21\. Candidate cap**

Conceptualmente puede mantenerse:

3–7 serious candidates

dependiendo de complejidad.

No es una regla rígida.

---

# **22\. Hypothesis relevance**

Cada hipótesis debe pasar:

mechanism plausibility

scope fit

temporal fit

magnitude fit

data availability

diagnostic relevance

antes de entrar en shortlist.

---

# **23\. Pre-filtering**

No tiene sentido generar:

inventory hypothesis

si el target es:

Meta CTR decline before click

y no existe ruta plausible.

---

# **24\. Hypothesis Prior**

Puede existir:

PRIOR\_PLAUSIBILITY

que representa:

> qué tan plausible era la explicación antes de mirar toda la evidencia del caso.

---

# **25\. Priors are not conclusions**

Una causa frecuente puede tener prior alto.

Pero evidencia contradictoria debe derrotarla.

---

# **26\. Example**

Creative fatigue puede ser común.

Pero si:

new creatives also deteriorate  
frequency stable  
creative age low

el prior debe perder peso.

---

# **27\. Prior sources**

Puede depender de:

business model  
maturity  
symptom family  
historical tenant patterns  
general causal knowledge

---

# **28\. No popularity bias**

No asumir:

common cause  
\=  
actual cause

---

# **29\. Supporting Evidence**

Para cada hipótesis:

SUPPORTING\_EVIDENCE\[\]

Ejemplo:

Hypothesis:

Creative fatigue

Supporting:

CTR declining  
frequency increasing  
creative age increasing  
spend concentration high  
new winners scarce

---

# **30\. Contradicting Evidence**

Debe existir siempre:

CONTRADICTING\_EVIDENCE\[\]

Ejemplo:

new creatives perform equally poorly  
frequency stable  
same decline in untouched audience

---

# **31\. Missing Evidence**

MISSING\_EVIDENCE\[\]

Ejemplo:

creative-level historical CTR  
frequency by audience  
asset launch dates

---

# **32\. Missing evidence is not neutral**

Si una pieza crítica falta:

confidence cap

debe aplicarse.

---

# **34\. Discriminating Evidence**

Muy importante.

Es la evidencia que diferencia entre dos hipótesis.

Ejemplo:

CTR deterioration

puede apoyar:

Creative fatigue  
Audience saturation  
Offer weakening

No discrimina mucho.

Pero:

Only old creatives deteriorate; new creatives stable

discrimina fuertemente hacia creative fatigue.

---

# **35\. Diagnostic information gain**

D8 debe preguntarse:

> ¿Qué dato, si lo obtengo, elimina más hipótesis?

---

# **36\. Information Gain**

Conceptualmente:

HIGH\_INFORMATION\_GAIN

para pruebas que separan ramas.

---

# **37\. Example**

Hypotheses:

H1 Creative fatigue  
H2 Audience saturation

Dato:

CTR by creative age

puede tener alto poder discriminante.

---

# **38\. Another**

CTR by placement

puede discriminar:

placement mix issue

---

# **40\. Example test**

Hypothesis:

Creative fatigue

Test:

Compare old high-frequency creatives vs recently launched creatives.

Expected if true:

old assets deteriorate more strongly.

Expected if false:

new and old assets deteriorate similarly.

---

# **41\. Falsifiability**

Una buena hipótesis debe poder ser falsa.

Mala:

Customers are less interested.

Difícil de falsar.

Mejor:

The CTR decline is primarily concentrated in high-frequency mature audiences.

Esto sí se puede probar.

---

# **43\. Hypothesis Quality**

Puede considerar:

specificity  
falsifiability  
mechanism clarity  
scope precision  
testability

---

# **44\. Best hypothesis is not the most detailed**

Debe ser:

most explanatory  
with least unsupported assumptions

---

# **45\. Parsimony**

D8 debe respetar:

PARSIMONY

pero sin abusar.

La explicación más simple no siempre es correcta.

---

# **46\. Occam-style reasoning**

Si una sola explicación soportada explica:

CTR ↓  
CPC ↑  
CAC ↑

mejor que tres causas separadas sin evidencia, gana peso.

---

# **47\. But avoid oversimplification**

Ejemplo:

Contribution ↓

puede ser claramente multicausal.

No forzar una sola causa.

---

# **48\. Explanatory Power**

Cada hipótesis debe medir conceptualmente:

How much of the observed pattern can it explain?

---

# **49\. Example**

Target:

Revenue \-25%

Hypothesis A explica:

\~3% of revenue exposure

Hypothesis B explica:

\~70% of affected funnel

B tiene mayor explanatory power.

---

# **50\. Magnitude Fit**

Esto debe formar parte de score.

---

# **51\. Scope Fit**

Hypothesis debe afectar mismo:

market  
device  
channel  
product  
customer type

que el síntoma.

---

# **52\. Temporal Fit**

La causa debe ocurrir antes o dentro del lag esperado.

---

# **53\. Mechanism Fit**

La relación debe existir en D7.

---

# **54\. Context Fit**

Debe ser compatible con D2.

---

# **55\. Maturity Fit**

D3 puede aportar plausibilidad.

Ejemplo:

Recurring inventory issues son más plausibles si:

Inventory maturity materially below required level.

Pero esto no confirma causa.

---

# **56\. Health Fit**

D4 también puede aportar.

Si:

Creative health:  
ELITE

con fuerte evidencia, una hipótesis de broad creative failure debería perder peso.

---

# **57\. Signal Fit**

D5/D6 son núcleo de evidencia observable.

---

# **59\. Hypothesis score**

Puede existir score interno.

Ejemplo:

H1:  
82/100

H2:  
56/100

Pero UI principal debería usar:

SUPPORTED  
WEAKLY\_SUPPORTED  
CONTRADICTED

más explicación.

---

# **62\. Bayesian spirit without fake Bayesian math**

El sistema puede razonar así:

prior  
\+  
new evidence  
→  
updated belief

sin fingir probabilidades exactas.

---

# **65\. Example ledger**

H1 Creative fatigue

Sep 10 09:00  
UNTESTED

Sep 10 09:05  
SUPPORTED  
CTR down \+ frequency up

Sep 10 09:10  
WEAKENED  
new creatives also down

Sep 10 09:20  
PARTIALLY\_SUPPORTED  
decline concentrated in two audiences

---

# **66\. Do not delete rejected hypotheses**

Una hipótesis invalidada debe permanecer registrada.

---

# **67\. Why rejected hypotheses matter**

Para:

traceability  
future learning  
avoid repeated investigation  
agent evaluation

---

# **68\. Hypothesis competition**

Las hipótesis deben compararse entre sí.

No evaluarse de forma aislada.

---

# **69\. Comparative Matrix**

Ejemplo:

| Hipótesis | A favor | En contra | Falta | Estado |
| ----- | ----- | ----- | ----- | ----- |
| Creative fatigue | CTR ↓, age ↑ | New ads also ↓ | frequency detail | Supported |
| Audience saturation | frequency ↑ | new audiences also ↓ | reach saturation | Partial |
| CPM pressure | none | CPM stable | — | Invalidated |
| CVR decline | none | CVR stable | — | Invalidated |

---

# **70\. Relative Explanation**

Puede existir:

PRIMARY\_HYPOTHESIS

SECONDARY\_HYPOTHESIS

ALTERNATIVE\_HYPOTHESIS

---

# **71\. Primary hypothesis**

La explicación que actualmente tiene mejor soporte.

No significa causa confirmada.

---

# **72\. Secondary hypothesis**

Puede explicar parte del fenómeno.

---

# **73\. Alternative hypothesis**

Permanece viable pero con menor soporte.

---

# **74\. Composite hypothesis**

A veces la mejor explicación es combinada.

Ejemplo:

CAC deterioration is jointly explained by  
moderate CPM inflation  
and conversion decline.

---

# **75\. Avoid double-counting**

Si dos hypotheses describen la misma ruta con nombres diferentes, deben fusionarse.

---

# **76\. Hypothesis normalization**

Ejemplo:

Creative fatigue

Old creatives exhausted

Creative wear-out

pueden mapear al mismo canonical concept.

---

# **77\. HYPOTHESIS\_CODE**

Necesitamos códigos.

Ejemplos:

CREATIVE\_FATIGUE

AUDIENCE\_SATURATION

OFFER\_RESPONSE\_WEAKNESS

PAYMENT\_PROVIDER\_FAILURE

PAYMENT\_CONFIG\_REGRESSION

HERO\_SKU\_STOCKOUT

TRACKING\_REGRESSION

DISCOUNT\_DEPENDENCY

FULFILLMENT\_CAPACITY\_LIMIT

COHORT\_QUALITY\_DECLINE

---

# **78\. Canonical \+ free-text**

Mantener:

hypothesis\_code

y:

case\_specific\_statement

---

# **79\. Example**

Code:

PAYMENT\_CONFIG\_REGRESSION

Statement:

A configuration change deployed on Sep 8 may be causing Mastercard 3DS authentication failures in Spain.

---

# **80\. Hypothesis families**

## **Acquisition**

CPM\_INFLATION  
CTR\_RESPONSE\_DERIORATION  
AUDIENCE\_SATURATION  
CHANNEL\_MIX\_SHIFT  
TRAFFIC\_QUALITY\_DECLINE  
SCALING\_SATURATION

---

# **81\. Creative**

CREATIVE\_FATIGUE  
CREATIVE\_PIPELINE\_DEFICIT  
CONCEPT\_EXHAUSTION  
CREATIVE\_MESSAGE\_MISMATCH  
FORMAT\_MIX\_WEAKNESS

---

# **82\. Conversion**

PDP\_REGRESSION  
PRICE\_RESISTANCE  
OFFER\_WEAKNESS  
STOCK\_AVAILABILITY  
CHECKOUT\_FRICTION  
PAYMENT\_FAILURE  
TECHNICAL\_REGRESSION  
TRAFFIC\_MIX

---

# **83\. Retention**

PRODUCT\_SATISFACTION\_DECLINE  
CUSTOMER\_QUALITY\_DECLINE  
DELIVERY\_EXPERIENCE\_DECLINE  
CRM\_WEAKNESS  
COHORT\_MIX  
SUBSCRIPTION\_CHURN\_DRIVER

---

# **84\. Inventory**

FORECAST\_BIAS  
DEMAND\_SPIKE  
PURCHASE\_UNDERBUY  
SUPPLIER\_DELAY  
LEAD\_TIME\_CHANGE  
PORTFOLIO\_ALLOCATION\_ERROR

---

# **85\. Operations**

CAPACITY\_SATURATION  
STAFFING\_GAP  
PROCESS\_FAILURE  
CARRIER\_DETERIORATION  
RETURN\_BACKLOG

---

# **86\. Finance**

MARGIN\_COMPRESSION  
CAC\_PRESSURE  
DISCOUNT\_PRESSURE  
INVENTORY\_CASH\_LOCKUP  
WORKING\_CAPITAL\_STRAIN  
PAYMENT\_TERM\_MISMATCH

---

# **87\. Data**

TRACKING\_LOSS  
EVENT\_DUPLICATION  
SOURCE\_DIVERGENCE  
ATTRIBUTION\_DRIFT  
SCHEMA\_DRIFT  
PARTIAL\_SYNC

---

# **88\. Technology**

DEPLOYMENT\_REGRESSION  
LATENCY\_REGRESSION  
APP\_CONFLICT  
CHECKOUT\_BUG  
INTEGRATION\_FAILURE

---

# **89\. Team**

CAPACITY\_SHORTFALL  
OWNERSHIP\_GAP  
KEY\_PERSON\_DEPENDENCY  
DECISION\_BOTTLENECK  
SKILL\_GAP

---

# **90\. Strategy**

OBJECTIVE\_MISALIGNMENT  
RESOURCE\_MISALLOCATION  
CHANNEL\_OVERDEPENDENCE  
PORTFOLIO\_MISALIGNMENT  
PREMATURE\_SCALING

---

# **91\. Cross-capability hypotheses**

D8 debe poder generar explicaciones que crucen áreas.

Ejemplo:

Acquisition deterioration is downstream of inventory availability weakness.

---

# **92\. Example**

Signals:

CTR stable  
CPC stable  
CVR down  
hero SKU availability down

Hypothesis:

The increase in CAC is primarily downstream of inventory-driven conversion deterioration rather than advertising deterioration.

---

# **93\. Cross-capability discipline**

Esto es clave para evitar:

Meta metric changed  
→ Meta problem

---

# **94\. Hypothesis generation from stable signals**

Estabilidad también genera hipótesis.

Ejemplo:

Traffic stable  
CVR down  
AOV stable

hace menos probable:

traffic decline

y concentra:

conversion explanations

---

# **95\. Negative evidence**

D8 debe usar activamente:

what did NOT change

---

# **96\. Example**

Hypothesis:

Auction pressure

Pero:

CPM stable

Fuerte evidencia en contra.

---

# **97\. Absence of evidence vs evidence of absence**

No son iguales.

Si no tenemos CPM:

UNKNOWN

Si tenemos CPM y está estable:

CONTRADICTING EVIDENCE

---

# **98\. Critical distinction**

NOT OBSERVED  
≠  
OBSERVED ABSENT

---

# **99\. Hypothesis Test Planning**

Cuando falta evidencia, D8 debería generar:

NEXT\_BEST\_TEST

Pero esto no es recomendación empresarial.

Es una acción diagnóstica.

---

# **100\. Diagnostic action vs business action**

Permitido:

Inspect payment error codes to distinguish provider failure from fraud-rule rejection.

No permitido todavía:

Switch payment provider.

---

# **101\. Diagnostic actions are allowed**

D8 necesita poder decir:

> ¿Qué debo medir o consultar para saber la causa?

Eso forma parte del diagnóstico.

---

# **102\. Test ranking**

Tests pueden priorizarse por:

information gain  
cost  
latency  
availability  
intrusiveness

---

# **103\. Cheap evidence first**

Ejemplo:

Antes de hacer un experimento complejo:

check whether CVR decline is concentrated by device

puede eliminar muchas hipótesis.

---

# **105\. User Question as test**

Ejemplo:

> “¿Cambiasteis el precio el martes?”

puede ser evidencia contextual útil.

---

# **106\. Do not ask unnecessary questions**

Si la plataforma puede obtenerlo automáticamente, no debe pedírselo al usuario.

---

# **107\. Tool-first diagnostic principle**

Conceptualmente:

AVAILABLE SYSTEM DATA FIRST  
USER QUESTION SECOND

---

# **111\. Dominance**

Ejemplo:

H1:  
strong support

H2:  
contradicted

H3:  
weak

H4:  
invalidated

Puede pasar a D9.

---

# **112\. Diagnostic uncertainty floor**

Si H1 y H2 siguen igualmente plausibles:

INCONCLUSIVE

es mejor que inventar ganador.

---

# **113\. Hypothesis separation**

Podemos medir conceptualmente:

HYPOTHESIS\_SEPARATION

---

# **114\. High separation**

H1 much better supported than alternatives.

---

# **115\. Low separation**

Several explanations fit similarly.

Esto limita confidence.

---

# **116\. Evidence Saturation**

Llegará un punto donde más datos similares no añaden información.

---

# **117\. Do not collect redundant evidence**

Ejemplo:

10 metrics all derived from same purchase event

no equivalen a 10 evidencias independientes.

---

# **118\. Evidence Independence**

D1 lineage debe ayudar.

---

# **119\. Independent corroboration**

Más valioso:

Shopify  
payment logs  
support tickets

que tres métricas derivadas del mismo pixel.

---

# **120\. Hypothesis Evidence Weight**

Puede considerar:

source reliability  
independence  
directness  
specificity  
temporal fit

---

# **121\. Direct evidence**

Ejemplo:

Payment logs:  
"3DS configuration invalid"

muy fuerte para config issue.

---

# **122\. Indirect evidence**

payment success declined after deployment

apoya, pero menos.

---

# **123\. Circumstantial evidence**

support tickets mention card problems

útil pero indirecto.

---

# **124\. Hypothesis contradiction strength**

También:

WEAK  
MODERATE  
STRONG  
DECISIVE

---

# **125\. Decisive contradiction**

Hypothesis:

Global checkout failure

pero:

checkout completion stable globally

Puede invalidarla.

---

# **126\. Scope contradiction**

Hypothesis afecta global.

Problema solo en France.

Puede perder mucho peso.

---

# **127\. Temporal contradiction**

Hypothesis event starts after symptom.

Puede invalidarse.

---

# **128\. Magnitude contradiction**

Potential cause affects only 1% business.

Target change 40%.

No puede ser explicación principal.

---

# **129\. Mechanistic contradiction**

No existe ruta causal válida.

Descartar.

---

# **130\. Confounders**

Cada hipótesis debe listar:

potential confounders

Ejemplo:

seasonality  
promotion  
traffic mix  
price change  
tracking

---

# **131\. D12 connection**

D12 profundizará en confusores.

Pero D8 ya debe considerarlos al contrastar.

---

# **132\. Competing causal paths**

Ejemplo:

Target:

CVR down

Hypotheses:

H1 Price resistance  
H2 Product availability  
H3 Mobile regression  
H4 Traffic quality deterioration

D8 debe buscar evidence discriminante para cada uno.

---

# **133\. Example discrimination**

CVR down only on mobile

reduce:

Price resistance

si price change global.

Aumenta:

Mobile regression

---

# **134\. Another discrimination**

CVR down only on out-of-stock PDPs

favorece inventory explanation.

---

# **135\. Another**

CVR down across all products immediately after price change

favorece pricing explanation.

---

# **136\. Multi-step hypotheses**

Algunas hipótesis incluyen una cadena.

Ejemplo:

Creative production slowed  
→ winner replacement fell  
→ concentration increased  
→ response deteriorated  
→ CAC increased

---

# **137\. Chain hypothesis**

Debe tener:

each edge separately testable

---

# **138\. Weakest-link rule**

Si un eslabón no tiene soporte:

overall hypothesis confidence

debe bajar.

---

# **139\. Root-cause candidate confidence**

No basta con demostrar downstream.

Ejemplo:

CTR ↓ → CAC ↑

puede estar HIGH.

Pero:

creative production slowdown → CTR ↓

puede estar MEDIUM.

La root cause completa sigue MEDIUM.

---

# **141\. Surface**

CAC rose because CPC rose.

Correcto, pero poco profundo.

---

# **142\. Intermediate**

CPC rose because CTR deteriorated.

---

# **143\. Root candidate**

CTR deteriorated because mature creative inventory stopped being replenished.

---

# **144\. D8 can hold hypotheses at several depths**

D9 decidirá la mejor root cause soportada.

---

# **145\. Hypothesis tree**

Conceptualmente:

CAC ↑  
├── CPC ↑  
│   ├── CTR ↓  
│   │   ├── Creative fatigue  
│   │   ├── Audience saturation  
│   │   └── Offer weakness  
│   └── CPM ↑  
└── CVR ↓  
    ├── Inventory  
    ├── Price  
    └── Checkout

D5/D6/D7 van podando.

D8 evalúa leaves.

---

# **150\. First broad, then deep**

Primero:

acquisition?  
conversion?  
offer?  
inventory?

Después:

specific creative mechanism?

---

# **151\. Avoid tunnel vision**

El sistema debe reservar siempre al menos una alternativa seria mientras la evidencia no sea definitiva.

---

# **152\. Challenger hypothesis**

Podemos introducir:

CHALLENGER\_HYPOTHESIS

La mejor explicación alternativa a la principal.

---

# **153\. Why challenger matters**

Obliga al sistema a responder:

> ¿Por qué H1 es mejor que H2?

---

# **154\. Example**

Primary:

Creative fatigue

Challenger:

Audience saturation

Comparación:

Creative age:  
supports H1

Frequency:  
supports both

New creatives:  
stable performance  
supports H1 over H2

---

# **155\. Devil's advocate rule**

Antes de promover una hipótesis a alta confianza:

actively search for disconfirming evidence

---

# **156\. Confirmation bias protection**

Nunca buscar solo:

evidence that confirms favorite hypothesis

---

# **160\. Hypothesis Confidence**

Debe depender de:

mechanism strength  
supporting evidence  
contradictions  
falsification  
alternative separation  
data quality  
context quality  
scope fit  
temporal fit  
magnitude fit

---

# **161\. Confidence categories**

HIGH  
MEDIUM  
LOW  
INSUFFICIENT

---

# **162\. HIGH**

Requiere generalmente:

strong direct evidence  
good temporal/scope fit  
few contradictions  
alternatives mostly rejected

---

# **163\. MEDIUM**

best explanation  
but important uncertainty remains

---

# **164\. LOW**

compatible  
but weakly discriminated

---

# **165\. INSUFFICIENT**

cannot distinguish explanations

---

# **166\. Confidence language**

HIGH:

"The evidence strongly supports..."

MEDIUM:

"The most likely explanation is..."

LOW:

"The pattern is compatible with..."

INSUFFICIENT:

"Available evidence does not allow us to distinguish..."

---

# **168\. Example**

H1 Creative fatigue  
SUPPORTED  
MEDIUM\_HIGH

H2 Audience saturation  
PARTIALLY\_SUPPORTED  
MEDIUM

H3 CPM inflation  
INVALIDATED  
HIGH confidence invalidation

H4 Conversion decline  
INVALIDATED  
HIGH confidence invalidation

---

# **170\. User-facing summary**

Puede ser:

> La explicación más probable se encuentra en el deterioro de respuesta antes del clic. La hipótesis con mayor soporte es desgaste creativo; la saturación de audiencia sigue siendo plausible. El incremento de costes de subasta y una caída de conversión quedan prácticamente descartados con los datos actuales.

---

# **171\. This is much better than certainty theater**

No:

> “Tienes fatiga creativa.”

---

# **172\. Inconclusive example**

> Las señales permiten localizar el problema antes del clic, pero todavía no permiten distinguir entre saturación de audiencia y debilidad creativa. Faltan datos de frecuencia y rendimiento por antigüedad de asset.

Perfectamente válido.

---

# **174\. Example**

needed:  
frequency by audience

because:

distinguishes audience saturation from creative fatigue

---

# **180\. Low-impact case**

No merece 50 consultas.

---

# **181\. High-impact case**

Payment collapse sí puede justificar investigación profunda inmediata.

---

# **182\. Hypothesis escalation**

Si severidad potencial es alta y confidence baja:

collect more evidence

---

# **188\. Historical hypothesis performance**

F9 podrá medir:

Which hypothesis types are often correct?  
Which agents overdiagnose?  
Which evidence is most discriminating?

---

# **189\. Agent calibration**

Ejemplo:

Si Creative Agent propone fatiga creativa en 80% de casos pero solo se confirma en 30%:

agent bias detected

---

# **190\. Hypothesis calibration metrics**

Futuro:

confirmation rate  
false positive rate  
invalidation rate  
time to discrimination

---

# **191\. Multi-agent hypotheses**

Distintos agentes pueden proponer hipótesis.

Ejemplo:

Creative Agent:  
Creative fatigue

Acquisition Agent:  
Audience saturation

Conversion Agent:  
No post-click issue

Data Agent:  
Tracking reliable

Orchestrator compara.

---

# **196\. Hypothesis chain example — Payment**

Target:

Revenue \-18%

Symptoms:

Payment completion failure

Hypotheses:

H1 Payment provider outage

H2 Payment configuration regression

H3 Fraud rules rejecting transactions

H4 Issuer/network external decline

H5 Tracking-only issue

---

# **197\. Evidence**

Actual Shopify orders down

weakens:

tracking-only issue

---

# **198\. Error codes**

3DS configuration errors

strongly support:

payment configuration regression

---

# **199\. Scope**

Only Spain affected.

Provider global status healthy.

Weakens:

global provider outage

---

# **200\. Result**

PRIMARY:  
Payment configuration regression

CONFIDENCE:  
HIGH

ALTERNATIVE:  
Fraud configuration interaction

CONFIDENCE:  
LOW

---

# **201\. Hypothesis chain example — CAC**

Target:

CAC \+27%

Symptom:

Pre-click deterioration

Hypotheses:

Creative fatigue  
Audience saturation  
Offer-message weakening  
Placement mix deterioration

---

# **202\. Evidence**

Old creatives down  
New creatives healthy  
Frequency moderate  
Placement mix stable

Result:

Creative fatigue:  
strong support

Audience saturation:  
weak

Placement:  
invalidated

---

# **203\. Hypothesis chain example — CVR**

Target:

CVR \-22%

Symptoms:

PDP-to-cart weakness

Hypotheses:

Price resistance

Hero SKU availability

Traffic quality shift

PDP technical regression

Offer weakening

---

# **204\. Evidence**

Traffic mix stable  
Price unchanged  
PDP latency stable  
top variants out of stock

Result:

Inventory availability:  
strong support

---

# **205\. Hypothesis chain example — Retention**

Target:

90-day repeat \-18%

Hypotheses:

Product dissatisfaction

Delivery deterioration

Customer acquisition mix deterioration

CRM weakness

Promotion cohort mix

---

# **206\. Evidence**

Product reviews stable  
Delivery stable  
CRM stable  
Black Friday cohorts now dominate

Result:

Cohort mix:  
strong explanation

Retention system failure:  
weak

---

# **207\. Hypothesis chain example — Cash**

Target:

Cash \-30%

Hypotheses:

Margin deterioration  
Inventory build  
Receivables delay  
Debt service  
Tax payment

---

# **208\. Evidence**

Contribution stable  
Inventory \+65%  
Supplier prepayments \+40%

Result:

Inventory cash absorption:  
primary explanation

---

# **209\. Multi-causal case**

Target:

Contribution \-25%

Evidence:

CAC \+10%  
Discount \+18%  
Shipping subsidy \+12%  
Refunds \+7%

D8 puede concluir:

No single hypothesis explains the full decline.

Multiple cost pressures jointly explain deterioration.

---

# **210\. Contribution weights**

Si es posible:

CAC pressure:  
\~35% explanatory contribution

Discounts:  
\~40%

Shipping:  
\~15%

Other:  
\~10%

con assumptions explícitas.

---

# **211\. Exact decomposition vs causal decomposition**

Diferenciar:

ACCOUNTING CONTRIBUTION

de:

CAUSAL CONTRIBUTION

---

# **212\. Accounting decomposition can be exact**

Ejemplo:

€50k lower contribution

desglosado por costes.

---

# **213\. Causal explanation may remain uncertain**

Por qué aumentaron esos costes es otro nivel.

---

# **214\. Hypothesis tree continues**

Discount pressure  
↓  
why?

Puede generar nuevas hypotheses.

---

# **215\. Recursive hypothesis generation**

D8 debe soportar:

HYPOTHESIS → NEW TARGET → SUB-HYPOTHESES

---

# **216\. Example**

Primary observed:

Inventory shortage

Next:

Why shortage?

Hypotheses:

Demand exceeded forecast  
Supplier delay  
Under-ordering  
Lead-time assumption wrong  
PO cancellation

---

# **217\. Diagnostic recursion**

Debe parar con D9 cuando encontramos root cause suficientemente útil y respaldada.

---

# **218\. Root Cause Candidate Object**

D8 puede marcar:

ROOT\_CAUSE\_CANDIDATE:  
true

pero D9 lo valida como root cause.

---

# **219\. What is not a root cause candidate**

Revenue decline  
CAC increase  
CVR decline

son demasiado downstream.

---

# **220\. Deeper candidate**

No creative renewal for 6 weeks

puede ser root candidate.

---

# **221\. Structural root candidate**

Creative production capacity below required stage

podría explicar recurrencia.

---

# **222\. Acute vs structural hypothesis**

Separar:

ACUTE\_CAUSE

y:

STRUCTURAL\_DRIVER

---

# **223\. Example**

Acute:

Hero SKU stockout

Structural:

Forecasting and replenishment system insufficient for current scale

Ambas pueden ser ciertas.

---

# **224\. Immediate cause vs underlying driver**

D8 debe poder mantener ambas.

---

# **225\. Example**

Immediate cause:  
Payment configuration invalid

Underlying driver:  
No deployment validation on checkout-critical configuration

---

# **226\. Do not over-deepen**

No seguir hasta:

because someone made a mistake  
because processes exist  
because company culture...

si no aporta utilidad diagnóstica.

---

# **227\. Root-depth heuristic**

Una causa es suficientemente profunda cuando:

it explains the mechanism  
is supported  
is specific enough  
and going deeper adds little decision value

D9 formalizará esto.

---

# **229\. Evidence reuse**

La misma evidencia puede apoyar una hipótesis y contradecir otra.

---

# **230\. Example**

CPM stable

contradice:

auction inflation

y apoya indirectamente:

CTR-driven CPC increase

---

# **231\. Evidence freshness**

Hipótesis debe usar evidencia dentro de ventana relevante.

---

# **232\. Stale evidence**

audience saturation data from 6 months ago

puede tener poco valor para current issue.

---

# **235\. Hypothesis propagation**

Una hipótesis local puede explicar output global si exposición suficiente.

---

# **236\. Magnitude coverage**

Ejemplo:

Affected segment:  
65% spend

sí puede explicar CAC global.

---

# **237\. Another**

Affected segment:  
2% spend

no.

---

# **238\. Hypothesis Coverage**

Puede calcularse:

EXPLANATORY\_COVERAGE

---

# **239\. Hypothesis residual**

Después de explicar parte del problema:

UNEXPLAINED\_RESIDUAL

debe permanecer.

---

# **240\. Example**

Revenue decline:

\-€100k

Stockout explains approximately:

\-€60k

Residual:

\-€40k

Debe seguir investigándose.

---

# **241\. Never claim complete explanation if residual remains material**

---

# **242\. Partial Root Cause**

Puede existir:

PARTIAL\_CAUSE

---

# **243\. Hypothesis Confidence vs Coverage**

Una hipótesis puede ser:

HIGH confidence

pero explicar solo:

20%

del fenómeno.

---

# **244\. Another can be:**

MEDIUM confidence

pero potencialmente explicar 70%.

Ambas dimensiones deben separarse.

---

# **247\. Diagnostic uncertainty**

Puede decomponerse:

DATA\_UNCERTAINTY

MODEL\_UNCERTAINTY

CONTEXT\_UNCERTAINTY

CAUSAL\_UNCERTAINTY

---

# **248\. Data uncertainty**

Faltan o fallan datos.

---

# **249\. Model uncertainty**

No sabemos qué relación causal es correcta.

---

# **250\. Context uncertainty**

No conocemos eventos o condiciones.

---

# **251\. Causal uncertainty**

Varias hypotheses encajan.

---

# **252\. Hypothesis limitations**

Cada conclusión debe declarar:

LIMITATIONS

---

# **253\. Example**

> La hipótesis de fatiga creativa es la mejor soportada, pero no puede confirmarse completamente porque no disponemos de frecuencia desglosada por audiencia.

---

# **255\. Example output — Acquisition**

PRIMARY HYPOTHESIS

Creative fatigue in mature high-spend assets

Status:  
SUPPORTED

Confidence:  
MEDIUM\_HIGH

Supports:  
CTR deterioration  
creative age increase  
old assets underperform  
new assets stable  
CPM stable  
CVR stable

Contradictions:  
None material

Missing:  
audience-frequency detail

Coverage:  
High

---

# **256\. Challenger**

Audience saturation

Status:  
WEAKLY\_SUPPORTED

Supports:  
frequency slightly elevated

Contradictions:  
new audience performance stable

Confidence:  
LOW\_MEDIUM

---

# **257\. Invalidated**

Auction cost inflation

Status:  
INVALIDATED

Reason:  
CPM stable

---

# **258\. Example output — Payment**

PRIMARY HYPOTHESIS

Payment configuration regression

Confidence:  
HIGH

Supports:  
failure starts after config change  
error codes identify 3DS configuration  
affected methods match changed config  
rollback restores success

Alternatives:  
Provider outage — invalidated  
Tracking issue — invalidated

---

# **259\. This can approach confirmation**

Because:

rollback

acts like causal intervention.

---

# **260\. Intervention evidence**

Cuando un cambio revierte el problema:

intervention response

aumenta mucho confianza causal.

---

# **261\. But beware simultaneous changes**

Si rollback ocurre junto a otras correcciones:

confounding remains

---

# **262\. Hypothesis tests can be passive or active**

Passive:

query existing data

Active:

A/B test  
rollback  
controlled change

---

# **268\. D8 and continuous monitoring**

Una hypothesis puede permanecer:

UNDER\_TEST

mientras llegan nuevos datos.

---

# **269\. Example**

Possible cohort deterioration

necesita 30 días adicionales para observar repeat.

No fingir respuesta inmediata.

---

# **270\. But current response should state current state**

Ejemplo:

> La hipótesis permanece abierta; todavía no existe suficiente horizonte para validar comportamiento de recompra.

---

# **271\. Hypothesis expiry**

Algunas hypotheses pueden quedar obsoletas si el fenómeno se resuelve.

---

# **272\. But retain history**

No borrar.

---

# **273\. Recurring hypothesis**

Si misma causa reaparece:

previous case evidence

puede elevar prior tenant-specific.

---

# **274\. Historical case influence**

Debe ser:

supporting prior

no prueba actual.

---

# **275\. Example**

> Las dos últimas veces que apareció este patrón terminó siendo stockout del hero SKU.

Esto aumenta plausibilidad.

Pero no confirma caso actual.

---

# **276\. Tenant-specific priors**

F9 podrá aprender:

P(root cause | symptom, tenant)

conceptualmente.

---

# **277\. Global prior vs tenant prior**

Tenant evidence más relevante cuando suficiente.

---

# **278\. Cold-start priors**

Sin histórico propio:

general business knowledge

con menor confidence.

---

# **279\. Expert knowledge**

Principios derivados de operadores y especialistas pueden aportar:

candidate hypotheses  
common failure modes  
discriminating questions  
mechanisms

Pero deben entrar como:

GENERAL HEURISTIC

y no como autoridad.

---

# **280\. Example principle**

When paid acquisition efficiency deteriorates while CPM and post-click conversion remain stable, the diagnostic search should concentrate on click response, audience exposure and message-market fit before blaming the website.

Esto es conocimiento útil.

---

# **281\. What not to store**

No:

When CAC rises, make more creatives.

Eso mezcla diagnóstico y acción.

---

# **282\. Hypothesis explainability**

El copiloto debe poder explicar:

Why this hypothesis?  
Why not the alternatives?  
What evidence is missing?  
What would falsify it?

---

# **283\. User-facing format**

Ejemplo:

> La explicación con mayor soporte es una caída de respuesta creativa. El CTR cae mientras CPM y conversión post-click permanecen estables; además, el deterioro está concentrado en assets antiguos de alto gasto. La saturación de audiencia sigue siendo posible, aunque tiene menos soporte. Para distinguirlas definitivamente faltan datos de frecuencia por audiencia.

---

# **284\. Admin format**

Mucho más detallado:

H1  
Creative fatigue  
82 score  
MEDIUM\_HIGH

H2  
Audience saturation  
61  
MEDIUM

H3  
Auction inflation  
12  
INVALIDATED

con full evidence ledger.

---

# **286\. Hypothesis audit**

Ejemplo:

Hypothesis:  
PAYMENT\_CONFIG\_REGRESSION

Generated from:  
D7 path P-12

Tests:  
T1 temporal fit ✓  
T2 error-code match ✓  
T3 provider outage ✗  
T4 rollback ✓

Status:  
CONFIRMED

---

# **289\. Example**

Assumption:  
Creative IDs are stable across reporting periods.

Si no es cierto, análisis se rompe.

---

# **290\. Assumptions should be explicit**

Sobre todo cuando afectan conclusión.

---

# **291\. Unknown assumptions**

No convertir assumption en fact.

---

# **292\. Evidence conflict**

Puede haber fuentes incompatibles.

D8 debe poder concluir:

HYPOTHESIS\_UNRESOLVED\_DUE\_TO\_EVIDENCE\_CONFLICT

---

# **293\. No forced resolution**

Si dos fuentes fiables contradicen:

investigate conflict

antes de elegir.

---

# **294\. Meta-hypothesis**

A veces la mejor explicación es:

the data itself is inconsistent

---

# **295\. Example**

Shopify orders stable  
Stripe stable  
GA down  
Meta down

Primary hypothesis puede ser:

measurement regression

---

# **296\. Hypothesis across time**

Una causa puede cambiar.

Ejemplo:

Week 1:  
CPM inflation

Week 2:  
Creative deterioration

Week 3:  
CVR deterioration

No asumir una sola causa durante todo periodo.

---

# **297\. Time segmentation**

Hipótesis debe poder tener:

valid\_from  
valid\_to

---

# **298\. Regime-dependent hypothesis**

Example:

pre-promotion  
post-promotion

pueden tener drivers diferentes.

---

# **299\. Hypothesis scope can evolve**

Inicialmente:

global

Después:

Meta / US / prospecting only

Debe versionarse.

---

# **300\. Hypothesis merging**

Dos hypotheses pueden converger.

Ejemplo:

Creative fatigue  
\+  
Audience saturation

pueden convertirse en:

High-exposure creative-audience combination deterioration

si evidencia sugiere interacción.

---

# **301\. Hypothesis splitting**

Una hypothesis global puede dividirse.

Ejemplo:

Conversion regression

se divide en:

Safari checkout bug

France price resistance

dos causas distintas.

---

# **302\. Multicausal diagnosis requires split support**

---

# **314\. Knowledge feedback**

Si se confirma repetidamente, podría convertirse en:

tenant pattern

o eventualmente conocimiento general revisado.

---

# **315\. RAG structure**

Chunks recomendados:

hypothesis\_principles

hypothesis\_generation

hypothesis\_testing

supporting\_evidence

contradicting\_evidence

falsification

challenger\_hypothesis

hypothesis\_ranking

multicausal\_hypotheses

diagnostic\_tests

confidence

hypothesis\_invariants

Metadata:

phase:  
F3

block:  
D8

domain:  
hypothesis\_engine

knowledge\_type:  
diagnostic\_reasoning

---

# **319\. Why this should not be pure LLM**

Porque tendería a:

confirmation bias  
premature certainty  
unstable terminology  
missing alternatives  
hallucinated causality

---

# **320\. Why pure rules are insufficient**

Porque casos reales tienen:

novel combinations  
qualitative evidence  
multi-causal interactions  
complex context

---

# **322\. Fixture — Creative fatigue**

CTR ↓  
CPM stable  
CVR stable  
Old creatives ↓  
New creatives stable  
Creative age ↑

Expected:

Creative fatigue:  
SUPPORTED / MEDIUM\_HIGH-HIGH

Audience saturation:  
WEAK

Auction inflation:  
INVALIDATED

---

# **323\. Fixture — Audience saturation**

CTR ↓  
Frequency ↑↑  
Reach growth flat  
Old and new creatives both ↓  
CPM stable

Expected:

Audience saturation:  
PRIMARY SUPPORTED

Creative fatigue:  
possible secondary

---

# **324\. Fixture — Tracking issue**

Meta conversions ↓  
GA purchases ↓  
Shopify stable  
Stripe stable  
tracking deployment

Expected:

Measurement regression:  
PRIMARY

Not:

business conversion collapse

---

# **325\. Fixture — Price vs inventory**

CVR ↓

Price:  
unchanged

Traffic:  
stable

Hero variants:  
out of stock

Expected:

Inventory availability:  
SUPPORTED

Price resistance:  
INVALIDATED

---

# **326\. Fixture — Temporal invalidation**

Symptom begins Sep 1

Deployment Sep 5

Expected:

Deployment regression:  
INVALIDATED as onset cause

---

# **327\. Fixture — Partial explanation**

Revenue \-30%

Stockout affected:  
10% expected sales

Expected:

Stockout:  
PARTIAL CAUSE

Unexplained residual:  
material

---

# **328\. Fixture — Multi-causal**

Contribution \-25%

Discount:  
\+10 impact

CAC:  
\+8 impact

Shipping:  
\+5 impact

Expected:

MULTICAUSAL EXPLANATION

---

# **329\. Fixture — Insufficient**

CAC ↑  
No CTR  
No CPM  
No CVR

Expected:

Multiple hypotheses remain open

Confidence:  
INSUFFICIENT

---

# **330\. Fixture — Challenger**

Primary evidence supports fatigue moderately.

Audience saturation also plausible.

Expected:

Primary:  
Creative fatigue

Challenger:  
Audience saturation

Confidence:  
MEDIUM

No HIGH.

---

# **331\. Fixture — Intervention**

Payment decline after config change

Rollback  
→ immediate recovery

Expected:

Payment config regression:  
CONFIRMED / HIGH

---

# **333\. Relación con D0**

D0 exige:

hypotheses  
supporting evidence  
contradicting evidence  
missing evidence

D8 implementa ese contrato.

---

# **334\. Relación con D1**

D1 determina si las evidencias son confiables.

---

# **335\. Relación con D2**

D2 evita hipótesis falsas por contexto ignorado.

---

# **336\. Relación con D3**

D3 puede elevar plausibilidad de causas estructurales, sin confirmarlas.

---

# **337\. Relación con D4**

D4 aporta estados de salud que pueden apoyar o contradecir hipótesis.

---

# **338\. Relación con D5**

D5 aporta señales.

---

# **339\. Relación con D6**

D6 aporta síntomas.

---

# **340\. Relación con D7**

D7 restringe el espacio causal válido.

---

# **341\. Relación con D9**

D9 recibirá:

primary hypothesis  
challenger  
supported causal paths  
root-cause candidates  
residual uncertainty

y responderá:

> **¿Cuál es la causa raíz realmente soportada y cuál es el constraint actual del sistema?**

---

# **342\. Relación con D11**

D11 formalizará todavía más:

confidence  
uncertainty

---

# **343\. Relación con D12**

D12 atacará:

confounders  
false diagnoses

antes del cierre.

---

# **344\. Relación con F9**

El histórico de:

generated  
supported  
invalidated  
confirmed

será uno de los datasets más valiosos del sistema.

---

# **346\. Example Admin Trace**

DIAG-1042

TARGET:  
CAC \+26%

H1 Creative fatigue  
Initial confidence: MEDIUM

Evidence:  
old creatives CTR \-24%  
new creatives stable  
creative age \+38%

Updated:  
MEDIUM\_HIGH

Falsification:  
check new creative performance  
FAILED\_TO\_FALSIFY

H2 Audience saturation  
Initial:  
MEDIUM

Evidence:  
frequency \+8%  
reach stable

Contradiction:  
new audiences also healthy

Updated:  
LOW

H3 CPM inflation  
INVALIDATED:  
CPM stable.

---

# **347\. User-facing synthesis**

> La pérdida de eficiencia está localizada antes del clic. La hipótesis mejor respaldada es deterioro de los assets creativos más antiguos: su CTR cae mientras las creatividades recientes permanecen estables, y no existe inflación relevante de CPM ni deterioro post-click. La saturación de audiencia sigue siendo una explicación secundaria, pero actualmente tiene menor soporte.

Eso es D8.

---

# **349\. Arquitectura acumulada**

Ya tenemos:

D1  
¿Puedo creer los datos?

D2  
¿Qué significan en contexto?

D3  
¿Qué madurez tiene el negocio?

D4  
¿Qué está sano o enfermo?

D5  
¿Qué ha cambiado?

D6  
¿Qué patrón forman esos cambios?

D7  
¿Qué mecanismos podrían producirlos?

D8  
¿Qué explicaciones concretas compiten y cuál tiene mejor evidencia?

El siguiente bloque es:

# **D9 — ROOT CAUSE & CONSTRAINT ENGINE**

Y aquí hay una distinción que debemos proteger muchísimo:

ROOT CAUSE  
≠  
CONSTRAINT

La root cause responde:

> **¿Por qué está ocurriendo el problema?**

El constraint responde:

> **¿Qué parte del sistema está limitando actualmente el resultado?**

Ejemplo:

Root Cause:  
Creative production collapsed for six weeks.

Immediate mechanism:  
Old assets exhausted.

Current Constraint:  
Creative supply / acquisition scalability.

Otro:

Root Cause:  
Forecasting underestimated demand.

Immediate cause:  
Hero SKU stockout.

Current Constraint:  
Inventory availability.

D9 será el bloque donde pasamos de “esta es la mejor hipótesis” a una conclusión causal formal, con profundidad, límites y constraint definidos.

---

# **350\. Principio final**

Un sistema mediocre pregunta:

> “¿Qué parece que está pasando?”

D8 pregunta:

¿Qué explicaciones podrían producir exactamente estas evidencias?

¿Qué tendría que ser cierto si cada una fuera correcta?

¿Qué tendría que observar para demostrar que estoy equivocado?

¿Y cuál sobrevive mejor cuando las enfrento entre sí?

El objetivo no es que la IA tenga una opinión.

El objetivo es que **mantenga explicaciones competidoras y permita que la evidencia las vaya eliminando**.

Ese es el salto entre una IA que comenta métricas y una IA que investiga un negocio.

