FASE 3 — SISTEMA DE DIAGNÓSTICO

D6 — CONTRATO DEL MOTOR DE SÍNTOMAS

0\. Propósito y frontera de responsabilidad

D6 consume principalmente las señales estructuradas producidas por D5 y responde a una pregunta concreta: ¿qué patrón empresarial forman esas señales cuando se observan juntas?

Cadena epistemológica obligatoria:

OBSERVATION → SIGNAL → SYMPTOM → HYPOTHESIS → CAUSE

Un síntoma describe un patrón observable. Una hipótesis propone una explicación. Una causa explica suficientemente el mecanismo. D6 no debe saltar desde señales a causa, root cause, constraint, prioridad o recomendación.

D6 puede producir una interpretación prudente del patrón, por ejemplo “pattern compatible with creative deterioration”, pero no convertir esa compatibilidad en una causa confirmada.

1\. Entradas y dependencias

D6 debe trabajar sobre structured signals y, cuando estén disponibles, signal\_clusters, stable signals, contradicting signals, data confidence, context-adjusted signals, maturity context y capability health.

D1 determina la fiabilidad de los datos y señales. Una señal LOW RELIABILITY no debe sostener por sí sola un síntoma HIGH confidence.

D2 aporta contexto como seasonality, promotion, mix, market, device, price change, stockout y deployment. D6 debe preferir señales ya ajustadas por contexto.

D3 aporta madurez y complejidad. La interpretación de determinados patrones puede variar según la etapa del negocio.

D4 aporta health state por capacidad. Health y symptom deben permanecer conceptos separados.

D5 es la entrada principal: SIGNALS → SYMPTOMS.

2\. SYMPTOM — contrato de datos

Todo síntoma debe poder representarse mediante un objeto equivalente a SYMPTOM con, como mínimo cuando aplique:

symptom\_id  
symptom\_code  
name  
description  
capability  
affected\_scope  
signal\_members  
supporting\_signals  
contradicting\_signals  
missing\_signals  
pattern\_strength  
confidence  
persistence  
trajectory  
business\_exposure  
first\_detected  
last\_updated  
status

Cuando sea necesario para trazabilidad y razonamiento, el síntoma debe poder conservar además:

polarity  
severity preliminar  
expectedness  
novelty  
diagnostic\_depth  
time\_role  
relevance\_to\_target  
related\_symptoms  
primary\_capabilities  
previous\_occurrences  
average\_duration  
common\_context

3\. Qué convierte señales en síntoma

La simultaneidad por sí sola no es suficiente. Para construir un síntoma debe existir coherencia de patrón.

PATTERN\_COHERENCE debe poder considerar:

same time window  
same business scope  
compatible direction  
known relationship  
sufficient signal quality

Las relaciones admisibles entre señales pueden ser:

MATHEMATICAL  
FUNNEL  
TEMPORAL  
ECONOMIC  
OPERATIONAL  
BEHAVIORAL  
STRUCTURAL

Una relación temporal permite clustering, pero no demuestra causalidad.

Flujo conceptual:

SIGNAL\_CLUSTER → BUSINESS\_PATTERN → SYMPTOM

D6 solo debe promover un patrón a SYMPTOM cuando supere las reglas de evidencia, coherencia, contradicción, scope y confidence correspondientes.

4\. Familias y granularidad

El motor debe poder representar síntomas pertenecientes al menos a estas familias:

ACQUISITION\_SYMPTOM  
CREATIVE\_SYMPTOM  
CONVERSION\_SYMPTOM  
OFFER\_SYMPTOM  
PRODUCT\_SYMPTOM  
RETENTION\_SYMPTOM  
INVENTORY\_SYMPTOM  
OPERATIONS\_SYMPTOM  
FINANCIAL\_SYMPTOM  
DATA\_SYMPTOM  
TECHNOLOGY\_SYMPTOM  
TEAM\_SYMPTOM  
STRATEGY\_SYMPTOM  
CROSS\_CAPABILITY\_SYMPTOM

La granularidad del síntoma debe poder expresarse, según corresponda, en niveles como:

BUSINESS  
CAPABILITY  
SUBCAPABILITY  
CHANNEL  
MARKET  
PRODUCT  
SEGMENT  
EVENT

El scope debe ser explícito. Un problema localizado no puede expresarse como fallo global.

D6 debe intentar avanzar de BROAD a SPECIFIC cuando la evidencia lo permita, pero nunca sacrificar confidence para ganar especificidad.

Objetivo conceptual:

SPECIFICITY × CONFIDENCE

5\. Estados y enums canónicos

5.1 Symptom Polarity

NEGATIVE  
POSITIVE  
MIXED  
NEUTRAL  
RISK

La valencia debe ser contextual. Un cambio como CAC UP no puede mapearse automáticamente a BAD.

5.2 Symptom Status

CANDIDATE  
EMERGING  
CONFIRMED  
PERSISTENT  
RESOLVING  
RESOLVED  
INVALIDATED

CANDIDATE: existen señales compatibles, todavía débiles o incompletas.  
EMERGING: el patrón empieza a consolidarse.  
CONFIRMED: existe suficiente patrón observable.  
PERSISTENT: el patrón se mantiene.  
RESOLVING: las señales comienzan a normalizarse.  
RESOLVED: el patrón desapareció.  
INVALIDATED: nueva evidencia demuestra que las señales no formaban realmente el patrón.

SYMPTOM CONFIRMED nunca significa CAUSE CONFIRMED.

5.3 Pattern Strength

WEAK  
MODERATE  
STRONG  
VERY\_STRONG

PATTERN\_STRENGTH y SYMPTOM\_CONFIDENCE deben permanecer separados. Un patrón puede ser fuerte y tener confidence menor si los datos están degradados.

5.4 Symptom Confidence

HIGH: required signals present, supporting signals present, contradictions absent, scope coherent y data reliable.  
MEDIUM: patrón probable con evidencia parcial o faltante.  
LOW: patrón débil o conflictivo.

5.5 Persistence

TRANSIENT  
EMERGING  
PERSISTENT  
CHRONIC

Un síntoma agudo puede ser crítico aunque sea transitorio. Un síntoma crónico puede representar una condición estructural mantenida.

5.6 Trajectory

IMPROVING  
STABLE  
DETERIORATING  
RAPIDLY\_DETERIORATING  
VOLATILE  
RECOVERING

5.7 Expectedness

EXPECTED  
PARTIALLY\_EXPECTED  
UNEXPECTED

EXPECTED no significa irrelevante. Un patrón esperado puede seguir teniendo impacto material.

5.8 Novelty

NEW  
RECURRING  
KNOWN\_PATTERN

5.9 Diagnostic Depth

SURFACE  
INTERMEDIATE  
DEEP

Ningún nivel implica por sí mismo root cause.

5.10 Time Role

LEADING  
COINCIDENT  
LAGGING

D6 puede registrar relaciones candidatas como may\_precede, may\_follow y often\_cooccurs, sin afirmar causalidad.

5.11 Relevance to Diagnostic Target

DIRECT  
INDIRECT  
POSSIBLE  
UNRELATED

6\. Evidence requirements

Todo síntoma debe poder distinguir:

required\_signals  
supporting\_signals  
optional\_signals  
contradicting\_signals  
missing\_signals

Una definición puede exigir minimum\_required\_signals, minimum\_signal\_confidence y minimum\_sample.

No todas las señales tienen que aparecer siempre. El patrón debe poder trabajar con roles REQUIRED, SUPPORTING, OPTIONAL y CONTRADICTING.

El pattern matching puede ponderar conceptualmente:

required signals satisfied  
\+ supporting evidence  
\- contradictions  
\= pattern strength

Si falta una señal o métrica útil, esa ausencia no tiene por qué impedir detectar el síntoma, pero debe limitar su precisión o confidence cuando corresponda.

7\. Contradiction Engine y evidencia negativa

Antes de confirmar un síntoma, D6 debe comprobar:

WHAT SHOULD ALSO BE TRUE IF THIS PATTERN EXISTS?

La ausencia de cambios esperados puede constituir evidencia en contra.

Las stable signals producidas por D5 también son evidencia. La estabilidad upstream puede ayudar a localizar un deterioro downstream.

Un candidato debe poder ser INVALIDATED cuando required signals desaparezcan, aparezcan contradicciones fuertes o se descubra que la señal principal era un problema de medición.

La invalidación debe ser explicable y conservar el motivo.

8\. SYMPTOM\_DEFINITION y Symptom Registry

D6 necesita una ontología canónica y versionada de síntomas.

Los symptom\_code deben ser estables y machine-readable. El nombre humano de UI debe permanecer separado del código interno.

Cada SYMPTOM\_DEFINITION debe poder incluir, cuando aplique:

code  
domain  
capability  
required\_signals  
supporting\_signals  
optional\_signals  
contradicting\_signals  
possible\_hypotheses o possible\_hypothesis\_domains  
minimum\_required\_signals  
minimum\_signal\_confidence  
minimum\_sample

La existencia de possible hypotheses dentro de una definición no confirma ninguna causa. Esas hipótesis se utilizarán en etapas posteriores.

Debe existir symptom\_definition\_version. Si cambia la definición o la lógica de matching, la versión debe incrementarse en lugar de alterar silenciosamente el significado histórico.

9\. Arquitectura híbrida y responsabilidades

Algunos síntomas pueden detectarse casi determinísticamente. Otros necesitan inferencia semántica o síntesis cross-capability.

Arquitectura conceptual:

STRUCTURED SIGNALS  
→ RULE-BASED PATTERN CANDIDATES  
→ SIGNAL RELATIONSHIP ENGINE  
→ PATTERN MATCHER  
→ LLM SYNTHESIS  
→ CONTRADICTION CHECK  
→ SCOPE VALIDATION  
→ CONTRACT VALIDATION  
→ SYMPTOM CLASSIFIER  
→ SYMPTOM RESULT

El runtime debería gestionar especialmente:

signal clustering  
template matching  
required signal validation  
contradiction checks  
scope  
temporal coherence  
status  
persistence  
deduplication

El LLM debería utilizarse especialmente para:

semantic pattern interpretation  
cross-capability synthesis  
natural-language explanation  
novel pattern recognition

El LLM debe trabajar sobre structured signals, known relationships y context; no improvisar síntomas directamente desde dashboards crudos.

No debe existir un sistema LLM-only ni un sistema puramente rule-based como única capa. El diseño previsto es híbrido:

RULE ENGINE \+ PATTERN LIBRARY \+ LLM REASONING

Toda salida inferencial del LLM debe pasar por validación contractual.

10\. Candidate generation y validation

Los symptom candidates pueden surgir de:

pattern templates  
LLM reasoning  
historical pattern matching  
rule engine

Todos deben pasar por las mismas validaciones antes de confirmarse:

evidence  
scope  
contradiction  
confidence

Ningún síntoma propuesto únicamente por lenguaje del modelo debe considerarse observado sin evidencia verificable.

11\. Localización, scope y business exposure

D6 debe buscar dónde ocurre el patrón antes de generalizarlo.

Una anomalía o deterioro localizado debe conservar el scope exacto que soportan los datos.

La granularidad máxima está limitada por sample size y calidad de datos. No debe sobre-localizarse con muestras frágiles.

Cada síntoma debe poder expresar qué parte del negocio afecta mediante, cuando aplique:

revenue\_share  
customer\_share  
spend\_share  
order\_share

business\_exposure y pattern\_strength no son equivalentes. Un patrón VERY\_STRONG puede tener LOW business exposure.

12\. Parent-child symptoms, deduplicación y clusters

Pueden existir síntomas jerárquicos y parent-child. Diferentes niveles de abstracción pueden coexistir siempre que aporten información distinta.

D6 debe evitar crear múltiples síntomas redundantes para el mismo fenómeno.

La deduplicación puede considerar:

same scope  
same timeframe  
shared signals  
semantic overlap

Dos síntomas relacionados no siempre deben fusionarse si describen dominios distintos. Debe poder existir RELATED\_SYMPTOM sin asumir causalidad.

D6 puede construir SYMPTOM\_CLUSTER con campos equivalentes a:

members  
shared\_timeframe  
shared\_scope  
possible\_relationship  
confidence

Un cluster solo declara relación observada o plausible; D7 será quien modele causalidad posible.

Pueden coexistir varios síntomas independientes. El sistema no debe forzar una única narrativa prematuramente.

13\. Refinamiento y stopping condition

Un surface symptom puede activar refinamiento:

SURFACE SYMPTOM  
→ DECOMPOSITION  
→ LOWER-LEVEL SIGNALS  
→ DEEPER SYMPTOM

El refinamiento debe detenerse cuando:

no deeper observable layer available

o cuando:

data insufficient

D6 debe preferir el punto medio entre un síntoma demasiado amplio y uno excesivamente específico sin evidencia.

14\. SYMPTOM\_DATA\_GAP

Cuando un síntoma está razonablemente establecido pero faltan datos para profundizar, D6 debe poder registrar un SYMPTOM\_DATA\_GAP con campos equivalentes a:

missing\_metric  
why\_needed  
impact\_on\_depth

Los missing signals y missing evidence deben permanecer visibles.

15\. Epistemic naming y límites de lenguaje

La taxonomía debe reflejar el grado real de conocimiento.

D6 debe evitar lenguaje causal en el nombre cuando la causa no está demostrada.

Preferir descripciones observacionales como:

CREATIVE\_RESPONSE\_DERIORATION  
PAYMENT\_STAGE\_FAILURE\_PATTERN

frente a nombres causales como CREATIVE\_FATIGUE o STRIPE\_FAILURE si esas causas siguen siendo hipótesis.

El lenguaje de salida puede utilizar expresiones como:

“El patrón se concentra en...”  
“Las señales combinadas son compatibles con...”  
“Existe un deterioro observable en...”  
“Los datos todavía no permiten atribuirlo a...”

D6 no debe utilizar “La causa es...” mientras siga en la capa de síntomas.

16\. Timeline, history, lineage y revisión

El symptom onset debe derivarse de sus señales y su alineación temporal.

D6 debe poder conservar:

first\_detected  
peak  
current\_state  
resolution

Para síntomas recurrentes, cuando aplique:

previous\_occurrences  
average\_duration  
common\_context

Debe mantenerse historial para pattern recurrence, recovery analysis y aprendizaje posterior.

El lineage debe poder reconstruirse:

raw metric → observation → signal → symptom

Los cambios de interpretación o localización no deben sobrescribirse silenciosamente. Un síntoma puede refinarse de una versión amplia a otra más específica, manteniendo trazabilidad del cambio.

17\. Ranking, primary symptom y diagnostic target

D6 puede ordenar síntomas por:

pattern strength  
business relevance  
confidence  
exposure

Este ranking sirve para decidir qué hipótesis investigar primero, no qué acción ejecutar primero.

Un diagnostic case puede tener PRIMARY\_SYMPTOM y síntomas secundarios.

El primary symptom debe ser el que mejor explica el target observable investigado, no necesariamente el más grave.

Todo síntoma debe poder vincularse con la pregunta diagnóstica mediante relevance\_to\_target:

DIRECT  
INDIRECT  
POSSIBLE  
UNRELATED

18\. Severidad preliminar

D6 puede asignar una severidad preliminar del síntoma:

LOW  
MODERATE  
HIGH  
CRITICAL

Esta severidad no sustituye el cálculo formal de impacto posterior. Symptom severity tampoco equivale a priority.

19\. SYMPTOM\_RESULT — contrato de salida

D6 debe devolver un objeto equivalente a SYMPTOM\_RESULT capaz de incluir:

primary\_symptoms  
secondary\_symptoms  
positive\_symptoms  
risk\_symptoms  
symptom\_clusters  
invalidated\_symptoms  
data\_gaps  
related\_capabilities  
confidence

El resultado debe preservar síntomas positivos, negativos, mixtos, neutrales y de riesgo cuando sean relevantes.

20\. Observabilidad administrativa

El panel administrativo debe poder reconstruir para cada síntoma:

symptom  
signals included  
signals excluded  
required signals  
supporting signals  
missing signals  
contradictions  
confidence  
pattern strength  
scope  
status/history  
definition version  
invalidation reason, si existe

Debe ser posible responder tanto por qué un síntoma se confirmó como por qué un candidato no llegó a confirmarse o fue invalidado.

21\. Interfaces con el resto del sistema

D0 exige mantener separadas las capas signal, symptom, hypothesis y cause.

D1 limita qué evidencia puede considerarse fiable.

D2 evita síntomas falsos por seasonality, promotion, mix, price, launch u otros contextos.

D3 aporta maturity y complexity.

D4 indica dónde existe deterioro de health, pero health y symptom no son lo mismo.

D5 entrega las señales estructuradas.

D7 recibe síntomas y relaciones candidatas para construir el grafo causal.

D8 recibe síntomas y pregunta qué explicaciones plausibles podrían producir el patrón.

D9 profundiza desde surface symptom hacia root cause y constraint.

D10 calculará el impacto/severidad formal; D6 solo puede aportar severidad preliminar, exposición y relevancia.

22\. Invariantes D6

El sistema nunca debe:

\- Confundir síntoma con causa.  
\- Confundir correlación temporal con causalidad.  
\- Crear síntomas a partir de señales no relacionadas.  
\- Ignorar señales contradictorias.  
\- Generalizar un síntoma localizado.  
\- Usar señales de baja calidad como evidencia fuerte.  
\- Ignorar señales de estabilidad.  
\- Crear múltiples síntomas redundantes para el mismo fenómeno.  
\- Confundir riesgo futuro con fallo actual.  
\- Confundir deterioration con expected scaling effect.  
\- Confundir mix shift con within-segment deterioration.  
\- Crear síntomas específicos sin muestra suficiente.  
\- Ocultar missing evidence.  
\- Confundir health con symptom.  
\- Confundir maturity gap con symptom.  
\- Confundir symptom severity con priority.  
\- Recomendar acciones.  
\- Declarar root cause.  
\- Utilizar lenguaje causal definitivo.  
\- Suponer que toda anomalía necesita síntoma negativo.  
\- Convertir una observación del usuario directamente en un hecho confirmado.  
\- Crear scores de síntoma opacos o no explicables.  
\- Crear una explicación circular que no aporte information gain.

23\. User-reported y qualitative symptoms

Una observación del usuario puede registrarse inicialmente como REPORTED\_SYMPTOM o INVESTIGATION\_TARGET, pero no convertirse automáticamente en health state ni síntoma confirmado.

D6 debe poder distinguir estados de evidencia equivalentes a:

USER\_REPORTED  
SYSTEM\_OBSERVED  
CORROBORATED  
CONTRADICTED

El lenguaje humano puede normalizarse hacia candidate symptoms, siempre condicionado a evidencia.

D6 puede combinar señales cuantitativas y cualitativas —por ejemplo métricas con tickets, reviews, calls o surveys— cuando la evidencia permita formar un patrón más específico.

24\. Tests obligatorios iniciales

Como mínimo:

test\_preclick\_pattern  
test\_postclick\_pattern  
test\_payment\_stage\_pattern  
test\_stockout\_pressure  
test\_margin\_compression  
test\_discount\_dependency  
test\_cohort\_mix\_not\_retention\_failure  
test\_device\_localized\_symptom  
test\_signal\_contradiction\_invalidates  
test\_low\_confidence\_signal\_does\_not\_confirm  
test\_positive\_symptom  
test\_cross\_capability\_cluster  
test\_symptom\_resolution  
test\_symptom\_refinement  
test\_no\_causal\_language

25\. Fixtures obligatorios iniciales

Fixture 1 — Pre-click  
Input: CTR \-20%, CPC \+18%, CPM stable, CVR stable.  
Expected: PRE\_CLICK\_EFFICIENCY\_DERIORATION; confidence HIGH; no CREATIVE\_FATIGUE\_CONFIRMED.

Fixture 2 — Post-click  
Input: CTR stable, CPC stable, CVR \-25%, CAC \+28%.  
Expected: POST\_CLICK\_EFFICIENCY\_DERIORATION.

Fixture 3 — Payment  
Input: ATC stable, Checkout stable, Payment success \-30%, Errors \+200%.  
Expected: PAYMENT\_COMPLETION\_FAILURE.

Fixture 4 — Stock risk  
Input: stock available, coverage 8 days, lead time 60 days.  
Expected: IMMINENT\_STOCKOUT\_PRESSURE; not STOCKOUT.

Fixture 5 — Product quality  
Input: Refunds \+40%, Quality complaints \+80%, Review score down, Repeat down.  
Expected: PRODUCT\_EXPERIENCE\_DETERIORATION.

Fixture 6 — Mix distortion  
Input: Global CVR \-20%, every channel CVR stable, low-converting channel share \+40%.  
Expected: TRAFFIC\_MIX\_DRIVEN\_CONVERSION\_CHANGE; not CONVERSION\_SYSTEM\_FAILURE.

Fixture 7 — Contradiction  
Candidate: Creative response deterioration. CTR stable, Hook stable, Thumbstop stable.  
Expected: INVALIDATED.

Fixture 8 — Measurement  
Input: Shopify orders \+2%, GA purchases \-45%.  
Expected: MEASUREMENT\_DIVERGENCE.

Fixture 9 — Scaling  
Input: Spend \+100%, CAC \+12%, Customers \+80%, Contribution \+45%.  
Expected: SCALING\_WITH\_EFFICIENCY\_COMPRESSION; not necessarily negative.

Fixture 10 — Chronic discount dependency  
Input: Full price CVR declining, promo share rising, discount depth rising, margin falling.  
Expected: DISCOUNT\_DEPENDENCY.

Fixture 11 — Localized regression  
Input: Global CVR \-3%, Safari CVR \-38%, Safari exposure 12%.  
Expected: SAFARI\_CONVERSION\_REGRESSION; not broad global conversion failure.

Fixture 12 — Positive pattern  
Input: CTR \+15%, CVR \+12%, CAC \-18%, Contribution \+25%.  
Expected: COMMERCIAL\_EFFICIENCY\_IMPROVEMENT.

26\. Definition of Done

D6 estará correctamente construido cuando pueda responder de forma reproducible y trazable:

\- qué señales están relacionadas;  
\- qué patrón forman;  
\- dónde se concentra;  
\- a qué familia pertenece;  
\- qué señales lo apoyan;  
\- qué señales lo contradicen;  
\- qué evidencia falta;  
\- cuál es su pattern strength;  
\- cuál es su confidence;  
\- si es superficial, intermedio o profundo;  
\- si es global o localizado;  
\- si es actual o riesgo futuro;  
\- si es esperado o inesperado;  
\- si es nuevo, persistente, crónico o recurrente;  
\- si está deteriorando, estable o recuperándose;  
\- qué otros síntomas están relacionados;  
\- cuál explica mejor el diagnostic target;  
\- hasta qué nivel puede localizar el problema sin inventar la causa;  
\- por qué fue confirmado, no confirmado, resuelto o invalidado.

D6 debe reducir correctamente el espacio del problema sin inventar la causa.  
