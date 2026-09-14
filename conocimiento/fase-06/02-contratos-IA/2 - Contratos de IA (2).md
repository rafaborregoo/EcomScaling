# **C6.2 — CONTEXT & COMPARABLE COHORT CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Context & Comparable Cohort Contract define el contexto necesario para interpretar correctamente una observación y establece cómo determinar si una referencia, benchmark, cohorte o segmento es suficientemente comparable con ella.

Su misión es responder:

> **¿Contra qué tiene sentido comparar este dato?**

C6.2 existe porque una métrica puede estar perfectamente definida por C6.1 y aun así ser interpretada incorrectamente si se compara contra un contexto inadecuado.

Ejemplo:

CVR \= 1.8%

puede ser:

* muy bajo;  
* normal;  
* excelente;  
* irrelevante;  
* indeterminado;

dependiendo de:

category  
country  
device  
traffic source  
traffic temperature  
customer type  
product type  
price point  
business maturity  
seasonality  
promotion status  
measurement period  
funnel definition

Por tanto:

metric semantics  
\+  
context  
\=  
basis for valid comparison

La propia Fase 6 establece expresamente que debe analizarse la contextualización y las cohortes comparables antes de emitir juicios, y que el contexto interno debe tener prioridad frente a benchmarks genéricos.

---

# **2\. RESPONSABILIDAD**

C6.2 debe definir:

WHAT business context?

WHAT metric context?

WHAT segment?

WHAT cohort?

WHAT market?

WHAT device?

WHAT customer type?

WHAT acquisition source?

WHAT traffic temperature?

WHAT product universe?

WHAT maturity stage?

WHAT seasonality?

WHAT commercial state?

WHAT temporal context?

WHAT comparison dimensions matter?

HOW comparable are two contexts?

No debe decidir:

GOOD  
BAD  
HEALTHY  
RISK  
CRITICAL

Tampoco debe elegir todavía el benchmark definitivo.

Eso será responsabilidad de C6.7.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Dos observaciones no son comparables únicamente porque representen la misma métrica.

Invariante:

same metric  
≠  
same context

Y:

semantic compatibility  
is necessary  
but not sufficient  
for comparability.

Ejemplo:

purchase\_cvr

puede estar semánticamente definido de forma idéntica en dos observaciones y aun así no ser comparable si una representa:

mobile  
cold traffic  
Spain  
new customers  
January

y otra:

desktop  
branded search  
returning customers  
US  
Black Friday

---

# **4\. PROBLEMA QUE RESUELVE**

Sin C6.2 podría ocurrir:

Store CVR \= 2.1%

Generic ecommerce benchmark \= 3.0%

Conclusión incorrecta:

CVR is poor

sin considerar que el ecommerce:

sells high-ticket products  
has mostly mobile traffic  
acquires mainly cold paid traffic  
is in an early maturity stage

También podría ocurrir:

CAC today \= €48

CAC last year \= €35

y afirmar deterioro sin considerar que:

current market \= Germany  
historical market \= Spain

o:

current period \= peak season  
historical period \= off-season

C6.2 debe impedir estas comparaciones simplistas.

---

# **5\. PRIORIDAD DE CONTEXTO**

Debe preservarse conceptualmente la jerarquía definida por Fase 6:

Own Economics  
\>  
Comparable Internal History  
\>  
Internal Segments / Cohorts  
\>  
Comparable Peer Group  
\>  
Industry Benchmark  
\>  
Generic Ecommerce Benchmark

Esto no significa que una fuente superior sea siempre utilizable.

Significa que, cuando exista una referencia suficientemente comparable y fiable en un nivel superior, debe preferirse frente a referencias más genéricas.

---

# **6\. BUSINESS CONTEXT**

Toda evaluación debe poder disponer de un contexto empresarial estructurado.

Conceptualmente:

BUSINESS\_CONTEXT

Debe poder describir aspectos como:

business\_model

category

subcategory

price\_positioning

average\_order\_profile

geography

maturity

channel\_mix

customer\_mix

product\_mix

promotion\_intensity

seasonality\_profile

No todos los campos serán obligatorios para todas las métricas.

---

# **7\. BUSINESS MODEL**

Debe poder identificarse el modelo de negocio relevante.

Ejemplos:

DTC

retail \+ ecommerce

marketplace

subscription

repeat-purchase consumables

high-ticket ecommerce

low-ticket transactional

B2B ecommerce

hybrid

La taxonomy debe ser extensible.

---

# **8\. CATEGORY**

Debe existir una categoría de negocio estructurada.

Ejemplos:

fashion

beauty

supplements

food

consumer electronics

home

jewelry

pet

sports

luxury

furniture

No deben hardcodearse como único universo posible.

---

# **9\. SUBCATEGORY**

Cuando sea relevante:

fashion  
    ↓  
footwear

o:

beauty  
    ↓  
skincare

puede mejorar significativamente la comparabilidad.

---

# **10\. PRODUCT ECONOMICS PROFILE**

El contexto puede necesitar características económicas generales como:

low\_ticket

mid\_ticket

high\_ticket

o una representación basada en datos reales.

Debe evitarse imponer categorías arbitrarias cuando exista:

actual AOV  
actual price distribution

---

# **11\. MARKET**

Debe poder diferenciarse:

country

region

commercial market

currency zone

Ejemplo:

geo\_country \= ES

commercial\_market \= Iberia

No asumir que país y mercado comercial son siempre lo mismo.

---

# **12\. BUSINESS MATURITY**

Debe poder representar la etapa de madurez del ecommerce.

C6.2 no determina por sí mismo la madurez.

Debe consumir el resultado de la Fase 2 cuando exista.

Ejemplo conceptual:

maturity\_stage \= scaling

Esto permitirá distinguir:

early validation business

de:

mature scaled business

---

# **13\. RELACIÓN CON FASE 2**

La madurez debe reutilizar la clasificación de Fase 2\.

No crear una segunda metodología contradictoria dentro de C6.2.

Conceptualmente:

Phase 2  
    ↓  
maturity classification  
    ↓  
C6.2 context

---

# **14\. METRIC CONTEXT**

Además del business context debe existir:

METRIC\_CONTEXT

porque la misma empresa puede tener múltiples contextos simultáneos.

Ejemplo:

business:  
fashion ecommerce

observation A:  
Spain  
mobile  
new customers  
Meta prospecting

observation B:  
Spain  
desktop  
returning customers  
email

El negocio es el mismo.

El contexto métrico no.

---

# **15\. DIMENSIONES DEL METRIC CONTEXT**

Debe poder incluir:

channel

campaign

device

customer type

traffic temperature

product

category

market

geo

time period

promotion state

funnel stage

cohort

Muchas de estas dimensiones proceden de C6.1.

C6.2 las interpreta desde la perspectiva de comparabilidad.

---

# **16\. CONTEXT SNAPSHOT**

Debe existir conceptualmente:

context\_snapshot

que represente el contexto efectivo utilizado durante una evaluación.

No debe depender exclusivamente del contexto actual del negocio.

---

# **17\. CONTEXT SNAPSHOT ID**

Puede existir:

context\_snapshot\_id

para permitir:

historical replay  
auditability

---

# **18\. POR QUÉ VERSIONAR CONTEXTO**

Un ecommerce puede cambiar:

business model

market mix

pricing

channel mix

maturity

product mix

Una evaluación histórica debe conservar el contexto de su momento.

No reinterpretarse automáticamente bajo el estado actual.

---

# **19\. COHORT**

Una cohorte representa un grupo definido mediante una condición común y normalmente relacionada con tiempo o comportamiento.

Ejemplos:

customers acquired in January 2026

first-time buyers from Meta

customers purchasing Product A

customers acquired during Black Friday

subscribers activated in Q2

---

# **20\. COHORT\_IDENTITY**

Toda cohorte material debe poder disponer de:

cohort\_id

cohort\_definition

---

# **21\. COHORT DEFINITION**

La definición debe ser estructurada.

Ejemplo:

acquisition\_period:  
2026-Q1

customer\_type:  
new

channel:  
Meta

market:  
Spain

No depender únicamente de:

"Meta customers Q1"

como string humano.

---

# **22\. COHORT TYPE**

Puede existir:

acquisition\_cohort

purchase\_cohort

product\_cohort

behavioral\_cohort

subscription\_cohort

campaign\_cohort

custom\_cohort

---

# **23\. COHORT MATURITY**

Debe poder representarse cuánto ha madurado una cohorte.

Esto es especialmente importante para:

LTV

repeat purchase

churn

retention

payback

Ejemplo:

January cohort:  
270 days mature

August cohort:  
30 days mature

No deben compararse directamente en determinadas métricas.

---

# **24\. MATURITY HORIZON**

Debe poder existir:

cohort\_age

measurement\_horizon

para diferenciar:

30-day LTV

90-day LTV

365-day LTV

---

# **25\. CUSTOMER TYPE**

Debe aprovechar las definiciones semánticas de C6.1.

Ejemplos:

new

returning

reactivated

subscriber

non-subscriber

---

# **26\. TRAFFIC TEMPERATURE**

Cuando sea material:

cold

warm

hot

mixed

No debe asumirse que estas categorías tienen la misma definición en todos los negocios.

Puede existir:

traffic\_temperature\_definition\_version

cuando sea necesario.

---

# **27\. CHANNEL**

Debe utilizarse la taxonomía canónica de canales.

Ejemplos:

Meta Ads

Google Search

Google Shopping

Organic Search

Direct

Email

SMS

Affiliate

Influencer

C6.2 debe permitir jerarquías.

Ejemplo:

Paid Media  
    ↓  
Meta  
    ↓  
Prospecting

---

# **28\. CHANNEL ROLE**

Dos canales diferentes pueden cumplir funciones distintas.

Ejemplo:

prospecting

demand capture

retargeting

retention

reactivation

Esta dimensión puede ser más relevante para comparabilidad que el nombre del canal.

---

# **29\. DEVICE**

Debe poder distinguir:

mobile

desktop

tablet

other

cuando afecte materialmente a la métrica.

---

# **30\. PRODUCT CONTEXT**

Debe poder representar:

all catalog

product family

category

SKU

hero product

long-tail product

bundle

subscription product

---

# **31\. PRODUCT MIX**

Debe poder registrarse si existe un cambio material de mix.

Ejemplo:

Period A:  
70% low-ticket products

Period B:  
60% premium products

Una variación de AOV o CVR puede estar explicada parcialmente por ese cambio.

---

# **32\. CUSTOMER MIX**

Igualmente:

Period A:  
80% new customers

Period B:  
55% new customers

puede alterar:

CVR  
AOV  
CAC  
repeat rate

---

# **33\. CHANNEL MIX**

También:

Period A:  
50% branded traffic

Period B:  
20% branded traffic

puede cambiar el CVR total sin implicar deterioro del funnel.

---

# **34\. MIX SHIFT**

Debe existir una representación explícita de:

mix\_shift

cuando la composición cambie entre períodos.

C6.2 no diagnostica el impacto final.

Pero debe proporcionar suficiente contexto para que C6.11 pueda detectar patrones como:

Simpson's paradox

---

# **35\. SEASONALITY**

Debe poder representarse:

seasonality\_context

Ejemplos:

normal

peak

low-season

holiday

Black Friday

Christmas

summer

business-specific peak

La taxonomy debe ser extensible.

---

# **36\. SEASONALITY PROFILE**

Preferiblemente el negocio podrá disponer de una definición propia:

seasonality\_profile\_id

porque:

peak season

no ocurre al mismo tiempo para todos los ecommerce.

---

# **37\. PROMOTIONAL CONTEXT**

Debe poder distinguirse:

non-promotional

promotion

sitewide\_discount

product\_discount

clearance

launch

event\_campaign

---

# **38\. PROMOTION INTENSITY**

Cuando sea relevante debe poder registrarse:

discount\_rate

share\_of\_orders\_discounted

promotion\_type

Esto puede afectar:

CVR

AOV

gross margin

contribution

return rate

---

# **39\. BUSINESS EVENT CONTEXT**

También debe poder marcarse un evento especial.

Ejemplos:

product launch

price increase

site migration

checkout change

stock disruption

shipping policy change

major campaign launch

C6.2 no determina causalidad.

Solo conserva el contexto.

---

# **40\. EXTERNAL CONTEXT**

Puede existir contexto externo cuando esté disponible.

Ejemplos:

major holiday

macro shock

platform outage

market disruption

regulatory event

Debe estar separado del contexto interno.

---

# **41\. TEMPORAL COMPARABILITY**

Comparar dos períodos requiere evaluar si representan condiciones similares.

Ejemplo:

August 2026

vs:

August 2025

puede ser más comparable que:

August 2026

vs:

December 2025

para un negocio altamente estacional.

---

# **42\. YOY VS PREVIOUS PERIOD**

Debe poder declararse el tipo de comparación:

previous\_period

year\_over\_year

rolling\_baseline

pre\_post

cohort\_vs\_cohort

segment\_vs\_segment

peer\_comparison

---

# **43\. BASELINE CONTEXT**

Una baseline interna también necesita contexto.

Ejemplo:

historical CAC \= €35

es insuficiente.

Debe poder saberse:

period

channel mix

market

customer mix

maturity

promotion state

---

# **44\. COMPARABLE ENTITY**

C6.2 debe manejar conceptualmente:

SUBJECT\_CONTEXT

y:

REFERENCE\_CONTEXT

La comparabilidad surge de evaluar ambos.

---

# **45\. COMPARABILITY ASSESSMENT**

Debe producirse conceptualmente:

COMPARABILITY\_ASSESSMENT

que responda:

Can these two things be meaningfully compared?

---

# **46\. COMPARABILITY STATUS**

Estados conceptuales:

high

medium

low

incompatible

unknown

---

# **47\. HIGH**

Significa:

> Los factores relevantes presentan suficiente equivalencia para una comparación fuerte.

No significa que ambos contextos sean idénticos.

---

# **48\. MEDIUM**

Significa:

> La comparación es útil, pero existen diferencias materiales que deben considerarse.

---

# **49\. LOW**

Significa:

> Puede aportar orientación débil, pero no debe sostener una conclusión fuerte por sí sola.

---

# **50\. INCOMPATIBLE**

Significa:

> Existe una diferencia semántica o contextual que invalida la comparación para el propósito solicitado.

---

# **51\. UNKNOWN**

Significa:

> Faltan datos suficientes para evaluar comparabilidad.

---

# **52\. COMPARABILITY ≠ DATA QUALITY**

Debe mantenerse:

comparability  
≠  
data quality

Ejemplo:

Un benchmark puede tener datos excelentes:

data quality \= high

pero no representar un contexto comparable:

comparability \= low

---

# **53\. COMPARABILITY DIMENSIONS**

La comparabilidad debe poder evaluarse por dimensiones.

Ejemplo:

metric semantics

business model

category

geo

device

customer type

channel

channel role

traffic temperature

product mix

customer mix

business maturity

seasonality

promotion state

time horizon

---

# **54\. DIMENSIONAL COMPARABILITY**

Ejemplo:

metric\_semantics:  
high

geo:  
high

device:  
high

customer\_type:  
high

seasonality:  
medium

business\_maturity:  
low

Esto es más útil que un único número opaco.

---

# **55\. MATERIALITY OF DIMENSIONS**

No todas las dimensiones importan igual para todas las métricas.

Ejemplo:

Para:

mobile CVR

device es crítico.

Para:

gross margin

device probablemente tenga poca importancia.

---

# **56\. COMPARABILITY PROFILE BY METRIC**

Cada métrica puede declarar qué dimensiones son:

critical

important

secondary

irrelevant

para comparabilidad.

Ejemplo conceptual:

Metric:  
purchase\_cvr

Critical:  
funnel definition  
device  
customer scope

Important:  
channel role  
traffic temperature  
market

Secondary:  
business maturity

---

# **57\. HARD INCOMPATIBILITY**

Algunas diferencias deben invalidar directamente una comparación.

Ejemplo:

observed  
vs  
predicted

cuando se exige una comparación observacional estricta.

O:

new\_customer\_cac  
vs  
all\_customer\_cac

si no existe reconciliación metodológica.

Estas incompatibilidades se apoyan en C6.1.

---

# **58\. SOFT DIFFERENCE**

Otras diferencias degradan comparabilidad sin invalidarla.

Ejemplo:

Spain  
vs  
Portugal

podría seguir siendo útil en ciertos contextos.

---

# **59\. UNKNOWN DIFFERENCE**

Cuando falta información:

device unknown

no debe asumirse automáticamente compatibilidad.

Debe reducir:

comparability certainty

o producir:

unknown

cuando sea crítica.

---

# **60\. COMPARABILITY SCORE**

Puede existir internamente un score normalizado.

Ejemplo:

0.82

Pero nunca debe utilizarse sin explicación.

Debe acompañarse de:

dimension assessments

material differences

missing context

reasoning summary

---

# **61\. NO MAGIC SCORE**

No queremos:

comparability \= 73

sin saber por qué.

El score, si existe, es una ayuda operacional.

No sustituye la estructura.

---

# **62\. COMPARABILITY REASONS**

Debe poder producir:

supporting\_matches

material\_differences

blocking\_differences

missing\_context

---

# **63\. EJEMPLO**

Subject:

Meta prospecting  
new customers  
mobile  
Spain  
August

Reference:

Meta prospecting  
new customers  
mobile  
Spain  
July

Resultado:

comparability \= high

differences:  
seasonality \= minor

blocking\_differences:  
none

---

# **64\. EJEMPLO DE COMPARABILIDAD MEDIA**

Subject:

fashion  
Spain  
mobile  
cold paid traffic

Reference:

fashion  
France  
mobile  
cold paid traffic

Podría resultar:

comparability \= medium

material\_difference:  
market

---

# **65\. EJEMPLO DE COMPARABILIDAD BAJA**

Subject:

high-ticket furniture  
mobile  
new customers  
paid social

Reference:

generic ecommerce benchmark  
all categories  
all devices  
all traffic

Resultado:

comparability \= low

No significa que la referencia sea inútil.

Significa que debe utilizarse con mucha cautela.

---

# **66\. EJEMPLO DE INCOMPATIBILIDAD**

Subject:

marginal CAC

Reference:

average CAC

si la pregunta específica es:

Can we scale additional spend profitably?

puede marcarse:

comparability \= incompatible

para ese propósito.

---

# **67\. COMPARABILITY PURPOSE**

Esto introduce un elemento importante.

La comparabilidad puede depender de:

comparison\_purpose

Ejemplo:

descriptive comparison

puede tolerar diferencias.

Pero:

economic guardrail evaluation

puede requerir equivalencia mucho mayor.

---

# **68\. PURPOSE TYPES**

Tipos iniciales:

descriptive

historical\_trend

benchmarking

guardrail\_evaluation

cohort\_analysis

anomaly\_detection

scale\_analysis

economic\_validation

---

# **69\. INTERNAL HISTORY**

Las referencias internas históricas deben considerarse fuertes cuando sean comparables.

Pero:

internal  
≠  
automatically comparable

Ejemplo:

El mismo ecommerce pudo cambiar completamente:

business model

pricing

market

acquisition mix

---

# **70\. INTERNAL SEGMENTS**

Los segmentos internos pueden permitir comparaciones muy poderosas.

Ejemplo:

mobile vs desktop

Spain vs France

new vs returning

Meta vs Google

Pero la comparación debe respetar la pregunta analítica.

---

# **71\. PEER GROUP**

Un peer group debe definirse estructuralmente.

No simplemente:

similar ecommerce

Debe poder contener criterios como:

category

business model

AOV range

market

maturity

revenue range

channel mix

---

# **72\. PEER GROUP ID**

Debe existir:

peer\_group\_id

y preferiblemente:

peer\_group\_version

---

# **73\. PEER GROUP VERSIONING**

Los peers pueden cambiar con el tiempo.

Una evaluación histórica debe saber qué peer group utilizó.

---

# **74\. INDUSTRY BENCHMARK**

Un benchmark industrial puede ser válido incluso si la comparabilidad no es alta.

Debe tratarse como:

external reference

con su applicability evaluada.

---

# **75\. GENERIC ECOMMERCE BENCHMARK**

Debe ocupar generalmente el nivel más débil de contextualización.

Puede ser útil para:

rough orientation

sanity checking

cold-start cases

pero no debería desplazar referencias internas mejores.

---

# **76\. COLD START**

Un negocio nuevo puede no tener historia.

En ese caso:

internal history unavailable

No debemos inventarla.

C6.2 debe permitir degradar progresivamente hacia:

peer

industry

generic

---

# **77\. INTERNAL CONTEXT AVAILABILITY**

Debe poder saberse qué contexto interno existe.

Conceptualmente:

internal\_context\_availability

---

# **78\. REFERENCE CANDIDATE**

C6.2 puede preparar:

reference\_candidate

con su comparability assessment.

Pero NO elige todavía el ganador definitivo.

C6.7 hará la resolución.

---

# **79\. CONTEXT FILTERING**

C6.2 puede descartar referencias evidentemente incompatibles antes de C6.7.

Ejemplo:

metric semantics incompatible

---

# **80\. CONTEXT DISTANCE**

Puede existir un concepto:

context\_distance

que mida cuántas diferencias relevantes existen.

No debe confundirse necesariamente con similitud matemática.

---

# **81\. HIERARCHICAL FALLBACK**

El sistema debe poder seguir una lógica conceptual:

exact internal comparable  
        ↓  
near internal comparable  
        ↓  
internal segment  
        ↓  
peer group  
        ↓  
industry  
        ↓  
generic

pero únicamente cuando cada nivel tenga datos disponibles y suficientemente aplicables.

---

# **82\. NO BENCHMARK FORCED**

Si ninguna referencia presenta comparabilidad suficiente:

do not force benchmark

Debe poder producirse:

no sufficiently comparable reference

---

# **83\. INDETERMINATE PREPARATION**

C6.2 no produce todavía el status final:

indeterminate

pero debe proporcionar información suficiente para que C6.9 pueda decidirlo.

Ejemplo:

comparable\_reference\_available \= false

---

# **84\. MARKET MATURITY**

El contexto del mercado también puede importar.

Ejemplos:

new market entry

established market

mature market

No debe confundirse con:

business maturity

---

# **85\. BRAND STRENGTH**

En ciertos análisis puede ser relevante distinguir:

low branded demand

high branded demand

por ejemplo para:

CVR  
CAC  
paid search performance

No debe convertirse en requisito universal.

---

# **86\. ACQUISITION MIX**

Puede incluir:

paid share

organic share

branded share

direct share

CRM share

Especialmente importante para métricas blended.

---

# **87\. CUSTOMER MIX**

Puede incluir:

new customer share

returning customer share

reactivated share

---

# **88\. PRODUCT MIX**

Puede incluir:

category share

hero SKU share

discounted item share

high-margin mix

low-margin mix

---

# **89\. MIX NORMALIZATION**

En determinados análisis posteriores podría ser necesario normalizar cambios de mix.

C6.2 no ejecuta esa normalización.

Solo proporciona:

mix context

y señala diferencias.

---

# **90\. FUNNEL CONTEXT**

Para métricas de CRO debe poder conocer:

funnel definition

site surface

checkout architecture

device

traffic source

Ejemplo:

one-page checkout

vs:

multi-step checkout

puede influir en comparabilidad.

---

# **91\. SITE EXPERIENCE CONTEXT**

Cuando sea material:

mobile-first

app

web

marketplace

headless storefront

---

# **92\. FULFILLMENT CONTEXT**

Para operaciones:

domestic fulfillment

cross-border

same-day

standard shipping

preorder model

made-to-order

puede ser relevante.

---

# **93\. INVENTORY CONTEXT**

Para inventario:

perishable

seasonal

evergreen

fashion lifecycle

preorder

made-to-order

---

# **94\. SUBSCRIPTION CONTEXT**

Para retención:

subscription

non-subscription

mixed

es crítico.

---

# **95\. CONTEXT RELEVANCE**

No debemos incluir cien dimensiones para todas las evaluaciones.

Cada métrica debe tener:

relevant\_context\_dimensions

definidas por registry/policy.

---

# **96\. CONTEXT PROFILE**

Puede existir conceptualmente:

context\_profile\_id

por métrica o familia.

Ejemplo:

CRO comparison profile

CAC comparison profile

LTV comparison profile

Inventory comparison profile

---

# **97\. REQUIRED CONTEXT**

Una métrica puede exigir determinadas dimensiones para una comparación fuerte.

Ejemplo:

CAC:

customer scope  
acquisition scope  
market  
marginality  
period

---

# **98\. OPTIONAL CONTEXT**

Otras dimensiones pueden mejorar la comparación sin ser obligatorias.

---

# **99\. CONTEXT COMPLETENESS**

Debe poder producir:

context\_completeness

Valores conceptuales:

complete

sufficient

partial

insufficient

---

# **100\. CONTEXT COMPLETENESS ≠ DATA QUALITY**

Un contexto puede estar completo y basarse en datos poco fiables.

Y viceversa.

Por tanto:

context completeness  
≠  
data quality

---

# **101\. CONTEXT CONFLICT**

Debe detectarse cuando dos atributos se contradigan.

Ejemplo:

business\_model \= subscription

pero:

subscription\_status \= not\_applicable

si la combinación resulta semánticamente imposible.

---

# **102\. UNKNOWN CONTEXT**

Cuando no sepamos una dimensión:

unknown

No inventar.

Especialmente:

traffic\_temperature \= unknown

es mejor que asumir:

cold

---

# **103\. CONTEXT SOURCE**

Cada dato de contexto puede tener una fuente.

Ejemplo:

configured

derived

observed

Phase 2 output

inferred

La provenance completa pertenecerá a C6.12.

---

# **104\. DERIVED CONTEXT**

Puede existir contexto derivado.

Ejemplo:

new\_customer\_share \= 82%

podría ayudar a clasificar:

customer mix

C6.2 debe distinguir:

configured context

de:

derived context

---

# **105\. INFERRED CONTEXT**

Si un agente infiere:

traffic appears predominantly cold

debe mantenerse como:

inferred

no como hecho configurado.

---

# **106\. CONTEXT CONFIDENCE**

La confianza completa pertenece a C6.8.

Pero C6.2 debe permitir que C6.8 sepa:

which context fields are observed?

configured?

inferred?

missing?

---

# **107\. COMPARABILITY EVIDENCE**

El assessment debe poder indicar por qué considera comparables dos entidades.

Ejemplo:

matches:  
same metric semantics  
same country  
same channel role  
same customer type  
same device

differences:  
different seasonality

---

# **108\. COMPARABILITY LIMITATIONS**

Debe poder declarar:

limitations

Ejemplo:

peer benchmark does not separate  
new and returning customers

---

# **109\. COMPARABILITY BLOCKERS**

Debe poder declarar diferencias que invalidan la comparación.

Ejemplo:

subject \= marginal CAC

reference \= blended average CAC

para una decisión de escalabilidad marginal.

---

# **110\. CONTEXT SHAPE CONCEPTUAL**

La estructura conceptual podría ser:

context\_snapshot:

    identity:  
        context\_snapshot\_id  
        run\_id  
        business\_id

    business:  
        business\_model  
        category  
        subcategory  
        maturity\_stage  
        market\_maturity  
        price\_profile

    commercial:  
        promotion\_state  
        promotion\_intensity  
        seasonality  
        business\_event

    mix:  
        channel\_mix  
        customer\_mix  
        product\_mix

    market:  
        country  
        region  
        commercial\_market  
        currency\_zone

    metric\_scope:  
        channel  
        channel\_role  
        device  
        customer\_type  
        traffic\_temperature  
        product\_scope  
        funnel\_scope

    cohort:  
        cohort\_id  
        cohort\_type  
        cohort\_definition  
        cohort\_age  
        measurement\_horizon

    temporal:  
        period  
        comparison\_period\_type

    context\_metadata:  
        sources  
        context\_completeness

---

# **111\. COMPARABILITY SHAPE CONCEPTUAL**

comparability\_assessment:

    subject\_context\_id

    reference\_context\_id

    purpose

    overall\_status

    dimensional\_assessment:  
        metric\_semantics  
        business\_model  
        category  
        geo  
        channel  
        device  
        customer\_type  
        traffic\_temperature  
        maturity  
        seasonality  
        promotion  
        cohort\_maturity  
        mix

    supporting\_matches

    material\_differences

    blocking\_differences

    missing\_context

    limitations

    optional\_score

---

# **112\. EJEMPLO — COMPARACIÓN HISTÓRICA VÁLIDA**

Subject:

new\_customer\_cac

Meta prospecting

Spain

mobile \+ desktop

March 2026

normal promotion state

Reference:

new\_customer\_cac

Meta prospecting

Spain

mobile \+ desktop

March 2025

normal promotion state

Resultado posible:

comparability:  
high

strengths:  
same metric  
same market  
same channel role  
same customer type  
same seasonal period

differences:  
business maturity changed

---

# **113\. EJEMPLO — BENCHMARK GENÉRICO**

Subject:

fashion ecommerce  
Spain  
mobile  
Meta prospecting  
new customers  
CVR \= 1.7%

Reference:

generic ecommerce CVR  
all categories  
all markets  
all traffic  
all devices

Resultado:

comparability:  
low

Puede usarse como orientación débil.

No como evidencia fuerte.

---

# **114\. EJEMPLO — COHORTES DE RETENCIÓN**

Cohorte A:

January acquisition  
age \= 180 days

Cohorte B:

August acquisition  
age \= 30 days

Comparar:

180-day observed LTV

entre ambas sería:

incompatible

porque B todavía no ha alcanzado ese horizonte.

---

# **115\. EJEMPLO — CAMBIO DE MIX**

Period A:

overall CVR \= 3.1%

new customer share \= 55%

Period B:

overall CVR \= 3.4%

new customer share \= 35%

C6.2 debe registrar:

customer\_mix\_shift \= material

No concluir:

CRO improved

Eso pertenece a otras capas.

---

# **116\. EJEMPLO — SEASONALITY**

Subject:

December AOV \= €92

Reference:

August AOV \= €71

C6.2 puede declarar:

seasonality\_difference \= material

Esto no invalida necesariamente la comparación.

Pero reduce su fuerza para ciertas conclusiones.

---

# **117\. EJEMPLO — MARKET DIFFERENCE**

Subject:

Spain CAC \= €42

Reference:

US CAC \= €73

Aunque la métrica sea idéntica:

geo comparability \= low

salvo que exista una razón específica para utilizar la referencia.

---

# **118\. INVARIANTES DE C6.2**

## **INV-C6.2-001**

Toda comparación material debe tener:

subject context

y:

reference context

---

## **INV-C6.2-002**

La misma métrica no implica comparabilidad automática.

---

## **INV-C6.2-003**

La comparabilidad debe depender del propósito.

---

## **INV-C6.2-004**

No debe utilizarse un benchmark genérico como sustitución silenciosa de una referencia interna comparable disponible.

---

## **INV-C6.2-005**

Internal no significa automáticamente comparable.

---

## **INV-C6.2-006**

Debe poder existir:

comparability \= unknown

---

## **INV-C6.2-007**

Debe poder existir:

comparability \= incompatible

---

## **INV-C6.2-008**

No inventar dimensiones contextuales ausentes.

---

## **INV-C6.2-009**

Los cambios de mix relevantes deben conservarse.

---

## **INV-C6.2-010**

La madurez de cohortes debe considerarse cuando la métrica depende del tiempo.

---

## **INV-C6.2-011**

La estacionalidad debe considerarse cuando sea relevante.

---

## **INV-C6.2-012**

Promotion state debe separarse del estado normal del negocio.

---

## **INV-C6.2-013**

Comparability no debe confundirse con data quality.

---

## **INV-C6.2-014**

Context completeness no debe confundirse con confidence.

---

## **INV-C6.2-015**

Los factores críticos de una métrica deben ponderar más que dimensiones irrelevantes.

---

## **INV-C6.2-016**

Una incompatibilidad crítica no puede ocultarse mediante un score agregado alto.

---

## **INV-C6.2-017**

La historia propia debe conservar contexto histórico y no reinterpretarse únicamente con contexto actual.

---

## **INV-C6.2-018**

Una cohorte inmadura no puede tratarse como cohorte completamente desarrollada.

---

## **INV-C6.2-019**

Un cambio de mercado debe quedar visible.

---

## **INV-C6.2-020**

Un benchmark sin suficiente contexto puede seguir existiendo, pero su aplicabilidad debe degradarse explícitamente.

---

# **119\. VALIDACIONES MÍNIMAS**

Antes de aceptar una comparación:

subject context exists?

reference context exists?

metric semantics compatible?

comparison purpose defined?

critical dimensions available?

hard incompatibilities?

cohort maturity compatible?

time horizons compatible?

seasonality relevant?

promotion states compatible?

market compatible?

customer scopes compatible?

channel roles compatible?

device relevance?

mix shift present?

---

# **120\. HARD FAIL**

Una comparación debe bloquearse cuando exista:

critical semantic incompatibility

o una condición contextual que haga la comparación conceptualmente inválida.

---

# **121\. SOFT DEGRADATION**

Diferencias no críticas deben degradar:

comparability

sin bloquear automáticamente.

---

# **122\. MISSING CONTEXT**

Cuando una dimensión crítica sea desconocida:

do not assume match

Debe poder producir:

comparability \= unknown

o reducir la fuerza de la comparación.

---

# **123\. RELACIÓN CON C6.0**

C6.0 aporta:

tenant  
business  
run  
as\_of\_at  
historical snapshots

C6.2 utiliza esa identidad para construir el contexto correcto.

---

# **124\. RELACIÓN CON C6.1**

C6.1 responde:

> ¿Qué métrica es?

C6.2 responde:

> ¿En qué contexto existe y contra qué contextos puede compararse?

Pipeline:

Metric Observation  
        ↓  
Contextualization

---

# **125\. RELACIÓN CON C6.3**

C6.3 evaluará si:

context data

y:

comparison data

son suficientemente fiables.

C6.2 no evalúa reliability.

---

# **126\. RELACIÓN CON C6.4**

C6.4 representará benchmarks candidatos.

Cada benchmark deberá tener contexto suficiente para que C6.2/C6.7 puedan valorar applicability.

---

# **127\. RELACIÓN CON C6.5**

Los guardrails también pueden ser contextuales.

Ejemplo:

maximum sustainable CAC

puede variar por:

market  
product  
customer type

---

# **128\. RELACIÓN CON C6.6**

Las policies podrán indicar:

required comparison dimensions

minimum comparability

preferred cohort hierarchy

---

# **129\. RELACIÓN CON C6.7**

C6.7 utilizará:

comparability assessments

para seleccionar la mejor referencia.

C6.2 no hace la selección definitiva.

---

# **130\. RELACIÓN CON C6.8**

C6.8 podrá reducir:

benchmark confidence

si la comparabilidad es débil.

---

# **131\. RELACIÓN CON C6.9**

C6.9 utilizará la comparabilidad para determinar cuánto peso merece una referencia.

Ejemplo:

benchmark says poor

comparability \= low

no debería sostener:

strong negative evaluation

por sí solo.

---

# **132\. RELACIÓN CON C6.10**

Anomaly Detection utilizará contextos históricos comparables.

No debe marcar:

December spike

como anomalía si corresponde a una estacionalidad recurrente esperada.

---

# **133\. RELACIÓN CON C6.11**

Pattern Detection necesita:

mix shifts  
cohort changes  
segment context

para detectar:

Simpson's paradox

structural deterioration

segment-specific issues

---

# **134\. RELACIÓN CON C6.12**

C6.12 conservará:

how context was obtained

which context snapshot was used

why references were considered comparable

---

# **135\. RELACIÓN CON C6.13**

El Finding podrá comunicar:

comparison limitations

sin duplicar todo el contexto.

---

# **136\. TESTS MÍNIMOS**

## **TEST 1 — Same metric, different device**

Mobile CVR y desktop CVR no deben recibir comparabilidad alta automáticamente.

---

## **TEST 2 — Same business, different season**

Black Friday vs normal week debe detectar diferencia estacional.

---

## **TEST 3 — Same business, same season YoY**

Debe presentar comparabilidad superior cuando el resto de dimensiones sean compatibles.

---

## **TEST 4 — New vs Returning**

Debe detectar diferencia material de customer scope.

---

## **TEST 5 — Prospecting vs Retargeting**

No deben tratarse como contextos equivalentes.

---

## **TEST 6 — Generic Benchmark**

Debe poder utilizarse con comparabilidad baja.

---

## **TEST 7 — Internal Comparable**

Una referencia histórica interna suficientemente similar debe superar normalmente una referencia genérica.

---

## **TEST 8 — Internal Non-Comparable**

Una referencia interna de otro modelo comercial no debe considerarse automáticamente mejor.

---

## **TEST 9 — Cohort Maturity**

30-day cohort y 180-day cohort deben poder declararse incompatibles para ciertas métricas.

---

## **TEST 10 — Market Difference**

España vs EEUU debe registrar diferencia contextual.

---

## **TEST 11 — Mix Shift**

Cambio fuerte de new customer share debe quedar reflejado.

---

## **TEST 12 — Promotion State**

Sitewide sale vs full-price period debe detectar diferencia.

---

## **TEST 13 — Missing Critical Context**

Debe producir comparability unknown o degradada.

---

## **TEST 14 — Hard Semantic Conflict**

Average CAC vs marginal CAC debe poder bloquearse según propósito.

---

## **TEST 15 — Context Purpose**

Una misma pareja de datos puede ser:

medium

para análisis descriptivo y:

incompatible

para un guardrail económico específico.

---

## **TEST 16 — Category Mismatch**

Furniture vs beauty generic peer debe degradar comparabilidad.

---

## **TEST 17 — Business Maturity**

Early-stage vs mature scaled business debe registrar diferencia cuando sea relevante.

---

## **TEST 18 — Historical Context Snapshot**

Una evaluación histórica debe utilizar el contexto histórico y no el actual.

---

# **137\. ANTI-PATRÓN — INDUSTRY AVERAGE AS TRUTH**

Incorrecto:

Industry CVR \= 3%

Our CVR \= 2%

Therefore bad.

Sin evaluar comparabilidad.

---

# **138\. ANTI-PATRÓN — INTERNAL ALWAYS BEST**

Incorrecto:

Our historical data  
must always beat external data.

La historia interna puede ser no comparable.

---

# **139\. ANTI-PATRÓN — PEER GROUP POR FACTURACIÓN SOLAMENTE**

Dos ecommerce con la misma facturación pueden tener:

different category

different AOV

different margins

different markets

different acquisition models

No son automáticamente peers.

---

# **140\. ANTI-PATRÓN — IGNORAR MIX**

Incorrecto:

overall CVR improved  
therefore CRO improved

si el mix cambió materialmente.

---

# **141\. ANTI-PATRÓN — IGNORAR SEASONALITY**

Incorrecto comparar:

Black Friday

con:

ordinary February week

sin advertencia.

---

# **142\. ANTI-PATRÓN — COHORTES INMADURAS**

Incorrecto:

August cohort LTV lower than January cohort  
therefore retention deteriorated

si agosto solo tiene 30 días observados.

---

# **143\. ANTI-PATRÓN — SCORE SIN EXPLICACIÓN**

Incorrecto:

comparability \= 82%

sin dimensiones ni razones.

---

# **144\. ANTI-PATRÓN — UNKNOWN AS MATCH**

Incorrecto:

device unknown

interpretado como:

same device

---

# **145\. ANTI-PATRÓN — COMPARAR POR LABEL**

Incorrecto:

CAC vs CAC

sin considerar la semántica C6.1 y el contexto C6.2.

---

# **146\. ACCEPTANCE CRITERIA**

Para cualquier comparación material debemos poder responder:

1\. ¿Qué observación estamos contextualizando?

2\. ¿Qué business model tiene?

3\. ¿Qué categoría/subcategoría?

4\. ¿Qué mercado?

5\. ¿Qué nivel de madurez?

6\. ¿Qué canal?

7\. ¿Qué role del canal?

8\. ¿Qué customer type?

9\. ¿Qué device?

10\. ¿Qué traffic temperature?

11\. ¿Qué producto/categoría?

12\. ¿Qué cohorte?

13\. ¿Qué madurez tiene esa cohorte?

14\. ¿Qué periodo?

15\. ¿Existe estacionalidad?

16\. ¿Existe promoción?

17\. ¿Ha cambiado el customer mix?

18\. ¿Ha cambiado el channel mix?

19\. ¿Ha cambiado el product mix?

20\. ¿Qué reference context estamos usando?

21\. ¿Para qué propósito los comparamos?

22\. ¿Qué dimensiones coinciden?

23\. ¿Qué dimensiones difieren?

24\. ¿Existe alguna incompatibilidad bloqueante?

25\. ¿Qué contexto falta?

26\. ¿Cuál es el nivel de comparabilidad?

27\. ¿Por qué se ha asignado?

---

# **147\. DEFINITION OF DONE**

C6.2 estará formalmente definido cuando exista:

Business Context Model

Metric Context Model

Context Snapshot

Business Model Taxonomy

Category Context

Market Context

Maturity Context

Channel Context

Channel Role

Device Context

Customer Context

Traffic Temperature

Product Context

Cohort Model

Cohort Maturity

Seasonality Context

Promotion Context

Business Event Context

Mix Context

Context Completeness

Comparison Purpose

Comparable Entity Model

Comparability Dimensions

Dimension Materiality

Hard Incompatibilities

Soft Differences

Missing Context Handling

Comparability Status

Comparability Explanation

Peer Group Model

Historical Context Model

Reference Candidate Model

Fallback Hierarchy

Validation Rules

Test Fixtures

---

# **148\. RESULTADO ARQUITECTÓNICO**

Antes de C6.2:

Our CVR \= 1.9%

Benchmark \= 2.8%

Después de C6.2:

Subject:

fashion ecommerce  
Spain  
mobile  
new customers  
Meta prospecting  
cold traffic  
normal promotional state  
scaling-stage business

Reference:

fashion ecommerce peer group  
Southern Europe  
mobile  
mostly new customers  
paid social  
normal trading periods

Comparability:

HIGH / MEDIUM

Material differences:

market composition

Limitations:

traffic-temperature definition unavailable

Todavía NO concluimos:

CVR is bad

Eso pertenece a C6.9.

---

# **149\. PRINCIPIO FINAL DE C6.2**

C6.2 debe imponer:

A benchmark is only useful  
to the extent that its context  
is applicable to the subject.

Y:

same metric  
\+  
different context  
\=  
potentially invalid comparison

Además:

internal  
does not automatically mean comparable

external  
does not automatically mean irrelevant

La jerarquía correcta es:

most relevant  
\+  
most comparable  
\+  
sufficiently reliable

no simplemente:

closest available number.

---

# **150\. SALIDA FORMAL DE C6.2**

C6.2 produce conceptualmente:

CONTEXT\_SNAPSHOT

y:

COMPARABILITY\_ASSESSMENT

y opcionalmente:

REFERENCE\_CANDIDATE\_CONTEXT

para consumidores posteriores.

No produce:

BENCHMARK SELECTION

BENCHMARK STATUS

GUARDRAIL BREACH

SEVERITY

BUSINESS DIAGNOSIS

PRIORITY

RECOMMENDATION

---

# **C6.2 — ESTADO**

CONTRACT:  
C6.2 Context & Comparable Cohort

TYPE:  
Contextualization / Comparability Foundation

PHASE:  
6 — Benchmarks & Guardrails

STATUS:  
Architecture Defined

IMPLEMENTATION:  
Not yet implemented

DEPENDS ON:  
C6.0 Runtime Envelope & Identity  
C6.1 Metric Semantics & Observation

NEXT CONTRACT:  
C6.3 — Data Quality & Measurement Reliability Contract

