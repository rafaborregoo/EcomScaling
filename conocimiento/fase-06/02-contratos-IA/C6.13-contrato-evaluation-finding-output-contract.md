# **C6.13 — EVALUATION FINDING OUTPUT CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Evaluation Finding Output Contract define el objeto canónico mediante el cual la Fase 6 comunica al resto de EcomScaling IA una conclusión evaluativa material.

Su misión es responder:

> **¿Qué ha encontrado exactamente Fase 6, con qué gravedad, con qué confianza, apoyado en qué evidencia y con qué limitaciones?**

C6.13 no crea una nueva capa de razonamiento independiente.

Su función es:

NORMALIZE

PACKAGE

BOUND

EXPOSE

los resultados producidos por:

C6.9  Benchmark Evaluation

C6.10 Anomaly Detection

C6.11 Pattern & Red Flag Detection

C6.12 Evidence, Provenance & Lineage

en una salida estable y consumible por otras fases.

---

# **2\. PROBLEMA QUE RESUELVE**

Sin C6.13, cada subsistema podría producir objetos diferentes:

CAC evaluator:  
status \= risk

Anomaly engine:  
structural deterioration

Pattern engine:  
unsafe scaling

Confidence engine:  
medium

Lineage:  
evidence graph X

y cada fase posterior tendría que reconstruir qué significa todo eso.

Eso generaría:

duplicated interpretation

inconsistent mappings

phase coupling

loss of evidence

status confusion

severity confusion

confidence confusion

fragile integrations

C6.13 crea una unidad común:

EVALUATION\_FINDING

---

# **3\. PRINCIPIO FUNDAMENTAL**

Un Finding no debe ser simplemente:

"Performance is bad."

Debe ser un objeto estructurado que preserve:

WHAT happened

WHERE

WHEN

STATUS

SEVERITY

MATERIALITY

CONFIDENCE

EVIDENCE

REFERENCES

GUARDRAILS

ANOMALIES

PATTERNS

LIMITATIONS

UNCERTAINTY

HYPOTHESES

---

# **4\. SEGUNDO PRINCIPIO**

Debe mantenerse estrictamente:

STATUS  
≠  
SEVERITY  
≠  
MATERIALITY  
≠  
CONFIDENCE  
≠  
IMPACT  
≠  
PRIORITY

C6.13 puede transportar varias de estas dimensiones.

Pero no debe fusionarlas.

---

# **5\. TERCER PRINCIPIO**

El Finding debe ser una conclusión de Fase 6\.

No una recomendación.

Por tanto:

FINDING  
≠  
RECOMMENDATION

Ejemplo válido:

Marginal CAC exceeds the sustainable scale guardrail.

Ejemplo inválido en C6.13:

Reduce Meta budget by 20%.

---

# **6\. CUARTO PRINCIPIO**

El Finding tampoco debe convertirse en diagnóstico definitivo.

FINDING  
≠  
ROOT CAUSE

Ejemplo válido:

New-customer mobile CVR shows persistent deterioration.

No:

Checkout friction is the root cause.

salvo que una causa haya sido entregada explícitamente por Fase 3 como input autorizado.

---

# **7\. QUINTO PRINCIPIO**

C6.13 debe preservar:

FACT

INTERPRETATION

HYPOTHESIS

como capas diferentes.

Nunca mezclarlas en una única frase autoritativa.

---

# **8\. RESPONSABILIDAD**

C6.13 debe definir:

WHAT finding exists?

WHAT type of finding?

WHAT subject does it concern?

WHAT scope is affected?

WHAT status exists?

WHAT severity exists?

WHAT materiality exists?

WHAT confidence exists?

WHAT evidence supports it?

WHAT evidence contradicts it?

WHAT limitations exist?

WHAT guardrails are involved?

WHAT anomalies are involved?

WHAT patterns are involved?

WHAT hypotheses remain?

WHAT phases may consume it?

---

# **9\. LO QUE C6.13 NO DEBE HACER**

C6.13 NO debe decidir:

final root cause

priority order

resource allocation

strategy

playbook

recommended intervention

execution action

---

# **10\. FINDING OBJECT**

La salida principal será:

EVALUATION\_FINDING

---

# **11\. FINDING\_ID**

Todo Finding material debe disponer de:

finding\_id

único.

---

# **12\. RUN RELATION**

Debe estar vinculado a:

run\_id

trace\_id

de C6.0.

---

# **13\. FINDING VERSION**

La estructura contractual debe estar versionada.

Puede existir:

finding\_contract\_version

registrada en C6.0.

---

# **14\. FINDING INSTANCE IMMUTABILITY**

Una vez materializado un Finding histórico no debe sobrescribirse silenciosamente.

Nueva evidencia:

→ new finding

or

→ reassessment / superseding finding

---

# **15\. FINDING TYPE**

Taxonomía inicial:

metric\_evaluation

guardrail\_breach

anomaly

pattern

red\_flag

data\_quality

measurement\_risk

contextual\_warning

composite\_finding

---

# **16\. METRIC EVALUATION FINDING**

Ejemplo:

New-customer CAC is materially above  
comparable internal history.

---

# **17\. GUARDRAIL BREACH FINDING**

Ejemplo:

Current CAC exceeds the sustainable  
acquisition guardrail.

---

# **18\. ANOMALY FINDING**

Ejemplo:

Mobile new-customer CVR shows  
a persistent structural deterioration.

---

# **19\. PATTERN FINDING**

Ejemplo:

Revenue growth is occurring alongside  
deteriorating contribution and refunds.

---

# **20\. RED FLAG FINDING**

Ejemplo:

Current scaling conditions combine  
critical marginal acquisition economics,  
cash pressure and low inventory headroom.

---

# **21\. DATA QUALITY FINDING**

Ejemplo:

Current conversion analysis is unreliable  
because session tracking is incomplete.

---

# **22\. MEASUREMENT RISK FINDING**

Ejemplo:

Platform-reported conversions diverge  
materially from transactional sources  
after a tracking implementation change.

---

# **23\. COMPOSITE FINDING**

Puede agrupar varios resultados estrechamente relacionados.

Ejemplo:

Acquisition economics are deteriorating  
across historical, marginal and cash perspectives.

Debe utilizarse con cuidado para no ocultar subfindings.

---

# **24\. FINDING FAMILY**

Puede existir:

finding\_family

Ejemplos:

acquisition

paid\_media

conversion

offer

retention

unit\_economics

cash

inventory

operations

scalability

measurement

---

# **25\. SUBJECT**

Todo Finding debe tener un sujeto claro.

Puede ser:

metric

metric family

segment

cohort

channel

product

market

business

pattern

guardrail

---

# **26\. SUBJECT\_REF**

Debe existir:

subject\_type

subject\_ref

---

# **27\. PRIMARY METRIC**

Cuando corresponda:

primary\_metric\_id

---

# **28\. RELATED METRICS**

Puede existir:

related\_metric\_ids

para findings multivariables.

---

# **29\. SCOPE**

Todo Finding debe saber dónde ocurre.

Puede incluir:

business

market

channel

device

customer type

product

category

segment

cohort

---

# **30\. BUSINESS-WIDE**

Puede existir:

scope\_level \= business

---

# **31\. LOCALIZED**

Ejemplo:

Spain  
\+  
Mobile  
\+  
New Customers

---

# **32\. TEMPORAL SCOPE**

Debe conservar:

period\_start

period\_end

as\_of\_at

---

# **33\. ONSET**

Para anomalies/patterns:

onset\_at

cuando exista.

---

# **34\. DURATION**

También puede incluir:

duration

---

# **35\. FINDING STATUS**

Debe diferenciarse del status de negocio.

Puede existir lifecycle:

open

monitoring

resolved

dismissed

superseded

---

# **36\. OPEN**

El Finding sigue siendo válido y activo.

---

# **37\. MONITORING**

Sigue activo pero requiere observación.

---

# **38\. RESOLVED**

La condición dejó de existir.

---

# **39\. DISMISSED**

La evidencia posterior demuestra que no debía mantenerse.

---

# **40\. SUPERSEDED**

Un Finding posterior lo sustituye.

---

# **41\. BUSINESS STATUS**

Separadamente:

business\_status

puede ser:

healthy

watch

warning

risk

critical

indeterminate

not\_applicable

proveniente principalmente de C6.9.

---

# **42\. LIFECYCLE STATUS ≠ BUSINESS STATUS**

Ejemplo:

finding\_lifecycle:  
open

business\_status:  
critical

---

# **43\. SEVERITY**

Debe existir:

severity

---

# **44\. SEVERITY SCALE**

Propuesta inicial:

informational

low

medium

high

critical

---

# **45\. SEVERITY BASIS**

Debe poder explicarse mediante:

guardrail breach

magnitude

persistence

business exposure

systemic breadth

pattern severity

---

# **46\. SEVERITY ≠ PRIORITY**

C6.13 nunca debe mapear automáticamente:

critical  
→  
P0

---

# **47\. MATERIALITY**

Debe existir:

materiality

---

# **48\. MATERIALITY SCALE**

none

low

medium

high

critical

---

# **49\. MATERIALITY BASIS**

Puede incluir:

revenue affected

orders affected

customers affected

margin effect

cash effect

inventory exposure

duration

---

# **50\. MATERIALITY ≠ SEVERITY**

Ejemplo:

Una medición puede ser:

highly anomalous

pero de:

low economic materiality

---

# **51\. IMPACT**

Puede existir:

estimated\_impact

si C6.9 dispone de una estimación directa suficientemente soportada.

---

# **52\. IMPACT TYPES**

Ejemplos:

revenue

margin

cash

customers

inventory

operations

---

# **53\. ESTIMATED IMPACT ≠ REALIZED IMPACT**

Debe diferenciarse:

observed

estimated

modeled

---

# **54\. CONFIDENCE**

Todo Finding material debe incluir:

confidence

referenciando C6.8.

---

# **55\. CONFIDENCE COMPONENTS**

Puede exponer resumen de:

data\_confidence

comparison\_confidence

pattern\_confidence

finding\_confidence

cuando sean relevantes.

---

# **56\. CONFIDENCE ≠ SEVERITY**

Ejemplo válido:

severity:  
critical

confidence:  
low

---

# **57\. CLAIM STRENGTH**

Debe poder incluir:

claim\_strength

Ejemplos:

established

strongly\_supported

supported

tentative

unsupported

---

# **58\. CLAIM STRENGTH CONTROLS LANGUAGE**

Finding high confidence:

The data shows...

Finding medium:

The evidence suggests...

Finding low:

There are indications...

---

# **59\. CORE STATEMENT**

Todo Finding debe tener una declaración estructurada principal:

finding\_statement

---

# **60\. FINDING STATEMENT REQUIREMENT**

Debe describir:

WHAT condition exists

No:

WHAT to do about it

---

# **61\. GOOD FINDING STATEMENT**

Marginal CAC exceeds the configured  
sustainable scaling guardrail.

---

# **62\. BAD FINDING STATEMENT**

Reduce spend immediately.

---

# **63\. FACTS**

Debe existir:

facts

para hechos observados.

---

# **64\. FACT EXAMPLE**

Marginal CAC increased from €41 to €57.

---

# **65\. INTERPRETATIONS**

Puede existir:

interpretations

---

# **66\. INTERPRETATION EXAMPLE**

Marginal acquisition efficiency has deteriorated.

---

# **67\. HYPOTHESES**

Puede existir:

hypotheses

---

# **68\. HYPOTHESIS EXAMPLE**

Audience saturation may be contributing.

---

# **69\. HYPOTHESIS MUST REMAIN LABELED**

Nunca:

root\_cause:  
audience\_saturation

si solo existe hipótesis.

---

# **70\. HYPOTHESIS CONFIDENCE**

Cada hipótesis puede incluir:

hypothesis\_confidence

---

# **71\. ALTERNATIVE HYPOTHESES**

Debe poder existir:

alternative\_hypotheses

---

# **72\. EVIDENCE PACKAGE**

Todo Finding material debe referenciar:

evidence\_package\_id

de C6.12.

---

# **73\. SUPPORTING EVIDENCE**

Puede exponer:

supporting\_evidence\_refs

---

# **74\. CONTRADICTORY EVIDENCE**

Debe poder exponer:

contradictory\_evidence\_refs

---

# **75\. LIMITING EVIDENCE**

También:

limiting\_evidence\_refs

---

# **76\. MISSING EVIDENCE**

Debe existir:

missing\_evidence

cuando sea material.

---

# **77\. EVIDENCE GAPS**

Puede incluir:

evidence\_gap\_ids

de C6.8.

---

# **78\. LINEAGE**

Todo Finding debe tener:

lineage\_root

o referencia equivalente a C6.12.

---

# **79\. TRACEABILITY REQUIREMENT**

Debe poder navegarse:

finding  
→  
evaluation  
→  
comparison  
→  
reference  
→  
observation  
→  
source

---

# **80\. EVALUATION REFERENCES**

Debe poder incluir:

evaluation\_ids

---

# **81\. ANOMALY REFERENCES**

Cuando corresponda:

anomaly\_ids

---

# **82\. PATTERN REFERENCES**

Cuando corresponda:

pattern\_detection\_ids

---

# **83\. GUARDRAIL REFERENCES**

Debe incluir:

guardrail\_evaluation\_ids

si participan.

---

# **84\. BENCHMARK REFERENCES**

Puede incluir:

benchmark\_reference\_ids

---

# **85\. POLICY REFERENCES**

Puede incluir:

effective\_policy\_snapshot\_id

---

# **86\. REFERENCE ROLES**

Debe conservar:

historical

peer

target

economic

supporting

sanity\_check

---

# **87\. GUARDRAIL BREACH SUMMARY**

Puede incluir:

guardrail\_breaches

con campos resumidos.

---

# **88\. BREACH SUMMARY**

Ejemplo:

guardrail:  
maximum\_sustainable\_cac

state:  
breached

distance:  
\+11.6%

confidence:  
high

---

# **89\. ANOMALY SUMMARY**

Ejemplo:

type:  
structural\_deterioration

duration:  
6 weeks

magnitude:  
\-27%

confidence:  
high

---

# **90\. PATTERN SUMMARY**

Ejemplo:

pattern:  
unsafe\_scaling

severity:  
high

confidence:  
high

---

# **91\. REFERENCE COMPARISON SUMMARY**

Puede incluir:

vs\_history

vs\_peers

vs\_target

vs\_economics

separadamente.

---

# **92\. MULTI-PERSPECTIVE OUTPUT**

Ejemplo:

historical\_status:  
materially\_worse

peer\_status:  
better

economic\_status:  
risk

cash\_status:  
critical

---

# **93\. NO COLLAPSING PERSPECTIVES**

Aunque exista:

overall\_status

no deben perderse perspectivas.

---

# **94\. OVERALL STATUS**

Puede incluirse:

overall\_status

desde C6.9.

---

# **95\. DOMINANT CONDITION**

Debe poder incluir:

dominant\_condition\_ref

---

# **96\. DOMINANT CONDITION EXAMPLE**

cash\_guardrail\_critical\_breach

---

# **97\. STATUS REASON**

Debe incluir:

status\_reason\_codes

---

# **98\. HUMAN SUMMARY**

Puede existir:

summary

legible por humano.

---

# **99\. SUMMARY REQUIREMENTS**

Debe:

reflect structured result

preserve uncertainty

avoid recommendation

avoid invented causality

---

# **100\. GOOD SUMMARY**

CAC remains competitive versus peers,  
but has deteriorated materially against  
comparable internal history and exceeds  
both profitability and cash guardrails.

---

# **101\. BAD SUMMARY**

Meta is saturated and should be cut immediately.

---

# **102\. LIMITATIONS**

Todo Finding puede incluir:

limitations

---

# **103\. LIMITATION EXAMPLE**

Marginal CAC is unavailable,  
so scalability cannot be fully assessed.

---

# **104\. UNCERTAINTY**

Puede incluir:

uncertainty\_profile\_ref

---

# **105\. VALIDATION NEEDED**

Puede existir:

validation\_required

booleano.

---

# **106\. VALIDATION REASON**

Ejemplo:

Critical inventory risk detected,  
but source data is 18 hours stale.

---

# **107\. URGENT VALIDATION ≠ BUSINESS PRIORITY**

Debe mantenerse:

urgent\_validation  
≠  
P0

---

# **108\. FOLLOW-UP EVIDENCE**

Puede existir:

evidence\_needed

Ejemplo:

marginal CAC

creative frequency

inventory confirmation

---

# **109\. EVIDENCE NEEDED ≠ RECOMMENDED BUSINESS ACTION**

Solicitar más evidencia sí está permitido.

Ejemplo:

Validate stock feed freshness.

Pero no:

Pause campaigns.

---

# **110\. FINDING READINESS**

Puede existir:

finding\_readiness

para indicar si puede pasar a fases posteriores.

Estados:

ready

ready\_with\_limitations

validation\_required

blocked

---

# **111\. READY**

La evidencia es suficiente para consumo downstream.

---

# **112\. READY WITH LIMITATIONS**

Puede utilizarse, pero deben preservar limitations.

---

# **113\. VALIDATION REQUIRED**

No debería convertirse directamente en una recomendación fuerte.

---

# **114\. BLOCKED**

No existe evidencia suficiente.

---

# **115\. DOWNSTREAM ELIGIBILITY**

Puede declarar:

eligible\_for\_phase3

eligible\_for\_phase4

eligible\_for\_phase7

como metadata de handoff.

La lógica completa pertenecerá a C6.14.

---

# **116\. IMPORTANT BOUNDARY**

Un Finding puede contener:

severity \= critical

y:

confidence \= high

pero C6.13 NO debe generar:

priority \= P0

---

# **117\. PRIORITY FIELD**

Idealmente Fase 6 no debe definir un `priority` de negocio.

Si existe metadata técnica de orden:

display\_order

processing\_order

debe llamarse de otra forma.

---

# **118\. NO BUSINESS PRIORITY**

Evitar completamente:

P0

P1

P2

en C6.13.

---

# **119\. IMPACT POTENTIAL**

Puede existir:

impact\_potential

si está suficientemente soportado.

---

# **120\. IMPACT POTENTIAL ≠ PRIORITY**

Fase 4 combinará:

impact

severity

confidence

urgency

effort

dependencies

según su propio contrato.

---

# **121\. URGENCY**

¿Puede C6.13 transportar urgency?

Sí, pero debe definirse con cuidado.

Puede existir:

validation\_urgency

o:

condition\_urgency

como señal.

No:

business\_priority

---

# **122\. CONDITION URGENCY**

Ejemplo:

critical cash guardrail breach

puede tener:

condition\_urgency \= immediate\_attention

sin decidir ranking contra otros problemas.

---

# **123\. SEVERITY REASON**

Toda severity debe tener:

severity\_reason

estructurada.

---

# **124\. CONFIDENCE REASON**

Toda confidence material debe poder enlazar a:

confidence\_assessment\_id

---

# **125\. FINDING REASON CODES**

Taxonomía inicial:

FND\_BENCHMARK\_DETERIORATION

FND\_GUARDRAIL\_WARNING

FND\_GUARDRAIL\_BREACH

FND\_CRITICAL\_GUARDRAIL

FND\_STRUCTURAL\_ANOMALY

FND\_POSITIVE\_ANOMALY

FND\_RED\_FLAG

FND\_PATTERN\_DETECTED

FND\_DATA\_QUALITY\_LIMITATION

FND\_MEASUREMENT\_RISK

FND\_REFERENCE\_CONFLICT

FND\_INSUFFICIENT\_EVIDENCE

FND\_VALIDATION\_REQUIRED

---

# **126\. MACHINE-READABLE \+ HUMAN-READABLE**

Debe existir:

reason\_codes

y:

summary

No sustituir uno por otro.

---

# **127\. FINDING RELATIONSHIPS**

Puede existir:

related\_findings

parent\_finding

child\_findings

supersedes

superseded\_by

derived\_from

---

# **128\. PARENT FINDING**

Ejemplo:

Acquisition economics deterioration

puede agrupar:

CAC deterioration

marginal CAC breach

payback deterioration

---

# **129\. CHILD FINDINGS**

Deben seguir accesibles.

---

# **130\. NO INFORMATION LOSS**

Crear Finding compuesto no debe eliminar findings de detalle.

---

# **131\. DUPLICATE FINDINGS**

Debe evitarse alert storm.

Puede existir:

finding\_signature

---

# **132\. FINDING SIGNATURE**

Puede derivarse de:

finding\_type

subject

scope

dominant condition

time window

---

# **133\. CONTINUATION**

Si la condición continúa:

same finding

puede permanecer open/monitoring según lifecycle policy.

No necesariamente crear uno nuevo cada hora.

---

# **134\. MATERIAL CHANGE**

Si cambia significativamente:

severity

scope

pattern

guardrail

puede requerirse nueva instancia o revision event.

---

# **135\. FINDING EVENTS**

Puede existir:

FINDING\_EVENT

con:

created

severity\_changed

confidence\_changed

scope\_changed

resolved

reopened

superseded

---

# **136\. HISTORICAL AUDIT**

Todos estos cambios deben ser reconstruibles.

---

# **137\. POSITIVE FINDINGS**

C6.13 también debe soportar:

positive finding

Ejemplo:

Repeat purchase has improved structurally  
for four consecutive cohorts.

---

# **138\. FINDING POLARITY**

Puede existir:

positive

negative

mixed

neutral

---

# **139\. MIXED FINDING**

Ejemplo:

Peer position improved,  
but internal economics deteriorated.

---

# **140\. DATA QUALITY FINDINGS**

No deben tratarse como performance problems.

Ejemplo:

Finding type:  
data\_quality

business\_status:  
indeterminate

---

# **141\. MEASUREMENT FINDING**

También puede tener:

business\_status:  
indeterminate

pero:

severity:  
high

desde perspectiva de medición.

---

# **142\. SEVERITY DOMAIN**

Puede ser útil:

severity\_domain

Ejemplos:

business

measurement

data

operational

para evitar confusión.

---

# **143\. FINDING SOURCE**

Debe existir:

finding\_source

Ejemplos:

evaluation

anomaly

pattern

data\_quality

composite

---

# **144\. AUTOMATED VS HUMAN**

Puede existir:

origin\_type:  
automated

human\_validated

human\_created

hybrid

---

# **145\. HUMAN VALIDATION**

Puede añadirse:

human\_validation\_status

sin destruir output original.

---

# **146\. HUMAN OVERRIDE**

Si un consultor cambia clasificación:

original finding

override

reason

deben conservarse.

---

# **147\. NO SILENT OVERRIDE**

Nunca sustituir silenciosamente.

---

# **148\. FINDING CONTRACT SHAPE**

Conceptualmente:

evaluation\_finding:

    identity:  
        finding\_id  
        run\_id  
        trace\_id

    classification:  
        finding\_type  
        finding\_family  
        polarity  
        finding\_source

    subject:  
        subject\_type  
        subject\_ref  
        primary\_metric\_id  
        related\_metric\_ids

    scope:  
        business  
        market  
        channel  
        device  
        customer\_type  
        product  
        segment  
        cohort

    temporal:  
        period\_start  
        period\_end  
        as\_of\_at  
        onset\_at  
        duration

    assessment:  
        business\_status  
        severity  
        severity\_domain  
        materiality  
        estimated\_impact  
        condition\_urgency

    confidence:  
        confidence\_assessment\_id  
        finding\_confidence  
        claim\_strength

    statement:  
        finding\_statement  
        summary

    layers:  
        facts  
        interpretations  
        hypotheses  
        alternative\_hypotheses

    references:  
        evaluation\_ids  
        benchmark\_reference\_ids  
        guardrail\_evaluation\_ids  
        anomaly\_ids  
        pattern\_detection\_ids  
        effective\_policy\_snapshot\_id

    evidence:  
        evidence\_package\_id  
        supporting\_evidence\_refs  
        contradictory\_evidence\_refs  
        limiting\_evidence\_refs  
        missing\_evidence

    epistemics:  
        limitations  
        assumptions  
        uncertainty\_profile\_ref

    readiness:  
        finding\_readiness  
        validation\_required  
        evidence\_needed

    lineage:  
        lineage\_root

    lifecycle:  
        status  
        finding\_signature  
        parent\_finding  
        related\_findings  
        supersedes

---

# **149\. EXAMPLE — CAC FINDING**

FINDING

Acquisition Economics Risk

TYPE

guardrail\_breach

SUBJECT

New Customer CAC  
Spain

FACTS

CAC:  
€48

Comparable internal baseline:  
€35

Sustainable CAC:  
€43

Cash-safe CAC:  
€40

Assessment:

Historical:  
Materially worse

Peer:  
Better than median

Profitability:  
Risk

Cash:  
Critical

Finding:

Current new-customer CAC has deteriorated  
materially relative to comparable internal history  
and exceeds both profitability and cash guardrails.

Metadata:

business\_status:  
critical

severity:  
critical

materiality:  
high

confidence:  
high

priority:  
NOT SET

Hypotheses:

None required.

Limitations:

Marginal CAC unavailable.

Readiness:

ready\_with\_limitations

---

# **150\. EXAMPLE — ANOMALY FINDING**

FINDING

Persistent Mobile Conversion Deterioration

Facts:

New-customer mobile CVR:  
\-29% vs seasonally adjusted baseline

Duration:  
5 weeks

Anomaly:

structural\_deterioration

Confidence:

high

Finding statement:

New-customer mobile conversion shows a persistent  
structural deterioration not explained by the  
observed seasonal or mix effects.

Hypothesis:

Possible mobile funnel friction.

Hypothesis confidence:

low

Correct.

---

# **151\. EXAMPLE — RED FLAG FINDING**

Signals:

Marginal CAC:  
critical breach

Cash:  
risk

Hero stock:  
warning

Fulfillment:  
92% capacity

Pattern:

unsafe\_scaling

Finding:

Current growth conditions show simultaneous  
constraints in marginal acquisition economics,  
cash, inventory and fulfillment capacity.

Assessment:

severity:  
critical

confidence:  
high

materiality:  
high

No:

priority \= P0

No:

reduce budget

---

# **152\. EXAMPLE — MEASUREMENT RISK FINDING**

FINDING

Purchase Tracking Integrity Risk

Facts:

GA4 purchases:  
\-40%

Shopify orders:  
stable

tracking deployment:  
changed

Pattern:

measurement\_integrity\_risk

Assessment:

business\_status:  
indeterminate

severity\_domain:  
measurement

severity:  
high

confidence:  
high

Finding statement:

The observed conversion decline cannot currently  
be interpreted as a confirmed business deterioration  
because transactional sources do not corroborate it.

---

# **153\. EXAMPLE — LOW CONFIDENCE CRITICAL CONDITION**

Hero SKU reported inventory:  
0

inventory source age:  
22h

Finding:

A potentially critical stockout condition is present,  
but current inventory data is stale and requires validation.

Assessment:

business\_status:  
indeterminate

severity:  
critical

confidence:  
low

validation\_required:  
true

condition\_urgency:  
immediate\_attention

This is superior to:

Critical stockout confirmed.

---

# **154\. EXAMPLE — POSITIVE FINDING**

Repeat purchase rate:  
\+18%

4 consecutive cohorts

data quality:  
high

Finding:

Repeat purchase has improved structurally  
across four consecutive customer cohorts.

Assessment:

polarity:  
positive

business\_status:  
healthy

materiality:  
high

confidence:  
high

---

# **155\. EXAMPLE — MIXED FINDING**

Revenue:  
\+17%

Contribution:  
\-12%

Finding:

Revenue growth is continuing,  
but unit profitability has deteriorated.

Polarity:

mixed

Pattern:

growth\_quality\_deterioration

---

# **156\. FINDING GRANULARITY**

Debe evitarse producir:

hundreds of tiny findings

sin valor.

---

# **157\. FINDING CREATION POLICY**

Puede existir policy para decidir cuándo una evaluación merece convertirse en Finding.

Ejemplos:

minimum materiality

minimum confidence

guardrail breach

confirmed anomaly

red flag

---

# **158\. NOT EVERY METRIC EVALUATION BECOMES FINDING**

Ejemplo:

AOV 0.3% above normal

puede no merecer Finding.

---

# **159\. SIGNAL VS FINDING**

Una señal es input.

Un Finding es una conclusión materializada que merece circular por el sistema.

---

# **160\. FINDING ELIGIBILITY**

Puede existir:

finding\_eligibility\_status

---

# **161\. ELIGIBILITY STATES**

eligible

eligible\_with\_limitations

not\_material

insufficient\_evidence

suppressed

---

# **162\. SUPPRESSED FINDING**

Puede detectarse pero no enviarse downstream.

Debe seguir siendo auditable.

---

# **163\. SUPPRESSION REASON**

Ejemplos:

duplicate

parent finding exists

known business event

insufficient materiality

manual suppression

---

# **164\. NO SILENT SUPPRESSION**

Siempre registrar razón.

---

# **165\. FINDING DEDUPLICATION**

Debe soportarse.

Ejemplo:

CAC risk

detectado:

daily

durante 20 días.

No queremos necesariamente 20 findings independientes.

---

# **166\. FINDING UPDATE**

Podría actualizarse lifecycle mediante eventos.

Pero campos históricos críticos no deben reescribirse sin rastro.

---

# **167\. ESCALATION**

Un Finding puede pasar:

warning  
→  
risk  
→  
critical

---

# **168\. DE-ESCALATION**

También:

critical  
→  
risk  
→  
resolved

---

# **169\. CONFIDENCE CHANGE**

Puede pasar:

low  
→  
high

cuando llegan nuevos datos.

---

# **170\. FINDING EVENT HISTORY**

Debe preservarse.

---

# **171\. DOWNSTREAM CONTRACT BOUNDARY**

C6.13 debe ser consumible sin que fases posteriores tengan que conocer todos los detalles internos de C6.0–C6.12.

---

# **172\. HOWEVER**

No debe convertirse en un objeto gigante autocontenido.

Debe usar:

references

a artefactos internos.

---

# **173\. SUMMARY \+ REFERENCES**

Principio:

enough context to understand  
\+  
references to inspect deeply

---

# **174\. INTER-PHASE STABILITY**

El Finding debe ser relativamente estable aunque internamente cambien implementaciones de:

benchmark engine

anomaly engine

pattern detector

---

# **175\. FINDING AS API BOUNDARY**

Conceptualmente:

Phase 6 internal complexity  
        ↓  
EVALUATION\_FINDING  
        ↓  
Other phases

---

# **176\. PHASE 3 CONSUMPTION**

Fase 3 puede consumir:

finding statement

facts

anomalies

patterns

hypotheses

evidence

para diagnóstico.

---

# **177\. PHASE 4 CONSUMPTION**

Fase 4 puede consumir:

severity

materiality

confidence

impact

urgency

scope

para priorización.

Pero Fase 4 calcula priority.

---

# **178\. PHASE 7 CONSUMPTION**

Fase 7 puede consumir:

status

diagnosis

constraints

guardrails

patterns

confidence

para recomendaciones.

---

# **179\. PHASE 8 CONSUMPTION**

Fase 8 puede posteriormente utilizar:

approved recommendation

guardrails

execution constraints

No directamente un Finding como orden de ejecución.

---

# **180\. PHASE 9 CONSUMPTION**

Fase 9 puede comparar:

finding

subsequent intervention

result

para aprender.

---

# **181\. INTER-PHASE HANDOFF**

La representación exacta se formalizará en C6.14.

---

# **182\. FINDING QUALITY**

Puede existir:

finding\_quality

derivada de:

lineage completeness

confidence

evidence sufficiency

pero no debe reemplazar esos campos.

---

# **183\. AUDITABILITY**

Todo Finding material debe ser auditable.

---

# **184\. WHY FINDING**

Admin debe poder preguntar:

> ¿Por qué existe este Finding?

Y obtener:

evaluations

anomalies

patterns

evidence

policies

versions

---

# **185\. WHY SEVERITY**

También:

> ¿Por qué severity critical?

---

# **186\. WHY CONFIDENCE**

Y:

> ¿Por qué confidence medium?

---

# **187\. WHY NOT PRIORITY**

Debe quedar claro:

Phase 6 does not assign business priority.

---

# **188\. FINDING OUTPUT SHAPE — FULL**

Conceptualmente:

evaluation\_finding:

    identity:  
        finding\_id  
        run\_id  
        trace\_id  
        finding\_contract\_version

    classification:  
        finding\_type  
        finding\_family  
        finding\_source  
        polarity

    subject:  
        subject\_type  
        subject\_ref  
        primary\_metric\_id  
        related\_metric\_ids

    scope:  
        business\_id  
        market  
        channel  
        device  
        customer\_type  
        segment  
        product  
        cohort

    temporal:  
        period\_start  
        period\_end  
        as\_of\_at  
        onset\_at  
        duration

    assessment:  
        business\_status  
        severity  
        severity\_domain  
        materiality  
        estimated\_impact  
        condition\_urgency

    confidence:  
        confidence\_assessment\_id  
        finding\_confidence  
        claim\_strength

    statement:  
        finding\_statement  
        summary

    knowledge\_layers:  
        facts  
        interpretations  
        hypotheses  
        alternative\_hypotheses

    evaluation\_refs:  
        evaluation\_ids  
        comparison\_ids  
        benchmark\_reference\_ids  
        guardrail\_evaluation\_ids

    signal\_refs:  
        anomaly\_ids  
        pattern\_detection\_ids

    policy:  
        effective\_policy\_snapshot\_id

    evidence:  
        evidence\_package\_id  
        supporting\_evidence\_refs  
        contradictory\_evidence\_refs  
        limiting\_evidence\_refs  
        missing\_evidence

    epistemics:  
        limitations  
        assumptions  
        uncertainty\_profile\_ref

    readiness:  
        finding\_readiness  
        validation\_required  
        evidence\_needed

    lineage:  
        lineage\_root  
        lineage\_completeness

    lifecycle:  
        status  
        finding\_signature  
        parent\_finding\_id  
        related\_finding\_ids  
        supersedes\_finding\_id

---

# **189\. MINIMAL DOWNSTREAM VIEW**

Para consumidores que no necesiten todo:

finding\_id

finding\_type

subject

scope

business\_status

severity

materiality

confidence

finding\_statement

limitations

evidence\_package\_id

---

# **190\. ADMIN VIEW**

Puede mostrar además:

benchmarks

guardrails

patterns

anomalies

policies

lineage

versions

---

# **191\. AI CONTEXT VIEW**

Cuando otra IA consuma el Finding debe recibir suficientes campos para no reinterpretar incorrectamente.

---

# **192\. MACHINE CONSUMPTION**

No depender únicamente de:

summary text

Las dimensiones estructuradas son autoridad.

---

# **193\. TEXT IS PRESENTATION**

La semántica principal reside en campos estructurados.

---

# **194\. INVARIANTES C6.13**

## **INV-C6.13-001**

Todo Finding material debe tener `finding_id`.

---

## **INV-C6.13-002**

Todo Finding debe estar ligado a `run_id`.

---

## **INV-C6.13-003**

Todo Finding debe tener sujeto y scope suficientes.

---

## **INV-C6.13-004**

Todo Finding debe distinguir lifecycle status y business status.

---

## **INV-C6.13-005**

Status, severity, materiality, confidence, impact y priority no deben fusionarse.

---

## **INV-C6.13-006**

Fase 6 no debe asignar business priority.

---

## **INV-C6.13-007**

Finding no debe contener recomendación operativa como conclusión propia.

---

## **INV-C6.13-008**

Finding no debe convertir hypothesis en fact.

---

## **INV-C6.13-009**

Todo material Finding debe referenciar evidence package.

---

## **INV-C6.13-010**

Todo Finding debe tener lineage suficiente.

---

## **INV-C6.13-011**

Critical severity puede coexistir con low confidence.

---

## **INV-C6.13-012**

Healthy status puede coexistir con target missed.

---

## **INV-C6.13-013**

Peer-good puede coexistir con economics-risk.

---

## **INV-C6.13-014**

Indeterminate debe estar soportado.

---

## **INV-C6.13-015**

Positive Findings deben estar soportados.

---

## **INV-C6.13-016**

Mixed Findings deben estar soportados.

---

## **INV-C6.13-017**

Contradictory evidence no debe ocultarse.

---

## **INV-C6.13-018**

Missing evidence relevante debe exponerse.

---

## **INV-C6.13-019**

Un Finding compuesto no debe borrar subfindings.

---

## **INV-C6.13-020**

Suppressed Findings deben seguir siendo auditables.

---

## **INV-C6.13-021**

Human override no debe borrar output original.

---

## **INV-C6.13-022**

Historical Finding no debe reescribirse con versiones actuales.

---

## **INV-C6.13-023**

Un Finding superseded debe seguir recuperable.

---

## **INV-C6.13-024**

Summary natural-language no es fuente de verdad principal.

---

## **INV-C6.13-025**

Un Finding bloqueado no debe pasar como conclusión fuerte downstream.

---

## **INV-C6.13-026**

Validation required debe conservarse.

---

## **INV-C6.13-027**

Evidence needed no equivale a recommendation.

---

## **INV-C6.13-028**

Pattern Finding debe referenciar pattern definition/detection.

---

## **INV-C6.13-029**

Guardrail Finding debe referenciar guardrail evaluation.

---

## **INV-C6.13-030**

Anomaly Finding debe referenciar anomaly detection.

---

# **195\. VALIDACIONES MÍNIMAS**

Antes de emitir un Finding:

finding\_id valid?

run exists?

subject exists?

scope coherent?

finding type valid?

business status valid?

severity valid?

materiality valid?

confidence valid?

claim strength valid?

evidence package exists?

lineage exists?

supporting evidence sufficient?

contradictory evidence represented?

limitations represented?

hypotheses properly labeled?

no forbidden priority?

no forbidden recommendation?

tenant isolation valid?

---

# **196\. VALIDATION — PRIORITY**

Debe fallar si C6.13 intenta producir:

priority \= P0

como decisión de Fase 6\.

---

# **197\. VALIDATION — RECOMMENDATION**

Debe fallar si:

recommended\_action

se utiliza como salida autoritativa de C6.13.

---

# **198\. VALIDATION — ROOT CAUSE**

No permitir:

root\_cause

salvo referencia explícita a output autorizado de Fase 3 en escenarios inter-fase futuros.

---

# **199\. VALIDATION — HYPOTHESIS**

Debe impedir que:

hypothesis\_confidence \= low

se presente como:

fact

---

# **200\. VALIDATION — EVIDENCE**

Finding sin evidence package debe quedar:

blocked

o inválido según materialidad.

---

# **201\. VALIDATION — LINEAGE**

Broken critical lineage debe impedir:

finding\_readiness \= ready

---

# **202\. VALIDATION — CONFIDENCE**

No permitir:

claim\_strength \= established

cuando:

confidence \= low

---

# **203\. VALIDATION — STATUS**

Un business status debe tener basis en C6.9 u otra fuente autorizada.

---

# **204\. VALIDATION — SEVERITY**

Severity debe tener razón estructurada.

---

# **205\. VALIDATION — SCOPE**

No producir Finding business-wide basándose en una anomalía localizada sin regla explícita.

---

# **206\. VALIDATION — COMPOSITE**

Un composite Finding debe referenciar subfindings/evaluations.

---

# **207\. RELACIÓN CON C6.0**

C6.0 proporciona:

run

trace

tenant

business

versions

---

# **208\. RELACIÓN CON C6.1**

C6.1 proporciona los sujetos métricos.

---

# **209\. RELACIÓN CON C6.2**

C6.2 proporciona scope/context.

---

# **210\. RELACIÓN CON C6.3**

C6.3 puede originar Findings de calidad y limitations.

---

# **211\. RELACIÓN CON C6.4**

C6.4 aporta benchmark refs.

---

# **212\. RELACIÓN CON C6.5**

C6.5 aporta guardrail refs.

---

# **213\. RELACIÓN CON C6.6**

C6.6 aporta effective policy.

---

# **214\. RELACIÓN CON C6.7**

C6.7 aporta resolution input.

---

# **215\. RELACIÓN CON C6.8**

C6.8 aporta:

confidence

uncertainty

claim strength

hypotheses

---

# **216\. RELACIÓN CON C6.9**

C6.9 es una de las principales fuentes de:

business status

materiality

guardrail states

---

# **217\. RELACIÓN CON C6.10**

C6.10 aporta anomalies.

---

# **218\. RELACIÓN CON C6.11**

C6.11 aporta patterns/red flags.

---

# **219\. RELACIÓN CON C6.12**

C6.12 aporta:

evidence package

lineage root

---

# **220\. RELACIÓN CON C6.14**

C6.14 definirá qué subset del Finding puede enviarse a:

Fase 3

Fase 4

Fase 7

---

# **221\. RELACIÓN CON C6.15**

C6.15 deberá observar:

finding creation

status changes

severity changes

confidence changes

suppression

resolution

---

# **222\. RELACIÓN CON C6.16**

C6.16 debe verificar invariantes de Findings.

---

# **223\. RELACIÓN CON FASE 3**

Fase 3 puede recibir:

facts

patterns

anomalies

hypotheses

evidence

para diagnóstico.

---

# **224\. RELACIÓN CON FASE 4**

Fase 4 puede recibir:

severity

materiality

confidence

impact

urgency

y calcular prioridad.

---

# **225\. RELACIÓN CON FASE 7**

Fase 7 puede recibir Finding \+ diagnóstico y generar una recomendación exacta.

---

# **226\. TESTS MÍNIMOS**

## **TEST 1 — Metric Finding**

Debe normalizar una evaluación simple.

---

## **TEST 2 — Guardrail Finding**

Debe incluir breach \+ severity \+ confidence.

---

## **TEST 3 — Anomaly Finding**

Debe incluir anomaly ref.

---

## **TEST 4 — Pattern Finding**

Debe incluir pattern ref.

---

## **TEST 5 — Red Flag Finding**

Debe conservar severity y confidence.

---

## **TEST 6 — Data Quality Finding**

Debe permitir `business_status = indeterminate`.

---

## **TEST 7 — Positive Finding**

Debe soportarse.

---

## **TEST 8 — Mixed Finding**

Debe soportarse.

---

## **TEST 9 — Critical Low Confidence**

Debe conservar ambos.

---

## **TEST 10 — Target Missed / Guardrail Safe**

No debe producir riesgo automáticamente.

---

## **TEST 11 — Peer Healthy / Economics Risk**

Debe preservar ambas perspectivas.

---

## **TEST 12 — Hypothesis**

Debe permanecer etiquetada.

---

## **TEST 13 — No Priority**

Debe fallar si se intenta incluir P0/P1/P2.

---

## **TEST 14 — No Recommendation**

Debe fallar salida prescriptiva autoritativa.

---

## **TEST 15 — Missing Evidence Package**

Debe bloquear Finding material.

---

## **TEST 16 — Broken Lineage**

Debe impedir ready.

---

## **TEST 17 — Suppressed Finding**

Debe seguir auditable.

---

## **TEST 18 — Duplicate Finding**

Debe deduplicarse según signature/policy.

---

## **TEST 19 — Severity Escalation**

Debe registrar evento histórico.

---

## **TEST 20 — Confidence Change**

Debe registrar evolución.

---

## **TEST 21 — Finding Resolution**

Debe preservar historia.

---

## **TEST 22 — Superseded Finding**

Original sigue accesible.

---

## **TEST 23 — Human Override**

Debe preservar original.

---

## **TEST 24 — Composite Finding**

Debe conservar subfindings.

---

## **TEST 25 — Cross-Tenant**

Debe bloquear refs de otro tenant.

---

# **227\. ANTI-PATRÓN — FINDING \= TEXT**

Incorrecto:

"Your CAC is bad."

como único output.

---

# **228\. ANTI-PATRÓN — FINDING \= RECOMMENDATION**

Incorrecto:

"Reduce Meta spend."

---

# **229\. ANTI-PATRÓN — FINDING \= PRIORITY**

Incorrecto:

priority \= P0

---

# **230\. ANTI-PATRÓN — FINDING \= ROOT CAUSE**

Incorrecto:

root cause \= creative fatigue

sin diagnóstico autorizado.

---

# **231\. ANTI-PATRÓN — ONE STATUS ONLY**

Incorrecto ocultar:

peer position

historical position

economic status

detrás de una única etiqueta.

---

# **232\. ANTI-PATRÓN — CONFIDENCE HIDDEN**

Todo Finding material necesita confidence.

---

# **233\. ANTI-PATRÓN — EVIDENCE HIDDEN**

Todo Finding material necesita evidence refs.

---

# **234\. ANTI-PATRÓN — SUMMARY AS AUTHORITY**

No parsear después el texto para descubrir:

severity

status

scope

Ya deben estar estructurados.

---

# **235\. ANTI-PATRÓN — DUPLICATE FINDING STORM**

Evitar crear el mismo Finding en cada ejecución.

---

# **236\. ANTI-PATRÓN — SILENT SUPPRESSION**

Debe quedar razón.

---

# **237\. ANTI-PATRÓN — OVERWRITE HISTORY**

Nunca.

---

# **238\. ANTI-PATRÓN — HYPOTHESIS IN FACTS**

No mezclar.

---

# **239\. ACCEPTANCE CRITERIA**

Para cualquier Finding debemos poder responder:

1\. ¿Cuál es el finding\_id?

2\. ¿Qué run lo creó?

3\. ¿Qué tipo de Finding es?

4\. ¿A qué familia pertenece?

5\. ¿Cuál es su subject?

6\. ¿Qué scope afecta?

7\. ¿Qué período cubre?

8\. ¿Cuál es su business status?

9\. ¿Cuál es su severity?

10\. ¿Qué dominio de severity?

11\. ¿Cuál es su materiality?

12\. ¿Existe impacto estimado?

13\. ¿Cuál es su confidence?

14\. ¿Cuál es su claim strength?

15\. ¿Cuál es el statement principal?

16\. ¿Qué facts lo sostienen?

17\. ¿Qué interpretations contiene?

18\. ¿Qué hypotheses contiene?

19\. ¿Qué hipótesis alternativas existen?

20\. ¿Qué benchmark evaluations utiliza?

21\. ¿Qué guardrail evaluations utiliza?

22\. ¿Qué anomalies utiliza?

23\. ¿Qué patterns utiliza?

24\. ¿Qué policy estaba activa?

25\. ¿Qué evidence package lo sostiene?

26\. ¿Qué evidence lo contradice?

27\. ¿Qué evidence falta?

28\. ¿Qué limitations existen?

29\. ¿Requiere validation?

30\. ¿Está listo para downstream?

31\. ¿Cuál es su lineage root?

32\. ¿Está open, monitoring, resolved o superseded?

33\. ¿Tiene Findings relacionados?

34\. ¿Puede reconstruirse completamente?

---

# **240\. DEFINITION OF DONE**

C6.13 estará formalmente definido cuando exista:

Finding Identity

Finding Types

Finding Families

Finding Source

Finding Polarity

Subject Model

Scope Model

Temporal Scope

Business Status

Lifecycle Status

Severity

Severity Domain

Materiality

Estimated Impact

Condition Urgency

Confidence

Claim Strength

Finding Statement

Summary

Fact Layer

Interpretation Layer

Hypothesis Layer

Alternative Hypotheses

Evaluation References

Benchmark References

Guardrail References

Anomaly References

Pattern References

Policy Reference

Evidence Package

Supporting Evidence

Contradictory Evidence

Missing Evidence

Limitations

Assumptions

Uncertainty

Finding Readiness

Validation Required

Evidence Needed

Lineage Root

Finding Relationships

Finding Signature

Deduplication

Suppression

Lifecycle Events

Escalation

Resolution

Human Validation

Validation Rules

Test Fixtures

---

# **241\. RESULTADO ARQUITECTÓNICO**

Antes de C6.13 el sistema puede tener:

Evaluation:  
risk

Anomaly:  
structural deterioration

Pattern:  
unsafe scaling

Confidence:  
high

Evidence:  
graph X

Después de C6.13:

FINDING

Unsafe Acquisition Scaling Conditions

TYPE

red\_flag

SUBJECT

Customer Acquisition

SCOPE

Spain  
New Customers

BUSINESS STATUS

Risk

SEVERITY

Critical

MATERIALITY

High

CONFIDENCE

High

FACTS

Marginal CAC exceeds sustainable guardrail.

Cash buffer is in risk zone.

Hero SKU inventory coverage is below  
configured scale requirement.

Fulfillment capacity is above 90%.

PATTERN

Unsafe Scaling

INTERPRETATION

Current acquisition scaling is occurring while  
multiple economic and operational constraints  
are simultaneously active.

HYPOTHESIS

None required to confirm the condition.

LIMITATION

Future demand remains forecast-dependent.

EVIDENCE

Evidence Package:  
EP-882

READINESS

Ready for diagnostic and prioritization phases.

IMPORTANT

No priority assigned.

No recommendation generated.

No execution action generated.

Ese objeto puede viajar de forma estable al resto del sistema.

---

# **242\. PRINCIPIO FINAL DE C6.13**

C6.13 debe imponer:

A Finding tells the system:

WHAT we found

HOW serious it appears

HOW material it is

HOW confident we are

WHAT evidence supports it

WHAT remains uncertain

Pero NO:

WHAT to attack first

WHY definitively it happened

WHAT strategy to choose

WHAT action to execute

Por tanto:

FINDING  
≠  
DIAGNOSIS

FINDING  
≠  
PRIORITY

FINDING  
≠  
RECOMMENDATION

FINDING  
≠  
EXECUTION

Y especialmente:

STATUS  
≠  
SEVERITY  
≠  
MATERIALITY  
≠  
CONFIDENCE  
≠  
IMPACT  
≠  
PRIORITY

---

# **243\. SALIDA FORMAL DE C6.13**

C6.13 produce:

EVALUATION\_FINDING

y, opcionalmente:

FINDING\_EVENT

FINDING\_RELATIONSHIP

Estos objetos serán consumidos por:

C6.14 — Inter-Phase Handoff

C6.15 — Observability & Audit

C6.16 — Validation & Test Fixtures

y por:

Fase 3 — Diagnóstico

Fase 4 — Priorización

Fase 7 — Motor de Recomendaciones

Fase 9 — Aprendizaje Continuo

C6.13 no produce:

FINAL ROOT CAUSE

BUSINESS PRIORITY

STRATEGY

PLAYBOOK

RECOMMENDED ACTION

EXECUTION ACTION

---

# **C6.13 — ESTADO**

CONTRACT:  
C6.13 Evaluation Finding Output

TYPE:  
Canonical Phase Output / Finding Contract

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
C6.11 Pattern & Red Flag Detection  
C6.12 Evidence, Provenance & Lineage

NEXT CONTRACT:  
C6.14 — Inter-Phase Handoff Contract

