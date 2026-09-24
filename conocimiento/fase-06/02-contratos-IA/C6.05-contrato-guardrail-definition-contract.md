# **C6.5 — GUARDRAIL DEFINITION CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Guardrail Definition Contract define cómo debe representarse cualquier límite operativo, económico, financiero, estadístico o de riesgo que EcomScaling IA utilice para determinar si una condición está acercándose, alcanzando o superando una frontera que no debería violarse.

Su misión es responder:

> **¿Qué límite existe, por qué existe y bajo qué condiciones aplica?**

Un guardrail NO responde:

> ¿Cómo estamos respecto a otros ecommerce?

Eso pertenece a benchmarks.

Un guardrail responde:

> ¿Estamos entrando en una zona que compromete rentabilidad, liquidez, operación, inventario, experiencia de cliente, calidad estadística, atribución o capacidad de escala?

---

# **2\. PRINCIPIO FUNDAMENTAL**

Debe mantenerse estrictamente:

BENCHMARK  
≠  
TARGET  
≠  
GUARDRAIL

Benchmark:

¿Cómo estamos respecto a una referencia?

Target:

¿Dónde queremos llegar?

Guardrail:

¿Qué límite no deberíamos violar?

Un negocio puede:

estar mejor que el benchmark

y simultáneamente:

violar un guardrail económico

Ejemplo:

Peer CAC median:  
€55

Our CAC:  
€48

Maximum sustainable CAC:  
€43

Respecto al mercado:

apparently good

Respecto a economics:

unsustainable

Por eso benchmark y guardrail deben existir como objetos distintos.

---

# **3\. RESPONSABILIDAD**

C6.5 debe definir:

WHAT guardrail?

WHAT does it protect?

WHAT metric does it apply to?

WHAT type of limit?

WHERE does the limit come from?

WHAT threshold structure?

WHAT direction?

WHAT warning zone?

WHAT risk zone?

WHAT critical zone?

WHAT context?

WHAT scope?

WHAT policy?

WHAT version?

WHAT temporal validity?

WHAT dependencies?

WHAT exceptions?

WHAT evidence supports it?

---

# **4\. LO QUE C6.5 NO DEBE HACER**

C6.5 NO debe:

decidir si un guardrail concreto ha sido violado

evaluar una métrica

asignar status final de negocio

diagnosticar causas

priorizar problemas

seleccionar estrategias

recomendar acciones

C6.5 define el límite.

C6.9 evaluará la observación frente al límite.

---

# **5\. GUARDRAIL DEFINITION**

La salida principal de C6.5 será conceptualmente:

GUARDRAIL\_DEFINITION

---

# **6\. GUARDRAIL\_ID**

Todo guardrail material debe disponer de:

guardrail\_id

estable y único.

Ejemplo:

guardrail.acquisition.maximum\_sustainable\_cac

---

# **7\. GUARDRAIL\_VERSION**

Todo guardrail debe ser versionable.

Ejemplo:

guardrail\_version:  
3.2.0

Si cambia:

threshold

formula

economic assumption

applicability

scope

severity mapping

debe poder existir una nueva versión.

---

# **8\. GUARDRAIL CATALOG**

Los guardrails deben poder pertenecer a:

guardrail\_catalog\_version

C6.0 registrará qué catálogo utilizó cada ejecución.

---

# **9\. GUARDRAIL TYPE**

Debe existir una taxonomía estructurada.

Propuesta inicial:

economic

profitability

cash

liquidity

inventory

operations

customer\_experience

statistical

measurement

attribution

concentration

scalability

capacity

risk

---

# **10\. ECONOMIC GUARDRAIL**

Protege la viabilidad económica.

Ejemplos:

maximum sustainable CAC

minimum contribution margin

minimum order contribution

maximum discount rate

minimum contribution after acquisition

---

# **11\. PROFITABILITY GUARDRAIL**

Protege rentabilidad.

Ejemplos:

minimum gross margin

minimum contribution margin

maximum refund cost impact

---

# **12\. CASH GUARDRAIL**

Protege caja.

Ejemplos:

minimum cash runway

maximum acquisition cash exposure

maximum working capital commitment

---

# **13\. LIQUIDITY GUARDRAIL**

Relacionado con capacidad para cumplir obligaciones.

Ejemplo:

minimum available liquidity buffer

---

# **14\. INVENTORY GUARDRAIL**

Protege salud de stock.

Ejemplos:

minimum hero SKU coverage

maximum aging inventory

maximum dead-stock exposure

minimum inventory availability

---

# **15\. OPERATIONS GUARDRAIL**

Protege capacidad operativa.

Ejemplos:

maximum fulfillment delay

maximum backlog

maximum cancellation rate

maximum support backlog

---

# **16\. CUSTOMER EXPERIENCE GUARDRAIL**

Ejemplos:

maximum delivery failure rate

maximum refund rate

maximum complaint rate

maximum response time

---

# **17\. STATISTICAL GUARDRAIL**

Protege calidad analítica.

Ejemplos:

minimum sample size

minimum statistical power

maximum acceptable variance

minimum experiment duration

---

# **18\. MEASUREMENT GUARDRAIL**

Protege calidad de datos.

Ejemplos:

minimum data coverage

maximum tracking loss

maximum acceptable source lag

---

# **19\. ATTRIBUTION GUARDRAIL**

Protege contra interpretaciones incorrectas de atribución.

Ejemplos:

maximum tolerated platform vs blended divergence

minimum new-customer share for prospecting interpretation

---

# **20\. CONCENTRATION GUARDRAIL**

Protege frente a dependencia excesiva.

Ejemplos:

maximum revenue concentration by SKU

maximum channel concentration

maximum supplier concentration

maximum customer concentration

---

# **21\. SCALABILITY GUARDRAIL**

Protege la expansión.

Ejemplos:

maximum marginal CAC

minimum operational headroom

minimum inventory coverage before scale

minimum cash buffer before spend increase

---

# **22\. CAPACITY GUARDRAIL**

Protege capacidad interna.

Ejemplos:

maximum warehouse utilization

maximum support load

maximum fulfillment capacity usage

---

# **23\. GUARDRAIL PURPOSE**

Todo guardrail debe indicar:

guardrail\_purpose

Ejemplo:

protect unit economics

protect liquidity

avoid stockout

avoid service degradation

---

# **24\. PROTECTED OBJECTIVE**

Puede existir:

protected\_objective

Ejemplos:

profitability

cash preservation

customer experience

operational stability

growth sustainability

---

# **25\. METRIC LINKAGE**

Todo guardrail debe referenciar:

metric\_id

metric\_version

de C6.1.

---

# **26\. SEMANTIC REQUIREMENTS**

Además debe declarar qué variante semántica requiere.

Ejemplo:

metric:  
new\_customer\_cac

marginality\_scope:  
marginal

No aplicar automáticamente a:

average CAC

---

# **27\. OBSERVED VS PREDICTED**

Un guardrail puede exigir:

measurement\_basis \= observed

o permitir:

predicted

según el caso.

---

# **28\. ATTRIBUTED VS INCREMENTAL**

Un guardrail económico puede exigir:

incremental

y rechazar:

platform attributed

como sustituto silencioso.

---

# **29\. GUARDRAIL SOURCE**

Debe conocerse de dónde procede.

Valores conceptuales:

derived\_economics

configured\_policy

business\_target

risk\_policy

operational\_capacity

statistical\_requirement

external\_constraint

regulatory\_constraint

system\_safety

---

# **30\. DERIVED ECONOMICS**

Ejemplo:

maximum sustainable CAC

derivado de:

contribution

repeat behavior

payback requirement

refunds

variable costs

---

# **31\. CONFIGURED POLICY**

Ejemplo:

The business refuses to accept  
more than 60-day payback.

Eso puede ser política empresarial.

---

# **32\. OPERATIONAL CAPACITY**

Ejemplo:

warehouse maximum safe throughput

puede venir de capacidad operativa.

---

# **33\. EXTERNAL CONSTRAINT**

Ejemplo:

supplier credit limit

o:

contractual service-level limit

---

# **34\. NO UNIVERSAL THRESHOLDS**

Regla central:

No hardcoded universal guardrail  
unless the rule is truly universal.

Incorrecto:

CAC \> 50 \= critical

Correcto:

CAC \> tenant-specific sustainable CAC

---

# **35\. THRESHOLD MODEL**

Un guardrail puede tener uno o varios thresholds.

Debe poder representar:

warning

risk

critical

sin asumir que todas las métricas necesitan tres niveles.

---

# **36\. WARNING**

Representa:

> aproximación a una zona que merece vigilancia.

No implica necesariamente problema.

---

# **37\. RISK**

Representa:

> el límite comienza a comprometer el objetivo protegido.

---

# **38\. CRITICAL**

Representa:

> existe una violación severa del límite o una condición que amenaza seriamente el objetivo protegido.

---

# **39\. GUARDRAIL LEVELS**

Modelo conceptual:

normal zone

warning zone

risk zone

critical zone

---

# **40\. NO UNIVERSAL LEVEL COUNT**

Algunos guardrails pueden ser binarios.

Ejemplo:

stock available?  
yes / no

Otros pueden tener múltiples niveles.

---

# **41\. THRESHOLD DIRECTION**

Debe poder indicarse:

upper\_bound

lower\_bound

inside\_range

outside\_range

rate\_of\_change

compound\_condition

---

# **42\. UPPER BOUND**

Ejemplo:

CAC must not exceed X

---

# **43\. LOWER BOUND**

Ejemplo:

contribution margin  
must not fall below Y

---

# **44\. INSIDE RANGE**

Ejemplo:

inventory coverage  
should remain between X and Y

---

# **45\. RATE-OF-CHANGE GUARDRAIL**

Un límite puede depender de velocidad de cambio.

Ejemplo:

refund rate  
must not increase \> X  
within 7 days

---

# **46\. COMPOUND GUARDRAIL**

Puede existir una condición multivariable.

Ejemplo:

scale is unsafe if:

marginal CAC \> sustainable CAC

AND

inventory coverage \< minimum

AND

cash buffer \< required

C6.5 puede definir el guardrail compuesto.

La detección de patrones complejos también se relacionará con C6.11.

---

# **47\. ABSOLUTE THRESHOLD**

Ejemplo:

maximum backlog \= 500 orders

---

# **48\. RELATIVE THRESHOLD**

Ejemplo:

CAC must not exceed  
historical baseline by \> 25%

---

# **49\. DERIVED THRESHOLD**

Ejemplo:

maximum CAC \=  
expected first-order contribution  
\+  
allowed future contribution

---

# **50\. DYNAMIC THRESHOLD**

Puede cambiar con:

margin

AOV

market

customer type

business maturity

---

# **51\. STATIC VS DYNAMIC**

Debe distinguirse:

static

derived

dynamic

---

# **52\. FORMULA-BASED GUARDRAIL**

Puede existir:

threshold\_formula\_id

threshold\_formula\_version

---

# **53\. EXAMPLE**

maximum\_sustainable\_cac \=  
expected\_customer\_contribution  
\*  
allowed\_acquisition\_share

La fórmula concreta pertenece a configuración/economics.

---

# **54\. DEPENDENCIES**

Todo guardrail derivado debe poder declarar:

dependencies

Ejemplo:

gross margin

return rate

fulfillment cost

payment fees

repeat contribution

---

# **55\. DEPENDENCY QUALITY**

Si una dependencia tiene calidad baja:

guardrail reliability

también puede degradarse.

C6.3 y C6.8 gestionarán esa propagación.

---

# **56\. CONTEXT**

Un guardrail puede variar según contexto.

Debe poder incluir:

market

product

customer type

channel

business model

maturity

seasonality

promotion state

---

# **57\. MARKET-SPECIFIC GUARDRAIL**

Ejemplo:

maximum sustainable CAC Spain:  
€43

maximum sustainable CAC Germany:  
€57

puede ser perfectamente válido.

---

# **58\. PRODUCT-SPECIFIC GUARDRAIL**

Ejemplo:

minimum gross margin

puede ser distinto por categoría.

---

# **59\. CUSTOMER-TYPE GUARDRAIL**

Ejemplo:

new-customer CAC

puede admitir un límite diferente de:

reactivation CAC

---

# **60\. CHANNEL-SPECIFIC GUARDRAIL**

Solo cuando conceptualmente tenga sentido.

No debe duplicarse innecesariamente economics por canal si el límite relevante es blended.

---

# **61\. TENANT SCOPE**

Todo guardrail debe declarar alcance.

Valores:

global

tenant

workspace

business

market

segment

product

---

# **62\. GLOBAL GUARDRAIL**

Solo para principios realmente globales.

Ejemplo:

denominator cannot be zero

es más una validación técnica que un guardrail de negocio.

Deben evitarse falsas reglas universales.

---

# **63\. TENANT GUARDRAIL**

Configuración común para un cliente.

---

# **64\. BUSINESS GUARDRAIL**

Límite específico de una tienda.

---

# **65\. SEGMENT GUARDRAIL**

Aplicable solo a una cohorte o segmento.

---

# **66\. EFFECTIVE PERIOD**

Debe poder existir:

effective\_from

effective\_to

---

# **67\. HISTORICAL GUARDRAILS**

Una evaluación histórica debe utilizar el guardrail vigente en aquel momento.

No:

current guardrail

aplicado retroactivamente sin indicarlo.

---

# **68\. VERSION IMMUTABILITY**

Una versión utilizada históricamente debe permanecer inmutable.

Si cambia:

create new guardrail version.

---

# **69\. GUARDRAIL STATUS**

Desde gobernanza:

draft

active

deprecated

retired

---

# **70\. DRAFT**

No debe aplicarse automáticamente en producción.

---

# **71\. ACTIVE**

Puede participar en resolución.

---

# **72\. DEPRECATED**

Puede conservarse para replay.

No debería utilizarse para nuevos runs.

---

# **73\. RETIRED**

Conservado únicamente por historial/auditoría.

---

# **74\. OVERRIDES**

Puede existir un override específico.

Ejemplo:

tenant default CAC limit \= €45

Germany override \= €53

---

# **75\. OVERRIDE PRECEDENCE**

La precedencia debe ser explícita.

Ejemplo conceptual:

segment override  
\>  
market override  
\>  
business policy  
\>  
tenant default  
\>  
system default

Pero la resolución definitiva pertenece a C6.6/C6.7.

---

# **76\. NO SILENT OVERRIDE**

Nunca cambiar un límite sin conservar:

override source

version

effective date

---

# **77\. POLICY LINK**

Todo guardrail configurable debe poder referenciar:

policy\_id

policy\_version

C6.6 formalizará esa política.

---

# **78\. CONFIGURATION SNAPSHOT**

C6.0 conserva:

configuration\_snapshot\_id

C6.5 debe poder resolverse dentro de ese snapshot.

---

# **79\. GUARDRAIL PRIORITY**

Puede existir:

guardrail\_precedence

para resolver varios límites aplicables.

Esto NO es:

business priority

---

# **80\. MULTIPLE GUARDRAILS ON SAME METRIC**

Ejemplo:

CAC puede tener:

profitability guardrail

cash guardrail

payback guardrail

simultáneamente.

No necesariamente hay un único límite.

---

# **81\. EXAMPLE**

CAC \= €44

profitability limit \= €47

cash limit \= €40

Resultado potencial posterior:

profitability:  
safe

cash:  
breached

El sistema no debe reducirlo a una única comparación simplista.

---

# **82\. GUARDRAIL FAMILY**

Puede existir:

guardrail\_family

para agrupar:

economic

cash

inventory

operations

---

# **83\. GUARDRAIL RELATIONSHIPS**

Puede existir:

depends\_on

overrides

supersedes

derived\_from

parent\_guardrail

---

# **84\. GUARDRAIL SEVERITY MAPPING**

El guardrail puede definir cómo se traduce una distancia al límite en:

warning

risk

critical

pero no el status concreto de una observación.

---

# **85\. DISTANCE-BASED LEVELS**

Ejemplo conceptual:

threshold:  
€43

warning:  
€40–€43

risk:  
€43–€48

critical:  
\> €48

Estas cifras son específicas del negocio.

No universales.

---

# **86\. PERCENTAGE DISTANCE**

También:

warning:  
within 5% of limit

risk:  
0–10% beyond

critical:  
\>10% beyond

si policy lo define.

---

# **87\. VOLATILITY-AWARE GUARDRAIL**

Un límite puede necesitar considerar variabilidad.

Ejemplo:

one-day breach

puede ser menos grave que:

14-day sustained breach

---

# **88\. PERSISTENCE REQUIREMENT**

Puede existir:

minimum\_breach\_duration

---

# **89\. OCCURRENCE REQUIREMENT**

Puede existir:

minimum\_breach\_occurrences

Ejemplo:

3 of last 5 periods

---

# **90\. WINDOW**

Puede existir:

evaluation\_window

Ejemplo:

rolling 7 days

---

# **91\. INSTANT GUARDRAIL**

Algunos límites sí son inmediatos.

Ejemplo:

inventory \= 0  
for hero SKU

puede requerir reacción inmediata.

---

# **92\. TREND GUARDRAIL**

Otros dependen de deterioro sostenido.

Ejemplo:

delivery time increases  
for 4 consecutive weeks

---

# **93\. FORECAST GUARDRAIL**

Puede evaluarse sobre:

predicted inventory coverage

para anticipar problemas.

Debe etiquetarse como forecast-based.

---

# **94\. OBSERVED GUARDRAIL**

Opera sobre datos realizados.

---

# **95\. PROACTIVE GUARDRAILS**

La arquitectura debe permitir:

preventive

no únicamente:

reactive

Ejemplo:

forecasted stockout in 8 days

---

# **96\. EVIDENCE REQUIREMENTS**

Cada guardrail puede declarar:

required\_evidence

Ejemplo:

Para máximo CAC sostenible:

CAC

contribution margin

customer economics

---

# **97\. MISSING REQUIRED EVIDENCE**

Si falta:

do not fabricate guardrail.

Puede quedar:

guardrail unresolved

---

# **98\. GUARDRAIL RESOLUTION STATUS**

Estados conceptuales:

resolved

partially\_resolved

unresolved

not\_applicable

---

# **99\. RESOLVED**

Todos los inputs necesarios están disponibles.

---

# **100\. PARTIALLY RESOLVED**

Puede estimarse, pero con limitaciones materiales.

---

# **101\. UNRESOLVED**

No existe evidencia suficiente para determinar el límite.

---

# **102\. NOT APPLICABLE**

El guardrail no aplica al contexto.

---

# **103\. GUARDRAIL QUALITY**

Puede enlazar:

data\_quality\_assessment\_id

de las dependencias.

---

# **104\. GUARDRAIL CONFIDENCE**

C6.5 no calcula la confidence final.

Debe proporcionar inputs para C6.8.

---

# **105\. ASSUMPTIONS**

Todo guardrail derivado puede tener:

assumptions

Ejemplo:

future repeat contribution assumed stable

---

# **106\. CRITICAL ASSUMPTIONS**

Debe distinguir:

critical\_assumptions

que, si cambian, alteran materialmente el límite.

---

# **107\. EXAMPLE**

Maximum sustainable CAC \= €52

Assumption:  
12-month repeat contribution \= €18

Si la repetición cae:

maximum sustainable CAC

también puede caer.

---

# **108\. SENSITIVITY**

Puede existir:

sensitivity\_metadata

para guardrails económicos.

Ejemplo:

every \-5pp contribution margin  
reduces sustainable CAC by X

No es obligatorio para todos.

---

# **109\. BUFFER**

Puede existir:

safety\_buffer

Ejemplo:

Break-even CAC:

€50

pero policy exige:

10% safety margin

Guardrail operativo:

€45

---

# **110\. BREAK-EVEN VS OPERATING LIMIT**

Debe distinguirse:

theoretical break-even

de:

operational guardrail

---

# **111\. EXAMPLE**

Break-even CAC:  
€60

Maximum allowed operational CAC:  
€50

por preservar:

cash

risk buffer

profitability

---

# **112\. GUARDRAIL BASIS**

Debe existir:

basis\_type

Ejemplos:

break\_even

sustainable

policy

capacity

statistical

risk\_adjusted

---

# **113\. GUARDRAIL OWNER**

Puede existir:

owner\_type

Ejemplos:

system

tenant

business

finance

operations

configured\_admin

No necesariamente una persona identificable.

---

# **114\. GOVERNANCE**

Debe poder registrar:

created\_by

approved\_by\_ref

approved\_at

cuando el guardrail requiera aprobación humana.

---

# **115\. AUTO-DERIVED GUARDRAIL**

Puede ser generado automáticamente.

Debe quedar:

derivation\_method

y:

derivation\_version

---

# **116\. HUMAN-CONFIGURED GUARDRAIL**

Debe quedar identificado:

configured

No presentarse como derivado matemáticamente si no lo es.

---

# **117\. REGULATORY / CONTRACTUAL GUARDRAIL**

Puede existir un límite externo no modificable por economics.

Debe conservar:

external\_authority\_ref

cuando aplique.

---

# **118\. THRESHOLD UNIT**

El threshold debe utilizar unidad compatible con la métrica.

Ejemplo inválido:

metric:  
CAC in EUR

threshold:  
15%

sin transformación explícita.

---

# **119\. CURRENCY**

Los guardrails monetarios deben declarar currency.

---

# **120\. CURRENCY NORMALIZATION**

Si el negocio es multi-market debe existir una estrategia explícita.

---

# **121\. NORMALIZATION BASIS**

Puede ser:

local currency

reporting currency

constant currency

---

# **122\. RANGE GUARDRAIL**

Algunas métricas necesitan rango.

Ejemplo:

inventory coverage:  
minimum 20 days  
maximum 90 days

Muy bajo:

stockout risk

Muy alto:

working capital / dead stock risk

---

# **123\. ASYMMETRIC RANGE**

Los dos lados pueden tener severidades diferentes.

---

# **124\. DIRECTIONALITY**

Debe estar alineada con la métrica.

Ejemplo:

CAC:

higher usually worse

Contribution:

lower usually worse

Pero algunas métricas son context-dependent.

---

# **125\. CONTEXT-DEPENDENT DIRECTION**

Ejemplo:

AOV:

higher

no es automáticamente mejor si se logra mediante:

unprofitable discounting

Por tanto no todos los guardrails deben ser univariables.

---

# **126\. COMPOUND ECONOMIC GUARDRAIL**

Ejemplo:

AOV increase

solo puede considerarse saludable si:

contribution per order  
does not deteriorate beyond X

---

# **127\. CASCADING GUARDRAILS**

Un guardrail puede depender de otro.

Ejemplo:

Scale guardrail

depende de:

CAC guardrail

cash guardrail

inventory guardrail

operations guardrail

---

# **128\. CASCADE POLICY**

Debe definirse si:

one critical child breach  
blocks parent

o si existe otra lógica.

---

# **129\. BLOCKING GUARDRAIL**

Puede existir:

blocking \= true

para límites que impiden ciertas evaluaciones posteriores.

Ejemplo:

data quality insufficient

podría bloquear una decisión automática.

---

# **130\. ADVISORY GUARDRAIL**

Otros pueden ser:

blocking \= false

y servir como advertencia.

---

# **131\. HARD VS SOFT GUARDRAIL**

Debe poder distinguirse:

hard

soft

---

# **132\. HARD GUARDRAIL**

Una violación tiene implicación fuerte.

Ejemplo:

cash below minimum operating requirement

---

# **133\. SOFT GUARDRAIL**

Representa cautela.

Ejemplo:

channel concentration above preferred range

---

# **134\. GUARDRAIL ENFORCEMENT MODE**

Puede existir:

advisory

review\_required

blocking

La ejecución real pertenecerá a Fase 8\.

---

# **135\. FASE 6 NO EJECUTA BLOQUEOS OPERATIVOS**

Aunque un guardrail tenga:

enforcement\_mode \= blocking

Fase 6 solo debe informar:

blocking condition detected

No debe pausar campañas ni cambiar presupuestos.

Eso pertenece a Fase 8\.

---

# **136\. GUARDRAIL DEFINITION SHAPE**

Conceptualmente:

guardrail\_definition:

    identity:  
        guardrail\_id  
        guardrail\_version  
        guardrail\_catalog\_version

    classification:  
        guardrail\_type  
        guardrail\_family  
        guardrail\_purpose  
        protected\_objective

    metric:  
        metric\_id  
        metric\_version  
        semantic\_requirements

    scope:  
        tenant  
        business  
        market  
        segment  
        product  
        customer\_type  
        channel

    source:  
        source\_type  
        policy\_id  
        policy\_version  
        derivation\_method  
        derivation\_version

    threshold:  
        threshold\_type  
        direction  
        warning  
        risk  
        critical  
        formula\_id  
        formula\_version  
        safety\_buffer

    temporal:  
        evaluation\_window  
        persistence\_requirement  
        minimum\_occurrences  
        effective\_from  
        effective\_to

    dependencies:  
        required\_inputs  
        critical\_inputs  
        dependent\_guardrails

    evidence:  
        required\_evidence  
        assumptions  
        critical\_assumptions

    governance:  
        status  
        owner  
        enforcement\_mode  
        confidentiality

    relationships:  
        supersedes  
        derived\_from  
        overrides  
        parent\_guardrail

---

# **137\. EXAMPLE — MAXIMUM SUSTAINABLE CAC**

guardrail\_id:  
guardrail.acquisition.max\_sustainable\_cac

type:  
economic

protected\_objective:  
profitable customer acquisition

metric:  
new\_customer\_cac

scope:  
Spain

threshold\_type:  
derived

basis:  
sustainable

direction:  
upper\_bound

risk threshold:  
€43

critical threshold:  
€48

currency:  
EUR

derived\_from:  
first-order contribution  
expected repeat contribution  
refund cost  
payment fees

policy:  
90-day payback requirement

---

# **138\. EXAMPLE — INVENTORY COVERAGE**

metric:  
inventory.stock\_coverage\_days

guardrail\_type:  
inventory

direction:  
inside\_range

warning:  
\< 21 days

risk:  
\< 14 days

critical:  
\< 7 days

Las cifras deben proceder de policy/configuración.

No son universales.

---

# **139\. EXAMPLE — OPERATIONS**

metric:  
operations.fulfillment\_delay

guardrail:  
maximum safe delay

warning:  
\> configured threshold

risk:  
\> configured risk threshold

critical:  
\> configured critical threshold

---

# **140\. EXAMPLE — CHANNEL CONCENTRATION**

metric:  
acquisition.channel\_spend\_share

guardrail\_type:  
concentration

protected\_objective:  
channel diversification

---

# **141\. EXAMPLE — SCALE GUARDRAIL**

Scale allowed only if:

marginal CAC  
\<= sustainable marginal CAC

AND

inventory headroom  
\>= required level

AND

cash buffer  
\>= required level

AND

operations capacity  
\>= required level

C6.5 define la condición.

C6.9 evalúa sus componentes.

Fase 7 decide qué recomendar.

---

# **142\. INVARIANTES C6.5**

## **INV-C6.5-001**

Todo guardrail debe tener:

guardrail\_id

---

## **INV-C6.5-002**

Todo guardrail debe tener versión.

---

## **INV-C6.5-003**

Todo guardrail debe tener propósito.

---

## **INV-C6.5-004**

Debe saberse qué protege.

---

## **INV-C6.5-005**

Debe estar vinculado a métrica o condición estructurada.

---

## **INV-C6.5-006**

No debe confundirse benchmark con guardrail.

---

## **INV-C6.5-007**

No debe confundirse target con guardrail.

---

## **INV-C6.5-008**

No hardcodear thresholds universales sin base válida.

---

## **INV-C6.5-009**

Todo threshold debe conocer su origen.

---

## **INV-C6.5-010**

Guardrails monetarios deben declarar currency.

---

## **INV-C6.5-011**

Una versión publicada no puede modificarse silenciosamente.

---

## **INV-C6.5-012**

Cambios de threshold materiales requieren nueva versión o policy version.

---

## **INV-C6.5-013**

Historical replay debe poder recuperar el guardrail vigente entonces.

---

## **INV-C6.5-014**

Average y marginal deben respetarse.

---

## **INV-C6.5-015**

Observed y predicted deben respetarse.

---

## **INV-C6.5-016**

Attributed e incremental deben respetarse.

---

## **INV-C6.5-017**

Si faltan inputs críticos, el guardrail puede quedar unresolved.

---

## **INV-C6.5-018**

Un guardrail compuesto debe conservar sus dependencias.

---

## **INV-C6.5-019**

Una violación de guardrail no es automáticamente una prioridad.

---

## **INV-C6.5-020**

Una violación no autoriza Fase 6 a ejecutar acciones.

---

# **143\. STATUS ≠ SEVERITY ≠ PRIORITY**

Debe mantenerse:

guardrail breach state

severity

priority

como conceptos diferentes.

Ejemplo:

breach:  
critical

confidence:  
low

puede significar:

urgent validation required

pero no necesariamente:

priority \= P0

Eso pertenece a Fase 4\.

---

# **144\. GUARDRAIL BREACH NO ES DIAGNÓSTICO**

Ejemplo:

CAC exceeded sustainable limit

NO significa automáticamente:

root cause \= Meta saturation

Fase 3 debe analizar causas.

---

# **145\. GUARDRAIL BREACH NO ES RECOMENDACIÓN**

Ejemplo:

CAC guardrail breached

NO significa automáticamente:

reduce spend by 20%

Eso pertenece a Fase 7\.

---

# **146\. VALIDACIONES MÍNIMAS**

Antes de aceptar un guardrail:

guardrail id unique?

version valid?

metric exists?

semantic requirements valid?

threshold structure valid?

threshold unit compatible?

currency present?

source known?

policy reference valid?

scope valid?

effective period valid?

dependencies exist?

formula exists?

assumptions structured?

status active?

---

# **147\. VALIDACIÓN DE THRESHOLD ORDER**

Si:

warning \= 50

risk \= 40

critical \= 30

para un upper-bound guardrail, probablemente exista incoherencia.

Debe validarse según dirección.

---

# **148\. VALIDACIÓN DE LOWER BOUND**

En un lower-bound:

warning

risk

critical

deben ordenarse en sentido inverso al upper-bound.

---

# **149\. VALIDACIÓN DE RANGE**

Debe cumplirse:

minimum \<= maximum

---

# **150\. VALIDACIÓN DE FORMULA**

Un threshold derivado debe poder calcularse con inputs disponibles o quedar:

unresolved

---

# **151\. VALIDACIÓN DE SEMANTIC MATCH**

Un guardrail para:

marginal CAC

no debe aplicarse automáticamente a:

average CAC

---

# **152\. VALIDACIÓN DE CURRENCY**

No aplicar directamente:

EUR threshold

a:

USD metric

sin conversión explícita.

---

# **153\. VALIDACIÓN TEMPORAL**

Un guardrail fuera de su:

effective period

no debe utilizarse para nuevas evaluaciones.

---

# **154\. VALIDACIÓN DE TENANT**

Un guardrail privado de Tenant A no puede aplicarse a Tenant B.

---

# **155\. VALIDACIÓN DE BUSINESS**

Un guardrail específico de una tienda no debe aplicarse a otra tienda del mismo tenant sin regla explícita.

---

# **156\. RELACIÓN CON C6.0**

C6.0 aporta:

tenant

business

configuration snapshot

guardrail catalog version

run

---

# **157\. RELACIÓN CON C6.1**

C6.1 garantiza que la métrica observada tenga semántica compatible.

---

# **158\. RELACIÓN CON C6.2**

C6.2 aporta contexto para determinar si el guardrail aplica.

---

# **159\. RELACIÓN CON C6.3**

C6.3 evalúa calidad de los inputs utilizados para resolver guardrails derivados.

---

# **160\. RELACIÓN CON C6.4**

C6.4 puede aportar referencias económicas que luego se formalizan como límites.

Pero:

reference

y:

guardrail

siguen siendo objetos separados.

---

# **161\. RELACIÓN CON C6.6**

C6.6 será fundamental.

C6.5 define:

> qué estructura tiene un guardrail.

C6.6 define:

> cómo se configura, hereda, sobrescribe y resuelve la policy que determina sus thresholds.

---

# **162\. RELACIÓN CON C6.7**

C6.7 determinará:

which guardrail applies

cuando existan varias versiones o scopes.

---

# **163\. RELACIÓN CON C6.8**

C6.8 evaluará la confianza del guardrail resuelto y de cualquier breach.

---

# **164\. RELACIÓN CON C6.9**

C6.9 comparará:

observation  
vs  
resolved guardrail

y determinará:

safe

warning

risk

critical

indeterminate

según corresponda.

---

# **165\. RELACIÓN CON C6.10**

Anomaly Detection puede detectar acercamientos bruscos a límites.

---

# **166\. RELACIÓN CON C6.11**

Pattern Detection puede combinar múltiples breaches.

Ejemplo:

CAC guardrail breached

cash guardrail breached

inventory guardrail near risk

como patrón sistémico.

---

# **167\. RELACIÓN CON C6.12**

C6.12 debe reconstruir:

which guardrail

which version

which policy

which formula

which inputs

which threshold

produjo una evaluación.

---

# **168\. RELACIÓN CON C6.13**

Los Findings podrán indicar:

guardrail\_id

guardrail\_version

breach level

sin duplicar toda la definición.

---

# **169\. TESTS MÍNIMOS**

## **TEST 1 — Benchmark vs Guardrail**

Un benchmark medio de mercado no debe convertirse automáticamente en límite.

---

## **TEST 2 — Target vs Guardrail**

Un objetivo comercial no debe convertirse automáticamente en guardrail.

---

## **TEST 3 — Tenant-specific CAC**

Dos tenants con economics distintos deben poder tener límites distintos.

---

## **TEST 4 — Market-specific CAC**

España y Alemania pueden resolver thresholds distintos.

---

## **TEST 5 — Average vs Marginal**

Guardrail marginal no debe evaluar average CAC.

---

## **TEST 6 — Missing Dependency**

Si falta contribution, sustainable CAC puede quedar unresolved.

---

## **TEST 7 — Historical Version**

Replay debe recuperar la versión histórica.

---

## **TEST 8 — Override**

Un market override debe superar tenant default según policy.

---

## **TEST 9 — Currency**

EUR guardrail no debe aplicarse a USD sin normalización.

---

## **TEST 10 — Range Guardrail**

Debe soportar mínimo y máximo.

---

## **TEST 11 — Upper Bound**

CAC por encima debe mapear correctamente las zonas.

---

## **TEST 12 — Lower Bound**

Contribution por debajo debe mapear correctamente las zonas.

---

## **TEST 13 — Persistence**

Un breach aislado y uno sostenido deben poder diferenciarse.

---

## **TEST 14 — Compound Guardrail**

Debe soportar varias condiciones.

---

## **TEST 15 — Forecast Guardrail**

Predicted stockout debe conservar su naturaleza forecast.

---

## **TEST 16 — Unresolved**

Debe existir un estado explícito cuando no puede calcularse.

---

## **TEST 17 — Deprecated**

Guardrail deprecated no debe participar en nuevas evaluaciones.

---

## **TEST 18 — Cross-tenant**

No aplicar guardrails privados entre tenants.

---

# **170\. ANTI-PATRÓN — UNIVERSAL THRESHOLD**

Incorrecto:

ROAS \< 3 \= bad

---

# **171\. ANTI-PATRÓN — MARKET AVERAGE AS LIMIT**

Incorrecto:

Industry CAC \= €50

therefore max sustainable CAC \= €50

La sostenibilidad depende de economics propios.

---

# **172\. ANTI-PATRÓN — ONE CAC LIMIT FOR EVERYTHING**

Incorrecto usar el mismo threshold para:

new customers

returning customers

reactivation

different markets

sin justificarlo.

---

# **173\. ANTI-PATRÓN — CURRENT POLICY APPLIED TO HISTORY**

Incorrecto:

2026 guardrail

aplicado retroactivamente a 2024 sin señalarlo.

---

# **174\. ANTI-PATRÓN — BREAK-EVEN AS SAFE LIMIT**

Incorrecto asumir:

break-even  
\=  
healthy operating limit

---

# **175\. ANTI-PATRÓN — IGNORAR QUALITY**

Incorrecto calcular:

maximum sustainable CAC

con margin claramente defectuoso y presentarlo como límite preciso.

---

# **176\. ANTI-PATRÓN — GUARDRAIL BREACH \= ACTION**

Incorrecto:

CAC critical  
→  
pause campaign

dentro de Fase 6\.

---

# **177\. ANTI-PATRÓN — GUARDRAIL BREACH \= ROOT CAUSE**

Incorrecto:

refund rate exceeds limit  
→  
product quality is bad

Eso es una hipótesis diagnóstica.

---

# **178\. ANTI-PATRÓN — OVERWRITE THRESHOLD**

Nunca actualizar:

guardrail v1

y borrar el valor anterior.

---

# **179\. ANTI-PATRÓN — SINGLE FINAL LIMIT**

Incorrecto reducir siempre:

profitability limit

cash limit

risk limit

a un único número sin conservar el motivo.

---

# **180\. ACCEPTANCE CRITERIA**

Para cualquier guardrail material debemos poder responder:

1\. ¿Cuál es su guardrail\_id?

2\. ¿Qué versión utiliza?

3\. ¿Qué tipo de guardrail es?

4\. ¿Qué objetivo protege?

5\. ¿Qué métrica controla?

6\. ¿Qué semántica de métrica exige?

7\. ¿De dónde procede?

8\. ¿Es configurado o derivado?

9\. ¿Qué policy lo controla?

10\. ¿Qué fórmula utiliza?

11\. ¿Qué inputs necesita?

12\. ¿Qué inputs son críticos?

13\. ¿Qué unidad utiliza?

14\. ¿Qué moneda utiliza?

15\. ¿Es upper, lower, range o compound?

16\. ¿Qué warning zone tiene?

17\. ¿Qué risk zone tiene?

18\. ¿Qué critical zone tiene?

19\. ¿Qué contexto requiere?

20\. ¿Para qué tenant aplica?

21\. ¿Para qué business aplica?

22\. ¿Para qué market aplica?

23\. ¿Para qué segment aplica?

24\. ¿Qué assumptions utiliza?

25\. ¿Qué critical assumptions utiliza?

26\. ¿Qué safety buffer existe?

27\. ¿Qué ventana temporal utiliza?

28\. ¿Exige persistencia?

29\. ¿Está resuelto o unresolved?

30\. ¿Qué datos sostienen su cálculo?

31\. ¿Qué versión histórica estaba activa?

32\. ¿Es advisory, review-required o blocking?

33\. ¿Qué guardrails relacionados existen?

---

# **181\. DEFINITION OF DONE**

C6.5 estará formalmente definido cuando exista:

Guardrail Identity

Guardrail Versioning

Guardrail Catalog

Guardrail Type Taxonomy

Protected Objective

Metric Linkage

Semantic Requirements

Source Model

Threshold Model

Warning / Risk / Critical Zones

Upper / Lower / Range Limits

Compound Conditions

Static Thresholds

Dynamic Thresholds

Derived Thresholds

Formula Versioning

Scope Model

Tenant Scope

Business Scope

Market Scope

Segment Scope

Effective Period

Historical Versioning

Override Support

Policy Linkage

Dependencies

Evidence Requirements

Resolution Status

Assumptions

Critical Assumptions

Safety Buffers

Temporal Windows

Persistence Rules

Occurrence Rules

Hard / Soft Guardrails

Enforcement Mode

Governance

Relationships

Validation Rules

Test Fixtures

---

# **182\. RESULTADO ARQUITECTÓNICO**

Antes de C6.5:

CAC \= €48

Benchmark \= €52

Una arquitectura simple podría decir:

looks good

Después de C6.5 podemos tener:

Observation:  
New Customer CAC \= €48

Peer benchmark:  
€52

Profitability guardrail:  
€46

Cash guardrail:  
€41

Marginal scale guardrail:  
€44

Esto permite que C6.9 determine posteriormente:

Peer comparison:  
better than reference

Profitability:  
risk

Cash:  
critical

Scale economics:  
breached

Y esa es exactamente la diferencia entre:

benchmarking superficial

y:

business-aware intelligence.

---

# **183\. PRINCIPIO FINAL DE C6.5**

C6.5 debe imponer:

A benchmark tells us  
where others are.

A target tells us  
where we want to go.

A guardrail tells us  
what we cannot safely violate.

Y:

No guardrail  
without explicit origin.

Y:

No universal threshold  
when the correct limit  
depends on business economics.

Además:

guardrail breach  
≠  
diagnosis

guardrail breach  
≠  
priority

guardrail breach  
≠  
recommendation

guardrail breach  
≠  
execution

---

# **184\. SALIDA FORMAL DE C6.5**

C6.5 produce:

GUARDRAIL\_DEFINITION

y puede permitir la resolución conceptual de:

GUARDRAIL\_THRESHOLD

cuando sus inputs estén disponibles.

Será consumido por:

C6.6 Policy & Threshold Configuration

C6.7 Reference & Policy Resolution

C6.8 Confidence & Uncertainty

C6.9 Benchmark Evaluation

C6.10 Anomaly Detection

C6.11 Pattern & Red Flag Detection

C6.12 Evidence & Lineage

C6.13 Evaluation Finding

No produce:

FINAL BREACH ASSESSMENT

DIAGNOSIS

PRIORITY

STRATEGY

RECOMMENDATION

EXECUTION ACTION

---

# **C6.5 — ESTADO**

CONTRACT:  
C6.5 Guardrail Definition

TYPE:  
Risk Boundary / Business Constraint Definition

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

NEXT CONTRACT:  
C6.6 — Policy & Threshold Configuration Contract

