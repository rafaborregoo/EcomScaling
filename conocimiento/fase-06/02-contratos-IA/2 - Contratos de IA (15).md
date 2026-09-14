# **C6.15 — OBSERVABILITY & AUDIT CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Observability & Audit Contract define cómo EcomScaling IA debe observar, registrar, inspeccionar y auditar el comportamiento operativo de toda la Fase 6\.

Su misión es responder:

> **¿Qué ocurrió durante una ejecución, qué decisiones tomó el sistema, qué falló, qué fallback utilizó y cómo podemos reconstruirlo desde administración?**

C6.15 convierte la arquitectura de Fase 6 en una infraestructura:

observable

debuggable

auditable

inspectable

measurable

operable

Debe permitir que un administrador pueda responder preguntas como:

¿Por qué la IA dijo que CAC era crítico?

¿Qué benchmark utilizó?

¿Qué benchmark rechazó?

¿Qué policy estaba activa?

¿Qué fallback se utilizó?

¿Qué datos faltaban?

¿Qué versión del evaluador produjo el resultado?

¿Por qué este run terminó en indeterminate?

¿Qué cambió entre ayer y hoy?

¿Qué Findings dependen de una fuente defectuosa?

---

# **2\. PROBLEMA QUE RESUELVE**

Una arquitectura de IA puede producir resultados aparentemente buenos y seguir siendo operacionalmente peligrosa si no permite saber:

qué ejecutó

qué decidió

qué falló

qué tardó

qué cambió

qué datos usó

qué versiones usó

qué fallback activó

Ejemplo:

Finding:  
CAC economic risk

Sin observabilidad:

"No sabemos por qué salió."

Con C6.15:

Run:  
RUN-882

Observation:  
CAC €48

Internal benchmark:  
rejected

Reason:  
tracking break

Peer benchmark:  
selected

Guardrail:  
€43

Policy:  
v4.2

Evaluator:  
v5.1

Confidence:  
medium

Fallback:  
peer\_reference

Duration:  
382 ms

---

# **3\. PRINCIPIO FUNDAMENTAL**

Debe mantenerse:

TRACEABILITY  
≠  
OBSERVABILITY

C6.12 responde:

> ¿De dónde salió esta conclusión?

C6.15 responde:

> ¿Qué ocurrió durante la ejecución que produjo esa conclusión?

---

# **4\. SEGUNDO PRINCIPIO**

También:

AUDIT  
≠  
LOGGING

Un log como:

"evaluation completed"

no es suficiente auditoría.

La auditoría debe preservar:

identity

decision

actor/system

input refs

output refs

versions

timestamp

reason

change

---

# **5\. TERCER PRINCIPIO**

La observabilidad debe centrarse en:

structured events

y no únicamente en:

free-text logs

---

# **6\. CUARTO PRINCIPIO**

No debe almacenarse razonamiento interno libre del modelo.

La auditoría debe registrar:

structured decisions

candidate selections

rejection reasons

policies

rules

evidence refs

outputs

No:

private chain-of-thought

---

# **7\. RESPONSABILIDAD**

C6.15 debe permitir observar:

RUNS

STAGES

DECISIONS

RESOLUTIONS

FALLBACKS

ERRORS

RETRIES

LATENCIES

QUALITY FAILURES

POLICY CONFLICTS

REFERENCE SELECTIONS

GUARDRAIL RESOLUTION

CONFIDENCE CAPS

ANOMALIES

PATTERNS

FINDINGS

HANDOFFS

VERSION CHANGES

---

# **8\. LO QUE C6.15 NO DEBE HACER**

C6.15 NO debe:

recompute business evaluation

override findings

diagnose business causes

prioritize business issues

recommend actions

Su función es:

observe

record

measure

audit

surface

---

# **9\. OBSERVABILITY MODEL**

Debe existir conceptualmente:

OBSERVABILITY\_EVENT

---

# **10\. EVENT\_ID**

Todo evento material debe disponer de:

event\_id

único.

---

# **11\. RUN RELATION**

Todo evento debe enlazar cuando corresponda:

run\_id

trace\_id

---

# **12\. EVENT TYPE**

Taxonomía inicial:

run\_started

run\_completed

run\_partial

run\_failed

stage\_started

stage\_completed

stage\_failed

candidate\_resolved

candidate\_rejected

fallback\_used

policy\_resolved

policy\_conflict

benchmark\_selected

guardrail\_resolved

guardrail\_unresolved

confidence\_capped

anomaly\_detected

pattern\_detected

finding\_created

finding\_updated

finding\_resolved

handoff\_created

handoff\_failed

validation\_failed

retry\_started

retry\_completed

---

# **13\. EVENT CATEGORY**

Puede existir:

runtime

resolution

evaluation

quality

confidence

anomaly

pattern

finding

handoff

error

audit

---

# **14\. EVENT TIMESTAMP**

Todo evento debe registrar:

occurred\_at

---

# **15\. EVENT SEQUENCE**

Puede existir:

sequence\_number

dentro de un run.

---

# **16\. WHY SEQUENCE MATTERS**

Permite reconstruir:

Run Started  
↓  
Observation Loaded  
↓  
Benchmark Candidates Evaluated  
↓  
Internal Benchmark Rejected  
↓  
Peer Benchmark Selected  
↓  
Guardrail Resolved  
↓  
Evaluation Completed  
↓  
Finding Created  
↓  
Handoff Created

---

# **17\. RUN OBSERVABILITY**

Cada ejecución debe disponer de un resumen:

RUN\_OBSERVABILITY

---

# **18\. RUN SUMMARY**

Debe poder contener:

run\_id

trace\_id

tenant\_id

business\_id

execution\_kind

execution\_mode

environment

started\_at

completed\_at

duration

execution\_status

stage\_count

error\_count

warning\_count

fallback\_count

finding\_count

---

# **19\. RUN STATUS**

Debe reutilizar la semántica técnica de C6.0:

created

running

completed

partial

failed

cancelled

---

# **20\. BUSINESS STATUS ≠ RUN STATUS**

Ejemplo válido:

run\_status:  
completed

business\_status:  
critical

---

# **21\. STAGE OBSERVABILITY**

Cada componente relevante puede emitir:

STAGE\_EXECUTION

---

# **22\. STAGE TYPES**

Ejemplos:

metric\_normalization

context\_resolution

data\_quality\_assessment

benchmark\_resolution

guardrail\_resolution

policy\_resolution

confidence\_assessment

benchmark\_evaluation

anomaly\_detection

pattern\_detection

finding\_generation

handoff\_generation

---

# **23\. STAGE\_ID**

Debe existir:

stage\_execution\_id

---

# **24\. STAGE STATUS**

pending

running

completed

partial

failed

skipped

blocked

---

# **25\. SKIPPED**

Debe distinguirse:

skipped

de:

failed

Ejemplo:

anomaly detection:  
skipped

reason:  
insufficient history

---

# **26\. BLOCKED**

Ejemplo:

guardrail evaluation:  
blocked

reason:  
policy conflict

---

# **27\. STAGE TIMING**

Debe registrar:

started\_at

completed\_at

duration\_ms

---

# **28\. LATENCY**

La observabilidad debe permitir medir:

total run latency

stage latency

external source latency

model latency

resolver latency

---

# **29\. LATENCY ≠ BUSINESS QUALITY**

Un run rápido puede producir mala evaluación.

Un run lento puede producir buena evaluación.

Son dimensiones distintas.

---

# **30\. PERFORMANCE METRICS**

Puede existir:

OBSERVABILITY\_METRIC

---

# **31\. TECHNICAL METRICS**

Ejemplos:

runs\_total

runs\_failed

runs\_partial

average\_run\_latency

p95\_run\_latency

fallback\_rate

policy\_conflict\_rate

unresolved\_guardrail\_rate

indeterminate\_evaluation\_rate

finding\_generation\_rate

handoff\_failure\_rate

---

# **32\. QUALITY OBSERVABILITY**

Además de métricas técnicas, interesa observar calidad sistémica.

Ejemplos:

low\_data\_quality\_rate

missing\_context\_rate

no\_valid\_reference\_rate

fallback\_reference\_rate

low\_confidence\_finding\_rate

broken\_lineage\_rate

---

# **33\. WHY THIS MATTERS**

Si:

45% of evaluations  
use generic fallback benchmarks

puede existir un problema de arquitectura/datos aunque los runs técnicamente completen.

---

# **34\. DECISION OBSERVABILITY**

Debe existir:

DECISION\_EVENT

para decisiones estructuradas importantes.

---

# **35\. DECISION TYPES**

Ejemplos:

reference\_selected

reference\_rejected

policy\_selected

override\_applied

fallback\_selected

guardrail\_selected

confidence\_capped

pattern\_confirmed

finding\_suppressed

handoff\_blocked

---

# **36\. DECISION INPUTS**

Debe poder registrar:

candidate refs

policy refs

context refs

quality refs

---

# **37\. DECISION OUTPUT**

Debe registrar:

selected result

---

# **38\. DECISION REASON**

Debe registrar:

reason\_code

y opcionalmente:

structured\_reason

---

# **39\. EXAMPLE — BENCHMARK SELECTION**

event:  
reference\_selected

selected:  
peer\_benchmark\_v3

rejected:  
internal\_history\_v2

reason:  
internal reference invalidated by measurement break

---

# **40\. REJECTION OBSERVABILITY**

No observar solo qué ganó.

También:

what lost  
and why

---

# **41\. FALLBACK OBSERVABILITY**

Debe existir:

FALLBACK\_EVENT

---

# **42\. FALLBACK TYPES**

Ejemplos:

benchmark\_fallback

policy\_fallback

context\_fallback

source\_fallback

model\_fallback

capability\_fallback

---

# **43\. FALLBACK REASON**

Debe existir:

fallback\_reason

---

# **44\. FALLBACK CHAIN**

Debe poder reconstruirse:

internal\_same\_season  
↓ unavailable

internal\_recent  
↓ incompatible

peer  
↓ selected

---

# **45\. FALLBACK LEVEL**

Puede existir:

fallback\_depth

---

# **46\. HIGH FALLBACK DEPTH**

Puede ser útil como señal de calidad del sistema.

---

# **47\. SILENT FALLBACK PROHIBITED**

Toda utilización material de fallback debe quedar observada.

---

# **48\. POLICY OBSERVABILITY**

Debe poder inspeccionarse:

policy candidates

matched policies

rejected policies

inheritance

overrides

effective policy

conflicts

---

# **49\. POLICY EVENT TYPES**

Ejemplos:

policy\_candidate\_matched

policy\_candidate\_rejected

policy\_override\_applied

policy\_fallback\_used

policy\_conflict\_detected

policy\_resolution\_completed

---

# **50\. POLICY CHANGE AUDIT**

Además de runtime, debe existir auditoría de cambios en policies.

---

# **51\. POLICY\_AUDIT\_EVENT**

Puede registrar:

policy\_id

old\_version

new\_version

change\_type

actor\_ref

change\_reason

changed\_at

---

# **52\. CHANGE TYPES**

Ejemplos:

created

updated

activated

deprecated

retired

rolled\_back

override\_created

override\_removed

---

# **53\. AUDIT IMMUTABILITY**

Los eventos de auditoría no deben ser editables silenciosamente.

---

# **54\. BENCHMARK OBSERVABILITY**

Debe poder observarse:

benchmark selected

benchmark rejected

benchmark expired

benchmark superseded

benchmark quality degraded

---

# **55\. BENCHMARK AUDIT**

Cambios en catálogo también deben poder registrarse.

Ejemplo:

peer benchmark v4  
supersedes  
v3

---

# **56\. GUARDRAIL OBSERVABILITY**

Debe permitir inspeccionar:

guardrail definition

resolved threshold

dependencies

policy source

resolution status

breach status

---

# **57\. UNRESOLVED GUARDRAIL**

Debe ser visible como evento operacional relevante.

Ejemplo:

guardrail\_unresolved

reason:  
missing contribution data

---

# **58\. CONFIDENCE OBSERVABILITY**

Debe observar:

confidence assessment

confidence ceiling

critical evidence gaps

contradictions

claim strength

---

# **59\. CONFIDENCE CAP EVENT**

Ejemplo:

finding confidence:  
requested high

capped at medium

reason:  
modeled repeat contribution

---

# **60\. DATA QUALITY OBSERVABILITY**

Debe poder medir:

stale sources

missing periods

tracking incidents

source conflicts

coverage failures

sample insufficiency

---

# **61\. DATA QUALITY INCIDENT**

Puede existir:

DATA\_QUALITY\_INCIDENT

---

# **62\. INCIDENT TYPES**

Ejemplos:

source\_stale

source\_unavailable

tracking\_failure

schema\_change

missing\_period

source\_conflict

identity\_loss

duplicate\_events

timezone\_mismatch

currency\_mismatch

---

# **63\. INCIDENT STATUS**

detected

confirmed

monitoring

resolved

dismissed

---

# **64\. INCIDENT SCOPE**

Debe indicar:

source

metric

channel

market

business

period

---

# **65\. BLAST RADIUS**

C6.12 puede proporcionar:

affected observations

evaluations

findings

---

# **66\. ADMIN VALUE**

Pregunta:

> ¿Qué conclusiones se vieron afectadas por el fallo de GA4?

C6.15 \+ C6.12 deben poder responder.

---

# **67\. ERROR MODEL**

Debe existir:

RUNTIME\_ERROR

---

# **68\. ERROR\_ID**

Todo error material:

error\_id

---

# **69\. ERROR CATEGORY**

Taxonomía inicial:

input\_error

validation\_error

source\_error

transformation\_error

configuration\_error

policy\_error

resolution\_error

evaluation\_error

model\_error

integration\_error

permission\_error

system\_error

---

# **70\. ERROR CODE**

Debe existir:

error\_code

machine-readable.

---

# **71\. ERROR MESSAGE**

Puede existir explicación humana.

---

# **72\. ERROR STAGE**

Debe indicar:

stage

---

# **73\. RETRYABLE**

Debe existir:

retryable

---

# **74\. RECOVERABLE**

Separadamente:

recoverable

---

# **75\. RETRYABLE ≠ RECOVERABLE**

Un error puede ser:

retryable \= false  
recoverable \= true

si requiere intervención/configuración.

---

# **76\. ERROR SEVERITY**

Taxonomía técnica:

info

warning

error

critical

No confundir con business severity.

---

# **77\. ERROR SEVERITY DOMAIN**

Debe quedar claro:

technical

---

# **78\. RETRY OBSERVABILITY**

Debe registrarse:

retry\_of\_run\_id

retry\_number

retry\_reason

---

# **79\. NO HIDDEN RETRIES**

Si el sistema reintenta tres veces, debe poder inspeccionarse.

---

# **80\. RETRY RESULT**

succeeded

failed

partial

---

# **81\. IDEMPOTENCY OBSERVABILITY**

Puede observarse:

idempotency\_key

duplicate\_request\_detected

---

# **82\. DUPLICATE RUN**

Debe poder distinguir:

new legitimate execution

de:

duplicate request

---

# **83\. REPLAY OBSERVABILITY**

Debe existir:

replay\_of\_run\_id

visible en administración.

---

# **84\. SIMULATION OBSERVABILITY**

Debe etiquetarse claramente:

execution\_mode \= simulation

---

# **85\. NEVER MIX SIMULATION WITH LIVE**

Admin debe poder filtrar fácilmente:

live

replay

simulation

test

---

# **86\. FINDING OBSERVABILITY**

Debe observar:

finding\_created

finding\_escalated

finding\_deescalated

finding\_confidence\_changed

finding\_resolved

finding\_reopened

finding\_suppressed

finding\_superseded

---

# **87\. FINDING TIMELINE**

Debe poder visualizarse:

09:00 warning  
12:00 risk  
18:00 critical  
next day resolved

---

# **88\. FINDING CHANGE REASON**

Toda transición material debe tener:

reason

---

# **89\. ANOMALY OBSERVABILITY**

Debe poder visualizar:

candidate anomaly

confirmed anomaly

dismissed anomaly

reclassified anomaly

resolved anomaly

---

# **90\. PATTERN OBSERVABILITY**

Igualmente:

pattern candidate

pattern supported

pattern confirmed

pattern suppressed

pattern resolved

---

# **91\. HANDOFF OBSERVABILITY**

Debe observar:

handoff created

validated

dispatched

accepted

rejected

failed

retried

superseded

---

# **92\. HANDOFF LATENCY**

Puede medirse:

time\_to\_acceptance

time\_to\_downstream\_result

---

# **93\. DOWNSTREAM LINK**

Debe poder verse:

F6 Finding  
→  
F3 Diagnosis  
→  
F4 Priority  
→  
F7 Recommendation

cuando existan.

---

# **94\. AUDIT EVENT**

Debe existir un objeto específico:

AUDIT\_EVENT

---

# **95\. AUDIT\_EVENT\_ID**

Todo audit event:

audit\_event\_id

---

# **96\. AUDIT SUBJECT**

Puede ser:

policy

benchmark

guardrail

finding

handoff

configuration

human override

system setting

---

# **97\. AUDIT ACTION**

Ejemplos:

created

changed

approved

activated

deprecated

overridden

suppressed

validated

rejected

restored

---

# **98\. ACTOR**

Debe registrar:

actor\_type

actor\_ref

---

# **99\. ACTOR TYPES**

Ejemplos:

system

admin

consultant

agent

api

workflow

---

# **100\. MINIMIZE PII**

Usar identificadores técnicos.

No nombres/emails innecesarios.

---

# **101\. BEFORE / AFTER**

Cuando aplique:

previous\_state\_ref

new\_state\_ref

o diff estructurado.

---

# **102\. CHANGE DIFF**

Debe poder existir:

changed\_fields

---

# **103\. WHY CHANGE**

Debe registrarse:

change\_reason

cuando sea material.

---

# **104\. APPROVAL AUDIT**

Si una policy requiere aprobación:

approved\_by\_ref

approved\_at

---

# **105\. HUMAN OVERRIDE AUDIT**

Debe conservar:

original system result

override result

actor

reason

time

---

# **106\. NO SILENT HUMAN OVERRIDE**

Regla absoluta.

---

# **107\. ADMIN PANEL — RUNS**

Debe poder existir una vista de:

Runs

con columnas conceptuales:

run

business

execution type

started

duration

status

warnings

errors

fallbacks

findings

---

# **108\. ADMIN PANEL — RUN DETAIL**

Al abrir un run:

Runtime identity

Stages

Inputs

Versions

Policies

Benchmark resolution

Guardrails

Confidence

Evaluations

Anomalies

Patterns

Findings

Handoffs

Errors

---

# **109\. ADMIN PANEL — WHY VIEW**

Para cada Finding:

WHY?

debe poder abrir C6.12.

---

# **110\. ADMIN PANEL — DECISION VIEW**

Debe mostrar:

Candidates

Selected

Rejected

Reason

---

# **111\. EXAMPLE**

Benchmark resolution

Internal History  
REJECTED  
Reason:  
Measurement break

Peer Group  
SELECTED  
Reason:  
High comparability \+ sufficient quality

Industry  
SUPPORTING  
Reason:  
Lower contextual fit

---

# **112\. ADMIN PANEL — CONFIGURATION VIEW**

Debe permitir saber:

what policy bundle was active

---

# **113\. CONFIGURATION SNAPSHOT**

Debe poder abrir:

configuration\_snapshot\_id

---

# **114\. POLICY DIFF**

Muy importante:

> ¿Qué cambió entre Run A y Run B?

Debe poder comparar:

policy versions

benchmark versions

guardrail thresholds

engine versions

input data

context

---

# **115\. RUN COMPARISON**

Debe existir conceptualmente:

RUN\_COMPARISON

---

# **116\. RUN COMPARISON PURPOSE**

Responder:

Why did yesterday say healthy  
and today say risk?

---

# **117\. COMPARISON DIMENSIONS**

input differences

context differences

policy differences

benchmark differences

guardrail differences

engine differences

confidence differences

finding differences

---

# **118\. RESULT DIFF**

Ejemplo:

Run A:  
CAC €41  
Guardrail €43  
Status healthy

Run B:  
CAC €48  
Guardrail €43  
Status risk

Reason:

Observation changed.  
Policy unchanged.  
Evaluator unchanged.

---

# **119\. CONFIGURATION-DRIVEN DIFF**

Otro caso:

Observation unchanged:  
€48

Old guardrail:  
€50

New guardrail:  
€43

Cambio de Finding debido a:

policy update

Debe ser visible.

---

# **120\. ENGINE-DRIVEN DIFF**

Otro caso:

same data

same policy

new evaluation engine

Debemos poder identificarlo.

---

# **121\. DATA-DRIVEN DIFF**

Otro:

late-arriving transactions

cambiaron el resultado.

---

# **122\. DIFF EXPLANATION**

Debe generar:

DIFF\_EXPLANATION

estructurada.

---

# **123\. RUN COMPARISON ≠ REPLAY**

Comparar runs es inspección.

Replay vuelve a ejecutar.

---

# **124\. ADMIN PANEL — INCIDENTS**

Debe existir una vista de:

Data / Runtime Incidents

---

# **125\. INCIDENT FIELDS**

Ejemplos:

incident

source

business

started

status

affected metrics

affected findings

severity

resolution

---

# **126\. ADMIN PANEL — FINDINGS**

Debe permitir filtrar por:

business

family

status

severity

confidence

materiality

open/resolved

validation required

---

# **127\. ADMIN PANEL — LOW CONFIDENCE**

Vista útil:

High severity  
\+  
Low confidence

para validar rápidamente casos potencialmente críticos.

---

# **128\. ADMIN PANEL — INDETERMINATE**

Otra:

indeterminate evaluations

para detectar gaps de datos/configuración.

---

# **129\. ADMIN PANEL — FALLBACKS**

Muy útil:

fallback usage

por business/métrica.

---

# **130\. FALLBACK ANALYTICS**

Ejemplos:

generic benchmark usage

peer fallback usage

policy default usage

---

# **131\. HIGH FALLBACK RATE**

Puede indicar:

missing tenant configuration

poor internal data

insufficient benchmarks

---

# **132\. ADMIN PANEL — POLICY CONFLICTS**

Debe existir filtro:

unresolved policy conflicts

---

# **133\. ADMIN PANEL — BROKEN LINEAGE**

Debe poder encontrar:

findings with partial/broken lineage

---

# **134\. ADMIN PANEL — VERSION USAGE**

Pregunta:

> ¿Qué runs utilizaron evaluator v4.1?

Debe ser posible.

---

# **135\. BENCHMARK VERSION USAGE**

También:

> ¿Qué Findings dependieron del benchmark v3?

---

# **136\. POLICY VERSION USAGE**

También:

> ¿Qué Findings usaron CAC policy v4.2?

---

# **137\. IMPACT ANALYSIS**

Si una versión tiene bug:

find all affected runs/findings

---

# **138\. ALERTING**

C6.15 puede definir alertas técnicas.

---

# **139\. TECHNICAL ALERT TYPES**

Ejemplos:

run failure rate high

data source stale

policy conflicts detected

lineage broken

fallback rate abnormal

handoff failures

evaluation latency high

---

# **140\. TECHNICAL ALERT ≠ BUSINESS FINDING**

Debe mantenerse separado.

---

# **141\. BUSINESS ALERTS**

Los Findings son la capa de negocio.

C6.15 puede observarlos, pero no redefinirlos.

---

# **142\. ALERT SEVERITY**

Technical alert severity:

info

warning

error

critical

separada de business severity.

---

# **143\. MONITORING WINDOWS**

Puede ser necesario medir:

1h

24h

7d

30d

según métrica técnica.

---

# **144\. SLO / SLI READINESS**

La arquitectura debe permitir posteriormente definir:

SLI

SLO

para runtime.

Ejemplos:

evaluation availability

run success rate

p95 latency

lineage completeness

handoff delivery

---

# **145\. NO SLO VALUES YET**

C6.15 define capacidad.

No hardcodea objetivos operativos concretos todavía.

---

# **146\. MODEL OBSERVABILITY**

Cuando participe IA generativa debe poder observar:

provider

model family

model version

agent version

prompt version

latency

error

token usage if available/needed

---

# **147\. TOKEN/COST OBSERVABILITY**

Puede existir:

input\_tokens

output\_tokens

estimated\_cost

si aplica.

---

# **148\. COST ≠ QUALITY**

No optimizar calidad reduciendo inteligencia por plan.

---

# **149\. RETRIEVAL OBSERVABILITY**

Cuando participe RAG:

retriever\_version

query\_ref

chunks\_retrieved

retrieval\_latency

knowledge\_base\_version

pueden registrarse.

---

# **150\. RETRIEVAL RESULT QUALITY**

Puede observar:

no\_relevant\_context

retrieval\_fallback

low retrieval score

cuando sea útil.

---

# **151\. RAG OBSERVABILITY ≠ BUSINESS EVIDENCE**

Mantener separación.

---

# **152\. TOOL / COMPONENT OBSERVABILITY**

Debe poder identificar:

component\_id

component\_type

component\_version

de C6.0.

---

# **153\. COMPONENT TYPES**

Ejemplos:

calculator

resolver

rules\_engine

statistical\_engine

retriever

agent

llm

---

# **154\. COMPONENT ERROR RATE**

Puede medirse por componente.

---

# **155\. COMPONENT LATENCY**

También.

---

# **156\. DEPENDENCY OBSERVABILITY**

Fuentes externas:

Shopify

Meta

GA4

ERP

pueden tener:

availability

latency

error rate

last successful sync

---

# **157\. SOURCE HEALTH**

Puede existir:

SOURCE\_HEALTH

---

# **158\. SOURCE HEALTH STATES**

healthy

degraded

stale

unavailable

unknown

---

# **159\. SOURCE HEALTH ≠ DATA QUALITY**

Una API puede estar healthy ahora pero contener un período de datos defectuoso.

---

# **160\. AUDIT RETENTION**

Los eventos de auditoría deben tener política de retención.

Implementación concreta posterior.

---

# **161\. LOG RETENTION ≠ AUDIT RETENTION**

Los logs técnicos de bajo nivel pueden tener menor retención que eventos auditables críticos.

---

# **162\. DATA MINIMIZATION**

Observability no debe convertirse en un almacén duplicado de datos personales.

---

# **163\. SENSITIVE FIELDS**

Evitar registrar:

customer emails

full addresses

payment information

document content

salvo necesidad explícita y autorizada.

---

# **164\. REDACTION**

Debe soportarse:

redacted fields

en logs/eventos.

---

# **165\. SECRET HANDLING**

Nunca registrar:

API secrets

tokens

passwords

---

# **166\. ERROR LOG SANITIZATION**

Errores externos pueden contener datos sensibles.

Deben sanitizarse.

---

# **167\. TENANT ISOLATION**

Toda observabilidad debe mantener:

tenant boundary

---

# **168\. CROSS-TENANT ADMIN**

Solo roles expresamente autorizados pueden observar múltiples tenants.

---

# **169\. AUDIT ACCESS**

Debe existir:

read permission

específica para auditoría.

---

# **170\. AUDIT RECORD TAMPERING**

Idealmente los eventos críticos deben ser:

append-oriented

tamper-evident

a nivel arquitectónico.

---

# **171\. CONTENT HASH**

Puede utilizarse:

event hash

snapshot hash

para integridad futura.

---

# **172\. HASH CHAIN**

Podría existir más adelante para auditorías reforzadas.

No obligatorio en la primera implementación.

---

# **173\. OBSERVABILITY EVENT SHAPE**

Conceptualmente:

observability\_event:

    identity:  
        event\_id  
        run\_id  
        trace\_id

    classification:  
        event\_type  
        event\_category

    scope:  
        tenant\_id  
        business\_id  
        component  
        stage

    timing:  
        occurred\_at  
        sequence\_number  
        duration\_ms

    decision:  
        subject\_ref  
        candidates  
        selected  
        rejected  
        reason\_codes

    outcome:  
        status  
        warnings  
        errors  
        fallback\_used

    references:  
        policy\_refs  
        benchmark\_refs  
        guardrail\_refs  
        finding\_refs  
        handoff\_refs

    metadata:  
        structured\_metadata

---

# **174\. AUDIT EVENT SHAPE**

audit\_event:

    audit\_event\_id

    tenant\_id  
    business\_id

    subject\_type  
    subject\_ref

    action

    actor\_type  
    actor\_ref

    previous\_state\_ref  
    new\_state\_ref

    changed\_fields

    reason

    occurred\_at

    trace\_id

---

# **175\. ERROR SHAPE**

runtime\_error:

    error\_id  
    run\_id  
    stage\_execution\_id

    category  
    error\_code

    technical\_severity

    retryable  
    recoverable

    safe\_message  
    error\_ref

    occurred\_at

---

# **176\. STAGE EXECUTION SHAPE**

stage\_execution:

    stage\_execution\_id  
    run\_id

    stage\_type  
    component\_id  
    component\_version

    started\_at  
    completed\_at  
    duration\_ms

    status

    input\_refs  
    output\_refs

    warning\_count  
    error\_count  
    fallback\_count

---

# **177\. RUN OBSERVABILITY SHAPE**

run\_observability:

    run\_id  
    trace\_id

    execution\_kind  
    execution\_mode  
    environment

    started\_at  
    completed\_at  
    duration\_ms

    status

    stages

    warnings  
    errors  
    fallbacks

    findings\_created

    handoffs\_created

    version\_manifest\_ref  
    configuration\_snapshot\_ref

---

# **178\. RUN COMPARISON SHAPE**

run\_comparison:

    comparison\_id

    run\_a  
    run\_b

    input\_diff  
    context\_diff  
    configuration\_diff  
    policy\_diff  
    benchmark\_diff  
    guardrail\_diff  
    engine\_diff  
    confidence\_diff  
    finding\_diff

    explanation

---

# **179\. EXAMPLE — WHY CAC WAS CRITICAL**

Admin query:

Why did the system say CAC was critical?

C6.15 \+ C6.12 should answer:

RUN

RUN-882

OBSERVATION

New Customer CAC:  
€48

DATA QUALITY

High

BENCHMARK RESOLUTION

Internal same-season:  
Selected as historical reference

Peer benchmark:  
Supporting

GUARDRAIL RESOLUTION

Profitability CAC:  
€43

Cash-safe CAC:  
€40

EVALUATION

Profitability:  
Breached

Cash:  
Critical breach

SYNTHESIS POLICY

Critical cash breach  
dominates overall status.

CONFIDENCE

High

FINDING

Acquisition economics critical risk.

---

# **180\. EXAMPLE — WHY RESULT CHANGED**

Yesterday:

status:  
healthy

Today:

status:  
risk

Run comparison:

Metric:  
€41 → €48

Guardrail:  
unchanged €43

Policy:  
unchanged

Benchmark:  
unchanged

Evaluator:  
unchanged

Reason for change:  
business observation changed.

---

# **181\. EXAMPLE — POLICY-DRIVEN CHANGE**

Yesterday:

CAC:  
€48

Guardrail:  
€52

Status:  
healthy

Today:

CAC:  
€48

Guardrail:  
€43

Status:  
risk

Run comparison:

Observation:  
unchanged

Policy:  
v4.1 → v4.2

Safety buffer:  
5% → 15%

Reason:  
policy update changed effective guardrail.

---

# **182\. EXAMPLE — FALLBACK MONITORING**

Admin view:

CAC evaluations last 30d:

Internal reference:  
62%

Peer fallback:  
27%

Industry fallback:  
9%

Generic fallback:  
2%

Esto permite detectar dónde faltan mejores referencias.

---

# **183\. EXAMPLE — INDETERMINATE RATE**

Inventory findings:

Determinate:  
81%

Indeterminate:  
19%

Breakdown:

stale source:  
11%

missing guardrail:  
5%

policy conflict:  
3%

Esto genera acciones de mejora de infraestructura.

---

# **184\. EXAMPLE — INCIDENT BLAST RADIUS**

Incident:

GA4 purchase event broken

C6.15 \+ C6.12:

Affected observations:  
42

Affected evaluations:  
18

Affected findings:  
7

Affected handoffs:  
3

---

# **185\. EXAMPLE — HUMAN OVERRIDE**

System:

finding severity:  
high

Consultant override:

severity:  
medium

Audit:

actor:  
consultant\_ref\_42

reason:  
known temporary warehouse migration

original:  
high

override:  
medium

occurred\_at:  
...

Original remains preserved.

---

# **186\. EXAMPLE — PATTERN INSPECTION**

Admin query:

> ¿Por qué unsafe\_scaling?

View:

Pattern:  
unsafe\_scaling v2.1

Signals:

Marginal CAC critical:  
YES

Cash risk:  
YES

Inventory warning:  
YES

Operations warning:  
YES

Contradictory signals:  
none

Pattern confidence:  
high

Detected:  
2026-09-01

Duration:  
10 days

---

# **187\. EXAMPLE — HANDOFF INSPECTION**

Finding:  
FND-882

F6 → F7

Status:  
rejected

Reason:  
diagnostic dependency missing

Required:  
F3 diagnostic result

Retry:  
pending/not applicable

---

# **188\. OBSERVABILITY DASHBOARD GROUPS**

Conceptualmente el panel puede dividirse en:

Runtime

Data Quality

Resolution

Findings

Incidents

Handoffs

Configuration

Audit

---

# **189\. RUNTIME VIEW**

Muestra salud técnica.

---

# **190\. DATA QUALITY VIEW**

Muestra problemas de medición.

---

# **191\. RESOLUTION VIEW**

Muestra:

benchmarks

guardrails

policies

fallbacks

---

# **192\. FINDINGS VIEW**

Muestra estado del negocio detectado.

---

# **193\. INCIDENT VIEW**

Muestra problemas técnicos/de datos.

---

# **194\. HANDOFF VIEW**

Muestra flujo entre fases.

---

# **195\. CONFIGURATION VIEW**

Muestra versiones y cambios.

---

# **196\. AUDIT VIEW**

Muestra quién/qué cambió algo.

---

# **197\. OBSERVABILITY KPIs**

Ejemplos conceptuales:

Run Success Rate

Partial Run Rate

Fallback Rate

Policy Conflict Rate

No Valid Reference Rate

Indeterminate Evaluation Rate

Low Confidence Finding Rate

Broken Lineage Rate

Handoff Failure Rate

Average Run Latency

---

# **198\. THESE ARE SYSTEM METRICS**

No confundir con:

ecommerce business metrics

---

# **199\. CARDINALITY**

Observability debe diseñarse evitando dimensiones sin control.

Ejemplo problemático:

customer\_id

como label de métrica técnica.

---

# **200\. HIGH-CARDINALITY DATA**

Debe reservarse para event stores/traces, no necesariamente métricas agregadas.

---

# **201\. EVENT VS METRIC**

Eventos:

granular

Métricas:

aggregated

---

# **202\. TRACE VS LOG**

Trace:

request/run lifecycle

Log:

technical message

---

# **203\. AUDIT VS TRACE**

Audit:

material action/change

Trace:

execution behavior

---

# **204\. NO SINGLE OBSERVABILITY STORE ASSUMPTION**

C6.15 define semántica.

La implementación puede utilizar distintos stores.

---

# **205\. IMPLEMENTATION-AGNOSTIC**

No decidir todavía:

OpenTelemetry

Datadog

Grafana

Supabase tables

ClickHouse

Eso pertenece a implementación.

---

# **206\. CORRELATION**

Debe existir:

correlation\_id

de C6.0 cuando atraviese servicios externos.

---

# **207\. EXTERNAL REQUEST REF**

Puede almacenarse:

provider\_request\_ref

sin datos sensibles.

---

# **208\. RATE LIMIT / PROVIDER ERROR**

Debe observarse.

---

# **209\. DEGRADED MODE**

Puede existir:

degraded\_mode

cuando algunos componentes fallan pero el run continúa parcialmente.

---

# **210\. DEGRADED MODE REASON**

Ejemplo:

external peer benchmark unavailable

---

# **211\. PARTIAL RESULT**

Debe quedar explícito.

---

# **212\. FAIL OPEN VS FAIL CLOSED**

Cada stage/policy puede definir comportamiento.

Ejemplo:

generic benchmark unavailable:  
fail open

pero:

tenant identity invalid:  
fail closed

---

# **213\. OBSERVE FAIL MODE**

Debe registrarse:

fail\_mode

---

# **214\. CRITICAL FAIL CLOSED**

Ejemplos:

tenant isolation failure

policy conflict in critical guardrail

invalid identity/versioning

---

# **215\. ADMIN ACTIONABILITY**

Observability debería permitir identificar:

what needs engineering attention

what needs data attention

what needs configuration attention

what needs consultant validation

---

# **216\. ISSUE DOMAIN**

Puede existir:

issue\_domain

con:

engineering

data

configuration

business\_validation

---

# **217\. OBSERVABILITY REASON CODES**

Ejemplos:

OBS\_RUN\_COMPLETE

OBS\_RUN\_PARTIAL

OBS\_RUN\_FAILED

OBS\_FALLBACK\_USED

OBS\_POLICY\_CONFLICT

OBS\_REFERENCE\_REJECTED

OBS\_REFERENCE\_FALLBACK

OBS\_GUARDRAIL\_UNRESOLVED

OBS\_CONFIDENCE\_CAPPED

OBS\_LINEAGE\_BROKEN

OBS\_FINDING\_CREATED

OBS\_HANDOFF\_BLOCKED

OBS\_SOURCE\_STALE

OBS\_TRACKING\_INCIDENT

---

# **218\. INVARIANTES C6.15**

## **INV-C6.15-001**

Todo run material debe ser observable.

---

## **INV-C6.15-002**

Todo run debe enlazar trace\_id.

---

## **INV-C6.15-003**

Run status y business status deben permanecer separados.

---

## **INV-C6.15-004**

Toda decisión material debe tener razón estructurada.

---

## **INV-C6.15-005**

Todo fallback material debe registrarse.

---

## **INV-C6.15-006**

Todo policy conflict debe ser observable.

---

## **INV-C6.15-007**

Todo guardrail unresolved material debe ser observable.

---

## **INV-C6.15-008**

Todo error debe identificar stage/categoría.

---

## **INV-C6.15-009**

Retry debe conservar relación con run original.

---

## **INV-C6.15-010**

Simulation/replay/live deben distinguirse.

---

## **INV-C6.15-011**

Los eventos auditables no deben sobrescribirse silenciosamente.

---

## **INV-C6.15-012**

Human override debe conservar original.

---

## **INV-C6.15-013**

Observability no debe almacenar secrets.

---

## **INV-C6.15-014**

Observability debe minimizar PII.

---

## **INV-C6.15-015**

Tenant isolation aplica también a logs/audit.

---

## **INV-C6.15-016**

Admin access no debe inferirse por posesión de IDs.

---

## **INV-C6.15-017**

Run comparison debe distinguir cambios de datos, config y engine.

---

## **INV-C6.15-018**

High fallback rate debe poder medirse.

---

## **INV-C6.15-019**

Indeterminate rate debe poder medirse.

---

## **INV-C6.15-020**

Broken lineage rate debe poder medirse.

---

## **INV-C6.15-021**

Finding lifecycle debe ser observable.

---

## **INV-C6.15-022**

Handoff lifecycle debe ser observable.

---

## **INV-C6.15-023**

No almacenar chain-of-thought privado.

---

## **INV-C6.15-024**

La explicación debe derivarse de decisiones estructuradas.

---

## **INV-C6.15-025**

Toda versión material usada debe ser inspeccionable.

---

## **INV-C6.15-026**

Los stages skipped deben tener razón.

---

## **INV-C6.15-027**

Los stages blocked deben tener razón.

---

## **INV-C6.15-028**

Degraded mode debe ser explícito.

---

## **INV-C6.15-029**

Technical alerts y business findings deben permanecer separados.

---

## **INV-C6.15-030**

La observabilidad debe soportar impacto hacia delante y trazabilidad hacia atrás junto con C6.12.

---

# **219\. VALIDACIONES MÍNIMAS**

Antes de aceptar un evento:

event\_id valid?

event type valid?

run/trace references valid?

tenant scope valid?

timestamps coherent?

component/stage valid?

reason code valid?

referenced artifacts exist?

sensitive data sanitized?

secret leakage absent?

---

# **220\. VALIDATION — AUDIT EVENT**

Debe exigir:

subject

action

actor

time

---

# **221\. VALIDATION — POLICY CHANGE**

Debe registrar:

old/new version

reason

cuando corresponda.

---

# **222\. VALIDATION — HUMAN OVERRIDE**

Debe exigir:

actor

reason

original result

override

---

# **223\. VALIDATION — FALLBACK**

Fallback sin:

reason

debe considerarse inválido.

---

# **224\. VALIDATION — RETRY**

Retry debe enlazar run previo.

---

# **225\. VALIDATION — REPLAY**

Replay debe identificar:

replay\_of\_run\_id

---

# **226\. VALIDATION — CROSS-TENANT**

Debe bloquear eventos con referencias privadas cruzadas.

---

# **227\. VALIDATION — SECRET LEAK**

Debe sanitizar o bloquear payloads que contengan credenciales.

---

# **228\. RELACIÓN CON C6.0**

C6.0 aporta:

run

trace

correlation

environment

execution mode

version manifest

---

# **229\. RELACIÓN CON C6.1**

Puede observar errores de normalización/metric mapping.

---

# **230\. RELACIÓN CON C6.2**

Puede observar:

missing context

low comparability

context fallback

---

# **231\. RELACIÓN CON C6.3**

Es clave para:

data quality incidents

source health

measurement breaks

---

# **232\. RELACIÓN CON C6.4**

Observa benchmark usage y lifecycle.

---

# **233\. RELACIÓN CON C6.5**

Observa guardrail resolution y breaches.

---

# **234\. RELACIÓN CON C6.6**

Observa policy resolution y cambios.

---

# **235\. RELACIÓN CON C6.7**

Observa selección/rechazo/fallback.

---

# **236\. RELACIÓN CON C6.8**

Observa confidence caps y evidence gaps.

---

# **237\. RELACIÓN CON C6.9**

Observa evaluations y synthesis.

---

# **238\. RELACIÓN CON C6.10**

Observa anomaly lifecycle.

---

# **239\. RELACIÓN CON C6.11**

Observa pattern lifecycle.

---

# **240\. RELACIÓN CON C6.12**

C6.12 proporciona lineage para auditoría profunda.

---

# **241\. RELACIÓN CON C6.13**

Observa Finding lifecycle.

---

# **242\. RELACIÓN CON C6.14**

Observa handoff lifecycle.

---

# **243\. RELACIÓN CON C6.16**

C6.16 validará eventos, invariantes y observabilidad esperada.

---

# **244\. RELACIÓN CON FASE 8**

Fase 8 necesitará observabilidad todavía más estricta para acciones ejecutadas.

C6.15 establece una base reutilizable.

---

# **245\. RELACIÓN CON FASE 9**

Fase 9 podrá utilizar:

run history

confidence history

finding history

outcome links

para aprender y calibrar.

---

# **246\. TESTS MÍNIMOS**

## **TEST 1 — Successful Run**

Debe generar lifecycle completo.

---

## **TEST 2 — Partial Run**

Debe diferenciarse de completed.

---

## **TEST 3 — Failed Run**

Debe registrar stage/error.

---

## **TEST 4 — Skipped Stage**

Debe indicar razón.

---

## **TEST 5 — Blocked Stage**

Debe indicar razón.

---

## **TEST 6 — Benchmark Fallback**

Debe registrarse.

---

## **TEST 7 — Policy Fallback**

Debe registrarse.

---

## **TEST 8 — Policy Conflict**

Debe quedar visible.

---

## **TEST 9 — Guardrail Unresolved**

Debe quedar visible.

---

## **TEST 10 — Confidence Cap**

Debe registrar motivo.

---

## **TEST 11 — Retry**

Debe relacionar runs.

---

## **TEST 12 — Replay**

Debe quedar etiquetado.

---

## **TEST 13 — Simulation**

No debe confundirse con live.

---

## **TEST 14 — Finding Creation**

Debe emitir evento.

---

## **TEST 15 — Finding Escalation**

Debe conservar timeline.

---

## **TEST 16 — Finding Resolution**

Debe conservar history.

---

## **TEST 17 — Handoff Failure**

Debe quedar visible.

---

## **TEST 18 — Human Override**

Debe preservar original.

---

## **TEST 19 — Policy Change**

Debe generar audit event.

---

## **TEST 20 — Run Comparison Data Change**

Debe identificar diferencia de input.

---

## **TEST 21 — Run Comparison Policy Change**

Debe identificar policy diff.

---

## **TEST 22 — Run Comparison Engine Change**

Debe identificar engine diff.

---

## **TEST 23 — Source Incident**

Debe mostrar blast radius.

---

## **TEST 24 — Cross-Tenant Event**

Debe bloquearse.

---

## **TEST 25 — Secret Redaction**

No debe persistir secretos.

---

## **TEST 26 — Broken Lineage**

Debe aparecer en observabilidad.

---

## **TEST 27 — Fallback Rate**

Debe poder calcularse.

---

## **TEST 28 — Indeterminate Rate**

Debe poder calcularse.

---

## **TEST 29 — Technical vs Business Severity**

No deben mezclarse.

---

## **TEST 30 — Admin Why Query**

Debe poder resolver Finding → run → decisions → lineage.

---

# **247\. ANTI-PATRÓN — ONLY CONSOLE LOGS**

Incorrecto:

console.log("done")

---

# **248\. ANTI-PATRÓN — FREE-TEXT DECISIONS**

Incorrecto:

"we chose this benchmark because it seemed good"

---

# **249\. ANTI-PATRÓN — SILENT FALLBACK**

Nunca.

---

# **250\. ANTI-PATRÓN — NO REJECTION TRACE**

No registrar solo el ganador.

---

# **251\. ANTI-PATRÓN — BUSINESS AND TECHNICAL STATUS MIX**

Incorrecto:

status \= critical

sin saber si es:

business critical

o:

system critical

---

# **252\. ANTI-PATRÓN — LOGGING PII**

Evitar.

---

# **253\. ANTI-PATRÓN — LOGGING SECRETS**

Prohibido.

---

# **254\. ANTI-PATRÓN — HUMAN OVERRIDE WITHOUT REASON**

No permitir.

---

# **255\. ANTI-PATRÓN — OVERWRITE AUDIT HISTORY**

Nunca.

---

# **256\. ANTI-PATRÓN — VERSION INVISIBILITY**

No poder saber qué versión produjo el resultado es inaceptable.

---

# **257\. ANTI-PATRÓN — ONLY ERROR MONITORING**

Observability debe cubrir también decisiones correctas y fallbacks.

---

# **258\. ANTI-PATRÓN — ONLY RUNTIME HEALTH**

Un sistema puede estar técnicamente sano pero producir:

80% generic benchmark fallbacks

y eso también debe verse.

---

# **259\. ANTI-PATRÓN — CHAIN-OF-THOUGHT STORAGE**

No es necesario ni deseable para auditoría.

Usar:

structured evidence  
\+  
decision records  
\+  
reason codes

---

# **260\. ACCEPTANCE CRITERIA**

Para cualquier run material debemos poder responder:

1\. ¿Cuál fue el run\_id?

2\. ¿Cuál fue el trace\_id?

3\. ¿Qué tenant/business?

4\. ¿Qué ejecución era?

5\. ¿Era live, replay o simulation?

6\. ¿Cuándo empezó?

7\. ¿Cuándo terminó?

8\. ¿Cuánto tardó?

9\. ¿Terminó completed, partial o failed?

10\. ¿Qué stages ejecutó?

11\. ¿Qué stages fallaron?

12\. ¿Qué stages fueron skipped?

13\. ¿Qué fallbacks se utilizaron?

14\. ¿Qué policies se resolvieron?

15\. ¿Hubo conflictos?

16\. ¿Qué benchmarks se seleccionaron?

17\. ¿Qué benchmarks se rechazaron?

18\. ¿Por qué?

19\. ¿Qué guardrails se resolvieron?

20\. ¿Cuáles quedaron unresolved?

21\. ¿Qué confidence caps se aplicaron?

22\. ¿Qué anomalies se detectaron?

23\. ¿Qué patterns se detectaron?

24\. ¿Qué Findings se crearon?

25\. ¿Qué Findings cambiaron?

26\. ¿Qué handoffs se crearon?

27\. ¿Qué errores ocurrieron?

28\. ¿Qué retries ocurrieron?

29\. ¿Qué versiones se utilizaron?

30\. ¿Qué configuration snapshot se utilizó?

31\. ¿Qué cambió frente a otro run?

32\. ¿Qué source incidents afectaron al resultado?

33\. ¿Puede abrirse el lineage completo?

34\. ¿Puede saberse quién modificó una policy o hizo un override?

35\. ¿Puede explicarse por qué el sistema produjo cada conclusión?

---

# **261\. DEFINITION OF DONE**

C6.15 estará formalmente definido cuando exista:

Run Observability

Stage Observability

Structured Events

Decision Events

Fallback Events

Runtime Errors

Retries

Replay Observability

Simulation Observability

Data Quality Incidents

Source Health

Policy Observability

Policy Change Audit

Benchmark Observability

Guardrail Observability

Confidence Observability

Anomaly Observability

Pattern Observability

Finding Observability

Handoff Observability

Audit Events

Actor Tracking

Human Override Audit

Run Comparison

Configuration Diff

Policy Diff

Benchmark Diff

Engine Diff

Finding Diff

Blast Radius Inspection

Technical Metrics

Quality Metrics

Fallback Metrics

Indeterminate Metrics

Admin Run View

Admin Why View

Admin Incident View

Admin Finding View

Version Inspection

Alerting Foundation

PII Minimization

Secret Redaction

Tenant Isolation

Audit Integrity

Validation Rules

Test Fixtures

---

# **262\. RESULTADO ARQUITECTÓNICO**

Sin C6.15:

User:  
¿Por qué CAC aparece crítico?

System:  
Porque supera el límite.

Con C6.15:

RUN  
RUN-882

STATUS  
Completed

DURATION  
382 ms

OBSERVATION

New Customer CAC:  
€48

REFERENCE RESOLUTION

Internal same-season benchmark:  
Selected

Peer benchmark:  
Supporting

Generic benchmark:  
Rejected

GUARDRAIL RESOLUTION

Profitability CAC:  
€43

Cash-safe CAC:  
€40

POLICY

Acquisition Economics Policy  
v4.2

EVALUATION

vs history:  
\+37%

profitability:  
breached

cash:  
critical breach

CONFIDENCE

High

SYNTHESIS

Overall status:  
Critical

Dominant condition:  
Cash guardrail

FINDING

Acquisition Economics Critical Risk

VERSIONS

Metric registry:  
v2.1

Benchmark catalog:  
v3.0

Policy bundle:  
v4.2

Evaluation engine:  
v5.1

FALLBACKS

None

ERRORS

None

Y si mañana cambia:

Run Compare

Observation:  
same

Policy:  
v4.2 → v4.3

Guardrail:  
€43 → €46

Finding:  
critical → risk

Primary cause of result difference:  
policy configuration change

Eso es verdadera observabilidad.

---

# **263\. PRINCIPIO FINAL DE C6.15**

C6.15 debe imponer:

If the system made  
a material decision,

we must be able  
to inspect it.

Y:

If the result changed,

we must be able  
to explain what changed.

Además:

OBSERVABILITY  
must cover:

success  
\+  
failure  
\+  
fallback  
\+  
uncertainty  
\+  
configuration  
\+  
decision

No únicamente errores.

Y especialmente:

AUDITABILITY  
\=  
structured facts  
\+  
versions  
\+  
decisions  
\+  
actors  
\+  
time  
\+  
evidence references

No:

"AI decided it."

---

# **264\. SALIDA FORMAL DE C6.15**

C6.15 produce conceptualmente:

OBSERVABILITY\_EVENT

RUN\_OBSERVABILITY

STAGE\_EXECUTION

DECISION\_EVENT

FALLBACK\_EVENT

RUNTIME\_ERROR

AUDIT\_EVENT

DATA\_QUALITY\_INCIDENT

y:

RUN\_COMPARISON

Estas estructuras serán utilizadas por:

Admin Panel

Operations

Engineering

Audit

Debugging

C6.16 Validation & Test Fixtures

Fase 9 Learning & Calibration

C6.15 no produce:

BUSINESS DIAGNOSIS

BUSINESS PRIORITY

STRATEGY

RECOMMENDATION

EXECUTION ACTION

---

# **C6.15 — ESTADO**

CONTRACT:  
C6.15 Observability & Audit

TYPE:  
Runtime Observability / Audit / Operations

PHASE:  
6 — Benchmarks & Guardrails

STATUS:  
Architecture Defined

IMPLEMENTATION:  
Not yet implemented

DEPENDS ON:  
C6.0 Runtime Envelope & Identity  
C6.12 Evidence, Provenance & Lineage  
C6.13 Evaluation Finding Output  
C6.14 Inter-Phase Handoff

OBSERVES:  
C6.1–C6.11 runtime behavior

NEXT CONTRACT:  
C6.16 — Validation & Test Fixtures Contract

