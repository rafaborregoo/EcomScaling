# **C6.4 — BENCHMARK REFERENCE CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Benchmark Reference Contract define cómo debe representarse cualquier referencia utilizada por EcomScaling IA para comparar una observación.

Su misión es responder:

> **¿Contra qué referencia estamos comparando este dato y qué significa exactamente esa referencia?**

C6.4 existe para impedir que un benchmark se reduzca a:

CVR benchmark \= 3%

sin conocer:

de dónde salió

qué métrica representa

qué población utiliza

qué período cubre

qué metodología aplica

qué muestra contiene

qué contexto representa

qué nivel de agregación tiene

qué versión está activa

qué limitaciones posee

qué tan aplicable es al caso actual

---

# **2\. RESPONSABILIDAD**

C6.4 debe definir:

WHAT reference?

WHAT reference type?

WHAT metric semantics?

WHAT value or distribution?

WHAT source?

WHAT methodology?

WHAT period?

WHAT sample?

WHAT context?

WHAT population?

WHAT version?

WHAT provenance?

WHAT limitations?

WHAT applicability metadata?

No debe decidir todavía:

si la referencia es la mejor disponible

si debe utilizarse finalmente

si el dato está bien o mal

si existe un guardrail breach

Eso pertenece principalmente a C6.7 y C6.9.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Un benchmark sin provenance y metodología suficiente no debe tratarse como verdad.

Invariante:

No benchmark  
without provenance.

Y:

benchmark value  
without context  
\=  
weak evidence

---

# **4\. SEGUNDO PRINCIPIO**

Un benchmark representa una referencia.

No un objetivo.

No un límite.

Debe mantenerse:

BENCHMARK  
≠  
TARGET  
≠  
GUARDRAIL

Benchmark:

> ¿Cómo estamos respecto a una referencia?

Target:

> ¿Dónde queremos llegar?

Guardrail:

> ¿Qué límite no debemos violar?

---

# **5\. TERCER PRINCIPIO**

Un benchmark no debe asumir automáticamente aplicabilidad.

Debe poder existir:

benchmark exists

junto con:

applicability \= low

sin contradicción.

---

# **6\. BENCHMARK REFERENCE**

C6.4 debe producir conceptualmente:

BENCHMARK\_REFERENCE

---

# **7\. BENCHMARK\_ID**

Toda referencia material debe disponer de:

benchmark\_id

estable y único.

Ejemplo:

bench\_internal\_cac\_es\_meta\_2026q2

No debe utilizarse únicamente:

CAC benchmark

como identidad.

---

# **8\. BENCHMARK\_VERSION**

Toda referencia debe ser versionable.

Ejemplo:

benchmark\_version:  
2.1.0

Si cambia:

methodology

population

calculation

source

cohort

period

debe poder generarse una nueva versión.

---

# **9\. BENCHMARK CATALOG**

Las referencias disponibles deben poder pertenecer a un catálogo versionado:

benchmark\_catalog\_version

C6.0 ya registra qué catálogo utilizó una ejecución.

C6.4 define sus entradas.

---

# **10\. BENCHMARK TYPE**

Debe existir una taxonomía inicial.

Propuesta:

own\_economics

internal\_history

internal\_segment

internal\_cohort

configured\_target\_reference

peer\_group

industry

external\_research

generic\_ecommerce

modeled\_reference

Importante:

`configured_target_reference` puede existir como objeto de referencia técnica, pero debe conservar explícitamente que semánticamente es un target y no un benchmark estadístico.

---

# **11\. OWN ECONOMICS**

Representa una referencia derivada de la propia economía del negocio.

Ejemplos:

break-even CAC

maximum sustainable CAC

minimum contribution margin

required payback

No debe confundirse con un promedio externo.

---

# **12\. INTERNAL HISTORY**

Referencia basada en comportamiento histórico del propio ecommerce.

Ejemplo:

median CAC  
same season  
last 3 years

---

# **13\. INTERNAL SEGMENT**

Referencia basada en otro segmento del mismo negocio.

Ejemplo:

desktop CVR

vs

mobile CVR

---

# **14\. INTERNAL COHORT**

Referencia basada en cohortes internas.

Ejemplo:

Q1 new-customer cohort

comparada con:

Q2 new-customer cohort

---

# **15\. PEER GROUP**

Referencia construida a partir de negocios comparables.

Debe existir:

peer\_group\_id

peer\_group\_version

cuando corresponda.

---

# **16\. INDUSTRY**

Referencia sectorial.

Ejemplo:

beauty ecommerce CVR

Debe conservar:

industry definition

market

sample

methodology

---

# **17\. EXTERNAL RESEARCH**

Benchmark procedente de:

report

study

dataset

research provider

No debe asumir automáticamente calidad alta.

---

# **18\. GENERIC ECOMMERCE**

Referencia generalista.

Ejemplo:

generic ecommerce conversion benchmark

Debe etiquetarse de forma que C6.7 pueda tratarla como referencia débil cuando existan alternativas mejores.

---

# **19\. MODELED REFERENCE**

Una referencia puede ser generada mediante modelo.

Ejemplo:

expected CAC range  
based on historical elasticity

Debe distinguirse de datos observados.

---

# **20\. REFERENCE SOURCE TYPE**

Debe existir:

source\_type

Valores conceptuales:

internal\_transactional

internal\_derived

configured

external\_dataset

external\_research

peer\_aggregate

model\_generated

---

# **21\. PROVENANCE**

Toda referencia debe poder indicar de dónde procede.

Como mínimo:

source\_name

source\_type

source\_ref

retrieved\_at

published\_at

cuando aplique.

---

# **22\. SOURCE NAME**

Ejemplos:

internal warehouse

finance model

industry report

benchmark provider

configured business policy

---

# **23\. SOURCE REF**

Debe poder enlazar con:

dataset

report

configuration

calculation

model

sin depender únicamente de texto humano.

---

# **24\. PUBLICATION DATE**

Cuando sea externa:

published\_at

puede ser relevante.

Una referencia de hace 5 años puede seguir siendo útil, pero su antigüedad debe ser visible.

---

# **25\. RETRIEVAL DATE**

Debe poder registrarse:

retrieved\_at

para saber cuándo se incorporó al catálogo.

---

# **26\. VALIDITY PERIOD**

Una referencia puede tener:

valid\_from

valid\_to

cuando corresponda.

Ejemplo:

business target policy 2026-Q3

---

# **27\. METRIC IDENTITY**

Todo benchmark debe declarar:

metric\_id

metric\_version

Debe apoyarse en C6.1.

---

# **28\. SEMANTIC COMPATIBILITY**

Debe conservar suficiente semántica para responder:

observed or predicted?

average or marginal?

blended or segmented?

attributed or incremental?

customer scope?

channel scope?

---

# **29\. BENCHMARK VALUE TYPE**

No todos los benchmarks son un único valor.

Debe poder existir:

point

range

distribution

percentile\_set

time\_series

threshold\_reference

---

# **30\. POINT REFERENCE**

Ejemplo:

median CAC \= €42

---

# **31\. RANGE REFERENCE**

Ejemplo:

typical CVR:  
2.1% – 3.2%

---

# **32\. DISTRIBUTION**

Puede existir una distribución completa o resumida.

Ejemplo:

mean

median

standard deviation

percentiles

---

# **33\. PERCENTILE SET**

Ejemplo:

P25 \= 1.8%

P50 \= 2.5%

P75 \= 3.4%

Esto es más rico que un promedio único.

---

# **34\. TIME SERIES REFERENCE**

Una referencia puede ser histórica.

Ejemplo:

monthly internal CAC baseline

---

# **35\. VALUE REPRESENTATION**

Debe poder almacenar:

value

lower\_bound

upper\_bound

percentiles

distribution\_metadata

según el tipo.

---

# **36\. UNIT**

Debe respetar C6.1.

Ejemplo:

EUR

ratio

percentage

days

---

# **37\. CURRENCY**

Si la referencia es monetaria:

currency

es obligatoria.

---

# **38\. FX NORMALIZATION**

Si proviene de múltiples monedas debe poder registrarse:

fx\_normalization\_method

fx\_reference\_date

cuando aplique.

---

# **39\. METHODOLOGY**

Todo benchmark serio debe declarar metodología suficiente.

Conceptualmente:

methodology

Debe responder:

¿Cómo se calculó?

¿Qué registros se incluyeron?

¿Qué registros se excluyeron?

¿Cómo se agregaron?

¿Qué período se usó?

¿Qué weighting se aplicó?

¿Qué transformaciones se realizaron?

---

# **40\. METHODOLOGY\_ID**

Cuando sea recurrente debe poder existir:

methodology\_id

methodology\_version

---

# **41\. AGGREGATION METHOD**

Debe poder indicar:

mean

median

weighted\_mean

ratio\_of\_sums

percentile

custom

---

# **42\. WEIGHTING**

Si existe ponderación:

weighted by revenue

weighted by sessions

weighted by orders

equal business weight

debe quedar explícito.

---

# **43\. IMPORTANT EXAMPLE**

No es igual:

average CVR across stores

que:

total orders / total sessions across stores

C6.4 debe conservar esta diferencia.

---

# **44\. POPULATION**

Debe describirse:

reference\_population

Ejemplo:

fashion ecommerce stores

Spain

€1m–€5m revenue

DTC

paid-social-heavy

---

# **45\. POPULATION SIZE**

Cuando esté disponible:

population\_size

---

# **46\. SAMPLE SIZE**

Debe existir:

sample\_size

cuando sea conocido.

---

# **47\. SAMPLE UNIT**

Ejemplo:

businesses

customers

orders

sessions

campaigns

---

# **48\. SAMPLE UNKNOWN**

Si la fuente no publica la muestra:

sample\_size \= unknown

Nunca inventarla.

---

# **49\. SELECTION METHOD**

Cuando sea relevante:

selection\_method

Ejemplos:

random

self-selected

customer base

curated peers

internal segments

---

# **50\. SELECTION BIAS**

Debe poder registrarse:

selection\_bias\_known

selection\_bias\_notes

cuando exista.

---

# **51\. SURVIVORSHIP BIAS**

Puede existir:

survivorship\_bias\_risk

por ejemplo en estudios construidos solo con empresas activas o exitosas.

---

# **52\. PERIOD**

Toda referencia debe conocer:

period\_start

period\_end

o equivalente.

---

# **53\. TIME GRAIN**

Debe poder existir:

daily

weekly

monthly

quarterly

annual

rolling

multi-year

---

# **54\. REFERENCE AGE**

Puede derivarse:

reference\_age

para evaluar freshness posteriormente mediante C6.3.

---

# **55\. SEASONALITY PROFILE**

Cuando sea relevante:

seasonality\_context

Ejemplo:

Black Friday

Christmas

normal trading

---

# **56\. MARKET CONTEXT**

Debe poder incluir:

country

region

commercial market

currency zone

---

# **57\. BUSINESS MODEL CONTEXT**

Puede incluir:

DTC

marketplace

subscription

hybrid

---

# **58\. CATEGORY CONTEXT**

Debe declarar:

category

subcategory

cuando aplique.

---

# **59\. MATURITY CONTEXT**

Puede existir:

business\_maturity

o rango de madurez.

---

# **60\. REVENUE BAND**

Para peers:

revenue\_band

puede ser relevante.

---

# **61\. AOV BAND**

También:

AOV band

cuando sea útil.

---

# **62\. CHANNEL MIX CONTEXT**

Ejemplo:

paid social heavy

search heavy

organic led

---

# **63\. CUSTOMER MIX CONTEXT**

Ejemplo:

mostly new customers

o:

high repeat business

---

# **64\. DEVICE CONTEXT**

Cuando sea relevante:

mobile

desktop

all devices

---

# **65\. CUSTOMER SCOPE**

Ejemplo:

new customers

returning customers

all customers

---

# **66\. CHANNEL SCOPE**

Ejemplo:

Meta

Google

all paid

blended

---

# **67\. ATTRIBUTION SEMANTICS**

Para paid media debe declararse:

attribution\_basis

attribution\_model

attribution\_window

cuando aplique.

---

# **68\. MARGINALITY**

Debe conservar:

average

marginal

---

# **69\. MEASUREMENT BASIS**

Debe conservar:

observed

predicted

modeled

inferred

---

# **70\. APPLICABILITY METADATA**

C6.4 debe poder almacenar condiciones que ayudan a determinar dónde aplica.

Ejemplo:

applicable\_business\_models

applicable\_markets

applicable\_categories

applicable\_maturity\_stages

applicable\_metric\_scopes

---

# **71\. APPLICABILITY ≠ COMPARABILITY**

Importante:

C6.4 puede decir:

this benchmark is designed for fashion DTC

C6.2/C6.7 determinarán:

how comparable is it  
to this specific store?

---

# **72\. EXCLUSIONS**

La referencia puede declarar:

not\_applicable\_when

Ejemplo:

not for marketplaces

not for subscription stores

---

# **73\. BENCHMARK SCOPE**

Debe poder ser:

global

tenant

business

workspace

peer\_group

industry

external

---

# **74\. TENANT-SPECIFIC BENCHMARK**

Un tenant puede disponer de referencias privadas propias.

Debe respetarse aislamiento multi-tenant.

---

# **75\. BUSINESS-SPECIFIC BENCHMARK**

Ejemplo:

business historical median CAC

Solo aplica a ese negocio.

---

# **76\. PEER BENCHMARK**

Puede ser compartido si está:

aggregated

anonymized

authorized

según política.

---

# **77\. PRIVACY**

C6.4 no debe exponer datos identificables de otros tenants.

Un benchmark peer debe ser agregado o suficientemente protegido.

---

# **78\. MINIMUM COHORT SIZE FOR PEER BENCHMARKS**

La policy puede exigir un mínimo de negocios para evitar reidentificación o referencias inestables.

C6.4 debe poder registrar:

peer\_count

---

# **79\. PRIVACY SUPPRESSION**

Puede existir:

suppressed\_due\_to\_privacy

cuando la muestra sea demasiado pequeña.

---

# **80\. CONFIDENTIALITY CLASSIFICATION**

Puede existir:

public

internal

tenant\_private

restricted

---

# **81\. BENCHMARK QUALITY**

C6.4 puede enlazar:

data\_quality\_assessment\_id

producido por C6.3.

No debe duplicar toda la lógica de calidad.

---

# **82\. BENCHMARK RELIABILITY**

Puede exponer:

quality\_status

como referencia resumida.

La autoridad sigue siendo C6.3.

---

# **83\. LIMITATIONS**

Todo benchmark debe poder almacenar:

limitations

Ejemplos:

sample not disclosed

mainly US merchants

mobile/desktop not separated

platform attribution only

self-selected participants

---

# **84\. ASSUMPTIONS**

Cuando aplique:

assumptions

deben ser explícitos.

---

# **85\. EXTERNAL BENCHMARK CITATION**

Una referencia externa debe poder conservar:

title

publisher

publication date

source reference

sin depender de que el LLM recuerde la fuente.

---

# **86\. LICENSING / USAGE RESTRICTIONS**

Puede existir:

usage\_rights

si algunos datasets externos tienen restricciones.

---

# **87\. BENCHMARK STATUS**

Desde una perspectiva de catálogo:

draft

active

deprecated

retired

---

# **88\. DEPRECATED BENCHMARK**

Una referencia deprecated puede seguir siendo necesaria para:

historical replay

pero no debe seleccionarse para nuevas evaluaciones salvo regla explícita.

---

# **89\. RETIRED BENCHMARK**

Puede conservarse para auditoría histórica.

---

# **90\. EFFECTIVE DATE**

Debe existir:

effective\_from

effective\_to

cuando corresponda.

---

# **91\. VERSION IMMUTABILITY**

Una versión publicada de benchmark no debe modificarse silenciosamente.

Si cambian datos o metodología:

create new version

---

# **92\. CORRECTIONS**

Si una fuente externa corrige un benchmark:

new benchmark version

y relación:

supersedes

---

# **93\. BENCHMARK RELATIONSHIPS**

Puede existir:

supersedes

derived\_from

aggregates

child\_of

---

# **94\. HIERARCHICAL BENCHMARKS**

Ejemplo:

Ecommerce  
    ↓  
Fashion  
    ↓  
Footwear  
    ↓  
Spain  
    ↓  
Mobile

Debe poder existir una jerarquía.

---

# **95\. FALLBACK SUPPORT**

Esta jerarquía permitirá a C6.7 bajar de:

high specificity

a:

more generic

si no existe referencia suficiente.

---

# **96\. SPECIFICITY**

Puede existir:

specificity\_level

o derivarse del contexto.

No debe confundirse con calidad.

Un benchmark muy específico puede tener muestra pequeña.

---

# **97\. SPECIFICITY VS SAMPLE**

Ejemplo:

Footwear / Spain / Mobile / New Customer

puede ser muy comparable pero tener:

n \= 6 stores

Mientras:

Global ecommerce

puede tener:

n \= 50,000 stores

C6.7 deberá equilibrar ambos factores.

---

# **98\. REFERENCE CONFIDENCE**

C6.4 no calcula confidence final.

Pero debe proporcionar todo lo necesario para C6.8:

sample

quality

methodology

age

applicability

limitations

---

# **99\. DISTRIBUTION SHAPE**

Si existe:

skewness

long tail

puede ser importante.

Ejemplo:

CAC suele presentar distribuciones no normales.

Un simple mean puede ser engañoso.

---

# **100\. PREFERRED CENTRAL TENDENCY**

La metodología debe indicar si se utiliza:

mean

median

trimmed mean

---

# **101\. PERCENTILE INTERPRETATION**

Debe declararse claramente la dirección.

Ejemplo:

Para CVR:

higher percentile  
may mean better performance

Para refund rate:

higher percentile  
may mean worse performance

C6.4 no evalúa performance, pero la semántica debe ser conocida.

---

# **102\. DIRECTIONALITY**

La definición de métrica puede aportar:

higher\_is\_better

lower\_is\_better

context\_dependent

C6.4 puede referenciar esta metadata.

---

# **103\. BENCHMARK RANGE TYPE**

Puede declararse:

descriptive\_range

expected\_range

normal\_range

peer\_range

No debe asumirse que:

outside range \= bad

Eso sería evaluación.

---

# **104\. TARGET REFERENCES**

Si se almacena un target dentro del mismo catálogo técnico debe etiquetarse explícitamente:

reference\_semantics \= target

y nunca:

reference\_semantics \= benchmark

---

# **105\. ECONOMIC REFERENCES**

Las referencias derivadas de economics pueden etiquetarse:

reference\_semantics \= economic\_limit

aunque conceptualmente algunas se consuman después como guardrails.

C6.5 será quien formalice el límite operativo.

---

# **106\. OBSERVED INTERNAL BASELINE**

Ejemplo:

reference\_type:  
internal\_history

metric:  
new\_customer\_cac

value:  
€36

method:  
median

period:  
same-season previous 2 years

---

# **107\. PEER DISTRIBUTION EXAMPLE**

metric:  
purchase\_cvr

peer group:  
fashion DTC Spain

P25:  
1.8%

P50:  
2.4%

P75:  
3.2%

sample:  
84 businesses

---

# **108\. GENERIC EXTERNAL EXAMPLE**

reference\_type:  
generic\_ecommerce

metric:  
purchase\_cvr

median:  
2.5%

sample:  
unknown

market:  
global

device:  
all

limitations:  
category not segmented  
customer type not segmented

Debe poder existir, pero claramente etiquetado como débil.

---

# **109\. OWN ECONOMICS EXAMPLE**

reference\_type:  
own\_economics

metric:  
new\_customer\_cac

value:  
€43

basis:  
maximum sustainable CAC

derived from:  
contribution margin  
repeat economics  
payback requirement

C6.4 representa la referencia.

C6.5 puede convertirla en guardrail.

---

# **110\. BENCHMARK REFERENCE SHAPE**

Conceptualmente:

benchmark\_reference:

    identity:  
        benchmark\_id  
        benchmark\_version  
        benchmark\_catalog\_version

    semantics:  
        reference\_type  
        reference\_semantics  
        metric\_id  
        metric\_version  
        measurement\_basis  
        attribution\_basis  
        marginality\_scope  
        segmentation\_scope

    value:  
        value\_type  
        point\_value  
        lower\_bound  
        upper\_bound  
        percentiles  
        unit  
        currency

    provenance:  
        source\_type  
        source\_name  
        source\_ref  
        published\_at  
        retrieved\_at

    methodology:  
        methodology\_id  
        methodology\_version  
        aggregation\_method  
        weighting\_basis  
        calculation\_notes

    population:  
        population\_definition  
        population\_size  
        sample\_size  
        sample\_unit  
        selection\_method

    context:  
        business\_model  
        category  
        subcategory  
        market  
        maturity  
        revenue\_band  
        AOV\_band  
        channel\_scope  
        customer\_scope  
        device  
        seasonality

    temporal:  
        period\_start  
        period\_end  
        time\_grain  
        effective\_from  
        effective\_to

    applicability:  
        applicable\_context  
        exclusions

    quality:  
        data\_quality\_assessment\_id

    limitations:  
        limitations  
        assumptions

    governance:  
        confidentiality  
        usage\_rights  
        benchmark\_status

    relationships:  
        supersedes  
        derived\_from  
        parent\_benchmark\_id

---

# **111\. INVARIANTES C6.4**

## **INV-C6.4-001**

Todo benchmark material debe tener:

benchmark\_id

---

## **INV-C6.4-002**

Toda referencia debe tener versión.

---

## **INV-C6.4-003**

Todo benchmark debe referenciar una métrica canónica.

---

## **INV-C6.4-004**

No benchmark sin provenance suficiente.

---

## **INV-C6.4-005**

Benchmark no debe confundirse con target.

---

## **INV-C6.4-006**

Benchmark no debe confundirse con guardrail.

---

## **INV-C6.4-007**

Un benchmark monetario debe declarar currency.

---

## **INV-C6.4-008**

Una referencia externa con muestra desconocida debe declarar:

sample\_size \= unknown

---

## **INV-C6.4-009**

No inventar metodología ausente.

---

## **INV-C6.4-010**

Una versión publicada debe ser inmutable.

---

## **INV-C6.4-011**

Cambios metodológicos materiales requieren nueva versión.

---

## **INV-C6.4-012**

Benchmarks deprecated no deben seleccionarse automáticamente para nuevas ejecuciones.

---

## **INV-C6.4-013**

Una referencia peer no debe exponer datos privados identificables.

---

## **INV-C6.4-014**

La especificidad no implica automáticamente calidad alta.

---

## **INV-C6.4-015**

Una muestra grande no implica automáticamente comparabilidad alta.

---

## **INV-C6.4-016**

Un benchmark genérico debe mantenerse claramente identificado como tal.

---

## **INV-C6.4-017**

Measurement basis debe conservarse.

---

## **INV-C6.4-018**

Average y marginal no deben mezclarse.

---

## **INV-C6.4-019**

Attributed e incremental no deben mezclarse.

---

## **INV-C6.4-020**

Observed y modeled deben distinguirse.

---

# **112\. VALIDACIONES MÍNIMAS**

Antes de aceptar una referencia:

benchmark id unique?

version valid?

metric exists?

metric version valid?

value compatible with unit?

currency present when required?

source identified?

methodology sufficiently known?

period coherent?

sample metadata valid?

context structurally valid?

status active?

privacy constraints satisfied?

reference semantics explicit?

---

# **113\. VALIDACIÓN SEMÁNTICA**

Ejemplo inválido:

metric:  
marginal\_cac

reference:  
average\_cac

si se registró erróneamente como misma semántica.

Debe fallar.

---

# **114\. VALIDACIÓN DE RANGO**

Si:

lower\_bound \> upper\_bound

debe rechazarse.

---

# **115\. VALIDACIÓN DE PERCENTILES**

Debe cumplirse conceptualmente:

P25 \<= P50 \<= P75

cuando la métrica tenga orden natural y no existan transformaciones especiales.

---

# **116\. VALIDACIÓN TEMPORAL**

period\_start \<= period\_end

---

# **117\. VALIDACIÓN EFFECTIVE WINDOW**

effective\_from \<= effective\_to

cuando exista `effective_to`.

---

# **118\. VALIDACIÓN DE MUESTRA**

No aceptar:

sample\_size \= \-5

---

# **119\. VALIDACIÓN DE PROVENANCE**

Una referencia externa sin:

source\_name

debe quedar incompleta.

---

# **120\. VALIDACIÓN DE PRIVACIDAD**

Un peer benchmark con:

peer\_count \= 1

puede violar políticas de anonimización.

Debe bloquearse o suprimirse según policy.

---

# **121\. BENCHMARK SELECTION NO PERTENECE A C6.4**

C6.4 puede entregar:

candidate references

pero no:

selected benchmark

como decisión final.

Eso corresponde a C6.7.

---

# **122\. COMPARABILITY NO PERTENECE A C6.4**

C6.4 describe:

benchmark context

C6.2 evalúa:

comparability

---

# **123\. DATA QUALITY NO SE DUPLICA**

C6.4 puede enlazar:

data\_quality\_assessment\_id

pero la lógica de calidad pertenece a C6.3.

---

# **124\. CONFIDENCE NO PERTENECE A C6.4**

No producir:

confidence \= high

como conclusión final.

C6.8 hará esa síntesis.

---

# **125\. BUSINESS STATUS NO PERTENECE A C6.4**

C6.4 no dice:

CVR poor

Solo proporciona referencia.

---

# **126\. RELACIÓN CON C6.0**

C6.0 conserva:

benchmark\_catalog\_version

usado por cada run.

---

# **127\. RELACIÓN CON C6.1**

C6.1 proporciona la identidad semántica que debe compartir la referencia.

---

# **128\. RELACIÓN CON C6.2**

C6.2 utilizará el contexto de C6.4 para calcular comparabilidad.

---

# **129\. RELACIÓN CON C6.3**

C6.3 puede evaluar calidad del benchmark.

Ejemplo:

sample unknown

methodology partial

old publication

---

# **130\. RELACIÓN CON C6.5**

Algunas referencias económicas pueden convertirse en guardrails.

Ejemplo:

maximum sustainable CAC

C6.4 define el valor y origen.

C6.5 define la semántica de límite.

---

# **131\. RELACIÓN CON C6.6**

C6.6 puede:

enable

disable

override

prioritize

determinados tipos de referencia por tenant.

---

# **132\. RELACIÓN CON C6.7**

C6.7 recibirá múltiples referencias C6.4 y elegirá cuáles son aplicables.

---

# **133\. RELACIÓN CON C6.8**

Confidence utilizará:

source quality

sample

methodology

comparability

freshness

---

# **134\. RELACIÓN CON C6.9**

C6.9 utilizará el benchmark seleccionado para producir evaluación.

---

# **135\. RELACIÓN CON C6.10**

Anomaly Detection podrá utilizar baselines internos históricos representados mediante C6.4.

---

# **136\. RELACIÓN CON C6.11**

Pattern Detection podrá consumir múltiples referencias y distribuciones.

---

# **137\. RELACIÓN CON C6.12**

C6.12 debe poder reconstruir:

which benchmark was used?

which version?

which source?

which methodology?

---

# **138\. RELACIÓN CON C6.13**

Los Findings podrán referenciar:

benchmark\_id

benchmark\_version

sin duplicar todo el objeto.

---

# **139\. TESTS MÍNIMOS**

## **TEST 1 — Internal History**

Debe aceptar histórico interno versionado con período y metodología.

---

## **TEST 2 — Peer Group**

Debe exigir peer group identificable.

---

## **TEST 3 — External Benchmark**

Debe exigir source y provenance suficiente.

---

## **TEST 4 — Unknown Sample**

Debe permitir:

sample\_size \= unknown

sin inventar.

---

## **TEST 5 — Currency Missing**

Benchmark CAC sin currency debe fallar.

---

## **TEST 6 — Benchmark vs Target**

Un target no debe clasificarse como benchmark estadístico.

---

## **TEST 7 — Benchmark vs Guardrail**

Un límite económico no debe perder su semántica.

---

## **TEST 8 — Deprecated Reference**

No debe estar disponible por defecto para nuevas evaluaciones.

---

## **TEST 9 — Historical Replay**

Una versión antigua debe seguir accesible para replay.

---

## **TEST 10 — Methodology Change**

Debe generar nueva versión.

---

## **TEST 11 — Same Value, Different Methodology**

Dos benchmarks con mismo valor pero metodologías distintas deben seguir siendo objetos diferentes.

---

## **TEST 12 — Percentile Distribution**

Debe validar orden de percentiles.

---

## **TEST 13 — Peer Privacy**

Peer group demasiado pequeño debe activar regla de privacidad.

---

## **TEST 14 — Generic Benchmark**

Debe poder existir aunque su aplicabilidad sea débil.

---

## **TEST 15 — Specific Benchmark Small Sample**

Debe permitirse almacenar con limitation explícita.

---

## **TEST 16 — Modeled Reference**

Debe conservar `measurement_basis = modeled`.

---

## **TEST 17 — Average vs Marginal**

No deben compartir semántica.

---

## **TEST 18 — Attributed vs Incremental**

No deben compartir semántica.

---

# **140\. ANTI-PATRÓN — BENCHMARK COMO NÚMERO**

Incorrecto:

benchmark \= 3.2

---

# **141\. ANTI-PATRÓN — SIN FUENTE**

Incorrecto:

industry average \= 2.7%

sin saber de dónde procede.

---

# **142\. ANTI-PATRÓN — TARGET DISFRAZADO DE BENCHMARK**

Incorrecto:

our target CAC \= €40

therefore benchmark CAC \= €40

---

# **143\. ANTI-PATRÓN — SAMPLE INVENTED**

Nunca:

sample size \= estimated 1,000

si la fuente no lo publica.

Debe ser:

unknown

---

# **144\. ANTI-PATRÓN — MOST SPECIFIC ALWAYS BEST**

Incorrecto:

more dimensions  
\=  
better benchmark

Un benchmark muy específico pero con muestra mínima puede ser débil.

---

# **145\. ANTI-PATRÓN — LARGEST SAMPLE ALWAYS BEST**

Incorrecto:

largest dataset  
\=  
best benchmark

puede ser demasiado genérico.

---

# **146\. ANTI-PATRÓN — SOURCE FAME \= QUALITY**

No asumir que una fuente conocida implica metodología adecuada.

---

# **147\. ANTI-PATRÓN — OVERWRITE**

Nunca modificar:

benchmark v1

para convertirlo silenciosamente en:

benchmark v2

---

# **148\. ANTI-PATRÓN — MIXED PEER GROUP WITHOUT DISCLOSURE**

No crear:

fashion peers

mezclando:

fashion

electronics

beauty

sin explicitarlo.

---

# **149\. ANTI-PATRÓN — ATTRIBUTION MIXING**

No mezclar:

Meta platform ROAS

incremental ROAS

GA4 last-click ROAS

en una misma distribución sin normalización metodológica explícita.

---

# **150\. ACCEPTANCE CRITERIA**

Para cualquier benchmark material debemos poder responder:

1\. ¿Cuál es su benchmark\_id?

2\. ¿Qué versión utiliza?

3\. ¿Qué tipo de referencia es?

4\. ¿Qué semántica tiene?

5\. ¿Qué métrica representa?

6\. ¿Qué valor o distribución tiene?

7\. ¿Qué unidad utiliza?

8\. ¿Qué moneda utiliza?

9\. ¿De dónde procede?

10\. ¿Quién o qué lo produjo?

11\. ¿Qué metodología utiliza?

12\. ¿Cómo se agregó?

13\. ¿Cómo se ponderó?

14\. ¿Qué población representa?

15\. ¿Qué muestra tiene?

16\. ¿Qué unidad de muestra utiliza?

17\. ¿Cómo se seleccionó la muestra?

18\. ¿Qué período cubre?

19\. ¿Qué mercado cubre?

20\. ¿Qué categoría cubre?

21\. ¿Qué business model cubre?

22\. ¿Qué customer scope cubre?

23\. ¿Qué channel scope cubre?

24\. ¿Es average o marginal?

25\. ¿Es observed, predicted o modeled?

26\. ¿Es attributed o incremental?

27\. ¿Qué limitaciones tiene?

28\. ¿Qué assumptions tiene?

29\. ¿Está activo, deprecated o retired?

30\. ¿Qué versión del catálogo lo contiene?

31\. ¿Puede utilizarse históricamente?

32\. ¿Cumple requisitos de privacidad?

---

# **151\. DEFINITION OF DONE**

C6.4 estará formalmente definido cuando exista:

Benchmark Identity

Benchmark Versioning

Benchmark Catalog

Reference Type Taxonomy

Reference Semantics

Metric Linkage

Value Types

Point References

Ranges

Distributions

Percentiles

Time Series

Units

Currency

Provenance

Methodology

Aggregation

Weighting

Population Model

Sample Model

Selection Method

Bias Metadata

Temporal Scope

Business Context

Market Context

Category Context

Maturity Context

Channel Scope

Customer Scope

Attribution Semantics

Marginality Semantics

Applicability Metadata

Exclusion Rules

Privacy Model

Confidentiality

Quality Linkage

Limitations

Assumptions

Governance Status

Effective Dates

Benchmark Relationships

Hierarchical References

Validation Rules

Test Fixtures

---

# **152\. RESULTADO ARQUITECTÓNICO**

Antes de C6.4:

CVR benchmark \= 2.8%

Después de C6.4:

Benchmark:

metric:  
purchase\_cvr

reference\_type:  
peer\_group

value\_type:  
percentile\_set

P25:  
1.9%

P50:  
2.6%

P75:  
3.4%

population:  
fashion DTC ecommerce

market:  
Spain \+ Portugal

device:  
mobile

customer\_scope:  
all customers

period:  
2026-H1

sample:  
84 businesses

aggregation:  
equal-business median distribution

source:  
EcomScaling anonymized benchmark dataset

benchmark\_version:  
3.1

limitations:  
customer-type segmentation unavailable

Ahora tenemos una referencia interpretable.

Todavía NO hemos decidido:

si es la referencia que debemos utilizar

si es suficientemente comparable

si nuestro CVR está bien o mal

---

# **153\. PRINCIPIO FINAL DE C6.4**

C6.4 debe imponer:

A benchmark  
is not a number.

A benchmark is:

metric semantics  
\+  
value or distribution  
\+  
population  
\+  
context  
\+  
period  
\+  
sample  
\+  
methodology  
\+  
provenance  
\+  
version  
\+  
limitations

Y:

No provenance  
\=  
No strong benchmark.

Además:

benchmark  
\!=  
target

benchmark  
\!=  
guardrail

---

# **154\. SALIDA FORMAL DE C6.4**

C6.4 produce:

BENCHMARK\_REFERENCE

que podrá ser consumido por:

C6.2 Comparability

C6.3 Data Quality

C6.5 Guardrail Definition

C6.7 Reference Resolution

C6.8 Confidence

C6.9 Benchmark Evaluation

C6.10 Anomaly Detection

C6.11 Pattern Detection

C6.12 Evidence & Lineage

C6.13 Findings

No produce:

SELECTED\_BENCHMARK

BUSINESS\_STATUS

GUARDRAIL\_BREACH

SEVERITY

PRIORITY

RECOMMENDATION

---

# **C6.4 — ESTADO**

CONTRACT:  
C6.4 Benchmark Reference

TYPE:  
Reference Representation / Benchmark Governance

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

NEXT CONTRACT:  
C6.5 — Guardrail Definition Contract

