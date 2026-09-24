# **C6.14 — INTER-PHASE HANDOFF CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Inter-Phase Handoff Contract define cómo la Fase 6 entrega sus Findings, evidencias y restricciones a otras fases de EcomScaling IA sin invadir sus responsabilidades.

Su misión es responder:

> **¿Qué información puede salir de Fase 6, hacia qué fase puede viajar, con qué semántica y qué decisiones siguen perteneciendo al receptor?**

C6.14 constituye la frontera contractual entre:

FASE 6  
Benchmarks & Guardrails

y principalmente:

FASE 3  
Diagnóstico

FASE 4  
Priorización y Decisión

FASE 7  
Motor de Recomendaciones

---

# **2\. PROBLEMA QUE RESUELVE**

Sin C6.14 podría producirse una contaminación progresiva entre fases.

Ejemplo:

Fase 6 detecta:

Marginal CAC exceeds sustainable guardrail.

Un sistema mal diseñado podría transformarlo inmediatamente en:

Root cause:  
Meta saturation

Priority:  
P0

Recommendation:  
Reduce Meta spend 25%

En ese momento Fase 6 habría asumido responsabilidades de:

Fase 3  
Fase 4  
Fase 7

y la arquitectura dejaría de ser modular.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Cada fase debe conservar su autoridad.

Debe mantenerse:

F3:  
WHAT is happening and WHY?

F4:  
WHAT should be attacked first?

F5:  
HOW can it be solved?

F6:  
IS it healthy, risky, abnormal,  
or violating relevant limits?

F7:  
WHAT exactly should be recommended?

F8:  
WHAT may be executed or controlled?

F9:  
WHAT did we learn?

Por tanto:

F6 FINDING  
≠  
DIAGNOSIS

F6 FINDING  
≠  
PRIORITY

F6 FINDING  
≠  
RECOMMENDATION

F6 FINDING  
≠  
EXECUTION

---

# **4\. SEGUNDO PRINCIPIO**

Un handoff no debe enviar únicamente texto.

Debe transportar:

structured semantics  
\+  
evidence references  
\+  
confidence  
\+  
limitations  
\+  
phase boundaries

---

# **5\. TERCER PRINCIPIO**

El receptor no debe tener que reinterpretar desde cero todo C6.0–C6.13.

C6.14 debe crear:

purpose-specific projections

del Finding.

---

# **6\. CUARTO PRINCIPIO**

El handoff debe conservar el origen de cada afirmación.

Ejemplo:

F6 observed fact

F6 interpretation

F6 hypothesis

F3 diagnosis

F4 priority

F7 recommendation

deben poder distinguirse posteriormente.

---

# **7\. RESPONSABILIDAD**

C6.14 debe definir:

WHAT is being handed off?

FROM which phase?

TO which phase?

WHY?

WHICH findings?

WHICH evidence?

WHICH confidence?

WHICH limitations?

WHICH constraints?

WHAT may the receiver decide?

WHAT may the receiver NOT assume?

WHAT response artifact is expected?

---

# **8\. LO QUE C6.14 NO DEBE HACER**

C6.14 NO debe:

diagnose

prioritize

recommend

execute

Su función es:

package  
route  
constrain  
trace

---

# **9\. HANDOFF OBJECT**

La salida principal será conceptualmente:

INTER\_PHASE\_HANDOFF

---

# **10\. HANDOFF\_ID**

Todo handoff material debe disponer de:

handoff\_id

único.

---

# **11\. RUN RELATION**

Debe enlazar:

run\_id

trace\_id

para mantener continuidad entre fases.

---

# **12\. SOURCE PHASE**

Debe existir:

source\_phase

Para este contrato:

source\_phase \= F6

---

# **13\. TARGET PHASE**

Debe existir:

target\_phase

Principalmente:

F3

F4

F7

---

# **14\. HANDOFF TYPE**

Taxonomía inicial:

diagnostic\_handoff

prioritization\_handoff

recommendation\_handoff

validation\_request

evidence\_request

---

# **15\. DIAGNOSTIC HANDOFF**

Ruta:

F6 → F3

Pregunta:

> Hemos detectado una condición. ¿Qué está ocurriendo realmente y cuáles son las causas plausibles?

---

# **16\. PRIORITIZATION HANDOFF**

Ruta:

F6 → F4

Pregunta:

> Tenemos estos Findings. ¿Cuál debe atacarse primero considerando impacto, gravedad, confianza, urgencia y dependencias?

---

# **17\. RECOMMENDATION HANDOFF**

Ruta:

F6 → F7

Pregunta:

> Dado este Finding ya suficientemente entendido y contextualizado, ¿qué debe recomendar exactamente el sistema?

---

# **18\. VALIDATION REQUEST**

Puede utilizarse cuando:

finding\_readiness \=  
validation\_required

Ejemplo:

Potential critical inventory condition,  
but inventory source is stale.

---

# **19\. EVIDENCE REQUEST**

Puede indicar a otra fase/proceso:

additional evidence required

sin convertirlo en una recomendación de negocio.

---

# **20\. HANDOFF PAYLOAD**

Todo handoff debe poder contener:

identity

purpose

findings

scope

assessment

evidence

confidence

limitations

constraints

requested\_authority

expected\_output

---

# **21\. FINDING REFERENCES**

Debe incluir:

finding\_ids

No duplicar obligatoriamente todos los Findings completos.

---

# **22\. PRIMARY FINDINGS**

Puede existir:

primary\_finding\_ids

---

# **23\. SUPPORTING FINDINGS**

También:

supporting\_finding\_ids

---

# **24\. RELATED FINDINGS**

Puede incluir:

related\_finding\_ids

---

# **25\. HANDOFF SCOPE**

Debe conservar:

business

market

channel

device

segment

product

cohort

period

según corresponda.

---

# **26\. SOURCE FACTS**

Todo handoff puede incluir un conjunto resumido de:

facts

---

# **27\. FACT OWNERSHIP**

Los facts deben permanecer identificados como:

source \= F6  
type \= fact

si fueron materializados por Fase 6\.

---

# **28\. INTERPRETATIONS**

Puede incluir:

F6 interpretations

pero claramente etiquetadas.

---

# **29\. HYPOTHESES**

Puede incluir:

hypotheses

si existen.

Pero:

hypothesis  
≠  
diagnosis

---

# **30\. CONFIDENCE**

El handoff debe transportar:

finding confidence

claim strength

uncertainty

cuando sean relevantes.

---

# **31\. LIMITATIONS**

Las limitations deben viajar downstream.

Nunca:

Finding has limitation  
→ handoff removes limitation

---

# **32\. MISSING EVIDENCE**

Debe conservarse:

missing\_evidence

cuando pueda condicionar decisiones posteriores.

---

# **33\. VALIDATION REQUIRED**

Debe propagarse:

validation\_required

---

# **34\. READINESS**

Debe propagarse:

finding\_readiness

---

# **35\. EVIDENCE PACKAGE**

Debe incluir referencias:

evidence\_package\_ids

---

# **36\. LINEAGE REFERENCES**

Puede incluir:

lineage\_roots

sin copiar todo C6.12.

---

# **37\. HANDOFF BOUNDARY RULES**

Cada handoff debe declarar explícitamente:

allowed\_receiver\_decisions

y:

forbidden\_assumptions

---

# **38\. WHY BOUNDARY RULES MATTER**

Un agente receptor puede ser otro LLM.

No debe inferir:

severity \= critical  
therefore priority \= P0

si esa decisión pertenece a otra fase.

---

# **39\. PHASE AUTHORITY MODEL**

Debe existir conceptualmente:

PHASE\_AUTHORITY

---

# **40\. FASE 6 AUTHORITY**

Fase 6 puede ser autoridad sobre:

metric evaluation

benchmark comparison

guardrail breach

anomaly detection

pattern detection

red flag detection

evaluation confidence

evaluation evidence

evaluation limitations

---

# **41\. FASE 6 NON-AUTHORITY**

No es autoridad final sobre:

root cause

priority

strategy

recommendation

execution

---

# **42\. FASE 3 AUTHORITY**

Fase 3 puede ser autoridad sobre:

diagnostic interpretation

root-cause hypotheses

causal chains

cause confidence

según sus propios contratos.

---

# **43\. FASE 4 AUTHORITY**

Fase 4 puede ser autoridad sobre:

priority order

decision ranking

resource focus

urgency ranking

---

# **44\. FASE 7 AUTHORITY**

Fase 7 será autoridad sobre:

recommended intervention

specific recommendation

recommendation conditions

recommendation confidence

---

# **45\. FASE 8 AUTHORITY**

Fase 8 será autoridad sobre:

execution

automation

control

supervision

---

# **46\. FASE 9 AUTHORITY**

Fase 9 será autoridad sobre:

outcome learning

calibration

feedback

policy/pattern improvement proposals

---

# **47\. F6 → F3 HANDOFF**

Debe existir un payload específico:

DIAGNOSTIC\_HANDOFF

---

# **48\. PURPOSE**

Pregunta al diagnóstico:

> ¿Qué explicación causal puede producir este conjunto de Findings?

---

# **49\. REQUIRED FIELDS — F6 → F3**

Como mínimo:

handoff\_id

trace\_id

finding\_ids

finding statements

facts

interpretations

anomalies

patterns

scope

temporal context

confidence

evidence refs

limitations

---

# **50\. OPTIONAL FIELDS — F6 → F3**

hypotheses

alternative hypotheses

missing evidence

business events

context changes

---

# **51\. WHAT F3 MUST NOT ASSUME**

F3 no debe asumir:

red flag \= root cause

pattern \= root cause

correlation \= causality

severity \= causal certainty

---

# **52\. F3 REQUESTED OUTPUT**

Conceptualmente puede solicitarse:

DIAGNOSTIC\_RESULT

con:

root\_cause\_candidates

causal\_chain

diagnostic\_confidence

contradictory evidence

evidence gaps

El contrato exacto pertenece a Fase 3\.

---

# **53\. EXAMPLE — F6 → F3**

F6 entrega:

FACT

New-customer mobile CVR:  
\-29%

ANOMALY

Structural deterioration

PATTERN

Demand quality deterioration candidate

CONFIDENCE

High for deterioration

HYPOTHESIS

Mobile funnel friction may contribute.

Confidence:  
Low

F3 recibe esto.

F3 NO recibe:

Root cause:  
mobile checkout

como hecho.

---

# **54\. F6 → F4 HANDOFF**

Debe existir:

PRIORITIZATION\_HANDOFF

---

# **55\. PURPOSE**

Pregunta:

> De todos los Findings materializados, ¿cuáles deben recibir atención primero?

---

# **56\. REQUIRED FIELDS — F6 → F4**

Como mínimo:

finding\_id

finding type

scope

business status

severity

materiality

confidence

estimated impact

condition urgency

persistence

breadth

validation status

limitations

---

# **57\. WHY THESE FIELDS**

F4 necesita distinguir:

critical \+ high confidence

critical \+ low confidence

medium \+ massive impact

high severity \+ tiny scope

---

# **58\. F4 MAY ADD**

Fase 4 puede incorporar además:

strategic importance

effort

dependencies

reversibility

time sensitivity

opportunity cost

según su propio contrato.

---

# **59\. F6 MUST NOT SEND FINAL PRIORITY**

No:

priority \= P0

---

# **60\. CONDITION URGENCY IS ALLOWED**

Puede enviar:

condition\_urgency:  
immediate\_attention

cuando deriva del Finding.

Pero:

immediate\_attention  
≠  
highest portfolio priority

---

# **61\. VALIDATION PRIORITY VS BUSINESS PRIORITY**

Debe distinguirse:

validation\_urgency

de:

business\_priority

---

# **62\. EXAMPLE**

Finding A:

severity:  
critical

confidence:  
low

validation\_urgency:  
immediate

Finding B:

severity:  
high

confidence:  
high

materiality:  
very high

F4 podría decidir que:

A requires validation immediately

B is the first confirmed business intervention

---

# **63\. F4 REQUESTED OUTPUT**

Conceptualmente:

PRIORITIZATION\_RESULT

que puede añadir:

priority\_rank

priority\_class

decision rationale

dependency ordering

Eso NO forma parte de C6.14.

---

# **64\. F6 → F7 HANDOFF**

Debe existir:

RECOMMENDATION\_HANDOFF

---

# **65\. PURPOSE**

Pregunta:

> Dado lo que sabemos, ¿qué debería recomendar exactamente EcomScaling IA?

---

# **66\. IMPORTANT PRECONDITION**

F7 no debería recibir indiscriminadamente cualquier Finding.

Puede requerir:

finding\_readiness \=  
ready

o:

ready\_with\_limitations

---

# **67\. VALIDATION\_REQUIRED FINDING**

No debería producir una recomendación fuerte salvo que F7 tenga policy explícita para:

recommend validation only

---

# **68\. BLOCKED FINDING**

No debería generar intervención empresarial.

---

# **69\. REQUIRED FIELDS — F6 → F7**

Como mínimo:

finding\_id

finding statement

scope

status

severity

materiality

confidence

facts

constraints

guardrail states

patterns

anomalies

limitations

evidence refs

readiness

---

# **70\. DIAGNOSIS WHEN AVAILABLE**

F7 idealmente debería consumir también:

diagnostic result

de F3 cuando la recomendación depende de causalidad.

---

# **71\. PRIORITY WHEN AVAILABLE**

Puede consumir también F4.

Pero:

recommendation validity

y:

priority

siguen siendo conceptos distintos.

---

# **72\. CONSTRAINTS**

El handoff a F7 debe transportar:

active guardrails

hard constraints

soft constraints

business policies

cuando sean relevantes.

---

# **73\. WHY CONSTRAINTS MATTER**

Una recomendación técnicamente plausible podría violar:

cash guardrail

inventory constraint

brand policy

operational capacity

F7 debe conocerlos.

---

# **74\. RECOMMENDATION MUST NOT BE PRE-FILLED**

C6.14 no debe enviar:

recommended\_action:  
reduce budget 20%

como decisión F6.

---

# **75\. F7 REQUESTED OUTPUT**

Conceptualmente:

RECOMMENDATION\_RESULT

que podrá incluir:

recommended\_action

expected mechanism

preconditions

risks

recommendation confidence

Eso pertenece a Fase 7\.

---

# **76\. F6 DOES NOT HAND DIRECT EXECUTION TO F8**

Regla arquitectónica recomendada:

F6  
→ Finding

Finding  
→ Diagnosis / Priority / Recommendation

Recommendation  
→ F8 execution

No:

F6 critical guardrail  
→ direct campaign pause

---

# **77\. SAFETY EXCEPTION**

Futuras reglas de seguridad técnica pueden existir fuera del flujo normal.

Pero deberán ser:

explicit system safety policy

no inferencias libres de Fase 6\.

---

# **78\. F6 → F9**

Aunque el foco principal de C6.14 sea F3/F4/F7, la arquitectura debe permitir enviar a F9:

finding\_id

original status

confidence

evidence refs

subsequent lifecycle

para aprendizaje posterior.

---

# **79\. LEARNING HANDOFF**

Puede existir posteriormente:

LEARNING\_EVENT

pero no es output principal de C6.14.

---

# **80\. HANDOFF READINESS**

Todo handoff debe tener:

handoff\_readiness

---

# **81\. READINESS STATES**

Propuesta:

ready

ready\_with\_limitations

validation\_required

blocked

---

# **82\. READY**

Puede ser consumido normalmente.

---

# **83\. READY WITH LIMITATIONS**

El receptor debe preservar limitations.

---

# **84\. VALIDATION REQUIRED**

El receptor debe limitar sus conclusiones.

---

# **85\. BLOCKED**

No debe producir decisión material downstream.

---

# **86\. HANDOFF BLOCKERS**

Ejemplos:

broken evidence lineage

insufficient evidence

policy conflict

critical unresolved guardrail

semantic ambiguity

---

# **87\. HANDOFF WARNINGS**

Puede haber:

handoff\_warnings

que no bloquean.

---

# **88\. WARNING EXAMPLE**

Peer benchmark is industry-level,  
not category-specific.

---

# **89\. HANDOFF CONTRACT VERSION**

Debe existir:

handoff\_contract\_version

ya congelado conceptualmente por C6.0.

---

# **90\. PAYLOAD VERSION**

Puede existir:

payload\_version

si distintas proyecciones evolucionan.

---

# **91\. TARGET CONTRACT EXPECTATION**

Debe poder declararse:

expected\_target\_contract

Ejemplo:

F3 diagnostic contract vX

F4 prioritization contract vY

cuando la arquitectura completa exista.

---

# **92\. COMPATIBILITY**

Debe validarse:

source payload version  
↔  
receiver contract version

---

# **93\. NO SILENT SCHEMA DRIFT**

Si el receptor espera un campo con otra semántica:

handoff must fail explicitly

o adaptarse mediante versión compatible.

---

# **94\. HANDOFF IMMUTABILITY**

Un handoff ya enviado debe poder reconstruirse.

No reescribirlo silenciosamente con Findings actuales.

---

# **95\. RETRY**

Si falla el receptor:

retry

no debe cambiar el contenido lógico del handoff salvo nueva versión explícita.

---

# **96\. HANDOFF STATUS**

Estados técnicos:

created

validated

dispatched

accepted

rejected

failed

superseded

---

# **97\. ACCEPTED ≠ BUSINESS AGREEMENT**

`accepted` significa:

target phase accepted the payload

No:

human agrees with conclusion

---

# **98\. REJECTED HANDOFF**

El receptor puede rechazar si:

schema incompatible

required evidence missing

readiness blocked

tenant mismatch

---

# **99\. HANDOFF RESPONSE**

Puede existir:

handoff\_response\_ref

para enlazar output de fase receptora.

---

# **100\. TRACE CONTINUITY**

Idealmente:

same trace\_id

debe continuar a través de:

F6  
→  
F3  
→  
F4  
→  
F7

cuando representan el mismo problema lógico.

---

# **101\. NEW RUN PER PHASE**

Cada fase puede disponer de:

new run\_id

pero compartir:

trace\_id

---

# **102\. PARENT RUN**

Puede existir:

parent\_run\_id

para indicar:

F7 run  
derived from  
F4/F3/F6 runs

---

# **103\. DERIVED FROM**

Debe conservarse:

derived\_from\_run\_id

según C6.0.

---

# **104\. CROSS-PHASE LINEAGE**

C6.12 debe poder representar:

F6 Finding  
↓  
F3 Diagnosis  
↓  
F4 Priority  
↓  
F7 Recommendation

---

# **105\. AUTHORITY PROVENANCE**

Cada output debe saber:

which phase asserted which claim.

---

# **106\. EXAMPLE**

F6:  
CAC economic risk confirmed.

F3:  
Likely primary cause \= traffic quality deterioration.

F4:  
Priority \= P1.

F7:  
Recommendation \= tighten prospecting qualification.

Cada afirmación tiene un propietario distinto.

---

# **107\. NO CLAIM OWNERSHIP COLLISION**

No debería haber:

F6 root cause

F3 root cause

compitiendo como autoridades iguales.

---

# **108\. HANDOFF FACT MODEL**

Puede existir:

HANDOFF\_FACT

con:

fact\_id

source\_phase

source\_artifact

statement\_semantics

confidence

---

# **109\. HYPOTHESIS MODEL**

Igualmente:

HANDOFF\_HYPOTHESIS

debe conservar:

origin\_phase

confidence

supporting evidence

---

# **110\. CONSTRAINT MODEL**

Debe poder enviarse:

CONSTRAINT

---

# **111\. CONSTRAINT TYPES**

Ejemplos:

economic\_guardrail

cash\_constraint

inventory\_constraint

operational\_constraint

data\_constraint

policy\_constraint

---

# **112\. HARD CONSTRAINT**

Puede bloquear ciertas recomendaciones.

---

# **113\. SOFT CONSTRAINT**

Debe considerarse, pero no necesariamente bloquear.

---

# **114\. CONSTRAINT REF**

Debe enlazar a:

guardrail

policy

finding

correspondiente.

---

# **115\. F3 HANDOFF SHAPE**

Conceptualmente:

diagnostic\_handoff:

    identity:  
        handoff\_id  
        run\_id  
        trace\_id

    routing:  
        source\_phase: F6  
        target\_phase: F3  
        handoff\_type: diagnostic

    findings:  
        primary\_findings  
        supporting\_findings

    facts:  
        observed\_facts

    signals:  
        anomalies  
        patterns  
        guardrail\_breaches

    context:  
        scope  
        temporal\_context  
        business\_events

    epistemics:  
        confidence  
        hypotheses  
        alternative\_hypotheses  
        limitations  
        missing\_evidence

    evidence:  
        evidence\_package\_refs  
        lineage\_refs

    boundary:  
        forbidden\_assumptions

    expectation:  
        requested\_output: diagnostic\_result

---

# **116\. F4 HANDOFF SHAPE**

prioritization\_handoff:

    identity:  
        handoff\_id  
        run\_id  
        trace\_id

    routing:  
        source\_phase: F6  
        target\_phase: F4

    findings:  
        finding\_ids

    assessment:  
        status  
        severity  
        materiality  
        confidence  
        impact  
        persistence  
        breadth  
        condition\_urgency

    readiness:  
        validation\_required  
        blockers

    evidence:  
        evidence\_package\_refs

    boundary:  
        priority\_not\_preassigned

    expectation:  
        requested\_output: prioritization\_result

---

# **117\. F7 HANDOFF SHAPE**

recommendation\_handoff:

    identity:  
        handoff\_id  
        run\_id  
        trace\_id

    routing:  
        source\_phase: F6  
        target\_phase: F7

    findings:  
        finding\_ids

    assessment:  
        statuses  
        severity  
        materiality  
        confidence

    evidence:  
        facts  
        patterns  
        anomalies  
        evidence\_package\_refs

    constraints:  
        guardrails  
        policies  
        hard\_constraints  
        soft\_constraints

    epistemics:  
        limitations  
        assumptions  
        missing\_evidence

    readiness:  
        finding\_readiness

    boundary:  
        no\_preselected\_recommendation

    expectation:  
        requested\_output: recommendation\_result

---

# **118\. MINIMAL COMMON ENVELOPE**

Todos los handoffs deberían compartir:

handoff\_id

trace\_id

source\_phase

target\_phase

handoff\_type

finding\_refs

evidence\_refs

readiness

contract\_version

---

# **119\. TARGET-SPECIFIC EXTENSION**

Después cada destino añade campos específicos.

---

# **120\. HANDOFF REASON**

Debe existir:

handoff\_reason

---

# **121\. EXAMPLE — DIAGNOSTIC REASON**

Confirmed deterioration exists,  
but causal explanation remains uncertain.

---

# **122\. EXAMPLE — PRIORITIZATION REASON**

Multiple material Findings require ranking.

---

# **123\. EXAMPLE — RECOMMENDATION REASON**

Finding is sufficiently validated  
to consider intervention options.

---

# **124\. ROUTING POLICY**

C6.6 puede definir cuándo un Finding debe viajar a una fase.

---

# **125\. EXAMPLE ROUTING RULE**

confirmed anomaly  
\+  
medium/high materiality  
→  
eligible for diagnostic handoff

Solo ejemplo estructural.

No threshold universal.

---

# **126\. AUTO ROUTING**

Puede existir en el futuro.

Debe ser:

policy driven

---

# **127\. MANUAL ROUTING**

También debe soportarse.

---

# **128\. NO DIRECT LLM ROUTING WITHOUT TRACE**

Si una IA decide:

send to F3

debe existir reason y policy compatible.

---

# **129\. ROUTING DECISION**

Puede materializarse:

ROUTING\_DECISION

---

# **130\. ROUTING REASONS**

Ejemplos:

causal uncertainty

multiple competing hypotheses

material red flag

validated finding

requires prioritization

ready for recommendation

---

# **131\. ROUTING REJECTION**

Puede existir:

not\_ready

insufficient\_evidence

already\_routed

duplicate

receiver\_not\_applicable

---

# **132\. HANDOFF DEDUPLICATION**

No enviar el mismo Finding a F3 cada hora si no ha cambiado materialmente.

---

# **133\. HANDOFF SIGNATURE**

Puede derivarse de:

source phase

target phase

finding set

finding versions

purpose

---

# **134\. MATERIAL CHANGE RE-HANDOFF**

Nueva entrega si cambia:

severity

confidence

scope

evidence

pattern classification

readiness

materialmente.

---

# **135\. SUPERSEDED HANDOFF**

La nueva versión debe referenciar:

supersedes\_handoff\_id

---

# **136\. HANDOFF BATCH**

Puede agrupar varios Findings relacionados.

---

# **137\. BATCH EXAMPLE**

Acquisition Diagnostic Handoff:

CAC deterioration

CVR anomaly

new-customer share decline

marginal CAC breach

---

# **138\. BATCH ≠ COMPOSITE FINDING**

Puede contener varios Findings sin fusionarlos.

---

# **139\. ORDER WITHIN HANDOFF**

Puede existir:

presentation\_order

No:

priority\_order

salvo que venga explícitamente de F4.

---

# **140\. CROSS-PHASE CONTEXT**

Fases posteriores no deberían perder:

tenant

business

scope

time period

---

# **141\. NO CROSS-TENANT HANDOFF**

Regla absoluta:

tenant A finding  
cannot be handed to  
tenant B workflow.

---

# **142\. PERMISSION CHECK**

El receptor debe tener acceso al business/evidence correspondiente.

---

# **143\. MINIMUM DATA PRINCIPLE**

El handoff debe transportar solo la información necesaria.

---

# **144\. DO NOT COPY RAW CUSTOMER DATA**

Normalmente bastan:

aggregates

refs

evidence package

---

# **145\. SENSITIVE DATA**

Debe respetar clasificación y permisos.

---

# **146\. HANDOFF AUDIT**

Debe registrarse:

who/what initiated

when

source run

target phase

payload version

accept/reject result

---

# **147\. HANDOFF EXPLANATION**

Admin debe poder preguntar:

> ¿Por qué este Finding llegó a F7?

---

# **148\. EXAMPLE ANSWER**

Finding readiness:  
ready

Confidence:  
high

Lineage:  
complete

Diagnostic dependency:  
satisfied

Routing policy:  
recommendation eligible

---

# **149\. WHY NOT F7**

También:

> ¿Por qué no generamos recomendación?

Ejemplo:

Finding:  
validation\_required

Reason:  
inventory source stale

Therefore:  
recommendation handoff blocked

---

# **150\. PHASE DEPENDENCIES**

Una recomendación puede exigir diagnóstico previo.

Debe poder declararse:

requires\_phase3\_output \= true

---

# **151\. PRIORITY DEPENDENCY**

Puede existir:

requires\_phase4\_output

si el workflow concreto exige que solo Findings priorizados lleguen a recomendaciones.

---

# **152\. NO UNIVERSAL WORKFLOW ASSUMPTION**

No todas las recomendaciones necesitan necesariamente F3 \+ F4 completos.

Ejemplo:

Un problema determinista:

tracking configuration broken

puede requerir flujo diferente.

Debe ser configurable.

---

# **153\. WORKFLOW PROFILE**

Puede existir:

workflow\_profile\_id

que determine secuencia.

---

# **154\. EXAMPLE PROFILE**

diagnostic\_required

prioritization\_required

recommendation\_allowed

---

# **155\. PHASE RESPONSE LINK**

Cuando F3 responda:

diagnostic\_result\_id

debe vincularse al handoff.

---

# **156\. SAME FOR F4**

prioritization\_result\_id

---

# **157\. SAME FOR F7**

recommendation\_result\_id

---

# **158\. ROUND-TRIP**

Puede ocurrir:

F6 → F3

y F3 responde:

Need more evidence.

Entonces puede generarse un nuevo proceso de validación.

---

# **159\. EVIDENCE FEEDBACK**

Debe poder existir:

EVIDENCE\_REQUEST

---

# **160\. EVIDENCE REQUEST CONTENT**

needed evidence

reason

claim affected

urgency

---

# **161\. F3 MUST NOT MUTATE F6 FINDING**

F3 puede crear un diagnóstico relacionado.

No editar silenciosamente el Finding original.

---

# **162\. F4 MUST NOT MUTATE F6 SEVERITY**

Puede usarla.

No reescribir su significado.

Si necesita otra evaluación:

create F4 artifact

---

# **163\. F7 MUST NOT MUTATE F6 EVIDENCE**

Debe referenciarla.

---

# **164\. PHASE ARTIFACT IMMUTABILITY**

Cada fase es propietaria de sus artefactos.

---

# **165\. CROSS-PHASE CORRECTION**

Si F3 descubre que una assumption de F6 era falsa:

new evidence  
→  
new/reassessed F6 Finding

en lugar de editarlo desde F3.

---

# **166\. FEEDBACK LOOP**

Conceptualmente:

F6 Finding  
↓  
F3 Diagnosis  
↓  
new evidence  
↓  
F6 Reevaluation

debe ser posible.

---

# **167\. NO CIRCULAR AUTHORITY**

El feedback puede crear nuevas evaluaciones.

Pero no ciclos opacos donde:

F6 trusts F3  
because F3 trusts F6

sin evidencia independiente.

---

# **168\. AUTHORITY SOURCE**

Cada claim debe seguir indicando:

authoritative\_phase

---

# **169\. EXAMPLE FULL FLOW**

F6:

Finding:  
New-customer CVR structural deterioration.

Confidence:  
high.

F3:

Diagnosis:  
Most likely friction occurs on product-page → cart transition.

Confidence:  
medium.

F4:

Priority:  
P1.

F7:

Recommendation:  
Investigate and test product-page purchase-friction interventions.

Cada capa mantiene su propiedad.

---

# **170\. F6 HYPOTHESIS PASS-THROUGH**

Una hypothesis F6 puede viajar a F3.

Pero debe llevar:

origin \= F6

type \= hypothesis

confidence \= low/medium/etc.

---

# **171\. F3 MAY CONFIRM OR REJECT**

Después puede producir:

supported

rejected

alternative

sin cambiar el registro histórico de F6.

---

# **172\. PRIORITIZATION INPUT SHOULD BE FINDINGS, NOT RAW METRICS**

F4 no debería necesitar recalcular F6.

Debe consumir Findings normalizados.

---

# **173\. RECOMMENDATION INPUT SHOULD NOT RELY ON SUMMARY TEXT ONLY**

F7 necesita:

structured finding

constraints

evidence

diagnosis when applicable

---

# **174\. HANDOFF FAILURE**

Debe existir:

HANDOFF\_ERROR

---

# **175\. ERROR TYPES**

Ejemplos:

target\_contract\_incompatible

finding\_not\_ready

evidence\_missing

tenant\_mismatch

permission\_denied

payload\_invalid

dependency\_missing

---

# **176\. PARTIAL HANDOFF**

Puede existir cuando varios Findings forman un batch y algunos están bloqueados.

Debe quedar explícito.

---

# **177\. NO SILENT DROPPING**

Si un Finding no se entrega:

rejection\_reason

obligatoria.

---

# **178\. HANDOFF OBSERVABILITY**

C6.15 registrará:

handoff counts

failures

retries

acceptance

latency

---

# **179\. HANDOFF LINEAGE**

C6.12 debe registrar:

Finding  
→  
Handoff  
→  
Downstream artifact

---

# **180\. HANDOFF TESTABILITY**

C6.16 deberá verificar límites de fase.

---

# **181\. FORBIDDEN-FIELD TESTS**

Especialmente:

F6→F4 payload  
must not contain final priority

F6→F7 payload  
must not contain final recommendation

F6→F3 payload  
must not contain unverified root cause

---

# **182\. HANDOFF SHAPE — COMMON**

Conceptualmente:

inter\_phase\_handoff:

    identity:  
        handoff\_id  
        run\_id  
        trace\_id  
        handoff\_contract\_version

    routing:  
        source\_phase  
        target\_phase  
        handoff\_type  
        handoff\_reason

    scope:  
        tenant\_id  
        business\_id  
        context\_scope  
        temporal\_scope

    findings:  
        primary\_finding\_ids  
        supporting\_finding\_ids  
        related\_finding\_ids

    assessment:  
        status\_summary  
        severity\_summary  
        materiality\_summary  
        confidence\_summary

    epistemics:  
        limitations  
        assumptions  
        missing\_evidence  
        validation\_required

    evidence:  
        evidence\_package\_ids  
        lineage\_roots

    constraints:  
        hard\_constraints  
        soft\_constraints

    readiness:  
        handoff\_readiness  
        blockers  
        warnings

    boundaries:  
        source\_authority  
        target\_authority  
        forbidden\_assumptions

    expectations:  
        requested\_output\_type

    lifecycle:  
        status  
        supersedes\_handoff\_id  
        handoff\_signature

---

# **183\. EXAMPLE — F6 → F3**

HANDOFF

Source:  
F6

Target:  
F3

Purpose:  
Diagnostic investigation

Finding:

New-customer mobile CVR  
has structurally deteriorated.

Evidence:

\-29% vs seasonally comparable baseline

5-week persistence

tracking quality high

mix effect insufficient to explain decline

Confidence:

High for deterioration

Hypotheses:

Mobile funnel friction:  
Low confidence

Traffic quality deterioration:  
Medium confidence

Boundary:

No root cause confirmed by F6.

Requested output:

Diagnostic cause candidates  
\+  
cause confidence  
\+  
additional evidence required

---

# **184\. EXAMPLE — F6 → F4**

Findings:

A:  
Critical cash guardrail breach  
confidence high

B:  
Potential stockout  
severity critical  
confidence low

C:  
Conversion deterioration  
severity high  
confidence high

F6 does NOT output:

A \= P0  
C \= P1  
B \= P2

F4 receives structured data and makes that decision.

---

# **185\. EXAMPLE — F6 → F7**

Finding:

Growth Quality Deterioration

Facts:

Revenue \+22%

Contribution/order \-18%

Refund rate \+14%

Pattern:

growth\_quality\_deterioration

Constraints:

minimum contribution guardrail

cash policy

Confidence:

High

Diagnosis from F3 if available:

High discount dependency  
supported with medium confidence.

F7 must decide:

what intervention to recommend.

---

# **186\. EXAMPLE — BLOCKED RECOMMENDATION HANDOFF**

Finding:

Potential inventory stockout

Severity:

critical

Confidence:

low

Inventory feed:

22h stale

Result:

F6 → F7:  
blocked

Reason:

validation required before strong recommendation.

Possible route:

validation workflow

---

# **187\. EXAMPLE — DIRECT PRIORITIZATION ELIGIBLE**

Finding:

Cash guardrail critical breach

Data quality:

high

Confidence:

high

Materiality:

critical

Can be:

ready for F4

without F6 deciding its rank.

---

# **188\. INVARIANTES C6.14**

## **INV-C6.14-001**

Todo handoff debe identificar source phase y target phase.

---

## **INV-C6.14-002**

Todo handoff debe tener propósito.

---

## **INV-C6.14-003**

Todo handoff material debe estar ligado a Findings.

---

## **INV-C6.14-004**

Todo handoff debe mantener trace\_id.

---

## **INV-C6.14-005**

F6→F3 no debe presentar hypotheses como root causes confirmados.

---

## **INV-C6.14-006**

F6→F4 no debe asignar final business priority.

---

## **INV-C6.14-007**

F6→F7 no debe incluir final recommended action como autoridad F6.

---

## **INV-C6.14-008**

F6 no debe producir direct execution handoff a F8 en el flujo normal.

---

## **INV-C6.14-009**

Limitations deben propagarse downstream.

---

## **INV-C6.14-010**

Missing evidence material debe propagarse.

---

## **INV-C6.14-011**

Confidence debe propagarse.

---

## **INV-C6.14-012**

Finding readiness debe respetarse.

---

## **INV-C6.14-013**

Blocked Finding no debe convertirse silenciosamente en recomendación.

---

## **INV-C6.14-014**

Cross-tenant handoffs están prohibidos.

---

## **INV-C6.14-015**

Handoff no concede acceso a evidencia no autorizada.

---

## **INV-C6.14-016**

Cada claim debe conservar su phase of authority.

---

## **INV-C6.14-017**

Receiver no debe mutar artefactos del source phase.

---

## **INV-C6.14-018**

Nueva evidencia debe generar reevaluation, no reescritura silenciosa.

---

## **INV-C6.14-019**

Technical urgency y business priority deben permanecer separadas.

---

## **INV-C6.14-020**

Handoff text no debe sustituir los campos estructurados.

---

## **INV-C6.14-021**

Toda rejection debe tener razón.

---

## **INV-C6.14-022**

Todo handoff histórico debe ser reconstruible.

---

## **INV-C6.14-023**

Schema incompatibility debe fallar explícitamente.

---

## **INV-C6.14-024**

Un retry no debe cambiar silenciosamente la semántica del payload.

---

## **INV-C6.14-025**

Un handoff superseded debe permanecer auditable.

---

## **INV-C6.14-026**

Handoff batch no debe borrar Findings individuales.

---

## **INV-C6.14-027**

RAG knowledge no debe viajar como si fuera business fact.

---

## **INV-C6.14-028**

Constraints deben conservar su origen.

---

## **INV-C6.14-029**

Guardrail breach enviado a F7 no es recomendación implícita.

---

## **INV-C6.14-030**

Phase boundaries deben ser testables automáticamente.

---

# **189\. VALIDACIONES MÍNIMAS**

Antes de emitir un handoff:

handoff\_id valid?

source phase valid?

target phase valid?

handoff type compatible?

findings exist?

findings belong to same tenant?

receiver has access?

readiness sufficient?

required evidence present?

limitations propagated?

confidence present?

forbidden fields absent?

target contract compatible?

trace\_id valid?

payload version valid?

---

# **190\. VALIDATION — F6 → F3**

Debe bloquear:

root\_cause\_confirmed

si no procede de autoridad diagnóstica válida.

---

# **191\. VALIDATION — F6 → F4**

Debe bloquear:

priority\_rank

P0

P1

P2

como outputs F6.

---

# **192\. VALIDATION — F6 → F7**

Debe bloquear:

recommended\_action

como decisión autoritativa F6.

---

# **193\. VALIDATION — READINESS**

Si:

finding\_readiness \= blocked

no debe entregarse como `ready`.

---

# **194\. VALIDATION — LIMITATIONS**

Si Finding contiene limitation material:

handoff must contain it

---

# **195\. VALIDATION — TENANT**

Todos los artefactos referenciados deben corresponder al tenant autorizado.

---

# **196\. VALIDATION — TRACE**

Todo downstream artifact debe poder vincularse al origen.

---

# **197\. RELACIÓN CON C6.0**

C6.0 aporta:

run

trace

tenant

business

parent/derived relationships

versions

---

# **198\. RELACIÓN CON C6.1–C6.11**

Estos contratos producen la sustancia técnica que termina materializada en Findings.

C6.14 no debería exponerlos directamente salvo necesidad.

---

# **199\. RELACIÓN CON C6.12**

C6.12 permite mantener:

cross-phase evidence lineage

---

# **200\. RELACIÓN CON C6.13**

C6.13 es la principal fuente de C6.14.

Principio:

C6.13  
\=  
what Phase 6 found

C6.14  
\=  
how Phase 6 communicates it

---

# **201\. RELACIÓN CON C6.15**

C6.15 observará:

handoff creation

routing

failure

retry

acceptance

rejection

latency

---

# **202\. RELACIÓN CON C6.16**

C6.16 verificará:

phase authority boundaries

forbidden fields

readiness

schema compatibility

---

# **203\. RELACIÓN CON FASE 3**

F3 recibe:

evaluated evidence

y devuelve:

diagnostic reasoning

---

# **204\. RELACIÓN CON FASE 4**

F4 recibe:

evaluated Findings

y devuelve:

priority decisions

---

# **205\. RELACIÓN CON FASE 7**

F7 recibe:

validated condition  
\+  
constraints  
\+  
diagnosis where necessary

y devuelve:

specific recommendation

---

# **206\. RELACIÓN CON FASE 8**

F8 debe recibir principalmente:

recommendations / approved decisions

no Findings F6 como órdenes directas.

---

# **207\. RELACIÓN CON FASE 9**

F9 podrá relacionar:

original Finding  
→ diagnosis  
→ priority  
→ recommendation  
→ execution  
→ outcome

---

# **208\. TESTS MÍNIMOS**

## **TEST 1 — Valid F6→F3**

Debe transportar facts/anomalies/patterns sin root cause inventado.

---

## **TEST 2 — Hypothesis To F3**

Debe conservar hypothesis label y confidence.

---

## **TEST 3 — Valid F6→F4**

Debe transportar severity/materiality/confidence sin priority.

---

## **TEST 4 — Forbidden Priority**

Debe fallar si F6 envía `P0`.

---

## **TEST 5 — Valid F6→F7**

Debe transportar Findings \+ constraints.

---

## **TEST 6 — Forbidden Recommendation**

Debe fallar si F6 preselecciona action.

---

## **TEST 7 — Blocked Finding**

No debe pasar como recommendation-ready.

---

## **TEST 8 — Validation Required**

Debe propagarse.

---

## **TEST 9 — Limitations**

No deben perderse.

---

## **TEST 10 — Missing Evidence**

Debe propagarse.

---

## **TEST 11 — Cross-Tenant**

Debe bloquearse.

---

## **TEST 12 — Trace Continuity**

Downstream artifact debe conservar trace.

---

## **TEST 13 — New Phase Run**

Puede tener run nuevo \+ same trace.

---

## **TEST 14 — Handoff Rejection**

Debe guardar reason.

---

## **TEST 15 — Retry**

Debe conservar payload lógico.

---

## **TEST 16 — Schema Version Mismatch**

Debe fallar explícitamente.

---

## **TEST 17 — Batch Handoff**

Debe conservar Findings individuales.

---

## **TEST 18 — Duplicate Routing**

Debe deduplicarse.

---

## **TEST 19 — Material Change**

Debe permitir nuevo handoff.

---

## **TEST 20 — Superseded Handoff**

Anterior debe seguir recuperable.

---

## **TEST 21 — F3 Feedback**

Nueva evidence request debe relacionarse con handoff original.

---

## **TEST 22 — F3 Cannot Mutate Finding**

Debe producir nuevo diagnostic artifact.

---

## **TEST 23 — F4 Cannot Mutate Severity**

Debe producir prioridad separada.

---

## **TEST 24 — F7 Cannot Mutate Evidence**

Debe referenciarla.

---

## **TEST 25 — Constraint Propagation**

Guardrails y policies deben llegar correctamente.

---

## **TEST 26 — Recommendation Dependency**

Si workflow exige diagnosis, F7 handoff debe bloquearse si falta.

---

## **TEST 27 — No Raw PII**

Handoff no debe copiar datos personales innecesarios.

---

## **TEST 28 — Historical Reconstruction**

Debe reconstruir qué payload recibió cada fase.

---

# **209\. ANTI-PATRÓN — GIANT SHARED OBJECT**

Incorrecto hacer que todas las fases compartan un objeto gigantesco y mutable.

---

# **210\. ANTI-PATRÓN — TEXT-ONLY HANDOFF**

Incorrecto:

"Something looks wrong with CAC.  
Please investigate."

como única interfaz.

---

# **211\. ANTI-PATRÓN — F6 DIAGNOSES**

Incorrecto:

root cause \= creative fatigue

en handoff F6.

---

# **212\. ANTI-PATRÓN — F6 PRIORITIZES**

Incorrecto:

P0

---

# **213\. ANTI-PATRÓN — F6 RECOMMENDS**

Incorrecto:

lower spend 20%

---

# **214\. ANTI-PATRÓN — DIRECT F6 EXECUTION**

Incorrecto:

critical finding  
→  
pause campaign automatically

sin F7/F8 y policies correspondientes.

---

# **215\. ANTI-PATRÓN — LIMITATION LOSS**

Incorrecto:

F6 confidence low

pero F7 recibe únicamente:

critical problem

---

# **216\. ANTI-PATRÓN — HYPOTHESIS PROMOTION**

Incorrecto:

F6 hypothesis  
→  
F3 fact

---

# **217\. ANTI-PATRÓN — RECEIVER MUTATION**

Cada fase debe crear sus propios artefactos.

---

# **218\. ANTI-PATRÓN — NO TRACE**

No permitir:

recommendation

sin poder saber de qué Finding nació.

---

# **219\. ANTI-PATRÓN — CROSS-TENANT HANDOFF**

Prohibido.

---

# **220\. ANTI-PATRÓN — ROUTING BY PLAN QUALITY**

No:

Growth gets basic diagnosis

Scale gets advanced diagnosis

si la diferencia comercial actual no implica distinta inteligencia.

---

# **221\. ACCEPTANCE CRITERIA**

Para cualquier handoff debemos poder responder:

1\. ¿Cuál es el handoff\_id?

2\. ¿Qué run lo generó?

3\. ¿Qué trace mantiene?

4\. ¿Desde qué fase sale?

5\. ¿A qué fase llega?

6\. ¿Qué tipo de handoff es?

7\. ¿Por qué se creó?

8\. ¿Qué Findings contiene?

9\. ¿Qué Finding es primario?

10\. ¿Qué scope afecta?

11\. ¿Qué facts transporta?

12\. ¿Qué interpretations transporta?

13\. ¿Qué hypotheses transporta?

14\. ¿Con qué confidence?

15\. ¿Qué limitations transporta?

16\. ¿Qué evidence falta?

17\. ¿Qué evidence packages referencia?

18\. ¿Qué constraints transporta?

19\. ¿Está ready?

20\. ¿Está blocked?

21\. ¿Qué warnings tiene?

22\. ¿Qué autoridad conserva F6?

23\. ¿Qué autoridad corresponde al receptor?

24\. ¿Qué assumptions están prohibidas?

25\. ¿Qué output se espera del receptor?

26\. ¿Qué versión contractual utiliza?

27\. ¿El receptor es compatible?

28\. ¿Fue aceptado o rechazado?

29\. ¿Se reintentó?

30\. ¿Fue superseded?

31\. ¿Puede reconstruirse el payload exacto?

32\. ¿Puede enlazarse el output downstream con el Finding original?

---

# **222\. DEFINITION OF DONE**

C6.14 estará formalmente definido cuando exista:

Inter-Phase Handoff Identity

Common Handoff Envelope

Source Phase

Target Phase

Handoff Types

Diagnostic Handoff

Prioritization Handoff

Recommendation Handoff

Validation Request

Evidence Request

Finding Projection

Facts

Interpretations

Hypotheses

Evidence References

Lineage References

Confidence Propagation

Limitations Propagation

Missing Evidence Propagation

Constraint Propagation

Finding Readiness

Handoff Readiness

Blockers

Warnings

Phase Authority Model

Forbidden Assumptions

Requested Output

Target Contract Compatibility

Trace Continuity

Cross-Phase Run Relationships

Routing Rules

Routing Decisions

Deduplication

Batch Handoffs

Retry

Rejection

Supersession

Response Linkage

Feedback Loops

Tenant Isolation

Permission Checks

Data Minimization

Validation Rules

Test Fixtures

---

# **223\. RESULTADO ARQUITECTÓNICO**

Antes de C6.14 podríamos tener:

F6 Finding:

Unsafe acquisition scaling conditions.

Severity:  
Critical.

Confidence:  
High.

y dejar que cada agente interprete libremente qué hacer.

Después de C6.14:

F6 FINDING

Unsafe Acquisition Scaling Conditions

F6 → F3

Purpose:  
Determine causal explanation.

Facts:  
Marginal CAC critical breach.  
Cash risk.  
Inventory warning.

Pattern:  
Unsafe Scaling.

Confidence:  
High.

Boundary:  
No root cause asserted.

F6 → F4

Purpose:  
Prioritize among active Findings.

Severity:  
Critical.

Materiality:  
High.

Confidence:  
High.

Urgency:  
Immediate attention.

Boundary:  
No priority preassigned.

F6 → F7

Purpose:  
Generate appropriate intervention.

Constraints:  
Marginal CAC guardrail.  
Cash guardrail.  
Inventory headroom.  
Operational capacity.

Readiness:  
Ready after diagnostic requirements are satisfied.

Boundary:  
No recommendation preselected.

Ahora cada fase sabe exactamente:

WHAT it receives

WHAT it may trust

WHAT it may decide

WHAT it must not assume.

---

# **224\. PRINCIPIO FINAL DE C6.14**

C6.14 debe imponer:

A phase should provide  
the evidence and conclusions  
it owns.

It should not make  
the decisions owned  
by another phase.

Por tanto:

F6 evaluates.

F3 diagnoses.

F4 prioritizes.

F7 recommends.

F8 executes.

F9 learns.

Y:

Every cross-phase claim  
must preserve:

origin  
\+  
authority  
\+  
evidence  
\+  
confidence  
\+  
limitations.

Además:

No phase boundary  
should depend on  
free-text interpretation alone.

---

# **225\. SALIDA FORMAL DE C6.14**

C6.14 produce conceptualmente:

INTER\_PHASE\_HANDOFF

con especializaciones:

DIAGNOSTIC\_HANDOFF

PRIORITIZATION\_HANDOFF

RECOMMENDATION\_HANDOFF

VALIDATION\_REQUEST

EVIDENCE\_REQUEST

y puede producir:

ROUTING\_DECISION

Estas salidas serán observadas y auditadas por:

C6.15 — Observability & Audit

y verificadas por:

C6.16 — Validation & Test Fixtures

C6.14 no produce:

ROOT CAUSE

PRIORITY

STRATEGY

PLAYBOOK

RECOMMENDED ACTION

EXECUTION

---

# **C6.14 — ESTADO**

CONTRACT:  
C6.14 Inter-Phase Handoff

TYPE:  
Phase Boundary / Integration Contract

PHASE:  
6 — Benchmarks & Guardrails

STATUS:  
Architecture Defined

IMPLEMENTATION:  
Not yet implemented

DEPENDS ON:  
C6.0 Runtime Envelope & Identity  
C6.8 Confidence & Uncertainty  
C6.12 Evidence, Provenance & Lineage  
C6.13 Evaluation Finding Output

CONSUMES INDIRECTLY:  
C6.1–C6.11 through Findings and Evidence Packages

PRIMARY TARGETS:  
Fase 3 — Diagnóstico  
Fase 4 — Priorización y Decisión  
Fase 7 — Motor de Recomendaciones

NEXT CONTRACT:  
C6.15 — Observability & Audit Contract

