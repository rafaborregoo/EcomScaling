# **C6.11 — PATTERN & RED FLAG DETECTION CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Pattern & Red Flag Detection Contract define cómo EcomScaling IA debe detectar, representar y evaluar combinaciones significativas de múltiples señales que, analizadas de forma aislada, podrían no revelar correctamente el estado del ecommerce.

Su misión es responder:

> **¿Qué conjunto de señales está ocurriendo simultáneamente y qué patrón empresarial puede representar?**

C6.11 permite pasar de:

Metric A changed.  
Metric B changed.  
Metric C changed.

a:

A \+ B \+ C  
form a meaningful business pattern.

Ejemplo:

Revenue ↑

AOV ↑

Discount rate ↑

Contribution margin ↓

Cada métrica aislada puede parecer razonable.

Pero juntas pueden indicar:

growth\_quality\_deterioration

o:

unprofitable\_revenue\_growth

---

# **2\. PROBLEMA QUE RESUELVE**

Un ecommerce rara vez se deteriora a través de una única métrica.

Los problemas reales suelen manifestarse mediante combinaciones como:

ROAS ↑  
\+  
MER ↓  
\+  
New Customer Share ↓

o:

Revenue ↑  
\+  
Contribution ↓  
\+  
Refund Rate ↑

o:

Inventory ↑  
\+  
Hero SKU Stockout  
\+  
Long-tail Sell-through ↓

o:

Traffic ↑  
\+  
CVR ↓  
\+  
CAC ↑

Analizar cada señal aisladamente puede producir conclusiones contradictorias.

C6.11 debe interpretar:

the system of signals

sin saltar todavía a una causa definitiva.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Debe mantenerse:

METRIC  
≠  
ANOMALY  
≠  
PATTERN  
≠  
ROOT CAUSE

Una métrica:

CAC ↑

puede producir una anomalía:

persistent CAC deterioration

Varias anomalías/evaluaciones pueden producir un patrón:

acquisition efficiency deterioration

Pero ese patrón todavía no demuestra:

root cause \= creative fatigue

---

# **4\. SEGUNDO PRINCIPIO**

Un patrón debe requerir:

multiple structured signals

o una condición empresarial compuesta suficientemente explícita.

No:

LLM intuition alone.

---

# **5\. TERCER PRINCIPIO**

Debe distinguirse:

PATTERN

de:

RED FLAG

Un patrón describe una configuración significativa de señales.

Una red flag representa un patrón cuya combinación puede indicar:

material risk

dangerous deterioration

hidden fragility

business inconsistency

unsafe scaling condition

Por tanto:

all red flags are patterns

but

not all patterns are red flags

---

# **6\. CUARTO PRINCIPIO**

Las señales contradictorias deben conservarse.

Nunca:

discard contradictory metrics  
to make pattern cleaner.

---

# **7\. RESPONSABILIDAD**

C6.11 debe determinar:

WHAT signals exist?

WHICH signals belong together?

WHAT pattern definition matches?

WHAT conditions are required?

WHAT conditions are optional?

WHAT signals contradict the pattern?

HOW persistent is the pattern?

HOW widespread is it?

HOW material is it?

IS it a red flag?

WHAT severity does it represent?

HOW confident are we?

WHAT evidence is missing?

WHAT alternative patterns remain plausible?

---

# **8\. LO QUE C6.11 NO DEBE HACER**

C6.11 NO debe determinar como autoridad final:

root cause

priority

strategy

playbook

recommended action

resource allocation

execution

Puede decir:

The signal combination is consistent with  
acquisition saturation risk.

Pero no:

Meta audience saturation is the root cause.

---

# **9\. PATTERN DEFINITION**

Debe existir conceptualmente:

PATTERN\_DEFINITION

que representa qué señales constituyen un patrón conocido.

---

# **10\. PATTERN DETECTION**

Separadamente:

PATTERN\_DETECTION

representa una instancia concreta detectada en un negocio.

---

# **11\. PATTERN\_ID**

Toda definición debe disponer de:

pattern\_id

estable.

Ejemplo:

pattern.acquisition.efficiency\_deterioration

---

# **12\. PATTERN\_VERSION**

Toda definición debe ser versionable:

pattern\_version

---

# **13\. PATTERN CATALOG**

Las definiciones deben pertenecer a:

pattern\_catalog\_version

C6.0 deberá congelar la versión utilizada.

---

# **14\. DETECTION\_ID**

Cada instancia detectada debe tener:

pattern\_detection\_id

único.

---

# **15\. RUN RELATION**

Debe enlazar:

run\_id

trace\_id

---

# **16\. PATTERN FAMILY**

Taxonomía inicial:

acquisition

paid\_media

conversion

offer

pricing

merchandising

retention

unit\_economics

profitability

cash

operations

customer\_experience

inventory

scalability

measurement

cross\_functional

---

# **17\. PATTERN TYPE**

Debe poder diferenciar:

descriptive\_pattern

deterioration\_pattern

improvement\_pattern

risk\_pattern

red\_flag

inconsistency\_pattern

constraint\_pattern

masking\_pattern

systemic\_pattern

---

# **18\. DESCRIPTIVE PATTERN**

Describe una combinación relevante sin afirmar riesgo.

Ejemplo:

Revenue growth  
driven predominantly by returning customers.

---

# **19\. DETERIORATION PATTERN**

Ejemplo:

traffic stable

CVR declining

CAC increasing

---

# **20\. IMPROVEMENT PATTERN**

Ejemplo:

CVR ↑

AOV ↑

Contribution/order ↑

Refunds stable

Puede representar mejora de calidad comercial.

---

# **21\. RISK PATTERN**

Ejemplo:

Revenue ↑

Cash conversion worsening

Inventory commitment ↑

---

# **22\. INCONSISTENCY PATTERN**

Ejemplo:

Platform ROAS ↑

MER ↓

Puede existir una inconsistencia entre perspectivas de medición.

---

# **23\. CONSTRAINT PATTERN**

Ejemplo:

Demand ↑

Hero SKU coverage ↓

Fulfillment utilization ↑

puede señalar:

growth constrained by operations/inventory

---

# **24\. MASKING PATTERN**

Representa casos en los que un agregado oculta deterioro.

Ejemplo:

blended CVR stable

new-customer CVR ↓

returning customer share ↑

---

# **25\. SYSTEMIC PATTERN**

Afecta varios subsistemas simultáneamente.

Ejemplo:

CAC ↑

CVR ↓

Contribution ↓

Cash pressure ↑

Inventory aging ↑

---

# **26\. RED FLAG**

Una red flag debe ser:

explicitly classified

No todo patrón negativo debe marcarse como red flag.

---

# **27\. RED FLAG DEFINITION**

Debe existir:

is\_red\_flag \= true

en la definición cuando corresponda.

---

# **28\. RED FLAG PURPOSE**

Su misión es señalar:

conditions that deserve heightened attention  
because their combination may indicate  
material business danger.

---

# **29\. RED FLAG ≠ PRIORITY**

Una red flag puede ser grave.

Pero:

red flag  
≠  
P0

Fase 4 decide priority.

---

# **30\. RED FLAG ≠ ROOT CAUSE**

Tampoco:

red flag  
≠  
causal diagnosis

---

# **31\. SIGNAL**

La unidad de entrada de un patrón debe ser:

SIGNAL

---

# **32\. SIGNAL SOURCES**

Una señal puede proceder de:

metric observation

benchmark evaluation

guardrail evaluation

anomaly detection

trend

mix assessment

data-quality issue

context event

---

# **33\. SIGNAL\_ID**

Toda señal material debe poder identificarse.

---

# **34\. SIGNAL TYPE**

Ejemplos:

metric\_state

comparison\_state

guardrail\_breach

anomaly

trend

mix\_shift

context\_change

data\_quality\_issue

---

# **35\. SIGNAL CONDITION**

Ejemplo:

metric:  
new\_customer\_cac

condition:  
deteriorating

---

# **36\. SIGNAL VALUE**

Puede conservar:

actual value

status

magnitude

direction

confidence

---

# **37\. REQUIRED SIGNAL**

Una definición puede exigir:

required \= true

---

# **38\. OPTIONAL SIGNAL**

También:

required \= false

puede reforzar el patrón.

---

# **39\. SUPPORTING SIGNAL**

Representa evidencia favorable al patrón.

---

# **40\. CONTRADICTORY SIGNAL**

Debe poder definirse explícitamente.

Ejemplo:

Pattern:

demand\_quality\_deterioration

Supporting:

CVR ↓  
CAC ↑

Contradictory:

new-customer qualified traffic ↑

---

# **41\. EXCLUSION CONDITION**

Algunas condiciones pueden invalidar un patrón.

Ejemplo:

tracking outage active

puede impedir confirmar:

conversion deterioration

---

# **42\. REQUIRED ≠ SUFFICIENT CAUSALITY**

Aunque se cumplan todas las condiciones del patrón:

pattern detected

no significa:

cause confirmed.

---

# **43\. CONDITION LOGIC**

La definición debe soportar lógica declarativa:

AND

OR

NOT

---

# **44\. NO ARBITRARY CODE**

No almacenar:

eval(javascript)

como pattern condition.

Las reglas deben ser:

declarative

validated

versioned

auditable

---

# **45\. MINIMUM SIGNAL COUNT**

Puede existir:

minimum\_signal\_count

---

# **46\. MINIMUM REQUIRED CONDITIONS**

Puede existir:

minimum\_required\_conditions

---

# **47\. WEIGHTED SIGNALS**

Algunas señales pueden tener más importancia.

Puede existir:

signal\_weight

pero debe estar definido por metodología/policy.

---

# **48\. CRITICAL SIGNAL**

Una señal puede ser:

critical\_signal \= true

Ejemplo:

En un pattern de insolvencia operativa:

cash runway critical

puede ser indispensable.

---

# **49\. TEMPORAL ALIGNMENT**

Las señales deben ocurrir dentro de ventanas compatibles.

No formar un patrón con:

CAC anomaly from January  
\+  
CVR anomaly from September

sin justificación.

---

# **50\. PATTERN WINDOW**

Debe existir:

pattern\_window

---

# **51\. SIMULTANEOUS PATTERN**

Puede requerir:

signals overlap in time

---

# **52\. SEQUENTIAL PATTERN**

Otros patrones pueden ser secuenciales.

Ejemplo:

discounting ↑  
→  
AOV ↑  
→  
margin ↓  
→  
refund rate ↑

Debe poder representarse:

sequence\_required \= true

---

# **53\. SEQUENCE ≠ CAUSALITY**

El orden temporal ayuda.

Pero:

temporal sequence  
≠  
causal proof

---

# **54\. PERSISTENCE**

Debe poder exigirse:

minimum\_pattern\_duration

---

# **55\. OCCURRENCE RULE**

Ejemplo:

pattern present  
in 3 of last 4 weeks

---

# **56\. ISOLATED PATTERN**

Algunos patrones sí pueden ser instantáneos.

Ejemplo:

hero SKU stockout  
\+  
paid spend still accelerating

---

# **57\. PATTERN STATUS**

Estados iniciales:

candidate

supported

confirmed

monitoring

resolved

dismissed

suppressed

---

# **58\. CANDIDATE**

Coinciden algunas señales.

Todavía no existe suficiente evidencia.

---

# **59\. SUPPORTED**

Existe evidencia suficiente para considerar el patrón plausible.

---

# **60\. CONFIRMED**

Cumple requisitos de señal, calidad y confidence establecidos.

No significa causalidad confirmada.

---

# **61\. MONITORING**

Patrón activo que requiere seguir evolución.

---

# **62\. RESOLVED**

Las condiciones han dejado de cumplirse.

---

# **63\. DISMISSED**

Posteriormente se concluye que no representaba un patrón válido.

---

# **64\. SUPPRESSED**

Detectado pero silenciado por:

known event

policy

maintenance

expected campaign

---

# **65\. PATTERN DIRECTION**

Puede existir:

positive

negative

mixed

neutral

unknown

---

# **66\. PATTERN SEVERITY**

Escala conceptual:

informational

low

medium

high

critical

---

# **67\. SEVERITY BASIS**

Puede depender de:

signal severity

guardrail breaches

economic exposure

scope

persistence

systemic breadth

---

# **68\. SEVERITY ≠ CONFIDENCE**

Ejemplo:

severity:  
critical

confidence:  
low

es válido.

---

# **69\. SEVERITY ≠ PRIORITY**

También:

severity:  
critical

no significa automáticamente:

priority:  
P0

---

# **70\. PATTERN MATERIALITY**

Debe existir:

materiality

separadamente.

---

# **71\. MATERIALITY FACTORS**

Ejemplos:

revenue exposed

customers affected

margin impact

cash impact

inventory exposure

duration

---

# **72\. SCOPE**

Un patrón debe declarar qué área afecta.

Ejemplos:

business-wide

market

channel

device

customer segment

product category

SKU

cohort

---

# **73\. BREADTH**

Puede existir:

local

multi\_segment

cross\_functional

business\_wide

---

# **74\. LOCAL PATTERN**

Ejemplo:

Meta prospecting Spain deterioration

---

# **75\. CROSS-FUNCTIONAL PATTERN**

Ejemplo:

paid media inefficiency

inventory pressure

cash stress

simultáneamente.

---

# **76\. SYSTEMIC RED FLAG**

Puede existir cuando:

multiple core systems  
show materially adverse conditions

---

# **77\. CONFIDENCE**

Debe utilizar C6.8.

Puede producir:

pattern\_confidence

---

# **78\. CONFIDENCE INPUTS**

Ejemplos:

number of supporting signals

signal confidence

signal independence

contradictory evidence

pattern specificity

temporal alignment

data quality

persistence

---

# **79\. SIGNAL CONFIDENCE PROPAGATION**

Un pattern no debería tener confidence alta si depende de señales críticas low-confidence.

---

# **80\. CRITICAL SIGNAL CEILING**

Ejemplo:

required signal confidence \= low

maximum pattern confidence \= low/medium

según policy.

---

# **81\. EVIDENCE INDEPENDENCE**

Debe evitarse inflar confianza mediante métricas derivadas de la misma señal.

Ejemplo:

Meta ROAS ↓

Meta attributed revenue ↓

no son necesariamente dos evidencias independientes.

---

# **82\. INDEPENDENT SIGNAL GROUP**

Puede existir:

evidence\_group\_id

para agrupar señales relacionadas.

---

# **83\. CONTRADICTORY EVIDENCE**

Toda detección debe poder conservar:

contradictory\_signals

---

# **84\. MISSING EVIDENCE**

Debe existir:

missing\_signals

cuando el patrón necesita más información.

---

# **85\. ALTERNATIVE PATTERNS**

Una misma señal puede encajar en varios patrones.

Debe soportarse:

alternative\_pattern\_candidates

---

# **86\. NO FORCED SINGLE PATTERN**

Ejemplo:

CAC ↑  
CVR ↓

puede ser consistente con:

traffic quality deterioration

offer deterioration

pricing friction

site friction

C6.11 no debe elegir una causa.

---

# **87\. PATTERN SPECIFICITY**

Debe diferenciarse:

broad pattern

de:

specific pattern

Ejemplo amplio:

acquisition deterioration

más específico:

paid-social scale inefficiency

---

# **88\. PARENT PATTERN**

Puede existir una jerarquía:

acquisition deterioration  
    ↓  
paid media deterioration  
        ↓  
prospecting scaling deterioration

---

# **89\. PATTERN RELATIONSHIPS**

Puede soportar:

parent\_of

child\_of

co\_occurs\_with

excludes

supersedes

derived\_from

---

# **90\. PATTERN SUPERSESSION**

Un patrón amplio puede ser sustituido por uno más específico cuando aparece evidencia suficiente.

---

# **91\. NO DUPLICATE ALERTING**

Si:

specific pattern confirmed

puede evitarse generar cinco alertas redundantes de sus padres.

Debe existir policy.

---

# **92\. PATTERN DEDUPLICATION**

Puede existir:

pattern\_signature

para detectar duplicados.

---

# **93\. PATTERN SIGNATURE**

Podría derivarse de:

pattern\_id

scope

time window

relevant entities

---

# **94\. MERGE DETECTIONS**

Detecciones sucesivas del mismo patrón pueden:

extend existing detection

en vez de crear ruido.

---

# **95\. NEW DETECTION VS CONTINUATION**

Debe diferenciarse:

new occurrence

continued occurrence

---

# **96\. PATTERN ONSET**

Debe existir:

onset\_at

o período equivalente.

---

# **97\. DETECTED\_AT**

Separadamente:

detected\_at

---

# **98\. DURATION**

Debe poder calcularse.

---

# **99\. RECOVERY**

Puede existir:

recovering

resolved

---

# **100\. RED FLAG CATEGORIES**

Taxonomía inicial útil:

profitability\_erosion

growth\_quality\_deterioration

paid\_media\_attribution\_risk

acquisition\_saturation\_risk

retention\_deterioration

cash\_stress

inventory\_imbalance

operational\_overload

customer\_experience\_deterioration

mix\_shift\_masking

segment\_divergence

channel\_concentration

dependency\_risk

unsafe\_scaling

measurement\_integrity\_risk

---

# **101\. PROFITABILITY EROSION**

Ejemplo:

Revenue ↑

Gross margin ↓

Contribution ↓

Puede representar:

profitability\_erosion

---

# **102\. GROWTH QUALITY DETERIORATION**

Ejemplo:

Revenue ↑

Discount rate ↑

Contribution/order ↓

Refund rate ↑

El negocio crece.

Pero la calidad del crecimiento empeora.

---

# **103\. PAID MEDIA ATTRIBUTION RISK**

Ejemplo:

Platform ROAS ↑

MER ↓

New Customer Share ↓

Platform-attributed revenue ↑

Puede indicar:

attribution distortion risk

No demuestra fraude ni medición incorrecta.

---

# **104\. ACQUISITION SATURATION RISK**

Ejemplo:

Spend ↑

Marginal CAC ↑

Reach growth ↓

Frequency ↑

Incremental customer growth ↓

Puede ser consistente con saturación.

Debe permanecer:

risk pattern

no causal diagnosis.

---

# **105\. DEMAND QUALITY DETERIORATION**

Ejemplo:

Traffic ↑

CVR ↓

Bounce/friction signals ↑

CAC ↑

Puede indicar deterioro de la calidad de demanda.

---

# **106\. RETENTION DETERIORATION**

Ejemplo:

Repeat rate ↓

Cohort LTV ↓

Time to second purchase ↑

---

# **107\. CASH STRESS**

Ejemplo:

Revenue ↑

CAC ↑

Payback ↑

Inventory commitment ↑

Cash buffer ↓

Puede señalar:

growth-induced cash stress

---

# **108\. INVENTORY IMBALANCE**

Ejemplo:

Total inventory ↑

Hero SKU stockout

Long-tail aging ↑

Esta combinación es mucho más informativa que:

inventory value ↑

aisladamente.

---

# **109\. OPERATIONAL OVERLOAD**

Ejemplo:

Orders ↑

Fulfillment time ↑

Cancellation rate ↑

Support backlog ↑

---

# **110\. CUSTOMER EXPERIENCE DETERIORATION**

Ejemplo:

Support tickets ↑

Delivery delays ↑

Refunds ↑

Repeat rate ↓

---

# **111\. MIX SHIFT MASKING**

Ejemplo:

Blended CVR stable

New-customer CVR ↓

Returning customer share ↑

Patrón:

aggregate stability masking segment deterioration

---

# **112\. SEGMENT DIVERGENCE**

Ejemplo:

Desktop stable

Mobile ↓

Spain stable

Germany ↓

Puede detectar problema localizado.

---

# **113\. CHANNEL CONCENTRATION**

Ejemplo:

Paid revenue share ↑

One-channel spend share ↑

Organic demand ↓

---

# **114\. UNSAFE SCALING**

Ejemplo:

Spend ↑

Marginal CAC \> guardrail

Cash guardrail breached

Inventory headroom ↓

Debe ser una red flag fuerte.

Pero todavía no determina:

stop spending

---

# **115\. MEASUREMENT INTEGRITY RISK**

Ejemplo:

Platform conversions ↑

Shopify orders stable

tracking deployment changed

GA4 purchases ↓

Puede indicar:

measurement inconsistency

---

# **116\. SIMPSON'S PARADOX PATTERN**

Debe poder existir un pattern específico.

Ejemplo:

Global:

CVR ↑

Segmentos:

New Customer CVR ↓

Returning Customer CVR ↓

pero mix cambia hacia el segmento históricamente más fuerte.

Resultado:

aggregate improvement  
masking within-segment deterioration

---

# **117\. SIMPSON'S PARADOX REQUIREMENTS**

Debe verificar:

aggregate direction

segment directions

mix weights

materiality

antes de marcarlo.

---

# **118\. BLENDED VS SEGMENTED**

C6.11 debe apoyarse expresamente en la separación de C6.1.

---

# **119\. AVERAGE VS MARGINAL PATTERN**

Ejemplo:

Average CAC stable

Marginal CAC ↑ sharply

Puede producir:

scale\_efficiency\_deterioration

aunque blended economics parezca estable.

---

# **120\. ATTRIBUTED VS INCREMENTAL PATTERN**

Ejemplo:

Platform ROAS ↑

Incremental ROAS ↓

Debe conservar ambas semánticas.

---

# **121\. OBSERVED VS PREDICTED PATTERN**

Ejemplo:

Observed repeat revenue stable

Predicted LTV ↓

puede ser un early warning.

No tratar predicted como actual.

---

# **122\. LEADING VS LAGGING SIGNALS**

Debe poder diferenciar:

leading

concurrent

lagging

---

# **123\. LEADING SIGNAL**

Ejemplo:

inventory coverage ↓

puede anticipar stockout.

---

# **124\. LAGGING SIGNAL**

Ejemplo:

refund rate ↑

puede aparecer después de un problema operativo.

---

# **125\. SIGNAL TEMPORAL ROLE**

Puede existir:

temporal\_role

---

# **126\. PATTERN TIMELINE**

Puede representar:

signal A onset

signal B onset

signal C onset

sin afirmar causalidad.

---

# **127\. PATTERN STRENGTH**

Debe existir:

weak

moderate

strong

very\_strong

o taxonomy equivalente.

---

# **128\. STRENGTH BASIS**

Puede considerar:

condition coverage

signal magnitude

persistence

evidence independence

contradiction level

---

# **129\. STRENGTH ≠ CONFIDENCE**

Pattern strength:

> Qué intensamente se presenta la configuración.

Confidence:

> Qué seguros estamos de que la configuración es real.

Ejemplo:

pattern strength:  
extreme

confidence:  
low

si tracking es defectuoso.

---

# **130\. PATTERN SCORE**

Puede existir internamente:

pattern\_score

---

# **131\. NO MAGIC PATTERN SCORE**

Nunca:

pattern\_score \= 87  
therefore critical

sin descomposición.

---

# **132\. CONDITION COVERAGE**

Puede existir:

conditions\_met / conditions\_total

pero no equivale automáticamente a confidence.

---

# **133\. CRITICAL CONDITION FAILURE**

Si falta una condición obligatoria:

pattern cannot become confirmed.

---

# **134\. QUALITY GATE**

C6.3 puede imponer:

minimum quality per critical signal

---

# **135\. CONFIDENCE GATE**

C6.8 puede imponer:

minimum confidence

para pattern confirmation.

---

# **136\. MATERIALITY GATE**

Puede existir:

minimum materiality

para convertir pattern en red flag.

---

# **137\. RED FLAG SEVERITY POLICY**

Debe venir de C6.6.

No hardcodear:

3 bad metrics \= critical

---

# **138\. COMPOUND GUARDRAIL RELATION**

Algunos patterns pueden coincidir con guardrails compuestos.

Debe conservarse separación:

compound guardrail breach

vs:

pattern detection

---

# **139\. GUARDRAIL ROLE**

Guardrails representan límites predefinidos.

Patterns representan combinaciones observadas.

---

# **140\. PATTERN CAN EXIST WITHOUT BREACH**

Ejemplo:

CAC deteriorating

CVR deteriorating

but still within limits

Puede existir early-warning pattern.

---

# **141\. BREACH CAN EXIST WITHOUT PATTERN**

Ejemplo:

cash below minimum

sin otras señales.

---

# **142\. PATTERN EVIDENCE**

Debe incluir:

supporting\_signal\_ids

contradictory\_signal\_ids

missing\_signal\_ids

---

# **143\. PATTERN LIMITATIONS**

Debe existir:

limitations

---

# **144\. PATTERN ASSUMPTIONS**

Cuando existan:

assumptions

---

# **145\. ALTERNATIVE INTERPRETATIONS**

Puede existir:

alternative\_interpretations

sin declarar ninguna como causa definitiva.

---

# **146\. PATTERN EXPLANATION**

Debe poder derivarse una explicación humana.

Ejemplo:

Revenue has increased while contribution margin,  
discount rate and refund rate have deteriorated,  
which is consistent with lower-quality growth.

---

# **147\. PATTERN DEFINITION SHAPE**

Conceptualmente:

pattern\_definition:

    identity:  
        pattern\_id  
        pattern\_version  
        pattern\_catalog\_version

    classification:  
        family  
        pattern\_type  
        is\_red\_flag

    purpose:  
        description  
        business\_meaning

    scope:  
        applicable\_metrics  
        applicable\_business\_models  
        applicable\_contexts

    conditions:  
        required\_signals  
        optional\_signals  
        contradictory\_signals  
        exclusion\_conditions

    logic:  
        boolean\_structure  
        minimum\_signal\_count  
        critical\_signals

    temporal:  
        pattern\_window  
        minimum\_duration  
        occurrence\_rule  
        sequence\_requirements

    gates:  
        minimum\_quality  
        minimum\_confidence  
        minimum\_materiality

    severity:  
        severity\_mapping

    relationships:  
        parent\_pattern  
        related\_patterns  
        mutually\_exclusive\_patterns

    governance:  
        status  
        effective\_from  
        effective\_to

---

# **148\. PATTERN DETECTION SHAPE**

Conceptualmente:

pattern\_detection:

    identity:  
        pattern\_detection\_id  
        run\_id  
        trace\_id  
        pattern\_id  
        pattern\_version

    scope:  
        business  
        market  
        channel  
        device  
        segment  
        product  
        cohort

    signals:  
        supporting  
        contradictory  
        missing  
        excluded

    temporal:  
        onset  
        detected\_at  
        duration  
        persistence

    assessment:  
        conditions\_met  
        critical\_conditions\_met  
        pattern\_strength  
        materiality  
        severity

    confidence:  
        pattern\_confidence  
        confidence\_assessment\_id

    alternatives:  
        alternative\_pattern\_candidates  
        alternative\_interpretations

    lifecycle:  
        status  
        suppression  
        recovery

    explanation:  
        reason\_codes  
        structured\_interpretation  
        limitations

---

# **149\. EXAMPLE — GROWTH QUALITY DETERIORATION**

Signals:

Revenue:  
\+22%

Orders:  
\+17%

Discount rate:  
\+31%

Contribution/order:  
\-18%

Refund rate:  
\+14%

Pattern definition:

pattern:  
growth\_quality\_deterioration

Detection:

supporting signals:  
5

contradictory:  
0

duration:  
6 weeks

materiality:  
high

pattern strength:  
strong

confidence:  
high

red flag:  
true

Interpretation:

Revenue growth is being accompanied by  
deterioration in contribution and post-purchase  
quality indicators.

No concluir todavía:

stop discounting

---

# **150\. EXAMPLE — ATTRIBUTION INCONSISTENCY**

Signals:

Meta ROAS:  
\+24%

Meta attributed revenue:  
\+31%

MER:  
\-11%

New customer share:  
\-9%

Blended CAC:  
\+13%

Pattern:

paid\_media\_attribution\_risk

Interpretation:

Platform-reported improvement is not confirmed  
by blended business economics.

No afirmar:

Meta reporting is false.

---

# **151\. EXAMPLE — UNSAFE SCALING**

Signals:

Spend:  
\+35%

Marginal CAC:  
above critical guardrail

Cash buffer:  
risk

Hero SKU coverage:  
warning

Fulfillment utilization:  
92%

Pattern:

unsafe\_scaling

Severity:

high / critical

Confidence:

high

C6.11 todavía NO dice:

reduce spend 25%.

---

# **152\. EXAMPLE — INVENTORY IMBALANCE**

Total inventory value:  
\+28%

Long-tail aging:  
\+41%

Hero SKU stock coverage:  
4 days

Lost sales from stockouts:  
increasing

Pattern:

inventory\_imbalance

Interpretation:

Inventory capital is increasing while availability  
is deteriorating in commercially important SKUs.

---

# **153\. EXAMPLE — OPERATIONAL OVERLOAD**

Signals:

Orders:  
\+40%

Fulfillment time:  
\+38%

Cancellation rate:  
\+22%

Support backlog:  
\+60%

Pattern:

operational\_overload

No afirmar todavía:

warehouse staffing is insufficient

Eso sería hipótesis causal.

---

# **154\. EXAMPLE — MIX MASKING**

Blended CVR:  
stable

New Customer CVR:  
\-17%

Returning Customer CVR:  
stable

Returning Customer Share:  
\+24%

Pattern:

mix\_shift\_masking

Severity:

medium

Interpretation:

Aggregate conversion stability masks deterioration  
in new-customer conversion.

---

# **155\. EXAMPLE — SIMPSON'S PARADOX**

Overall:

CVR:  
2.8% → 3.0%

Segments:

Mobile:  
2.0% → 1.8%

Desktop:  
4.0% → 3.8%

Mix:

Desktop traffic share increased materially.

Pattern:

simpsons\_paradox\_candidate

Debe confirmarse matemáticamente antes de usar:

confirmed

---

# **156\. EXAMPLE — CASH STRESS**

Revenue:  
\+18%

Inventory investment:  
\+35%

CAC:  
\+22%

Payback:  
\+31 days

Cash buffer:  
\-40%

Pattern:

growth\_induced\_cash\_stress

---

# **157\. EXAMPLE — MEASUREMENT RISK**

Signals:

GA4 purchases:  
\-35%

Shopify orders:  
stable

Meta conversions:  
\+12%

tracking deployment:  
changed yesterday

Pattern:

measurement\_integrity\_risk

Confidence:

high

Business deterioration confidence:

low

---

# **158\. PATTERN LIFECYCLE**

Debe conservar la evolución.

Ejemplo:

Week 1:  
candidate

Week 2:  
supported

Week 4:  
confirmed

Week 7:  
monitoring

Week 10:  
resolved

---

# **159\. PATTERN HISTORY**

No sobrescribir:

candidate

cuando posteriormente se confirme.

Debe mantenerse timeline.

---

# **160\. PATTERN REASSESSMENT**

Nueva evidencia puede producir:

new pattern assessment

o actualización versionada del lifecycle.

---

# **161\. RECLASSIFICATION**

Un pattern puede cambiar.

Ejemplo:

Inicialmente:

acquisition deterioration

posteriormente:

measurement integrity risk

tras detectar fallo de tracking.

Debe conservarse historial.

---

# **162\. SUPPRESSION**

Algunos patterns pueden suprimirse.

Ejemplo:

planned clearance campaign

produce:

margin ↓  
discount ↑

de forma esperada.

---

# **163\. SUPPRESSION REASON**

Debe existir:

suppression\_reason

---

# **164\. SUPPRESSION ≠ DELETION**

El pattern sigue auditable.

---

# **165\. PATTERN POLICY**

C6.6 podrá configurar:

enabled patterns

minimum duration

required signals

severity mappings

suppression rules

confirmation thresholds

---

# **166\. TENANT-SPECIFIC PATTERNS**

Un negocio puede disponer de patrones propios.

Ejemplo:

subscription churn risk

para subscription ecommerce.

---

# **167\. GLOBAL PATTERN DEFINITIONS**

El sistema puede ofrecer patrones comunes.

Pero sus thresholds deben seguir policy/context.

---

# **168\. NO UNIVERSAL NUMERIC CONDITIONS**

Incorrecto:

CAC \+10%  
AND  
CVR \-10%  
\=  
acquisition failure

universalmente.

La materialidad debe ser configurable.

---

# **169\. PATTERN CATALOG GOVERNANCE**

Estados:

draft

active

deprecated

retired

---

# **170\. VERSION IMMUTABILITY**

Una definición utilizada históricamente debe permanecer accesible.

---

# **171\. HISTORICAL REPLAY**

Replay debe usar:

historical pattern catalog

historical policies

historical observations

---

# **172\. DETERMINISTIC CORE**

La evaluación de condiciones debería ser determinista cuando sea posible.

---

# **173\. AI ASSISTANCE**

La IA puede ayudar a:

interpret unstructured evidence

generate human explanation

surface candidate relationships

pero no debe ignorar pattern definitions ni policies.

---

# **174\. LLM DISCOVERED PATTERN**

Puede permitirse:

novel\_pattern\_candidate

si la IA detecta una combinación no catalogada.

Pero debe etiquetarse claramente.

---

# **175\. NOVEL PATTERN**

No debe convertirse automáticamente en:

confirmed canonical pattern.

---

# **176\. NOVEL PATTERN REVIEW**

Puede requerir:

human review

later validation

Phase 9 learning

---

# **177\. DISCOVERED VS CANONICAL**

Debe distinguirse:

catalog\_pattern

novel\_candidate\_pattern

---

# **178\. PATTERN REASON CODES**

Ejemplos:

PAT\_MULTI\_SIGNAL\_CONFIRMATION

PAT\_GUARDRAIL\_COMBINATION

PAT\_SEGMENT\_DIVERGENCE

PAT\_MIX\_MASKING

PAT\_ATTRIBUTION\_INCONSISTENCY

PAT\_ECONOMIC\_EROSION

PAT\_INVENTORY\_IMBALANCE

PAT\_OPERATIONAL\_OVERLOAD

PAT\_CASH\_STRESS

PAT\_SCALE\_CONSTRAINT

PAT\_MEASUREMENT\_RISK

PAT\_CONTRADICTORY\_EVIDENCE

PAT\_INSUFFICIENT\_SIGNAL\_CONFIDENCE

---

# **179\. EVIDENCE LINEAGE**

Cada señal debe ser trazable posteriormente mediante C6.12.

---

# **180\. PATTERN CLAIM LANGUAGE**

High confidence confirmed:

The evidence shows a persistent pattern of...

Medium:

The signals are consistent with...

Low:

There are preliminary indications of...

Insufficient:

There is not enough evidence to confirm...

---

# **181\. FACT VS PATTERN INTERPRETATION**

Ejemplo:

FACT:

Revenue \+20%.  
Contribution/order \-15%.

PATTERN:

growth quality deterioration

HYPOTHESIS:

discounting may be contributing.

Estas capas deben permanecer separadas.

---

# **182\. PATTERN ≠ DIAGNOSIS**

Pattern:

acquisition efficiency deterioration

Diagnosis posible futura:

traffic quality deterioration

o:

offer fatigue

o:

market saturation

Fase 3 debe resolverlo.

---

# **183\. PATTERN ≠ RECOMMENDATION**

Pattern:

inventory imbalance

No implica directamente:

discount long-tail by 20%.

---

# **184\. PATTERN ≠ PRIORITY**

Puede haber:

critical pattern

pero:

another issue may have greater impact,  
higher confidence or stronger urgency.

Fase 4 decidirá.

---

# **185\. RELACIÓN CON C6.0**

C6.0 aporta:

run

trace

versions

tenant

business

---

# **186\. RELACIÓN CON C6.1**

C6.1 garantiza que:

average ≠ marginal

attributed ≠ incremental

observed ≠ predicted

blended ≠ segmented

lo cual es fundamental para patterns fiables.

---

# **187\. RELACIÓN CON C6.2**

C6.2 aporta:

segments

cohorts

mix

seasonality

context

---

# **188\. RELACIÓN CON C6.3**

C6.3 aporta:

data quality

tracking incidents

measurement breaks

---

# **189\. RELACIÓN CON C6.4**

Benchmarks pueden formar parte de señales:

materially below history

above peer median

---

# **190\. RELACIÓN CON C6.5**

Guardrail breaches pueden ser señales críticas.

---

# **191\. RELACIÓN CON C6.6**

Policies controlan:

pattern definitions

thresholds

severity

confirmation rules

---

# **192\. RELACIÓN CON C6.7**

C6.7 garantiza que las referencias utilizadas por las señales sean correctas.

---

# **193\. RELACIÓN CON C6.8**

C6.8 aporta:

signal confidence

pattern confidence

uncertainty

contradictions

---

# **194\. RELACIÓN CON C6.9**

C6.9 aporta:

statuses

materiality

guardrail evaluations

comparison results

---

# **195\. RELACIÓN CON C6.10**

C6.10 aporta:

anomalies

trends

regime changes

mix effects

measurement anomalies

---

# **196\. RELACIÓN CON C6.12**

C6.12 debe reconstruir:

signal A  
\+  
signal B  
\+  
signal C  
→  
pattern definition  
→  
condition evaluation  
→  
pattern detection  
→  
confidence

---

# **197\. RELACIÓN CON C6.13**

C6.13 convertirá patterns/red flags relevantes en findings normalizados.

---

# **198\. RELACIÓN CON C6.14**

El handoff puede enviar:

pattern

red flag

severity

confidence

supporting signals

limitations

a otras fases.

---

# **199\. RELACIÓN CON C6.15**

Admin debe poder responder:

¿Por qué se detectó este red flag?

¿Qué señales lo activaron?

¿Cuál faltó?

¿Qué señal lo contradice?

¿Qué versión del pattern se utilizó?

¿Cuánto tiempo lleva activo?

---

# **200\. RELACIÓN CON FASE 3**

Fase 3 debe utilizar patterns como inputs de diagnóstico.

No como root causes automáticas.

---

# **201\. RELACIÓN CON FASE 4**

Fase 4 utiliza:

severity

materiality

confidence

breadth

persistence

para priorizar.

---

# **202\. RELACIÓN CON FASE 7**

Fase 7 utilizará el pattern \+ diagnóstico para recomendar intervenciones.

---

# **203\. RELACIÓN CON FASE 9**

Patterns detectados podrán evaluarse contra resultados reales para:

calibrate detection

discover new patterns

retire weak patterns

---

# **204\. INVARIANTES C6.11**

## **INV-C6.11-001**

Todo patrón debe tener una definición o estar etiquetado como novel candidate.

---

## **INV-C6.11-002**

Todo pattern material debe tener múltiples señales o una condición compuesta explícita.

---

## **INV-C6.11-003**

Pattern no equivale a root cause.

---

## **INV-C6.11-004**

Pattern no equivale a priority.

---

## **INV-C6.11-005**

Pattern no equivale a recommendation.

---

## **INV-C6.11-006**

Red flag no equivale automáticamente a P0.

---

## **INV-C6.11-007**

Las señales contradictorias deben preservarse.

---

## **INV-C6.11-008**

Las señales faltantes deben preservarse.

---

## **INV-C6.11-009**

Las señales críticas de baja confianza deben limitar pattern confidence.

---

## **INV-C6.11-010**

Las señales correlacionadas no deben contabilizarse como plenamente independientes.

---

## **INV-C6.11-011**

El tiempo de las señales debe ser compatible.

---

## **INV-C6.11-012**

Secuencia temporal no implica causalidad.

---

## **INV-C6.11-013**

Blended signals no deben ocultar segmentos.

---

## **INV-C6.11-014**

Average no debe ocultar marginal.

---

## **INV-C6.11-015**

Attributed no debe sustituir incremental.

---

## **INV-C6.11-016**

Predicted no debe presentarse como observed.

---

## **INV-C6.11-017**

Measurement patterns deben distinguirse de business patterns.

---

## **INV-C6.11-018**

Severity y confidence deben permanecer separados.

---

## **INV-C6.11-019**

Severity y priority deben permanecer separados.

---

## **INV-C6.11-020**

Pattern strength y confidence deben permanecer separados.

---

## **INV-C6.11-021**

Pattern confirmation requiere cumplir condiciones críticas.

---

## **INV-C6.11-022**

Los thresholds de pattern no deben hardcodearse como verdades universales.

---

## **INV-C6.11-023**

Las definiciones deben ser versionables.

---

## **INV-C6.11-024**

Historical replay debe utilizar definición histórica.

---

## **INV-C6.11-025**

Suppression debe ser auditable.

---

## **INV-C6.11-026**

Novel patterns deben distinguirse de canonical patterns.

---

## **INV-C6.11-027**

Un pattern amplio no debe duplicar innecesariamente uno específico confirmado.

---

## **INV-C6.11-028**

No ocultar divergencia entre señales para forzar pattern match.

---

## **INV-C6.11-029**

No pattern without evidence lineage.

---

## **INV-C6.11-030**

C6.11 no debe ejecutar acciones.

---

# **205\. VALIDACIONES MÍNIMAS**

Antes de confirmar un pattern:

pattern definition exists?

pattern version valid?

required signals present?

critical signals present?

signal semantics compatible?

signal windows aligned?

data quality sufficient?

signal confidence sufficient?

contradictory signals evaluated?

exclusion conditions checked?

minimum duration satisfied?

occurrence rule satisfied?

materiality gate satisfied?

severity policy valid?

tenant scope valid?

---

# **206\. VALIDATION — MISSING REQUIRED SIGNAL**

Si falta:

required signal

el pattern no debe confirmarse.

---

# **207\. VALIDATION — CRITICAL SIGNAL LOW CONFIDENCE**

Debe limitar confirmation/confidence.

---

# **208\. VALIDATION — TEMPORAL MISALIGNMENT**

No combinar señales de períodos irrelevantes entre sí.

---

# **209\. VALIDATION — MEASUREMENT BREAK**

Si existe tracking failure, business pattern confirmation puede bloquearse.

---

# **210\. VALIDATION — DUPLICATE EVIDENCE**

No contar dos transformaciones de la misma métrica como señales independientes sin disclosure.

---

# **211\. VALIDATION — SIMPSON'S PARADOX**

Debe verificar pesos y direcciones reales.

No declararlo solo porque aggregate y segmento difieren.

---

# **212\. VALIDATION — RED FLAG**

Un pattern no debe convertirse en red flag si no cumple la policy de materialidad/severidad correspondiente.

---

# **213\. VALIDATION — NOVEL PATTERN**

Debe permanecer:

candidate

hasta proceso de validación adecuado.

---

# **214\. TESTS MÍNIMOS**

## **TEST 1 — Revenue Up / Contribution Down**

Debe detectar profitability/growth-quality pattern.

---

## **TEST 2 — Revenue Up / Contribution Up**

No debe detectar profitability erosion.

---

## **TEST 3 — ROAS Up / MER Down**

Debe detectar attribution inconsistency candidate.

---

## **TEST 4 — ROAS Up / MER Up**

No debe detectar ese red flag.

---

## **TEST 5 — Spend Up / Marginal CAC Up**

Debe detectar scaling deterioration candidate.

---

## **TEST 6 — Average CAC Stable / Marginal CAC Critical**

Debe detectar marginal scaling risk.

---

## **TEST 7 — Inventory Up / Hero Stockout**

Debe detectar inventory imbalance.

---

## **TEST 8 — Orders Up / Fulfillment Delay Up**

Debe detectar operational load candidate.

---

## **TEST 9 — Orders Up / Fulfillment Stable**

No debe confirmar overload.

---

## **TEST 10 — Blended CVR Stable / New CVR Down**

Debe detectar masking pattern si mix lo explica.

---

## **TEST 11 — Simpson's Paradox**

Debe detectarse matemáticamente.

---

## **TEST 12 — Segment Divergence**

Debe localizar el scope correcto.

---

## **TEST 13 — Tracking Failure**

Debe impedir business red flag fuerte cuando las señales dependen de tracking roto.

---

## **TEST 14 — Contradictory Evidence**

Debe reducir pattern confidence.

---

## **TEST 15 — Missing Optional Signal**

Puede seguir confirmándose si policy lo permite.

---

## **TEST 16 — Missing Required Signal**

No debe confirmarse.

---

## **TEST 17 — Temporal Misalignment**

No debe formar pattern.

---

## **TEST 18 — Persistent Pattern**

Debe aumentar soporte respecto a evento aislado.

---

## **TEST 19 — Pattern Recovery**

Debe pasar a resolved.

---

## **TEST 20 — Suppression**

Debe conservar detection \+ suppression reason.

---

## **TEST 21 — Novel Pattern**

Debe etiquetarse correctamente.

---

## **TEST 22 — Parent/Child Pattern**

Debe evitar duplicación innecesaria.

---

## **TEST 23 — Attributed vs Incremental**

No deben mezclarse silenciosamente.

---

## **TEST 24 — Observed vs Predicted**

Debe conservar naturaleza.

---

## **TEST 25 — Low Confidence Critical Red Flag**

Debe mantener:

severity \= critical

confidence \= low

---

## **TEST 26 — High Confidence Low Severity Pattern**

También debe soportarse.

---

## **TEST 27 — Cross-Tenant Isolation**

Pattern definitions/config privadas no deben cruzarse.

---

## **TEST 28 — Historical Replay**

Debe reproducir definición y policy histórica.

---

# **215\. ANTI-PATRÓN — ONE BAD METRIC \= PATTERN**

Incorrecto:

CAC ↑  
\=  
acquisition collapse

---

# **216\. ANTI-PATRÓN — PATTERN \= CAUSE**

Incorrecto:

ROAS ↓ \+ CVR ↓  
\=  
creative fatigue confirmed

---

# **217\. ANTI-PATRÓN — PATTERN \= ACTION**

Incorrecto:

unsafe scaling  
→  
reduce budget 30%

en Fase 6\.

---

# **218\. ANTI-PATRÓN — IGNORE CONTRADICTIONS**

No eliminar señales porque contradicen el pattern esperado.

---

# **219\. ANTI-PATRÓN — COUNT CORRELATED METRICS MULTIPLE TIMES**

Incorrecto inflar confidence con métricas derivadas del mismo dato.

---

# **220\. ANTI-PATRÓN — MIX BLENDED AND SEGMENTED**

No comparar indistintamente.

---

# **221\. ANTI-PATRÓN — UNIVERSAL NUMERIC PATTERN**

Incorrecto:

CAC \+20%  
and CVR \-10%  
\=  
critical

para todos los ecommerce.

---

# **222\. ANTI-PATRÓN — NO TIME ALIGNMENT**

No combinar señales separadas por meses sin justificación.

---

# **223\. ANTI-PATRÓN — RED FLAG \= PRIORITY**

Incorrecto.

---

# **224\. ANTI-PATRÓN — CONFIDENCE \= SEVERITY**

Incorrecto.

---

# **225\. ANTI-PATRÓN — PATTERN SCORE WITHOUT EXPLANATION**

Incorrecto:

pattern score \= 92

sin saber qué señales lo forman.

---

# **226\. ANTI-PATRÓN — LLM INVENTED CANONICAL PATTERN**

Un pattern no catalogado debe quedar como:

novel candidate

---

# **227\. ANTI-PATRÓN — DUPLICATE ALERT STORM**

Evitar:

acquisition problem

paid media problem

CAC problem

scale problem

si todos son la misma configuración subyacente.

---

# **228\. ACCEPTANCE CRITERIA**

Para cualquier pattern/red flag material debemos poder responder:

1\. ¿Qué pattern\_id se detectó?

2\. ¿Qué versión de pattern?

3\. ¿Es pattern canónico o novel candidate?

4\. ¿A qué familia pertenece?

5\. ¿Es red flag?

6\. ¿Qué scope afecta?

7\. ¿Qué señales eran obligatorias?

8\. ¿Qué señales obligatorias aparecieron?

9\. ¿Qué señales opcionales aparecieron?

10\. ¿Qué señales contradicen el pattern?

11\. ¿Qué señales faltan?

12\. ¿Qué confidence tiene cada señal?

13\. ¿Son realmente independientes?

14\. ¿Qué período comparten?

15\. ¿Cuándo comenzó?

16\. ¿Cuánto lleva activo?

17\. ¿Es aislado o persistente?

18\. ¿Qué condiciones lógicas se cumplieron?

19\. ¿Qué exclusiones se comprobaron?

20\. ¿Qué pattern strength existe?

21\. ¿Qué materiality existe?

22\. ¿Qué severity existe?

23\. ¿Qué pattern confidence existe?

24\. ¿Qué critical signals sostienen el pattern?

25\. ¿Existe data/measurement issue?

26\. ¿Existen alternative patterns plausibles?

27\. ¿Qué limitations existen?

28\. ¿Está candidate, supported, confirmed o resolved?

29\. ¿Está suprimido?

30\. ¿Por qué?

31\. ¿Qué pattern padre/hijo está relacionado?

32\. ¿Puede reconstruirse completamente por qué se detectó?

---

# **229\. DEFINITION OF DONE**

C6.11 estará formalmente definido cuando exista:

Pattern Definition

Pattern Detection

Pattern Identity

Pattern Versioning

Pattern Catalog

Pattern Families

Pattern Types

Red Flag Classification

Signal Model

Required Signals

Optional Signals

Supporting Signals

Contradictory Signals

Missing Signals

Critical Signals

Exclusion Conditions

Boolean Rule Model

Temporal Alignment

Pattern Window

Sequence Support

Persistence

Occurrence Rules

Pattern Status

Pattern Direction

Pattern Strength

Pattern Materiality

Pattern Severity

Pattern Confidence

Scope / Breadth

Evidence Independence

Alternative Patterns

Pattern Hierarchy

Pattern Relationships

Pattern Signature

Deduplication

Lifecycle

Recovery

Suppression

Novel Pattern Candidates

Reason Codes

Structured Explanation

Validation Rules

Test Fixtures

---

# **230\. RESULTADO ARQUITECTÓNICO**

Sin C6.11:

Revenue:  
\+20%

Discount rate:  
\+25%

Contribution:  
\-18%

Refund rate:  
\+13%

Cuatro métricas independientes.

Con C6.11:

PATTERN

Growth Quality Deterioration

SUPPORTING SIGNALS

Revenue:  
\+20%

Discount intensity:  
\+25%

Contribution/order:  
\-18%

Refund rate:  
\+13%

TEMPORAL ALIGNMENT

All signals:  
same 6-week period

DATA QUALITY

High

CONTRADICTORY SIGNALS

None material

PATTERN STRENGTH

Strong

MATERIALITY

High

RED FLAG

Yes

SEVERITY

High

CONFIDENCE

High

INTERPRETATION

Revenue is growing while unit contribution  
and post-purchase quality are deteriorating.

The evidence is consistent with  
lower-quality growth.

Todavía NO sabemos necesariamente:

why it is happening

whether discounting is the root cause

whether this should be P0

which strategy should be applied

what exact action should be executed

Eso pertenece a fases posteriores.

---

# **231\. SEGUNDO EJEMPLO ARQUITECTÓNICO**

Signals:

Meta ROAS:  
\+32%

Meta attributed revenue:  
\+39%

MER:  
\-12%

New Customer Share:  
\-14%

Marginal CAC:  
\+27%

C6.11 puede producir:

PATTERN

Paid Media Attribution / Incrementality Risk

TYPE

Red Flag

INTERPRETATION

Platform-attributed performance is improving,  
while blended and marginal business economics  
are deteriorating.

CONFIDENCE

Medium / High

IMPORTANT

This does not prove platform reporting is wrong.

It indicates that platform-attributed performance  
should not be treated as sufficient evidence of  
incremental business improvement.

Esta distinción es esencial para un consultor IA serio.

---

# **232\. TERCER EJEMPLO ARQUITECTÓNICO**

Signals:

Spend:  
\+40%

Marginal CAC:  
critical breach

Cash buffer:  
risk

Hero stock coverage:  
warning

Fulfillment utilization:  
94%

C6.11:

PATTERN

Unsafe Scaling Conditions

RED FLAG

Yes

SEVERITY

Critical

CONFIDENCE

High

INTERPRETATION

Growth is being pushed while acquisition economics,  
cash, inventory and operational headroom are  
simultaneously constrained.

Pero C6.11 sigue sin decir:

Pause campaigns now.

Eso sería una recomendación/ejecución de otras fases.

---

# **233\. PRINCIPIO FINAL DE C6.11**

C6.11 debe imponer:

One metric  
rarely tells the whole story.

Y:

PATTERN  
\=  
structured combination  
of evidence.

No:

PATTERN  
\=  
LLM intuition.

Además:

PATTERN  
≠  
ROOT CAUSE

PATTERN  
≠  
PRIORITY

PATTERN  
≠  
RECOMMENDATION

PATTERN  
≠  
EXECUTION

Y especialmente:

A strong pattern  
can coexist with  
uncertain causality.

---

# **234\. SALIDA FORMAL DE C6.11**

C6.11 produce conceptualmente:

PATTERN\_DEFINITION

PATTERN\_DETECTION

RED\_FLAG\_DETECTION

y, cuando corresponda:

NOVEL\_PATTERN\_CANDIDATE

Estas salidas serán consumidas por:

C6.12 — Evidence, Provenance & Lineage

C6.13 — Evaluation Finding

C6.14 — Inter-Phase Handoff

C6.15 — Observability & Audit

y posteriormente por:

Fase 3 — Diagnóstico

Fase 4 — Priorización

Fase 7 — Motor de Recomendaciones

Fase 9 — Aprendizaje Continuo

C6.11 no produce:

ROOT CAUSE

BUSINESS PRIORITY

STRATEGY

PLAYBOOK

RECOMMENDED ACTION

EXECUTION

---

# **C6.11 — ESTADO**

CONTRACT:  
C6.11 Pattern & Red Flag Detection

TYPE:  
Multivariate Signal / Risk Pattern Detection

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
C6.10 Anomaly Detection

NEXT CONTRACT:  
C6.12 — Evidence, Provenance & Lineage Contract

