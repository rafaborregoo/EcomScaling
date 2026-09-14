# **C6.7 — REFERENCE & POLICY RESOLUTION CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Reference & Policy Resolution Contract define cómo EcomScaling IA determina qué referencias, benchmarks, guardrails y policies deben participar realmente en una evaluación concreta.

Su misión es responder:

> **De todas las referencias y reglas disponibles, ¿cuáles aplican a esta observación, cuáles no y por qué?**

Hasta C6.6 disponemos de:

C6.0  
Runtime identity

C6.1  
Metric semantics

C6.2  
Context \+ comparability

C6.3  
Data quality

C6.4  
Benchmark references

C6.5  
Guardrail definitions

C6.6  
Policies \+ configuration

C6.7 debe unir esas piezas.

---

# **2\. PROBLEMA QUE RESUELVE**

Un ecommerce puede disponer simultáneamente de:

historical benchmark

same-season benchmark

internal cohort benchmark

peer benchmark

industry benchmark

generic ecommerce benchmark

business target

profitability guardrail

cash guardrail

scale guardrail

tenant policy

business override

market override

No todas estas referencias son igualmente válidas para cada evaluación.

Sin C6.7, el sistema podría escoger arbitrariamente:

el primer benchmark encontrado

o:

el benchmark con el valor más cercano

o incluso:

el benchmark que el LLM considere mejor

Eso sería inaceptable.

---

# **3\. PRINCIPIO FUNDAMENTAL**

La selección de una referencia debe ser una decisión explícita y reconstruible.

Invariante:

No selected reference  
without resolution trace.

Debemos poder responder:

¿Qué candidatos existían?

¿Cuáles fueron elegibles?

¿Cuáles se descartaron?

¿Por qué?

¿Qué policy se aplicó?

¿Qué criterio decidió?

¿Qué fallback se utilizó?

¿Qué calidad tenía cada alternativa?

---

# **4\. SEGUNDO PRINCIPIO**

El resolver no debe elegir simplemente:

the most specific reference

ni:

the biggest sample

ni:

the newest reference

Debe equilibrar:

semantic compatibility

context comparability

data quality

reference type

policy preference

methodological strength

temporal relevance

sample sufficiency

applicability

tenant configuration

---

# **5\. TERCER PRINCIPIO**

Debe preservarse la jerarquía conceptual:

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

Pero esta jerarquía NO significa:

always choose the first available.

Una referencia interna puede ser peor que una peer reference si:

context incompatible

tracking broken

definition changed

sample insufficient

---

# **6\. RESPONSABILIDAD**

C6.7 debe determinar:

WHAT candidates exist?

WHICH are semantically eligible?

WHICH are contextually comparable?

WHICH satisfy quality requirements?

WHICH policies apply?

WHICH guardrails apply?

WHICH reference hierarchy applies?

WHICH candidate should be primary?

WHICH candidates should remain supporting?

WHICH must be rejected?

WHICH fallback was used?

WHY was each decision taken?

---

# **7\. LO QUE C6.7 NO DEBE HACER**

C6.7 NO debe determinar todavía:

good

bad

healthy

risk

critical

Tampoco debe:

diagnose root cause

assign business priority

select playbook

recommend actions

Su salida es:

resolved evaluation inputs

No la evaluación final.

---

# **8\. RESOLUTION OBJECT**

La salida principal será conceptualmente:

REFERENCE\_POLICY\_RESOLUTION

---

# **9\. RESOLUTION\_ID**

Toda resolución material debe disponer de:

resolution\_id

único.

---

# **10\. RUN RELATION**

Debe estar vinculada a:

run\_id

trace\_id

de C6.0.

---

# **11\. SUBJECT OBSERVATION**

Toda resolución debe tener un sujeto.

Ejemplo:

observation\_id:  
obs\_cac\_2026\_08

---

# **12\. RESOLUTION PURPOSE**

Debe conocerse el propósito.

Ejemplos:

benchmark\_evaluation

guardrail\_evaluation

historical\_comparison

scale\_analysis

anomaly\_baseline

cohort\_evaluation

---

# **13\. PURPOSE MATTERS**

Una referencia válida para:

descriptive benchmarking

puede no ser válida para:

economic scale decision

Ejemplo:

industry average CAC

puede orientar.

Pero no sustituir:

maximum sustainable marginal CAC

para evaluar escalabilidad.

---

# **14\. CANDIDATE GENERATION**

Primera etapa:

candidate\_generation

Debe recuperar potencialmente:

benchmark candidates

guardrail candidates

policy candidates

---

# **15\. BENCHMARK CANDIDATE**

Cada benchmark candidato debe referenciar:

benchmark\_id

benchmark\_version

---

# **16\. GUARDRAIL CANDIDATE**

Debe referenciar:

guardrail\_id

guardrail\_version

---

# **17\. POLICY CANDIDATE**

Debe referenciar:

policy\_id

policy\_version

---

# **18\. CANDIDATE ≠ SELECTED**

Regla:

available  
≠  
eligible  
≠  
selected

---

# **19\. RESOLUTION PIPELINE**

Pipeline conceptual:

Observation  
    ↓  
Semantic Eligibility  
    ↓  
Scope Matching  
    ↓  
Context Matching  
    ↓  
Quality Filtering  
    ↓  
Policy Resolution  
    ↓  
Reference Ranking  
    ↓  
Guardrail Resolution  
    ↓  
Conflict Resolution  
    ↓  
Primary / Supporting Selection  
    ↓  
Resolution Result

---

# **20\. STEP 1 — SEMANTIC ELIGIBILITY**

C6.1 determina la identidad semántica.

C6.7 debe eliminar referencias incompatibles.

Ejemplo:

Subject:  
marginal new-customer CAC

Referencia:

average blended CAC

No debe asumirse equivalencia.

---

# **21\. SEMANTIC MATCH STATUS**

Valores conceptuales:

exact

compatible

partial

incompatible

unknown

---

# **22\. EXACT**

Las dimensiones semánticas críticas coinciden.

---

# **23\. COMPATIBLE**

Existen diferencias menores que no impiden el uso.

---

# **24\. PARTIAL**

Puede utilizarse únicamente con limitaciones.

---

# **25\. INCOMPATIBLE**

Debe descartarse para ese propósito.

---

# **26\. UNKNOWN**

No existe información suficiente.

---

# **27\. SEMANTIC BLOCKERS**

Ejemplos:

average vs marginal

observed vs predicted

attributed vs incremental

gross vs net revenue

sessions vs users denominator

cuando la equivalencia sea crítica.

---

# **28\. STEP 2 — SCOPE MATCHING**

Debe comprobarse:

tenant

business

market

segment

channel

product

customer type

---

# **29\. PRIVATE SCOPE**

Una referencia privada de:

Tenant A

nunca debe ser candidata válida para:

Tenant B

---

# **30\. BUSINESS-SPECIFIC REFERENCE**

Solo debe participar si:

business\_id matches

o existe una policy explícita de herencia.

---

# **31\. MARKET SCOPE**

Una referencia de:

Germany

puede quedar:

not\_applicable

para España.

O ser comparabilidad parcial si una policy lo permite.

---

# **32\. STEP 3 — CONTEXT COMPARABILITY**

Debe consumir C6.2.

Cada benchmark candidato puede tener:

comparability\_assessment\_id

---

# **33\. MINIMUM COMPARABILITY**

La policy puede exigir:

minimum\_comparability

según propósito.

Ejemplo:

descriptive benchmark:  
low permitted

economic decision:  
medium/high required

---

# **34\. HARD CONTEXT BLOCKER**

Si C6.2 devuelve:

incompatible

el benchmark debe descartarse.

---

# **35\. SOFT CONTEXT DIFFERENCE**

Si devuelve:

medium

puede mantenerse como supporting reference.

---

# **36\. STEP 4 — DATA QUALITY FILTERING**

Debe consumir C6.3.

---

# **37\. MINIMUM QUALITY**

La policy puede establecer:

minimum\_data\_quality

---

# **38\. QUALITY BLOCKER**

Si:

data\_quality \= insufficient

la referencia puede quedar descartada.

---

# **39\. LOW QUALITY REFERENCE**

Puede mantenerse como:

weak supporting evidence

si la policy lo permite.

---

# **40\. QUALITY VS COMPARABILITY**

Debe evitarse pensar:

high quality  
\=  
best reference

Ejemplo:

Generic benchmark:  
quality high  
comparability low

vs:

Internal benchmark:  
quality medium  
comparability high

El resolver debe considerar ambas dimensiones.

---

# **41\. STEP 5 — POLICY RESOLUTION**

C6.6 entrega:

effective policy snapshot

C6.7 debe utilizarlo como autoridad de configuración.

---

# **42\. POLICY CAN DEFINE**

Por ejemplo:

preferred benchmark hierarchy

allowed benchmark types

minimum quality

minimum comparability

maximum benchmark age

required guardrails

fallback behavior

---

# **43\. POLICY IS NOT OPTIONAL WHEN REQUIRED**

Si una evaluación requiere:

tenant-specific economic policy

y no existe:

do not invent it.

---

# **44\. STEP 6 — REFERENCE CLASS PRIORITY**

El resolver debe considerar `reference_type`.

Jerarquía inicial conceptual:

own\_economics

comparable\_internal\_history

internal\_cohort

internal\_segment

peer\_group

industry

generic

---

# **45\. HIERARCHY IS POLICY-CONTROLLED**

La jerarquía debe poder configurarse.

No codificarse en múltiples servicios.

---

# **46\. EXACT INTERNAL HISTORY**

Ejemplo:

same metric

same market

same customer type

same season

same business

normalmente será referencia muy fuerte.

---

# **47\. INTERNAL HISTORY WITH MEASUREMENT BREAK**

Puede perder prioridad si:

tracking definition changed

---

# **48\. PEER REFERENCE**

Puede superar una referencia interna si:

internal data quality insufficient

---

# **49\. INDUSTRY REFERENCE**

Puede servir como:

secondary context

aunque exista una referencia interna primaria.

---

# **50\. MULTI-REFERENCE RESOLUTION**

C6.7 NO debe obligar siempre a seleccionar un único benchmark.

Puede producir:

primary reference

supporting references

---

# **51\. PRIMARY REFERENCE**

Representa la referencia principal utilizada para la comparación.

---

# **52\. SUPPORTING REFERENCES**

Aportan contexto adicional.

Ejemplo:

Primary:  
same-season internal CAC

Supporting:  
peer group CAC distribution  
industry CAC

---

# **53\. CONTRADICTORY REFERENCES**

También puede ocurrir:

Internal benchmark:  
€35

Peer median:  
€50

Industry:  
€55

C6.7 no debe esconder la divergencia.

---

# **54\. REFERENCE DISAGREEMENT**

Debe poder producir:

reference\_disagreement

---

# **55\. DISAGREEMENT STATUS**

Ejemplos:

none

minor

material

strong

---

# **56\. DISAGREEMENT DOES NOT MEAN ERROR**

Puede reflejar:

business uniqueness

different economics

different market

different maturity

---

# **57\. RESOLUTION MAY PRESERVE MULTIPLE VIEWS**

C6.9 podrá posteriormente decir:

better than peers  
but worse than internal history

Esto es más inteligente que obligar a un único juicio.

---

# **58\. BENCHMARK ROLE**

Cada referencia seleccionada puede tener:

primary

supporting

sanity\_check

fallback

---

# **59\. SANITY CHECK**

Una referencia genérica puede servir únicamente como:

sanity\_check

sin controlar el status principal.

---

# **60\. FALLBACK REFERENCE**

Debe identificarse explícitamente.

Nunca ocultar que se utilizó una referencia más débil.

---

# **61\. FALLBACK CHAIN**

Ejemplo:

same-season internal  
    ↓ unavailable

internal recent  
    ↓ incompatible

peer  
    ↓ selected

industry  
    ↓ supporting

---

# **62\. FALLBACK REASON**

Debe guardarse:

fallback\_reason

---

# **63\. NO AVAILABLE REFERENCE**

Debe poder producir:

no\_reference\_resolved

---

# **64\. NO FORCED BENCHMARK**

Regla:

No sufficiently valid benchmark  
\=  
no benchmark comparison.

No:

use generic because something is required.

---

# **65\. STEP 7 — GUARDRAIL RESOLUTION**

Separadamente debemos determinar:

which guardrails apply?

---

# **66\. MULTIPLE GUARDRAILS**

Una métrica puede tener:

economic guardrail

cash guardrail

risk guardrail

scale guardrail

simultáneamente.

---

# **67\. GUARDRAIL SEMANTIC ELIGIBILITY**

Debe respetar C6.1.

Ejemplo:

marginal CAC guardrail

no debe aplicarse a:

average CAC

sin policy explícita.

---

# **68\. GUARDRAIL CONTEXT MATCHING**

Debe considerar:

tenant

business

market

customer type

product

channel

maturity

---

# **69\. GUARDRAIL POLICY MATCHING**

Debe utilizar el effective policy de C6.6.

---

# **70\. GUARDRAIL RESOLUTION STATUS**

Para cada candidato:

resolved

partially\_resolved

unresolved

not\_applicable

---

# **71\. REQUIRED GUARDRAIL**

La policy puede exigir:

required\_guardrail \= true

Ejemplo:

Una scale evaluation puede exigir:

marginal CAC guardrail

cash guardrail

inventory guardrail

---

# **72\. MISSING REQUIRED GUARDRAIL**

Si falta uno crítico:

resolution\_status \=  
incomplete

o:

blocked

según policy.

---

# **73\. GUARDRAIL DEPENDENCY**

Un guardrail puede depender de:

resolved economics

configuration

other guardrails

C6.7 debe garantizar que sus dependencias están disponibles.

---

# **74\. DERIVED GUARDRAIL**

Ejemplo:

maximum sustainable CAC

puede tener que calcularse antes de seleccionarse.

---

# **75\. GUARDRAIL CONFLICT**

Dos guardrails pueden parecer contradictorios.

Ejemplo:

Profitability max CAC:  
€50

Cash max CAC:  
€42

No es necesariamente conflicto.

Protegen objetivos distintos.

---

# **76\. MULTIPLE CONSTRAINTS**

El resolver debe conservar ambos.

Posteriormente C6.9 puede comprobar ambos.

---

# **77\. TRUE GUARDRAIL CONFLICT**

Ejemplo:

Dos versiones activas del mismo:

cash\_guardrail

para mismo scope:

€42

€48

sin precedencia clara.

Eso sí es conflicto.

---

# **78\. POLICY PRECEDENCE RESOLUTION**

Debe utilizar C6.6.

No decidir localmente.

---

# **79\. STEP 8 — RANKING**

Después de filtros puede quedar más de un benchmark válido.

Debe existir ranking estructurado.

---

# **80\. RANKING DIMENSIONS**

Propuesta:

semantic\_match

comparability

data\_quality

reference\_priority

temporal\_relevance

methodological\_strength

sample\_strength

specificity

policy\_preference

---

# **81\. RANKING IS NOT SIMPLE AVERAGE**

No hacer:

score \=  
average(all dimensions)

necesariamente.

Una incompatibilidad crítica no debe compensarse con otros scores altos.

---

# **82\. GATING BEFORE SCORING**

Primero:

eligibility gates

Después:

ranking

---

# **83\. GATING EXAMPLE**

semantic incompatibility  
→ reject

aunque:

sample \= excellent

---

# **84\. RANKING SCORE**

Puede existir:

resolution\_score

para ordenar candidatos elegibles.

---

# **85\. EXPLAINABLE SCORE**

Si existe, debe poder descomponerse.

Ejemplo:

semantic match: 1.00

comparability: 0.92

quality: 0.85

recency: 0.95

policy preference: 1.00

---

# **86\. NO OPAQUE AI RANKING**

No queremos:

LLM says benchmark B looks best.

sin criterios.

---

# **87\. DETERMINISTIC CORE**

La resolución principal debería ser:

deterministic

cuando sea posible.

---

# **88\. AI ASSISTANCE**

Un modelo de IA puede ayudar a interpretar:

unstructured methodology

external benchmark metadata

context descriptions

pero el resultado debe transformarse en campos estructurados antes de la resolución final.

---

# **89\. LLM MUST NOT BYPASS POLICY**

Nunca:

LLM chooses benchmark X

si:

policy forbids benchmark X.

---

# **90\. TIE**

Dos referencias pueden obtener igual prioridad.

Debe existir:

tie\_resolution\_strategy

---

# **91\. TIE STRATEGIES**

Ejemplos:

prefer internal

prefer higher quality

prefer more recent

prefer larger sample

use both

manual review

según policy.

---

# **92\. USE BOTH**

En muchos casos:

use both

será mejor que elegir arbitrariamente.

---

# **93\. REFERENCE SET**

Puede existir:

RESOLVED\_REFERENCE\_SET

---

# **94\. REFERENCE SET CONTENT**

Ejemplo:

primary\_reference

supporting\_references

sanity\_check\_references

rejected\_references

---

# **95\. REJECTED REFERENCES**

Deben conservarse, al menos como IDs \+ razones, para auditoría.

---

# **96\. REJECTION REASON CODES**

Ejemplos:

RR\_SEMANTIC\_INCOMPATIBILITY

RR\_SCOPE\_MISMATCH

RR\_LOW\_COMPARABILITY

RR\_INSUFFICIENT\_QUALITY

RR\_EXPIRED

RR\_POLICY\_FORBIDDEN

RR\_SUPERSEDED

RR\_PRIVACY\_RESTRICTED

RR\_MISSING\_CONTEXT

---

# **97\. SELECTION REASON CODES**

Ejemplos:

RS\_INTERNAL\_EXACT\_MATCH

RS\_POLICY\_PREFERRED

RS\_HIGHEST\_COMPARABILITY

RS\_HIGHEST\_VALID\_QUALITY

RS\_ONLY\_ELIGIBLE\_REFERENCE

RS\_FALLBACK\_PEER

RS\_MULTI\_REFERENCE\_CONTEXT

---

# **98\. GUARDRAIL REJECTION REASONS**

Ejemplos:

GR\_SCOPE\_MISMATCH

GR\_SEMANTIC\_MISMATCH

GR\_UNRESOLVED\_THRESHOLD

GR\_EXPIRED

GR\_SUPERSEDED

GR\_POLICY\_NOT\_APPLICABLE

---

# **99\. RESOLUTION STATUS**

La resolución completa puede tener:

resolved

resolved\_with\_limitations

resolved\_with\_fallback

partially\_resolved

conflict

blocked

unresolved

---

# **100\. RESOLVED**

Todas las piezas necesarias están disponibles.

---

# **101\. RESOLVED WITH LIMITATIONS**

Existe solución válida, pero con limitaciones relevantes.

---

# **102\. RESOLVED WITH FALLBACK**

Se utilizó una opción inferior en la jerarquía.

---

# **103\. PARTIALLY RESOLVED**

Algunas referencias/guardrails están disponibles y otras no.

---

# **104\. CONFLICT**

Existen reglas incompatibles sin estrategia clara.

---

# **105\. BLOCKED**

La policy impide continuar.

---

# **106\. UNRESOLVED**

No existe solución suficiente.

---

# **107\. BLOCKING REASONS**

Ejemplos:

no valid semantic reference

required guardrail missing

policy conflict

critical quality failure

tenant configuration missing

---

# **108\. RESOLUTION LIMITATIONS**

Debe poder producir:

limitations

Ejemplo:

No internal seasonal benchmark available.  
Peer benchmark used as primary reference.

---

# **109\. RESOLUTION ASSUMPTIONS**

Si se necesita asumir algo:

assumptions

debe quedar explícito.

---

# **110\. NO HIDDEN ASSUMPTIONS**

Nunca:

assume Germany behaves like Spain

sin registrarlo.

---

# **111\. REFERENCE AGE**

La antigüedad debe participar en la resolución cuando la policy lo indique.

---

# **112\. MAXIMUM REFERENCE AGE**

Policy puede definir:

maximum\_reference\_age

---

# **113\. EXPIRED REFERENCE**

Puede conservarse para:

historical replay

pero no para nuevas evaluaciones.

---

# **114\. TIME ALIGNMENT**

Debe verificarse que subject/reference tengan ventanas temporales compatibles.

---

# **115\. SEASONAL ALIGNMENT**

Ejemplo:

Black Friday 2026

puede preferir:

Black Friday 2025

sobre:

October 2026

aunque octubre sea más reciente.

---

# **116\. RECENCY ≠ ALWAYS BETTER**

Regla:

more recent  
≠  
more comparable

---

# **117\. INTERNAL ECONOMICS RESOLUTION**

Cuando exista:

own economic reference

y sea válido, debe tener prioridad alta para preguntas de sostenibilidad.

---

# **118\. OWN ECONOMICS ≠ PEER BENCHMARK**

Para:

Can we afford CAC \= €48?

la referencia crítica probablemente sea:

own sustainable CAC

no:

peer median CAC

---

# **119\. MULTI-QUESTION RESOLUTION**

Una misma observación puede requerir varias referencias porque responde varias preguntas.

Ejemplo:

CAC €48.

Pregunta 1:

Are we deteriorating?

Referencia:

internal history

Pregunta 2:

Are we competitive?

Referencia:

peer group

Pregunta 3:

Is it sustainable?

Referencia:

own economics guardrail

---

# **120\. REFERENCE ROLE BY QUESTION**

Debe existir:

reference\_role

Ejemplos:

historical\_baseline

peer\_context

economic\_limit

target\_context

sanity\_check

---

# **121\. THIS IS CRITICAL**

No queremos que C6.9 produzca:

CAC is good

como juicio único.

Puede producir posteriormente:

vs history:  
worse

vs peers:  
better

vs economics:  
unsafe

C6.7 debe preparar esta posibilidad.

---

# **122\. RESOLUTION CONTEXT**

Debe poder conocer:

evaluation\_question

---

# **123\. EVALUATION QUESTION TYPES**

Ejemplos:

historical\_health

peer\_position

economic\_sustainability

target\_attainment

risk\_boundary

scalability

---

# **124\. TARGET RESOLUTION**

Aunque:

target \!= benchmark

puede existir una referencia target para:

target attainment

Debe conservar semántica diferente.

---

# **125\. TARGET CANNOT BECOME PEER BENCHMARK**

Nunca mezclar.

---

# **126\. BENCHMARK CANNOT BECOME GUARDRAIL**

Igualmente.

---

# **127\. GUARDRAIL CANNOT BECOME TARGET**

Son roles distintos.

---

# **128\. RESOLVED EVALUATION INPUT**

Una de las salidas centrales será:

RESOLVED\_EVALUATION\_INPUT

---

# **129\. CONTENT**

Debe incluir:

observation

context

data quality

effective policy

primary references

supporting references

applicable guardrails

limitations

resolution trace

---

# **130\. CONCEPTUAL SHAPE**

resolved\_evaluation\_input:

    identity:  
        resolution\_id  
        run\_id  
        observation\_id

    purpose:  
        evaluation\_question  
        resolution\_purpose

    policy:  
        effective\_policy\_snapshot\_id

    benchmarks:  
        primary  
        supporting  
        sanity\_checks

    guardrails:  
        applicable  
        unresolved  
        rejected

    quality:  
        subject\_quality  
        reference\_quality

    comparability:  
        assessments

    resolution:  
        status  
        fallback\_used  
        limitations  
        assumptions

    trace:  
        candidates\_considered  
        selections  
        rejections  
        reasons

---

# **131\. REFERENCE CANDIDATE SHAPE**

reference\_candidate:

    benchmark\_id  
    benchmark\_version

    semantic\_match

    scope\_match

    comparability

    quality

    temporal\_relevance

    methodology\_strength

    policy\_preference

    eligibility\_status

    resolution\_score

    role

    rejection\_reason

---

# **132\. GUARDRAIL CANDIDATE SHAPE**

guardrail\_candidate:

    guardrail\_id  
    guardrail\_version

    semantic\_match

    context\_match

    policy\_match

    threshold\_resolution\_status

    quality

    applicability

    required

    eligibility\_status

    rejection\_reason

---

# **133\. EXAMPLE — CAC**

Subject:

average new-customer CAC  
Spain  
Meta  
August 2026  
€48

Available references:

A.  
Internal same-season CAC  
€37

B.  
Internal last-month CAC  
€43

C.  
Spanish fashion peer median  
€51

D.  
Global ecommerce median  
€46

Resolver may produce:

Primary:  
A

Supporting:  
B  
C

Sanity check:  
D

Why:

A:  
highest contextual comparability

B:  
high internal relevance, weaker seasonality match

C:  
useful peer positioning

D:  
generic fallback context only

---

# **134\. EXAMPLE — ECONOMICS**

Available guardrails:

Profitability CAC:  
€52

Cash CAC:  
€44

Scale marginal CAC:  
not applicable to average CAC

Resolved:

Profitability guardrail:  
applicable

Cash guardrail:  
applicable

Scale marginal CAC:  
rejected semantic mismatch

---

# **135\. EXAMPLE — NO INTERNAL HISTORY**

New business.

Available:

internal:  
none

peer:  
high comparability

industry:  
medium comparability

generic:  
low comparability

Result:

primary:  
peer

supporting:  
industry

sanity\_check:  
generic

status:  
resolved\_with\_fallback

---

# **136\. EXAMPLE — POOR PEER QUALITY**

Peer benchmark:

comparability:  
high

quality:  
insufficient

Industry:

comparability:  
medium

quality:  
high

Policy may resolve:

industry \= primary

peer \= rejected / supporting only

depending on minimum quality.

---

# **137\. EXAMPLE — CONTRADICTORY REFERENCES**

Internal history:  
CAC €35

Peer median:  
CAC €51

Industry:  
CAC €53

The resolver should not erase this discrepancy.

Output:

reference\_disagreement:  
material

---

# **138\. EXAMPLE — GUARDRAIL MISSING**

Scale analysis requires:

marginal CAC guardrail

cash guardrail

inventory guardrail

Available:

marginal CAC:  
resolved

cash:  
resolved

inventory:  
unresolved

Policy:

all three required

Result:

resolution\_status:  
blocked

reason:  
required guardrail unresolved

---

# **139\. EXAMPLE — POLICY CONFLICT**

Two active policies:

same tenant

same metric

same market

same priority

different benchmark hierarchy

Result:

resolution\_status:  
conflict

No benchmark should be chosen arbitrarily.

---

# **140\. INVARIANTES C6.7**

## **INV-C6.7-001**

Toda resolución debe tener `resolution_id`.

---

## **INV-C6.7-002**

Toda resolución debe estar vinculada a una observación.

---

## **INV-C6.7-003**

Toda resolución debe conocer su propósito.

---

## **INV-C6.7-004**

Available no significa eligible.

---

## **INV-C6.7-005**

Eligible no significa selected.

---

## **INV-C6.7-006**

La incompatibilidad semántica crítica bloquea una referencia.

---

## **INV-C6.7-007**

Una referencia contextualmente incompatible no puede convertirse en primary.

---

## **INV-C6.7-008**

Quality insufficient puede bloquear según policy.

---

## **INV-C6.7-009**

No seleccionar referencias prohibidas por policy.

---

## **INV-C6.7-010**

No resolver conflictos de forma arbitraria.

---

## **INV-C6.7-011**

Debe poder existir `unresolved`.

---

## **INV-C6.7-012**

Debe poder existir `blocked`.

---

## **INV-C6.7-013**

Todo fallback debe declararse.

---

## **INV-C6.7-014**

Todo candidato rechazado material debe tener razón.

---

## **INV-C6.7-015**

La selección debe ser reconstruible.

---

## **INV-C6.7-016**

Internal no significa automáticamente primary.

---

## **INV-C6.7-017**

Generic no debe desplazar referencias mejores.

---

## **INV-C6.7-018**

Most specific no significa automáticamente best.

---

## **INV-C6.7-019**

Largest sample no significa automáticamente best.

---

## **INV-C6.7-020**

Most recent no significa automáticamente best.

---

## **INV-C6.7-021**

Un benchmark y un guardrail nunca deben fusionarse semánticamente.

---

## **INV-C6.7-022**

Un target y un benchmark nunca deben fusionarse.

---

## **INV-C6.7-023**

Puede existir más de una referencia seleccionada.

---

## **INV-C6.7-024**

Puede existir más de un guardrail aplicable.

---

## **INV-C6.7-025**

Una referencia débil puede mantenerse como supporting sin gobernar el juicio principal.

---

## **INV-C6.7-026**

La resolución debe respetar tenant isolation.

---

## **INV-C6.7-027**

Historical replay debe utilizar catálogos y policies históricos.

---

## **INV-C6.7-028**

El LLM no puede saltarse policies estructuradas.

---

## **INV-C6.7-029**

El ranking debe ejecutarse después de eligibility gates.

---

## **INV-C6.7-030**

No forzar una referencia si ninguna es suficientemente válida.

---

# **141\. VALIDACIONES MÍNIMAS**

Antes de cerrar una resolución:

observation valid?

purpose defined?

metric semantics known?

context available?

quality available?

effective policy available?

candidates version-valid?

tenant scope valid?

semantic eligibility checked?

comparability checked?

quality gates checked?

policy restrictions checked?

guardrail dependencies checked?

conflicts resolved?

fallback disclosed?

rejection reasons recorded?

---

# **142\. VALIDACIÓN DE PRIMARY**

Un benchmark primary debe ser:

eligible

policy-allowed

semantically compatible

sufficiently comparable

sufficiently reliable

---

# **143\. VALIDACIÓN DE SUPPORTING**

Puede tolerar requisitos inferiores según policy.

---

# **144\. VALIDACIÓN DE REQUIRED GUARDRAILS**

Si uno obligatorio falta:

cannot silently continue

---

# **145\. VALIDACIÓN DE HISTORICAL REPLAY**

No utilizar automáticamente:

current benchmark catalog

current policy

si la ejecución histórica requiere versiones anteriores.

---

# **146\. VALIDACIÓN DE CROSS-TENANT**

Nunca incluir candidatos privados de otro tenant.

---

# **147\. VALIDACIÓN DE DEPRECATED**

No seleccionar referencias deprecated para nuevos runs salvo policy explícita.

---

# **148\. VALIDACIÓN DE EXPIRED**

No seleccionar fuera de effective window.

---

# **149\. VALIDACIÓN DE ROLE**

Una referencia seleccionada debe tener rol explícito:

primary

supporting

sanity\_check

fallback

---

# **150\. RELACIÓN CON C6.0**

C6.0 proporciona:

run

tenant

business

catalog versions

configuration snapshot

---

# **151\. RELACIÓN CON C6.1**

C6.1 define las compatibilidades semánticas.

---

# **152\. RELACIÓN CON C6.2**

C6.2 aporta:

comparability assessments

---

# **153\. RELACIÓN CON C6.3**

C6.3 aporta:

data quality

evidence strength

limitations

---

# **154\. RELACIÓN CON C6.4**

C6.4 aporta:

benchmark candidates

---

# **155\. RELACIÓN CON C6.5**

C6.5 aporta:

guardrail candidates

---

# **156\. RELACIÓN CON C6.6**

C6.6 aporta:

effective policy  
precedence  
fallback rules  
quality requirements

---

# **157\. RELACIÓN CON C6.8**

C6.8 utilizará la resolución para determinar:

benchmark confidence

comparison confidence

guardrail confidence

---

# **158\. RELACIÓN CON C6.9**

C6.9 recibirá:

RESOLVED\_EVALUATION\_INPUT

como entrada principal.

Esto es importante:

C6.9 no debería volver a elegir arbitrariamente benchmarks.

---

# **159\. RELACIÓN CON C6.10**

C6.10 podrá solicitar:

historical baseline resolution

para detección de anomalías.

---

# **160\. RELACIÓN CON C6.11**

C6.11 podrá combinar evaluaciones que ya utilizaron referencias resueltas.

---

# **161\. RELACIÓN CON C6.12**

C6.12 debe reconstruir:

candidate  
→ eligibility  
→ ranking  
→ selection  
→ rejection

---

# **162\. RELACIÓN CON C6.13**

Los findings podrán decir:

primary\_reference\_id

supporting\_reference\_ids

guardrail\_ids

---

# **163\. RELACIÓN CON C6.15**

El panel admin debe poder preguntar:

¿Por qué se utilizó este benchmark?

¿Qué alternativas existían?

¿Por qué se descartó el benchmark interno?

¿Hubo fallback?

¿Qué guardrails se resolvieron?

¿Qué policy decidió la selección?

---

# **164\. TESTS MÍNIMOS**

## **TEST 1 — Exact Internal Reference**

Debe preferirse cuando cumple semántica, contexto, calidad y policy.

---

## **TEST 2 — Internal Low Quality**

No debe seleccionarse automáticamente.

---

## **TEST 3 — Peer Fallback**

Debe seleccionarse si la referencia interna no es válida.

---

## **TEST 4 — Generic Fallback**

Debe poder usarse únicamente si policy lo permite.

---

## **TEST 5 — No Valid Reference**

Debe producir unresolved.

---

## **TEST 6 — Average vs Marginal**

Debe rechazar incompatibilidad.

---

## **TEST 7 — Attributed vs Incremental**

Debe rechazar o degradar según propósito.

---

## **TEST 8 — Observed vs Predicted**

Debe respetar semántica.

---

## **TEST 9 — High Comparability, Low Quality**

Debe considerar ambas dimensiones.

---

## **TEST 10 — Low Comparability, High Quality**

No debe convertirla automáticamente en primary.

---

## **TEST 11 — Same-Season vs Recent**

Debe poder preferir same-season aunque sea menos reciente.

---

## **TEST 12 — Multiple References**

Debe soportar primary \+ supporting.

---

## **TEST 13 — Reference Disagreement**

Debe conservar divergencia.

---

## **TEST 14 — Multiple Guardrails**

Debe soportar economics \+ cash \+ scale simultáneamente.

---

## **TEST 15 — Missing Required Guardrail**

Debe bloquear cuando policy lo exija.

---

## **TEST 16 — Policy Conflict**

Debe producir conflict.

---

## **TEST 17 — Cross-Tenant Candidate**

Debe descartarlo.

---

## **TEST 18 — Deprecated Benchmark**

Debe descartarlo para nuevos runs.

---

## **TEST 19 — Historical Replay**

Debe utilizar versiones históricas.

---

## **TEST 20 — Rejection Trace**

Todo candidato material descartado debe indicar motivo.

---

## **TEST 21 — Tie**

Debe aplicar tie strategy.

---

## **TEST 22 — LLM Suggestion Against Policy**

Debe ignorarse.

---

## **TEST 23 — Benchmark vs Guardrail**

Debe mantener ambos roles.

---

## **TEST 24 — Benchmark vs Target**

Debe mantener ambos roles.

---

## **TEST 25 — Evaluation Question**

La misma observación debe poder resolver referencias distintas para:

peer\_position

economic\_sustainability

historical\_health

---

# **165\. ANTI-PATRÓN — FIRST RESULT WINS**

Incorrecto:

SELECT \* FROM benchmarks  
LIMIT 1

---

# **166\. ANTI-PATRÓN — MOST RECENT ALWAYS WINS**

Incorrecto si destruye comparabilidad estacional.

---

# **167\. ANTI-PATRÓN — MOST SPECIFIC ALWAYS WINS**

Puede tener muestra insuficiente.

---

# **168\. ANTI-PATRÓN — BIGGEST SAMPLE ALWAYS WINS**

Puede ser demasiado genérico.

---

# **169\. ANTI-PATRÓN — INTERNAL ALWAYS WINS**

El dato interno puede estar roto.

---

# **170\. ANTI-PATRÓN — BENCHMARK ONLY**

No evaluar sostenibilidad económica solo con benchmarks.

---

# **171\. ANTI-PATRÓN — GUARDRAIL ONLY**

No utilizar un guardrail como sustitución del contexto descriptivo cuando ambas cosas aportan información distinta.

---

# **172\. ANTI-PATRÓN — ONE REFERENCE ONLY**

Obligar siempre a una única referencia elimina contexto valioso.

---

# **173\. ANTI-PATRÓN — HIDE DISAGREEMENT**

Si:

internal history says poor

peers say good

debemos conservar ambas perspectivas.

---

# **174\. ANTI-PATRÓN — SILENT FALLBACK**

Nunca usar generic benchmark sin revelar que fue fallback.

---

# **175\. ANTI-PATRÓN — LLM AS FINAL RESOLVER**

El modelo puede asistir.

No debe sustituir:

policy

eligibility

precedence

structured resolution

---

# **176\. ANTI-PATRÓN — RE-RANK AFTER EVALUATION**

No debemos elegir el benchmark que produzca la conclusión deseada.

La referencia debe resolverse antes de evaluar performance.

---

# **177\. ANTI-PATRÓN — CHERRY PICKING**

Nunca:

choose benchmark that makes store look best

o:

choose benchmark that makes store look worst

---

# **178\. ACCEPTANCE CRITERIA**

Para cualquier resolución debemos poder responder:

1\. ¿Qué observación estamos resolviendo?

2\. ¿Para qué pregunta?

3\. ¿Qué benchmarks estaban disponibles?

4\. ¿Qué guardrails estaban disponibles?

5\. ¿Qué policies estaban disponibles?

6\. ¿Qué candidatos eran semánticamente compatibles?

7\. ¿Cuáles eran contextualmente comparables?

8\. ¿Qué calidad tenía cada uno?

9\. ¿Qué policy controló la selección?

10\. ¿Qué jerarquía de referencias se aplicó?

11\. ¿Cuál fue el primary benchmark?

12\. ¿Qué supporting benchmarks quedaron?

13\. ¿Qué sanity checks quedaron?

14\. ¿Qué candidatos fueron rechazados?

15\. ¿Por qué se rechazó cada uno?

16\. ¿Se utilizó fallback?

17\. ¿Por qué?

18\. ¿Qué guardrails fueron aplicables?

19\. ¿Cuáles no aplicaron?

20\. ¿Cuáles quedaron unresolved?

21\. ¿Había algún guardrail obligatorio ausente?

22\. ¿Existían conflictos?

23\. ¿Cómo se resolvieron?

24\. ¿Existía desacuerdo entre referencias?

25\. ¿Cuál es el resolution status?

26\. ¿Qué limitaciones permanecen?

27\. ¿Qué assumptions fueron necesarias?

28\. ¿Puede reconstruirse completamente la decisión?

---

# **179\. DEFINITION OF DONE**

C6.7 estará formalmente definido cuando exista:

Resolution Identity

Resolution Purpose

Candidate Generation

Benchmark Candidates

Guardrail Candidates

Policy Candidates

Semantic Eligibility

Scope Matching

Comparability Filtering

Quality Filtering

Policy Enforcement

Reference Hierarchy

Reference Ranking

Eligibility Gates

Primary Reference

Supporting References

Sanity Check References

Fallback References

Multi-Reference Support

Reference Disagreement

Guardrail Resolution

Required Guardrails

Guardrail Dependencies

Guardrail Conflicts

Tie Resolution

Rejection Reason Codes

Selection Reason Codes

Fallback Reasoning

Resolution Status

Blocking Conditions

Resolution Limitations

Resolution Assumptions

Resolution Trace

Resolved Reference Set

Resolved Evaluation Input

Historical Resolution

Validation Rules

Test Fixtures

---

# **180\. RESULTADO ARQUITECTÓNICO**

Antes de C6.7:

CAC \= €48

Available:  
internal CAC €35  
recent CAC €43  
peer CAC €51  
industry CAC €54  
sustainable CAC €45  
cash CAC €41

Después de C6.7:

Observation:  
New Customer Average CAC  
Spain  
€48

QUESTION:  
Historical Health

Primary:  
Same-season internal CAC \= €35

Supporting:  
Recent internal CAC \= €43

QUESTION:  
Peer Position

Primary:  
Peer CAC median \= €51

Supporting:  
Industry CAC \= €54

QUESTION:  
Economic Sustainability

Guardrail:  
Sustainable CAC \= €45

Additional Guardrail:  
Cash-safe CAC \= €41

Rejected:  
Marginal scale CAC

Reason:  
Observation is average CAC,  
not marginal CAC.

C6.7 todavía NO dice:

CAC is good

CAC is bad

CAC is critical

Pero ha preparado exactamente las comparaciones válidas que C6.9 deberá ejecutar.

---

# **181\. PRINCIPIO FINAL DE C6.7**

C6.7 debe imponer:

The existence of a benchmark  
does not mean  
it should be used.

Y:

The existence of a guardrail  
does not mean  
it applies.

Y:

Reference selection  
must occur before  
performance interpretation.

Además:

No arbitrary benchmark selection.

No silent fallback.

No cherry picking.

No hidden rejection.

No policy bypass.

La secuencia correcta es:

AVAILABLE  
↓  
ELIGIBLE  
↓  
COMPARABLE  
↓  
RELIABLE  
↓  
POLICY-ALLOWED  
↓  
RESOLVED  
↓  
EVALUATED

---

# **182\. SALIDA FORMAL DE C6.7**

C6.7 produce conceptualmente:

REFERENCE\_POLICY\_RESOLUTION

RESOLVED\_REFERENCE\_SET

RESOLVED\_GUARDRAIL\_SET

y principalmente:

RESOLVED\_EVALUATION\_INPUT

que será consumido por:

C6.8 — Confidence & Uncertainty

C6.9 — Benchmark Evaluation

C6.10 — Anomaly Detection

C6.11 — Pattern & Red Flag Detection

C6.12 — Evidence & Lineage

C6.13 — Evaluation Finding

C6.7 no produce:

FINAL PERFORMANCE STATUS

SEVERITY

ROOT CAUSE

BUSINESS PRIORITY

STRATEGY

PLAYBOOK

RECOMMENDATION

EXECUTION ACTION

---

# **C6.7 — ESTADO**

CONTRACT:  
C6.7 Reference & Policy Resolution

TYPE:  
Resolution Engine / Evaluation Input Preparation

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

NEXT CONTRACT:  
C6.8 — Confidence & Uncertainty Contract

