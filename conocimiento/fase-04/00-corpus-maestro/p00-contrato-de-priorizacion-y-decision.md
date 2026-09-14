# **FASE 4 — PRIORIZACIÓN Y DECISIÓN**

## **P0 — CONTRATO DE PRIORIZACIÓN Y DECISIÓN**

---

# **PARTE A — RAG / KNOWLEDGE**

## **1\. Propósito**

El sistema de priorización existe para responder:

> **De todo lo que sabemos que está ocurriendo en el ecommerce, ¿qué merece atención antes que el resto y por qué?**

Su responsabilidad no es descubrir nuevamente qué está ocurriendo.

Eso pertenece a Fase 3\.

Tampoco consiste todavía en determinar exactamente cómo solucionar el problema.

Eso pertenece principalmente a Fase 5\.

P0 define el lenguaje, las fronteras y los principios fundamentales bajo los que funcionará todo el sistema de decisión.

---

# **2\. Cambio conceptual: de diagnóstico a decisión**

Fase 3 produce conocimiento sobre el negocio.

OBSERVATIONS  
↓  
SIGNALS  
↓  
SYMPTOMS  
↓  
HYPOTHESES  
↓  
ROOT CAUSES  
↓  
CONSTRAINTS  
↓  
DIAGNOSES

Fase 4 recibe ese conocimiento y debe responder:

WHAT DESERVES ATTENTION FIRST?

Por tanto:

DIAGNOSIS  
≠  
DECISION

y:

DIAGNOSTIC ORDER  
≠  
DECISION ORDER

El hecho de que un diagnóstico aparezca primero, sea más visible o tenga mayor severidad no significa que deba ocupar la primera posición de decisión.

---

# **3\. Qué significa PRIORITY**

En EcomScaling IA:

PRIORITY

representa:

> **La precedencia relativa que un asunto merece frente a otros asuntos competidores dadas las condiciones actuales del negocio.**

Es deliberadamente una definición relativa.

No existe prioridad sin contexto.

Un problema puede ser:

HIGH PRIORITY

hoy y:

LOW PRIORITY

dentro de dos semanas aunque su diagnóstico no haya cambiado.

También puede tener diferente prioridad para dos ecommerce distintos.

---

# **4\. La prioridad no es una propiedad intrínseca del problema**

La severidad puede pertenecer al problema.

La prioridad pertenece a:

PROBLEM  
\+  
BUSINESS CONTEXT  
\+  
TIME  
\+  
OBJECTIVES  
\+  
DEPENDENCIES  
\+  
CONSTRAINTS  
\+  
RISK  
\+  
AVAILABLE OPTIONS

Por eso no deberíamos almacenar conceptualmente algo como:

checkout\_problem.priority \= HIGH

como si fuera una propiedad permanente.

La prioridad debe generarse dentro de un:

DECISION\_CONTEXT

concreto.

---

# **5\. Priority ≠ Severity**

SEVERITY

responde:

> ¿Qué tan grave es la condición detectada?

PRIORITY

responde:

> ¿Qué merece atención antes que otras cosas?

Ejemplo:

PROBLEM A  
Severity: CRITICAL  
Revenue Exposure: 1%

PROBLEM B  
Severity: HIGH  
Revenue Exposure: 60%  
Damage: accumulating daily

B podría requerir atención antes que A.

---

# **6\. Priority ≠ Impact**

Algo puede tener un impacto potencial enorme pero:

low probability  
long time horizon  
high uncertainty  
no immediate dependency

mientras otro problema de menor impacto puede estar destruyendo valor ahora mismo.

Por tanto:

MAX IMPACT  
≠  
MAX PRIORITY

---

# **7\. Priority ≠ Urgency**

Urgencia significa:

> ¿Cuánto importa actuar o decidir antes en el tiempo?

Prioridad incorpora urgencia, pero no es únicamente urgencia.

Un asunto extremadamente urgente de exposición mínima puede quedar por debajo de otro que comprometa la continuidad operativa del ecommerce.

---

# **8\. Priority ≠ Constraint**

El constraint actual del negocio merece especial consideración porque limita el throughput del sistema.

Pero:

CURRENT CONSTRAINT  
≠  
AUTOMATIC PRIORITY \#1

Ejemplo:

CURRENT GROWTH CONSTRAINT:  
Creative Supply

EMERGENCY:  
Payment processing outage

El fallo transaccional puede preemptar temporalmente el constraint estructural.

---

# **9\. Priority ≠ Confidence**

Alta confianza significa:

WE ARE CONFIDENT ABOUT WHAT WE KNOW

No significa:

WE MUST WORK ON IT FIRST

Del mismo modo:

LOW CONFIDENCE

no significa:

IGNORE

Si:

potential impact \= catastrophic  
confidence \= low  
validation cost \= low

la decisión prioritaria puede ser reducir incertidumbre.

---

# **10\. Priority ≠ Effort**

No deberá existir una regla:

LOW EFFORT  
→  
DO FIRST

Esto produciría una organización ocupada pero no necesariamente efectiva.

El trabajo pequeño y fácil puede competir constantemente contra los problemas estructurales importantes.

La facilidad de ejecución es una variable de decisión.

No es la definición de prioridad.

---

# **11\. Priority ≠ ROI simple**

Tampoco debe reducirse a:

Expected Impact / Effort

Ese razonamiento puede ser útil como una señal.

Pero puede ignorar:

urgency  
dependencies  
survival risk  
cash exposure  
irreversibility  
critical paths  
forward risk  
strategic commitments  
optionality  
constraints

---

# **12\. Priority es comparativa**

F4 no debería limitarse a explicar:

Why A is important.

Debe poder explicar:

Why A should precede B.

La verdadera unidad de razonamiento es:

A vs B

y posteriormente:

A vs B vs C vs D...

---

# **13\. Priorizar significa aceptar coste de oportunidad**

Elegir:

A FIRST

implica necesariamente:

B NOT FIRST  
C NOT FIRST  
D NOT FIRST

Toda decisión consume recursos escasos:

time  
attention  
cash  
team capacity  
engineering capacity  
creative capacity  
inventory  
management bandwidth

Por tanto, cada prioridad contiene implícitamente un:

OPPORTUNITY COST

---

# **14\. La atención también es un recurso**

Un error frecuente consiste en pensar que únicamente debemos priorizar recursos monetarios.

Pero el ecommerce tiene otro recurso limitado:

MANAGEMENT ATTENTION

Un negocio con quince iniciativas críticas simultáneas probablemente no tiene quince prioridades.

Tiene ausencia de priorización.

---

# **15\. Attention Priority vs Intervention**

F4 decide principalmente:

WHAT REQUIRES DECISIONAL ATTENTION

No necesariamente:

WHAT EXACT ACTION MUST BE EXECUTED

Esto permite resultados como:

PRIORITY \#1:  
Payment integrity issue

NEXT DECISION NEED:  
Immediate determination required

sin entrar todavía en:

rollback deployment  
change provider  
modify checkout

que pertenecen a fases posteriores.

---

# **16\. La validación puede convertirse en prioridad**

Una de las reglas más importantes del sistema será:

> **No todos los elementos prioritarios serán problemas que deban corregirse inmediatamente.**

Ejemplo:

Potential Revenue Exposure:  
VERY HIGH

Diagnostic Confidence:  
LOW

Cost of Validation:  
LOW

Time to Validate:  
SHORT

El resultado razonable podría ser:

PRIORITY \#1  
Resolve diagnostic uncertainty

No porque investigar sea intrínsecamente importante, sino porque esa incertidumbre bloquea una decisión con gran valor en juego.

---

# **17\. Prioridades preventivas**

F4 no debe mirar únicamente el daño ocurrido.

Debe poder considerar:

CURRENT DAMAGE

y:

FORWARD DAMAGE

Ejemplo:

Hero SKU:  
20 days stock remaining

Supplier lead time:  
75 days

La situación puede no parecer grave hoy.

Sin embargo, la ventana de intervención puede estar cerrándose.

Por tanto:

CURRENT SEVERITY

puede ser baja mientras:

DECISION URGENCY

es alta.

---

# **18\. Prioridad como protección o desbloqueo de valor**

Una prioridad puede existir porque permite:

PROTECT VALUE

o porque permite:

UNLOCK VALUE

Ejemplos conceptuales:

PROTECT  
checkout failure  
stockout  
cash crisis  
deliverability collapse

UNLOCK  
creative capacity  
conversion bottleneck  
retention opportunity  
margin improvement  
international expansion

F4 deberá ser capaz de comparar ambos tipos.

---

# **19\. Riesgos y oportunidades compiten en la misma cartera**

La cola decisional no debe contener exclusivamente problemas.

Puede recibir:

PROBLEMS  
CONSTRAINTS  
RISKS  
OPPORTUNITIES  
VALIDATION NEEDS

Un ecommerce puede tener simultáneamente:

Risk:  
Hero product stockout

Problem:  
Checkout conversion decline

Opportunity:  
Highly profitable new market

Constraint:  
Creative throughput

Todos compiten por recursos.

---

# **20\. Prioridad y horizonte temporal**

Toda prioridad deberá entenderse dentro de un horizonte:

NOW  
NEXT 24H  
NEXT 7D  
NEXT 30D  
NEXT QUARTER  
LONG TERM

Porque:

PRIORITY\_NOW

puede ser distinta de:

STRATEGIC\_PRIORITY

---

# **21\. Decisión bajo incertidumbre**

El motor no puede asumir conocimiento perfecto.

Toda decisión contiene incertidumbre sobre:

diagnosis  
impact  
timing  
effort  
dependencies  
future states  
business response

Por tanto:

DECISION\_CONFIDENCE

será distinta de:

DIAGNOSTIC\_CONFIDENCE

---

# **22\. Decisiones reversibles e irreversibles**

La reversibilidad modifica cuánto riesgo podemos aceptar.

Una decisión fácilmente reversible permite:

faster decision  
lower information requirement  
experimentation  
short feedback loops

Una decisión difícil de revertir puede exigir:

higher evidence  
greater confidence  
scenario analysis  
more validation  
human approval

La misma incertidumbre no debe tratarse igual en ambos casos.

---

# **23\. Tiempo hasta el daño**

Una métrica fundamental será conceptualmente:

TIME\_TO\_DAMAGE

Pregunta:

> ¿Cuánto tiempo tenemos antes de que no decidir empiece a generar consecuencias materiales?

Relacionado pero distinto:

TIME\_TO\_IRREVERSIBILITY

Pregunta:

> ¿Cuándo dejarán de existir opciones razonables de intervención?

---

# **24\. Cost of Delay**

Esperar también tiene coste.

Por tanto, el motor deberá poder razonar sobre:

COST\_OF\_DELAY

No solo:

VALUE\_OF\_ACTION

Ejemplo:

Issue:  
Stock coverage

Current:  
14 days

Replenishment:  
45 days

Waiting 7 additional days:  
materially increases unavoidable stockout risk

Aunque todavía no exista stockout, esperar destruye opciones.

---

# **25\. Option Value**

Una intervención puede ser importante porque conserva alternativas futuras.

Por tanto:

OPTION VALUE

también puede formar parte del razonamiento.

A veces la mejor decisión inmediata no es la que maximiza valor hoy, sino la que evita cerrar opciones importantes mañana.

---

# **26\. Critical Path**

Algunas capacidades forman parte de rutas críticas.

Ejemplo:

Traffic  
↓  
Product View  
↓  
Cart  
↓  
Checkout  
↓  
Payment  
↓  
Order

Si:

Payment

está roto, optimizar adquisición tiene escaso sentido inmediato.

La posición de un problema dentro del sistema importa.

---

# **27\. Dependencias**

Las iniciativas no son independientes.

Puede existir:

A → B → C

donde:

B cannot meaningfully improve before A.

Entonces A puede recibir precedencia incluso aunque B tenga mayor impacto directo aparente.

---

# **28\. Dominancia**

En determinadas comparaciones una opción puede dominar claramente a otra.

Ejemplo:

A  
higher impact  
higher confidence  
more urgent  
lower effort  
lower risk

B  
lower impact  
lower confidence  
less urgent  
higher effort  
higher risk

En ese caso no necesitamos razonamiento artificialmente complejo.

A DOMINATES B

---

# **29\. Trade-offs reales**

Los casos difíciles aparecen cuando:

A \= greater impact  
B \= greater urgency

A \= greater confidence  
B \= greater upside

A \= easier  
B \= more strategic

A \= short-term protection  
B \= long-term constraint removal

Ahí empieza la verdadera función de F4.

---

# **30\. Anti-pattern: Biggest Number Wins**

Incorrecto:

Revenue decline:  
\-40%

Email decline:  
\-60%

Therefore:  
Email \= Priority \#1

El porcentaje más grande no determina la prioridad.

---

# **31\. Anti-pattern: Loudest Problem Wins**

La prioridad no puede depender de:

founder anxiety  
latest Slack message  
customer complaint volume alone  
agency opinion  
team politics  
recency bias

La IA debe resistir el sesgo de prominencia.

---

# **32\. Anti-pattern: Easy Wins Forever**

Los quick wins pueden ser útiles.

Pero una organización que prioriza sistemáticamente:

small \+ easy

puede ignorar indefinidamente:

large \+ structural

generando:

STRUCTURAL DEBT

---

# **33\. Anti-pattern: Score Worship**

Un score puede apoyar la decisión.

No debe sustituirla.

PRIORITY\_SCORE  
≠  
TRUTH

Los modelos cuantitativos simplifican la realidad.

Dependencias, constraints, emergencias y reglas de negocio pueden justificar excepciones.

---

# **34\. Anti-pattern: False Precision**

Incorrecto:

Priority Score \= 87.4392

cuando los inputs son:

impact \= "probably high"  
effort \= unknown  
confidence \= medium

La precisión del resultado nunca deberá superar la precisión de la evidencia.

---

# **35\. Anti-pattern: Everything is P1**

Si demasiados asuntos reciben:

P1

el sistema ha dejado de priorizar.

F4 debe producir escasez decisional.

---

# **36\. Anti-pattern: Objective Blindness**

La misma situación puede producir prioridades distintas según el objetivo.

Ejemplo:

BUSINESS A  
Objective:  
Cash preservation

BUSINESS B  
Objective:  
Contribution growth

BUSINESS C  
Objective:  
Revenue expansion

No existe un ranking universal independiente de contexto.

---

# **37\. Anti-pattern: Strategic Objective Overrides Survival**

Aunque el motor sea objective-aware, no deberá obedecer ciegamente objetivos declarados.

Ejemplo:

Objective:  
Aggressive growth

Situation:  
Critical cash risk

El crecimiento no convierte mágicamente el riesgo financiero en irrelevante.

Los objetivos operan dentro de guardrails empresariales.

---

# **38\. Anti-pattern: Duplicate Priorities**

Si F3 descubre:

Inventory constraint  
↓  
PDP availability deterioration  
↓  
Conversion deterioration  
↓  
CAC deterioration

F4 no debería necesariamente producir:

Priority 1: Inventory  
Priority 2: Conversion  
Priority 3: CAC

si los tres pertenecen al mismo árbol causal.

La unidad decisional puede ser:

ROOT-LEVEL DECISION

---

# **39\. Resultado conceptual esperado**

F4 deberá evolucionar desde:

WE FOUND 12 PROBLEMS

hasta:

1\. THIS DESERVES ATTENTION FIRST.  
2\. THIS COMES NEXT.  
3\. THIS CAN WAIT.  
4\. THIS REQUIRES MORE EVIDENCE.  
5\. THIS IS BLOCKED BY \#1.  
6\. THIS SHOULD CURRENTLY BE MONITORED.

---

# **40\. Preguntas de razonamiento que el RAG debe enseñar**

Ante cada candidato:

What value is at risk?

What value could be unlocked?

What happens if we wait?

How quickly does the situation deteriorate?

Is damage already accumulating?

When does the intervention window close?

Is this blocking something else?

Is another issue causing this one?

Does another decision need to happen first?

How confident are we?

What is the cost of being wrong?

How reversible is the eventual decision?

Can uncertainty be reduced cheaply?

Does this threaten a critical business path?

Does it affect the current system constraint?

How much of the business is exposed?

Does it support the current business objective?

What resources would it consume?

What are we giving up by choosing it?

What evidence could change its position?

---

# **41\. RAG chunk recommendations**

P0 puede posteriormente dividirse en chunks semánticos aproximadamente como:

f4\_p0\_priority\_definition  
f4\_p0\_priority\_vs\_severity  
f4\_p0\_priority\_vs\_impact  
f4\_p0\_priority\_vs\_urgency  
f4\_p0\_priority\_vs\_constraint  
f4\_p0\_confidence\_and\_validation  
f4\_p0\_effort\_and\_opportunity\_cost  
f4\_p0\_reversibility  
f4\_p0\_time\_to\_damage  
f4\_p0\_cost\_of\_delay  
f4\_p0\_dependencies  
f4\_p0\_critical\_path  
f4\_p0\_decision\_under\_uncertainty  
f4\_p0\_priority\_antipatterns  
f4\_p0\_comparative\_reasoning  
f4\_p0\_decision\_reasoning\_questions

Los chunks deberán poder recuperarse independientemente sin perder la definición canónica de los conceptos.

---

# **PARTE B — IA CONTRACT / RUNTIME**

## **42\. Responsabilidad del motor**

Canonical component:

PRIORITIZATION\_ENGINE

Responsabilidad:

DIAGNOSTIC PORTFOLIO  
\+  
DECISION CONTEXT  
↓  
DECISION QUEUE

Nunca:

DIAGNOSTIC PORTFOLIO  
↓  
PLAYBOOK

---

# **43\. Phase Boundary Contract**

F3 OUTPUT  
DIAGNOSTIC\_RESULT\[\]  
        ↓  
F4  
PRIORITIZATION\_ENGINE  
        ↓  
DECISION\_RESULT  
        ↓  
F5  
STRATEGY / PLAYBOOK ENGINE

Hard invariant:

F4 MUST NOT GENERATE IMPLEMENTATION PLAYBOOKS.

---

# **44\. Input Contract**

Objeto raíz:

PRIORITIZATION\_REQUEST

Esquema conceptual:

PRIORITIZATION\_REQUEST {  
    request\_id,  
    tenant\_id,  
    generated\_at,  
    as\_of,  
    decision\_horizon,

    diagnostic\_snapshot\_id,  
    diagnostic\_candidates\[\],

    business\_context\_ref,  
    maturity\_snapshot\_ref,  
    objective\_context\_ref,

    available\_evidence\_refs\[\],

    engine\_version,  
    schema\_version  
}

---

# **45\. diagnostic\_candidates**

Los candidatos deberán provenir de resultados identificables de F3.

diagnostic\_candidates\[\] {  
    diagnostic\_id,  
    case\_id,  
    capability\_id,

    diagnostic\_type,  
    status,

    root\_cause\_ref,  
    constraint\_ref,

    severity,  
    diagnostic\_confidence,  
    trajectory,

    impact\_ref,  
    temporal\_ref,  
    evidence\_refs\[\],

    parent\_diagnostic\_id?,  
    related\_diagnostic\_ids\[\]  
}

P2 será responsable de su normalización avanzada.

P0 únicamente establece el contrato mínimo de entrada.

---

# **46\. Tipos de candidatos permitidos**

Canonical enum:

DECISION\_CANDIDATE\_TYPE

Valores iniciales:

PROBLEM  
CONSTRAINT  
RISK  
OPPORTUNITY  
VALIDATION\_NEED

No todo diagnóstico tiene por qué convertirse automáticamente en candidato decisional.

---

# **47\. Decision Context**

Objeto obligatorio:

DECISION\_CONTEXT

Conceptualmente:

DECISION\_CONTEXT {  
    as\_of,  
    horizon,

    business\_objectives\[\],  
    protected\_outcomes\[\],

    current\_constraints\[\],  
    resource\_context,  
    risk\_context,

    maturity\_context,  
    known\_commitments\[\],  
    hard\_guardrails\[\]  
}

Su construcción detallada pertenece a P1.

---

# **48\. Decision Horizon Enum**

DECISION\_HORIZON \=  
    IMMEDIATE  
    DAYS  
    WEEKS  
    MONTH  
    QUARTER  
    LONG\_TERM

Los sistemas posteriores podrán almacenar ventanas temporales exactas además del enum.

---

# **49\. Output Contract**

Objeto raíz:

DECISION\_RESULT

DECISION\_RESULT {  
    decision\_result\_id,  
    request\_id,  
    tenant\_id,

    as\_of,  
    horizon,

    decision\_queue\[\],

    deferred\_candidates\[\],  
    validation\_candidates\[\],  
    blocked\_candidates\[\],  
    monitoring\_candidates\[\],  
    excluded\_candidates\[\],

    portfolio\_summary,

    decision\_confidence,

    trace,

    engine\_version,  
    rule\_version,  
    schema\_version,

    created\_at  
}

---

# **50\. Decision Item**

Objeto canónico:

DECISION\_ITEM {  
    rank,  
    candidate\_id,  
    diagnostic\_id,

    decision\_class,  
    priority\_tier,

    why\_now\[\],  
    why\_before\[\],

    primary\_drivers\[\],  
    counterarguments\[\],

    dependencies\[\],  
    blockers\[\],

    value\_at\_risk,  
    value\_to\_unlock,

    time\_sensitivity,  
    decision\_risk,  
    reversibility\_context,

    diagnostic\_confidence,  
    decision\_confidence,

    uncertainty\[\],

    what\_would\_change\_priority\[\],

    evidence\_refs\[\],

    trace\_ref  
}

No todos los campos tendrán necesariamente valores cuantitativos.

`UNKNOWN` será preferible a inventar precisión.

---

# **51\. Decision Class**

Canonical enum:

DECISION\_CLASS \=  
    REQUIRES\_IMMEDIATE\_ATTENTION  
    PRIORITIZE  
    VALIDATE\_FIRST  
    SCHEDULE  
    MONITOR  
    DEFER  
    BLOCKED  
    EXCLUDE

Estos estados describen tratamiento decisional.

No representan todavía un playbook.

---

# **52\. Priority Tier**

Canonical enum:

PRIORITY\_TIER \=  
    P0\_EMERGENCY  
    P1\_CRITICAL  
    P2\_HIGH  
    P3\_MEDIUM  
    P4\_LOW

Importante:

priority\_tier

y:

rank

son conceptos distintos.

Puede haber:

rank \= 1  
priority\_tier \= P2\_HIGH

si ningún asunto actual alcanza criticidad.

---

# **53\. Emergency semantics**

P0\_EMERGENCY

queda reservado a condiciones excepcionales que puedan comprometer inmediatamente:

transaction continuity  
major revenue integrity  
customer safety  
legal/compliance integrity  
security  
business continuity  
catastrophic financial exposure

No debe convertirse en una etiqueta habitual.

---

# **54\. Decision Confidence**

Canonical enum inicial:

DECISION\_CONFIDENCE \=  
    VERY\_LOW  
    LOW  
    MEDIUM  
    HIGH  
    VERY\_HIGH

También:

NOT\_ASSESSABLE

cuando no existe evidencia suficiente.

---

# **55\. Diagnostic Confidence vs Decision Confidence**

Hard invariant:

diagnostic\_confidence  
≠  
decision\_confidence

Ejemplo:

Diagnostic Confidence:  
HIGH

Decision Confidence:  
LOW

puede existir cuando sabemos exactamente cuál es el problema pero no disponemos de suficiente información para compararlo con otras prioridades.

---

# **56\. Mandatory Invariant — Severity**

PRIORITY MUST NOT BE DERIVED SOLELY FROM SEVERITY.

Test obligatorio:

Dos candidatos con diferente `severity` deben poder invertir su orden si cambian otras dimensiones decisionales.

---

# **57\. Mandatory Invariant — Impact**

PRIORITY MUST NOT BE DERIVED SOLELY FROM IMPACT.

---

# **58\. Mandatory Invariant — Effort**

LOWER EFFORT MUST NOT AUTOMATICALLY PRODUCE HIGHER PRIORITY.

---

# **59\. Mandatory Invariant — Constraint**

CURRENT\_CONSTRAINT MUST NOT AUTOMATICALLY BECOME RANK \#1.

---

# **60\. Mandatory Invariant — Confidence**

LOW CONFIDENCE MUST NOT AUTOMATICALLY MEAN LOW PRIORITY.

El motor podrá producir:

VALIDATE\_FIRST

---

# **61\. Mandatory Invariant — Comparative Explanation**

Todo elemento rankeado deberá responder:

WHY\_NOW

y, siempre que exista competencia material:

WHY\_BEFORE

Una explicación puramente absoluta será insuficiente.

---

# **62\. Mandatory Invariant — Traceability**

No podrá existir:

DECISION\_ITEM

sin referencias hacia:

diagnostic  
evidence  
decision context  
rules applied  
engine version

---

# **63\. Mandatory Invariant — Evidence**

El LLM no podrá crear:

revenue exposure  
cash impact  
stock coverage  
confidence  
dependency  
constraint  
effort  
probability

sin soporte identificable.

Cuando falte:

UNKNOWN

o:

NOT\_ASSESSABLE

---

# **64\. Mandatory Invariant — Precision**

OUTPUT\_PRECISION  
\<=  
INPUT\_EVIDENCE\_PRECISION

Si el impacto solo puede clasificarse como:

HIGH

el motor no podrá transformarlo ficticiamente en:

€83,421.72

---

# **65\. Mandatory Invariant — Objective Awareness**

El ranking deberá disponer de:

OBJECTIVE\_CONTEXT

o declarar explícitamente:

OBJECTIVE\_CONTEXT\_MISSING

No podrá asumir silenciosamente:

maximize revenue

como objetivo universal.

---

# **66\. Mandatory Invariant — Guardrails**

Los objetivos declarados no podrán invalidar guardrails críticos.

Conceptualmente:

SURVIVAL  
SECURITY  
LEGAL  
FINANCIAL INTEGRITY  
BUSINESS CONTINUITY

pueden preemptar objetivos ordinarios.

---

# **67\. Mandatory Invariant — Dependencies**

Una dependencia dura podrá modificar el orden aunque contradiga el ranking cuantitativo preliminar.

IF B REQUIRES A  
AND A IS UNRESOLVED  
THEN B MAY NOT BE TREATED AS INDEPENDENTLY EXECUTABLE

---

# **68\. Mandatory Invariant — Root-level deduplication**

Los diagnósticos pertenecientes al mismo árbol causal no deberán inflar artificialmente su importancia mediante duplicación.

Debe existir detección de:

SHARED\_ROOT\_CAUSE  
SHARED\_CONSTRAINT  
DEPENDENT\_SYMPTOMS

antes del ranking final.

Su implementación detallada pertenecerá a P2/P5/P10.

---

# **69\. Mandatory Invariant — Phase Boundary**

El output no deberá contener:

implementation\_steps  
playbook  
campaign\_plan  
code\_changes  
creative\_brief  
exact\_remediation  
execution\_sequence

salvo referencias estructurales necesarias para expresar dependencias decisionales.

---

# **70\. Mandatory Invariant — No artificial ranking**

Si la evidencia no permite distinguir razonablemente A y B:

Incorrecto:

A \= 81.2  
B \= 80.9

Correcto:

A and B are currently decisionally equivalent within available evidence.

El contrato deberá admitir:

TIED

o rangos de equivalencia.

---

# **71\. Mandatory Invariant — Dynamic Priority**

Todo:

DECISION\_RESULT

debe tener:

as\_of

porque las prioridades caducan.

Nunca deberá interpretarse un ranking como verdad permanente.

---

# **72\. Mandatory Invariant — Priority Invalidators**

Cada prioridad material deberá poder declarar:

what\_would\_change\_priority\[\]

Ejemplo:

new inventory arrives  
payment failure resolves  
diagnostic confidence drops  
cash objective changes  
dependency is removed  
revenue exposure revised

Esto convierte la decisión en falsable y actualizable.

---

# **73\. Deterministic Runtime Responsibilities**

El runtime determinista será responsable, como mínimo, de:

schema validation  
tenant validation  
ID integrity  
enum validation  
required fields  
candidate deduplication safeguards  
phase-boundary validation  
hard dependency rules  
guardrail enforcement  
evidence-reference integrity  
version tracking  
trace creation  
confidence ceilings  
output validation

---

# **74\. LLM Responsibilities**

El LLM podrá participar en:

trade-off interpretation  
comparative reasoning  
qualitative synthesis  
rationale generation  
counterargument generation  
uncertainty explanation  
context interpretation  
decision narrative

pero siempre sobre datos y reglas proporcionados por el sistema.

---

# **75\. LLM Forbidden Responsibilities**

El LLM no podrá decidir libremente:

schema  
tenant access  
hard guardrails  
confidence ceilings  
financial calculations  
candidate identity  
rule versions  
mandatory dependencies  
evidence provenance

Ni podrá saltarse deterministicamente una regla porque “parezca razonable”.

---

# **76\. Hybrid Decision Model**

Arquitectura conceptual:

DETERMINISTIC RULES  
        \+  
NORMALIZED DECISION FACTORS  
        \+  
CONSTRAINT / DEPENDENCY LOGIC  
        \+  
LLM COMPARATIVE REASONING  
        ↓  
DECISION RESULT

No:

PROMPT  
↓  
LLM  
↓  
PRIORITY LIST

---

# **77\. Decision Trace**

Cada ejecución deberá generar:

DECISION\_TRACE

Conceptualmente:

DECISION\_TRACE {  
    trace\_id,  
    request\_id,

    candidate\_ids\[\],  
    evidence\_refs\[\],

    objective\_context,  
    active\_constraints\[\],  
    active\_guardrails\[\],

    factors\_considered\[\],  
    rules\_triggered\[\],  
    overrides\_applied\[\],

    ranking\_changes\[\],

    excluded\_candidates\[\],  
    uncertainty\_flags\[\],

    model\_version?,  
    prompt\_version?,  
    engine\_version,  
    rule\_version,

    created\_at  
}

---

# **78\. Observability Questions**

El panel de administración deberá poder responder:

Why was A ranked above B?

Which inputs caused the ranking?

Which objective was active?

Which constraint was active?

Which dependency changed the order?

Was any hard rule triggered?

Was there an override?

Which evidence supported the impact?

What was uncertain?

Which model participated?

Which prompt version was used?

Which engine version generated the ranking?

What changed from the previous ranking?

---

# **79\. Priority Change Event**

Cuando una prioridad cambie materialmente:

PRIORITY\_CHANGED

deberá poder registrarse.

Ejemplo:

Previous:  
Inventory Risk \= Rank \#4

Current:  
Inventory Risk \= Rank \#1

Reason:  
Projected stockout moved from 18 days to 5 days.

Esto será importante posteriormente para F9 — Continuous Learning.

---

# **80\. Exclusion Reasons**

Todo candidato excluido deberá declarar por qué.

Canonical enum inicial:

EXCLUSION\_REASON \=  
    DUPLICATE  
    DOWNSTREAM\_SYMPTOM  
    RESOLVED  
    NON\_MATERIAL  
    OUT\_OF\_SCOPE  
    INSUFFICIENT\_EVIDENCE  
    INVALID\_INPUT  
    SUPERSEDED

`INSUFFICIENT_EVIDENCE` no significa necesariamente descartar.

Puede convertirse en:

VALIDATION\_NEED

si el valor decisional de reducir incertidumbre es material.

---

# **81\. Blocked Candidates**

Un candidato puede ser importante y simultáneamente estar:

BLOCKED

Debe almacenarse:

blocked\_by\[\]

y:

blocking\_reason

Bloqueado no significa poco importante.

---

# **82\. Ranking stability**

El sistema deberá detectar rankings excesivamente sensibles.

Si pequeños cambios razonables en inputs producen:

\#1 → \#7

la decisión es frágil.

Esto deberá reducir:

DECISION\_CONFIDENCE

o generar:

RANKING\_INSTABILITY

---

# **83\. Validation Gates**

Antes de ejecutar el ranking:

INPUT\_SCHEMA\_VALID  
TENANT\_VALID  
DIAGNOSTICS\_PRESENT  
DECISION\_CONTEXT\_AVAILABLE  
EVIDENCE\_REFERENCES\_VALID  
NO\_CRITICAL\_CONTEXT\_CONTRADICTION

Después:

OUTPUT\_SCHEMA\_VALID  
ALL\_RANKS\_TRACEABLE  
NO\_DUPLICATE\_RANKS\_INVALIDLY  
PHASE\_BOUNDARY\_RESPECTED  
NO\_UNSUPPORTED\_FACTS  
NO\_UNEXPLAINED\_OVERRIDE

---

# **84\. Failure States**

Canonical:

PRIORITIZATION\_STATUS \=  
    SUCCESS  
    PARTIAL  
    NOT\_ASSESSABLE  
    INVALID\_INPUT  
    CONTEXT\_INSUFFICIENT  
    CONFLICTING\_EVIDENCE  
    ENGINE\_ERROR

El motor nunca deberá fabricar una cola convincente para ocultar:

CONTEXT\_INSUFFICIENT

---

# **85\. Tests mínimos obligatorios**

### **TEST P0-01 — Severity inversion**

A:  
CRITICAL severity  
1% exposure

B:  
HIGH severity  
70% exposure  
rapidly accumulating damage

Esperado:

System can legitimately rank B \> A.

---

### **TEST P0-02 — Low confidence catastrophic candidate**

Potential impact:  
CRITICAL

Confidence:  
LOW

Validation:  
CHEAP \+ FAST

Esperado:

Candidate must not be silently discarded.  
VALIDATE\_FIRST must be possible.

---

### **TEST P0-03 — Dependency override**

B has greater direct impact than A.

B depends on A.

Esperado:

A may precede B.

---

### **TEST P0-04 — Emergency preemption**

Strategic constraint:  
Creative

Emergency:  
Payment outage

Esperado:

Payment outage can preempt structural constraint.

---

### **TEST P0-05 — Effort bias**

A:  
high impact / high effort

B:  
low impact / low effort

Esperado:

B must not automatically rank above A.

---

### **TEST P0-06 — Objective change**

Mismos diagnósticos.

Context A:  
Cash preservation

Context B:  
Growth

Context C:  
Profitability

Esperado:

Decision ordering may change.

---

### **TEST P0-07 — Missing objective**

objective\_context \= null

Esperado:

System must explicitly flag missing objective context.

No puede asumir silenciosamente growth.

---

### **TEST P0-08 — Duplicate causal chain**

Inventory  
→ availability  
→ conversion  
→ CAC

Esperado:

System must not treat all four as independent root priorities.

---

### **TEST P0-09 — False precision**

Inputs:

impact \= HIGH  
effort \= UNKNOWN

Esperado:

El sistema no produce una falsa precisión matemática.

---

### **TEST P0-10 — Phase contamination**

Input:

checkout problem

Output F4 contiene:

Change payment provider.

Esperado:

FAIL  
PHASE\_BOUNDARY\_VIOLATION

---

### **TEST P0-11 — Decision uncertainty**

Diagnostic confidence:  
HIGH

Candidate comparison evidence:  
WEAK

Esperado:

Decision confidence may be LOW.

---

### **TEST P0-12 — Ranking tie**

A y B son materialmente equivalentes dentro de la precisión disponible.

Esperado:

TIED / equivalent priority range

No fabricar diferencias.

---

### **TEST P0-13 — Guardrail override**

Business objective:  
Growth

Candidate:  
material business continuity risk

Esperado:

El objetivo no puede eliminar la consideración del riesgo crítico.

---

### **TEST P0-14 — Dynamic ranking**

El contexto cambia pero los diagnósticos permanecen iguales.

Esperado:

ranking may change

y el cambio debe ser trazable.

---

# **86\. Evals cualitativos**

Los evals deberán comprobar que la IA:

does not confuse severity with priority

does not confuse confidence with priority

does not reward easy work automatically

reasons comparatively

recognizes dependencies

recognizes critical paths

understands forward risk

understands cost of waiting

surfaces uncertainty

does not invent precision

respects business objectives

respects stronger guardrails

explains ranking changes

does not generate playbooks

---

# **87\. Definition of Done — P0**

P0 estará cerrado cuando:

\[ \] PRIORITIZATION\_REQUEST definido

\[ \] DECISION\_CONTEXT definido conceptualmente

\[ \] DECISION\_RESULT definido

\[ \] DECISION\_ITEM definido

\[ \] DECISION\_CANDIDATE\_TYPE definido

\[ \] DECISION\_CLASS definido

\[ \] PRIORITY\_TIER definido

\[ \] DECISION\_CONFIDENCE separado de DIAGNOSTIC\_CONFIDENCE

\[ \] límites F3 → F4 → F5 formalizados

\[ \] invariantes críticas formalizadas

\[ \] reglas de evidencia definidas

\[ \] reglas de incertidumbre definidas

\[ \] responsabilidades deterministic / LLM separadas

\[ \] trazabilidad definida

\[ \] observabilidad definida

\[ \] failure states definidos

\[ \] tests mínimos definidos

\[ \] evals mínimos definidos

\[ \] prohibido severity-only ranking

\[ \] prohibido impact-only ranking

\[ \] prohibido effort-first ranking

\[ \] prohibido score worship

\[ \] prohibida falsa precisión

\[ \] prohibida generación de playbooks en F4

---

# **88\. Resultado de P0**

Al terminar P0 todavía no sabemos exactamente:

HOW TO RANK

Eso se construirá progresivamente en P1–P10.

Pero ya sabemos:

WHAT A PRIORITY MEANS

WHAT ENTERS F4

WHAT F4 MUST PRODUCE

WHAT F4 IS NOT ALLOWED TO DO

WHAT MUST BE TRACEABLE

WHAT CANNOT BE LEFT TO THE LLM

WHAT CONCEPTS MUST REMAIN DISTINCT

Y, sobre todo:

> **La misión de Fase 4 no es generar una lista ordenada que parezca inteligente. Es producir una decisión comparativa, contextual, trazable, falsable y defendible sobre dónde debe concentrarse primero la atención limitada del negocio.**

