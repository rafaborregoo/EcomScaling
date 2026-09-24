# **C6.9 — BENCHMARK EVALUATION CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Benchmark Evaluation Contract define cómo EcomScaling IA transforma una observación contextualizada, fiable y correctamente resuelta contra referencias y guardrails en una evaluación estructurada.

Su misión es responder:

> **¿Qué significa esta observación respecto a su contexto, benchmarks, objetivos y límites aplicables?**

C6.9 es el núcleo evaluador de la Fase 6\.

Hasta este punto el sistema ya conoce:

C6.0  
Quién ejecuta, para qué tenant/business y con qué versiones.

C6.1  
Qué métrica estamos observando exactamente.

C6.2  
En qué contexto existe y contra qué es comparable.

C6.3  
Qué calidad tienen los datos.

C6.4  
Qué benchmarks existen.

C6.5  
Qué guardrails existen.

C6.6  
Qué policies están activas.

C6.7  
Qué referencias y guardrails aplican realmente.

C6.8  
Qué nivel de confianza permite la evidencia.

C6.9 utiliza todas esas piezas para producir:

EVALUATION

---

# **2\. PROBLEMA QUE RESUELVE**

Sin C6.9 el sistema dispondría de mucha información estructurada pero seguiría sin convertirla en una conclusión operacionalmente consumible.

Ejemplo:

CAC observado:  
€48

Historical benchmark:  
€35

Peer median:  
€51

Maximum sustainable CAC:  
€43

Cash-safe CAC:  
€40

El sistema necesita poder expresar:

vs\_history:  
deteriorated

vs\_peers:  
better\_than\_reference

vs\_economics:  
risk

vs\_cash:  
critical

y posteriormente sintetizar:

overall\_status:  
risk

sin perder ninguna de las perspectivas anteriores.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Una métrica no puede convertirse directamente en:

good  
bad

por su valor aislado.

La evaluación debe depender conceptualmente de:

evaluation \=  
f(  
    observation,  
    context,  
    historical\_baseline,  
    comparable\_references,  
    economics,  
    trend,  
    guardrails,  
    evidence\_quality,  
    uncertainty,  
    policy  
)

Por tanto:

metric value  
≠  
evaluation

---

# **4\. SEGUNDO PRINCIPIO**

C6.9 debe poder responder:

indeterminate

cuando la evidencia no permita un juicio fiable.

Nunca:

missing evidence  
→  
guess status

---

# **5\. TERCER PRINCIPIO**

La evaluación debe preservar perspectivas distintas.

Ejemplo:

CAC \= €48

puede ser simultáneamente:

worse than internal history

better than peer median

above profitability guardrail

above cash guardrail

No debemos obligar al sistema a perder esta información para producir una única etiqueta.

---

# **6\. CUARTO PRINCIPIO**

Debe mantenerse:

STATUS  
≠  
SEVERITY  
≠  
CONFIDENCE  
≠  
IMPACT  
≠  
PRIORITY

C6.9 trabaja principalmente con:

status

breach state

comparison result

materiality

confidence

Pero:

priority

pertenece a Fase 4\.

---

# **7\. RESPONSABILIDAD**

C6.9 debe determinar:

WHAT was observed?

WHAT references apply?

HOW does the observation compare?

WHAT guardrails are breached?

HOW far from references or limits?

IS the difference material?

WHAT status describes the condition?

WHAT evidence supports it?

WHAT confidence is allowed?

WHAT limitations remain?

IS the result determinate?

---

# **8\. LO QUE C6.9 NO DEBE HACER**

C6.9 NO debe determinar como autoridad final:

root cause

business priority

strategy

playbook

recommended action

resource allocation

execution plan

Tampoco debe:

pause campaigns

change budgets

change prices

reorder stock

---

# **9\. EVALUATION OBJECT**

La salida principal será:

BENCHMARK\_EVALUATION

---

# **10\. EVALUATION\_ID**

Toda evaluación material debe disponer de:

evaluation\_id

único.

---

# **11\. RUN RELATION**

Debe estar vinculada a:

run\_id

trace\_id

de C6.0.

---

# **12\. OBSERVATION RELATION**

Debe referenciar:

observation\_id

de C6.1.

---

# **13\. RESOLUTION RELATION**

Debe referenciar:

resolution\_id

de C6.7.

---

# **14\. CONFIDENCE RELATION**

Puede enlazar:

confidence\_assessment\_id

de C6.8.

---

# **15\. EVALUATION TYPE**

Debe poder clasificarse.

Valores iniciales:

benchmark\_comparison

historical\_comparison

peer\_comparison

target\_comparison

guardrail\_evaluation

economic\_evaluation

multi\_reference\_evaluation

composite\_evaluation

---

# **16\. HISTORICAL COMPARISON**

Responde:

> ¿Cómo estamos respecto a nuestra propia historia comparable?

---

# **17\. PEER COMPARISON**

Responde:

> ¿Cómo estamos respecto a un grupo comparable?

---

# **18\. TARGET COMPARISON**

Responde:

> ¿Estamos cumpliendo el objetivo configurado?

Debe conservar:

target \!= benchmark

---

# **19\. GUARDRAIL EVALUATION**

Responde:

> ¿Estamos dentro o fuera de un límite operativo/económico?

---

# **20\. ECONOMIC EVALUATION**

Puede combinar:

CAC

contribution

payback

cash

u otras referencias económicas.

---

# **21\. MULTI-REFERENCE EVALUATION**

Permite evaluar simultáneamente:

history

peer context

economic limit

target

sin fusionarlos indebidamente.

---

# **22\. COMPOSITE EVALUATION**

Puede sintetizar múltiples subevaluaciones relacionadas.

---

# **23\. EVALUATION QUESTION**

Toda evaluación debe saber qué pregunta está intentando responder.

Ejemplos:

historical\_health

peer\_position

economic\_sustainability

target\_attainment

risk\_boundary

scalability\_readiness

---

# **24\. QUESTION-SPECIFIC EVALUATION**

La misma métrica puede recibir distintos resultados según la pregunta.

Ejemplo:

CAC \= €48

Pregunta:

peer\_position

Resultado:

better\_than\_peer

Pregunta:

economic\_sustainability

Resultado:

risk

Ambos pueden ser correctos.

---

# **25\. COMPARISON RESULT**

Debe existir:

COMPARISON\_RESULT

para cada referencia.

---

# **26\. COMPARISON STATES**

Propuesta inicial:

materially\_better

better

within\_expected\_range

neutral

worse

materially\_worse

not\_comparable

indeterminate

---

# **27\. DIRECTION DEPENDS ON METRIC**

Para:

CVR

mayor puede ser mejor.

Para:

CAC

menor puede ser mejor.

Para:

inventory coverage

demasiado alto y demasiado bajo pueden ser negativos.

C6.9 debe consumir directional semantics.

---

# **28\. NO UNIVERSAL HIGHER\_IS\_BETTER**

No asumir:

higher \= good

universalmente.

---

# **29\. DIFFERENCE**

Debe poder calcularse:

absolute\_difference

relative\_difference

cuando sea matemáticamente válido.

---

# **30\. ABSOLUTE DIFFERENCE**

Ejemplo:

observed CAC:  
€48

reference:  
€40

absolute\_difference:  
\+€8

---

# **31\. RELATIVE DIFFERENCE**

relative\_difference:  
\+20%

---

# **32\. PERCENTILE POSITION**

Si existe distribución:

percentile\_position

puede calcularse.

Ejemplo:

P67

---

# **33\. DISTANCE TO RANGE**

Para ranges:

distance\_to\_lower\_bound

distance\_to\_upper\_bound

---

# **34\. MATERIALITY**

Una diferencia estadística o numérica no es necesariamente material para el negocio.

Debe existir:

materiality

---

# **35\. MATERIALITY LEVELS**

Propuesta:

none

low

medium

high

critical

---

# **36\. MATERIALITY ≠ SEVERITY**

Materiality responde:

> ¿Es suficientemente grande/relevante la diferencia?

Severity responde:

> ¿Qué gravedad representa la condición?

No son idénticos.

---

# **37\. MATERIALITY BASIS**

Puede depender de:

absolute magnitude

relative magnitude

economic consequence

volume affected

persistence

business exposure

---

# **38\. MATERIALITY POLICY**

C6.6 puede definir reglas específicas.

No hardcodear:

5% difference \= material

universalmente.

---

# **39\. STATUS MODEL**

C6.9 debe producir status estructurado.

Propuesta principal:

healthy

watch

warning

risk

critical

indeterminate

not\_applicable

---

# **40\. HEALTHY**

Significa:

> La observación se encuentra dentro de condiciones consideradas sostenibles/aceptables respecto a las referencias relevantes.

No significa:

perfect

---

# **41\. WATCH**

Significa:

> No existe todavía una condición material de riesgo, pero existen señales que merecen vigilancia.

---

# **42\. WARNING**

Significa:

> Existe deterioro o proximidad a un límite que merece atención.

---

# **43\. RISK**

Significa:

> Existe una condición material que compromete algún objetivo protegido.

---

# **44\. CRITICAL**

Significa:

> Existe una condición severa o violación material de un límite crítico.

---

# **45\. INDETERMINATE**

Significa:

> No existe evidencia suficiente o coherente para emitir un juicio responsable.

---

# **46\. NOT APPLICABLE**

La evaluación solicitada no aplica.

---

# **47\. STATUS ORIGIN**

Todo status debe conocer:

status\_basis

Ejemplos:

benchmark comparison

guardrail breach

multi-reference synthesis

policy threshold

---

# **48\. NO STATUS WITHOUT BASIS**

Nunca:

status \= risk

sin poder explicar qué lo produjo.

---

# **49\. GUARDRAIL EVALUATION**

Por cada guardrail debe producirse:

GUARDRAIL\_EVALUATION

---

# **50\. GUARDRAIL STATES**

Propuesta:

safe

near\_limit

warning

breached

critical\_breach

unresolved

not\_applicable

---

# **51\. SAFE**

La observación está dentro del límite aceptable.

---

# **52\. NEAR LIMIT**

Todavía no existe breach, pero la distancia al límite es pequeña según policy.

---

# **53\. WARNING**

Ha entrado en zona de warning.

---

# **54\. BREACHED**

Ha superado el límite de risk.

---

# **55\. CRITICAL BREACH**

Ha superado el límite critical.

---

# **56\. UNRESOLVED**

No puede determinarse el threshold.

---

# **57\. BREACH DISTANCE**

Debe poder calcular:

distance\_to\_guardrail

---

# **58\. BREACH MAGNITUDE**

Puede representar:

absolute

relative

---

# **59\. PERSISTENCE**

Si el guardrail requiere persistencia:

persistence\_met

debe evaluarse.

---

# **60\. OCCURRENCES**

Si requiere:

3 of last 5 periods

debe calcular:

occurrences\_met

---

# **61\. SINGLE BREACH VS SUSTAINED BREACH**

Debe diferenciarse:

one-off breach

de:

persistent breach

---

# **62\. TREND CONTEXT**

Una evaluación puede incluir:

trend\_direction

trend\_strength

trend\_duration

si está disponible.

---

# **63\. TREND STATES**

Ejemplos:

improving

stable

deteriorating

volatile

unknown

---

# **64\. TREND ≠ STATUS**

Ejemplo:

status \= healthy

trend \= deteriorating

puede significar:

> Todavía estamos dentro de límites, pero acercándonos al problema.

---

# **65\. STATUS \= RISK \+ TREND IMPROVING**

También puede ocurrir:

status \= risk

trend \= improving

---

# **66\. BENCHMARK POSITION**

Debe poder expresar:

position\_vs\_reference

---

# **67\. DISTRIBUTION POSITION**

Ejemplo:

below\_p25

p25\_to\_p50

p50\_to\_p75

above\_p75

según métrica.

---

# **68\. RANGE POSITION**

Ejemplos:

below\_range

inside\_range

above\_range

---

# **69\. TARGET ATTAINMENT**

Debe mantenerse separado.

Estados posibles:

exceeded

met

near\_target

missed

materially\_missed

indeterminate

---

# **70\. TARGET MISSED ≠ RISK AUTOMÁTICO**

Un target ambicioso puede incumplirse sin que el negocio esté en riesgo.

---

# **71\. BENCHMARK UNDERPERFORMANCE ≠ RISK AUTOMÁTICO**

Estar por debajo de peers tampoco implica automáticamente riesgo.

---

# **72\. GUARDRAIL BREACH MAY IMPLY RISK**

Pero debe depender de:

guardrail semantics

severity zone

confidence

---

# **73\. MULTI-PERSPECTIVE EVALUATION**

Debe existir:

perspectives

---

# **74\. EXAMPLE**

historical:  
materially\_worse

peer:  
better

target:  
missed

profitability\_guardrail:  
risk

cash\_guardrail:  
critical

---

# **75\. SYNTHESIS**

C6.9 puede producir una síntesis global.

Pero la síntesis debe preservar subevaluaciones.

---

# **76\. SYNTHESIS STATUS**

Puede existir:

overall\_status

---

# **77\. SYNTHESIS RULES**

Deben venir de:

policy

cuando sea necesario.

No de intuición libre del LLM.

---

# **78\. CONSERVATIVE SYNTHESIS**

Para algunos dominios:

critical guardrail breach

puede dominar el overall status.

Pero esto debe ser explícito.

---

# **79\. NO AVERAGE STATUS**

No:

healthy \+ critical \+ warning  
\= average \= warning

Los statuses no se promedian.

---

# **80\. DOMINANT CONDITION**

Puede existir:

dominant\_evaluation

o:

dominant\_guardrail

cuando una condición sea claramente determinante.

---

# **81\. DOMINANCE REASON**

Debe registrarse:

dominance\_reason

---

# **82\. CONFLICTING PERSPECTIVES**

Puede existir:

evaluation\_conflict

Ejemplo:

peer performance \= healthy

own economics \= risk

No es error.

Es información.

---

# **83\. CONFLICT STATUS**

Ejemplos:

none

minor

material

strong

---

# **84\. CONFLICT EXPLANATION**

Debe conservarse:

why perspectives disagree

cuando sea posible.

---

# **85\. EVIDENCE STATUS**

Debe consumirse C6.3/C6.8.

---

# **86\. EVIDENCE SUFFICIENT**

Permite evaluación normal.

---

# **87\. EVIDENCE PARTIAL**

Puede producir evaluación con limitations.

---

# **88\. EVIDENCE INSUFFICIENT**

Debe empujar hacia:

indeterminate

cuando la evidencia sea crítica.

---

# **89\. CONFIDENCE**

Toda evaluación debe disponer de:

evaluation\_confidence

derivado de C6.8.

---

# **90\. STATUS \+ CONFIDENCE**

Ejemplo:

status:  
critical

confidence:  
high

Muy distinto de:

status:  
critical

confidence:  
low

---

# **91\. HIGH CONFIDENCE CRITICAL**

Puede comunicarse como:

confirmed critical condition

si claim strength lo permite.

---

# **92\. LOW CONFIDENCE CRITICAL**

Debe comunicarse como:

potential critical condition  
requiring validation

---

# **93\. INDETERMINATE IS NOT LOW CONFIDENCE**

Importante:

status \= indeterminate

no equivale simplemente a:

status \= risk  
confidence \= low

Son casos diferentes.

---

# **94\. INDETERMINATE CRITERIA**

Puede producirse por:

insufficient evidence

no valid reference

unresolved guardrail

policy conflict

semantic ambiguity

critical source conflict

---

# **95\. NOT APPLICABLE CRITERIA**

Ejemplo:

Intentar evaluar:

subscription churn

para un negocio sin subscription.

---

# **96\. LIMITATIONS**

Toda evaluación puede declarar:

limitations

---

# **97\. LIMITATION EXAMPLES**

peer benchmark does not separate new/returning

cash guardrail depends on modeled repeat contribution

recent tracking incident

cohort still maturing

---

# **98\. ASSUMPTIONS**

Debe enlazar assumptions relevantes de C6.8.

---

# **99\. CRITICAL ASSUMPTIONS**

Si existe una critical assumption:

status strength

puede verse limitada.

---

# **100\. OBSERVATION VS REFERENCE**

Debe conservar:

observed\_value

reference\_value

sin duplicar innecesariamente objetos completos.

---

# **101\. REFERENCE ROLE**

Debe indicar:

primary

supporting

sanity\_check

economic\_limit

target

---

# **102\. PRIMARY COMPARISON**

Controla principalmente esa perspectiva.

---

# **103\. SUPPORTING COMPARISON**

Puede reforzar o contradecir.

---

# **104\. SANITY CHECK**

No debe dominar el status principal.

---

# **105\. ECONOMIC LIMIT**

Debe tratarse como guardrail, no benchmark estadístico.

---

# **106\. EVALUATION REASON CODES**

Debe existir una taxonomía estructurada.

Ejemplos:

EVAL\_WITHIN\_EXPECTED\_RANGE

EVAL\_BELOW\_INTERNAL\_BASELINE

EVAL\_ABOVE\_PEER\_MEDIAN

EVAL\_GUARDRAIL\_WARNING

EVAL\_GUARDRAIL\_BREACHED

EVAL\_GUARDRAIL\_CRITICAL

EVAL\_TARGET\_MISSED

EVAL\_INSUFFICIENT\_EVIDENCE

EVAL\_REFERENCE\_CONFLICT

EVAL\_NO\_VALID\_REFERENCE

EVAL\_POLICY\_CONFLICT

EVAL\_TRACKING\_LIMITATION

---

# **107\. REASON CODES ≠ EXPLANATION**

Debe existir también:

human\_explanation

derivable.

---

# **108\. EXAMPLE EXPLANATION**

CAC is 37% above its comparable historical baseline  
and 12% above the sustainable CAC guardrail,  
despite remaining below the peer median.

---

# **109\. FACT LAYER**

C6.9 debe separar:

observation

como hecho medido.

---

# **110\. INTERPRETATION LAYER**

Puede producir:

interpretation

como:

acquisition efficiency has deteriorated  
relative to internal history

---

# **111\. HYPOTHESIS LAYER**

Puede conservar hypotheses si ya existen.

Pero no debe convertirlas en causality.

---

# **112\. NO RECOMMENDATION LAYER**

C6.9 no debe producir:

reduce spend

---

# **113\. NO PRIORITY**

No debe producir:

P0  
P1  
P2

---

# **114\. NO ROOT CAUSE**

No debe producir:

root cause \= audience fatigue

---

# **115\. IMPACT**

C6.9 puede recibir o estimar conceptualmente:

potential\_impact

si se deriva directamente del breach.

Pero no debería convertirse en análisis completo de impacto estratégico.

---

# **116\. MATERIAL EXPOSURE**

Puede existir:

affected\_volume

affected\_revenue

affected\_orders

affected\_customers

cuando esté disponible.

---

# **117\. EXPOSURE ≠ PRIORITY**

Aunque el impacto sea alto, Fase 4 determinará priority.

---

# **118\. ECONOMIC EXPOSURE**

Ejemplo:

CAC overspend:  
€5 per customer

new customers:  
10,000

estimated excess acquisition cost:  
€50,000

Puede aportar materiality.

---

# **119\. DO NOT OVERSTATE DERIVED IMPACT**

Si los inputs son modelados:

impact confidence

debe reflejarlo.

---

# **120\. TEMPORAL EVALUATION**

Debe poder conservar:

evaluated\_period

baseline\_period

evaluation\_window

---

# **121\. CURRENT VS HISTORICAL**

Una evaluación actual debe diferenciarse de:

historical replay

mediante C6.0.

---

# **122\. EVALUATION VERSION**

Debe existir:

evaluation\_version

o engine version desde C6.0.

---

# **123\. IMMUTABILITY**

Una evaluación materializada no debe recalcularse silenciosamente cuando cambien:

benchmarks

policies

guardrails

engine

---

# **124\. RE-EVALUATION**

Debe producir:

new evaluation\_id

---

# **125\. RE-EVALUATION RELATION**

Puede existir:

supersedes\_evaluation\_id

reevaluation\_of\_evaluation\_id

---

# **126\. HISTORICAL TRUTH**

Debe poder saberse:

> ¿Qué dijo el sistema con la información y policies disponibles entonces?

---

# **127\. CURRENT TRUTH**

También:

> ¿Qué diría ahora con nueva información?

Ambas pueden coexistir.

---

# **128\. EVALUATION SHAPE**

Conceptualmente:

benchmark\_evaluation:

    identity:  
        evaluation\_id  
        run\_id  
        trace\_id  
        observation\_id  
        resolution\_id

    classification:  
        evaluation\_type  
        evaluation\_question

    observation:  
        observed\_value  
        metric\_id  
        semantic\_ref

    comparisons:  
        historical  
        peer  
        target  
        supporting

    guardrails:  
        evaluations

    trend:  
        direction  
        strength  
        duration

    materiality:  
        level  
        basis  
        exposure

    synthesis:  
        overall\_status  
        dominant\_condition  
        evaluation\_conflict

    evidence:  
        quality\_status  
        evidence\_strength

    confidence:  
        confidence\_assessment\_id  
        evaluation\_confidence

    epistemics:  
        limitations  
        assumptions  
        missing\_evidence

    explanation:  
        reason\_codes  
        structured\_interpretation

    relationships:  
        supersedes\_evaluation\_id

---

# **129\. COMPARISON SHAPE**

comparison:

    reference\_id  
    reference\_version  
    reference\_role

    observed\_value  
    reference\_value

    absolute\_difference  
    relative\_difference

    range\_position  
    percentile\_position

    comparison\_status  
    materiality

    comparability\_ref  
    quality\_ref

    confidence

    limitations

---

# **130\. GUARDRAIL EVALUATION SHAPE**

guardrail\_evaluation:

    guardrail\_id  
    guardrail\_version

    threshold  
    observed\_value

    state

    absolute\_distance  
    relative\_distance

    persistence\_met  
    occurrence\_requirement\_met

    materiality  
    confidence

    limitations

---

# **131\. EXAMPLE — CAC**

Observation:

New Customer CAC:  
€48

Resolved references:

Historical comparable:  
€35

Peer median:  
€52

Guardrails:

Sustainable CAC:  
€43

Cash-safe CAC:  
€40

Evaluation:

Historical:

status:  
materially\_worse

difference:  
\+37.1%

confidence:  
high

Peer:

status:  
better

difference:  
\-7.7%

confidence:  
medium/high

Profitability guardrail:

state:  
breached

distance:  
\+11.6%

confidence:  
high

Cash guardrail:

state:  
critical\_breach

distance:  
\+20%

confidence:  
high

Synthesis:

overall\_status:  
risk / critical according to policy

dominant\_condition:  
cash guardrail breach

peer\_position:  
healthy

historical\_health:  
deteriorated

---

# **132\. WHY THIS MATTERS**

La respuesta correcta no es:

CAC \= €48  
Good because industry CAC is €52.

La respuesta correcta puede ser:

CAC remains better than the peer median,  
but has deteriorated 37% against comparable  
internal history and exceeds both profitability  
and cash guardrails.

---

# **133\. EXAMPLE — CVR MIX SHIFT**

Observation:

Blended CVR:  
3.2%

Historical:

2.9%

Pero:

returning customer share increased significantly

Segmented:

new customer CVR:  
2.1% → 1.7%

returning CVR:  
5.3% → 5.5%

C6.9 should avoid:

CRO improved.

Possible evaluation:

blended comparison:  
better

new customer segment:  
worse

mix effect:  
material

overall interpretation:  
blended improvement does not demonstrate  
underlying new-customer CRO improvement

---

# **134\. EXAMPLE — ROAS**

Platform ROAS:  
4.3

Peer benchmark:

3.7

But:

MER:  
declining

marginal CAC:  
above guardrail

new customer share:  
declining

C6.9 can say:

platform\_attributed\_performance:  
healthy vs peer

economic\_sustainability:  
risk

It must NOT conclude:

paid media is performing well overall.

---

# **135\. EXAMPLE — INSUFFICIENT EVIDENCE**

CVR fell 28%

but:

tracking outage \= 16h  
session coverage \= 58%

Evaluation:

status:  
indeterminate

observed\_signal:  
apparent deterioration

confidence:  
low

reason:  
insufficient measurement reliability

---

# **136\. EXAMPLE — HIGH SEVERITY LOW CONFIDENCE**

Inventory feed:

hero SKU coverage:  
0 days

but source:

stale 24h

Evaluation:

potential\_status:  
critical

overall\_status:  
indeterminate / validation\_required

confidence:  
low

depending on policy.

---

# **137\. EXAMPLE — TARGET MISSED BUT HEALTHY**

Contribution margin:  
28%

target:  
32%

minimum guardrail:  
20%

Evaluation:

target:  
missed

guardrail:  
safe

overall\_status:  
healthy / watch

depending on policy.

This demonstrates:

target missed  
≠  
risk

---

# **138\. EXAMPLE — BENCHMARK POOR BUT ECONOMICS SAFE**

CAC:  
€42

peer median:  
€35

maximum sustainable CAC:  
€60

Evaluation:

peer position:  
worse

economic sustainability:  
healthy

No contradiction.

---

# **139\. EXAMPLE — BETTER THAN PEERS BUT ECONOMICALLY UNSAFE**

CAC:  
€48

peer median:  
€60

maximum sustainable:  
€42

Evaluation:

peer position:  
better

economics:  
risk

This is a critical use case.

---

# **140\. MULTI-METRIC EVALUATION**

C6.9 may also generate a set of evaluations:

CAC

CVR

AOV

contribution

refund rate

But each metric should retain its own evaluation identity.

---

# **141\. EVALUATION SET**

Can exist:

EVALUATION\_SET

---

# **142\. EVALUATION SET PURPOSE**

Groups related evaluations without fusing them.

---

# **143\. SET EXAMPLE**

Acquisition health evaluation set:

CAC  
ROAS  
MER  
new customer share  
marginal CAC

---

# **144\. SET DOES NOT EQUAL PATTERN**

Combining metrics into a pattern belongs mainly to C6.11.

C6.9 evaluates them.

C6.11 interprets their combination.

---

# **145\. EVALUATION ORDER**

Recommended sequence:

1\. Validate resolved input

2\. Evaluate primary comparison

3\. Evaluate supporting comparisons

4\. Evaluate targets

5\. Evaluate guardrails

6\. Evaluate trend/materiality

7\. Apply confidence constraints

8\. Produce perspective statuses

9\. Apply synthesis policy

10\. Generate structured evaluation

---

# **146\. FAIL CONDITIONS**

The evaluator should fail or become indeterminate if:

observation invalid

resolution missing

critical semantic mismatch

required guardrail unresolved

policy conflict

critical data quality failure

---

# **147\. PARTIAL EVALUATION**

Must be allowed.

Example:

historical comparison:  
resolved

peer comparison:  
resolved

cash guardrail:  
unresolved

Output:

evaluation\_status:  
partial

at technical/content level.

---

# **148\. PARTIAL ≠ INDETERMINATE NECESSARILY**

We can have:

historical finding \= valid

while:

cash evaluation \= indeterminate

The entire object should preserve both.

---

# **149\. EVALUATION TECHNICAL STATUS**

Separate from business status.

Possible:

complete

partial

failed

This is not:

healthy

risk

critical

---

# **150\. TECHNICAL STATUS ≠ BUSINESS STATUS**

Example:

evaluation\_technical\_status:  
complete

business\_status:  
critical

Perfectly valid.

---

# **151\. INVARIANTES C6.9**

## **INV-C6.9-001**

No evaluation without observation.

---

## **INV-C6.9-002**

No material evaluation without resolved references/policies when required.

---

## **INV-C6.9-003**

No direct metric → good/bad rule without context.

---

## **INV-C6.9-004**

Benchmark, target and guardrail must remain separate.

---

## **INV-C6.9-005**

Multiple perspectives may coexist.

---

## **INV-C6.9-006**

Better than benchmark does not imply healthy.

---

## **INV-C6.9-007**

Worse than benchmark does not imply risk.

---

## **INV-C6.9-008**

Missing target does not imply guardrail breach.

---

## **INV-C6.9-009**

Guardrail breach does not imply root cause.

---

## **INV-C6.9-010**

Guardrail breach does not imply recommendation.

---

## **INV-C6.9-011**

Guardrail breach does not imply priority.

---

## **INV-C6.9-012**

Indeterminate must be possible.

---

## **INV-C6.9-013**

Not applicable must be possible.

---

## **INV-C6.9-014**

Low confidence must constrain claim strength.

---

## **INV-C6.9-015**

High severity does not imply high confidence.

---

## **INV-C6.9-016**

Status must have explicit basis.

---

## **INV-C6.9-017**

Comparison direction must respect metric semantics.

---

## **INV-C6.9-018**

No universal materiality threshold.

---

## **INV-C6.9-019**

Perspective disagreement must not be hidden.

---

## **INV-C6.9-020**

Overall status cannot erase subevaluations.

---

## **INV-C6.9-021**

Historical evaluations must be immutable.

---

## **INV-C6.9-022**

Reevaluation creates a new evaluation.

---

## **INV-C6.9-023**

Observed and predicted evaluations must remain distinguishable.

---

## **INV-C6.9-024**

Average and marginal evaluations must remain distinguishable.

---

## **INV-C6.9-025**

Attributed and incremental evaluations must remain distinguishable.

---

## **INV-C6.9-026**

Blended results must not silently override segmented deterioration.

---

## **INV-C6.9-027**

A generic benchmark cannot dominate stronger economics automatically.

---

## **INV-C6.9-028**

A supporting reference cannot silently become the primary basis.

---

## **INV-C6.9-029**

Technical evaluation status and business evaluation status must remain separate.

---

## **INV-C6.9-030**

C6.9 must not generate execution actions.

---

# **152\. VALIDACIONES MÍNIMAS**

Before evaluation:

observation valid?

metric semantics valid?

resolution complete enough?

primary reference available if required?

guardrails resolved?

target semantics separate?

quality sufficient?

confidence assessment available?

comparison units compatible?

currency compatible?

time periods compatible?

directionality known?

materiality policy available?

---

# **153\. VALIDATION — BENCHMARK/TARGET MIX**

Must reject:

peer median used as target

without explicit semantic conversion.

---

# **154\. VALIDATION — BENCHMARK/GUARDRAIL MIX**

Must reject:

industry average used as safety limit

unless explicitly transformed by policy.

---

# **155\. VALIDATION — CURRENCY**

Cannot compare:

€48

with:

$50

without normalization.

---

# **156\. VALIDATION — SEMANTICS**

Cannot compare:

marginal CAC

with:

average CAC

as equivalent.

---

# **157\. VALIDATION — QUALITY**

If critical quality blocker exists:

strong status claims prohibited

---

# **158\. VALIDATION — CONFIDENCE**

Cannot produce:

critical confirmed

with:

confidence \= insufficient

---

# **159\. VALIDATION — OVERALL STATUS**

An overall status must be explainable from:

subevaluations

policy

dominant conditions

---

# **160\. RELACIÓN CON C6.0**

C6.0 provides:

runtime identity

versions

tenant/business

execution context

---

# **161\. RELACIÓN CON C6.1**

C6.1 provides:

metric semantics

observation

---

# **162\. RELACIÓN CON C6.2**

C6.2 provides:

context

comparability

---

# **163\. RELACIÓN CON C6.3**

C6.3 provides:

measurement reliability

---

# **164\. RELACIÓN CON C6.4**

C6.4 provides benchmark definitions.

---

# **165\. RELACIÓN CON C6.5**

C6.5 provides guardrail definitions.

---

# **166\. RELACIÓN CON C6.6**

C6.6 provides effective policies.

---

# **167\. RELACIÓN CON C6.7**

C6.7 provides:

RESOLVED\_EVALUATION\_INPUT

C6.9 should consume it directly.

---

# **168\. RELACIÓN CON C6.8**

C6.8 constrains:

confidence

claim strength

uncertainty

---

# **169\. RELACIÓN CON C6.10**

C6.10 will use series of evaluations/observations to detect anomalies.

---

# **170\. RELACIÓN CON C6.11**

C6.11 will combine multiple evaluations into patterns and red flags.

---

# **171\. RELACIÓN CON C6.12**

C6.12 must reconstruct:

observation  
→ reference  
→ comparison  
→ guardrail  
→ evaluation

---

# **172\. RELACIÓN CON C6.13**

C6.13 will convert evaluation outputs into normalized Findings.

---

# **173\. RELACIÓN CON FASE 3**

Phase 3 may consume:

deterioration

guardrail breaches

conflicts

signals

to diagnose causes.

C6.9 should not diagnose them itself.

---

# **174\. RELACIÓN CON FASE 4**

Phase 4 may use:

status

severity

materiality

confidence

impact

to prioritize.

---

# **175\. RELACIÓN CON FASE 7**

Phase 7 will use evaluated conditions to determine recommended actions.

---

# **176\. TESTS MÍNIMOS**

## **TEST 1 — Healthy vs Internal \+ Safe Economics**

Should produce healthy.

---

## **TEST 2 — Better Than Peer, Unsafe Economics**

Must preserve both outcomes.

---

## **TEST 3 — Worse Than Peer, Safe Economics**

Must preserve both outcomes.

---

## **TEST 4 — Target Missed, Guardrail Safe**

Must not automatically produce risk.

---

## **TEST 5 — Guardrail Breach**

Should produce correct breach state.

---

## **TEST 6 — Critical Guardrail**

Should map correctly under policy.

---

## **TEST 7 — No Valid Benchmark**

Should permit indeterminate benchmark comparison.

---

## **TEST 8 — No Guardrail**

Should not fabricate one.

---

## **TEST 9 — Insufficient Evidence**

Should produce indeterminate when critical.

---

## **TEST 10 — High Severity Low Confidence**

Must preserve both.

---

## **TEST 11 — Blended Improvement / Segment Deterioration**

Must not report simple healthy improvement.

---

## **TEST 12 — Attributed ROAS Strong / Economics Weak**

Must preserve contradictory perspectives.

---

## **TEST 13 — Average CAC Safe / Marginal CAC Unsafe**

Must maintain separate evaluations.

---

## **TEST 14 — Observed vs Predicted**

Must preserve measurement basis.

---

## **TEST 15 — Range Guardrail**

Must detect below/inside/above range.

---

## **TEST 16 — Persistence Guardrail**

One breach should differ from sustained breach.

---

## **TEST 17 — Supporting Benchmark Conflict**

Should record disagreement.

---

## **TEST 18 — Historical Replay**

Must reproduce historical versions.

---

## **TEST 19 — Reevaluation**

Must create new evaluation.

---

## **TEST 20 — Currency Mismatch**

Must block without conversion.

---

## **TEST 21 — Not Applicable**

Must represent correctly.

---

## **TEST 22 — Partial Evaluation**

Must allow some valid perspectives and some indeterminate ones.

---

## **TEST 23 — Technical vs Business Status**

Must preserve both.

---

## **TEST 24 — No Recommendation**

Evaluation must not output prescribed action.

---

# **177\. ANTI-PATRÓN — SIMPLE THRESHOLD**

Incorrect:

if CVR \< 2%:  
    bad

---

# **178\. ANTI-PATRÓN — INDUSTRY BENCHMARK \= TRUTH**

Incorrect:

peer median \= 3%

our CVR \= 2.5%

therefore problem

without economics/context.

---

# **179\. ANTI-PATRÓN — BENCHMARK ABOVE \= GOOD**

Incorrect:

ROAS \> benchmark  
therefore healthy

---

# **180\. ANTI-PATRÓN — TARGET MISSED \= CRITICAL**

Incorrect.

---

# **181\. ANTI-PATRÓN — GUARDRAIL BREACH \= ROOT CAUSE**

Incorrect:

CAC breached  
therefore audience saturation

---

# **182\. ANTI-PATRÓN — GUARDRAIL BREACH \= ACTION**

Incorrect:

CAC breached  
therefore reduce budget

---

# **183\. ANTI-PATRÓN — AVERAGING STATUSES**

Incorrect:

healthy \+ warning \+ critical  
\= warning

---

# **184\. ANTI-PATRÓN — HIDE PERSPECTIVE CONFLICT**

Incorrect:

overall healthy

while economic guardrail is breached.

---

# **185\. ANTI-PATRÓN — FORCE STATUS**

If evidence is insufficient:

indeterminate

is the correct answer.

---

# **186\. ANTI-PATRÓN — STATUS WITHOUT CONFIDENCE**

A material status should include confidence information.

---

# **187\. ANTI-PATRÓN — STATUS WITHOUT EVIDENCE**

Every material conclusion must be traceable.

---

# **188\. ANTI-PATRÓN — OVERWRITE HISTORY**

Never modify historical evaluation after policy changes.

---

# **189\. ANTI-PATRÓN — BLENDED MASKING SEGMENTS**

Never declare improvement based only on blended metric when material segment deterioration is known.

---

# **190\. ACCEPTANCE CRITERIA**

For every material evaluation we must be able to answer:

1\. What observation was evaluated?

2\. What exact metric semantics were used?

3\. What question was being answered?

4\. What primary reference was used?

5\. What supporting references were used?

6\. What targets were evaluated?

7\. What guardrails were evaluated?

8\. What result exists against each reference?

9\. What absolute difference exists?

10\. What relative difference exists?

11\. What percentile/range position exists?

12\. What guardrails were breached?

13\. How far were they breached?

14\. Was the breach persistent?

15\. What trend exists?

16\. What materiality exists?

17\. What business exposure exists?

18\. What perspective statuses exist?

19\. Do perspectives conflict?

20\. What overall status was produced?

21\. Why?

22\. What condition dominated the synthesis?

23\. What confidence supports it?

24\. What evidence limitations exist?

25\. What assumptions remain?

26\. Why is the status not stronger/weaker?

27\. Can the evaluation be replayed historically?

28\. Can every conclusion be traced to its inputs?

---

# **191\. DEFINITION OF DONE**

C6.9 estará formalmente definido cuando exista:

Evaluation Identity

Evaluation Types

Evaluation Questions

Comparison Result Model

Historical Comparison

Peer Comparison

Target Comparison

Guardrail Evaluation

Economic Evaluation

Multi-Reference Evaluation

Absolute Difference

Relative Difference

Range Position

Percentile Position

Materiality Model

Status Model

Healthy / Watch / Warning / Risk / Critical

Indeterminate

Not Applicable

Guardrail States

Breach Magnitude

Persistence

Trend Context

Target Attainment

Multi-Perspective Evaluation

Perspective Conflict

Synthesis Rules

Dominant Condition

Evidence Constraints

Confidence Constraints

Limitations

Assumptions

Exposure

Reason Codes

Structured Interpretation

Technical Evaluation Status

Partial Evaluation

Reevaluation

Historical Immutability

Validation Rules

Test Fixtures

---

# **192\. RESULTADO ARQUITECTÓNICO**

Antes de C6.9:

CAC \= €48

Después de todo el pipeline:

OBSERVATION

New Customer Average CAC  
Spain  
August 2026  
€48

DATA QUALITY

High

HISTORICAL REFERENCE

Comparable internal CAC:  
€35

Evaluation:  
Materially worse

Difference:  
\+37%

Confidence:  
High

PEER REFERENCE

Peer median:  
€52

Evaluation:  
Better than reference

Confidence:  
Medium / High

TARGET

Target:  
€40

Evaluation:  
Missed

PROFITABILITY GUARDRAIL

Maximum sustainable CAC:  
€43

State:  
Breached

Distance:  
\+11.6%

Confidence:  
High

CASH GUARDRAIL

Cash-safe CAC:  
€40

State:  
Critical breach

Distance:  
\+20%

Confidence:  
High

SYNTHESIS

Overall status:  
Risk / Critical according to configured policy

Historical health:  
Deteriorated

Peer position:  
Competitive

Economic sustainability:  
Unsafe

Cash sustainability:  
Critical

Primary reason:  
Cash \+ profitability guardrail breaches

LIMITATION

Marginal CAC is unavailable,  
so this evaluation must not be interpreted  
as a complete scalability assessment.

Esto permite una conclusión mucho más rigurosa:

CAC sigue siendo competitivo frente a peers,  
pero se ha deteriorado fuertemente respecto  
a la historia comparable y ya supera los  
límites de rentabilidad y caja del propio negocio.

Todavía NO dice:

why

what to attack first

what strategy to use

what action to execute

Y esa frontera es deliberada.

---

# **193\. PRINCIPIO FINAL DE C6.9**

C6.9 debe imponer:

A metric  
does not have one universal meaning.

It has meaning  
relative to:

history  
\+  
context  
\+  
benchmarks  
\+  
targets  
\+  
economics  
\+  
guardrails  
\+  
evidence  
\+  
uncertainty

Y:

better than benchmark  
does not mean healthy.

worse than benchmark  
does not mean broken.

target missed  
does not mean unsafe.

guardrail breached  
does not reveal root cause.

Además:

When evidence is insufficient:

INDETERMINATE  
is an intelligent answer.

---

# **194\. SALIDA FORMAL DE C6.9**

C6.9 produce conceptualmente:

BENCHMARK\_EVALUATION

COMPARISON\_RESULT

GUARDRAIL\_EVALUATION

y, cuando corresponda:

EVALUATION\_SET

Estas salidas serán consumidas por:

C6.10 — Anomaly Detection

C6.11 — Pattern & Red Flag Detection

C6.12 — Evidence, Provenance & Lineage

C6.13 — Evaluation Finding

C6.14 — Inter-Phase Handoff

C6.15 — Observability & Audit

y posteriormente por:

Fase 3 — Diagnóstico

Fase 4 — Priorización

Fase 7 — Motor de Recomendaciones

C6.9 no produce:

ROOT CAUSE

PRIORITY

STRATEGY

PLAYBOOK

RECOMMENDED ACTION

EXECUTION

---

# **C6.9 — ESTADO**

CONTRACT:  
C6.9 Benchmark Evaluation

TYPE:  
Core Evaluation Engine

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

NEXT CONTRACT:  
C6.10 — Anomaly Detection Contract

