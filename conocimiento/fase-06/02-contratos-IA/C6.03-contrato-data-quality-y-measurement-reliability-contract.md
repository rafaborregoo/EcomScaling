# **C6.3 — DATA QUALITY & MEASUREMENT RELIABILITY CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Data Quality & Measurement Reliability Contract define cómo EcomScaling IA debe determinar si los datos utilizados para una evaluación son suficientemente fiables para sostener una conclusión.

Su misión es responder:

> **¿Podemos confiar en este dato y con qué limitaciones?**

C6.3 NO determina:

si CAC es bueno

si ROAS es malo

si CVR está deteriorándose

si existe un problema de negocio

C6.3 determina:

si el CAC está correctamente medido

si el ROAS procede de una fuente suficientemente interpretable

si el CVR dispone de muestra suficiente

si los datos están completos

si están actualizados

si existen problemas de tracking

si diferentes fuentes se contradicen

si una cohorte está suficientemente madura

si una métrica derivada puede reproducirse

si existen limitaciones que deben reducir la fuerza de cualquier conclusión posterior

---

# **2\. PRINCIPIO FUNDAMENTAL**

La fuerza de una conclusión nunca puede superar la calidad de los datos que la sostienen.

Invariante:

quality\_of\_conclusion  
\<=  
quality\_of\_evidence

Y:

strength\_of\_claim  
\<=  
strength\_of\_evidence

Por tanto, aunque una diferencia parezca enorme:

CAC:  
€35 → €58

si existen graves problemas de medición:

tracking incomplete

customer deduplication broken

spend partially missing

el sistema no debe producir automáticamente una conclusión fuerte.

---

# **3\. SEGUNDO PRINCIPIO**

Un número disponible no equivale a un número fiable.

available  
≠  
reliable

Ejemplo:

ROAS \= 5.2

puede estar perfectamente disponible en Meta Ads.

Pero todavía debemos preguntar:

¿qué atribución utiliza?

¿está completo el revenue?

¿existe duplicación?

¿hay conversion API funcionando?

¿está cerrado el attribution window?

¿coincide razonablemente con otras fuentes?

¿existen problemas conocidos de tracking?

---

# **4\. TERCER PRINCIPIO**

C6.3 debe permitir decir:

INSUFFICIENT EVIDENCE

No debe forzar una evaluación.

Si no existen datos suficientes:

do not invent certainty

Debe ser posible que contratos posteriores produzcan:

status \= indeterminate

---

# **5\. RESPONSABILIDAD**

C6.3 debe evaluar al menos:

source reliability

freshness

completeness

coverage

sample sufficiency

denominator integrity

measurement maturity

tracking health

consistency

reconciliation

source conflicts

transformation integrity

missingness

latency

finality

known incidents

measurement limitations

---

# **6\. LO QUE C6.3 NO DEBE HACER**

C6.3 NO debe:

seleccionar benchmarks

determinar performance status

asignar severity de negocio

diagnosticar root causes

priorizar problemas

seleccionar estrategias

generar recomendaciones

Tampoco debe sustituir C6.8 Confidence.

C6.3 produce:

measurement quality

C6.8 utilizará esa información para calcular:

confidence

---

# **7\. SEPARACIÓN FUNDAMENTAL**

Debe mantenerse:

DATA QUALITY  
≠  
SEMANTIC COMPLETENESS  
≠  
COMPARABILITY  
≠  
CONFIDENCE  
≠  
BUSINESS STATUS

C6.1 responde:

¿Qué significa el dato?

C6.2 responde:

¿Contra qué es comparable?

C6.3 responde:

¿Podemos confiar en su medición?

C6.8 responderá:

¿Con qué confianza podemos sostener una conclusión?

C6.9 responderá:

¿Qué significa el resultado respecto a referencias y guardrails?

---

# **8\. DATA QUALITY ASSESSMENT**

C6.3 debe producir conceptualmente:

DATA\_QUALITY\_ASSESSMENT

asociado a:

observation\_id

o a un conjunto de observaciones cuando corresponda.

---

# **9\. ASSESSMENT\_ID**

Toda evaluación de calidad material debe poder tener:

data\_quality\_assessment\_id

Debe ser distinta de:

observation\_id

run\_id

finding\_id

---

# **10\. SCOPE DEL ASSESSMENT**

La calidad puede evaluarse sobre:

single observation

dataset

metric series

cohort dataset

source integration

derived metric

comparison dataset

Debe quedar explícito qué se está evaluando.

---

# **11\. QUALITY DIMENSIONS**

No debe reducirse todo desde el inicio a:

quality \= 72%

Debe existir evaluación dimensional.

Como mínimo:

source\_quality

freshness

completeness

coverage

sample\_sufficiency

denominator\_integrity

tracking\_health

consistency

measurement\_maturity

transformation\_integrity

reconciliation\_quality

---

# **12\. SOURCE QUALITY**

Evalúa la naturaleza y fiabilidad estructural de la fuente.

Ejemplos de fuentes:

Shopify

Meta Ads

Google Ads

GA4

Klaviyo

ERP

warehouse

finance system

manual spreadsheet

manual user input

model estimate

C6.3 no debe asumir:

official platform  
\=  
perfect truth

---

# **13\. SOURCE TYPE**

Debe poder clasificarse conceptualmente:

first\_party\_transactional

first\_party\_analytics

advertising\_platform

crm

finance

operations

manual

external

modeled

inferred

---

# **14\. SOURCE AUTHORITY**

Una fuente puede ser más autoritativa que otra para determinadas métricas.

Ejemplo:

Para:

actual completed orders

Shopify puede ser más autoritativo que Meta.

Para:

platform-attributed conversions

Meta es la fuente natural de esa métrica.

Por tanto:

source authority  
is metric-dependent.

---

# **15\. NO UNIVERSAL SOURCE RANKING**

No debe hardcodearse:

Shopify \> GA4 \> Meta

para todas las métricas.

La prioridad depende de:

metric semantics

measurement purpose

source capability

---

# **16\. SOURCE RELIABILITY PROFILE**

Puede existir conceptualmente:

source\_reliability\_profile\_id

que describa características conocidas de una integración.

Ejemplo:

Meta Ads integration  
API-based  
hourly sync  
conversion API enabled  
known 24h latency

---

# **17\. SOURCE AVAILABILITY**

Debe poder diferenciarse:

available

partially\_available

unavailable

delayed

---

# **18\. FRESHNESS**

Freshness responde:

> ¿Qué tan recientes son los datos respecto al momento en que deberían estar disponibles?

Debe poder conocerse:

source\_updated\_at

ingested\_at

expected\_update\_frequency

freshness\_age

---

# **19\. FRESHNESS STATUS**

Estados conceptuales:

fresh

acceptable

stale

expired

unknown

---

# **20\. FRESHNESS DEPENDE DE LA MÉTRICA**

Ejemplo:

Datos de campañas de hace:

4 hours

pueden ser normales para ciertas integraciones.

Datos de stock de hace:

4 hours

podrían ser demasiado antiguos para decisiones operativas sensibles.

Por tanto:

freshness threshold

debe ser configurable por:

metric

source

use case

---

# **21\. STALE DATA**

Un dato antiguo puede seguir siendo válido para:

historical analysis

aunque no sea adecuado para:

live monitoring

Por tanto:

stale  
≠  
incorrect

---

# **22\. COMPLETENESS**

Completeness responde:

> ¿Tenemos todos los datos esperados?

Ejemplo:

Esperábamos:

30 days

pero existen:

24 days

Entonces:

temporal completeness \< 100%

---

# **23\. RECORD COMPLETENESS**

Puede medirse:

expected\_records

available\_records

missing\_records

---

# **24\. FIELD COMPLETENESS**

También:

required\_fields\_present

required\_fields\_missing

Ejemplo:

Orders disponibles pero:

customer\_id missing

en 35% de registros.

Esto puede inutilizar:

new vs returning analysis

aunque el revenue total siga siendo usable.

---

# **25\. DIMENSION-SPECIFIC COMPLETENESS**

La completitud debe poder evaluarse respecto a la pregunta.

Ejemplo:

Dataset:

100% revenue complete

65% customer identity complete

Puede ser:

sufficient for revenue

insufficient for retention

Por tanto:

quality is purpose-dependent.

---

# **26\. COVERAGE**

Coverage responde:

> ¿Qué proporción del universo que pretendemos analizar está realmente representada?

Ejemplo:

Un negocio opera:

Shopify  
Amazon  
Retail stores

pero el dataset solo contiene:

Shopify

La fuente puede estar perfectamente completa internamente.

Pero la cobertura del negocio es parcial.

---

# **27\. COMPLETENESS ≠ COVERAGE**

Ejemplo:

Shopify dataset completeness \= 100%

Business revenue coverage \= 62%

Ambos pueden ser simultáneamente ciertos.

---

# **28\. CHANNEL COVERAGE**

Debe poder detectarse:

Meta data present

Google data present

TikTok missing

para métricas blended.

---

# **29\. MARKET COVERAGE**

También:

Spain \= available

France \= available

Germany \= missing

---

# **30\. PRODUCT COVERAGE**

Ejemplo:

DTC catalog \= 100%

marketplace products \= unavailable

---

# **31\. CUSTOMER COVERAGE**

Puede existir:

identified\_customer\_share

para saber qué proporción puede utilizarse en análisis de cohortes.

---

# **32\. SAMPLE SIZE**

Debe registrarse:

sample\_size

cuando tenga sentido.

Ejemplos:

sessions

orders

customers

campaigns

SKUs

support tickets

---

# **33\. SAMPLE UNIT**

No basta con:

sample\_size \= 100

Debe conocerse:

sample\_unit \= orders

---

# **34\. SAMPLE SUFFICIENCY**

C6.3 debe poder determinar:

sufficient

marginal

insufficient

unknown

según:

metric

variance

decision type

measurement purpose

---

# **35\. NO UNIVERSAL SAMPLE THRESHOLD**

No imponer:

n \> 100 \= valid

para todo.

La suficiencia depende del tipo de análisis.

---

# **36\. EXAMPLE**

CVR \= 8%

con:

25 sessions

no debería recibir la misma robustez que:

CVR \= 8%

con:

250,000 sessions

---

# **37\. DENOMINATOR INTEGRITY**

Para rates y ratios debe validarse especialmente el denominador.

Ejemplo:

CVR \=  
orders / sessions

Si sessions presenta tracking incompleto:

CVR may be distorted

aunque orders sea correcto.

---

# **38\. DENOMINATOR AVAILABILITY**

Debe poder evaluar:

denominator available?

denominator complete?

denominator stable?

denominator definition consistent?

---

# **39\. DENOMINATOR CHANGE**

Una métrica puede parecer cambiar porque cambió la definición del denominador.

Ejemplo:

Antes:

sessions

Después:

users

Eso debe marcar:

measurement break

---

# **40\. NUMERATOR INTEGRITY**

Lo mismo aplica al numerador.

Ejemplo:

returns / orders

si returns está incompleto:

return rate artificially low

---

# **41\. METRIC COMPONENT QUALITY**

Una métrica derivada debe heredar limitaciones de sus componentes.

Ejemplo:

CAC \=  
spend / new customers

Si:

spend quality \= high

new customer classification quality \= low

CAC no puede recibir calidad alta automáticamente.

---

# **42\. WEAKEST MATERIAL COMPONENT**

Principio conceptual:

derived\_metric\_quality  
cannot ignore  
materially weak components

No significa necesariamente:

quality \= minimum(all dimensions)

Pero una deficiencia crítica no puede ser compensada mágicamente por otros datos excelentes.

---

# **43\. TRACKING HEALTH**

Debe poder representarse:

TRACKING\_HEALTH

---

# **44\. TRACKING INCIDENT TYPES**

Ejemplos:

event\_missing

duplicate\_events

event\_overcount

event\_undercount

schema\_change

tag\_removed

pixel\_failure

server\_side\_failure

consent\_impact

identity\_loss

UTM\_loss

source\_mapping\_error

timezone\_mismatch

La taxonomía debe ser extensible.

---

# **45\. INCIDENT SEVERITY**

La severidad técnica de un problema de tracking puede ser:

minor

material

critical

Esto NO es business severity.

---

# **46\. INCIDENT WINDOW**

Debe conocerse:

incident\_start

incident\_end

cuando sea posible.

---

# **47\. INCIDENT SCOPE**

Debe poder afectar:

source

metric

channel

market

device

event

period

---

# **48\. KNOWN VS SUSPECTED INCIDENT**

Debe distinguirse:

confirmed

suspected

Un agente no debe presentar un posible tracking issue como hecho confirmado.

---

# **49\. MEASUREMENT BREAK**

Debe poder detectarse:

measurement\_break

cuando cambia significativamente cómo se mide una métrica.

Ejemplos:

GA4 migration

new consent setup

pixel implementation change

server-side tracking activation

customer definition change

attribution window change

---

# **50\. PRE/POST BREAK**

Las series antes y después de un measurement break no deben asumirse directamente comparables.

C6.3 debe exponer este hecho a C6.2/C6.10.

---

# **51\. CONSISTENCY**

Consistency responde:

> ¿Los datos se comportan coherentemente dentro del mismo sistema y a través del tiempo?

Ejemplos:

orders \< refunds

podría ser sospechoso dependiendo de la definición.

O:

purchases \= 10,000

checkout completions \= 6,000

en un funnel donde deberían guardar relación.

---

# **52\. INTERNAL CONSISTENCY**

Debe poder comprobarse coherencia entre campos relacionados.

Ejemplo:

gross revenue  
\-  
discounts  
\-  
refunds  
≈  
net revenue

cuando la fórmula del negocio lo establezca.

---

# **53\. CROSS-SOURCE CONSISTENCY**

También:

Shopify orders

GA4 purchases

Meta attributed purchases

pueden diferir.

La diferencia no significa automáticamente error.

Pero debe poder medirse.

---

# **54\. SOURCE CONFLICT**

Debe existir conceptualmente:

SOURCE\_CONFLICT

cuando dos fuentes que deberían representar fenómenos relacionados muestran divergencias materiales.

---

# **55\. CONFLICT ≠ ERROR AUTOMÁTICO**

Ejemplo:

Meta revenue \= €150k

Shopify total revenue \= €120k

Meta puede utilizar atribución diferente.

Por tanto:

difference  
≠  
necessarily error

C6.3 debe considerar semántica de C6.1 antes de declarar conflicto real.

---

# **56\. SEMANTICALLY EXPECTED DIFFERENCE**

Debe poder distinguirse:

expected\_difference

de:

unexpected\_conflict

---

# **57\. RECONCILIATION**

Debe poder existir:

RECONCILIATION\_ASSESSMENT

entre fuentes.

Ejemplo:

Shopify revenue:  
€100,000

Finance recognized revenue:  
€96,000

Diferencia:

refund timing  
tax handling  
recognition timing

puede estar explicada.

---

# **58\. RECONCILIATION STATUS**

Estados conceptuales:

reconciled

within\_tolerance

unresolved\_difference

material\_conflict

not\_comparable

unknown

---

# **59\. TOLERANCE**

Los tolerances no deben hardcodearse universalmente.

Pueden depender de:

metric

source pair

tenant policy

measurement purpose

---

# **60\. CONFLICT RESOLUTION**

C6.3 NO debe inventar arbitrariamente cuál es la fuente correcta.

Puede producir:

preferred\_source\_candidate

si existe una policy explícita.

Pero debe conservar:

conflicting\_sources

y:

resolution\_basis

---

# **61\. DATA MATURITY**

Algunos datos cambian después de su primera aparición.

Ejemplos:

returns

chargebacks

LTV

subscription churn

platform attribution

fulfillment outcomes

Debe existir:

measurement\_maturity

---

# **62\. PROVISIONAL DATA**

Una observación puede estar:

provisional

Ejemplo:

Revenue de ayer puede modificarse por:

cancellations

refunds

late attribution

---

# **63\. FINAL DATA**

Puede existir:

final

cuando el proceso de negocio considere el período suficientemente cerrado.

---

# **64\. MATURITY STATES**

Valores conceptuales:

open

provisional

maturing

final

unknown

---

# **65\. ATTRIBUTION MATURITY**

Ejemplo:

Si Meta utiliza:

7-day click

el ROAS de ayer aún no ha completado toda su ventana.

Por tanto:

attribution\_maturity \= open

---

# **66\. COHORT MATURITY**

C6.2 identifica la edad de cohorte.

C6.3 juzga si esa madurez es suficiente para la métrica evaluada.

Ejemplo:

12-month LTV

de una cohorte de:

45 days

no puede ser observado de forma final.

---

# **67\. LATENCY**

Debe distinguirse:

event occurred

de:

data became available

---

# **68\. INGESTION LATENCY**

Conceptualmente:

source\_event\_at

source\_available\_at

ingested\_at

Esto permite detectar retrasos.

---

# **69\. SOURCE LAG**

Un retraso conocido puede ser normal.

Ejemplo:

finance data closes daily at 03:00

No debe considerarse automáticamente fallo.

---

# **70\. DATA FINALITY**

Finality responde:

> ¿Es razonable esperar que este valor siga cambiando?

Puede diferir de freshness.

Ejemplo:

fresh \= yes

final \= no

es perfectamente válido.

---

# **71\. MISSINGNESS**

Debe distinguirse por tipo.

Ejemplos:

random missing

systematic missing

source unavailable

field unavailable

not applicable

suppressed

privacy-limited

---

# **72\. SYSTEMATIC MISSINGNESS**

Es especialmente importante.

Ejemplo:

Si Safari tracking está sistemáticamente incompleto:

missingness is not random

y puede sesgar:

device comparisons

---

# **73\. PRIVACY / CONSENT EFFECTS**

Debe poder señalarse cuando:

consent

privacy controls

platform limitations

afectan a cobertura o medición.

No implica automáticamente que el dato sea inutilizable.

Debe quedar registrado.

---

# **74\. DEDUPLICATION**

Debe poder conocerse si la fuente requiere:

deduplication

Ejemplo:

browser purchase event

server purchase event

pueden duplicarse si no existe una clave correcta.

---

# **75\. DUPLICATION RATE**

Cuando sea posible:

duplicate\_rate

o una evidencia equivalente.

---

# **76\. CUSTOMER IDENTITY QUALITY**

Para métricas de cliente debe evaluarse:

identity\_resolution\_quality

Ejemplo:

Un usuario compra:

guest checkout

different email

different device

y puede contarse como múltiples clientes.

Esto afecta:

CAC

repeat rate

LTV

customer mix

---

# **77\. ORDER IDENTITY QUALITY**

También debe comprobarse:

unique order identification

para evitar duplicados.

---

# **78\. CURRENCY QUALITY**

Para métricas monetarias multi-market debe verificarse:

currency normalization

FX source

FX date

conversion consistency

cuando corresponda.

---

# **79\. TIMEZONE QUALITY**

Diferentes fuentes pueden utilizar:

UTC

business local time

ad account timezone

Esto puede crear aparentes divergencias diarias.

Debe poder detectarse.

---

# **80\. TIME ALIGNMENT**

Dos datasets pueden ser válidos pero cubrir períodos ligeramente diferentes.

Ejemplo:

Shopify:  
00:00–23:59 Europe/Madrid

Meta:  
00:00–23:59 America/Los\_Angeles

Una comparación diaria directa puede ser defectuosa.

---

# **81\. PERIOD COVERAGE**

Debe poder calcularse:

expected\_period

actual\_covered\_period

---

# **82\. TRANSFORMATION INTEGRITY**

C6.3 debe poder evaluar si la transformación que produjo una métrica fue ejecutada correctamente.

Ejemplo:

raw orders  
↓  
filter test orders  
↓  
classify new customers  
↓  
calculate CAC

---

# **83\. TRANSFORMATION VERSION**

Debe poder referenciar:

transformation\_id

transformation\_version

cuando sea relevante.

---

# **84\. TRANSFORMATION VALIDATION**

Debe poder conocer:

executed successfully?

records dropped?

unexpected nulls?

schema mismatch?

validation errors?

---

# **85\. LINEAGE**

C6.3 puede referenciar lineage.

Pero la reconstrucción completa:

raw data  
→ transformation  
→ metric  
→ conclusion

pertenece a C6.12.

---

# **86\. RAW VS DERIVED QUALITY**

Una fuente raw puede ser excelente mientras que la transformación derivada sea defectuosa.

Por tanto:

source quality  
≠  
derived metric quality

---

# **87\. MODEL-GENERATED VALUES**

Cuando C6.1 marque:

modeled

C6.3 debe poder evaluar elementos específicos del modelo.

Por ejemplo:

model\_version

training/reference window

input completeness

model validation status

prediction horizon

known limitations

---

# **88\. MODELED ≠ LOW QUALITY AUTOMÁTICAMENTE**

Un dato modelado puede ser muy útil.

No debe asumirse:

modeled \= bad

Debe evaluarse con criterios apropiados.

---

# **89\. INFERRED VALUES**

Cuando el valor sea:

inferred

debe conservarse qué evidencia permitió inferirlo.

C6.8 determinará posteriormente la confianza.

---

# **90\. MANUAL DATA**

Los datos introducidos manualmente no deben rechazarse automáticamente.

Pero pueden necesitar metadata como:

entered\_by

entered\_at

source\_document\_ref

verified

cuando sea apropiado.

---

# **91\. MANUAL ≠ UNRELIABLE**

Una cifra contable manualmente validada puede ser más fiable que una estimación automática.

La calidad depende de evidencia.

No del nivel de automatización.

---

# **92\. EXTERNAL DATA**

Benchmarks externos pueden presentar:

unknown methodology

unknown sample

publication lag

selection bias

C6.3 debe permitir registrar estas limitaciones.

---

# **93\. DATA PROVENANCE AVAILABILITY**

Debe poder evaluarse:

provenance\_complete

provenance\_partial

provenance\_unknown

Sin sustituir el contrato C6.12.

---

# **94\. QUALITY STATUS**

C6.3 debe producir un estado de calidad estructurado.

Propuesta inicial:

high

medium

low

insufficient

unknown

---

# **95\. HIGH**

Significa:

> Los datos presentan suficiente fiabilidad para soportar análisis material dentro del propósito previsto, sin limitaciones relevantes conocidas.

No significa:

perfect

---

# **96\. MEDIUM**

Significa:

> Los datos son utilizables, pero existen limitaciones que deben reflejarse en la fuerza de la conclusión.

---

# **97\. LOW**

Significa:

> Existen problemas materiales y cualquier conclusión debe tratarse con cautela.

---

# **98\. INSUFFICIENT**

Significa:

> La evidencia no permite sostener de forma responsable la evaluación solicitada.

---

# **99\. UNKNOWN**

Significa:

> No existe información suficiente para evaluar la calidad.

---

# **100\. QUALITY STATUS ≠ CONFIDENCE**

Ejemplo:

data\_quality \= high

pero:

cause\_confidence \= low

porque los datos están bien medidos pero la causalidad sigue siendo incierta.

---

# **101\. QUALITY SCORE**

Puede existir opcionalmente:

quality\_score

normalizado.

Pero no debe sustituir el assessment dimensional.

---

# **102\. NO MAGIC QUALITY SCORE**

Incorrecto:

quality \= 84%

sin explicar:

freshness

completeness

tracking

sample

conflicts

---

# **103\. CRITICAL BLOCKERS**

Debe poder existir:

quality\_blockers

Ejemplos:

denominator unavailable

tracking outage

source conflict unresolved

sample insufficient

period incomplete

customer identity broken

---

# **104\. MATERIAL LIMITATIONS**

Además:

quality\_limitations

para problemas que degradan pero no invalidan.

---

# **105\. WARNINGS**

Problemas menores pueden aparecer como:

quality\_warnings

---

# **106\. EVIDENCE REQUIREMENTS**

Cada métrica o uso puede declarar requisitos mínimos.

Ejemplo:

Para evaluar CAC podrían requerirse:

acquisition spend

new customers

customer definition

period

currency

---

# **107\. REQUIRED VS OPTIONAL EVIDENCE**

Debe distinguirse:

required evidence

supporting evidence

optional evidence

---

# **108\. MISSING REQUIRED EVIDENCE**

Si falta evidencia requerida:

assessment cannot be fully valid

Puede producirse:

insufficient

---

# **109\. PARTIAL EVIDENCE**

Si existe parte suficiente para una conclusión limitada:

quality \= low/medium

según el caso.

No debe forzarse un resultado binario.

---

# **110\. EVIDENCE STRENGTH**

C6.3 puede producir conceptualmente:

measurement\_evidence\_strength

por ejemplo:

strong

moderate

weak

insufficient

Esto no sustituye la confidence final.

---

# **111\. SOURCE CONFLICT EXAMPLE**

Supongamos:

Shopify orders \= 1,000

GA4 purchases \= 780

Meta purchases \= 920

No debemos decir directamente:

data quality \= bad

Primero:

Shopify \= transactional orders

GA4 \= tracked browser/server events

Meta \= attributed conversions

Las semánticas son diferentes.

C6.1 debe informar C6.3.

---

# **112\. TRUE CONFLICT EXAMPLE**

Dos extracciones de Shopify para el mismo:

tenant

period

filters

definition

producen:

1,000 orders

1,170 orders

sin explicación.

Esto sí debe producir:

material source conflict

---

# **113\. FRESHNESS EXAMPLE**

Stock:

last updated 18 hours ago

para un negocio con ventas rápidas.

Puede resultar:

freshness \= stale

aunque:

completeness \= high

---

# **114\. COMPLETENESS EXAMPLE**

Meta spend:

100% available

pero revenue:

only Spain  
France missing

Una métrica blended europea sería:

coverage incomplete

---

# **115\. SAMPLE EXAMPLE**

PDP conversion:

12 purchases / 180 sessions

puede ser utilizable descriptivamente pero insuficiente para una conclusión fuerte de tendencia.

---

# **116\. COHORT MATURITY EXAMPLE**

predicted 12m LTV \= €220

para una cohorte de 45 días.

Puede ser válido como:

prediction

pero no como:

observed 12m LTV

---

# **117\. TRACKING EXAMPLE**

Evento:

add\_to\_cart

dejó de enviarse durante:

14 hours

Entonces métricas dependientes de ATC deben quedar afectadas.

Pero:

orders

podría permanecer íntegro.

Quality debe ser:

metric-specific

---

# **118\. QUALITY DEPENDENCY GRAPH**

Una métrica derivada puede depender de otras.

Ejemplo:

Contribution after acquisition  
        │  
        ├── Net Revenue  
        ├── COGS  
        ├── fulfillment cost  
        ├── payment fees  
        └── CAC

La calidad del resultado depende de sus componentes materiales.

---

# **119\. QUALITY PROPAGATION**

Debe existir una política explícita para propagar problemas de calidad.

No asumir simplemente:

average quality score

porque una variable crítica puede invalidar el cálculo completo.

---

# **120\. CRITICAL INPUT**

Cada métrica derivada puede declarar:

critical\_inputs

Ejemplo:

Para:

CAC

son críticos:

cost numerator

customer denominator

---

# **121\. NON-CRITICAL INPUT**

Metadata secundaria puede faltar sin invalidar la métrica.

Debe evitarse:

one missing optional field  
\=  
entire metric invalid

---

# **122\. QUALITY POLICY**

Algunos umbrales de calidad deben ser configurables.

Ejemplo:

maximum acceptable source lag

minimum sample size

maximum missing record percentage

reconciliation tolerance

No hardcodearlos como verdades universales.

---

# **123\. QUALITY PROFILE**

Puede existir:

quality\_profile\_id

por:

metric

metric family

use case

---

# **124\. EXAMPLE QUALITY PROFILE**

Para:

inventory.stock\_coverage

podría requerirse:

freshness:  
very strict

sample size:  
not relevant

inventory completeness:  
critical

sales velocity completeness:  
critical

Mientras para:

annual gross margin

freshness horaria sería irrelevante.

---

# **125\. QUALITY ASSESSMENT SHAPE**

Conceptualmente:

data\_quality\_assessment:

    identity:  
        data\_quality\_assessment\_id  
        run\_id  
        observation\_id

    scope:  
        assessment\_scope  
        measurement\_purpose

    source:  
        source\_system  
        source\_type  
        source\_reliability\_profile

    dimensions:  
        source\_quality  
        freshness  
        completeness  
        coverage  
        sample\_sufficiency  
        denominator\_integrity  
        tracking\_health  
        consistency  
        measurement\_maturity  
        transformation\_integrity  
        reconciliation\_quality

    timing:  
        source\_updated\_at  
        ingested\_at  
        expected\_update\_frequency  
        source\_lag

    sample:  
        sample\_size  
        sample\_unit  
        sufficiency\_status

    completeness:  
        expected\_records  
        available\_records  
        missing\_records  
        required\_fields\_missing

    maturity:  
        maturity\_status  
        finality\_status

    tracking:  
        known\_incidents  
        suspected\_incidents  
        measurement\_breaks

    conflicts:  
        source\_conflicts  
        reconciliation\_status

    evidence:  
        required\_evidence\_missing  
        supporting\_evidence\_missing

    output:  
        overall\_quality\_status  
        evidence\_strength  
        blockers  
        limitations  
        warnings

---

# **126\. DATA QUALITY IS NOT A SINGLE NUMBER**

El contrato debe preservar:

overall status  
\+  
dimension-level assessment  
\+  
blockers  
\+  
limitations  
\+  
warnings

---

# **127\. QUALITY REASON CODES**

Conviene disponer de códigos estructurados.

Ejemplos:

DQ\_STALE\_SOURCE

DQ\_INCOMPLETE\_PERIOD

DQ\_LOW\_SAMPLE

DQ\_ZERO\_DENOMINATOR

DQ\_TRACKING\_OUTAGE

DQ\_SOURCE\_CONFLICT

DQ\_COHORT\_IMMATURE

DQ\_MISSING\_REQUIRED\_FIELD

DQ\_PARTIAL\_BUSINESS\_COVERAGE

DQ\_TRANSFORMATION\_ERROR

DQ\_UNKNOWN\_PROVENANCE

La taxonomía será versionable.

---

# **128\. REASON CODES VS HUMAN EXPLANATION**

Debe existir:

machine-readable reason

y opcionalmente:

human-readable explanation

Ejemplo:

code:  
DQ\_TRACKING\_OUTAGE

explanation:  
Add-to-cart tracking was unavailable for 14 hours.

---

# **129\. C6.3 Y OBSERVABILITY**

Los problemas de calidad deben ser observables posteriormente.

El panel debería poder responder:

¿Qué evaluaciones fueron degradadas por tracking?

¿Cuántas conclusiones se marcaron insufficient evidence?

¿Qué fuentes generan más conflictos?

¿Qué métricas tienen problemas recurrentes?

La instrumentación detallada pertenece a C6.15.

---

# **130\. C6.3 Y REPLAY**

Una ejecución histórica debe conservar el assessment de calidad que existía en ese momento.

No recalcular silenciosamente el pasado usando información descubierta posteriormente sin identificarlo como nueva evaluación.

---

# **131\. REASSESSMENT**

Debe ser posible ejecutar:

new quality assessment

sobre una observación histórica.

Pero debe recibir:

new assessment\_id

No sobrescribir el original.

---

# **132\. QUALITY STATUS HISTÓRICO**

Ejemplo:

En septiembre:

data\_quality \= medium

Posteriormente descubrimos:

tracking duplication

Puede crearse:

new assessment \= low

manteniendo ambos estados históricos.

---

# **133\. RELACIÓN CON C6.0**

C6.0 proporciona:

run

tenant

business

versions

input snapshot

as\_of\_at

C6.3 debe vincular su assessment con esa ejecución.

---

# **134\. RELACIÓN CON C6.1**

C6.1 aporta:

metric semantics

value

numerator

denominator

measurement basis

source reference

C6.3 evalúa su fiabilidad.

---

# **135\. RELACIÓN CON C6.2**

C6.2 determina:

context

cohort

comparability

C6.3 determina si los datos que representan esos contextos son fiables.

---

# **136\. RELACIÓN CON C6.4**

Un benchmark también debe tener su propio assessment de calidad.

Ejemplo:

industry benchmark

puede tener:

sample unknown

methodology partial

publication 18 months old

C6.4 lo representa.

C6.3 ayuda a juzgar su evidencia.

---

# **137\. RELACIÓN CON C6.5**

Un guardrail derivado de economics depende de la calidad de:

margin

COGS

CAC

returns

fees

Un guardrail calculado sobre datos pobres debe arrastrar esa limitación.

---

# **138\. RELACIÓN CON C6.6**

Las policies podrán definir requisitos mínimos como:

minimum data quality

maximum source age

minimum sample sufficiency

required source coverage

---

# **139\. RELACIÓN CON C6.7**

C6.7 deberá considerar calidad junto a comparabilidad.

Un benchmark muy comparable pero de calidad pésima no debe seleccionarse automáticamente.

---

# **140\. RELACIÓN CON C6.8**

Esta es una relación crítica.

C6.3 produce:

data quality

measurement evidence strength

limitations

C6.8 traduce esto, junto con otras señales, a:

confidence

Por tanto:

C6.3 ≠ Confidence Engine

---

# **141\. RELACIÓN CON C6.9**

C6.9 debe respetar:

data\_quality\_status

Ejemplo:

CAC \= €60

guardrail \= €45

data\_quality \= insufficient

no debería producir una afirmación categórica sin reconocer la insuficiencia.

---

# **142\. RELACIÓN CON C6.10**

Anomaly Detection debe considerar:

tracking incidents

measurement breaks

source outages

antes de interpretar un spike como anomalía empresarial.

---

# **143\. RELACIÓN CON C6.11**

Pattern Detection deberá poder distinguir:

business pattern

de:

shared measurement failure

Ejemplo:

Varias métricas caen simultáneamente porque:

GA4 tracking broke

no necesariamente porque el negocio colapsó.

---

# **144\. RELACIÓN CON C6.12**

C6.12 almacenará lineage completo.

C6.3 deberá aportar:

source refs

transformation refs

conflicts

quality assessments

known limitations

---

# **145\. RELACIÓN CON C6.13**

El Finding debe poder comunicar limitaciones materiales.

Ejemplo:

finding:  
CAC appears above sustainable threshold

limitation:  
customer identity coverage \= 68%

---

# **146\. TESTS MÍNIMOS**

## **TEST 1 — Missing Data**

Datos requeridos ausentes deben producir:

insufficient

cuando bloqueen el análisis.

---

## **TEST 2 — Zero vs Missing**

Debe conservarse la diferencia definida por C6.1.

---

## **TEST 3 — Stale Source**

Fuente completa pero demasiado antigua debe degradar freshness.

---

## **TEST 4 — Partial Period**

20 días disponibles de un período de 30 deben degradar completeness.

---

## **TEST 5 — Partial Business Coverage**

Shopify completo pero Amazon ausente debe degradar coverage cuando la métrica sea blended.

---

## **TEST 6 — Small Sample**

CVR con 20 sesiones debe reflejar sample insufficiency.

---

## **TEST 7 — Large Sample**

La misma métrica con muestra amplia no debe recibir la misma limitación.

---

## **TEST 8 — Tracking Outage**

ATC tracking caído debe degradar métricas dependientes de ATC.

---

## **TEST 9 — Unaffected Metric**

El mismo tracking outage no debe degradar automáticamente revenue si revenue procede de otra fuente intacta.

---

## **TEST 10 — Duplicate Events**

Duplicación de purchase events debe detectarse como problema.

---

## **TEST 11 — Source Semantic Difference**

Meta attributed purchases y Shopify orders no deben declararse conflicto únicamente porque difieran.

---

## **TEST 12 — True Source Conflict**

Dos datasets semánticamente equivalentes con divergencia material deben generar conflicto.

---

## **TEST 13 — Immature Attribution**

ROAS reciente con attribution window abierta debe marcarse provisional.

---

## **TEST 14 — Immature Cohort**

Observed 12m LTV de cohorte de 60 días debe fallar.

---

## **TEST 15 — Modeled LTV**

Predicted 12m LTV puede seguir siendo válido si está correctamente identificado como modeled/predicted.

---

## **TEST 16 — Denominator Failure**

CVR con denominator incompleto debe degradarse aunque orders sean correctos.

---

## **TEST 17 — Currency Misalignment**

Ingresos EUR y USD no normalizados deben bloquear una agregación monetaria.

---

## **TEST 18 — Timezone Misalignment**

Debe poder detectar posibles discrepancias por ventanas temporales distintas.

---

## **TEST 19 — Transformation Error**

Un pipeline que elimina registros inesperadamente debe degradar integrity.

---

## **TEST 20 — Manual Verified Data**

Un dato manual validado no debe clasificarse automáticamente como low quality.

---

## **TEST 21 — Privacy Coverage**

Pérdida sistemática de tracking por consentimiento debe quedar registrada.

---

## **TEST 22 — Reassessment**

Una nueva evaluación de calidad no debe sobrescribir la original.

---

# **147\. ANTI-PATRÓN — AVAILABLE \= TRUSTWORTHY**

Incorrecto:

API returned a value  
therefore value is reliable

---

# **148\. ANTI-PATRÓN — OFFICIAL PLATFORM \= GROUND TRUTH**

Incorrecto:

Meta says it  
therefore it is causal truth

La semántica debe preservarse.

---

# **149\. ANTI-PATRÓN — TODO O NADA**

Incorrecto:

dataset has one issue  
therefore everything is unusable

La calidad debe evaluarse por:

metric

dimension

purpose

---

# **150\. ANTI-PATRÓN — PROMEDIAR CALIDAD**

Incorrecto:

9 dimensions good  
1 critical denominator broken

overall quality \= 90%

Una deficiencia crítica puede invalidar el resultado.

---

# **151\. ANTI-PATRÓN — SAMPLE SIZE UNIVERSAL**

Incorrecto:

minimum sample \= 100

para cualquier métrica.

---

# **152\. ANTI-PATRÓN — IGNORAR FINALITY**

Incorrecto:

yesterday ROAS

tratado como completamente cerrado cuando la atribución sigue madurando.

---

# **153\. ANTI-PATRÓN — IGNORAR MEASUREMENT BREAK**

Incorrecto:

CVR before tracking migration  
vs  
CVR after tracking migration

sin señalar posible ruptura metodológica.

---

# **154\. ANTI-PATRÓN — NULL TO ZERO**

Nunca:

missing customer IDs  
→  
0 returning customers

---

# **155\. ANTI-PATRÓN — CONFLICT \= PICK ONE**

Incorrecto:

Source A \= €100k

Source B \= €130k

choose Source A

sin:

policy

provenance

reconciliation

---

# **156\. ANTI-PATRÓN — MODELED \= FACT**

Incorrecto:

predicted LTV \= €240

presentado como:

customers generated €240

---

# **157\. ANTI-PATRÓN — TRACKING ISSUE AS BUSINESS ISSUE**

Incorrecto:

ATC fell 70%  
therefore customers stopped adding products to cart

si:

ATC event broke

---

# **158\. ACCEPTANCE CRITERIA**

Para cualquier observación material, C6.3 debe permitir responder:

1\. ¿Cuál es la fuente?

2\. ¿Qué tipo de fuente es?

3\. ¿Cuándo se actualizó?

4\. ¿Está suficientemente fresca?

5\. ¿Está completo el período?

6\. ¿Están completos los campos necesarios?

7\. ¿Qué proporción del negocio cubre?

8\. ¿Qué mercados cubre?

9\. ¿Qué canales cubre?

10\. ¿Cuál es la muestra?

11\. ¿La muestra es suficiente?

12\. ¿El denominador es fiable?

13\. ¿El numerador es fiable?

14\. ¿Existen problemas de tracking?

15\. ¿Existen measurement breaks?

16\. ¿Existen datos duplicados?

17\. ¿Existe pérdida sistemática?

18\. ¿Hay conflictos entre fuentes?

19\. ¿Los conflictos están explicados?

20\. ¿El período está cerrado o todavía madura?

21\. ¿La attribution window está cerrada?

22\. ¿La cohorte está suficientemente madura?

23\. ¿La transformación fue válida?

24\. ¿La provenance está disponible?

25\. ¿Qué evidencia requerida falta?

26\. ¿Qué blockers existen?

27\. ¿Qué limitations existen?

28\. ¿Cuál es el quality status?

29\. ¿Qué fuerza de evidencia permite?

30\. ¿Puede utilizarse responsablemente para la evaluación solicitada?

---

# **159\. DEFINITION OF DONE**

C6.3 estará formalmente definido cuando exista:

Data Quality Assessment Model

Source Classification

Source Reliability Model

Freshness Model

Completeness Model

Coverage Model

Sample Sufficiency Model

Numerator Integrity

Denominator Integrity

Tracking Health Model

Tracking Incident Taxonomy

Measurement Break Model

Internal Consistency

Cross-Source Consistency

Source Conflict Model

Reconciliation Model

Measurement Maturity

Finality Model

Latency Model

Missingness Model

Identity Resolution Quality

Transformation Integrity

Derived Metric Quality Propagation

Modeled Data Handling

Manual Data Handling

External Data Handling

Quality Status

Evidence Strength

Quality Blockers

Quality Limitations

Quality Warnings

Reason Codes

Quality Policies

Validation Rules

Test Fixtures

---

# **160\. RESULTADO ARQUITECTÓNICO**

Antes de C6.3:

CAC \= €48

Después de C6.1 sabemos:

New Customer CAC  
Paid Acquisition  
Observed  
Average  
Spain  
August

Después de C6.2 sabemos:

Context:  
Meta prospecting  
Spain  
new customers  
normal season

Después de C6.3 podemos saber:

CAC \= €48

Source quality:  
High

Spend completeness:  
100%

Customer identity coverage:  
96%

Freshness:  
High

Sample:  
1,284 new customers

Tracking incidents:  
None known

Source conflicts:  
None material

Measurement maturity:  
Final

Overall data quality:  
High

O, alternativamente:

CAC \= €48

Spend completeness:  
100%

Customer identity coverage:  
61%

Tracking incident:  
Customer deduplication failure

Source conflict:  
Material

Overall data quality:  
Insufficient

El número es idéntico.

La fuerza con la que puede interpretarse no lo es.

---

# **161\. PRINCIPIO FINAL DE C6.3**

C6.3 debe imponer:

Data availability  
is not data reliability.

Y:

A precise number  
can still be unreliable.

Y especialmente:

quality\_of\_conclusion  
\<=  
quality\_of\_evidence

Por tanto:

if evidence is insufficient:  
do not manufacture judgment.

---

# **162\. SALIDA FORMAL DE C6.3**

C6.3 produce conceptualmente:

DATA\_QUALITY\_ASSESSMENT

incluyendo:

quality dimensions

overall quality status

evidence strength

blockers

limitations

warnings

tracking incidents

source conflicts

measurement maturity

No produce:

BENCHMARK

GUARDRAIL

BUSINESS STATUS

SEVERITY

DIAGNOSIS

PRIORITY

RECOMMENDATION

---

# **C6.3 — ESTADO**

CONTRACT:  
C6.3 Data Quality & Measurement Reliability

TYPE:  
Evidence Quality / Measurement Reliability

PHASE:  
6 — Benchmarks & Guardrails

STATUS:  
Architecture Defined

IMPLEMENTATION:  
Not yet implemented

DEPENDS ON:  
C6.0 Runtime Envelope & Identity  
C6.1 Metric Semantics & Observation  
C6.2 Context & Comparable Cohort

NEXT CONTRACT:  
C6.4 — Benchmark Reference Contract

