# **C6.12 — EVIDENCE, PROVENANCE & LINEAGE CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Evidence, Provenance & Lineage Contract define cómo EcomScaling IA debe registrar, relacionar y reconstruir toda la cadena de evidencia que conduce desde los datos originales hasta una evaluación, anomalía, patrón o conclusión material.

Su misión es responder:

> **¿Exactamente de dónde salió esta conclusión y qué ocurrió en cada paso hasta llegar a ella?**

C6.12 debe permitir recorrer:

RAW DATA  
↓  
SOURCE  
↓  
INGESTION  
↓  
TRANSFORMATION  
↓  
CANONICAL METRIC  
↓  
OBSERVATION  
↓  
CONTEXT  
↓  
DATA QUALITY  
↓  
REFERENCE / GUARDRAIL  
↓  
POLICY RESOLUTION  
↓  
COMPARISON  
↓  
EVALUATION  
↓  
ANOMALY  
↓  
PATTERN  
↓  
CONFIDENCE  
↓  
FINDING

De forma:

versioned  
traceable  
auditable  
reproducible  
explainable

---

# **2\. PROBLEMA QUE RESUELVE**

Sin C6.12 el sistema podría producir:

CAC is critical.

Pero nadie podría responder con precisión:

¿Qué CAC?

¿Qué período?

¿De qué fuente?

¿Qué fórmula?

¿Qué customers se utilizaron?

¿Qué spend se incluyó?

¿Qué política estaba activa?

¿Qué guardrail se utilizó?

¿Qué versión?

¿Por qué €43 era el límite?

¿Qué benchmark fue rechazado?

¿Qué calidad tenían los datos?

¿Qué confidence tenía la conclusión?

Eso convertiría la IA en una caja negra.

C6.12 debe impedirlo.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Toda conclusión material debe tener lineage.

Invariante:

NO MATERIAL CLAIM  
WITHOUT EVIDENCE LINEAGE

---

# **4\. SEGUNDO PRINCIPIO**

Debe mantenerse:

PROVENANCE  
≠  
LINEAGE  
≠  
EVIDENCE  
≠  
OBSERVABILITY

---

# **5\. PROVENANCE**

Responde:

> ¿De dónde procede este dato, referencia, policy o artefacto?

Ejemplo:

Shopify Orders API

---

# **6\. LINEAGE**

Responde:

> ¿Qué transformaciones y relaciones llevaron desde el origen hasta este resultado?

Ejemplo:

Shopify Orders  
→ exclude test orders  
→ identify new customers  
→ count new customers  
→ combine with paid spend  
→ calculate CAC

---

# **7\. EVIDENCE**

Responde:

> ¿Qué información sostiene una afirmación?

Ejemplo:

CAC increased 31%

puede apoyarse en:

current CAC observation

historical CAC baseline

comparison result

---

# **8\. OBSERVABILITY**

Responde:

> ¿Qué ocurrió técnicamente durante la ejecución?

Ejemplo:

resolver latency

API failure

retry count

run duration

Eso pertenecerá principalmente a C6.15.

---

# **9\. RESPONSABILIDAD**

C6.12 debe permitir responder:

WHAT source generated the data?

WHEN?

FOR WHICH tenant/business?

WHICH raw records?

WHICH ingestion?

WHICH transformation?

WHICH formula?

WHICH metric definition?

WHICH context?

WHICH benchmark?

WHICH guardrail?

WHICH policy?

WHICH resolver decision?

WHICH confidence assessment?

WHICH anomaly?

WHICH pattern?

WHICH finding?

WHICH versions?

WHICH dependencies?

---

# **10\. LO QUE C6.12 NO DEBE HACER**

C6.12 NO debe:

evaluate business performance

choose benchmarks

detect anomalies

detect patterns

assign priority

generate recommendations

Su función es:

record  
connect  
explain  
reconstruct

---

# **11\. EVIDENCE GRAPH**

La arquitectura debe pensar conceptualmente en:

EVIDENCE\_GRAPH

No únicamente en una lista de logs.

---

# **12\. WHY GRAPH**

Porque una conclusión puede depender de múltiples ramas.

Ejemplo:

                   ┌─ Spend  
CAC ────────────────┤  
                    └─ New Customers

Y sustainable CAC:

                       ┌─ Contribution  
                        ├─ Refunds  
Sustainable CAC ────────┼─ Repeat Contribution  
                        ├─ Payback Policy  
                        └─ Safety Buffer

---

# **13\. NODE**

Toda unidad material del lineage puede representarse como:

EVIDENCE\_NODE

---

# **14\. NODE\_ID**

Todo node debe tener:

node\_id

único.

---

# **15\. NODE TYPES**

Taxonomía inicial:

raw\_source

source\_snapshot

ingestion

raw\_record\_set

transformation

canonical\_dataset

metric\_definition

metric\_observation

context\_snapshot

data\_quality\_assessment

benchmark\_reference

guardrail\_definition

policy\_definition

policy\_snapshot

resolution

comparison

evaluation

anomaly

pattern

confidence\_assessment

finding

handoff

---

# **16\. EDGE**

Las relaciones deben representarse como:

EVIDENCE\_EDGE

---

# **17\. EDGE TYPES**

Ejemplos:

derived\_from

calculated\_from

transformed\_from

validated\_by

compared\_against

resolved\_by

governed\_by

depends\_on

supports

contradicts

limits

supersedes

generated\_from

used\_by

---

# **18\. GRAPH EXAMPLE**

Meta Spend  
    │  
    └── calculated\_from  
            ↓  
        Paid Spend  
            │  
Shopify Orders  
    │       │  
    ↓       │  
New Customers  
    │       │  
    └───────┴──→ CAC Observation  
                     │  
                     ↓  
             Historical Benchmark  
                     │  
                     ↓  
                Comparison  
                     │  
                     ↓  
                Evaluation

---

# **19\. RAW SOURCE**

Debe poder representar:

source\_system

source\_account\_ref

source\_dataset

source\_entity

source\_api

---

# **20\. SOURCE\_ID**

Debe existir:

source\_id

estable cuando sea posible.

---

# **21\. SOURCE SYSTEM**

Ejemplos:

Shopify

Meta Ads

Google Ads

GA4

Klaviyo

ERP

warehouse

finance system

manual import

---

# **22\. SOURCE ACCOUNT**

Debe poder distinguir:

Meta Ad Account A

Meta Ad Account B

sin depender de nombres humanos.

---

# **23\. SOURCE TENANT ISOLATION**

Toda provenance privada debe estar asociada a:

tenant\_id

y cuando corresponda:

business\_id

---

# **24\. SOURCE SNAPSHOT**

Debe existir conceptualmente:

SOURCE\_SNAPSHOT

que represente el estado de los datos utilizados.

---

# **25\. SOURCE\_SNAPSHOT\_ID**

Debe permitir identificar:

exact data used

en una ejecución.

---

# **26\. SOURCE CUTOFF**

Debe respetar:

source\_data\_cutoff\_at

de C6.0.

---

# **27\. NO FUTURE DATA LEAKAGE**

Historical replay de:

2026-06-01

no debe utilizar registros aparecidos:

2026-06-10

sin etiquetarlo como reevaluación posterior.

---

# **28\. INGESTION**

Debe poder representarse:

INGESTION\_EVENT

---

# **29\. INGESTION METADATA**

Ejemplo:

ingestion\_id

source\_id

started\_at

completed\_at

records\_received

records\_rejected

schema\_version

---

# **30\. INGESTION ≠ TRANSFORMATION**

Ingestion:

traer datos

Transformation:

convertirlos / limpiarlos / derivarlos

---

# **31\. RAW RECORD SET**

Puede existir:

raw\_record\_set\_id

para referenciar los registros exactos usados.

---

# **32\. LARGE DATASETS**

No es necesario duplicar todos los datos dentro del lineage.

Puede almacenarse:

dataset reference

partition

query hash

snapshot reference

record range

---

# **33\. QUERY PROVENANCE**

Cuando la observación proceda de una consulta:

query\_id

query\_version

query\_hash

pueden ayudar a reproducibilidad.

---

# **34\. SQL / TRANSFORMATION VERSIONING**

Debe ser posible identificar:

transformation\_id

transformation\_version

---

# **35\. TRANSFORMATION**

Ejemplo:

raw Shopify orders  
↓  
remove test orders  
↓  
normalize currencies  
↓  
classify customer type  
↓  
aggregate

---

# **36\. TRANSFORMATION STEPS**

Debe poder conservar:

step\_id

operation

input\_ref

output\_ref

version

cuando sea material.

---

# **37\. FILTER PROVENANCE**

Si se excluyen registros:

exclude cancelled orders

debe saberse.

---

# **38\. EXCLUSION REASON**

Puede existir:

filter\_reason

---

# **39\. DATA CLEANING**

Ejemplos:

deduplication

null handling

currency normalization

timezone normalization

outlier treatment

deben ser trazables cuando afecten al resultado.

---

# **40\. OUTLIER TREATMENT**

Si se eliminan outliers:

removed outliers

debe quedar registrado.

---

# **41\. NO SILENT TRANSFORMATION**

Nunca:

raw value  
→  
different value

sin lineage suficiente.

---

# **42\. CANONICALIZATION**

La transformación:

source metric  
→  
canonical metric

debe conservar:

mapping\_id

mapping\_version

---

# **43\. SOURCE METRIC**

Ejemplo:

Meta:  
purchase\_roas

---

# **44\. CANONICAL METRIC**

Ejemplo:

paid\_media.platform\_attributed\_roas

---

# **45\. METRIC DEFINITION LINEAGE**

Debe enlazar con:

metric\_id

metric\_version

formula\_id

formula\_version

---

# **46\. FORMULA LINEAGE**

Para:

CAC \= spend / new customers

debe poder saberse qué values formaron:

numerator

denominator

---

# **47\. COMPONENT OBSERVATIONS**

Un derived metric debe enlazar con sus componentes.

---

# **48\. EXAMPLE**

Paid Spend:  
€48,000

New Customers:  
1,000

CAC:  
€48

Lineage:

€48,000  
\+  
1,000  
→  
€48 CAC

---

# **49\. FORMULA EXECUTION**

Puede existir:

calculation\_id

para identificar la ejecución concreta.

---

# **50\. ROUNDING**

Si existe:

raw CAC:  
47.9823

display CAC:  
47.98

debe conservarse raw para evaluación.

---

# **51\. CURRENCY CONVERSION**

Si:

USD → EUR

debe conservar:

FX source

FX rate

FX date

conversion method

---

# **52\. TIMEZONE CONVERSION**

Debe poder reconstruirse.

---

# **53\. OBSERVATION LINEAGE**

Toda:

METRIC\_OBSERVATION

de C6.1 debe tener lineage suficiente hacia sus inputs.

---

# **54\. CONTEXT LINEAGE**

También:

CONTEXT\_SNAPSHOT

de C6.2.

---

# **55\. CONTEXT SOURCE**

Ejemplo:

maturity stage

puede venir de:

Phase 2 output

---

# **56\. CONFIGURED CONTEXT**

Puede proceder de:

tenant configuration

---

# **57\. DERIVED CONTEXT**

Ejemplo:

new customer share

puede proceder de datos calculados.

---

# **58\. INFERRED CONTEXT**

Debe quedar:

inferred

y enlazado a la evidencia que permitió inferirlo.

---

# **59\. DATA QUALITY LINEAGE**

Un:

DATA\_QUALITY\_ASSESSMENT

debe referenciar:

source data

incidents

coverage calculations

sample size

conflicts

---

# **60\. QUALITY CLAIM**

Ejemplo:

data\_quality \= medium

debe poder reconstruirse.

---

# **61\. BENCHMARK PROVENANCE**

Todo benchmark de C6.4 debe tener provenance.

---

# **62\. INTERNAL BENCHMARK**

Debe enlazar a:

historical observations

aggregation method

period

---

# **63\. PEER BENCHMARK**

Debe enlazar a:

peer dataset snapshot

aggregation

anonymization process

sin revelar identidades privadas.

---

# **64\. EXTERNAL BENCHMARK**

Debe enlazar a:

publisher

publication

dataset/report ref

methodology

---

# **65\. GENERIC BENCHMARK**

No debe escapar a provenance.

---

# **66\. BENCHMARK VERSION**

Lineage debe registrar exactamente:

benchmark\_id

benchmark\_version

---

# **67\. GUARDRAIL LINEAGE**

Un guardrail derivado debe permitir reconstruir:

threshold

desde sus inputs.

---

# **68\. EXAMPLE**

Contribution:  
€62

Allowed future contribution:  
€12

Risk buffer:  
15%

→  
Sustainable CAC:  
€62.90

Debe existir lineage entre esos elementos.

---

# **69\. GUARDRAIL POLICY**

Debe enlazar:

policy\_id

policy\_version

---

# **70\. ASSUMPTION LINEAGE**

Si el guardrail utiliza:

future repeat contribution

modelada, debe aparecer.

---

# **71\. POLICY PROVENANCE**

Toda policy debe tener:

source

version

scope

effective period

creator/ref

approval if applicable

---

# **72\. POLICY RESOLUTION LINEAGE**

C6.7 debe poder reconstruir:

candidate policies  
↓  
scope matching  
↓  
precedence  
↓  
override  
↓  
effective policy

---

# **73\. REJECTED POLICY**

También debe registrarse:

why rejected

cuando sea material.

---

# **74\. REFERENCE RESOLUTION LINEAGE**

Debe conservar:

available benchmarks

eligible benchmarks

rejected benchmarks

primary reference

supporting references

---

# **75\. WHY THIS MATTERS**

Si admin pregunta:

> ¿Por qué usamos peer benchmark y no histórico interno?

Debe poder responder:

Internal benchmark rejected:  
measurement break detected.

Peer benchmark selected:  
high comparability \+ sufficient quality.

---

# **76\. COMPARISON LINEAGE**

Toda comparación debe enlazar:

observation

reference

normalization

difference calculation

---

# **77\. DIFFERENCE CALCULATION**

Ejemplo:

observed \= 48

reference \= 40

relative difference \= 20%

Debe ser reproducible.

---

# **78\. EVALUATION LINEAGE**

C6.9 debe enlazar:

comparison results

guardrail evaluations

synthesis policy

confidence

---

# **79\. OVERALL STATUS LINEAGE**

Ejemplo:

overall\_status \= critical

Debe poder explicarse:

Cash guardrail:  
critical breach

Synthesis policy:  
critical cash breach dominates overall status

---

# **80\. NO OPAQUE SYNTHESIS**

Nunca:

overall\_status \= risk  
because AI decided so

---

# **81\. ANOMALY LINEAGE**

C6.10 debe enlazar:

time series

baseline

detection method

parameters

detected anomaly

---

# **82\. ANOMALY METHOD VERSION**

Debe registrarse:

method\_id

method\_version

---

# **83\. BASELINE LINEAGE**

Debe saberse de dónde salió:

expected baseline

---

# **84\. CHANGE POINT LINEAGE**

Debe poder reproducirse.

---

# **85\. PATTERN LINEAGE**

C6.11 debe enlazar:

signal A

signal B

signal C

pattern definition

condition evaluation

---

# **86\. PATTERN DEFINITION VERSION**

Debe quedar:

pattern\_id

pattern\_version

---

# **87\. SUPPORTING SIGNALS**

Deben estar identificados por referencias estructuradas.

---

# **88\. CONTRADICTORY SIGNALS**

Igualmente.

---

# **89\. CONFIDENCE LINEAGE**

C6.8 debe enlazar:

evidence

limitations

assumptions

contradictions

confidence ceiling

result

---

# **90\. CLAIM LINEAGE**

Toda afirmación material debe poder enlazarse a:

supporting evidence

---

# **91\. CLAIM\_ID**

Puede existir:

claim\_id

para afirmaciones materializadas.

---

# **92\. CLAIM TYPES**

Ejemplos:

fact

interpretation

hypothesis

risk

projection

---

# **93\. SUPPORT RELATION**

Debe poder existir:

supports

entre evidence y claim.

---

# **94\. CONTRADICTS RELATION**

Debe existir:

contradicts

---

# **95\. LIMITS RELATION**

Puede existir:

limits

cuando una evidencia reduce la fuerza de un claim.

---

# **96\. EXAMPLE**

Claim:

CAC materially deteriorated.

Supporting:

current CAC observation

historical comparison

Limiting:

historical benchmark quality \= medium

---

# **97\. FACT LINEAGE**

Fact:

CAC increased 37%.

Debe apuntar a cálculos exactos.

---

# **98\. INTERPRETATION LINEAGE**

Interpretation:

Acquisition efficiency deteriorated.

Debe apuntar a:

CAC comparison

possibly marginal CAC

possibly CVR

según definición.

---

# **99\. HYPOTHESIS LINEAGE**

Hypothesis:

Audience saturation may contribute.

Debe mostrar:

supporting evidence

contradictory evidence

missing evidence

---

# **100\. NO HIDDEN CHAIN**

Toda afirmación material visible al usuario debe ser potencialmente reconstruible.

---

# **101\. LINEAGE DEPTH**

No todos los consumidores necesitan ver el mismo nivel.

Debe soportarse:

summary lineage

detailed lineage

full technical lineage

---

# **102\. SUMMARY LINEAGE**

Ejemplo:

CAC €48  
→ compared against sustainable CAC €43  
→ risk

---

# **103\. DETAILED LINEAGE**

Añade:

source

formula

benchmark

policy

confidence

---

# **104\. FULL LINEAGE**

Incluye:

raw source snapshots

transformations

versions

execution IDs

---

# **105\. LINEAGE VIEW**

Admin debería poder navegar:

finding  
↓  
evaluation  
↓  
comparison  
↓  
metric  
↓  
source

y también al revés:

source  
↓  
which metrics?  
↓  
which findings?

---

# **106\. FORWARD LINEAGE**

Pregunta:

> Si falla esta fuente, ¿qué conclusiones están afectadas?

Debe poder responderse.

---

# **107\. BACKWARD LINEAGE**

Pregunta:

> ¿De qué datos salió esta conclusión?

También.

---

# **108\. BLAST RADIUS**

Puede existir conceptualmente:

dependency\_blast\_radius

---

# **109\. EXAMPLE**

Si:

Meta spend ingestion

está corrupta, podemos buscar:

all CAC observations

all ROAS evaluations

all acquisition patterns

all findings

dependientes.

---

# **110\. LINEAGE GRAPH QUERY**

La arquitectura debe permitir consultas conceptuales como:

find all descendants of node X

find all ancestors of finding Y

---

# **111\. IMMUTABILITY**

Los lineage records usados en una ejecución histórica no deben reescribirse silenciosamente.

---

# **112\. APPEND-ORIENTED HISTORY**

Los cambios deben producir:

new nodes

new edges

new versions

cuando sea necesario.

---

# **113\. CORRECTION**

Si un dato fue incorrecto, no borrar simplemente.

Debe poder existir:

corrected\_by

o:

supersedes

---

# **114\. ORIGINAL DATA**

Debe permanecer auditable cuando la política de retención lo permita.

---

# **115\. REPROCESSING**

Si se recalcula una métrica:

new observation\_id

o versión/relation apropiada.

---

# **116\. REEVALUATION**

Si cambia una policy:

new evaluation

no editar la anterior.

---

# **117\. REPLAY**

Historical replay debe utilizar:

original input snapshot

original config snapshot

original version manifest

---

# **118\. REPLAY LINEAGE**

Debe indicar:

replay\_of\_run\_id

de C6.0.

---

# **119\. REEVALUATION VS REPLAY**

Replay:

What did the system do then?

Reevaluation:

What would the current system say about old data?

Debe distinguirse.

---

# **120\. VERSION LINEAGE**

C6.12 debe capturar versiones de:

runtime contract

metric definition

formula

context contract

quality rules

benchmark

guardrail

policy

resolver

confidence model

evaluation engine

anomaly detector

pattern definition

finding contract

---

# **121\. NO `"LATEST"` IN HISTORY**

Nunca depender de:

version \= latest

para reconstrucción histórica.

---

# **122\. EVIDENCE PACKAGE**

Puede existir conceptualmente:

EVIDENCE\_PACKAGE

como conjunto autocontenido de referencias para una conclusión.

---

# **123\. PACKAGE\_ID**

Debe tener:

evidence\_package\_id

---

# **124\. PACKAGE CONTENT**

Ejemplo:

supporting evidence

contradictory evidence

limitations

assumptions

provenance refs

lineage root

---

# **125\. PACKAGE PURPOSE**

Facilitar consumo por:

Finding

Inter-Phase Handoff

Admin UI

Audit export

---

# **126\. EVIDENCE ITEM**

Debe poder existir:

EVIDENCE\_ITEM

---

# **127\. EVIDENCE ITEM TYPES**

Ejemplos:

observation

comparison

benchmark

guardrail breach

anomaly

pattern

source document

configured policy

human validation

---

# **128\. EVIDENCE STRENGTH**

Puede referenciar C6.8:

strong

moderate

weak

insufficient

---

# **129\. EVIDENCE ROLE**

Puede ser:

primary

supporting

contradictory

limiting

contextual

---

# **130\. PRIMARY EVIDENCE**

Sin ella el claim normalmente no debería sostenerse.

---

# **131\. SUPPORTING EVIDENCE**

Refuerza.

---

# **132\. CONTRADICTORY EVIDENCE**

Debilita o cuestiona.

---

# **133\. LIMITING EVIDENCE**

No contradice necesariamente, pero reduce claim strength.

---

# **134\. CONTEXTUAL EVIDENCE**

Ayuda a interpretar.

---

# **135\. PROVENANCE STATUS**

Puede existir:

complete

partial

unknown

---

# **136\. UNKNOWN PROVENANCE**

Debe reducir confianza cuando sea material.

---

# **137\. EXTERNAL DATA**

Para benchmark externo puede existir provenance parcial.

Debe representarse honestamente.

---

# **138\. MANUAL INPUT PROVENANCE**

Debe conservar:

manual

entered\_at

entered\_by\_ref

source\_document\_ref

cuando sea apropiado.

---

# **139\. HUMAN VALIDATION**

Puede añadir:

validated\_by\_ref

validated\_at

validation\_note

---

# **140\. HUMAN VALIDATION DOES NOT DELETE MACHINE LINEAGE**

Debe añadirse como nodo/edge.

---

# **141\. MODEL-GENERATED EVIDENCE**

Cuando un LLM o modelo produzca una inferencia:

model\_provider

model\_family

model\_version

agent\_version

prompt\_version

cuando sea material.

---

# **142\. MODEL OUTPUT ≠ SOURCE FACT**

Debe estar etiquetado como:

inferred

modeled

generated

---

# **143\. RETRIEVAL LINEAGE**

Si un LLM usa RAG:

retrieval\_id

knowledge\_chunk\_refs

retriever\_version

pueden ser relevantes.

---

# **144\. KNOWLEDGE RETRIEVAL ≠ BUSINESS DATA**

Debe mantenerse separado.

---

# **145\. POLICY RETRIEVAL**

Las policies no deben resolverse desde RAG libre.

Debe utilizarse policy store estructurado.

---

# **146\. DOCUMENT EVIDENCE**

Si se utiliza un documento de cliente:

document\_id

document\_version

section/page/chunk ref

cuando sea posible.

---

# **147\. DOCUMENT VERSION**

Muy importante si el documento cambia.

---

# **148\. EVIDENCE MINIMIZATION**

Lineage no significa copiar datos sensibles innecesariamente.

Puede utilizar:

references

hashes

IDs

aggregates

---

# **149\. PII MINIMIZATION**

No almacenar:

customer email

full name

address

si no es necesario para la trazabilidad.

---

# **150\. DATA SECURITY**

Lineage debe respetar:

tenant isolation

permissions

data classification

---

# **151\. LINEAGE ≠ AUTHORIZATION**

Que un nodo exista no significa que cualquier usuario pueda abrirlo.

---

# **152\. ACCESS CONTROL**

Debe aplicarse:

tenant

role

resource permission

según arquitectura general.

---

# **153\. CROSS-TENANT BENCHMARKS**

En peer benchmarks:

raw private tenant data

no debe quedar expuesto.

Lineage puede apuntar a:

anonymized aggregate dataset

---

# **154\. PRIVACY-PRESERVING LINEAGE**

Debemos poder demostrar provenance del agregado sin identificar peers.

---

# **155\. HASHING**

Puede utilizarse para:

integrity checks

snapshot identity

---

# **156\. CONTENT HASH**

Puede existir:

content\_hash

para ciertos artefactos.

---

# **157\. HASH ≠ VERSION**

Ambos conceptos son diferentes.

---

# **158\. LINEAGE INTEGRITY**

Debe impedir relaciones imposibles.

Ejemplo:

finding created before its observation

salvo replay/temporal semantics justificadas.

---

# **159\. DAG**

Idealmente el lineage debe comportarse como:

directed acyclic graph

para derivaciones.

---

# **160\. CYCLES**

Relaciones históricas como:

supersedes

deben manejarse sin crear dependencias de cálculo circulares.

---

# **161\. DEPENDENCY CYCLE**

Un cálculo no puede depender de sí mismo.

---

# **162\. LINEAGE VALIDATION**

Debe detectar:

orphan nodes

broken references

missing versions

invalid tenant links

cycles

temporal inconsistencies

---

# **163\. ORPHAN ARTIFACT**

Ejemplo:

evaluation  
without observation\_id

debe fallar.

---

# **164\. ORPHAN FINDING**

No debe existir finding material sin:

run\_id

evidence\_package

---

# **165\. REQUIRED LINEAGE DEPTH**

Puede variar por artefacto.

---

# **166\. OBSERVATION MINIMUM LINEAGE**

Debe llegar al menos hasta:

source

transformation/formula

---

# **167\. EVALUATION MINIMUM LINEAGE**

Debe incluir:

observation

reference/guardrail

policy/resolution

confidence

---

# **168\. PATTERN MINIMUM LINEAGE**

Debe incluir:

signals

pattern definition

confidence

---

# **169\. FINDING MINIMUM LINEAGE**

Debe incluir:

material conclusion

evidence package

confidence

run

---

# **170\. EVIDENCE SUFFICIENCY**

C6.12 no calcula la confidence final, pero debe poder señalar:

lineage\_complete \= true/false

---

# **171\. LINEAGE COMPLETENESS**

Estados conceptuales:

complete

sufficient

partial

broken

---

# **172\. COMPLETE**

Todos los links esperados están disponibles.

---

# **173\. SUFFICIENT**

Existe suficiente trazabilidad para auditar la conclusión aunque falten detalles secundarios.

---

# **174\. PARTIAL**

Faltan piezas materiales.

---

# **175\. BROKEN**

No puede reconstruirse la cadena.

---

# **176\. LINEAGE COMPLETENESS ≠ DATA QUALITY**

Puede haber:

perfect lineage

de:

bad data

y viceversa.

---

# **177\. EXPLAINABILITY PATH**

Debe poder construirse:

EXPLANATION\_PATH

---

# **178\. EXPLANATION PATH PURPOSE**

Transformar el graph en una secuencia inteligible.

Ejemplo:

1\. CAC measured at €48.  
2\. Data quality was high.  
3\. Historical reference was €35.  
4\. Sustainable CAC guardrail was €43.  
5\. Observation exceeded the guardrail by 11.6%.  
6\. Evaluation therefore entered risk state.

---

# **179\. ADMIN WHY QUERY**

Debe poder responder:

> ¿Por qué la IA dijo que CAC era peligroso?

---

# **180\. EXAMPLE ANSWER GRAPH**

Finding:  
CAC economic risk  
        ↓  
Evaluation:  
risk  
        ↓  
Guardrail evaluation:  
breached \+11.6%  
        ↓  
Guardrail:  
€43  
        ↓  
Policy:  
90-day payback \+ 15% buffer  
        ↓  
Economics:  
contribution \+ repeat contribution

Y paralelamente:

CAC observation:  
€48  
        ↓  
Paid spend:  
€48,000  
        ↓  
New customers:  
1,000

---

# **181\. WHY BENCHMARK QUERY**

Pregunta:

> ¿Por qué comparaste contra €35?

Path:

Historical benchmark selected  
↓  
same season  
↓  
same business  
↓  
same customer scope  
↓  
high comparability  
↓  
high quality

---

# **182\. WHY NOT OTHER BENCHMARK QUERY**

Pregunta:

> ¿Por qué no usaste industry benchmark €52?

Respuesta:

Peer/industry reference kept as supporting only.

Internal same-season benchmark  
had stronger contextual comparability.

---

# **183\. WHY CONFIDENCE QUERY**

Pregunta:

> ¿Por qué confidence era medium?

Path:

Data quality:  
high

Benchmark comparability:  
high

Guardrail dependency:  
modeled repeat contribution

Critical assumption:  
unverified

→ confidence ceiling \= medium

---

# **184\. WHY PATTERN QUERY**

Pregunta:

> ¿Por qué se detectó unsafe scaling?

Path:

Marginal CAC critical breach  
\+  
Cash risk  
\+  
Inventory warning  
\+  
Fulfillment utilization high  
↓  
Pattern definition matched  
↓  
Pattern confidence high

---

# **185\. LINEAGE QUERY API CONCEPT**

La arquitectura debería permitir conceptualmente:

get\_lineage(node\_id)

get\_ancestors(node\_id)

get\_descendants(node\_id)

get\_explanation\_path(claim\_id)

Implementación concreta se decidirá después.

---

# **186\. LINEAGE SNAPSHOT**

Puede existir:

lineage\_snapshot\_id

para congelar una subcadena.

---

# **187\. EVIDENCE PACKAGE SNAPSHOT**

Especialmente útil para findings.

---

# **188\. AUDIT EXPORT**

La arquitectura debe permitir posteriormente exportar:

finding

evidence

versions

policies

references

lineage

---

# **189\. MACHINE-READABLE AUDIT**

Debe existir formato estructurado.

---

# **190\. HUMAN-READABLE AUDIT**

También puede generarse:

Why did the system say X?

---

# **191\. AUDIT PACKAGE**

Puede existir:

AUDIT\_PACKAGE

posteriormente gestionado por C6.15.

---

# **192\. LINEAGE REASON CODES**

Ejemplos:

LIN\_RAW\_SOURCE

LIN\_SOURCE\_SNAPSHOT

LIN\_TRANSFORMATION

LIN\_FORMULA

LIN\_CANONICAL\_MAPPING

LIN\_POLICY\_APPLIED

LIN\_POLICY\_OVERRIDE

LIN\_REFERENCE\_SELECTED

LIN\_REFERENCE\_REJECTED

LIN\_GUARDRAIL\_DERIVED

LIN\_CONFIDENCE\_LIMITED

LIN\_PATTERN\_MATCHED

LIN\_CLAIM\_SUPPORTED

LIN\_CLAIM\_CONTRADICTED

---

# **193\. EVIDENCE GRAPH SHAPE**

Conceptualmente:

evidence\_graph:

    graph\_id

    root\_nodes

    nodes:  
        node\_id  
        node\_type  
        entity\_ref  
        entity\_version  
        tenant\_id  
        business\_id  
        created\_at  
        metadata

    edges:  
        edge\_id  
        source\_node\_id  
        target\_node\_id  
        relation\_type  
        metadata

    integrity:  
        lineage\_completeness  
        validation\_status

---

# **194\. EVIDENCE ITEM SHAPE**

evidence\_item:

    evidence\_id

    evidence\_type

    entity\_ref

    evidence\_role

    evidence\_strength

    provenance\_status

    supports\_claim\_ids

    contradicts\_claim\_ids

    limitations

---

# **195\. PROVENANCE SHAPE**

provenance:

    source\_id

    source\_type

    source\_system

    source\_account\_ref

    source\_snapshot\_id

    source\_data\_cutoff\_at

    ingestion\_id

    transformation\_id

    transformation\_version

    content\_hash

    timestamps

---

# **196\. CLAIM SHAPE**

claim:

    claim\_id

    claim\_type

    subject\_ref

    statement\_semantics

    claim\_strength

    confidence\_ref

    supporting\_evidence

    contradictory\_evidence

    limiting\_evidence

    lineage\_root

---

# **197\. EXAMPLE — CAC FULL LINEAGE**

SOURCE A

Meta Ads Spend  
August 2026  
€48,000

SOURCE B

Shopify Orders  
August 2026

Transformation:

remove test orders  
remove cancelled orders  
identify first completed purchase

Result:

New Customers:  
1,000

Formula:

CAC \=  
48,000 / 1,000  
\=  
€48

Context:

Spain  
Meta Prospecting  
New Customers  
Average  
Observed

Data Quality:

High

Benchmark:

Same-season internal CAC:  
€35

Guardrail:

Sustainable CAC:  
€43

Comparison:

vs history:  
\+37.1%

vs guardrail:  
\+11.6%

Evaluation:

historical:  
materially worse

economic:  
risk

Confidence:

High

Finding:

Acquisition efficiency has deteriorated  
and current CAC exceeds the configured  
sustainable acquisition limit.

C6.12 debe permitir recorrer toda esta cadena.

---

# **198\. EXAMPLE — ATTRIBUTION RISK LINEAGE**

Pattern:

Paid Media Attribution Risk

Supporting evidence:

Meta ROAS \+24%

Meta attributed revenue \+31%

MER \-11%

New customer share \-9%

Cada señal debe tener su propia lineage.

Pattern:

signal refs  
↓  
pattern definition v2.1  
↓  
condition evaluation  
↓  
pattern detection  
↓  
confidence

---

# **199\. EXAMPLE — DATA ISSUE**

Finding:

CVR deterioration cannot be confirmed.

Lineage:

GA4 sessions ↓ abnormally

Shopify orders stable

tracking incident detected

data quality \= insufficient

comparison confidence \= low

status \= indeterminate

También debe ser completamente trazable.

---

# **200\. NO LINEAGE SHORTCUT**

No aceptar:

source:  
AI analysis

como provenance suficiente.

---

# **201\. AI ANALYSIS LINEAGE**

Debe enlazar a los artefactos concretos analizados.

---

# **202\. RAG LINEAGE**

Si knowledge RAG contribuye a interpretación:

knowledge\_ref

puede registrarse.

Pero no debe sustituir:

business data lineage

---

# **203\. KNOWLEDGE VERSIONING**

Puede ser útil registrar:

knowledge\_base\_version

retrieval\_index\_version

cuando afecten materialmente al resultado.

---

# **204\. RAG CHUNK TRACE**

En outputs de alto valor puede conservarse:

retrieved\_chunk\_refs

sin necesariamente persistir contenido completo.

---

# **205\. KNOWLEDGE ≠ EVIDENCE OF BUSINESS STATE**

Muy importante.

Una regla RAG como:

rising CAC may indicate acquisition inefficiency

no demuestra:

this business has acquisition inefficiency

El estado debe proceder de business data.

---

# **206\. POLICY ≠ KNOWLEDGE**

Igualmente, lineage debe poder distinguir ambos.

---

# **207\. HUMAN EVIDENCE**

Puede existir:

consultant note

validated financial value

manual operational event

si está estructurado y referenciado.

---

# **208\. HUMAN NOTE CONFIDENCE**

Una nota humana no debe convertirse automáticamente en fact absoluto.

Puede etiquetarse:

reported

verified

unverified

---

# **209\. TRACEABILITY GRANULARITY**

No todas las métricas necesitan guardar cada row como edge.

Debe equilibrarse:

auditability

storage

performance

privacy

---

# **210\. AGGREGATED LINEAGE**

Puede utilizar:

dataset snapshot  
\+  
transformation  
\+  
record count

para grandes volúmenes.

---

# **211\. HIGH-RISK ARTIFACTS**

Para findings particularmente materiales puede requerirse lineage más profundo.

---

# **212\. LINEAGE POLICY**

C6.6 puede definir:

minimum lineage depth

retention

required provenance

audit requirements

---

# **213\. REQUIRED PROVENANCE BY TYPE**

Ejemplo:

External benchmark:

publisher required

Internal observation:

source snapshot required

Configured policy:

policy version required

---

# **214\. LINEAGE RETENTION**

Debe existir una estrategia para conservar lineage histórico.

Implementación concreta posterior.

---

# **215\. DATA RETENTION VS LINEAGE RETENTION**

Puede ocurrir:

raw data deleted

por retention policy.

Pero conservar:

aggregate snapshot metadata

hash

transformation refs

evaluation lineage

si legalmente apropiado.

---

# **216\. PRIVACY DELETION**

El sistema debe poder respetar eliminaciones de datos personales sin destruir necesariamente toda la trazabilidad agregada.

Esto requerirá diseño de privacidad posterior.

---

# **217\. NO SECRET PII IN METADATA**

No incluir datos sensibles en:

node names

IDs

reason strings

---

# **218\. LINEAGE ERROR**

Debe existir:

LINEAGE\_ERROR

cuando alguna relación necesaria no pueda reconstruirse.

---

# **219\. ERROR TYPES**

Ejemplos:

missing\_source

missing\_version

broken\_edge

orphan\_artifact

cross\_tenant\_reference

cycle\_detected

snapshot\_unavailable

---

# **220\. FAIL CLOSED**

En findings materiales que requieren lineage completo:

broken lineage

puede impedir que el resultado sea tratado como plenamente auditable.

---

# **221\. LINEAGE QUALITY**

Puede existir:

lineage\_quality

pero no sustituye data quality.

---

# **222\. LINEAGE QUALITY LEVELS**

complete

sufficient

partial

broken

---

# **223\. HISTORICAL RECONSTRUCTION TEST**

Debe ser posible tomar:

finding\_id

y reconstruir:

all material ancestors

---

# **224\. FORWARD IMPACT TEST**

Debe poder tomar:

source\_snapshot\_id

y encontrar:

all affected findings

---

# **225\. VERSION IMPACT TEST**

Pregunta:

> ¿Qué findings utilizaron benchmark v2.1?

Debe poder responderse.

---

# **226\. POLICY IMPACT TEST**

Pregunta:

> ¿Qué evaluaciones utilizaron policy CAC v4?

También.

---

# **227\. TRACKING INCIDENT IMPACT**

Pregunta:

> ¿Qué findings dependieron del período con tracking outage?

Debe ser posible.

---

# **228\. ADMIN PANEL REQUIREMENTS**

El panel deberá poder ofrecer vistas como:

Why?

Sources

Transformations

Benchmarks

Policies

Guardrails

Confidence

Version history

---

# **229\. EXPLAINABILITY UI**

Ejemplo conceptual:

Finding  
└── Why?  
    ├── Observation  
    ├── Reference  
    ├── Guardrail  
    ├── Policy  
    ├── Confidence  
    └── Source lineage

---

# **230\. NO RAW CHAIN OF THOUGHT**

La explicabilidad debe basarse en:

structured evidence

rules

references

decisions

No necesita almacenar razonamiento interno libre del modelo.

---

# **231\. STRUCTURED REASONING TRACE**

Lo que sí necesitamos es:

candidate A rejected because X

candidate B selected because Y

guardrail breached because Z

---

# **232\. DETERMINISTIC EXPLANATION**

Siempre que sea posible, la explicación debe derivarse de campos estructurados.

---

# **233\. INVARIANTES C6.12**

## **INV-C6.12-001**

No material claim without lineage.

---

## **INV-C6.12-002**

Every material artifact must link to a run.

---

## **INV-C6.12-003**

Every observation must have source provenance.

---

## **INV-C6.12-004**

Derived metrics must link to material inputs.

---

## **INV-C6.12-005**

Transformations must be versioned when material.

---

## **INV-C6.12-006**

Benchmarks must preserve provenance.

---

## **INV-C6.12-007**

Guardrails must preserve derivation/policy origin.

---

## **INV-C6.12-008**

Policy resolution must preserve candidate and override trace.

---

## **INV-C6.12-009**

Evaluation status must preserve its basis.

---

## **INV-C6.12-010**

Anomaly must preserve baseline and detection method.

---

## **INV-C6.12-011**

Pattern must preserve supporting and contradictory signals.

---

## **INV-C6.12-012**

Confidence must preserve evidence and limitations.

---

## **INV-C6.12-013**

Historical lineage must not depend on latest versions.

---

## **INV-C6.12-014**

No silent transformation.

---

## **INV-C6.12-015**

No cross-tenant private lineage.

---

## **INV-C6.12-016**

Lineage references do not grant authorization.

---

## **INV-C6.12-017**

PII must be minimized.

---

## **INV-C6.12-018**

Reevaluation must not overwrite original lineage.

---

## **INV-C6.12-019**

Replay and reevaluation must remain distinguishable.

---

## **INV-C6.12-020**

Supporting and contradictory evidence must both be representable.

---

## **INV-C6.12-021**

Knowledge retrieved from RAG must not masquerade as business evidence.

---

## **INV-C6.12-022**

AI-generated inference must remain identified as inference.

---

## **INV-C6.12-023**

Broken critical lineage must be explicitly visible.

---

## **INV-C6.12-024**

Orphan material artifacts are invalid.

---

## **INV-C6.12-025**

Lineage must support backward and forward traversal.

---

## **INV-C6.12-026**

Every historical version used must be recoverable.

---

## **INV-C6.12-027**

Pattern lineage must identify definition version.

---

## **INV-C6.12-028**

Confidence lineage must identify confidence model/policy version where material.

---

## **INV-C6.12-029**

A human override must not erase original machine evidence.

---

## **INV-C6.12-030**

Explainability should expose structured evidence, not hidden model chain-of-thought.

---

# **234\. VALIDACIONES MÍNIMAS**

Antes de aceptar lineage material:

run exists?

tenant valid?

business valid?

source refs valid?

snapshots accessible?

versions present?

transformations valid?

formula refs valid?

metric definition valid?

benchmark refs valid?

guardrail refs valid?

policy refs valid?

confidence refs valid?

no forbidden cross-tenant edge?

no orphan node?

no dependency cycle?

timestamps coherent?

---

# **235\. VALIDATION — OBSERVATION**

Una metric observation sin source/transformation suficiente debe marcar lineage incompleto.

---

# **236\. VALIDATION — EVALUATION**

Una evaluation sin:

observation

reference/guardrail

resolution

es inválida.

---

# **237\. VALIDATION — PATTERN**

Un pattern sin supporting signals es inválido salvo definición explícita especial.

---

# **238\. VALIDATION — CLAIM**

Un claim material sin evidence package debe fallar o quedar unsupported.

---

# **239\. VALIDATION — VERSION**

No aceptar:

benchmark\_version \= latest

en artefacto histórico.

---

# **240\. VALIDATION — TENANT**

Un edge entre datos privados de tenants distintos debe bloquearse.

---

# **241\. VALIDATION — TEMPORAL**

Debe detectar lineage que utiliza datos futuros respecto al cutoff.

---

# **242\. VALIDATION — TRANSFORMATION**

Una versión inexistente debe producir error.

---

# **243\. VALIDATION — GRAPH INTEGRITY**

Debe comprobar:

broken references

invalid edge type

cycles

duplicates

---

# **244\. RELACIÓN CON C6.0**

C6.0 proporciona la raíz de ejecución:

tenant

business

run

trace

versions

snapshots

---

# **245\. RELACIÓN CON C6.1**

C6.1 aporta:

metric definitions

observations

formulas

semantics

---

# **246\. RELACIÓN CON C6.2**

C6.2 aporta:

context snapshot

comparability assessment

---

# **247\. RELACIÓN CON C6.3**

C6.3 aporta:

data quality assessment

tracking incidents

source conflicts

---

# **248\. RELACIÓN CON C6.4**

C6.4 aporta provenance de benchmark.

---

# **249\. RELACIÓN CON C6.5**

C6.5 aporta lineage de guardrails y formulas de threshold.

---

# **250\. RELACIÓN CON C6.6**

C6.6 aporta:

policy definitions

inheritance

overrides

effective policy

---

# **251\. RELACIÓN CON C6.7**

C6.7 aporta:

selection/rejection trace

---

# **252\. RELACIÓN CON C6.8**

C6.8 aporta:

evidence

assumptions

uncertainty

confidence

---

# **253\. RELACIÓN CON C6.9**

C6.9 aporta comparisons y evaluations.

---

# **254\. RELACIÓN CON C6.10**

C6.10 aporta anomaly lineage.

---

# **255\. RELACIÓN CON C6.11**

C6.11 aporta pattern/red flag lineage.

---

# **256\. RELACIÓN CON C6.13**

C6.13 utilizará:

EVIDENCE\_PACKAGE

como soporte del Finding.

---

# **257\. RELACIÓN CON C6.14**

Los handoffs entre fases deberán transportar:

evidence refs

lineage refs

confidence refs

sin copiar todo el graph.

---

# **258\. RELACIÓN CON C6.15**

C6.15 utilizará lineage para:

audit

admin inspection

runtime debugging

impact analysis

---

# **259\. RELACIÓN CON C6.16**

C6.16 deberá verificar invariantes de lineage con fixtures.

---

# **260\. RELACIÓN CON FASE 3**

Diagnóstico podrá recibir evidencia estructurada y devolver hypotheses/causes igualmente trazables.

---

# **261\. RELACIÓN CON FASE 4**

Prioridad futura debe poder apuntar a findings y evidence originales.

---

# **262\. RELACIÓN CON FASE 7**

Una recomendación deberá poder responder:

> ¿Qué evidencia hizo que recomendáramos esto?

C6.12 proporciona la base.

---

# **263\. RELACIÓN CON FASE 9**

Los resultados posteriores podrán conectarse hacia atrás para responder:

Which recommendations/findings were actually correct?

---

# **264\. TESTS MÍNIMOS**

## **TEST 1 — Raw to Metric**

Debe reconstruir fuente → transformación → observation.

---

## **TEST 2 — Derived Metric**

Debe reconstruir numerator \+ denominator → metric.

---

## **TEST 3 — Benchmark**

Debe reconstruir benchmark source/version.

---

## **TEST 4 — Guardrail**

Debe reconstruir guardrail formula \+ policy.

---

## **TEST 5 — Policy Override**

Debe mostrar parent \+ override \+ effective policy.

---

## **TEST 6 — Benchmark Rejection**

Debe mostrar por qué una referencia fue descartada.

---

## **TEST 7 — Evaluation**

Debe reconstruir observation → comparison → status.

---

## **TEST 8 — Confidence**

Debe mostrar evidence → ceiling → confidence.

---

## **TEST 9 — Anomaly**

Debe mostrar series → baseline → method → anomaly.

---

## **TEST 10 — Pattern**

Debe mostrar signals → pattern definition → result.

---

## **TEST 11 — Contradictory Evidence**

Debe preservarse.

---

## **TEST 12 — Forward Lineage**

Desde source debe encontrar findings afectados.

---

## **TEST 13 — Backward Lineage**

Desde finding debe encontrar sources.

---

## **TEST 14 — Historical Replay**

Debe utilizar versiones históricas.

---

## **TEST 15 — Reevaluation**

Debe crear nueva lineage sin destruir original.

---

## **TEST 16 — Future Data Leakage**

Debe detectarlo.

---

## **TEST 17 — Cross-Tenant Edge**

Debe bloquearlo.

---

## **TEST 18 — Orphan Evaluation**

Debe fallar.

---

## **TEST 19 — Missing Version**

Debe marcar lineage broken/partial.

---

## **TEST 20 — Transformation Change**

Nueva versión debe ser visible.

---

## **TEST 21 — Human Override**

Debe conservar machine result original.

---

## **TEST 22 — External Benchmark**

Debe conservar publisher/methodology refs.

---

## **TEST 23 — Peer Privacy**

No debe revelar tenants individuales.

---

## **TEST 24 — RAG Knowledge**

Debe distinguir knowledge evidence de business evidence.

---

## **TEST 25 — Claim Support**

Todo claim material debe tener supporting evidence.

---

# **265\. ANTI-PATRÓN — LOGS \= LINEAGE**

Incorrecto:

console.log("CAC evaluated")

no constituye lineage.

---

# **266\. ANTI-PATRÓN — SOURCE \= DATABASE**

Incorrecto:

source:  
database

sin especificar snapshot/tabla/query/transformación suficiente.

---

# **267\. ANTI-PATRÓN — AI SAID SO**

Incorrecto:

reason:  
AI analysis

---

# **268\. ANTI-PATRÓN — NO VERSION**

Incorrecto:

benchmark:  
industry CAC

sin versión.

---

# **269\. ANTI-PATRÓN — OVERWRITE**

No reemplazar:

old evaluation

por nueva.

---

# **270\. ANTI-PATRÓN — KNOWLEDGE AS BUSINESS FACT**

Incorrecto:

RAG says CAC above X is risky  
therefore this business is risky

---

# **271\. ANTI-PATRÓN — HIDDEN TRANSFORMATIONS**

No modificar datos sin lineage.

---

# **272\. ANTI-PATRÓN — HUMAN OVERRIDE ERASES MACHINE RESULT**

Nunca.

---

# **273\. ANTI-PATRÓN — FULL PII COPIED INTO LINEAGE**

No necesario y peligroso.

---

# **274\. ANTI-PATRÓN — CROSS-TENANT RAW BENCHMARK LINEAGE**

Nunca exponer datos privados de peers.

---

# **275\. ANTI-PATRÓN — LATEST VERSION**

No usar versiones flotantes en histórico.

---

# **276\. ANTI-PATRÓN — CLAIM WITHOUT EVIDENCE**

Debe bloquearse.

---

# **277\. ANTI-PATRÓN — ONE TEXT FIELD**

Incorrecto:

reasoning:  
"because CAC was too high"

como única trazabilidad.

---

# **278\. ACCEPTANCE CRITERIA**

Para cualquier finding material debemos poder responder:

1\. ¿Cuál es el finding?

2\. ¿Qué run lo produjo?

3\. ¿Qué tenant/business?

4\. ¿Qué observation lo originó?

5\. ¿Qué fuente produjo esa observation?

6\. ¿Qué snapshot de datos se utilizó?

7\. ¿Qué transformación se aplicó?

8\. ¿Qué versión de transformación?

9\. ¿Qué fórmula se utilizó?

10\. ¿Qué metric version?

11\. ¿Qué contexto se utilizó?

12\. ¿Qué data quality tenía?

13\. ¿Qué benchmark se utilizó?

14\. ¿Qué versión del benchmark?

15\. ¿Qué benchmark se rechazó?

16\. ¿Por qué?

17\. ¿Qué guardrail se utilizó?

18\. ¿Cómo se calculó?

19\. ¿Qué policy lo configuró?

20\. ¿Qué policy override existía?

21\. ¿Qué resolución se produjo?

22\. ¿Qué comparación se calculó?

23\. ¿Qué evaluación resultó?

24\. ¿Qué anomaly influyó?

25\. ¿Qué pattern influyó?

26\. ¿Qué confidence tenía?

27\. ¿Qué evidence la soportaba?

28\. ¿Qué evidence la contradecía?

29\. ¿Qué assumptions existían?

30\. ¿Qué versiones de engines se usaron?

31\. ¿Qué lineage está incompleto?

32\. ¿Puede reconstruirse la conclusión?

33\. ¿Puede saberse qué otros findings dependen de la misma fuente?

---

# **279\. DEFINITION OF DONE**

C6.12 estará formalmente definido cuando exista:

Evidence Graph

Evidence Nodes

Evidence Edges

Node Types

Edge Types

Source Provenance

Source Snapshots

Ingestion Lineage

Raw Dataset References

Transformation Lineage

Transformation Versioning

Canonicalization Lineage

Formula Lineage

Metric Observation Lineage

Context Lineage

Data Quality Lineage

Benchmark Provenance

Guardrail Derivation Lineage

Policy Lineage

Policy Resolution Trace

Reference Resolution Trace

Comparison Lineage

Evaluation Lineage

Anomaly Lineage

Pattern Lineage

Confidence Lineage

Claim Lineage

Evidence Packages

Evidence Roles

Supporting Evidence

Contradictory Evidence

Limiting Evidence

Forward Lineage

Backward Lineage

Blast Radius

Historical Replay

Reevaluation

Version Manifest Linkage

Lineage Completeness

Integrity Validation

Privacy-Safe Lineage

Admin Explanation Paths

Validation Rules

Test Fixtures

---

# **280\. RESULTADO ARQUITECTÓNICO**

Sin C6.12:

FINDING

CAC is critical.

Con C6.12:

FINDING

Current acquisition economics are unsafe.

WHY?

CAC:  
€48

HOW WAS CAC CALCULATED?

Paid spend:  
€48,000

New customers:  
1,000

Formula:  
Paid Spend / New Customers

WHERE DID THE DATA COME FROM?

Paid Spend:  
Meta Ads

Customers:  
Shopify

DATA QUALITY

High

WHAT REFERENCE WAS USED?

Historical CAC:  
€35

Comparable:  
High

WHAT LIMIT WAS USED?

Sustainable CAC:  
€43

WHY €43?

90-day contribution economics  
\+  
tenant risk buffer

POLICY

CAC Sustainability Policy  
v4.2

EVALUATION

CAC exceeds sustainable limit by:  
11.6%

STATUS

Risk

CONFIDENCE

High

LIMITATIONS

Marginal CAC unavailable.

VERSIONS

Metric:  
v2.1

Benchmark:  
v3.0

Policy:  
v4.2

Evaluator:  
v5.1

Esto convierte el sistema en una infraestructura que puede ser:

audited

debugged

explained

tested

replayed

trusted

---

# **281\. PRINCIPIO FINAL DE C6.12**

C6.12 debe imponer:

Every important conclusion  
must have a path back  
to evidence.

Y:

DATA  
→  
TRANSFORMATION  
→  
METRIC  
→  
REFERENCE  
→  
POLICY  
→  
EVALUATION  
→  
CONFIDENCE  
→  
CLAIM

debe ser reconstruible.

Además:

TRACEABILITY  
≠  
free-text reasoning.

La trazabilidad debe ser:

structured

versioned

machine-readable

human-explainable.

Y especialmente:

If we cannot explain  
why the system said it,

we should not treat it  
as a fully auditable finding.

---

# **282\. SALIDA FORMAL DE C6.12**

C6.12 produce conceptualmente:

EVIDENCE\_GRAPH

PROVENANCE\_RECORD

LINEAGE\_RECORD

EVIDENCE\_PACKAGE

EXPLANATION\_PATH

y, cuando corresponda:

CLAIM\_EVIDENCE\_MAP

Estas salidas serán consumidas por:

C6.13 — Evaluation Finding

C6.14 — Inter-Phase Handoff

C6.15 — Observability & Audit

C6.16 — Validation & Test Fixtures

y posteriormente por:

Fase 3 — Diagnóstico

Fase 4 — Priorización

Fase 7 — Motor de Recomendaciones

Fase 8 — Ejecución y Supervisión

Fase 9 — Aprendizaje Continuo

C6.12 no produce:

BUSINESS STATUS

ROOT CAUSE

PRIORITY

STRATEGY

RECOMMENDATION

EXECUTION ACTION

---

# **C6.12 — ESTADO**

CONTRACT:  
C6.12 Evidence, Provenance & Lineage

TYPE:  
Explainability / Auditability / Evidence Infrastructure

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

NEXT CONTRACT:  
C6.13 — Evaluation Finding Output Contract

