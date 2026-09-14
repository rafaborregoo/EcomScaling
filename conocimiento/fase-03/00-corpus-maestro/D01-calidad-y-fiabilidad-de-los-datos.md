# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D1 — CALIDAD Y FIABILIDAD DE LOS DATOS**

---

# **7\. Freshness**

Pregunta:

> ¿Está suficientemente actualizado el dato?

Ejemplo:

Shopify orders:  
last\_sync 4 minutes ago  
→ HEALTHY

Meta Ads:  
last\_sync 19 hours ago  
→ STALE

Estados posibles:

REAL\_TIME

FRESH

DELAYED

STALE

SEVERELY\_STALE

UNKNOWN

El umbral depende de la fuente.

Un dato financiero mensual puede seguir siendo válido después de varios días.

Un dato de campañas activas puede quedar obsoleto en horas.

---

# **8\. Freshness contextual**

No debe existir un único threshold global.

Ejemplo:

Shopify live orders:  
expected freshness \< 15 min

ERP accounting:  
expected freshness \< 24h

monthly P\&L:  
expected freshness \< 7 days

Por tanto:

> **La frescura debe evaluarse contra la cadencia esperada de cada fuente.**

---

# **9\. Completeness**

Pregunta:

> ¿Tenemos todas las observaciones esperadas?

Ejemplo:

Expected orders:  
4,812

Imported orders:  
4,806

coverage:  
99.88%

Otro:

Expected campaign days:  
30

Available:  
19

coverage:  
63.3%

La segunda fuente no debería sustentar un análisis mensual sin advertencia.

---

# **10\. Missingness**

No todos los datos faltantes tienen la misma importancia.

Debe diferenciarse:

RANDOM\_MISSINGNESS

SYSTEMATIC\_MISSINGNESS

TIME\_RANGE\_MISSINGNESS

SEGMENT\_MISSINGNESS

SOURCE\_MISSINGNESS

Ejemplo crítico:

Desktop events:  
complete

Mobile Safari events:  
missing

Esto puede producir una falsa apariencia de caída en mobile.

---

# **11\. Coverage**

Coverage mide cuánto del fenómeno real está cubierto.

Ejemplo:

Total Shopify revenue:  
€500,000

Tracked GA4 purchase revenue:  
€347,000

coverage:  
69.4%

Esto no significa automáticamente que Shopify esté mal.

Significa que GA4 no cubre todo el revenue.

---

# **12\. Source of Truth**

Cada métrica debe tener una fuente primaria preferente.

Ejemplo:

Revenue:  
SOURCE\_OF\_TRUTH \= Shopify

Ad spend:  
SOURCE\_OF\_TRUTH \= ad platform

Payment settlement:  
SOURCE\_OF\_TRUTH \= payment processor / finance

Inventory available:  
SOURCE\_OF\_TRUTH \= Shopify / ERP / WMS depending architecture

Esto evita comparar plataformas como si midieran exactamente lo mismo.

---

# **13\. Source hierarchy**

Puede definirse:

PRIMARY\_SOURCE

SECONDARY\_SOURCE

VALIDATION\_SOURCE

DERIVED\_SOURCE

Ejemplo:

Orders:  
PRIMARY \= Shopify

SECONDARY \= ERP

VALIDATION \= Stripe

DERIVED \= GA4

---

# **14\. Reconciliation**

El motor debe reconciliar fuentes relacionadas.

Ejemplo:

Shopify revenue:  
€202,300

GA4 revenue:  
€183,400

Meta attributed revenue:  
€131,000

Google Ads attributed revenue:  
€104,000

No puede sumarse:

131,000 \+ 104,000

y compararlo directamente contra Shopify.

Existe:

attribution overlap

---

# **15\. Reconciliation Status**

Cada par o conjunto de fuentes puede tener:

MATCHED

ACCEPTABLE\_VARIANCE

MATERIAL\_VARIANCE

SEVERE\_VARIANCE

NOT\_COMPARABLE

---

# **16\. Diferencia no implica error**

Ejemplo:

Shopify:  
€100k revenue

Meta:  
€64k attributed revenue

Esto puede ser perfectamente normal.

Las plataformas responden preguntas distintas.

Por eso debe diferenciarse:

DATA\_DISCREPANCY

de:

DATA\_ERROR

---

# **17\. Semantic Consistency**

El sistema debe verificar que métricas con el mismo nombre representen realmente lo mismo.

Ejemplo:

Meta ROAS

no equivale necesariamente a:

Blended ROAS

Tampoco:

Shopify conversion rate

es idéntico necesariamente a:

GA4 session conversion rate

---

# **18\. Metric Definition Registry**

El sistema debería mantener un registro de definiciones.

Ejemplo:

METRIC:  
CAC

definition:  
new\_customer\_acquisition\_spend /  
new\_customers\_acquired

source:  
internal derived metric

scope:  
paid acquisition

currency:  
EUR

Otro:

METRIC:  
MER

definition:  
total\_revenue /  
total\_marketing\_spend

Esto evitará que diferentes agentes utilicen fórmulas distintas.

---

# **19\. Definition Drift**

Debe detectarse cuando una métrica cambia de definición.

Ejemplo:

Antes:

CAC \=  
Meta spend /  
Meta new customers

Después:

CAC \=  
Total media spend /  
Total new customers

El gráfico puede parecer haber empeorado aunque el negocio no haya cambiado.

Esto se denomina:

METRIC\_DEFINITION\_DRIFT

---

# **20\. Schema Drift**

Las APIs pueden cambiar o las integraciones pueden recibir datos diferentes.

Ejemplo:

field:  
purchase\_value

desaparece.

O:

currency field changes

O:

campaign\_id becomes nullable

Esto debe producir:

SCHEMA\_DRIFT

---

# **21\. Event Integrity**

En sistemas de tracking debe comprobarse:

event exists  
event fires correctly  
event fires once  
event contains correct payload  
event is timestamped correctly  
event is attributed correctly

---

# **22\. Duplicate Events**

Ejemplo:

purchase event:  
fires twice

Consecuencia:

GA4 revenue inflated

El negocio puede aparentar:

CVR ↑  
Revenue ↑  
ROAS ↑

sin que nada real haya mejorado.

---

# **23\. Missing Events**

Ejemplo:

AddToCart events:  
\-48%

Pero Shopify ATC:

stable

Hipótesis:

tracking event missing

antes que:

customer behavior deteriorated

---

# **24\. Event Ratio Integrity**

El motor debe comprobar relaciones lógicas.

Ejemplo imposible:

Purchase events \> Checkout events

o:

Checkout \> AddToCart

si el modelo de funnel utilizado exige secuencia.

Puede indicar:

duplicate events  
incorrect event definitions  
missing upstream events  
cross-device issues

---

# **25\. Logical Integrity Checks**

Ejemplos:

orders \>= 0

refunds \<= gross orders

inventory cannot become impossible without adjustment

conversion rate \<= 100%

spend cannot be negative

AOV roughly matches revenue / orders

---

# **26\. Mathematical Consistency**

Debe comprobarse si métricas derivadas coinciden.

Ejemplo:

Revenue:  
€100,000

Orders:  
2,000

AOV reported:  
€70

Pero:

100,000 / 2,000 \= €50

Existe una inconsistencia.

---

# **27\. Currency Consistency**

Negocios internacionales pueden mezclar:

EUR  
USD  
GBP  
CAD  
AUD

El motor debe conocer:

native\_currency  
reporting\_currency  
conversion\_rate  
conversion\_timestamp

Un crecimiento aparente puede provenir simplemente de FX.

---

# **28\. Timezone Consistency**

Uno de los errores más frecuentes.

Ejemplo:

Shopify timezone:  
Europe/Madrid

Meta Ads:  
account timezone US/Eastern

Comparar datos diarios directamente puede producir discrepancias artificiales.

---

# **29\. Day Boundary Distortion**

Un pedido realizado a:

00:30 Madrid

puede pertenecer al día anterior en otra plataforma.

Por tanto, el sistema debe verificar:

timezone\_alignment

antes de hacer comparativas diarias.

---

# **30\. Granularity**

Debe comprobarse que la granularidad permita la investigación.

Ejemplo:

Tenemos:

monthly revenue

pero queremos investigar:

a drop beginning yesterday

Los datos existen pero:

GRANULARITY:  
INSUFFICIENT

---

# **31\. Granularity Levels**

REAL\_TIME

HOURLY

DAILY

WEEKLY

MONTHLY

CAMPAIGN\_LEVEL

ADSET\_LEVEL

AD\_LEVEL

PRODUCT\_LEVEL

SKU\_LEVEL

CUSTOMER\_LEVEL

---

# **32\. Continuity**

Una serie temporal necesita continuidad.

Ejemplo:

Jan 1–10 available  
Jan 11–18 missing  
Jan 19–31 available

Una media mensual puede ocultar el problema.

Debe existir:

DATA\_CONTINUITY\_CHECK

---

# **33\. Outliers de ingestión**

Ejemplo:

Normal orders/day:  
400–500

One day:  
12,400

Antes de interpretar un boom empresarial debe comprobarse:

duplicate ingestion  
bulk historical import  
timestamp corruption

---

# **34\. Zero vs Missing**

Esto es crítico.

0

no equivale a:

NULL

Ejemplo:

Meta spend \= 0

puede significar realmente:

no spend

Pero:

Meta spend \= NULL

puede significar:

data unavailable

Nunca deben tratarse igual.

---

# **35\. API Permissions**

Una fuente puede estar conectada pero incompleta por scopes insuficientes.

Ejemplo:

Shopify:  
orders available  
products available  
inventory unavailable

El sistema debería registrar:

PERMISSION\_GAP

y no asumir:

no inventory data \= no inventory problem

---

# **36\. Rate Limits**

Las APIs pueden entregar datos incompletos debido a rate limits.

Ejemplo:

429 responses increasing

Consecuencia:

sync partial

Esto debe reflejarse como:

INGESTION\_DEGRADED

---

# **37\. Webhook Health**

Para integraciones event-driven deben vigilarse:

delivery success  
retry count  
latency  
dead-letter events  
signature failures  
duplicate deliveries

---

# **38\. Sync Health**

Para procesos batch:

expected runs  
successful runs  
failed runs  
partial runs  
last complete run  
records processed  
records rejected

---

# **39\. Freshness Cascade**

Un dataset derivado no puede ser más fresco que su input.

Ejemplo:

Meta raw data:  
18h stale

por tanto:

derived CAC:  
18h stale

aunque el cálculo se haya ejecutado hace 2 minutos.

---

# **40\. Derived Metric Lineage**

Cada métrica derivada debe conocer su lineage.

Ejemplo:

CONTRIBUTION\_MARGIN

depends\_on:  
Revenue  
COGS  
Discounts  
Shipping subsidy  
Payment fees  
Ad spend  
Refunds

Si:

COGS \= stale

entonces:

Contribution Margin Reliability ↓

---

# **41\. Dependency Propagation**

La calidad de datos debe propagarse.

Ejemplo:

Revenue:  
HIGH reliability

COGS:  
LOW reliability

Marketing spend:  
HIGH reliability

Resultado:

Contribution margin:  
LOW / MEDIUM reliability

No puede marcarse HIGH porque dos de tres inputs lo sean.

---

# **42\. DATA\_LINEAGE**

Conceptualmente:

source  
  ↓  
raw\_table  
  ↓  
normalized\_table  
  ↓  
business\_metric  
  ↓  
signal  
  ↓  
diagnostic\_evidence

Toda evidencia debería poder remontarse hasta la fuente.

---

# **43\. Attribution Reliability**

Una de las áreas más peligrosas del ecommerce.

Deben distinguirse:

platform attribution  
analytics attribution  
backend attribution  
blended economics  
incrementality

---

# **44\. Platform Self-Attribution**

Meta, Google, TikTok, Klaviyo, etc. pueden atribuirse simultáneamente una misma venta.

Por tanto:

Meta revenue  
\+  
Google revenue  
\+  
Klaviyo revenue

no equivale a:

Business revenue

---

# **45\. Attribution Window**

Debe registrarse:

1-day click  
7-day click  
1-day view  
7-day click \+ 1-day view  
etc.

Si cambia la ventana, puede cambiar el ROAS sin cambiar el negocio.

---

# **46\. Attribution Model Drift**

Ejemplo:

Before:  
7-day click \+ 1-day view

After:  
1-day click

Resultado:

ROAS appears to collapse

No debe diagnosticarse automáticamente como deterioro de campañas.

---

# **47\. Modeled Conversions**

Algunas plataformas incluyen conversiones modeladas.

Por tanto, el motor debería conocer cuando sea posible:

observed  
modeled  
estimated

No toda cifra tiene el mismo grado de certeza.

---

# **48\. Consent and Tracking Loss**

Cambios de:

cookie consent  
Consent Mode  
iOS privacy  
browser tracking  
server-side tracking  
pixel configuration

pueden reducir conversiones observadas sin reducir conversiones reales.

---

# **49\. Marketing vs Business Reality**

Ejemplo:

Meta ROAS:  
\-30%

pero:

Shopify revenue:  
stable

Total marketing spend:  
stable

New customers:  
stable

La primera sospecha no debería ser necesariamente:

business deterioration

Puede existir:

attribution deterioration

---

# **50\. Revenue Reconciliation**

Idealmente:

Shopify Gross Sales  
\- discounts  
\- returns  
\+ shipping  
\+ taxes  
...

debe reconciliar con la definición de revenue utilizada internamente.

El sistema necesita conocer exactamente qué significa:

REVENUE

en cada contexto.

---

# **51\. Gross vs Net Revenue**

Nunca deben mezclarse.

Gross Sales

Net Sales

Total Sales

Recognized Revenue

pueden ser cifras distintas.

---

# **52\. Refund Timing**

Una venta puede producirse en enero y su refund en febrero.

Dependiendo de la metodología:

January revenue

y:

February net revenue

pueden parecer anómalos.

Debe conocerse:

refund recognition logic

---

# **53\. Order Status**

El sistema debería conocer:

paid  
pending  
cancelled  
refunded  
partially\_refunded  
fraudulent  
test

Los pedidos test no deberían contaminar análisis reales.

---

# **54\. Test Data Detection**

Debe filtrarse:

test orders  
developer events  
sandbox payments  
internal employee purchases  
QA events

cuando sea posible.

---

# **55\. Bot Traffic**

Un incremento brusco de sesiones puede provenir de bots.

Ejemplo:

Traffic \+120%  
Revenue stable  
Bounce extreme  
Geography unusual

Puede ser:

BOT\_TRAFFIC

y no crecimiento real.

---

# **56\. Internal Traffic**

Equipos grandes pueden contaminar:

analytics  
search  
product views  
checkout tests

Debería excluirse cuando sea relevante.

---

# **57\. Sampling**

Algunas herramientas pueden devolver datos muestreados.

El motor debe registrar:

sampled:  
true

cuando aplique.

Una conclusión de alta precisión no debe construirse sobre datos altamente muestreados sin advertencia.

---

# **58\. Sample Size**

Una variación extrema con muy pocos eventos puede ser ruido.

Ejemplo:

CVR yesterday:  
4%

today:  
2%

pero:

sessions today:  
43

Puede no ser evidencia suficiente.

---

# **59\. Statistical Fragility**

D1 no necesita convertirse en un sistema estadístico completo, pero sí debe marcar:

LOW\_SAMPLE

HIGH\_VARIANCE

INSUFFICIENT\_OBSERVATIONS

---

# **60\. Baseline Quality**

No solo los datos actuales deben ser fiables.

También el baseline.

Ejemplo:

current period:  
clean

pero:

comparison period:  
Black Friday promotion

La comparación puede ser inválida.

Aunque esto se desarrollará más en D2, D1 debe comprobar que el baseline tiene integridad técnica.

---

# **61\. Historical Backfill**

Algunas integraciones cargan históricos después de conectar.

Durante ese proceso puede aparecer:

revenue spike

que simplemente corresponde a:

BACKFILL

Debe etiquetarse.

---

# **62\. Late Arriving Data**

Algunas métricas se completan con retraso.

Ejemplo:

Today ROAS:  
1.4

24 horas después:

ROAS:  
1.8

por conversiones atribuidas tardíamente.

Por tanto, el sistema debe saber cuándo un periodo está:

OPEN

PARTIALLY\_SETTLED

SETTLED

---

# **63\. Period Closure**

Conceptualmente:

today:  
OPEN

yesterday:  
PARTIALLY\_SETTLED

7 days ago:  
SETTLED

Una comparación entre datos todavía abiertos debe interpretarse con precaución.

---

# **68\. Data Quality by Scope**

La calidad no tiene por qué ser global.

Ejemplo:

Shopify:  
overall HIGH

pero:

subscription orders:  
LOW

porque una integración concreta no sincroniza Recharge correctamente.

---

# **69\. Segmented Data Reliability**

Debe permitirse:

source:  
Shopify

scope:  
US market

reliability:  
HIGH

y simultáneamente:

source:  
Shopify

scope:  
UK market

reliability:  
LOW

reason:  
currency normalization issue

---

# **88\. Temporal Anomaly in Data**

El sistema debe detectar cambios abruptos exclusivamente técnicos.

Ejemplo:

Purchase event:  
stable for 180 days

De repente:

\-92%

exactamente en el momento:

pixel deployment

Debe investigarse primero:

TRACKING\_REGRESSION

---

# **89\. Multi-source Validation**

Cuanto más importante sea una señal, más valiosa será la corroboración.

Ejemplo:

Shopify orders ↓  
Stripe payments ↓  
Warehouse shipments ↓

Tenemos una señal empresarial fuerte.

Pero:

GA4 purchase ↓  
Shopify orders stable  
Stripe payments stable

probablemente tenemos un problema de analytics.

---

# **90\. Cross-validation Matrix**

Conceptualmente:

| Fenómeno | Fuente principal | Validación |
| ----- | ----- | ----- |
| Orders | Shopify | ERP / Payment |
| Revenue | Shopify | Finance |
| Payments | Stripe/PSP | Shopify |
| Traffic | Analytics | Platform clicks |
| Spend | Ad platform | Finance |
| Inventory | ERP/WMS | Shopify |
| Email revenue | Klaviyo | Shopify attribution |
| Refunds | Shopify | PSP / Finance |

---

# **92\. Evidence Weight**

Dos evidencias no tienen por qué pesar igual.

Ejemplo:

Shopify paid orders

puede tener peso mayor que:

GA4 purchase event

cuando investigamos pedidos reales.

---

# **94\. Human Evidence**

Algunas observaciones humanas son extremadamente valiosas:

support tickets  
customer complaints  
team reports  
warehouse incidents  
supplier notices

Pero deben diferenciarse de datos instrumentados.

---

# **95\. Qualitative Data**

Ejemplo:

25 tickets:  
"card declined"

puede reforzar un diagnóstico de payment failure.

Pero no debe traducirse automáticamente a:

25% of users affected

sin denominador válido.

---

# **106\. Ejemplo: falsa caída de Meta**

## **Datos**

Meta purchases:  
\-43%

Meta ROAS:  
\-38%

Shopify orders:  
\+2%

Shopify new customers:  
\+1%

Meta clicks:  
stable

Cambio reciente:

Pixel deployment  
48 hours ago

## **Diagnóstico incorrecto**

> “Meta Ads está funcionando mucho peor.”

## **Diagnóstico correcto de D1**

DATA ISSUE:  
Possible Meta conversion tracking regression

EVIDENCE:  
Meta attributed purchases \-43%  
Shopify orders stable  
New customers stable  
Clicks stable  
Drop begins after pixel deployment

CONFIDENCE:  
HIGH

Resultado:

Acquisition performance diagnosis:  
BLOCKED / DEGRADED

---

# **107\. Ejemplo: falsa subida de conversión**

## **Datos**

GA4 purchases:  
\+88%

Shopify orders:  
\+1%

Sessions:  
stable

Diagnóstico probable:

duplicate purchase event

No:

conversion breakthrough

---

# **108\. Ejemplo: API incompleta**

Meta Campaign A:  
data available

Campaign B:  
missing

Campaign C:  
missing

Spend total importado:

€20k

Spend real:

€46k

Un CAC calculado con €20k sería falso.

Por tanto:

ACQUISITION DATA:  
FAIL

---

# **109\. Ejemplo: periodo todavía abierto**

Hoy a las 10:00:

Revenue:  
\-52% vs yesterday full day

Este comparison es inválido.

Debe compararse:

today 00:00–10:00

contra:

yesterday 00:00–10:00

o un baseline equivalente.

D2 profundizará este problema.

---

# **110\. Ejemplo: datos correctos pero insuficientes**

Tenemos:

CAC \+25%

CTR \-18%

CPM stable

Pero no tenemos:

creative IDs  
creative age  
frequency  
CVR by campaign

Puede existir:

creative deterioration signal

Pero no:

creative fatigue CONFIRMED

Resultado:

confidence:  
LOW / MEDIUM

data\_gap:  
creative-level history

---

# **111\. Data Quality Failure Modes**

El sistema debe conocer patrones recurrentes:

silent integration failure  
partial sync  
duplicated sync  
stale token  
expired credentials  
permission removal  
API version migration  
timezone drift  
currency normalization failure  
event duplication  
event suppression  
tracking deployment regression  
attribution window change  
historical backfill  
schema change  
incorrect filter  
bot spike  
test data pollution

---

# **112\. Silent Failure**

Especialmente peligroso.

Una integración puede responder:

200 OK

pero devolver solo parte de los datos.

Por tanto:

> **HTTP success no equivale a data success.**

---

