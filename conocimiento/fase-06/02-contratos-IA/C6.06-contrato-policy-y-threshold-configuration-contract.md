# **C6.6 — POLICY & THRESHOLD CONFIGURATION CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Policy & Threshold Configuration Contract define cómo EcomScaling IA configura, hereda, versiona, sobrescribe y resuelve las reglas específicas que determinan qué benchmarks, thresholds, guardrails y criterios deben aplicarse a cada ecommerce.

Su misión es responder:

> **¿Qué política concreta debe aplicar este negocio en este contexto?**

C6.6 es la capa que separa:

KNOWLEDGE

de:

POLICY

El conocimiento puede establecer:

CAC debe evaluarse contra economics.

Pero una policy específica puede establecer:

maximum\_sustainable\_cac \= €43

para un negocio concreto.

Por tanto:

Knowledge explains the principle.

Policy configures the rule.

---

# **2\. PROBLEMA QUE RESUELVE**

Sin C6.6, la implementación tendería a convertirse en:

if tenant \== A:  
    max\_cac \= 43

if tenant \== B:  
    max\_cac \= 62

if category \== fashion:  
    cvr\_warning \= 0.02

if market \== Spain:  
    ...

Este enfoque produciría:

hardcoded business logic

poor maintainability

inconsistent overrides

no auditability

no historical replay

difficult multi-tenant support

rule conflicts

uncontrolled complexity

C6.6 debe impedir que el runtime evolucione hacia una colección gigantesca de:

if metric \< X

---

# **3\. PRINCIPIO FUNDAMENTAL**

La lógica general debe permanecer estable.

Los valores específicos deben poder variar mediante configuración.

Conceptualmente:

ENGINE  
\+  
POLICY  
\+  
CONTEXT  
\=  
EFFECTIVE RULE

El engine no debería necesitar modificaciones porque:

Tenant A:  
max sustainable CAC \= €45

y:

Tenant B:  
max sustainable CAC \= €78

---

# **4\. SEGUNDO PRINCIPIO**

Debe mantenerse:

Knowledge  
≠  
Policy  
≠  
Configuration  
≠  
Runtime Resolution

Knowledge:

CAC sustainability depends on unit economics.

Policy:

Use 90-day contribution economics.

Configuration:

required\_payback\_days \= 90

Runtime resolution:

resolved maximum CAC \= €47.80

---

# **5\. TERCER PRINCIPIO**

Toda policy material debe ser:

explicit

versioned

scoped

traceable

auditable

reproducible

Nunca:

hidden application logic.

---

# **6\. RESPONSABILIDAD**

C6.6 debe definir:

WHAT policy exists?

WHO owns it?

WHERE does it apply?

WHEN does it apply?

WHAT does it configure?

WHAT does it override?

WHAT does it inherit?

WHAT precedence does it have?

WHAT conditions activate it?

WHAT version is active?

WHAT values does it provide?

WHAT conflicts exist?

HOW are conflicts resolved?

WHAT effective configuration results?

---

# **7\. LO QUE C6.6 NO DEBE HACER**

C6.6 NO debe:

evaluate metrics

select the final benchmark

detect guardrail breaches

determine business status

diagnose causes

assign business priority

recommend actions

Su responsabilidad termina en:

effective policy/configuration

---

# **8\. POLICY OBJECT**

La unidad principal será conceptualmente:

POLICY\_DEFINITION

---

# **9\. POLICY\_ID**

Toda policy debe disponer de:

policy\_id

estable.

Ejemplo:

policy.acquisition.cac\_sustainability

---

# **10\. POLICY\_VERSION**

Debe existir:

policy\_version

Ejemplo:

4.3.0

---

# **11\. POLICY BUNDLE**

Las policies pueden agruparse en:

POLICY\_BUNDLE

Ejemplo:

tenant\_policy\_bundle\_2026\_Q3

---

# **12\. POLICY\_BUNDLE\_VERSION**

Debe existir:

policy\_bundle\_version

C6.0 ya registra qué bundle utilizó cada ejecución.

---

# **13\. POLICY TYPE**

Taxonomía inicial:

threshold\_policy

benchmark\_policy

guardrail\_policy

quality\_policy

comparability\_policy

confidence\_policy

resolution\_policy

governance\_policy

capability\_policy

---

# **14\. THRESHOLD POLICY**

Define valores o reglas para obtener thresholds.

Ejemplo:

maximum CAC

minimum margin

maximum stock aging

---

# **15\. BENCHMARK POLICY**

Define qué clases de benchmarks pueden utilizarse o preferirse.

Ejemplo:

prefer internal same-season benchmarks  
over external industry references

---

# **16\. GUARDRAIL POLICY**

Configura guardrails.

Ejemplo:

use 15% safety buffer  
over theoretical break-even CAC

---

# **17\. QUALITY POLICY**

Define requisitos de calidad.

Ejemplo:

minimum identified customer coverage  
for retention analysis

---

# **18\. COMPARABILITY POLICY**

Puede definir:

minimum comparable dimensions

hard incompatibilities

acceptable context distance

---

# **19\. CONFIDENCE POLICY**

Podrá definir posteriormente reglas sobre:

minimum evidence strength

confidence caps

uncertainty requirements

C6.8 consumirá esas reglas.

---

# **20\. RESOLUTION POLICY**

Define cómo resolver:

conflicting rules

multiple references

multiple guardrails

scope inheritance

---

# **21\. GOVERNANCE POLICY**

Puede controlar:

who can modify policies

approval requirements

activation process

---

# **22\. CAPABILITY POLICY**

Puede habilitar funcionalidades.

Ejemplo:

advanced peer benchmarking enabled

Pero nunca:

lower reasoning quality

por plan.

---

# **23\. POLICY SOURCE**

Toda policy debe tener origen.

Valores conceptuales:

system\_default

tenant\_configured

business\_configured

derived\_economics

admin\_configured

contractual

operational

risk\_management

---

# **24\. SYSTEM DEFAULT**

Representa configuración por defecto de EcomScaling.

Debe utilizarse solo cuando:

no more specific valid policy exists

---

# **25\. TENANT CONFIGURATION**

Aplica a toda una organización.

Ejemplo:

minimum acceptable payback period policy

---

# **26\. BUSINESS CONFIGURATION**

Aplica a un ecommerce concreto.

---

# **27\. MARKET CONFIGURATION**

Aplica a:

Spain

Germany

France

u otro mercado.

---

# **28\. SEGMENT CONFIGURATION**

Puede aplicar a:

new customers

VIP customers

subscriptions

specific SKU category

---

# **29\. POLICY SCOPE**

Debe existir un objeto estructurado:

policy\_scope

que pueda incluir:

tenant

workspace

business

market

category

product

customer segment

channel

metric

maturity

business model

---

# **30\. SCOPE SPECIFICITY**

Cuanto más específico sea un scope, mayor puede ser su precedencia.

Ejemplo:

system  
\<  
tenant  
\<  
business  
\<  
market  
\<  
segment

Pero esta jerarquía debe estar explícitamente definida.

---

# **31\. NO IMPLICIT PRECEDENCE**

No debemos asumir silenciosamente:

more specific always wins

sin policy de resolución.

Debe existir:

precedence model

formal.

---

# **32\. PRECEDENCE MODEL**

Propuesta conceptual inicial:

explicit emergency override  
\>  
explicit segment override  
\>  
market-specific business policy  
\>  
business policy  
\>  
workspace policy  
\>  
tenant policy  
\>  
system default

Este orden debe poder configurarse cuando sea necesario.

---

# **33\. PRIORITY FIELD**

Puede existir:

resolution\_priority

para casos complejos.

No confundir con:

business priority

de Fase 4\.

---

# **34\. INHERITANCE**

Debe soportarse:

inheritance

Ejemplo:

Tenant:

payback\_limit \= 90 days

Business A hereda:

90 days

Business B sobrescribe:

60 days

---

# **35\. PARTIAL OVERRIDE**

Una policy hija no debe copiar toda la policy padre.

Puede sobrescribir únicamente:

risk threshold

manteniendo:

warning

critical

methodology

del padre.

---

# **36\. MERGE STRATEGY**

Debe poder declararse:

replace

merge

extend

deny

según el campo.

---

# **37\. REPLACE**

El valor hijo sustituye completamente al padre.

---

# **38\. MERGE**

Combina estructuras.

---

# **39\. EXTEND**

Añade reglas adicionales.

---

# **40\. DENY**

Impide override en ciertos campos.

Ejemplo:

regulatory policy

puede ser no-overridable por tenant.

---

# **41\. OVERRIDE**

Toda sobrescritura debe identificar:

override\_of

override\_reason

override\_source

effective period

---

# **42\. NO SILENT OVERRIDE**

Nunca:

parent value disappears

sin dejar rastro.

---

# **43\. EFFECTIVE CONFIGURATION**

El resultado final del proceso será conceptualmente:

EFFECTIVE\_POLICY

---

# **44\. EFFECTIVE POLICY SNAPSHOT**

Debe poder existir:

effective\_policy\_snapshot\_id

para congelar la configuración aplicada.

---

# **45\. IMPORTANCIA DEL SNAPSHOT**

Supongamos:

September:  
payback limit \= 90 days

En octubre:

payback limit \= 60 days

Una evaluación de septiembre debe conservar:

90-day policy

y no reinterpretarse automáticamente con:

60 days

---

# **46\. CONFIGURATION SNAPSHOT RELATION**

C6.0 contiene:

configuration\_snapshot\_id

C6.6 debe resolver dentro de ese snapshot.

---

# **47\. IMMUTABILITY**

Un policy snapshot utilizado históricamente debe considerarse inmutable.

---

# **48\. POLICY STATUS**

Estados:

draft

pending\_approval

active

deprecated

retired

---

# **49\. DRAFT**

No puede utilizarse en producción.

---

# **50\. PENDING APPROVAL**

Está definida pero todavía no activa.

---

# **51\. ACTIVE**

Participa en resolución.

---

# **52\. DEPRECATED**

Se mantiene para replay.

---

# **53\. RETIRED**

Solo histórico.

---

# **54\. EFFECTIVE DATES**

Debe soportar:

effective\_from

effective\_to

---

# **55\. FUTURE POLICY**

Puede crearse hoy una policy que entre en vigor:

next quarter

---

# **56\. EXPIRED POLICY**

No debe utilizarse para nuevas evaluaciones.

---

# **57\. POLICY CONDITIONS**

Una policy puede activarse únicamente cuando se cumplen condiciones.

Ejemplo:

market \= Spain

customer\_type \= new

metric \= marginal\_CAC

---

# **58\. CONDITION MODEL**

Debe ser estructurado.

No:

"when CAC is for Spain"

sino algo equivalente a:

metric\_id \== acquisition.new\_customer\_cac

market \== ES

marginality\_scope \== marginal

---

# **59\. CONDITION OPERATORS**

Puede ser necesario soportar:

equals

not\_equals

in

not\_in

greater\_than

less\_than

between

exists

not\_exists

---

# **60\. COMPOUND CONDITIONS**

Debe permitir:

AND

OR

NOT

con límites para evitar rules engines incontrolables.

---

# **61\. CONDITION COMPLEXITY**

No queremos convertir C6.6 en un lenguaje de programación arbitrario.

Las conditions deben ser:

declarative

bounded

validated

versioned

---

# **62\. NO ARBITRARY CODE**

Una policy no debería almacenar:

eval("whatever javascript")

o código libre.

Eso destruiría:

security

auditability

determinism

---

# **63\. POLICY VALUES**

Una policy puede proporcionar:

scalar

range

percentage

duration

boolean

enum

formula reference

reference ID

rule set

---

# **64\. SCALAR EXAMPLE**

maximum\_cac \= 45 EUR

---

# **65\. RANGE EXAMPLE**

healthy\_stock\_coverage:  
30–70 days

---

# **66\. PERCENTAGE EXAMPLE**

safety\_buffer \= 15%

---

# **67\. DURATION EXAMPLE**

maximum\_payback \= 90 days

---

# **68\. FORMULA REFERENCE**

Puede proporcionar:

formula\_id  
formula\_version

en lugar de un valor fijo.

---

# **69\. DYNAMIC POLICY**

Ejemplo:

maximum sustainable CAC  
\=  
customer contribution  
\*  
risk-adjusted acquisition factor

---

# **70\. POLICY PARAMETER**

Puede existir:

policy\_parameter

Ejemplo:

acquisition\_risk\_buffer \= 0.15

---

# **71\. PARAMETER\_ID**

Cada parámetro importante debe tener identidad estable.

---

# **72\. PARAMETER TYPE**

Debe declararse:

currency

percentage

ratio

days

integer

boolean

enum

---

# **73\. PARAMETER VALIDATION**

Ejemplo:

safety\_buffer \= 250%

podría ser técnicamente válido como porcentaje pero inválido para una policy concreta.

Debe soportar:

min

max

allowed values

---

# **74\. BUSINESS ECONOMICS INPUT**

Policy puede consumir economics como:

gross margin

contribution

AOV

repeat contribution

refund cost

payment fees

Pero no debe duplicar esos datos como constants si cambian dinámicamente.

---

# **75\. CONFIGURATION VS LIVE DATA**

Debe diferenciarse:

configured parameter

de:

live measured input

Ejemplo:

required\_payback\_days \= 90

es configuración.

current contribution margin \= 31%

es dato observado.

---

# **76\. DERIVED THRESHOLD**

C6.6 puede proporcionar inputs para que C6.5 resuelva:

maximum sustainable CAC

---

# **77\. STATIC THRESHOLD POLICY**

Ejemplo:

maximum acceptable support response:  
24 hours

---

# **78\. DYNAMIC THRESHOLD POLICY**

Ejemplo:

maximum CAC  
derived from contribution economics

---

# **79\. POLICY GRANULARITY**

Debe evitarse crear policies innecesariamente específicas.

Incorrecto:

one policy per campaign

si existe una regla business-level válida.

---

# **80\. DEFAULTS**

Debe existir soporte para:

default values

pero estos deben estar explícitamente identificados.

---

# **81\. DEFAULT ≠ UNIVERSAL TRUTH**

Un default significa:

fallback configuration

No:

globally correct threshold

---

# **82\. COLD START POLICY**

Cuando un ecommerce todavía no dispone de economics suficientes, puede existir una policy:

cold\_start

que permita utilizar:

conservative defaults

peer references

indeterminate outcomes

---

# **83\. COLD START NO DEBE INVENTAR PRECISIÓN**

Ejemplo:

Si no conocemos contribution:

maximum sustainable CAC \= unknown

puede ser mejor que:

maximum sustainable CAC \= €50

inventado.

---

# **84\. FALLBACK POLICY**

Debe existir un mecanismo explícito.

Ejemplo:

business-specific  
↓  
tenant default  
↓  
system conservative fallback  
↓  
unresolved

---

# **85\. UNRESOLVED ES VÁLIDO**

El resolver debe poder terminar en:

unresolved

si ninguna policy válida existe.

---

# **86\. NO FORCED CONFIGURATION**

No fabricar:

threshold

solo porque el engine espera uno.

---

# **87\. POLICY CONFLICT**

Debe poder existir:

POLICY\_CONFLICT

cuando varias policies aplicables se contradicen.

---

# **88\. CONFLICT EXAMPLE**

Tenant:

maximum payback \= 90 days

Business:

maximum payback \= 120 days

Policy global:

business overrides tenant

No existe conflicto real.

---

# **89\. TRUE CONFLICT**

Dos policies del mismo scope y prioridad:

Policy A:  
maximum CAC \= €45

Policy B:  
maximum CAC \= €52

activas simultáneamente.

Debe detectarse.

---

# **90\. NO RANDOM CONFLICT RESOLUTION**

Nunca:

take first record returned by database

---

# **91\. CONFLICT RESOLUTION STRATEGY**

Puede ser:

higher\_priority

more\_specific

latest\_explicit\_override

most\_conservative

manual\_review

fail\_closed

según policy type.

---

# **92\. MOST CONSERVATIVE**

Puede ser válido para algunas reglas de riesgo.

Pero no debe aplicarse universalmente.

---

# **93\. FAIL CLOSED**

En conflictos críticos:

do not evaluate

hasta resolver.

---

# **94\. MANUAL REVIEW**

Puede producir:

policy\_resolution\_status \=  
manual\_review\_required

---

# **95\. POLICY RESOLUTION STATUS**

Estados:

resolved

resolved\_with\_fallback

partially\_resolved

conflict

unresolved

not\_applicable

---

# **96\. RESOLVED**

Existe policy inequívoca.

---

# **97\. RESOLVED WITH FALLBACK**

Se utilizó una policy menos específica.

---

# **98\. PARTIALLY RESOLVED**

Algunos parámetros existen y otros no.

---

# **99\. CONFLICT**

Existen reglas incompatibles.

---

# **100\. UNRESOLVED**

No existe configuración suficiente.

---

# **101\. NOT APPLICABLE**

La policy no corresponde al contexto.

---

# **102\. POLICY TRACE**

Toda resolución debe conservar:

candidate policies

matched policies

rejected policies

applied policy

inheritance chain

overrides

fallbacks

conflicts

---

# **103\. WHY APPLIED**

Debe existir:

resolution\_reason

Ejemplo:

Business-level Spain policy  
overrides tenant default.

---

# **104\. WHY REJECTED**

También:

rejection\_reason

Ejemplo:

Policy applies only to Germany.

---

# **105\. POLICY PROVENANCE**

Debe conocerse:

who configured it

when

why

what version

cuando corresponda.

---

# **106\. GOVERNANCE**

Puede existir:

created\_by\_ref

approved\_by\_ref

approved\_at

change\_reason

---

# **107\. CHANGE REASON**

Toda modificación material debería poder registrar:

margin changed

new market launched

finance policy updated

risk tolerance changed

operational capacity changed

---

# **108\. NO HUMAN PII REQUIREMENT**

Preferir:

user\_ref

a almacenar datos personales innecesarios.

---

# **109\. POLICY CHANGESET**

Puede existir:

POLICY\_CHANGESET

para agrupar múltiples cambios.

Ejemplo:

2026 Q4 economics update

---

# **110\. CHANGESET ID**

Debe permitir auditoría.

---

# **111\. ATOMIC ACTIVATION**

Idealmente un conjunto de policies relacionadas debe poder activarse conjuntamente.

Evitar estados inconsistentes como:

new CAC threshold active

old contribution assumptions still active

---

# **112\. POLICY DEPENDENCIES**

Una policy puede depender de otra.

Ejemplo:

scale policy  
depends on  
cash policy  
inventory policy  
CAC policy

---

# **113\. DEPENDENCY GRAPH**

Debe detectarse:

cycles

Ejemplo inválido:

Policy A depends on B  
Policy B depends on A

si no existe soporte explícito.

---

# **114\. CIRCULAR DEPENDENCY**

Debe rechazarse o resolverse explícitamente.

---

# **115\. POLICY COMPOSITION**

Puede ser útil componer:

base policy  
\+  
market policy  
\+  
business override

---

# **116\. EXAMPLE**

Base:

payback \= 90 days

Business:

Spain inherits 90

Germany override:

payback \= 120

Scale campaign segment:

risk buffer \+10%

---

# **117\. POLICY NAMESPACE**

Debe existir organización lógica.

Ejemplo:

acquisition.\*

cro.\*

retention.\*

economics.\*

inventory.\*

operations.\*

scalability.\*

---

# **118\. POLICY REGISTRY**

Todas las policies deben pertenecer conceptualmente a:

POLICY\_REGISTRY

---

# **119\. POLICY SCHEMA VERSION**

Además de policy version puede existir:

policy\_schema\_version

para distinguir estructura contractual de contenido de policy.

---

# **120\. CONTRACT VERSION VS POLICY VERSION**

No confundir:

contract\_version

con:

policy\_version

Contrato:

cómo se representa una policy

Policy:

qué regla concreta está configurada

---

# **121\. BENCHMARK POLICY EXAMPLE**

policy\_id:  
policy.benchmark.cac\_reference\_order

rules:

1\. own economics

2\. comparable internal history

3\. internal cohort

4\. peer group

5\. industry

6\. generic

---

# **122\. COMPARABILITY POLICY EXAMPLE**

metric:  
purchase\_cvr

critical dimensions:  
device  
customer\_type  
funnel\_definition

important dimensions:  
channel\_role  
market  
traffic\_temperature

---

# **123\. DATA QUALITY POLICY EXAMPLE**

metric:  
new\_customer\_cac

minimum customer identity coverage:  
90%

maximum source age:  
24h

required:  
complete paid spend

Los valores son ejemplo de estructura.

No reglas universales.

---

# **124\. GUARDRAIL POLICY EXAMPLE**

guardrail:  
maximum sustainable CAC

payback requirement:  
90 days

safety buffer:  
15%

currency:  
EUR

---

# **125\. SCALE POLICY EXAMPLE**

scale permitted only when:

marginal CAC guardrail:  
safe

inventory headroom:  
safe

cash guardrail:  
safe

operations capacity:  
safe

Fase 6 solo evalúa esas condiciones.

No escala campañas.

---

# **126\. CAPABILITY CONFIGURATION**

C6.6 debe admitir:

capabilities

para evolución futura.

Ejemplos:

peer benchmarking

advanced anomaly detection

forecast guardrails

cross-market analysis

---

# **127\. PLAN ≠ CAPABILITY LOGIC DIRECTLY**

No debemos escribir:

if plan \== Scale

en todo el runtime.

Debe existir:

capability\_profile

resuelto previamente.

---

# **128\. REASONING QUALITY INVARIANT**

Debe permanecer:

subscription tier  
must not reduce  
reasoning correctness.

---

# **129\. POLICY SAFETY**

Algunas policies no deben poder sobrescribirse desde configuración de tenant.

Ejemplo:

security boundary

privacy restriction

cross-tenant isolation

---

# **130\. SYSTEM-PROTECTED POLICY**

Puede existir:

override\_allowed \= false

---

# **131\. TENANT-OVERRIDABLE POLICY**

Otras:

override\_allowed \= true

---

# **132\. OVERRIDE CONSTRAINTS**

Puede permitirse override solo dentro de:

minimum

maximum

allowed enum

---

# **133\. EXAMPLE**

System policy:

minimum peer group size \>= X

Tenant no puede bajar por debajo de un límite de privacidad.

---

# **134\. POLICY VALIDATION**

Antes de activar debe validarse:

schema valid?

scope valid?

conditions valid?

parameters valid?

dependencies valid?

no forbidden override?

no circular dependency?

effective dates valid?

conflicts detected?

approval satisfied?

---

# **135\. PRE-ACTIVATION VALIDATION**

Una policy inválida no debe entrar en producción.

---

# **136\. DRY RUN**

Debe ser posible conceptualmente ejecutar:

policy simulation

antes de activarla.

---

# **137\. SIMULATION EXAMPLE**

Pregunta:

¿Qué evaluaciones cambiarían  
si el maximum CAC baja de €50 a €45?

C6.6 debería permitir preparar esta simulación.

---

# **138\. IMPACT ANALYSIS**

Puede existir:

policy\_impact\_analysis

en futuras capacidades.

No es obligatorio en el contrato mínimo, pero la arquitectura debe permitirlo.

---

# **139\. POLICY ACTIVATION**

Debe poder diferenciar:

created

validated

approved

activated

---

# **140\. ROLLBACK**

Debe poder activarse una versión anterior.

Nunca sobrescribir historia.

---

# **141\. ROLLBACK RELATIONSHIP**

Puede existir:

rollback\_to\_version

---

# **142\. EMERGENCY OVERRIDE**

Puede existir una policy temporal de emergencia.

Ejemplo:

warehouse capacity incident

---

# **143\. EMERGENCY EXPIRY**

Debe exigir:

effective\_to

o revisión explícita.

Evitar overrides temporales que queden activos indefinidamente.

---

# **144\. TEMPORARY POLICY**

Debe poder etiquetarse:

temporary \= true

---

# **145\. POLICY SOURCE OF TRUTH**

Debe existir una única fuente canónica.

No mantener thresholds simultáneamente en:

database

code

prompt

spreadsheet

RAG

sin gobernanza.

---

# **146\. RAG NO ES POLICY STORE**

Regla crítica:

RAG must not be  
the source of truth  
for tenant thresholds.

El RAG puede saber:

qué significa CAC

pero no debería decidir arbitrariamente:

max CAC \= €45

para un cliente.

---

# **147\. PROMPT NO ES POLICY STORE**

Tampoco:

hidden prompt instructions

deben contener la configuración efectiva del negocio.

---

# **148\. POLICY STORAGE PRINCIPLE**

La policy efectiva debe residir en configuración estructurada y versionada.

---

# **149\. POLICY RESOLUTION PIPELINE**

Conceptualmente:

Runtime Context  
        ↓  
Metric Semantics  
        ↓  
Business Context  
        ↓  
Policy Candidates  
        ↓  
Scope Matching  
        ↓  
Condition Matching  
        ↓  
Precedence  
        ↓  
Inheritance  
        ↓  
Overrides  
        ↓  
Conflict Resolution  
        ↓  
Effective Policy

---

# **150\. POLICY CANDIDATE**

Toda policy potencialmente aplicable debe poder convertirse en:

POLICY\_CANDIDATE

---

# **151\. MATCH STATUS**

Puede ser:

matched

partially\_matched

rejected

not\_applicable

---

# **152\. MATCH REASONS**

Debe registrar:

matched\_dimensions

failed\_conditions

missing\_context

---

# **153\. RESOLUTION RESULT**

C6.6 debe producir:

POLICY\_RESOLUTION\_RESULT

---

# **154\. POLICY RESOLUTION SHAPE**

Conceptualmente:

policy\_resolution:

    identity:  
        resolution\_id  
        run\_id

    target:  
        policy\_domain  
        metric\_id  
        context\_id

    candidates:  
        candidate\_policy\_ids

    matching:  
        matched  
        rejected

    precedence:  
        precedence\_model

    inheritance:  
        inherited\_values

    overrides:  
        applied\_overrides

    conflicts:  
        detected\_conflicts

    fallback:  
        fallback\_used

    result:  
        effective\_policy\_id  
        effective\_policy\_version  
        effective\_parameters  
        resolution\_status

    trace:  
        resolution\_reason

---

# **155\. POLICY DEFINITION SHAPE**

Conceptualmente:

policy\_definition:

    identity:  
        policy\_id  
        policy\_version  
        policy\_bundle\_version

    classification:  
        policy\_type  
        policy\_namespace

    scope:  
        tenant  
        workspace  
        business  
        market  
        segment  
        product  
        channel  
        metric  
        maturity

    conditions:  
        activation\_conditions

    configuration:  
        parameters  
        formula\_refs  
        benchmark\_preferences  
        guardrail\_settings

    inheritance:  
        parent\_policy  
        merge\_strategy

    overrides:  
        override\_allowed  
        override\_constraints

    resolution:  
        priority  
        conflict\_strategy

    governance:  
        source  
        owner  
        status  
        approval

    temporal:  
        effective\_from  
        effective\_to

    relationships:  
        supersedes  
        depends\_on  
        override\_of

---

# **156\. EXAMPLE — TENANT \+ BUSINESS OVERRIDE**

Tenant:

policy:  
maximum payback

value:  
90 days

Business A:

inherits  
90 days

Business B:

override:  
60 days

Resolved:

Business A:  
90

Business B:  
60

---

# **157\. EXAMPLE — MARKET OVERRIDE**

Business policy:

CAC risk buffer:  
10%

Germany:

CAC risk buffer:  
20%

Spain:

inherits 10%

---

# **158\. EXAMPLE — CONDITIONAL POLICY**

metric:  
marginal CAC

market:  
Spain

customer\_type:  
new

if:  
business\_maturity \= scaling

then:  
apply scale acquisition policy

---

# **159\. EXAMPLE — FALLBACK**

No business-specific policy.

No market policy.

Tenant default exists.

Resultado:

resolved\_with\_fallback:  
tenant policy

---

# **160\. EXAMPLE — UNRESOLVED**

No business policy.

No tenant policy.

System default explicitly forbidden.

Resultado:

unresolved

Eso es correcto.

---

# **161\. EXAMPLE — CONFLICT**

Policy A:

scope:  
business \+ Spain

max CAC:  
€45

Policy B:

scope:  
business \+ Spain

max CAC:  
€50

same priority  
same effective window

Resultado:

conflict

No elegir arbitrariamente.

---

# **162\. INVARIANTES C6.6**

## **INV-C6.6-001**

Toda policy debe tener:

policy\_id

---

## **INV-C6.6-002**

Toda policy debe tener versión.

---

## **INV-C6.6-003**

Toda policy debe tener scope.

---

## **INV-C6.6-004**

Toda policy material debe tener origen.

---

## **INV-C6.6-005**

No debe existir configuración material escondida únicamente en código.

---

## **INV-C6.6-006**

No debe existir configuración material escondida únicamente en prompts.

---

## **INV-C6.6-007**

RAG no debe actuar como fuente de verdad de thresholds tenant-specific.

---

## **INV-C6.6-008**

Las políticas deben ser reproducibles históricamente.

---

## **INV-C6.6-009**

Una policy activa publicada debe ser inmutable.

---

## **INV-C6.6-010**

Cambios materiales requieren nueva versión.

---

## **INV-C6.6-011**

No resolver conflictos arbitrariamente.

---

## **INV-C6.6-012**

Debe existir estado `unresolved`.

---

## **INV-C6.6-013**

Debe existir estado `conflict`.

---

## **INV-C6.6-014**

Las policies deben respetar aislamiento multi-tenant.

---

## **INV-C6.6-015**

Un override debe ser explícito.

---

## **INV-C6.6-016**

Un fallback debe ser explícito.

---

## **INV-C6.6-017**

Las reglas protegidas no pueden sobrescribirse desde tenant config.

---

## **INV-C6.6-018**

El plan comercial no debe degradar razonamiento.

---

## **INV-C6.6-019**

Las conditions deben ser declarativas y validadas.

---

## **INV-C6.6-020**

No ejecutar código arbitrario almacenado como policy.

---

## **INV-C6.6-021**

Historical replay debe recuperar la policy histórica.

---

## **INV-C6.6-022**

Un policy conflict crítico debe poder bloquear resolución.

---

## **INV-C6.6-023**

No inventar threshold cuando policy resolution falla.

---

## **INV-C6.6-024**

Configuration y live business data deben mantenerse separados.

---

## **INV-C6.6-025**

Contract version y policy version son conceptos distintos.

---

# **163\. VALIDACIONES MÍNIMAS**

Antes de activar una policy:

policy ID valid?

version valid?

scope valid?

parameters typed?

conditions valid?

references exist?

formulas exist?

dependencies valid?

no circular dependency?

effective dates coherent?

override permissions valid?

conflicts checked?

tenant boundary valid?

approval requirements satisfied?

---

# **164\. VALIDACIÓN DE PARÁMETROS**

Debe detectar:

wrong unit

wrong currency

invalid enum

out-of-range value

missing required parameter

---

# **165\. VALIDACIÓN DE CONDICIONES**

Debe impedir condiciones imposibles.

Ejemplo:

market \= Spain  
AND  
market \= Germany

salvo semántica explícita de múltiples mercados.

---

# **166\. VALIDACIÓN DE DEPENDENCIAS**

Las policies referenciadas deben existir y ser compatibles.

---

# **167\. VALIDACIÓN DE CICLOS**

Debe detectar dependencias circulares.

---

# **168\. VALIDACIÓN DE OVERRIDE**

Un tenant no puede sobrescribir:

system-protected policy

---

# **169\. VALIDACIÓN TEMPORAL**

No deben existir, salvo intención explícita:

two active conflicting versions  
for same scope and same period

---

# **170\. VALIDACIÓN DE BUNDLE**

Un policy bundle debe ser internamente consistente.

---

# **171\. RELACIÓN CON C6.0**

C6.0 proporciona:

tenant

business

configuration\_snapshot\_id

policy\_bundle\_version

run

C6.6 resuelve la configuración efectiva para ese runtime.

---

# **172\. RELACIÓN CON C6.1**

C6.1 aporta:

metric\_id

metric semantics

que permiten seleccionar policy correcta.

---

# **173\. RELACIÓN CON C6.2**

C6.2 aporta:

market

maturity

channel

customer type

segment

seasonality

para scope matching.

---

# **174\. RELACIÓN CON C6.3**

C6.6 puede definir requisitos mínimos de calidad que C6.3 debe cumplir.

---

# **175\. RELACIÓN CON C6.4**

C6.6 puede definir:

benchmark preference policy

allowed reference types

fallback hierarchy

---

# **176\. RELACIÓN CON C6.5**

C6.5 define:

qué estructura tiene el guardrail

C6.6 proporciona:

qué parámetros y thresholds utiliza

---

# **177\. RELACIÓN CON C6.7**

C6.7 consumirá las policies ya resueltas y decidirá:

qué reference

qué guardrail

qué policy efectiva

debe participar en la evaluación concreta.

---

# **178\. RELACIÓN CON C6.8**

C6.6 puede proporcionar policies para:

confidence caps

minimum evidence

uncertainty handling

---

# **179\. RELACIÓN CON C6.9**

C6.9 consume la configuración resuelta.

No debe buscar thresholds directamente en código.

---

# **180\. RELACIÓN CON C6.10**

Anomaly Detection puede consumir policies como:

minimum history

sensitivity

detection window

---

# **181\. RELACIÓN CON C6.11**

Pattern Detection puede consumir:

pattern activation rules

minimum signal count

conflict handling

---

# **182\. RELACIÓN CON C6.12**

C6.12 debe reconstruir:

what policy existed

what version

what inherited value

what override

why it applied

---

# **183\. RELACIÓN CON C6.13**

Findings deben poder referenciar:

effective\_policy\_snapshot

sin duplicarlo todo.

---

# **184\. RELACIÓN CON C6.15**

El panel admin deberá poder consultar:

¿Qué policy estaba activa?

¿Qué override ganó?

¿Qué fallback se utilizó?

¿Qué conflictos ocurrieron?

¿Cuándo cambió el threshold?

---

# **185\. TESTS MÍNIMOS**

## **TEST 1 — System Default**

Debe utilizar default cuando no exista policy más específica y el fallback esté permitido.

---

## **TEST 2 — Tenant Override**

Tenant policy debe superar system default.

---

## **TEST 3 — Business Override**

Business policy debe superar tenant cuando precedence lo indique.

---

## **TEST 4 — Market Override**

Market-specific policy debe aplicarse solo al mercado correcto.

---

## **TEST 5 — Segment Override**

Debe aplicarse únicamente al segmento definido.

---

## **TEST 6 — Partial Override**

Debe heredar campos no sobrescritos.

---

## **TEST 7 — Protected Policy**

Tenant no debe poder sobrescribir una policy protegida.

---

## **TEST 8 — Expired Policy**

No debe utilizarse para nuevos runs.

---

## **TEST 9 — Future Policy**

No debe activarse antes de fecha.

---

## **TEST 10 — Historical Replay**

Debe recuperar policy histórica.

---

## **TEST 11 — Conflict**

Dos policies equivalentes y contradictorias deben producir conflict.

---

## **TEST 12 — Conflict Fail Closed**

Un conflicto crítico debe poder bloquear resolución.

---

## **TEST 13 — Fallback**

Debe indicar explícitamente que utilizó fallback.

---

## **TEST 14 — Unresolved**

Debe poder terminar sin inventar configuración.

---

## **TEST 15 — Circular Dependency**

Debe rechazarse.

---

## **TEST 16 — Invalid Parameter**

Unit o type incompatible debe fallar.

---

## **TEST 17 — Tenant Isolation**

Una policy de Tenant A no debe afectar a Tenant B.

---

## **TEST 18 — Growth vs Scale**

Mismos capabilities y configuración deben producir mismo razonamiento independientemente del plan comercial.

---

## **TEST 19 — Capability Profile**

Una feature deshabilitada debe afectar disponibilidad funcional, no calidad intelectual de evaluaciones permitidas.

---

## **TEST 20 — Emergency Override**

Debe expirar correctamente.

---

## **TEST 21 — Bundle Activation**

Un cambio conjunto debe activarse de forma consistente.

---

## **TEST 22 — Rollback**

Debe poder volver a versión anterior sin destruir historial.

---

## **TEST 23 — RAG Separation**

Un threshold presente únicamente en RAG no debe convertirse automáticamente en policy efectiva.

---

## **TEST 24 — Prompt Separation**

Un threshold encontrado en prompt textual no debe reemplazar policy estructurada.

---

# **186\. ANTI-PATRÓN — HARDCODED TENANT LOGIC**

Incorrecto:

if tenant\_id \== 123:  
    max\_cac \= 45

---

# **187\. ANTI-PATRÓN — RAG AS CONFIG DATABASE**

Incorrecto:

retrieve a document  
saying max CAC \= 45  
and treat it as current tenant policy

---

# **188\. ANTI-PATRÓN — PROMPT AS CONFIGURATION**

Incorrecto:

system prompt:  
"For Client X, CAC must be below €50."

como única fuente.

---

# **189\. ANTI-PATRÓN — LATEST POLICY**

Incorrecto persistir:

policy\_version \= latest

---

# **190\. ANTI-PATRÓN — COPY-PASTE POLICIES**

No duplicar toda una policy para cambiar:

one parameter

si puede heredarse.

---

# **191\. ANTI-PATRÓN — UNCONTROLLED OVERRIDES**

No permitir que cualquier usuario modifique:

critical economic policies

sin governance.

---

# **192\. ANTI-PATRÓN — RANDOM CONFLICT WINNER**

Nunca:

first database record wins.

---

# **193\. ANTI-PATRÓN — PLAN-SPECIFIC INTELLIGENCE**

Incorrecto:

Growth:  
basic threshold logic

Scale:  
advanced economics

si ambos deben recibir la misma calidad intelectual.

---

# **194\. ANTI-PATRÓN — SILENT FALLBACK**

Incorrecto utilizar:

generic threshold

sin indicarlo.

---

# **195\. ANTI-PATRÓN — DEFAULT AS TRUTH**

Un default es fallback.

No evidencia universal.

---

# **196\. ANTI-PATRÓN — OVERRIDE WITHOUT EXPIRY**

Especialmente peligroso para policies temporales.

---

# **197\. ANTI-PATRÓN — CONFIGURATION MIXED WITH LIVE DATA**

Incorrecto almacenar:

current CAC \= 48

como policy parameter.

Eso es observación.

---

# **198\. ACCEPTANCE CRITERIA**

Para cualquier policy material debemos poder responder:

1\. ¿Cuál es su policy\_id?

2\. ¿Qué versión tiene?

3\. ¿A qué bundle pertenece?

4\. ¿Qué tipo de policy es?

5\. ¿Quién la define?

6\. ¿Cuál es su scope?

7\. ¿Para qué tenant?

8\. ¿Para qué business?

9\. ¿Para qué mercado?

10\. ¿Para qué métrica?

11\. ¿Para qué segmento?

12\. ¿Qué condiciones la activan?

13\. ¿Qué parámetros proporciona?

14\. ¿Qué unidades tienen?

15\. ¿Qué policy padre hereda?

16\. ¿Qué valores hereda?

17\. ¿Qué valores sobrescribe?

18\. ¿Está permitido ese override?

19\. ¿Qué precedencia tiene?

20\. ¿Qué policy gana en caso de conflicto?

21\. ¿Qué fallback existe?

22\. ¿Qué ocurre si no hay policy?

23\. ¿Qué fecha entra en vigor?

24\. ¿Cuándo expira?

25\. ¿Está draft, active o deprecated?

26\. ¿Qué dependencias tiene?

27\. ¿Existen ciclos?

28\. ¿Quién aprobó el cambio?

29\. ¿Por qué cambió?

30\. ¿Qué snapshot efectivo produjo?

31\. ¿Qué policies candidatas fueron rechazadas?

32\. ¿Por qué se aplicó la policy final?

33\. ¿Puede reproducirse históricamente?

---

# **199\. DEFINITION OF DONE**

C6.6 estará formalmente definido cuando exista:

Policy Identity

Policy Versioning

Policy Bundles

Policy Types

Policy Registry

Policy Scope

Scope Specificity

Inheritance

Partial Overrides

Merge Strategies

Precedence Model

Conditions

Condition Operators

Parameter Types

Formula References

Static Configuration

Dynamic Configuration

Defaults

Cold Start Policies

Fallback Rules

Policy Conflicts

Conflict Resolution

Fail Closed

Resolution Status

Effective Policy

Effective Policy Snapshot

Governance

Approval

Change Reason

Changesets

Atomic Activation

Dependencies

Cycle Detection

Capability Configuration

Protected Policies

Override Constraints

Dry Run

Rollback

Emergency Overrides

Temporal Validity

Validation Rules

Resolution Trace

Test Fixtures

---

# **200\. RESULTADO ARQUITECTÓNICO**

Sin C6.6:

if CAC \> 50:  
    risk

Con C6.6:

Metric:  
Marginal New Customer CAC

Tenant:  
Tenant A

Business:  
Store ES

Market:  
Spain

Policy candidates:

System default  
Tenant acquisition policy  
Business economics policy  
Spain market override

Resolution:

Business economics policy selected

Inherited:  
90-day payback requirement

Market override:  
15% safety buffer

Resolved sustainable CAC:  
€43

Effective policy snapshot:  
policy\_snapshot\_982

Entonces C6.9 podrá evaluar:

Observed marginal CAC:  
€48

Resolved guardrail:  
€43

sin que el engine necesite saber:

Tenant A

mediante código específico.

---

# **201\. PRINCIPIO FINAL DE C6.6**

C6.6 debe imponer:

Knowledge defines principles.

Policy defines business rules.

Configuration defines business-specific values.

Resolution determines  
what applies now.

Y:

No tenant-specific threshold  
hidden in code.

Y:

No policy  
without version.

No override  
without trace.

No fallback  
without disclosure.

No conflict  
resolved arbitrarily.

Además:

RAG  
is not  
configuration.

y:

subscription tier  
is not  
reasoning quality.

---

# **202\. SALIDA FORMAL DE C6.6**

C6.6 produce conceptualmente:

POLICY\_DEFINITION

POLICY\_CANDIDATE

POLICY\_RESOLUTION\_RESULT

y:

EFFECTIVE\_POLICY\_SNAPSHOT

Estas salidas serán consumidas por:

C6.7 Reference & Policy Resolution

C6.8 Confidence & Uncertainty

C6.9 Benchmark Evaluation

C6.10 Anomaly Detection

C6.11 Pattern & Red Flag Detection

C6.12 Evidence & Lineage

C6.13 Evaluation Finding

C6.6 no produce:

PERFORMANCE STATUS

GUARDRAIL BREACH

BUSINESS SEVERITY

DIAGNOSIS

PRIORITY

RECOMMENDATION

EXECUTION ACTION

---

# **C6.6 — ESTADO**

CONTRACT:  
C6.6 Policy & Threshold Configuration

TYPE:  
Configuration / Policy Resolution Foundation

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

NEXT CONTRACT:  
C6.7 — Reference & Policy Resolution Contract

