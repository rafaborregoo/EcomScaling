# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D9 — ROOT CAUSE & CONSTRAINT ENGINE**

---

# **0\. Propósito de D9**

D8 responde:

> ¿Qué hipótesis explica mejor el patrón observado?

D9 responde:

> **¿Cuál es la causa suficientemente soportada del problema, cuál es el mecanismo intermedio y qué parte del sistema está limitando actualmente el resultado?**

Este bloque debe distinguir explícitamente:

SYMPTOM  
↓  
IMMEDIATE CAUSE  
↓  
ROOT CAUSE  
↓  
UNDERLYING DRIVER

y, por separado:

CURRENT CONSTRAINT

---

# **1\. Distinción fundamental**

Estas cinco cosas no son equivalentes:

SYMPTOM

INTERMEDIATE CAUSE

IMMEDIATE CAUSE

ROOT CAUSE

CONSTRAINT

Confundirlas degrada completamente la calidad del diagnóstico.

---

# **2\. Ejemplo completo**

Observamos:

Revenue ↓

D6 identifica:

Payment-stage conversion deterioration

D8 encuentra como mejor hipótesis:

Payment configuration regression

D9 podría estructurar:

SYMPTOM:  
Payment completion failure

IMMEDIATE CAUSE:  
3DS authentication failures

ROOT CAUSE:  
Incorrect payment configuration deployed on Sep 8

UNDERLYING DRIVER:  
Checkout-critical configuration changes lack pre-production validation

CURRENT CONSTRAINT:  
Payment completion capability

Son niveles distintos.

---

# **3\. Otro ejemplo**

CAC ↑

Síntoma:

Pre-click acquisition deterioration

Immediate cause:

CTR deterioration in mature high-spend creatives

Root cause:

Insufficient creative renewal over six weeks

Underlying driver:

Creative production capacity is below current acquisition requirements

Constraint:

Creative supply / acquisition scalability

---

# **4\. Root Cause Definition**

Una `ROOT_CAUSE` es:

> **La causa más profunda que la evidencia actual permite sostener de forma útil y cuya existencia explica de manera coherente el mecanismo que produjo el problema investigado.**

Importante:

No es necesariamente:

the deepest philosophical explanation possible

Debe ser:

deep enough  
\+  
supported  
\+  
specific  
\+  
diagnostically useful

---

# **5\. Root cause no significa “última causa imaginable”**

Ejemplo absurdo:

Revenue fell  
because  
the company has imperfect processes.

Eso no aporta suficiente utilidad.

Mejor:

Revenue fell because payment completion dropped after a checkout configuration deployment introduced 3DS failures.

---

---

# **9\. CONFIRMED debe ser excepcional**

Ejemplos que justifican alta certeza:

direct error evidence

controlled rollback

A/B experiment

configuration diff

system logs

independent corroboration

---

# **10\. Probable Root Cause**

Muchas investigaciones terminarán correctamente en:

PROBABLE

Ejemplo:

> La causa raíz más probable es un deterioro de renovación creativa.

No necesitamos fingir certeza absoluta.

---

# **11\. Partial Root Cause**

Puede ocurrir:

Cause A explains 55%  
Cause B explains 25%  
20% remains unexplained

Resultado:

PARTIAL\_ROOT\_CAUSE

---

# **12\. No forced closure**

Si la evidencia no permite suficiente discriminación:

ROOT\_CAUSE:  
UNRESOLVED

es una salida válida.

---

---

# **14\. Immediate Cause**

La `IMMEDIATE_CAUSE` es el mecanismo directamente anterior al efecto principal.

Ejemplo:

Payment errors ↑  
→  
Payment success ↓

Immediate cause:

payment authentication errors

---

# **15\. Intermediate Cause**

Puede haber varios niveles:

Creative pipeline ↓  
→  
Creative concentration ↑  
→  
CTR ↓  
→  
CAC ↑

Aquí:

Creative concentration

y:

CTR decline

pueden ser causas intermedias.

---

# **16\. Root Cause**

En ese mismo ejemplo:

insufficient creative production capacity

puede ser root cause.

---

# **17\. Underlying Driver**

El `UNDERLYING_DRIVER` describe una condición todavía más estructural que favorece la recurrencia.

Ejemplo:

No clear ownership of creative production

o:

Inventory planning maturity below business complexity

---

# **18\. Root Cause vs Underlying Driver**

No siempre necesitamos ambos.

Ejemplo simple:

Incorrect Stripe configuration

puede ser suficiente root cause.

Pero en problemas recurrentes puede existir:

UNDERLYING\_DRIVER:  
no deployment validation process

---

# **19\. Root Depth**

Podemos clasificar:

D0 — Outcome

D1 — Surface Driver

D2 — Immediate Cause

D3 — Root Cause

D4 — Structural Driver

---

# **20\. Ejemplo**

D0:  
Revenue ↓

D1:  
CVR ↓

D2:  
Payment completion ↓

D3:  
Payment config regression

D4:  
No checkout deployment validation

---

---

# **22\. Stop Too Early**

Mala root cause:

CAC rose because CTR fell.

Es verdad, pero demasiado superficial.

---

# **23\. Stop Too Late**

Mala root cause:

CAC rose because organizational culture does not prioritize innovation.

Demasiado abstracta salvo evidencia muy fuerte.

---

# **24\. Correct Root Depth**

Ejemplo:

CAC deterioration is primarily driven by high-spend creative assets remaining active beyond their historical response window because creative replacement volume fell materially for six weeks.

Eso es suficientemente profundo y verificable.

---

# **25\. Constraint Definition**

Un `CONSTRAINT` es:

> **La parte del sistema que actualmente limita el resultado, throughput, crecimiento, eficiencia o estabilidad del negocio.**

Pregunta:

> ¿Qué capacidad está poniendo el techo ahora mismo?

---

# **26\. Root Cause ≠ Constraint**

Ejemplo:

Root Cause:  
forecast underestimated demand

Constraint:  
inventory availability

Forecasting causó el problema.

Pero el límite actual es que:

there is no stock

---

# **27\. Otro ejemplo**

Root Cause:  
Creative production dropped

Constraint:  
Creative inventory available for paid scaling

---

# **28\. Otro**

Root Cause:  
Payment config regression

Constraint:  
Checkout payment completion

---

# **29\. Constraint Types**

Como mínimo:

DEMAND\_CONSTRAINT

PRODUCT\_CONSTRAINT

OFFER\_CONSTRAINT

ACQUISITION\_CONSTRAINT

CREATIVE\_CONSTRAINT

CONVERSION\_CONSTRAINT

RETENTION\_CONSTRAINT

INVENTORY\_CONSTRAINT

OPERATIONS\_CONSTRAINT

FINANCIAL\_CONSTRAINT

DATA\_CONSTRAINT

TECHNOLOGY\_CONSTRAINT

TEAM\_CONSTRAINT

STRATEGY\_CONSTRAINT

---

# **30\. Constraint can be healthy-looking upstream**

Ejemplo:

Acquisition:  
healthy

pero:

Inventory:  
insufficient

El constraint del crecimiento puede ser Inventory.

---

# **31\. Constraint can exist without current crisis**

Ejemplo:

Current revenue:  
stable

Warehouse utilization:  
97%

Constraint:

fulfillment capacity

aunque todavía no haya SLA collapse.

---

# **32\. Constraint vs Weakness**

No toda debilidad es constraint.

Ejemplo:

Retention:  
weak

pero si negocio está hoy limitado por falta de stock:

Retention weakness ≠ current constraint

---

# **33\. Constraint vs Priority**

Tampoco:

CONSTRAINT  
≠  
PRIORITY

F4 decidirá prioridad.

---

# **34\. Ejemplo**

Puede existir:

Current Constraint:  
Inventory

y simultáneamente:

Payment outage:  
critical

La prioridad inmediata puede ser Payment aunque Inventory sea el cuello de botella estructural.

---

---

# **36\. Example localized constraint**

US expansion constrained by fulfillment capacity

No significa que toda la empresa esté limitada igual.

---

# **37\. Binding Constraint**

Definimos:

BINDING\_CONSTRAINT

como el límite que actualmente está activo.

---

# **38\. Latent Constraint**

LATENT\_CONSTRAINT

todavía no limita output actual, pero lo hará al siguiente nivel de escala.

---

# **39\. Example**

Current spend:  
€50k/month

Creative capacity:  
sufficient

Pero a:

€100k/month

no habrá suficiente producción.

Resultado:

LATENT\_CONSTRAINT:  
Creative production

---

---

# **41\. Throughput Thinking**

Un ecommerce puede verse como red de flujos:

Demand  
→ Traffic  
→ Conversion  
→ Orders  
→ Fulfillment  
→ Retention  
→ Cash

El constraint es el componente que limita el throughput relevante.

---

# **42\. Constraint may shift**

Cuando se corrige uno:

another constraint may emerge

Ejemplo:

Acquisition fixed  
→ Orders grow  
→ Inventory becomes constraint

---

---

# **45\. Constraint evidence**

Ejemplo:

Inventory Availability

Demand:  
high

Traffic:  
healthy

Conversion on in-stock items:  
healthy

Hero SKU stockout:  
yes

Revenue lost:  
material

Constraint:

Inventory

---

# **46\. Constraint detection by counterfactual**

Pregunta:

> Si incrementáramos input upstream, ¿el sistema podría convertirlo en output?

Ejemplo:

More traffic?

No sirve porque:

stock unavailable

Inventory is binding.

---

# **47\. Another**

More ad spend?

No sirve si:

no creative capacity

Creative may constrain scalable acquisition.

---

# **48\. Another**

More demand?

No sirve si:

warehouse cannot fulfill

Operations constraint.

---

# **49\. Constraint Signals**

Indicadores:

capacity saturation

queue/backlog

resource scarcity

stock shortage

marginal efficiency collapse

dependency bottleneck

hard guardrail breach

---

# **50\. Hard Constraint**

Ejemplo:

zero stock

No se puede vender el producto.

---

# **51\. Soft Constraint**

Ejemplo:

CAC increases rapidly beyond current spend

Scaling becomes unattractive rather than impossible.

---

---

# **54\. Constraint and Maturity**

D3 puede detectar:

Maturity gap

D9 puede determinar si ese gap está actuando hoy como:

CONSTRAINT

---

# **55\. Example**

Finance maturity:

E3 required E7

Eso es gap.

Si decisiones de scaling están bloqueadas porque no existe contribution por canal:

Finance / measurement

puede ser constraint.

---

# **56\. Structural Constraint**

Ejemplo:

Creative production capacity below acquisition needs

---

# **57\. Acute Constraint**

Ejemplo:

Payment provider unavailable

---

# **58\. Acute vs Structural Constraint**

Una empresa puede tener ambos.

ACUTE:  
checkout payment

STRUCTURAL:  
inventory planning

---

# **59\. Root Cause Families**

D9 debe poder clasificar causas raíz en familias.

MARKET

PRODUCT

OFFER

ECONOMICS

ACQUISITION

CREATIVE

CONVERSION

RETENTION

INVENTORY

OPERATIONS

FINANCE

DATA

TECHNOLOGY

TEAM

STRATEGY

EXTERNAL

---

# **60\. Root Cause Type**

Además:

ACUTE

CHRONIC

STRUCTURAL

EVENT\_DRIVEN

PROCESS

CAPACITY

CONFIGURATION

QUALITY

PLANNING

DEPENDENCY

EXTERNAL

---

# **61\. Acute Root Cause**

Checkout configuration regression

---

# **62\. Chronic Root Cause**

Creative renewal systematically below consumption rate

---

# **63\. Structural Root Cause**

Inventory planning capability below business complexity

---

# **64\. Event-driven Root Cause**

Carrier strike

---

# **65\. Process Root Cause**

No QA before checkout deployments

---

# **66\. Capacity Root Cause**

Warehouse capacity insufficient for current order volume

---

# **67\. Dependency Root Cause**

Single supplier failure

---

# **68\. Root Cause Evidence Hierarchy**

Más fuerte:

DIRECT SYSTEM EVIDENCE

INTERVENTION

CONTROL COMPARISON

MULTI-SOURCE CORROBORATION

TEMPORAL \+ MECHANISTIC FIT

PATTERN MATCH

HEURISTIC ONLY

---

# **69\. Root Cause Confidence**

D9 debe heredar y recalibrar confidence desde D8.

---

# **70\. Confidence HIGH**

Normalmente requiere:

strong supported chain

few serious alternatives

good scope/time/magnitude fit

high-quality evidence

successful falsification pass

---

# **71\. Confidence MEDIUM**

best explanation

but important evidence gap remains

---

# **72\. Confidence LOW**

plausible root cause

not sufficiently discriminated

---

# **73\. INSUFFICIENT**

cannot establish root cause

---

---

# **76\. Example**

ROOT:  
Creative production slowdown

↓ MEDIUM\_HIGH

Creative renewal deficit

↓ HIGH

Creative concentration

↓ HIGH

CTR deterioration

↓ HIGH

CPC increase

↓ HIGH

CAC increase

Overall:

MEDIUM\_HIGH

---

# **77\. Root Cause vs Correlation Trap**

Ejemplo:

Creative launches ↓  
CAC ↑

No basta.

Necesitamos camino:

launches ↓  
→ renewal ↓  
→ response ↓  
→ CTR ↓  
→ CPC ↑  
→ CAC ↑

y evidencia compatible.

---

# **78\. Five Whys caution**

El método de preguntar "por qué" repetidamente puede ser útil.

Pero no debe utilizarse mecánicamente.

---

# **79\. Problem with naive Five Whys**

Puede acabar:

Because management failed

sin evidencia.

---

# **80\. Evidence-guided depth**

D9 debería preguntar:

WHY?

solo cuando existe:

valid upstream causal branch

---

---

# **82\. Primary Root Cause**

La que explica mayor parte del fenómeno actual.

---

# **83\. Secondary Root Cause**

Otra causa real con contribución material.

---

# **84\. Contributing Cause**

Contribuye pero no domina.

---

# **85\. Example**

Contribution decline:

Primary:  
Discount pressure

Secondary:  
CAC inflation

Contributing:  
Shipping subsidy

---

---

# **92\. Example**

Payment issue:

Root cause explains virtually all observed decline

`COMPLETE_ENOUGH`.

---

# **93\. Another**

Revenue down \-25%.

Stockout likely explains only 8%.

MATERIAL\_RESIDUAL

seguir investigando.

---

# **94\. Root Cause and Recurrence**

Si una causa explica múltiples casos repetidos:

STRUCTURAL\_DRIVER

gana importancia.

---

# **95\. Example**

Tres stockouts distintos.

Cada uno:

Immediate cause:  
under-ordering

Patrón común:

Underlying driver:  
forecasting process does not account for promotion uplift

---

# **96\. Recurring Root Cause**

Puede existir:

RECURRING\_ROOT\_CAUSE

---

# **97\. Systemic Root Cause**

Cuando afecta múltiples capacidades.

Ejemplo:

Data ownership absent

puede producir:

tracking inconsistencies  
financial metric conflicts  
poor attribution

---

# **98\. Systemic root causes require stronger evidence**

Porque son claims amplios.

---

# **99\. Root Cause Scope**

Nunca:

The business has poor operations

si evidencia solo afecta:

return processing in Spain

---

# **100\. Scope precision**

Ideal:

Return processing capacity in the Spanish warehouse is below current weekly return volume.

---

---

# **104\. Resolved Root Cause**

Problema puede haber desaparecido, pero caso sigue registrado.

---

# **105\. Root Cause Recovery**

D13 analizará evolución temporal.

Pero D9 debe saber si causa sigue activa.

---

# **106\. Root Cause Validation by intervention**

Si corregir la causa:

removes symptom

confianza aumenta.

---

# **107\. But avoid post hoc fallacy**

Si muchas cosas cambian al mismo tiempo, no sabemos cuál fue responsable.

---

# **108\. Intervention Isolation**

Debe registrar:

what else changed?

---

# **109\. Control comparison**

Ejemplo:

Only Mastercard failed.

Visa remained stable.

Esto ayuda a localizar root cause.

---

---

# **113\. Constraint target-dependent**

Muy importante.

Constraint depende de:

what output are we trying to explain or grow?

---

# **114\. Example**

Para:

Revenue growth

constraint puede ser:

Inventory

Para:

Profitability

constraint puede ser:

CAC

Para:

Cash

constraint puede ser:

Working capital

---

# **115\. No universal constraint**

El negocio puede tener varios constraints según objetivo.

---

---

# **118\. Primary Constraint**

El que más limita target actual.

---

# **119\. Secondary Constraint**

Será relevante si se elimina el primero.

---

# **120\. Latent Constraint**

Probablemente se convertirá en binding al escalar.

---

# **121\. Example**

Primary:  
Inventory availability

Secondary:  
Warehouse capacity

Latent:  
Creative production

---

# **122\. Constraint Sequence**

Esto será muy valioso para F4/F5 más adelante.

Pero D9 solo identifica.

---

# **123\. Constraint and capacity utilization**

Ejemplo:

Warehouse utilization:  
98%

puede ser candidato.

Pero si order demand está cayendo:

not necessarily current revenue constraint

---

# **124\. Constraint must bind output**

Debe demostrarse relación:

more upstream input  
cannot produce more output  
because of this node

---

# **125\. Constraint Counterfactual**

Pregunta:

> Si esta restricción desapareciera manteniendo el resto igual, ¿podría mejorar materialmente el target?

Si no:

probably not the binding constraint

---

# **126\. Example**

Improving email opens 5% no desbloquea revenue si:

hero product out of stock

---

---

# **128\. Economic Constraint**

Ejemplo:

CAC exceeds sustainable level

Puede limitar paid scaling.

---

# **129\. Cash Constraint**

Demand exists  
economics positive  
but cash unavailable for inventory purchase

Current constraint:

working capital

---

# **130\. Demand Constraint**

Inventory healthy  
Conversion healthy  
Operations healthy  
but traffic/demand insufficient

Constraint:

demand generation

---

# **131\. Offer Constraint**

Traffic available  
Product available  
but offer response poor

---

# **132\. Creative Constraint**

Spend scaling possible  
but no sufficient winning creatives

---

# **133\. Conversion Constraint**

Traffic abundant  
but site cannot convert

---

# **134\. Retention Constraint**

Puede limitar:

LTV  
CAC tolerance  
profit growth

aunque first-order revenue crezca.

---

# **135\. Inventory Constraint**

Demand \> available supply

---

# **136\. Operations Constraint**

Order capacity \< demand

---

# **137\. Finance Constraint**

Cash prevents economically attractive growth

---

# **138\. Data Constraint**

Ejemplo:

company cannot confidently allocate spend because attribution and contribution data are unreliable

El constraint no es directamente ventas.

Es:

decision quality

---

# **139\. Team Constraint**

execution queue grows because one specialist is bottleneck

---

# **140\. Strategy Constraint**

Puede existir cuando:

resources fragmented across too many priorities

limita progreso.

Pero necesita evidencia.

---

# **141\. Constraint vs Capacity**

Una capacidad baja no es automáticamente constraint.

Debe estar:

binding

---

---

# **145\. Constraint Shift Example**

Semana 1:

Creative

Después se producen assets.

Semana 2:

Inventory

porque ventas escalan.

---

---

# **147\. Constraint Migration Learning**

F9 podrá aprender:

what constraint usually appears next

para cada tenant.

---

# **148\. Root Cause vs Constraint Matrix**

## **Caso 1**

ROOT CAUSE:  
payment config regression

CONSTRAINT:  
payment completion

---

# **149\. Caso 2**

ROOT CAUSE:  
underforecasting

CONSTRAINT:  
inventory availability

---

# **150\. Caso 3**

ROOT CAUSE:  
creative pipeline undercapacity

CONSTRAINT:  
creative supply

---

# **151\. Caso 4**

ROOT CAUSE:  
traffic mix shifted toward low-intent acquisition

CONSTRAINT:  
conversion quality of incremental traffic

---

# **152\. Caso 5**

ROOT CAUSE:  
inventory purchases absorbed cash

CONSTRAINT:  
working capital

---

# **153\. Root Cause can disappear while constraint remains**

Ejemplo:

Supplier delay resolved.

Pero stock todavía no llegará en 30 días.

Root cause:  
resolved

Constraint:  
still active

---

# **154\. Constraint can disappear before root cause is structurally solved**

Ejemplo:

Emergency stock arrives.

Inventory constraint:  
resolved

pero:

forecasting weakness:  
still active root structural driver

---

# **155\. Very important distinction**

D9 debe poder decir ambas cosas.

---

# **156\. Acute Recovery vs Structural Risk**

Ejemplo:

Current checkout restored

pero:

deployment process still lacks QA

Resultado:

Acute root cause:  
resolved

Underlying structural driver:  
active

---

# **157\. Root Cause Chains**

Puede haber:

ROOT\_CAUSE\_CHAIN

Ejemplo:

No promo-adjusted forecast  
→ PO too small  
→ Hero SKU stockout  
→ PDP conversion decline  
→ CAC increase  
→ Revenue decline

---

# **158\. Chain Roles**

STRUCTURAL\_DRIVER

ROOT\_CAUSE

IMMEDIATE\_CAUSE

SYMPTOM

OUTCOME

---

# **159\. Example roles**

STRUCTURAL\_DRIVER:  
Forecasting capability below required maturity

ROOT\_CAUSE:  
Promo demand excluded from forecast

IMMEDIATE\_CAUSE:  
PO volume insufficient

SYMPTOM:  
Hero SKU stockout

OUTCOME:  
Revenue decline

---

# **160\. Root Cause Synthesis**

D9 debe producir una narrativa compacta:

> La caída de revenue está causada principalmente por falta de disponibilidad del hero SKU. El stockout se produjo porque el pedido de reposición quedó por debajo de la demanda real tras no incorporar el uplift promocional al forecast. En este momento, el constraint operativo es la disponibilidad de inventario; el driver estructural subyacente es la insuficiente madurez del proceso de forecasting para el nivel actual de escala.

Esto sí es diagnóstico.

---

# **161\. Causal Language Calibration**

HIGH confidence:

> La evidencia indica que...

MEDIUM:

> La causa más probable es...

LOW:

> Existe una explicación plausible...

INSUFFICIENT:

> No puede establecerse todavía una causa raíz.

---

# **162\. No exaggerated causal language**

Evitar:

definitively caused by

si no existe evidencia apropiada.

---

---

# **166\. Example**

Acquisition Agent:

CAC deterioration due to CVR decline

Conversion Agent:

CVR decline due to stock availability

Inventory Agent:

Stock availability due to supplier delay

Orchestrator:

Root cause:  
supplier delay

Immediate constraint:  
inventory availability

Downstream effect:  
conversion / CAC

---

# **167\. This is the value of shared causal contracts**

Sin contrato común, agents se quedarían cada uno en su silo.

---

---

# **169\. Canonical Cause Codes**

Ejemplos:

PAYMENT\_CONFIG\_REGRESSION

HERO\_SKU\_STOCKOUT

FORECAST\_UNDERESTIMATION

CREATIVE\_PIPELINE\_CAPACITY\_SHORTFALL

AUDIENCE\_SATURATION

PRICE\_RESISTANCE

FULFILLMENT\_CAPACITY\_SATURATION

TRACKING\_REGRESSION

WORKING\_CAPITAL\_SHORTFALL

---

---

# **173\. Example**

CONSTRAINT:  
INVENTORY\_AVAILABILITY

Binding if:  
demand available  
conversion on available SKUs healthy  
stock availability limits order potential

---

# **174\. Another**

CONSTRAINT:  
CREATIVE\_SUPPLY

Binding if:  
media budget available  
economics allow scaling  
new winning creative inventory insufficient  
marginal efficiency constrained by asset supply

---

# **175\. Constraint Tests**

D9 puede generar pruebas diagnósticas.

Ejemplo:

Is demand materially higher on in-stock hero products than sellable supply?

---

# **176\. Constraint Falsification**

Pregunta:

> ¿Qué evidencia demostraría que esta capacidad NO es el constraint?

---

# **177\. Example**

Candidate:

Inventory

Falsifier:

in-stock products also show same conversion collapse

Entonces Inventory quizá no sea constraint principal.

---

# **178\. Another**

Candidate:

Creative supply

Falsifier:

large inventory of new high-performing assets exists

---

# **179\. Constraint Counterfactual**

Idealmente:

Remove constraint  
→ estimate potential unlocked throughput

Pero cuantificación avanzada puede quedar para F4/F6.

---

---

# **186\. Root Cause Example — Creative**

Input:

CAC \+26%  
CTR \-22%  
CPM stable  
CVR stable

Creative:

new launches \-60%  
old asset spend share \+40%  
old CTR deteriorated  
new CTR healthy

D8:

Creative fatigue supported

D9:

IMMEDIATE CAUSE:  
CTR deterioration on mature assets

ROOT CAUSE:  
Insufficient creative replacement during previous six weeks

UNDERLYING DRIVER:  
Creative production capacity below current acquisition consumption rate

CONSTRAINT:  
Creative supply for paid acquisition scaling

CONFIDENCE:  
MEDIUM\_HIGH

---

# **187\. Root Cause Example — Inventory**

Input:

Revenue \-18%  
CVR \-20%  
Traffic stable  
AOV stable  
Hero SKU unavailable

Investigación:

forecast missed promo uplift  
PO too small

D9:

IMMEDIATE CAUSE:  
Hero SKU stockout

ROOT CAUSE:  
Under-ordering caused by forecast excluding promotional demand uplift

UNDERLYING DRIVER:  
Inventory planning capability below current commercial complexity

CONSTRAINT:  
Inventory availability

CONFIDENCE:  
HIGH

---

# **188\. Root Cause Example — Data**

Input:

Meta purchases \-50%  
GA purchases \-45%  
Shopify stable  
Stripe stable

Tracking change:

same onset

D9:

ROOT CAUSE:  
Purchase tracking regression

CONSTRAINT:  
Reliable acquisition observability

BUSINESS PERFORMANCE ROOT CAUSE:  
NOT ESTABLISHED

CONFIDENCE:  
HIGH

Muy importante:

No diagnosticar negocio cuando el problema es medición.

---

# **189\. Root Cause Example — Finance**

Input:

Revenue \+30%  
Contribution stable  
Cash \-35%  
Inventory \+80%

D9:

IMMEDIATE CAUSE:  
Cash absorbed by inventory build

ROOT CAUSE:  
Inventory purchases materially exceeded current cash generation

CONSTRAINT:  
Working capital

UNDERLYING DRIVER:  
Growth/inventory planning not aligned with cash capacity

CONFIDENCE:  
HIGH

---

# **190\. Root Cause Example — Operations**

Orders \+50%  
Dispatch time \+90%  
Backlog \+180%  
Errors \+40%

Capacity:

unchanged

D9:

ROOT CAUSE:  
Fulfillment demand exceeded current warehouse processing capacity

CONSTRAINT:  
Warehouse throughput

CONFIDENCE:  
HIGH

---

# **191\. Root Cause Example — Retention**

Repeat ↓  
Product reviews stable  
Shipping stable  
CRM stable  
recent paid cohorts weaker

D9:

ROOT CAUSE:  
Customer mix shifted toward lower-retention acquisition cohorts

CONSTRAINT:  
Customer quality / economics of incremental acquisition

CONFIDENCE:  
MEDIUM\_HIGH

No:

Retention team failure

---

# **192\. Root Cause Example — Offer**

Full-price CVR ↓  
Promo CVR stable  
Promo share ↑  
Discount depth ↑

D9:

ROOT CAUSE:  
Full-price offer response has deteriorated relative to promotional response

UNDERLYING DRIVER:  
Possible value-perception gap

CONSTRAINT:  
Full-price offer attractiveness

CONFIDENCE:  
MEDIUM

Cuidado:

`value-perception gap` quizá siga siendo hypothesis si falta evidencia cualitativa.

---

# **193\. Root Cause Example — Technology**

Safari CVR \-40%  
Chrome stable  
Deployment 20 min before onset  
JS error only Safari

D9:

IMMEDIATE CAUSE:  
Safari checkout JavaScript failure

ROOT CAUSE:  
Checkout deployment introduced browser-specific incompatibility

CONSTRAINT:  
Safari checkout functionality

CONFIDENCE:  
HIGH

---

# **194\. Root Cause Example — External**

CPM \+40%  
CTR stable  
CVR stable  
market-wide auction pressure confirmed

D9:

ROOT CAUSE:  
External media auction cost inflation

CONSTRAINT:  
Paid acquisition economics

CONFIDENCE:  
MEDIUM\_HIGH

---

# **195\. Root Cause could be external and uncontrollable**

No significa que diagnosis falle.

---

# **196\. Controllability**

D9 puede registrar:

CONTROLLABLE

PARTIALLY\_CONTROLLABLE

EXTERNAL

No para recomendar.

Sino para describir naturaleza de causa.

---

# **197\. Root Cause Controllability**

Ejemplo:

Competitor price war:  
EXTERNAL/PARTIAL

Tracking configuration:  
CONTROLLABLE

---

# **198\. Reversibility**

Puede registrar:

EASILY\_REVERSIBLE

REVERSIBLE

DIFFICULT

UNKNOWN

D10 usará esta dimensión para severidad.

---

# **199\. Root Cause Propagation**

Puede almacenar:

downstream\_capabilities

---

# **200\. Example**

Inventory shortage

afecta:

Conversion  
Acquisition  
Revenue  
Finance

---

# **201\. Constraint Blast Radius**

Igual.

---

---

# **205\. Root Cause Narrative**

Formato humano:

WHAT:  
Revenue declined 18%.

SYMPTOM:  
Payment-stage conversion failure.

IMMEDIATE CAUSE:  
3DS authentication errors.

ROOT CAUSE:  
Invalid payment configuration deployed Sep 8\.

UNDERLYING DRIVER:  
Checkout configuration changes lack validation.

CURRENT CONSTRAINT:  
Payment completion.

CONFIDENCE:  
High.

---

# **206\. This is much stronger than generic analysis**

---

# **207\. Root Cause Conflict Resolution Rules**

Cuando varios candidates:

prefer  
higher evidence quality  
better scope fit  
better time fit  
greater explanatory coverage  
fewer unsupported assumptions

---

# **208\. But do not always choose one**

Si dos causas materialmente contribuyen:

MULTICAUSAL

---

# **209\. Constraint Conflict**

Puede parecer que varias capacidades limitan.

---

# **210\. Binding Test**

La pregunta principal:

Which one currently prevents additional target output first?

---

# **211\. Serial Constraints**

En sistemas secuenciales:

Demand  
→ Inventory  
→ Fulfillment

el primer binding constraint puede dominar.

---

# **212\. Parallel Constraints**

Puede haber:

US:  
Inventory

EU:  
Acquisition

simultáneamente.

---

# **213\. Scoped constraints**

D9 debe permitir múltiples por scope.

---

# **214\. Global Constraint Synthesis**

No generalizar si business es heterogéneo.

---

# **215\. Constraint and Marginal Analysis**

Muy útil en scaling.

Ejemplo:

Spend ↑  
Marginal CAC ↑ sharply  
Creative winner inventory ↓

Puede señalar:

Creative/Acquisition constraint

---

# **216\. Demand-Supply Framing**

Muchas capacidades pueden modelarse como:

DEMAND ON CAPABILITY  
vs  
AVAILABLE CAPACITY

---

# **217\. Example Creative**

creative consumption rate  
\>  
creative production rate

---

# **218\. Example Operations**

orders/hour  
\>  
warehouse capacity/hour

---

# **219\. Example Inventory**

demand velocity  
\>  
available inventory replenishment

---

# **220\. Example Team**

work arrival rate  
\>  
execution capacity

---

# **221\. Constraint Queue**

Donde existe queue:

backlog

es evidencia fuerte.

---

# **222\. Constraint without queue**

Inventory stockout no necesita queue para ser binding.

---

# **223\. Economic Constraint**

Puede observarse en:

marginal return curve

---

# **224\. Constraint Registry should be business-model aware**

Subscription business:

billing  
retention

pueden ser critical constraints.

DTC physical:

inventory  
fulfillment

más relevantes.

---

# **225\. Maturity-aware Constraint**

Una capability puede ser constraint porque:

its maturity no longer supports current complexity

---

# **226\. Structural bottleneck**

Definición:

STRUCTURAL\_BOTTLENECK

cuando el constraint procede de gap persistente de madurez.

---

# **227\. Temporary bottleneck**

Ejemplo:

carrier outage

---

# **228\. Bottleneck vs Constraint terminology**

Podemos usar:

CONSTRAINT

como término canónico.

`Bottleneck` como representación humana cuando corresponda.

---

# **229\. Constraint does not imply bad team**

Evitar culpabilización antropomórfica.

---

# **230\. System-level diagnosis**

Describir procesos y capacidades.

No personas salvo evidencia imprescindible.

---

# **231\. Root Cause Blame Avoidance**

Ejemplo malo:

The media buyer caused the issue.

Mejor:

Budget was increased 120% without corresponding creative supply, producing concentration and marginal CAC deterioration.

---

# **232\. Human error**

Puede existir.

Pero debería especificarse como:

configuration entered incorrectly

más que juicio personal.

---

# **233\. Process vs Person**

Si mismo error podría repetirse:

underlying process weakness

puede ser más útil.

---

# **234\. But do not invent process failure**

Solo si evidencia.

---

# **235\. Root Cause Recurrence Check**

Antes de cerrar:

Has this root cause appeared before?

---

# **236\. If yes**

Registrar:

RECURRENT

---

# **237\. Recurrence strengthens structural-driver investigation**

---

# **238\. Root Cause Contradiction Check**

Antes de cerrar:

What evidence would make this cause impossible?

---

---

# **243\. Root Cause Unknown \+ Constraint Known**

Es posible.

Ejemplo:

Constraint:  
Inventory availability

Why inventory became unavailable:  
unclear

---

# **244\. Constraint Unknown \+ Root Cause Known**

También.

Ejemplo:

Root cause:  
tracking regression

Pero no existe business constraint porque solo medición está afectada.

---

# **245\. No constraint necessary**

Algunos diagnostic cases no necesitan constraint.

Ejemplo:

isolated reporting bug

Puede afectar observability, pero no throughput business.

---

---

# **247\. Root Cause Applicability**

Un surface observation puede no necesitar root cause aún.

---

# **248\. Example Positive Diagnosis**

D9 también puede analizar mejora.

CAC improved

Root driver:

new creative concept improved CTR

Constraint removed:

creative response

---

# **249\. Positive causal chains**

Deben preservarse para aprendizaje.

---

# **250\. Example**

New bundle  
→ AOV ↑  
→ contribution ↑

Root positive driver:

bundle adoption

---

# **251\. Opportunity vs Root Cause**

Una oportunidad no necesita root cause.

Pero una mejora observada sí puede tener positive driver.

---

# **252\. Root Cause Type Positive**

Puede existir:

POSITIVE\_DRIVER

para learning.

---

---

---

---

1. 

---

---

# **287\. RAG Structure**

Chunks recomendados:

root\_cause\_definition

immediate\_vs\_root\_cause

underlying\_driver

root\_depth

root\_cause\_validation

multicausal\_root\_causes

partial\_root\_cause

constraint\_definition

binding\_constraint

latent\_constraint

constraint\_shift

root\_cause\_vs\_constraint

root\_cause\_invariants

Metadata:

phase:  
F3

block:  
D9

domain:  
root\_cause\_constraint

knowledge\_type:  
causal\_diagnosis

---

---

# **289\. Example Admin Trace**

TARGET:  
Revenue \-19%

SYMPTOM:  
Payment-stage deterioration

IMMEDIATE CAUSE:  
3DS failures

ROOT CAUSE:  
Checkout payment configuration regression

UNDERLYING DRIVER:  
No validation of critical config changes

CONSTRAINT:  
Payment completion

ROOT CONFIDENCE:  
HIGH

CONSTRAINT CONFIDENCE:  
HIGH

COVERAGE:  
Nearly complete

RESIDUAL:  
Low

---

# **290\. User-facing synthesis**

> La caída de revenue se origina en la última etapa del checkout, no en tráfico ni en intención de compra. Los fallos de autenticación 3DS comenzaron inmediatamente después del cambio de configuración y explican la reducción de pagos completados. La causa raíz está suficientemente soportada como una regresión de configuración de pagos. En este momento, el constraint del sistema es la capacidad de completar pagos; el resto del funnel permanece esencialmente sano.

Ese es D9.

---

# **291\. Another user-facing synthesis**

> El incremento de CAC no nace principalmente en Meta ni en la conversión de la tienda. El deterioro observable está en el CTR de los assets antiguos. La evidencia apunta a que la renovación creativa se ha quedado por debajo del ritmo de consumo del canal durante las últimas seis semanas. La causa raíz más probable es un déficit sostenido de renovación creativa y el constraint actual para seguir escalando adquisición es la disponibilidad de nuevos assets capaces de absorber inversión eficientemente.

---

---

# **293\. Arquitectura acumulada**

Ya tenemos:

D1  
¿Puedo creer los datos?

D2  
¿Qué significan en contexto?

D3  
¿Qué madurez tiene el negocio?

D4  
¿Qué partes están sanas o enfermas?

D5  
¿Qué está cambiando?

D6  
¿Qué patrón forman esos cambios?

D7  
¿Qué mecanismos pueden explicarlo?

D8  
¿Qué hipótesis compiten?

D9  
¿Cuál es la causa raíz y cuál es el constraint actual?

Lo siguiente es:

# **D10 — SEVERIDAD E IMPACTO**

Y aquí añadiremos otra distinción crítica:

CAUSE  
≠  
SEVERITY  
≠  
PRIORITY

Una causa puede estar perfectamente confirmada y tener poco impacto.

Otra puede tener confidence media, pero estar afectando el 80% del revenue y representar riesgo de continuidad.

D10 deberá medir daño en:

Revenue  
Contribution  
Cash  
Customer Experience  
Operations  
Brand  
Business Continuity

además de:

blast radius  
duration  
propagation risk  
reversibility

sin decidir todavía qué atacar primero.

---

# **294\. Principio final**

Un diagnóstico mediocre termina cuando encuentra algo que “parece la causa”.

Un sistema serio debe poder decir:

Esto es el síntoma.

Este es el mecanismo inmediato.

Esta es la causa raíz que la evidencia permite sostener.

Este es el driver estructural que favorece su recurrencia.

Y esta es la parte del sistema que actualmente está limitando el resultado.

Solo después estamos preparados para preguntar:

> **¿Cuánto daño está causando realmente?**

Ese será D10.

