# **C6.10 — ANOMALY DETECTION CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Anomaly Detection Contract define cómo EcomScaling IA debe detectar, clasificar y representar comportamientos anómalos en métricas, series temporales, cohortes o segmentos.

Su misión es responder:

> **¿Está ocurriendo algo fuera del comportamiento esperado y qué tipo de desviación representa?**

C6.10 debe permitir distinguir entre:

point anomaly

temporary spike

temporary drop

trend deterioration

trend improvement

regime change

structural deterioration

structural improvement

mix-driven change

seasonal deviation

possible data anomaly

measurement break

sin asumir que toda desviación representa necesariamente un problema real de negocio.

---

# **2\. PROBLEMA QUE RESUELVE**

Una arquitectura sencilla podría detectar:

CVR yesterday:  
1.5%

average CVR:  
2.8%

y concluir:

Anomaly detected.

Pero eso sería insuficiente.

La caída podría deberse a:

normal daily variance

Black Friday traffic mix

new market launch

measurement outage

mobile traffic increase

promotion ending

real CRO deterioration

C6.10 debe determinar primero:

WHAT changed?

HOW unusual is it?

WHEN did it begin?

HOW long has it persisted?

WHICH segments are affected?

IS it explained by context?

COULD it be a measurement issue?

antes de producir una señal de anomalía fiable.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Debe mantenerse:

DEVIATION  
≠  
ANOMALY

Una diferencia respecto a un promedio no implica automáticamente anomalía.

---

# **4\. SEGUNDO PRINCIPIO**

También:

ANOMALY  
≠  
BUSINESS PROBLEM

Una anomalía puede representar:

positive event

expected seasonal movement

business event

data issue

real deterioration

---

# **5\. TERCER PRINCIPIO**

Debe mantenerse:

ANOMALY  
≠  
ROOT CAUSE

Detectar:

CVR structural deterioration

no significa haber demostrado:

checkout friction

La causalidad pertenece principalmente a Fase 3\.

---

# **6\. CUARTO PRINCIPIO**

Debe mantenerse:

ANOMALY  
≠  
PATTERN

C6.10 analiza principalmente anomalías de una métrica, serie, segmento o distribución.

C6.11 detectará combinaciones multivariables como:

Revenue ↑  
\+  
Contribution ↓  
\+  
Discount rate ↑

---

# **7\. RESPONSABILIDAD**

C6.10 debe determinar:

WHAT is anomalous?

WHAT baseline was expected?

HOW far did it deviate?

WHEN did deviation begin?

HOW long did it persist?

IS it isolated or persistent?

IS it local or broad?

IS it segment-specific?

IS it seasonally explainable?

IS it caused by mix?

IS there a measurement break?

HOW confident are we?

WHAT evidence supports the anomaly?

---

# **8\. LO QUE C6.10 NO DEBE HACER**

C6.10 NO debe decidir:

root cause

business priority

strategy

playbook

recommended action

execution

Puede producir:

anomaly detected

pero no:

reduce Meta budget

---

# **9\. ANOMALY OBJECT**

La salida principal será conceptualmente:

ANOMALY\_DETECTION

---

# **10\. ANOMALY\_ID**

Toda anomalía material debe disponer de:

anomaly\_id

único.

---

# **11\. RUN RELATION**

Debe estar vinculada a:

run\_id

trace\_id

---

# **12\. SUBJECT**

Toda anomalía debe saber qué analiza.

Puede ser:

metric

metric series

segment

cohort

distribution

funnel stage

---

# **13\. SUBJECT\_REF**

Debe existir:

subject\_type

subject\_ref

---

# **14\. METRIC LINKAGE**

Cuando sea métrica:

metric\_id

metric\_version

de C6.1.

---

# **15\. ANOMALY TYPE**

Taxonomía inicial:

point\_anomaly

spike

drop

trend\_anomaly

trend\_acceleration

trend\_deceleration

regime\_change

structural\_deterioration

structural\_improvement

seasonal\_deviation

mix\_effect

segment\_anomaly

cohort\_anomaly

volatility\_anomaly

data\_anomaly

measurement\_break

---

# **16\. POINT ANOMALY**

Representa una observación puntual fuera del comportamiento esperado.

Ejemplo:

Daily CVR:

2.8  
2.7  
2.9  
2.8  
1.2  
2.8

El:

1.2

puede ser un point anomaly.

---

# **17\. POINT ANOMALY ≠ STRUCTURAL CHANGE**

Una observación puntual no debe convertirse automáticamente en:

structural deterioration

---

# **18\. SPIKE**

Incremento abrupto.

Ejemplo:

refund rate:  
4% → 13%

---

# **19\. DROP**

Disminución abrupta.

Ejemplo:

checkout completion:  
58% → 32%

---

# **20\. TREND ANOMALY**

Una desviación persistente de tendencia.

Ejemplo:

CAC:

35  
37  
39  
42  
46  
50

Puede no existir un único punto extremo.

Pero existe:

persistent deterioration

---

# **21\. TREND ACCELERATION**

La métrica ya estaba cambiando, pero el ritmo se acelera.

Ejemplo:

CAC monthly growth:

\+2%  
\+3%  
\+4%  
\+11%  
\+15%

---

# **22\. TREND DECELERATION**

La evolución favorable se frena.

Ejemplo:

repeat purchase improvement:

\+8%  
\+6%  
\+3%  
\+1%

---

# **23\. REGIME CHANGE**

Representa un cambio estable en el nivel o comportamiento de la serie.

Ejemplo:

Antes:

CVR ≈ 3.2%

Después:

CVR ≈ 2.3%

durante un período prolongado.

---

# **24\. REGIME CHANGE ≠ POINT ANOMALY**

Un régimen nuevo puede no tener ningún punto extremadamente raro.

Su característica es:

new persistent operating level

---

# **25\. STRUCTURAL DETERIORATION**

Representa deterioro persistente que parece formar parte del nuevo comportamiento del negocio.

Ejemplo:

new-customer retention

empeora durante:

five consecutive cohorts

---

# **26\. STRUCTURAL IMPROVEMENT**

También deben detectarse anomalías positivas.

Ejemplo:

contribution margin

mejora de forma sostenida por encima de su rango histórico.

---

# **27\. POSITIVE ANOMALY**

No toda anomalía es negativa.

Valores conceptuales:

positive

negative

neutral

unknown

---

# **28\. ANOMALY DIRECTION**

Debe existir:

anomaly\_direction

---

# **29\. SEASONAL DEVIATION**

Representa un comportamiento diferente al patrón estacional esperado.

Ejemplo:

Históricamente:

December CVR \+25%

Año actual:

December CVR \-5%

La anomalía no es comparar diciembre contra noviembre.

Es comparar:

actual December behavior  
vs  
expected December behavior

---

# **30\. MIX EFFECT**

Una métrica agregada puede cambiar debido a composición.

Ejemplo:

blended CVR ↓

porque:

mobile traffic share ↑

aunque:

mobile CVR stable

desktop CVR stable

Esto puede clasificarse como:

mix-driven anomaly

---

# **31\. MIX EFFECT ≠ UNDERLYING PERFORMANCE CHANGE**

Debe mantenerse:

aggregate shift

separado de:

within-segment deterioration

---

# **32\. SEGMENT ANOMALY**

La anomalía puede existir solo en:

mobile

new customers

Germany

Meta

specific SKU

mientras el blended permanece estable.

---

# **33\. COHORT ANOMALY**

Ejemplo:

April cohort  
repeat rate \= 22%

May cohort \= 21%

June cohort \= 13%

Puede existir una anomalía de cohorte.

---

# **34\. VOLATILITY ANOMALY**

Una métrica puede conservar su media pero volverse mucho más volátil.

Ejemplo:

Antes:

CVR:  
2.8–3.1%

Después:

CVR:  
1.7–4.5%

---

# **35\. DATA ANOMALY**

Debe poder existir:

possible\_data\_anomaly

cuando la desviación parece provenir de:

tracking

ETL

source outage

duplication

schema change

timezone issue

---

# **36\. MEASUREMENT BREAK**

Representa un cambio en cómo se mide.

Ejemplo:

server-side tracking enabled

y de repente:

reported conversions \+25%

Esto no debe interpretarse automáticamente como mejora empresarial.

---

# **37\. BUSINESS ANOMALY VS DATA ANOMALY**

Debe distinguirse:

business\_anomaly

measurement\_anomaly

uncertain\_origin

---

# **38\. ANOMALY ORIGIN CLASS**

Valores conceptuales:

business

measurement

context

mix

expected\_event

unknown

No significa root cause.

Representa la naturaleza probable de la desviación.

---

# **39\. EXPECTED BASELINE**

Toda anomalía necesita alguna expectativa.

Debe existir:

expected\_baseline

---

# **40\. BASELINE TYPES**

Ejemplos:

historical\_mean

historical\_median

rolling\_baseline

same-season baseline

peer-normalized baseline

trend forecast

cohort baseline

segment baseline

model\_expected\_value

---

# **41\. BASELINE RESOLUTION**

La baseline debe resolverse utilizando:

C6.4 Benchmark Reference

C6.7 Reference Resolution

cuando corresponda.

---

# **42\. NO BASELINE, NO STRONG ANOMALY**

Si no existe referencia de comportamiento esperado:

anomaly confidence

debe limitarse.

---

# **43\. EXPECTED VALUE**

Puede existir:

expected\_value

---

# **44\. EXPECTED RANGE**

Preferiblemente:

expected\_lower\_bound

expected\_upper\_bound

cuando exista variabilidad normal.

---

# **45\. EXPECTED DISTRIBUTION**

En análisis más avanzados:

expected\_distribution

puede ser mejor que un único valor.

---

# **46\. OBSERVED VALUE**

Debe conservar:

observed\_value

---

# **47\. RESIDUAL**

Puede calcularse:

residual \=  
observed \- expected

---

# **48\. RELATIVE DEVIATION**

También:

relative\_deviation

---

# **49\. STANDARDIZED DEVIATION**

Cuando estadísticamente apropiado:

z\_score

robust\_z\_score

standardized\_residual

pueden utilizarse.

---

# **50\. NO MANDATORY Z-SCORE**

No toda anomalía debe detectarse mediante:

z-score \> X

---

# **51\. DETECTION METHOD**

Debe existir:

detection\_method

---

# **52\. METHOD TYPES**

Ejemplos conceptuales:

rule\_based

statistical

time\_series

change\_point

seasonal\_model

cohort\_comparison

distribution\_shift

model\_based

hybrid

---

# **53\. METHOD\_ID**

Debe existir:

detection\_method\_id

detection\_method\_version

para reproducibilidad.

---

# **54\. RULE-BASED DETECTION**

Ejemplo:

metric changed \> configured threshold  
for N periods

---

# **55\. STATISTICAL DETECTION**

Puede utilizar:

variance

confidence interval

control limits

robust statistics

---

# **56\. TIME-SERIES DETECTION**

Puede considerar:

trend

seasonality

autocorrelation

---

# **57\. CHANGE-POINT DETECTION**

Busca:

structural breakpoint

en la serie.

---

# **58\. DISTRIBUTION SHIFT**

Puede detectar cambios no visibles en el promedio.

Ejemplo:

AOV average stable

pero cambia fuertemente la distribución de pedidos.

---

# **59\. HYBRID DETECTION**

Puede combinar:

statistical signal  
\+  
business guardrail  
\+  
context

---

# **60\. MODEL-BASED ANOMALY**

Puede utilizar modelos predictivos.

Debe conservar:

model\_id

model\_version

---

# **61\. DETECTION PARAMETERS**

Toda ejecución debe poder registrar parámetros relevantes:

window size

sensitivity

minimum observations

seasonal period

minimum persistence

---

# **62\. PARAMETERS MUST BE VERSIONED**

No queremos que el mismo algoritmo produzca resultados históricos distintos sin explicación.

---

# **63\. ANOMALY SCORE**

Puede existir:

anomaly\_score

---

# **64\. SCORE MEANING**

Debe documentarse su escala.

No asumir:

0.91 \= 91% chance anomaly

salvo modelo calibrado.

---

# **65\. ANOMALY STRENGTH**

Puede existir:

weak

moderate

strong

extreme

---

# **66\. STRENGTH ≠ SEVERITY**

Una anomalía estadísticamente extrema puede ser irrelevante económicamente.

Ejemplo:

support tickets:  
2 → 6

puede ser enorme porcentualmente pero poco material.

---

# **67\. BUSINESS MATERIALITY**

Debe vincularse con C6.9:

materiality

---

# **68\. ANOMALY SEVERITY**

Puede existir una severidad de anomalía.

Pero debe basarse en:

magnitude

persistence

materiality

guardrail proximity

business exposure

---

# **69\. ANOMALY SEVERITY ≠ BUSINESS PRIORITY**

Fase 4 seguirá siendo responsable de prioridad.

---

# **70\. ONSET**

Debe existir:

detected\_onset\_at

o:

detected\_onset\_period

---

# **71\. DETECTED\_AT**

También:

detected\_at

No confundir con el momento en que empezó.

---

# **72\. DURATION**

Debe poder calcular:

duration

---

# **73\. PERSISTENCE**

Estados conceptuales:

isolated

short\_lived

persistent

structural

unknown

---

# **74\. ISOLATED**

Una sola observación.

---

# **75\. SHORT-LIVED**

Varias observaciones pero recuperación rápida.

---

# **76\. PERSISTENT**

La desviación continúa.

---

# **77\. STRUCTURAL**

Existe evidencia de un nuevo régimen.

---

# **78\. RECOVERY**

Debe poder detectarse:

recovered

recovering

not\_recovered

---

# **79\. RECOVERY DATE**

Cuando corresponda:

recovered\_at

---

# **80\. OPEN ANOMALY**

Una anomalía puede permanecer:

open

si continúa.

---

# **81\. ANOMALY LIFECYCLE**

Estados conceptuales:

detected

confirmed

monitoring

resolved

dismissed

reclassified

---

# **82\. DETECTED**

Se ha identificado una señal.

---

# **83\. CONFIRMED**

Existe evidencia suficiente para considerarla anomalía real.

---

# **84\. MONITORING**

Se mantiene abierta para observar persistencia.

---

# **85\. RESOLVED**

La métrica regresó a comportamiento esperado o se estabilizó.

---

# **86\. DISMISSED**

Posteriormente se determina que:

no meaningful anomaly existed

---

# **87\. RECLASSIFIED**

Ejemplo:

Inicialmente:

business anomaly

posteriormente:

measurement break

---

# **88\. DO NOT DELETE ORIGINAL CLASSIFICATION**

Debe mantenerse historial.

---

# **89\. SUBJECT SCOPE**

Toda anomalía debe indicar su scope.

Ejemplo:

business-wide

market-specific

channel-specific

device-specific

customer-segment

product-specific

cohort-specific

---

# **90\. LOCALITY**

Puede existir:

local

multi-segment

business-wide

unknown

---

# **91\. LOCAL ANOMALY**

Ejemplo:

Mobile Spain CVR ↓

pero:

Desktop stable

---

# **92\. BROAD ANOMALY**

Ejemplo:

CVR ↓  
across all devices and markets

---

# **93\. SEGMENT CONTRIBUTION**

Debe poder analizar qué segmentos explican un cambio agregado.

---

# **94\. MIX DECOMPOSITION**

Conceptualmente puede separar:

within-segment change

mix change

---

# **95\. EXAMPLE — MIX**

Period A:

Mobile share:  
60%

Mobile CVR:  
2%

Desktop share:  
40%

Desktop CVR:  
4%

Period B:

Mobile share:  
80%

Mobile CVR:  
2%

Desktop share:  
20%

Desktop CVR:  
4%

Blended CVR cae.

Pero:

within-segment performance:  
stable

Resultado:

mix\_effect

---

# **96\. SIMPSON'S PARADOX PREPARATION**

C6.10 debe proporcionar suficiente información para que C6.11 detecte:

Simpson's paradox

cuando corresponda.

---

# **97\. CONTEXT ADJUSTMENT**

Antes de declarar una anomalía debe considerarse:

seasonality

promotion

market events

business changes

mix shifts

---

# **98\. EXPECTED EVENT**

Debe poder existir:

expected\_event

Ejemplo:

Black Friday

price increase

product launch

site migration

---

# **99\. EVENT-EXPLAINED DEVIATION**

Si la desviación coincide con un evento esperado:

anomaly may be downgraded

o etiquetada:

context\_explained

---

# **100\. CONTEXT EXPLANATION ≠ ROOT CAUSE**

Ejemplo:

promotion period

puede explicar temporalmente un cambio de AOV.

Pero C6.10 no debe afirmar causalidad definitiva si no está demostrada.

---

# **101\. SEASONAL ADJUSTMENT**

Debe poder comparar:

actual

contra:

seasonally\_expected

---

# **102\. YEAR-OVER-YEAR SEASONALITY**

En negocios estacionales puede ser más útil:

same week last year

que:

previous week

---

# **103\. HOLIDAY SHIFT**

Debe poder considerar eventos móviles.

Ejemplo:

Easter

no cae siempre en la misma fecha.

---

# **104\. PROMOTION CONTEXT**

Una promoción puede cambiar:

CVR

AOV

margin

return rate

No debe marcarse automáticamente como anomalía estructural.

---

# **105\. PRICE CHANGE**

Debe registrarse como contexto relevante.

---

# **106\. SITE CHANGE**

Ejemplos:

checkout redesign

site migration

theme change

pueden coincidir con change points.

---

# **107\. TRACKING CHANGE**

Debe cruzarse con C6.3.

---

# **108\. DATA QUALITY GATE**

Una anomalía no debe confirmarse fuertemente si:

data\_quality \= insufficient

---

# **109\. TRACKING INCIDENT**

Si existe:

tracking incident

en el mismo período:

measurement anomaly

debe considerarse.

---

# **110\. SOURCE CROSS-CHECK**

Cuando sea posible, una anomalía puede validarse con otra fuente.

Ejemplo:

Shopify orders ↓

y:

warehouse shipments ↓

refuerzan señal.

---

# **111\. SOURCE DISAGREEMENT**

Ejemplo:

GA4 purchases ↓ 40%

Shopify orders stable

puede indicar:

tracking anomaly

---

# **112\. DATA ANOMALY CONFIDENCE**

Debe existir:

data\_anomaly\_confidence

cuando se sospeche fallo de medición.

---

# **113\. BUSINESS ANOMALY CONFIDENCE**

Separadamente:

business\_anomaly\_confidence

---

# **114\. CONFIDENCE**

Debe apoyarse en C6.8.

---

# **115\. CONFIDENCE INPUTS**

Ejemplos:

data quality

baseline quality

sample size

deviation magnitude

persistence

cross-source confirmation

context explanation

measurement incidents

---

# **116\. HIGH ANOMALY CONFIDENCE**

Puede existir cuando:

strong baseline

large deviation

persistent behavior

high-quality data

no contextual explanation

---

# **117\. LOW ANOMALY CONFIDENCE**

Ejemplo:

small sample

tracking instability

only one observation

weak baseline

---

# **118\. ANOMALY \+ GUARDRAIL**

Una anomalía puede cruzarse con guardrails.

Ejemplo:

refund rate spike

y simultáneamente:

critical guardrail breached

---

# **119\. ANOMALY ≠ GUARDRAIL BREACH**

Una métrica puede ser anómala pero seguir dentro de límites.

---

# **120\. GUARDRAIL BREACH ≠ ANOMALY**

Una métrica puede estar:

persistently bad

sin ser nueva o anómala.

Ejemplo:

CAC lleva 8 meses por encima del límite.

No es un cambio reciente.

Sigue siendo problema.

---

# **121\. THIS DISTINCTION IS CRITICAL**

ANOMALY:  
Is this unusual?

GUARDRAIL:  
Is this unsafe?

Son preguntas distintas.

---

# **122\. ANOMALY VS BENCHMARK**

Igualmente:

benchmark:  
How do we compare?

anomaly:  
Is current behavior unusual relative to expectation?

---

# **123\. TREND DIRECTION**

Debe poder producir:

improving

stable

deteriorating

volatile

reversing

unknown

---

# **124\. TREND STRENGTH**

Puede ser:

weak

moderate

strong

---

# **125\. TREND SLOPE**

Cuando sea apropiado:

trend\_slope

---

# **126\. RATE OF CHANGE**

También:

rate\_of\_change

---

# **127\. SECOND-ORDER CHANGE**

Puede ser útil detectar:

acceleration

de deterioro.

---

# **128\. CHANGE POINT**

Debe poder existir:

change\_point\_at

---

# **129\. CHANGE POINT CONFIDENCE**

Puede existir:

change\_point\_confidence

---

# **130\. MULTIPLE CHANGE POINTS**

Una serie puede tener varios regímenes.

Ejemplo:

pre-launch

post-launch

post-price-increase

---

# **131\. STRUCTURAL BREAK**

Puede clasificarse:

business break

measurement break

unknown

---

# **132\. OUTLIER HANDLING**

No eliminar automáticamente outliers antes de evaluarlos.

Podrían ser precisamente la anomalía relevante.

---

# **133\. OUTLIER EXCLUSION**

Si se excluyen:

exclusion\_reason

debe quedar registrado.

---

# **134\. ROBUST STATISTICS**

Métodos robustos pueden ser preferibles cuando existen outliers frecuentes.

No se obliga a una técnica concreta.

---

# **135\. MISSING PERIODS**

Una serie con:

missing periods

debe registrar esa limitación.

---

# **136\. IRREGULAR FREQUENCY**

Debe poder gestionar series no perfectamente regulares.

Pero la detection confidence puede degradarse.

---

# **137\. MINIMUM HISTORY**

Algunos métodos requieren:

minimum\_history

---

# **138\. NO HISTORY**

En cold start:

historical anomaly detection

puede no ser posible.

---

# **139\. COLD START ANOMALY**

Puede utilizar:

peer expectations

configured ranges

model expectation

si policy lo permite.

Debe etiquetarse:

cold\_start\_detection

---

# **140\. NO FALSE HISTORY**

Nunca inventar baseline interna.

---

# **141\. FORECAST RESIDUAL**

Cuando exista forecast:

actual \- forecast

puede ayudar a detectar anomalías.

---

# **142\. FORECAST ERROR**

Debe considerarse la uncertainty del forecast.

---

# **143\. PREDICTION INTERVAL**

Una observación dentro de:

prediction interval

normalmente no debería ser anomalía.

---

# **144\. MODEL DRIFT**

Puede existir:

model\_drift

pero se relaciona más con infraestructura/model monitoring.

C6.10 puede señalarlo si afecta a baseline predictiva.

---

# **145\. BUSINESS MODEL CHANGE**

Si el ecommerce cambia sustancialmente:

DTC → subscription

históricos anteriores pueden dejar de ser baseline válida.

---

# **146\. CONTEXT REGIME**

Puede existir:

context\_regime\_id

para separar períodos estructuralmente distintos.

---

# **147\. ANOMALY SUPPRESSION**

Algunas anomalías pueden ser suprimidas por eventos conocidos.

Ejemplo:

site intentionally offline

---

# **148\. SUPPRESSION ≠ DELETION**

Debe mantenerse:

anomaly detected

suppressed \= true

suppression\_reason

---

# **149\. SUPPRESSION TYPES**

Ejemplos:

known\_event

planned\_maintenance

expected\_promotion

known\_measurement\_issue

---

# **150\. AUTOMATIC SUPPRESSION**

Solo cuando policy lo permita.

---

# **151\. MANUAL SUPPRESSION**

Debe ser auditable.

---

# **152\. ANOMALY STATUS**

Puede existir:

candidate

confirmed

dismissed

suppressed

resolved

---

# **153\. CANDIDATE ANOMALY**

Algoritmo detecta señal.

Todavía puede requerir validación.

---

# **154\. CONFIRMED ANOMALY**

Cumple los requisitos de evidencia.

---

# **155\. DISMISSED ANOMALY**

Posteriormente se demuestra:

normal variance

o:

expected context

---

# **156\. ANOMALY REASON CODES**

Ejemplos:

ANOM\_POINT\_OUTLIER

ANOM\_SHARP\_DROP

ANOM\_SHARP\_SPIKE

ANOM\_TREND\_DETERIORATION

ANOM\_TREND\_ACCELERATION

ANOM\_REGIME\_SHIFT

ANOM\_STRUCTURAL\_DECLINE

ANOM\_STRUCTURAL\_IMPROVEMENT

ANOM\_SEASONAL\_DEVIATION

ANOM\_MIX\_SHIFT

ANOM\_SEGMENT\_SPECIFIC

ANOM\_COHORT\_DETERIORATION

ANOM\_VOLATILITY\_INCREASE

ANOM\_POSSIBLE\_DATA\_ISSUE

ANOM\_MEASUREMENT\_BREAK

---

# **157\. EXPLANATION**

Debe poder generar una explicación estructurada.

Ejemplo:

New-customer mobile CVR has remained  
22% below its seasonally adjusted baseline  
for 17 consecutive days.

---

# **158\. SUPPORTING EVIDENCE**

Debe incluir:

baseline

observations

magnitude

persistence

segment evidence

---

# **159\. CONTRADICTORY EVIDENCE**

Ejemplo:

mobile CVR ↓

desktop CVR stable

overall CVR stable

Debe conservarse.

---

# **160\. MISSING EVIDENCE**

Ejemplo:

traffic temperature unavailable

---

# **161\. ANOMALY SHAPE**

Conceptualmente:

anomaly\_detection:

    identity:  
        anomaly\_id  
        run\_id  
        trace\_id

    subject:  
        subject\_type  
        subject\_ref  
        metric\_id  
        metric\_version  
        scope

    classification:  
        anomaly\_type  
        anomaly\_direction  
        anomaly\_origin\_class

    detection:  
        method\_id  
        method\_version  
        parameters  
        anomaly\_score  
        anomaly\_strength

    baseline:  
        baseline\_ref  
        baseline\_type  
        expected\_value  
        expected\_range

    observed:  
        observed\_value  
        residual  
        relative\_deviation

    temporal:  
        onset  
        detected\_at  
        duration  
        persistence  
        change\_point

    trend:  
        direction  
        strength  
        slope  
        acceleration

    context:  
        seasonality  
        promotion  
        business\_events  
        mix\_effect

    quality:  
        data\_quality\_ref  
        measurement\_breaks  
        source\_conflicts

    materiality:  
        level  
        business\_exposure

    confidence:  
        anomaly\_confidence  
        business\_anomaly\_confidence  
        data\_anomaly\_confidence

    evidence:  
        supporting  
        contradictory  
        missing

    lifecycle:  
        status  
        suppression  
        recovery

    explanation:  
        reason\_codes  
        structured\_interpretation

---

# **162\. EXAMPLE — POINT ANOMALY**

Metric:  
Daily CVR

Expected range:  
2.5%–3.2%

Observed:  
1.1%

Duration:  
1 day

Next day:  
2.9%

Classification:  
point\_anomaly

Persistence:  
isolated

Business materiality:  
low

Confidence:  
high

No declarar:

structural CRO failure

---

# **163\. EXAMPLE — STRUCTURAL DETERIORATION**

Metric:  
New Customer Mobile CVR

Historical baseline:  
2.4%

Last 6 weeks:  
1.8%  
1.7%  
1.9%  
1.6%  
1.7%  
1.6%

Classification:  
structural\_deterioration

Persistence:  
structural

Magnitude:  
\~ \-29%

Data quality:  
high

Confidence:  
high

---

# **164\. EXAMPLE — REGIME CHANGE**

Antes:

CAC ≈ €35–€39

Después de cambio:

CAC ≈ €49–€54

durante 8 semanas.

Resultado:

anomaly\_type:  
regime\_change

change\_point:  
week X

new operating level:  
\~€51

No implica todavía conocer por qué.

---

# **165\. EXAMPLE — MIX EFFECT**

Blended CVR:  
3.0% → 2.5%

Mobile CVR:  
2.0% → 2.0%

Desktop CVR:  
4.5% → 4.5%

Mobile traffic share:  
60% → 80%

Resultado:

classification:  
mix\_effect

within-segment deterioration:  
not detected

aggregate change:  
explained primarily by mix

---

# **166\. EXAMPLE — DATA ANOMALY**

GA4 purchases:  
\-46%

Shopify orders:  
stable

Finance revenue:  
stable

Tracking incident:  
purchase event deployment failure

Resultado:

classification:  
measurement\_break

business\_anomaly\_confidence:  
low

data\_anomaly\_confidence:  
high

---

# **167\. EXAMPLE — SEASONAL DEVIATION**

Histórico:

Black Friday CVR:  
\+35% vs normal

Actual:

Black Friday CVR:  
\-3% vs normal

Resultado:

seasonal\_deviation:  
strong

confidence:  
high

---

# **168\. EXAMPLE — VOLATILITY**

Antes:

CAC:  
€35–€40

Después:

€25  
€61  
€31  
€70  
€28

Promedio similar.

Pero:

volatility anomaly:  
strong

---

# **169\. EXAMPLE — POSITIVE ANOMALY**

Repeat purchase:  
\+18% above expected

persistent:  
4 cohorts

data quality:  
high

Resultado:

structural\_improvement

Las anomalías positivas también deben llegar a otras fases.

---

# **170\. EVALUATION VS ANOMALY**

Ejemplo:

CAC \= €60

Puede ser:

status \= critical

pero no anómalo si históricamente siempre fue €60.

Otro caso:

CAC \= €40

puede seguir siendo:

healthy

pero anómalo si normalmente es €25.

Por tanto:

health  
≠  
unusualness

---

# **171\. INVARIANTES C6.10**

## **INV-C6.10-001**

No deviation without baseline comparison should automatically become anomaly.

---

## **INV-C6.10-002**

Anomaly is not equivalent to business problem.

---

## **INV-C6.10-003**

Anomaly is not root cause.

---

## **INV-C6.10-004**

Anomaly is not recommendation.

---

## **INV-C6.10-005**

Point anomaly and structural change must remain separate.

---

## **INV-C6.10-006**

Business anomaly and data anomaly must remain separate.

---

## **INV-C6.10-007**

Positive anomalies must be supported.

---

## **INV-C6.10-008**

Seasonality must be considered when relevant.

---

## **INV-C6.10-009**

Mix effects must be distinguishable from within-segment deterioration.

---

## **INV-C6.10-010**

Measurement breaks must not be interpreted automatically as business changes.

---

## **INV-C6.10-011**

A weak baseline must limit anomaly confidence.

---

## **INV-C6.10-012**

Insufficient data quality must limit anomaly confidence.

---

## **INV-C6.10-013**

Anomaly strength is not severity.

---

## **INV-C6.10-014**

Severity is not priority.

---

## **INV-C6.10-015**

Guardrail breach and anomaly must remain separate.

---

## **INV-C6.10-016**

Benchmark underperformance and anomaly must remain separate.

---

## **INV-C6.10-017**

Observed and predicted series must remain distinguishable.

---

## **INV-C6.10-018**

Blended anomalies must not hide segment behavior.

---

## **INV-C6.10-019**

Suppressed anomalies must remain auditable.

---

## **INV-C6.10-020**

Historical anomaly results must remain versioned.

---

## **INV-C6.10-021**

Detection method and version must be reconstructible.

---

## **INV-C6.10-022**

Context-explained deviations must be identified.

---

## **INV-C6.10-023**

No history means no invented historical baseline.

---

## **INV-C6.10-024**

Missing periods must not silently become zero.

---

## **INV-C6.10-025**

Source disagreement must be considered before confirming business anomaly.

---

# **172\. VALIDACIONES MÍNIMAS**

Antes de confirmar una anomalía:

subject valid?

metric semantics valid?

baseline available?

baseline quality sufficient?

observation quality sufficient?

time window coherent?

seasonality considered?

known events considered?

mix effects checked?

tracking incidents checked?

source conflicts checked?

minimum history satisfied?

detection method version known?

persistence evaluated?

confidence assessment valid?

---

# **173\. VALIDATION — POINT VS STRUCTURAL**

Una sola observación no debe clasificarse como:

structural deterioration

sin evidencia adicional.

---

# **174\. VALIDATION — MEASUREMENT BREAK**

Si coincide con cambio de tracking:

business anomaly confidence

debe limitarse.

---

# **175\. VALIDATION — MIX**

Un cambio blended no debe convertirse automáticamente en deterioro subyacente sin análisis de segmentos.

---

# **176\. VALIDATION — SEASONALITY**

Una desviación esperable estacionalmente no debe marcarse como fuerte anomaly.

---

# **177\. VALIDATION — SAMPLE**

Una muestra extremadamente pequeña debe limitar confianza.

---

# **178\. VALIDATION — COLD START**

No ejecutar métodos que requieren historia si:

minimum history

no existe.

---

# **179\. RELACIÓN CON C6.0**

C6.0 aporta:

runtime identity

versions

execution mode

---

# **180\. RELACIÓN CON C6.1**

C6.1 garantiza que la serie contiene la misma semántica métrica.

No comparar:

attributed ROAS

con:

incremental ROAS

como continuidad temporal.

---

# **181\. RELACIÓN CON C6.2**

C6.2 aporta:

seasonality

segments

cohorts

mix

business events

context regimes

---

# **182\. RELACIÓN CON C6.3**

C6.3 aporta:

tracking incidents

measurement breaks

data quality

source conflicts

---

# **183\. RELACIÓN CON C6.4**

C6.4 puede proporcionar:

historical baselines

expected ranges

---

# **184\. RELACIÓN CON C6.5**

Guardrails pueden aportar contexto de materialidad.

Pero no determinan anomaly por sí mismos.

---

# **185\. RELACIÓN CON C6.6**

Policies pueden configurar:

sensitivity

minimum history

minimum persistence

detection methods

suppression rules

---

# **186\. RELACIÓN CON C6.7**

C6.7 puede resolver:

appropriate anomaly baseline

---

# **187\. RELACIÓN CON C6.8**

C6.8 proporciona:

anomaly confidence

uncertainty

claim strength

---

# **188\. RELACIÓN CON C6.9**

C6.9 aporta:

health status

materiality

guardrail state

Esto permite separar:

unusual

de:

unsafe

---

# **189\. RELACIÓN CON C6.11**

C6.11 combinará varias anomalías/evaluaciones.

Ejemplo:

CAC anomaly

CVR anomaly

new customer share anomaly

pueden formar un patrón.

---

# **190\. RELACIÓN CON C6.12**

C6.12 debe reconstruir:

series  
→ baseline  
→ detection method  
→ anomaly  
→ confidence

---

# **191\. RELACIÓN CON C6.13**

El Finding podrá incluir:

anomaly\_id

anomaly\_type

magnitude

persistence

confidence

---

# **192\. RELACIÓN CON FASE 3**

Fase 3 utilizará anomalías como señales diagnósticas.

Ejemplo:

checkout CVR regime change

puede provocar investigación causal.

---

# **193\. RELACIÓN CON FASE 4**

Fase 4 podrá utilizar:

severity

materiality

persistence

confidence

pero decidirá prioridad.

---

# **194\. RELACIÓN CON FASE 7**

Fase 7 podrá recomendar acciones apropiadas según anomaly \+ diagnóstico.

---

# **195\. TESTS MÍNIMOS**

## **TEST 1 — Isolated Outlier**

Debe detectar point anomaly sin declarar structural deterioration.

---

## **TEST 2 — Persistent Decline**

Debe detectar trend anomaly.

---

## **TEST 3 — Regime Shift**

Debe detectar cambio estable de nivel.

---

## **TEST 4 — Structural Deterioration**

Debe requerir persistencia suficiente.

---

## **TEST 5 — Structural Improvement**

Debe detectar anomalías positivas.

---

## **TEST 6 — Seasonal Expected Change**

No debe marcarlo como anomalía fuerte.

---

## **TEST 7 — Seasonal Unexpected Change**

Debe detectarlo.

---

## **TEST 8 — Mix Shift**

Debe separar mix effect de performance segmentada.

---

## **TEST 9 — Segment Anomaly**

Debe detectar deterioro solo mobile aunque blended sea estable.

---

## **TEST 10 — Cohort Anomaly**

Debe detectar una cohorte deteriorada.

---

## **TEST 11 — Volatility Increase**

Debe detectar aumento de varianza con media estable.

---

## **TEST 12 — Tracking Failure**

Debe clasificar posible data anomaly.

---

## **TEST 13 — Source Cross-Check**

Shopify \+ finance confirman business anomaly.

---

## **TEST 14 — Source Disagreement**

GA4 cae pero Shopify estable debe degradar business anomaly confidence.

---

## **TEST 15 — Measurement Break**

Cambio de metodología debe quedar explícito.

---

## **TEST 16 — No History**

Debe rechazar historical anomaly detection.

---

## **TEST 17 — Cold Start**

Debe utilizar fallback solo si policy lo permite.

---

## **TEST 18 — Low Sample**

Debe limitar confidence.

---

## **TEST 19 — High Sample**

Debe permitir mayor confidence si demás condiciones son válidas.

---

## **TEST 20 — Persistent Guardrail Breach Without New Change**

Debe demostrar que breach y anomaly son diferentes.

---

## **TEST 21 — Healthy But Anomalous**

Debe soportar status healthy \+ anomaly detected.

---

## **TEST 22 — Critical But Not Anomalous**

Debe soportar critical guardrail \+ no anomaly.

---

## **TEST 23 — Suppressed Event**

Debe conservar anomaly \+ suppression reason.

---

## **TEST 24 — Recovery**

Debe detectar regreso al rango esperado.

---

## **TEST 25 — Reclassification**

Business anomaly debe poder convertirse posteriormente en measurement anomaly sin borrar historial.

---

# **196\. ANTI-PATRÓN — DEVIATION \= ANOMALY**

Incorrecto:

today \!= yesterday  
therefore anomaly

---

# **197\. ANTI-PATRÓN — ONE OUTLIER \= STRUCTURAL FAILURE**

Incorrecto.

---

# **198\. ANTI-PATRÓN — ANY DROP \= BUSINESS PROBLEM**

Puede ser:

seasonality

mix

tracking

expected event

---

# **199\. ANTI-PATRÓN — IGNORE MIX**

Incorrecto:

blended CVR ↓  
therefore CRO deteriorated

sin revisar segmentos.

---

# **200\. ANTI-PATRÓN — IGNORE TRACKING**

Incorrecto detectar business anomaly durante un tracking outage sin advertencia.

---

# **201\. ANTI-PATRÓN — ANOMALY \= GUARDRAIL BREACH**

Son conceptos diferentes.

---

# **202\. ANTI-PATRÓN — ANOMALY \= PRIORITY**

Una desviación puede ser estadísticamente extraña pero económicamente trivial.

---

# **203\. ANTI-PATRÓN — SAME BASELINE FOREVER**

El comportamiento esperado puede cambiar por régimen.

---

# **204\. ANTI-PATRÓN — REMOVE OUTLIERS BEFORE DETECTION**

Podríamos eliminar precisamente la señal que queremos detectar.

---

# **205\. ANTI-PATRÓN — Z-SCORE FOR EVERYTHING**

No toda métrica sigue comportamiento apropiado para esa técnica.

---

# **206\. ANTI-PATRÓN — STATIC THRESHOLD ONLY**

Anomalías complejas requieren contexto temporal.

---

# **207\. ANTI-PATRÓN — NO POSITIVE ANOMALIES**

La capa debe detectar mejoras inesperadas también.

---

# **208\. ANTI-PATRÓN — NO METHOD VERSION**

Sin versión no podremos reproducir detecciones históricas.

---

# **209\. ANTI-PATRÓN — SILENT SUPPRESSION**

Toda supresión debe quedar auditada.

---

# **210\. ACCEPTANCE CRITERIA**

Para cualquier anomalía material debemos poder responder:

1\. ¿Qué métrica o sujeto es anómalo?

2\. ¿Qué semántica exacta tiene?

3\. ¿Qué baseline se utilizó?

4\. ¿Por qué esa baseline?

5\. ¿Qué valor se esperaba?

6\. ¿Qué valor se observó?

7\. ¿Cuál es la desviación absoluta?

8\. ¿Cuál es la desviación relativa?

9\. ¿Qué tipo de anomalía es?

10\. ¿Es positiva o negativa?

11\. ¿Cuándo comenzó?

12\. ¿Cuánto lleva activa?

13\. ¿Es aislada, persistente o estructural?

14\. ¿Existe change point?

15\. ¿Qué método la detectó?

16\. ¿Qué versión del método?

17\. ¿Qué parámetros utilizó?

18\. ¿Qué anomaly score obtuvo?

19\. ¿Qué fuerza tiene la señal?

20\. ¿Qué materialidad tiene?

21\. ¿Qué segmentos están afectados?

22\. ¿Existe cambio de mix?

23\. ¿Existe explicación estacional?

24\. ¿Existe un evento conocido?

25\. ¿Existe tracking incident?

26\. ¿Existe measurement break?

27\. ¿Las fuentes confirman la señal?

28\. ¿Podría ser anomalía de datos?

29\. ¿Cuál es business anomaly confidence?

30\. ¿Cuál es data anomaly confidence?

31\. ¿Qué evidencia la soporta?

32\. ¿Qué evidencia la contradice?

33\. ¿Qué evidencia falta?

34\. ¿Está abierta, resuelta, descartada o suprimida?

35\. ¿Puede reproducirse la detección?

---

# **211\. DEFINITION OF DONE**

C6.10 estará formalmente definido cuando exista:

Anomaly Identity

Anomaly Subject

Anomaly Type Taxonomy

Point Anomaly

Spike / Drop

Trend Anomaly

Trend Acceleration

Regime Change

Structural Deterioration

Structural Improvement

Seasonal Deviation

Mix Effect

Segment Anomaly

Cohort Anomaly

Volatility Anomaly

Data Anomaly

Measurement Break

Expected Baseline Model

Expected Range

Residual

Relative Deviation

Detection Methods

Detection Versioning

Detection Parameters

Anomaly Score

Anomaly Strength

Direction

Materiality

Onset

Duration

Persistence

Change Point

Recovery

Lifecycle

Scope / Locality

Mix Decomposition

Context Adjustment

Seasonality

Known Events

Tracking Cross-Check

Source Confirmation

Business vs Data Anomaly

Confidence

Suppression

Reason Codes

Structured Explanation

Validation Rules

Test Fixtures

---

# **212\. RESULTADO ARQUITECTÓNICO**

Sin C6.10:

CVR dropped 25%.

Alert.

Con C6.10:

SUBJECT

New Customer Mobile CVR  
Spain

EXPECTED BASELINE

Seasonally adjusted internal baseline:  
2.4%

OBSERVED

1.7%

DEVIATION

\-29.2%

TEMPORAL BEHAVIOR

Duration:  
5 weeks

Persistence:  
Persistent

Change point:  
Week 31

SEGMENT CHECK

Desktop CVR:  
Stable

Returning customer CVR:  
Stable

MIX CHECK

Traffic mix explains:  
Minor part of decline

MEASUREMENT CHECK

Tracking health:  
High

Measurement break:  
None

Source conflict:  
None

CLASSIFICATION

Structural deterioration

Scope:  
New customers / Mobile / Spain

CONFIDENCE

Business anomaly confidence:  
High

Data anomaly confidence:  
Low

INTERPRETATION

A persistent deterioration exists in  
new-customer mobile conversion that is  
not sufficiently explained by seasonality,  
mix shift or measurement issues.

Todavía NO sabemos:

why it happened

what to fix

how urgent it is relative to all other problems

which playbook to execute

Y esa separación es correcta.

---

# **213\. PRINCIPIO FINAL DE C6.10**

C6.10 debe imponer:

Unusual  
does not automatically mean  
bad.

Y:

Bad  
does not automatically mean  
anomalous.

Además:

POINT OUTLIER  
≠  
TREND

TREND  
≠  
REGIME CHANGE

REGIME CHANGE  
≠  
ROOT CAUSE

BUSINESS ANOMALY  
≠  
DATA ANOMALY

MIX EFFECT  
≠  
UNDERLYING PERFORMANCE CHANGE

La pregunta correcta no es únicamente:

Did the metric move?

Sino:

Did the metric behave  
in a way that is genuinely unusual  
after accounting for:

history  
seasonality  
context  
mix  
measurement quality  
and expected variation?

---

# **214\. SALIDA FORMAL DE C6.10**

C6.10 produce conceptualmente:

ANOMALY\_DETECTION

ANOMALY\_SIGNAL

CHANGE\_POINT

y, cuando corresponda:

MIX\_EFFECT\_ASSESSMENT

MEASUREMENT\_ANOMALY\_ASSESSMENT

Estas salidas serán consumidas por:

C6.11 — Pattern & Red Flag Detection

C6.12 — Evidence, Provenance & Lineage

C6.13 — Evaluation Finding

C6.14 — Inter-Phase Handoff

C6.15 — Observability & Audit

y posteriormente por:

Fase 3 — Diagnóstico

Fase 4 — Priorización

Fase 7 — Motor de Recomendaciones

C6.10 no produce:

ROOT CAUSE

BUSINESS PRIORITY

STRATEGY

PLAYBOOK

RECOMMENDED ACTION

EXECUTION

---

# **C6.10 — ESTADO**

CONTRACT:  
C6.10 Anomaly Detection

TYPE:  
Temporal / Statistical / Structural Signal Detection

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
C6.3 Data Quality & Measurement Reliability  
C6.4 Benchmark Reference  
C6.5 Guardrail Definition  
C6.6 Policy & Threshold Configuration  
C6.7 Reference & Policy Resolution  
C6.8 Confidence & Uncertainty  
C6.9 Benchmark Evaluation

NEXT CONTRACT:  
C6.11 — Pattern & Red Flag Detection Contract

