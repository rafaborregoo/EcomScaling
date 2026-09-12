# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D6 — MOTOR DE SÍNTOMAS**

---

# **0\. Propósito de D6**

D5 responde:

> ¿Qué señales relevantes están ocurriendo?

D6 responde:

> **¿Qué patrón empresarial forman esas señales cuando se observan juntas?**

Ejemplo:

CTR ↓  
CPC ↑  
CPM →  
CVR →  
Creative concentration ↑

D5 detecta cinco señales.

D6 debe ser capaz de construir:

SYMPTOM:  
Deterioro de eficiencia pre-click.

Y quizá:

POSSIBLE INTERPRETATION:  
Pattern compatible with creative deterioration.

Pero todavía no puede afirmar:

ROOT CAUSE:  
Creative fatigue.

Eso llegará después.

---

# **1\. Principio fundamental**

Debemos preservar esta cadena:

OBSERVATION  
    ↓  
SIGNAL  
    ↓  
SYMPTOM  
    ↓  
HYPOTHESIS  
    ↓  
CAUSE

Un síntoma:

> describe un patrón observable.

Una hipótesis:

> propone una explicación.

Una causa:

> explica suficientemente el mecanismo.

---

# **2\. Ejemplo médico aplicado al ecommerce**

Fiebre  
\+  
tos  
\+  
fatiga

forman un patrón sintomático.

No demuestran automáticamente una enfermedad concreta.

En ecommerce:

CTR ↓  
CPC ↑  
CAC ↑  
CVR →

forma un patrón.

Pero puede explicarse por:

creative deterioration  
auction pressure  
audience saturation  
channel mix change  
measurement issue

D6 identifica el patrón.

D8 generará las explicaciones.

---

# **4\. Qué convierte varias señales en un síntoma**

No basta con que ocurran simultáneamente.

Debe existir alguna relación:

temporal  
functional  
mathematical  
funnel  
economic  
operational  
causal-plausibility

Ejemplo:

CTR ↓  
CPC ↑

tienen relación matemática y funcional.

Pero:

CTR ↓  
Warehouse electricity cost ↑

probablemente no deben formar un mismo síntoma.

---

# **5\. Signal Cluster → Symptom**

D5 puede producir:

SIGNAL\_CLUSTER

D6 lo interpreta como:

BUSINESS\_PATTERN

y si cumple reglas:

SYMPTOM

---

# **6\. Un síntoma necesita coherencia**

Debe existir:

PATTERN\_COHERENCE

que considere:

same time window  
same business scope  
compatible direction  
known relationship  
sufficient signal quality

---

# **7\. Ejemplo coherente**

CTR \-22%  
CPC \+27%  
CPM \+2%  
CVR \+1%

Patrón:

PRE\_CLICK\_EFFICIENCY\_DETERIORATION

---

# **8\. Ejemplo incoherente**

CTR \-22%  
CPC \-10%  
CPM \-40%  
CVR stable

No deberíamos generar automáticamente el mismo síntoma.

Aunque CTR baja, el coste de tráfico mejora.

---

# **9\. Síntoma no significa necesariamente problema**

Puede haber síntomas:

NEGATIVE  
POSITIVE  
NEUTRAL  
MIXED

Ejemplo:

CAC ↓  
CVR ↑  
AOV ↑  
Contribution ↑

puede formar:

SYMPTOM:  
Broad commercial efficiency improvement.

---

# **10\. Familias principales de síntomas**

El motor debería soportar al menos:

ACQUISITION\_SYMPTOM  
CREATIVE\_SYMPTOM  
CONVERSION\_SYMPTOM  
OFFER\_SYMPTOM  
PRODUCT\_SYMPTOM  
RETENTION\_SYMPTOM  
INVENTORY\_SYMPTOM  
OPERATIONS\_SYMPTOM  
FINANCIAL\_SYMPTOM  
DATA\_SYMPTOM  
TECHNOLOGY\_SYMPTOM  
TEAM\_SYMPTOM  
STRATEGY\_SYMPTOM  
CROSS\_CAPABILITY\_SYMPTOM

---

# **11\. Síntomas de adquisición**

Ejemplos:

PRE\_CLICK\_EFFICIENCY\_DETERIORATION

POST\_CLICK\_EFFICIENCY\_DETERIORATION

PAID\_ACQUISITION\_COST\_INFLATION

SCALING\_EFFICIENCY\_COMPRESSION

AUDIENCE\_RESPONSE\_WEAKENING

CHANNEL\_DEPENDENCY\_INCREASE

NEW\_CUSTOMER\_VOLUME\_WEAKNESS

---

# **12\. Pre-click deterioration**

Patrón típico:

CTR ↓  
CPC ↑  
CPM stable  
CVR stable

Síntoma:

PRE\_CLICK\_EFFICIENCY\_DETERIORATION

Interpretación prudente:

> El deterioro parece concentrarse antes de que el usuario llegue a la tienda.

No:

> Las creatividades están fatigadas.

---

# **13\. Post-click deterioration**

Patrón:

CTR stable  
CPC stable  
CVR ↓  
CAC ↑

Síntoma:

POST\_CLICK\_EFFICIENCY\_DETERIORATION

Esto concentra investigación en:

offer  
product  
PDP  
checkout  
inventory  
traffic quality

---

# **14\. Auction pressure symptom**

Patrón:

CPM ↑  
CTR stable  
CVR stable  
CAC ↑

Síntoma:

MEDIA\_COST\_PRESSURE

No sabemos todavía si se debe a:

seasonality  
competition  
audience saturation  
platform dynamics

---

# **15\. Scaling compression symptom**

Patrón:

Spend ↑↑  
Customers ↑  
CAC ↑ moderately  
Marginal CAC ↑↑  
Contribution still positive

Síntoma:

SCALING\_EFFICIENCY\_COMPRESSION

No necesariamente representa fallo.

Puede ser respuesta natural de la curva de rendimiento.

---

# **16\. Síntomas creativos**

Ejemplos:

CREATIVE\_RESPONSE\_DERIORATION

CREATIVE\_CONCENTRATION

CREATIVE\_PIPELINE\_WEAKNESS

CREATIVE\_RENEWAL\_DEFICIT

CREATIVE\_WINNER\_SCARCITY

---

# **17\. Creative response deterioration**

Patrón:

CTR ↓  
Hook rate ↓  
Thumbstop ↓  
CPM stable  
CVR stable

Síntoma:

CREATIVE\_RESPONSE\_DERIORATION

---

# **18\. Creative concentration**

Top 2 creatives spend share ↑  
Creative diversity ↓  
New winner count ↓

Síntoma:

CREATIVE\_CONCENTRATION

Esto puede existir aunque CAC todavía sea sano.

---

# **19\. Creative pipeline weakness**

New launches ↓  
Testing volume ↓  
Concept diversity ↓  
Winner replacement rate ↓

Síntoma:

CREATIVE\_PIPELINE\_WEAKNESS

Es especialmente importante como síntoma adelantado.

---

# **20\. Síntomas de conversión**

Ejemplos:

PDP\_ENGAGEMENT\_WEAKNESS

ATC\_FRICTION

CHECKOUT\_FRICTION

PAYMENT\_COMPLETION\_FAILURE

MOBILE\_CONVERSION\_REGRESSION

BROWSER\_SPECIFIC\_REGRESSION

FUNNEL\_WIDE\_DERIORATION

---

# **21\. PDP weakness**

Patrón:

PDP views stable  
ATC rate ↓  
Checkout downstream proportional

Síntoma:

PDP\_TO\_CART\_WEAKNESS

Posibles explicaciones posteriores:

product  
price  
offer  
stock  
PDP UX  
traffic quality

---

# **22\. Checkout friction**

Patrón:

ATC stable  
Checkout initiation ↓

Síntoma:

CART\_TO\_CHECKOUT\_FRICTION

---

# **23\. Payment completion failure**

Patrón:

Checkout initiation stable  
Payment success ↓  
Payment errors ↑  
Orders ↓

Síntoma:

PAYMENT\_COMPLETION\_FAILURE

Mucho más específico que:

conversion down

---

# **24\. Funnel-wide deterioration**

Puede ocurrir:

PDP engagement ↓  
ATC ↓  
Checkout ↓  
Payment ↓

Síntoma:

BROAD\_FUNNEL\_DETERIORATION

Esto sugiere un fenómeno upstream o de tráfico/oferta más amplio.

---

# **25\. Localized regression**

Ejemplo:

Global CVR stable  
Safari CVR ↓↓↓  
Chrome stable  
Desktop stable

Síntoma:

SAFARI\_CONVERSION\_REGRESSION

No:

GLOBAL\_CONVERSION\_FAILURE

---

# **26\. Síntomas de oferta**

Ejemplos:

DISCOUNT\_DEPENDENCY

FULL\_PRICE\_RESISTANCE

OFFER\_RESPONSE\_WEAKNESS

PRICE\_ELASTICITY\_PRESSURE

BUNDLE\_RESPONSE\_DECLINE

---

# **27\. Discount dependency**

Patrón:

Promo CVR healthy  
Full-price CVR ↓  
Promo revenue share ↑  
Discount depth ↑  
Margin ↓

Síntoma:

DISCOUNT\_DEPENDENCY

---

# **28\. Price resistance**

Tras aumento de precio:

CVR ↓  
PDP engagement stable  
ATC ↓  
AOV ↑

Síntoma:

PRICE\_RESPONSE\_FRICTION

No significa que subir precio haya sido incorrecto.

---

# **29\. Síntomas de producto**

Ejemplos:

HERO\_PRODUCT\_WEAKNESS

PRODUCT\_QUALITY\_DETERIORATION

SKU\_CONCENTRATION

CATALOG\_PRODUCTIVITY\_DECLINE

PRODUCT\_LIFECYCLE\_DECAY

---

# **30\. Product quality deterioration**

Patrón:

Refunds ↑  
Negative reviews ↑  
Support complaints ↑  
Repeat ↓

Síntoma:

PRODUCT\_EXPERIENCE\_DETERIORATION

---

# **31\. Hero SKU weakness**

Hero SKU sales ↓  
PDP demand ↓  
Revenue contribution ↓  
Other SKUs stable

Síntoma:

HERO\_PRODUCT\_DEMAND\_WEAKNESS

---

# **32\. Product concentration**

Top SKU revenue share ↑  
Portfolio contribution ↓

Síntoma:

SKU\_DEPENDENCY

Puede ser riesgo más que fallo.

---

# **33\. Síntomas de retención**

Ejemplos:

COHORT\_RETENTION\_DECAY

REPEAT\_PURCHASE\_WEAKNESS

CUSTOMER\_VALUE\_COMPRESSION

SUBSCRIPTION\_CHURN\_PRESSURE

CRM\_ENGAGEMENT\_DECLINE

---

# **34\. Cohort retention decay**

Patrón:

Recent cohort repeat ↓  
Older cohorts stable  
LTV recent cohorts ↓

Síntoma:

RECENT\_COHORT\_QUALITY\_DERIORATION

---

# **35\. CRM engagement decline**

Email engagement ↓  
Flow conversion ↓  
Revenue/recipient ↓  
Unsubscribe ↑

Síntoma:

CRM\_ENGAGEMENT\_DERIORATION

---

# **36\. Retention mix problem**

Puede ocurrir:

Global repeat ↓  
Cohort-level repeat stable  
Low-retention cohort share ↑

Síntoma correcto:

RETENTION\_MIX\_SHIFT

No:

RETENTION\_SYSTEM\_FAILURE

---

# **37\. Síntomas de inventario**

Ejemplos:

STOCKOUT\_PRESSURE

HERO\_SKU\_AVAILABILITY\_WEAKNESS

OVERSTOCK\_PRESSURE

INVENTORY\_IMBALANCE

FORECASTING\_MISMATCH

SLOW\_MOVING\_STOCK\_BUILDUP

---

# **38\. Stockout pressure**

Days cover ↓  
Sell-through ↑  
PO arrival later than projected depletion

Síntoma:

IMMINENT\_STOCKOUT\_PRESSURE

---

# **39\. Inventory imbalance**

Some hero SKUs short  
Long-tail stock increasing  
Total inventory value high

Síntoma:

INVENTORY\_ALLOCATION\_IMBALANCE

Mucho más útil que:

inventory high

---

# **40\. Overstock pressure**

Inventory value ↑  
Sell-through ↓  
Dead stock ↑  
Cash tied in inventory ↑

Síntoma:

OVERSTOCK\_AND\_CASH\_PRESSURE

---

# **41\. Síntomas operativos**

Ejemplos:

FULFILLMENT\_CAPACITY\_PRESSURE

DELIVERY\_SERVICE\_DETERIORATION

SUPPORT\_BACKLOG

RETURN\_PROCESSING\_PRESSURE

ORDER\_ACCURACY\_DETERIORATION

---

# **42\. Fulfillment pressure**

Orders ↑  
Warehouse utilization ↑  
Dispatch time ↑  
Backlog ↑

Síntoma:

FULFILLMENT\_CAPACITY\_PRESSURE

---

# **43\. Delivery deterioration**

Delivery SLA ↓  
Late shipment complaints ↑  
Refunds ↑

Síntoma:

DELIVERY\_EXPERIENCE\_DETERIORATION

---

# **44\. Support backlog**

Tickets ↑  
Response time ↑  
Resolution time ↑  
Backlog ↑

Síntoma:

CUSTOMER\_SUPPORT\_CAPACITY\_PRESSURE

---

# **45\. Síntomas financieros**

Ejemplos:

MARGIN\_COMPRESSION

CONTRIBUTION\_DERIORATION

CASH\_CONVERSION\_PRESSURE

WORKING\_CAPITAL\_PRESSURE

GROWTH\_WITHOUT\_PROFIT

INVENTORY\_CASH\_LOCKUP

---

# **46\. Margin compression**

Revenue stable/growing  
Gross margin ↓  
Discount share ↑  
Shipping cost ↑

Síntoma:

MARGIN\_COMPRESSION

---

# **47\. Growth without profit**

Revenue ↑  
Orders ↑  
Contribution ↓  
Cash ↓

Síntoma:

UNPROFITABLE\_GROWTH\_PATTERN

Esto no significa todavía saber por qué.

---

# **48\. Cash conversion pressure**

Revenue healthy  
Profit acceptable  
Cash deteriorating  
Inventory ↑  
Receivable timing ↑

Síntoma:

CASH\_CONVERSION\_PRESSURE

---

# **49\. Síntomas de datos**

Ejemplos:

SOURCE\_DIVERGENCE

TRACKING\_LOSS

EVENT\_DUPLICATION\_PATTERN

ATTRIBUTION\_INSTABILITY

DATA\_FRESHNESS\_DETERIORATION

OBSERVABILITY\_GAP

---

# **50\. Source divergence**

Shopify orders stable  
GA purchases ↓  
Meta attributed purchases ↓

Síntoma:

MEASUREMENT\_DIVERGENCE

---

# **51\. Attribution instability**

Platform ROAS volatile  
Backend revenue stable  
Attribution window changed

Síntoma:

ATTRIBUTION\_INSTABILITY

---

# **52\. Síntomas tecnológicos**

Ejemplos:

SITE\_PERFORMANCE\_DEGRADATION

CHECKOUT\_REGRESSION

INTEGRATION\_INSTABILITY

DEPLOYMENT\_REGRESSION

ERROR\_RATE\_PRESSURE

---

# **53\. Deployment regression**

Deployment  
→ error rate ↑  
→ CVR ↓  
→ support complaints ↑

Síntoma:

POST\_DEPLOYMENT\_REGRESSION

Todavía falta determinar qué componente exacto causó qué.

---

# **54\. Síntomas de equipo**

Ejemplos:

EXECUTION\_CAPACITY\_PRESSURE

OWNERSHIP\_GAP

KEY\_PERSON\_DEPENDENCY

DECISION\_BOTTLENECK

DELIVERY\_BACKLOG

---

# **55\. Execution capacity pressure**

Workload ↑  
Backlog ↑  
Cycle time ↑  
Team capacity flat

Síntoma:

EXECUTION\_CAPACITY\_PRESSURE

---

# **56\. Key-person dependency**

Critical decisions depend on one person  
No backup  
Execution pauses during absence

Síntoma:

KEY\_PERSON\_DEPENDENCY

---

# **57\. Síntomas estratégicos**

Más difíciles de medir, pero importantes.

Ejemplos:

GOAL\_RESOURCE\_MISALIGNMENT

STRATEGY\_EXECUTION\_GAP

PRIORITY\_FRAGMENTATION

CHANNEL\_STRATEGY\_DRIFT

GROWTH\_ECONOMICS\_MISALIGNMENT

---

# **58\. Goal-resource misalignment**

Ejemplo:

Declared objective:  
profitability

pero:

spend ↑  
discounting ↑  
revenue incentives dominate

Síntoma:

GOAL\_RESOURCE\_MISALIGNMENT

---

# **59\. Síntomas cross-capability**

Aquí D6 gana mucho valor.

Ejemplo:

Inventory availability ↓  
PDP CVR ↓  
Paid CAC ↑  
Revenue ↓

Puede formar:

CROSS\_CAPABILITY\_PATTERN:  
Commercial deterioration associated with product availability.

Sin declarar causalidad definitiva.

---

# **61\. Symptom granularity**

Los síntomas pueden existir en varios niveles.

BUSINESS  
CAPABILITY  
SUBCAPABILITY  
CHANNEL  
MARKET  
PRODUCT  
SEGMENT

---

# **62\. Ejemplo global**

BUSINESS:  
Profitability deterioration

---

# **63\. Ejemplo capacidad**

ACQUISITION:  
Pre-click efficiency deterioration

---

# **64\. Ejemplo subcapacidad**

CONVERSION / PAYMENT:  
Payment completion failure

---

# **65\. Ejemplo segmentado**

CONVERSION / MOBILE SAFARI:  
Checkout regression

---

# **90\. Mathematical relationship**

CTR ↓  
→ CPC may ↑

---

# **91\. Funnel relationship**

ATC  
→ Checkout  
→ Payment

---

# **92\. Economic relationship**

Discount ↑  
→ margin pressure

---

# **93\. Operational relationship**

Backlog ↑  
→ dispatch time ↑

---

# **94\. Temporal relationship**

two changes begin in same window

No demuestra causa, pero permite clustering.

---

# **95\. Symptom localization**

Antes de declarar un síntoma debe buscarse dónde ocurre.

Ejemplo:

CAC global ↑

Segmentación:

Spain:  
stable

France:  
stable

USA:  
\+40%

Síntoma:

US\_PAID\_ACQUISITION\_EFFICIENCY\_DERIORATION

---

# **96\. Parent-child symptoms**

Puede existir:

PAID\_ACQUISITION\_DERIORATION

con hijos:

META\_PRE\_CLICK\_DERIORATION

GOOGLE\_STABLE

---

# **97\. Hierarchical symptoms**

Ejemplo:

BUSINESS PROFITABILITY DETERIORATION  
        ↓  
UNIT ECONOMICS DETERIORATION  
        ↓  
NEW CUSTOMER CONTRIBUTION DECLINE

Cada nivel tiene diferente abstracción.

---

# **102\. Symptom graph**

Ejemplo:

Creative Response Deterioration  
        ↕ related  
Paid Pre-click Deterioration  
        ↕ related  
CAC Deterioration

D7 convertirá esto en relaciones causales posibles.

---

# **103\. Upstream vs downstream symptom**

Puede etiquetarse:

UPSTREAM  
MIDSTREAM  
DOWNSTREAM

dentro de un proceso.

Ejemplo:

Creative response deterioration:  
UPSTREAM

CAC deterioration:  
DOWNSTREAM

---

# **104\. Outcome symptom**

Algunos síntomas son outputs.

Ejemplo:

REVENUE\_DECLINE  
MARGIN\_DECLINE  
CASH\_PRESSURE

Suelen necesitar investigación hacia upstream.

---

# **105\. Driver symptom**

Otros están más cerca del mecanismo.

Ejemplo:

PAYMENT\_COMPLETION\_FAILURE

---

# **106\. Surface symptom**

Ejemplo:

ROAS decline

puede ser muy superficial.

---

# **107\. Diagnostic depth**

Podemos clasificar síntomas:

SURFACE  
INTERMEDIATE  
DEEP

Pero ninguno es todavía necesariamente root cause.

---

# **108\. Ejemplo**

SURFACE:  
Revenue decline

INTERMEDIATE:  
Conversion deterioration

DEEP:  
Payment completion failure

Todavía:

ROOT CAUSE:  
unknown

---

# **109\. Symptom decomposition**

Ante un síntoma amplio:

Revenue decline

D6 puede descomponer:

Traffic  
CVR  
AOV  
Repeat

---

# **110\. Revenue decline symptom**

Ejemplo:

Revenue \-18%

Traffic \+2%  
CVR \-20%  
AOV stable

Resultado:

PRIMARY SYMPTOM:  
Conversion-driven revenue deterioration

---

# **111\. Profitability symptom decomposition**

Contribution ↓

revisar:

Revenue  
COGS  
Discount  
Shipping  
Payment fees  
Media spend  
Refunds

---

# **112\. Cash symptom decomposition**

Cash ↓

puede requerir:

Contribution  
Inventory  
Payables  
Receivables  
Taxes  
Debt  
Capex

---

# **113\. Symptom composition**

Varios síntomas pequeños pueden formar uno superior.

Ejemplo:

Discount pressure  
\+  
Shipping subsidy increase  
\+  
CAC deterioration

→

NEW\_CUSTOMER\_ECONOMICS\_COMPRESSION

---

# **114\. Cross-domain composition**

Inventory shortage  
\+  
Conversion deterioration  
\+  
Paid CAC increase

→

COMMERCIAL\_EFFICIENCY\_PRESSURE\_WITH\_AVAILABILITY\_CONSTRAINT

Aún sin root cause confirmada.

---

# **141\. Multi-symptom coexistence**

Puede haber simultáneamente:

Creative response deterioration  
Inventory shortage  
Cash pressure

No forzar una única narrativa demasiado pronto.

---

# **142\. Independent symptoms**

Algunos no tienen relación.

El sistema debe permitir múltiples investigaciones.

---

# **143\. Connected symptoms**

Otros sí pueden formar cluster.

---

# **147\. Surface outcome symptom**

Ejemplo:

Revenue decline

debe casi siempre activar búsqueda de síntomas explicativos.

---

# **148\. Diagnostic refinement loop**

SURFACE SYMPTOM  
↓  
DECOMPOSITION  
↓  
LOWER-LEVEL SIGNALS  
↓  
DEEPER SYMPTOM

---

# **149\. Example refinement**

Revenue decline  
↓  
Conversion-driven  
↓  
Checkout-driven  
↓  
Payment-stage deterioration

Ahora estamos mucho más cerca de causa real.

---

# **156\. Symptom vs diagnosis**

Un diagnóstico puede contener múltiples síntomas.

Ejemplo:

DIAGNOSTIC CASE:  
Revenue decline

Symptoms:  
Conversion deterioration  
Payment-stage failure

Luego:

Hypothesis:  
Payment configuration regression

---

# **157\. Symptom vs constraint**

Un síntoma no es necesariamente cuello de botella.

Ejemplo:

Creative concentration

puede ser síntoma de fragilidad, pero no constraint actual.

---

# **158\. Symptom vs maturity gap**

Finance E3 required E7

es gap estructural.

Cash pressure

es síntoma actual.

Pueden coexistir.

---

# **159\. Symptom vs health**

Finance health:  
BAD

es estado.

Cash conversion pressure

es patrón que contribuye a ese estado.

---

# **160\. Relation D4 ↔ D6**

D4:

Where is unhealthy?

D6:

What pattern explains that unhealthy state observationally?

---

# **161\. Positive symptoms**

Debemos detectar también patrones positivos.

Ejemplo:

CTR ↑  
CVR ↑  
CAC ↓  
Contribution ↑

Síntoma:

BROAD\_ACQUISITION\_EFFICIENCY\_IMPROVEMENT

---

# **162\. Why positive symptoms matter**

F9 necesita aprender:

what changed before performance improved

No solo estudiar fallos.

---

# **163\. Improvement localization**

Ejemplo:

Global CAC improves

pero solo por:

France prospecting

Síntoma:

FRANCE\_PROSPECTING\_EFFICIENCY\_IMPROVEMENT

---

# **164\. Mixed symptoms**

Ejemplo:

Revenue ↑  
Contribution ↓

Síntoma:

GROWTH\_WITH\_ECONOMIC\_COMPRESSION

---

# **165\. Another mixed symptom**

CAC ↑  
New customers ↑↑  
Contribution ↑

Puede ser:

SCALING\_WITH\_MARGINAL\_EFFICIENCY\_COMPRESSION

No necesariamente negativo.

---

# **166\. Symptom valence must be contextual**

No asignar:

CAC UP \= BAD

automáticamente.

---

# **167\. Scope interaction**

Ejemplo:

Meta CAC ↑

pero:

Blended CAC stable

Síntoma debe permanecer:

META\_EFFICIENCY\_DERIORATION

no global.

---

# **173\. Recurring symptom**

Ejemplo:

Stockout pressure every major launch.

Esto puede apuntar posteriormente a una causa estructural.

---

# **175\. Chronic symptom detection**

Ejemplo:

discount dependency

persistiendo 12 meses.

D6 debería reconocer:

CHRONIC

---

# **176\. Acute symptom detection**

Ejemplo:

checkout payment failure

aparece en 30 minutos.

---

# **186\. Diagnostic value**

Cuanto más localizado el síntoma:

greater diagnostic utility

si no se sacrifica confianza.

---

# **200\. Qualitative symptoms**

También pueden existir.

Ejemplo:

Support tickets about sizing ↑  
Negative review mentions sizing ↑  
Returns due to size ↑

Síntoma:

SIZING\_EXPERIENCE\_PROBLEM

---

# **201\. Text \+ quantitative combination**

Esto es potente.

Refund rate ↑  
\+  
"too small" complaints ↑

forma síntoma más específico.

---

# **202\. Multimodal evidence**

Futuro:

reviews  
tickets  
calls  
surveys

pueden combinarse con métricas.

---

# **210\. Confounding context**

Ejemplo:

CTR ↓

durante cambio masivo hacia audiencias frías.

Puede formar:

AUDIENCE\_MIX\_RESPONSE\_CHANGE

en lugar de:

CREATIVE\_RESPONSE\_DERIORATION

---

# **218\. Symptom as early warning**

Ejemplo:

Creative pipeline weakness

antes de:

CAC deterioration

---

# **219\. Leading symptom**

Podemos marcar:

LEADING

---

# **220\. Coincident symptom**

COINCIDENT

---

# **221\. Lagging symptom**

LAGGING

Ejemplo:

Cash pressure

puede ser efecto tardío.

---

# **222\. Symptom time role**

Esto será fundamental para D7.

---

# **223\. Symptom dependency candidates**

D6 puede registrar relaciones candidatas:

may\_precede  
may\_follow  
often\_cooccurs

Sin afirmar causa.

---

# **224\. Example**

CREATIVE\_PIPELINE\_WEAKNESS  
may\_precede  
CREATIVE\_RESPONSE\_DERIORATION

---

# **225\. Another**

STOCKOUT\_PRESSURE  
often\_cooccurs  
CONVERSION\_DERIORATION

---

# **229\. Too broad**

Sales problem

casi inútil.

---

# **230\. Too specific without evidence**

Stripe fraud rule rejecting Mastercard Germany

si no tenemos logs.

También inútil y peligroso.

---

# **231\. Correct middle ground**

Payment-stage completion failure concentrated in Mastercard transactions in Germany.

si los datos lo soportan.

---

# **255\. Relación con D0**

D0 exige separar:

signal  
symptom  
hypothesis  
cause

D6 formaliza la segunda transición.

---

# **256\. Relación con D1**

D1 determina qué señales son suficientemente fiables.

---

# **257\. Relación con D2**

D2 evita crear síntomas falsos por:

seasonality  
promotion  
mix  
price  
launch

---

# **258\. Relación con D3**

D3 aporta madurez y complejidad para interpretar algunos patrones estructurales.

---

# **259\. Relación con D4**

D4 dice:

Creative:  
BAD

D6 puede explicar:

Creative response deterioration  
\+  
Creative pipeline weakness

---

# **260\. Relación con D5**

D5 es la entrada principal:

SIGNALS  
→  
SYMPTOMS

---

# **261\. Relación con D7**

D7 será el cambio grande.

Pasaremos de:

¿Qué señales forman patrones?

a:

¿Qué variables pueden producir qué otras variables?

---

# **262\. Relación con D8**

D8 recibirá síntomas y preguntará:

¿Qué explicaciones plausibles podrían producir este patrón?

---

# **263\. Relación con D9**

D9 intentará llegar desde:

surface symptom

hasta:

root cause  
constraint

---

# **264\. RAG structure**

Chunks recomendados:

symptom\_principles

symptom\_vs\_cause

acquisition\_symptoms

creative\_symptoms

conversion\_symptoms

offer\_symptoms

product\_symptoms

retention\_symptoms

inventory\_symptoms

operations\_symptoms

finance\_symptoms

data\_symptoms

technology\_symptoms

team\_symptoms

cross\_capability\_symptoms

symptom\_validation

symptom\_invariants

Metadata:

phase:  
F3

block:  
D6

domain:  
symptom\_engine

knowledge\_type:  
pattern\_rule

---

# **275\. Business symptom map**

Ejemplo:

ACTIVE SYMPTOMS

Acquisition  
\- Pre-click deterioration

Creative  
\- Creative concentration  
\- Pipeline weakness

Inventory  
\- Hero SKU stockout pressure

Finance  
\- Margin compression

Data  
\- Healthy / no active symptoms

---

# **276\. Diagnostic memory**

Después podrá saber:

> La última vez que apareció este patrón, también existía creative pipeline weakness.

Eso será F9.

---

# **277\. General expert knowledge role**

El conocimiento de alto nivel sirve especialmente para definir:

common symptom combinations  
business relationships  
failure patterns  
leading patterns  
commercial/economic trade-offs

Pero siempre convertido a principios impersonales y contrastado con evidencia del caso.

---

# **278\. Example abstracted principle**

A deterioration in CTR accompanied by stable CPM and stable post-click conversion localizes performance loss primarily before the website visit.

Esto sí es conocimiento reusable.

---

# **279\. What we should not store as doctrine**

No:

If CTR falls, always create new creatives.

Porque eso ya mezcla:

symptom  
cause  
action

y destruye la arquitectura.

---

# **281\. Arquitectura acumulada**

Ahora tenemos:

D1  
¿Los datos son fiables?

D2  
¿Están correctamente contextualizados?

D3  
¿Qué madurez tiene el negocio?

D4  
¿Qué partes están sanas o enfermas?

D5  
¿Qué está cambiando?

D6  
¿Qué patrones forman esos cambios?

Y ahora llegamos a una de las piezas intelectualmente más importantes de toda la plataforma:

D7 — GRAFO CAUSAL DEL ECOMMERCE

Porque ya no basta con reconocer:

CTR ↓  
CPC ↑  
CAC ↑

El sistema debe conocer que:

CTR  
puede afectar CPC

CPC  
puede afectar CAC

CVR  
también puede afectar CAC

CAC  
puede afectar contribution

Contribution  
puede afectar cash

Y, todavía más importante:

Inventory  
puede afectar Conversion

Operations  
puede afectar Retention

Creative  
puede afectar Acquisition

Product  
puede afectar prácticamente todo el organismo.

Sin D7, el sistema podría reconocer patrones, pero no tendría un modelo explícito de **cómo funciona causalmente un ecommerce**.

---

# **282\. Principio final**

D5 detecta:

> cosas que están cambiando.

D6 entiende:

> qué patrón forman esas cosas.

Un sistema mediocre observa:

CAC ↑

Un sistema mejor observa:

CTR ↓  
CPC ↑  
CAC ↑

Un sistema de diagnóstico serio concluye:

Hay un deterioro observable de eficiencia antes del clic.  
La conversión posterior permanece estable.  
Todavía no sabemos por qué está ocurriendo.

Esa última frase es fundamental.

El objetivo de D6 no es saber la causa.

Es **reducir correctamente el espacio del problema sin inventarla**.

