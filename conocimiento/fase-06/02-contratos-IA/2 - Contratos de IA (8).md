# **C6.8 — CONFIDENCE & UNCERTAINTY CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Confidence & Uncertainty Contract define cómo EcomScaling IA representa, calcula, limita y comunica la confianza asociada a datos, referencias, comparaciones, patrones, hipótesis y conclusiones.

Su misión es responder:

> **¿Con qué fuerza podemos sostener lo que estamos afirmando y qué incertidumbre sigue existiendo?**

C6.8 existe para impedir respuestas como:

confidence \= 82%

sin saber:

82% de qué

basado en qué

qué parte es segura

qué parte es incierta

qué evidencia falta

qué assumptions se están utilizando

qué hipótesis alternativas existen

---

# **2\. PRINCIPIO FUNDAMENTAL**

La confianza no es una propiedad única de toda la respuesta.

Debe poder existir:

data\_confidence

semantic\_confidence

context\_confidence

benchmark\_confidence

comparison\_confidence

guardrail\_confidence

anomaly\_confidence

pattern\_confidence

hypothesis\_confidence

y posteriormente otras fases podrán añadir:

diagnosis\_confidence

priority\_confidence

recommendation\_confidence

execution\_confidence

Por tanto:

CONFIDENCE  
IS LAYERED.

---

# **3\. SEGUNDO PRINCIPIO**

Debe mantenerse:

strength\_of\_claim  
\<=  
strength\_of\_evidence

Nunca:

weak evidence  
→  
strong claim

---

# **4\. TERCER PRINCIPIO**

Debe mantenerse también:

quality\_of\_conclusion  
\<=  
quality\_of\_evidence

Una conclusión aparentemente lógica no puede superar la fiabilidad de sus inputs.

---

# **5\. CUARTO PRINCIPIO**

Incertidumbre no significa necesariamente desconocimiento total.

Podemos saber con mucha confianza:

CAC increased 30%

pero tener poca confianza en:

why CAC increased.

Ejemplo:

metric\_confidence \= high

comparison\_confidence \= high

pattern\_confidence \= high

cause\_confidence \= low

Esto es válido.

---

# **6\. PROBLEMA QUE RESUELVE**

Sin C6.8 podría ocurrir:

Revenue ↓ 15%  
CAC ↑ 20%  
CVR ↓ 18%

y la IA afirmar:

The problem is ad fatigue.  
Confidence: 90%.

aunque:

creative frequency data missing

traffic mix changed

pricing changed

tracking incident possible

C6.8 debe impedir este salto.

---

# **7\. RESPONSABILIDAD**

C6.8 debe modelar:

WHAT is confidence about?

WHAT evidence supports it?

HOW strong is that evidence?

WHAT evidence is missing?

WHAT assumptions exist?

WHAT contradictions exist?

WHAT alternative explanations exist?

WHAT uncertainty remains?

WHAT confidence ceiling applies?

WHAT claim strength is allowed?

---

# **8\. LO QUE C6.8 NO DEBE HACER**

C6.8 NO debe:

diagnose root causes

select business priorities

recommend actions

choose playbooks

execute changes

Tampoco debe inventar confidence simplemente porque un LLM tenga una impresión subjetiva.

---

# **9\. CONFIDENCE ASSESSMENT**

La salida principal será:

CONFIDENCE\_ASSESSMENT

---

# **10\. CONFIDENCE\_ASSESSMENT\_ID**

Toda evaluación material debe disponer de:

confidence\_assessment\_id

---

# **11\. SUBJECT**

Toda confianza debe tener un objeto explícito.

Ejemplos:

observation

benchmark

comparison

guardrail

anomaly

pattern

hypothesis

finding

Nunca:

confidence \= high

sin objeto.

---

# **12\. SUBJECT\_REF**

Debe existir:

subject\_type

subject\_ref

Ejemplo:

subject\_type:  
benchmark\_comparison

subject\_ref:  
comparison\_882

---

# **13\. CONFIDENCE DIMENSIONS**

La arquitectura debe admitir como mínimo:

semantic\_confidence

data\_confidence

context\_confidence

reference\_confidence

comparison\_confidence

guardrail\_confidence

anomaly\_confidence

pattern\_confidence

hypothesis\_confidence

overall\_finding\_confidence

---

# **14\. SEMANTIC CONFIDENCE**

Responde:

> ¿Estamos seguros de qué significa exactamente esta métrica?

Ejemplo:

metric:  
ROAS

attribution model:  
unknown

podría producir:

semantic\_confidence \= low

aunque el número esté correctamente extraído.

---

# **15\. DATA CONFIDENCE**

Responde:

> ¿Podemos confiar en la medición?

Se apoya principalmente en C6.3.

---

# **16\. CONTEXT CONFIDENCE**

Responde:

> ¿Tenemos suficiente conocimiento del contexto relevante?

Ejemplo:

market known

device known

customer type unknown

traffic temperature inferred

puede limitar confianza contextual.

---

# **17\. REFERENCE CONFIDENCE**

Responde:

> ¿Qué confianza merece el benchmark o guardrail utilizado?

Puede depender de:

source quality

methodology

sample

freshness

provenance

applicability

---

# **18\. COMPARISON CONFIDENCE**

Responde:

> ¿Qué confianza tenemos en que la comparación sea válida?

Depende de:

semantic compatibility

context comparability

reference quality

subject quality

---

# **19\. GUARDRAIL CONFIDENCE**

Responde:

> ¿Qué confianza tenemos en que el límite utilizado representa correctamente la frontera relevante?

Ejemplo:

Un sustainable CAC derivado de:

high-quality margin data  
\+  
high-quality repeat economics

puede tener confianza alta.

Pero si LTV es muy incierto:

guardrail\_confidence \= medium

---

# **20\. ANOMALY CONFIDENCE**

Responde:

> ¿Qué confianza tenemos en que el comportamiento detectado sea realmente anómalo y no ruido o error de medición?

---

# **21\. PATTERN CONFIDENCE**

Responde:

> ¿Qué confianza tenemos en que varias señales formen realmente el patrón identificado?

---

# **22\. HYPOTHESIS CONFIDENCE**

Responde:

> ¿Qué confianza tenemos en una explicación posible?

Importante:

hypothesis confidence

no convierte una hipótesis en hecho.

---

# **23\. FINDING CONFIDENCE**

Puede existir una confianza sintética asociada al finding.

Pero debe ser derivada de sus componentes.

No sustituirlos.

---

# **24\. NO SINGLE CONFIDENCE BY DEFAULT**

No reducir automáticamente:

data \= high

comparison \= high

pattern \= medium

hypothesis \= low

a:

confidence \= medium

y perder toda la información.

---

# **25\. OPTIONAL SUMMARY CONFIDENCE**

Puede existir:

summary\_confidence

para interfaces.

Pero deberá conservar siempre:

component confidence

por debajo.

---

# **26\. CONFIDENCE SCALE**

Propuesta conceptual:

high

medium

low

insufficient

unknown

---

# **27\. HIGH**

Significa:

> La evidencia disponible permite sostener la afirmación con fuerza alta dentro de su scope.

No significa certeza absoluta.

---

# **28\. MEDIUM**

Significa:

> Existe evidencia razonable, pero permanecen limitaciones materiales o alternativas plausibles.

---

# **29\. LOW**

Significa:

> La afirmación es plausible pero la evidencia es débil o incompleta.

---

# **30\. INSUFFICIENT**

Significa:

> No existe evidencia suficiente para sostener responsablemente la afirmación.

---

# **31\. UNKNOWN**

Significa:

> No puede evaluarse actualmente la confianza.

---

# **32\. CONFIDENCE SCORE**

Puede existir internamente:

confidence\_score

por ejemplo:

0.84

pero no debe convertirse en una falsa probabilidad estadística.

---

# **33\. SCORE ≠ PROBABILITY**

Regla:

confidence\_score \= 0.84

NO significa automáticamente:

84% probability this claim is true.

salvo que exista un modelo probabilístico explícitamente calibrado.

---

# **34\. CALIBRATED PROBABILITY**

Solo debe utilizarse una probabilidad si:

model supports calibrated probability

y esto está documentado.

---

# **35\. NO FAKE PRECISION**

Evitar comunicar:

confidence \= 87.43%

cuando el sistema realmente maneja heurísticas.

Mejor:

confidence \= high

con explicación estructurada.

---

# **36\. EVIDENCE**

Toda confidence material debe estar asociada a:

supporting\_evidence

---

# **37\. SUPPORTING EVIDENCE**

Ejemplos:

high-quality observation

strong internal baseline

comparable peer group

multiple confirming signals

stable methodology

---

# **38\. CONTRADICTORY EVIDENCE**

Debe existir:

contradictory\_evidence

Ejemplo:

CAC ↑

but contribution/customer also ↑

puede debilitar una hipótesis de deterioro económico.

---

# **39\. MISSING EVIDENCE**

Debe existir:

missing\_evidence

---

# **40\. EVIDENCE GAP**

Cada elemento faltante puede clasificarse.

Ejemplos:

critical

material

supporting

optional

---

# **41\. CRITICAL MISSING EVIDENCE**

Si falta evidencia crítica:

confidence ceiling

debe reducirse.

---

# **42\. CONFIDENCE CEILING**

Concepto central:

confidence\_ceiling

Ejemplo:

data quality \= low

therefore:

maximum possible comparison confidence \= low

aunque otras señales sean fuertes.

---

# **43\. CEILING PROPAGATION**

Debe existir una política para evitar:

weak foundation  
\+  
strong pattern  
\=  
high confidence

---

# **44\. EXAMPLE**

metric confidence \= low

porque tracking está roto.

Entonces:

anomaly confidence  
cannot be high

si depende de esa métrica.

---

# **45\. CONFIDENCE FLOOR**

En algunos casos puede existir evidencia mínima que garantice una conclusión básica.

Ejemplo:

inventory \= 0

confirmado por ERP y warehouse.

Puede existir confianza muy alta en:

stockout exists

aunque no sepamos por qué.

---

# **46\. EVIDENCE STRENGTH**

Debe distinguirse:

strong

moderate

weak

insufficient

---

# **47\. DIRECT EVIDENCE**

Ejemplo:

transactional order data

observada directamente.

---

# **48\. INDIRECT EVIDENCE**

Ejemplo:

traffic behavior suggesting friction

---

# **49\. INFERRED EVIDENCE**

Ejemplo:

likely cold traffic

inferido de campañas.

---

# **50\. MODELED EVIDENCE**

Ejemplo:

predicted LTV

producido por modelo.

---

# **51\. EVIDENCE TYPE**

Debe poder existir:

direct

derived

modeled

inferred

external

---

# **52\. EVIDENCE WEIGHT**

Puede existir un peso estructurado.

Pero no debe ser un número arbitrario sin metodología.

---

# **53\. EVIDENCE INDEPENDENCE**

Dos señales procedentes de la misma fuente pueden no representar evidencia independiente.

Ejemplo:

Meta ROAS ↑

Meta attributed revenue ↑

pueden estar fuertemente correlacionadas.

---

# **54\. DOUBLE COUNTING**

No aumentar artificialmente confidence contabilizando la misma evidencia varias veces.

---

# **55\. SOURCE CORRELATION**

Debe poder declararse:

shared\_source

shared\_calculation

shared\_denominator

shared\_model

---

# **56\. MULTI-SOURCE CONFIRMATION**

Una señal confirmada por fuentes verdaderamente independientes puede fortalecer confidence.

Ejemplo:

Shopify revenue ↓

finance revenue ↓

orders ↓

---

# **57\. ASSUMPTIONS**

Toda conclusión que dependa de assumptions debe declararlos.

---

# **58\. ASSUMPTION OBJECT**

Conceptualmente:

ASSUMPTION

---

# **59\. ASSUMPTION\_ID**

Debe poder tener:

assumption\_id

---

# **60\. ASSUMPTION TYPE**

Ejemplos:

business

economic

measurement

causal

statistical

model

context

---

# **61\. ASSUMPTION STATUS**

Valores:

verified

supported

unverified

contradicted

unknown

---

# **62\. CRITICAL ASSUMPTION**

Debe poder existir:

critical \= true

si la conclusión depende materialmente de ella.

---

# **63\. ASSUMPTION IMPACT**

Puede clasificarse:

low

medium

high

critical

---

# **64\. EXAMPLE**

Assumption:  
repeat contribution remains stable

status:  
unverified

impact:  
high

Entonces un sustainable CAC calculado con esa assumption no debería tener confidence máxima.

---

# **65\. UNCERTAINTY**

Confidence y uncertainty están relacionadas pero no son idénticas.

---

# **66\. CONFIDENCE VS UNCERTAINTY**

Confidence:

> ¿Qué fuerza tiene la conclusión?

Uncertainty:

> ¿Qué no sabemos todavía y de qué forma podría cambiar la conclusión?

---

# **67\. UNCERTAINTY SOURCES**

Taxonomía inicial:

data uncertainty

measurement uncertainty

sampling uncertainty

model uncertainty

context uncertainty

benchmark uncertainty

economic uncertainty

causal uncertainty

future uncertainty

---

# **68\. DATA UNCERTAINTY**

Proviene de:

missing

incomplete

stale

conflicting data

---

# **69\. MEASUREMENT UNCERTAINTY**

Proviene de:

tracking

attribution

identity resolution

definitions

---

# **70\. SAMPLING UNCERTAINTY**

Proviene de muestras limitadas o alta varianza.

---

# **71\. MODEL UNCERTAINTY**

Proviene de estimaciones o predicciones.

---

# **72\. CONTEXT UNCERTAINTY**

No conocemos suficientemente:

market

traffic mix

customer type

seasonality

---

# **73\. BENCHMARK UNCERTAINTY**

La referencia puede tener:

unknown sample

weak methodology

limited comparability

---

# **74\. ECONOMIC UNCERTAINTY**

Ejemplo:

future repeat contribution uncertain

---

# **75\. CAUSAL UNCERTAINTY**

Podemos observar correlación sin conocer causa.

---

# **76\. FUTURE UNCERTAINTY**

Especialmente relevante en:

forecasts

scale

inventory

LTV

---

# **77\. UNCERTAINTY LEVEL**

Puede clasificarse:

low

medium

high

critical

unknown

---

# **78\. UNCERTAINTY DOES NOT ALWAYS INVERT CONFIDENCE**

Puede existir:

high confidence  
in observed deterioration

y:

high uncertainty  
about future trajectory

simultáneamente.

---

# **79\. ALTERNATIVE HYPOTHESES**

Debe existir:

alternative\_hypotheses

cuando múltiples explicaciones sean plausibles.

---

# **80\. WHY ALTERNATIVES MATTER**

Si:

CVR ↓

posibles explicaciones pueden ser:

traffic quality deterioration

pricing change

stock availability

site issue

measurement issue

promotion ending

No debe elegirse una causa prematuramente.

---

# **81\. ALTERNATIVE\_HYPOTHESIS OBJECT**

Debe poder contener:

hypothesis\_id

description

supporting\_evidence

contradictory\_evidence

confidence

missing\_evidence

---

# **82\. PRIMARY HYPOTHESIS**

Puede existir:

leading\_hypothesis

pero debe seguir etiquetada como hipótesis.

---

# **83\. FACT VS INTERPRETATION VS HYPOTHESIS**

Debe mantenerse:

FACT

INTERPRETATION

HYPOTHESIS

RECOMMENDATION

como capas distintas.

---

# **84\. FACT CONFIDENCE**

Un fact puede tener confidence según measurement quality.

Ejemplo:

fact:  
CAC increased 21%

confidence:  
high

---

# **85\. INTERPRETATION CONFIDENCE**

Ejemplo:

interpretation:  
acquisition efficiency deteriorated

confidence:  
high

---

# **86\. HYPOTHESIS CONFIDENCE**

Ejemplo:

hypothesis:  
audience saturation may contribute

confidence:  
medium

---

# **87\. RECOMMENDATION CONFIDENCE**

Pertenece principalmente a Fase 7\.

C6.8 debe permitir el campo conceptualmente, pero Fase 6 no debe generarlo como autoridad final.

---

# **88\. CAUSE CONFIDENCE**

Igualmente, una causa definitiva pertenece al diagnóstico.

C6.8 puede representar:

cause\_confidence

si Fase 3 la proporciona.

Pero Fase 6 no debe convertir hipótesis en causas finales.

---

# **89\. CONFIDENCE DEPENDENCY GRAPH**

La confianza puede depender de otras confidences.

Ejemplo:

comparison\_confidence  
    ├── semantic\_confidence  
    ├── subject\_data\_confidence  
    ├── benchmark\_confidence  
    └── comparability\_confidence

---

# **90\. PATTERN CONFIDENCE GRAPH**

pattern\_confidence  
    ├── confidence(signal A)  
    ├── confidence(signal B)  
    ├── confidence(signal C)  
    ├── contradictory evidence  
    └── pattern specificity

---

# **91\. NO SIMPLE AVERAGING**

No calcular automáticamente:

(high \+ high \+ low) / 3

para obtener medium.

Una dependencia crítica low puede imponer ceiling.

---

# **92\. CRITICAL DEPENDENCY**

Cada assessment puede declarar:

critical\_dependencies

---

# **93\. NON-CRITICAL DEPENDENCY**

También:

supporting\_dependencies

---

# **94\. CONFIDENCE POLICY**

C6.6 puede proporcionar policies como:

minimum data quality for high confidence

confidence caps

critical evidence requirements

---

# **95\. CONFIDENCE CAP EXAMPLE**

if benchmark comparability \= low

maximum benchmark-comparison confidence \= low

---

# **96\. ANOTHER EXAMPLE**

if data quality \= insufficient

maximum claim strength \= indeterminate

---

# **97\. CLAIM STRENGTH**

Debe existir conceptualmente:

CLAIM\_STRENGTH

---

# **98\. CLAIM STRENGTH LEVELS**

Propuesta:

established

strongly\_supported

supported

tentative

unsupported

---

# **99\. ESTABLISHED**

Reservado para hechos fuertemente evidenciados dentro del scope.

---

# **100\. STRONGLY SUPPORTED**

Existe evidencia fuerte y pocas contradicciones materiales.

---

# **101\. SUPPORTED**

Existe evidencia suficiente, pero algunas limitaciones.

---

# **102\. TENTATIVE**

La afirmación debe presentarse como hipótesis o señal.

---

# **103\. UNSUPPORTED**

No debería comunicarse como conclusión.

---

# **104\. CLAIM TYPE**

Puede ser:

fact

interpretation

hypothesis

risk

projection

---

# **105\. CLAIM LANGUAGE POLICY**

La confidence debería condicionar el lenguaje de presentación.

Ejemplo:

High:

The data shows...

Medium:

The evidence suggests...

Low:

There are indications that...

Insufficient:

The available evidence is insufficient to determine...

---

# **106\. RUNTIME VS NATURAL LANGUAGE**

C6.8 debe producir estructura.

La capa de comunicación puede convertirla después en lenguaje natural.

No depender únicamente del wording del LLM.

---

# **107\. HIGH SEVERITY \+ LOW CONFIDENCE**

Caso crítico:

severity \= critical

confidence \= low

No significa ignorar.

Puede significar:

potentially critical condition  
requiring urgent validation

---

# **108\. LOW SEVERITY \+ HIGH CONFIDENCE**

Ejemplo:

small but certain deterioration

No necesariamente alta prioridad.

---

# **109\. CONFIDENCE ≠ SEVERITY**

Debe mantenerse:

CONFIDENCE  
≠  
SEVERITY

---

# **110\. CONFIDENCE ≠ IMPACT**

También:

CONFIDENCE  
≠  
IMPACT

---

# **111\. CONFIDENCE ≠ PRIORITY**

Y:

CONFIDENCE  
≠  
PRIORITY

---

# **112\. CONFIDENCE ≠ PROBABILITY OF SUCCESS**

Especialmente importante para recomendaciones futuras.

---

# **113\. EVIDENCE COVERAGE**

Debe poder existir:

evidence\_coverage

Ejemplo:

required evidence available:  
4/5

Pero no debe reducirse automáticamente a:

80% confidence

---

# **114\. EVIDENCE SUFFICIENCY**

Estados:

sufficient

partially\_sufficient

insufficient

unknown

---

# **115\. EVIDENCE COMPLETENESS VS STRENGTH**

Podemos tener:

all evidence present

pero de mala calidad.

Y:

limited evidence

pero muy fuerte.

Son conceptos distintos.

---

# **116\. CONTRADICTION MODEL**

Debe existir:

CONTRADICTION

---

# **117\. CONTRADICTION TYPE**

Ejemplos:

data

reference

pattern

causal

temporal

source

---

# **118\. CONTRADICTION STRENGTH**

weak

moderate

strong

---

# **119\. CONTRADICTION IMPACT**

Puede reducir confidence.

---

# **120\. CONTRADICTION EXAMPLE**

Hypothesis:

traffic quality deteriorated

Supporting:

CVR ↓  
new customer share ↑

Contradictory:

qualified session rate stable

Debe conservarse.

---

# **121\. UNCERTAINTY REDUCTION**

C6.8 debe poder indicar qué información reduciría incertidumbre.

Conceptualmente:

evidence\_needed

---

# **122\. EVIDENCE NEEDED**

Ejemplos:

marginal CAC

new customer share

landing page CVR

creative frequency

inventory availability

---

# **123\. VALIDATION QUESTION**

Puede producirse:

validation\_question

Ejemplo:

> ¿El incremento de CAC persiste después de controlar por cambio de mix?

---

# **124\. FASE 6 CAN REQUEST VALIDATION**

Fase 6 puede señalar:

more evidence required

sin decidir todavía la intervención estratégica.

---

# **125\. UNCERTAINTY RESOLUTION PLAN**

No debe convertirse en playbook.

Pero puede listar:

evidence gaps

que otras fases deberán investigar.

---

# **126\. TEMPORAL CONFIDENCE**

Confidence puede cambiar con el tiempo.

Ejemplo:

ROAS de ayer:

attribution maturity low

Una semana después:

attribution maturity high

---

# **127\. CONFIDENCE IS TIME-SENSITIVE**

Debe poder registrar:

assessed\_at

---

# **128\. HISTORICAL CONFIDENCE**

No sobrescribir assessments históricos.

---

# **129\. REASSESSMENT**

Debe poder crearse:

new confidence assessment

cuando aparezca nueva evidencia.

---

# **130\. REASSESSMENT\_RELATION**

Puede existir:

supersedes\_assessment\_id

---

# **131\. NO HISTORICAL REWRITING**

La confianza que el sistema tenía ayer debe poder reconstruirse.

---

# **132\. CALIBRATION**

El sistema debería permitir calibrar su confidence con resultados reales.

Esto será especialmente importante en Fase 9\.

---

# **133\. CALIBRATION OBJECTIVE**

Preguntar:

When system says HIGH,  
how often are findings later confirmed?

---

# **134\. OVERCONFIDENCE**

Debe poder detectarse:

high-confidence findings  
frequently disproven

---

# **135\. UNDERCONFIDENCE**

También:

low-confidence findings  
frequently confirmed

---

# **136\. CONFIDENCE CALIBRATION VERSION**

Puede existir:

confidence\_model\_version

ya contemplado por C6.0.

---

# **137\. DETERMINISTIC CONFIDENCE RULES**

Una parte debería basarse en reglas estructuradas.

Ejemplo:

if data\_quality \= insufficient  
then claim cannot be high confidence

---

# **138\. STATISTICAL CONFIDENCE**

Cuando exista análisis estadístico real, puede incorporar:

confidence\_interval

credible\_interval

p\_value

power

cuando sean apropiados.

---

# **139\. STATISTICAL ≠ BUSINESS CONFIDENCE**

Un test estadísticamente significativo no implica automáticamente:

business confidence \= high

si el efecto no es material o el contexto es defectuoso.

---

# **140\. LLM CONFIDENCE**

No utilizar:

LLM self-reported confidence

como fuente única.

---

# **141\. MODEL SELF-CONFIDENCE IS WEAK EVIDENCE**

Puede utilizarse como señal secundaria.

Nunca como fundamento principal.

---

# **142\. CONFIDENCE SOURCES**

Debe poder registrar:

rule\_based

statistical

evidence\_based

model\_assisted

human\_validated

---

# **143\. HUMAN VALIDATION**

Un experto puede confirmar una conclusión.

Debe poder registrarse:

human\_validation\_status

sin borrar la confidence original del sistema.

---

# **144\. HUMAN OVERRIDE**

Si existe:

human\_override

debe conservar:

original confidence

new status

reason

---

# **145\. NO SILENT HUMAN OVERRIDE**

Toda modificación debe ser auditable.

---

# **146\. CONFIDENCE REASON CODES**

Conviene disponer de códigos.

Ejemplos:

CONF\_STRONG\_FIRST\_PARTY\_DATA

CONF\_HIGH\_COMPARABILITY

CONF\_MULTISOURCE\_CONFIRMATION

CONF\_LOW\_SAMPLE

CONF\_STALE\_DATA

CONF\_MISSING\_REQUIRED\_EVIDENCE

CONF\_REFERENCE\_DISAGREEMENT

CONF\_UNVERIFIED\_ASSUMPTION

CONF\_TRACKING\_INCIDENT

CONF\_CAUSAL\_UNCERTAINTY

CONF\_MODEL\_DEPENDENCE

CONF\_IMMATURE\_COHORT

---

# **147\. POSITIVE EVIDENCE REASONS**

No registrar solo problemas.

También:

strong evidence

debe quedar explicado.

---

# **148\. CONFIDENCE EXPLANATION**

Debe existir una explicación humana breve derivable de la estructura.

Ejemplo:

Confidence is high because the metric  
comes from complete first-party data,  
the internal reference is highly comparable,  
and no material contradictory evidence exists.

---

# **149\. CONFIDENCE ASSESSMENT SHAPE**

Conceptualmente:

confidence\_assessment:

    identity:  
        confidence\_assessment\_id  
        run\_id  
        subject\_type  
        subject\_ref

    dimensions:  
        semantic\_confidence  
        data\_confidence  
        context\_confidence  
        reference\_confidence  
        comparison\_confidence  
        guardrail\_confidence  
        anomaly\_confidence  
        pattern\_confidence  
        hypothesis\_confidence

    evidence:  
        supporting\_evidence  
        contradictory\_evidence  
        missing\_evidence  
        evidence\_strength  
        evidence\_sufficiency

    assumptions:  
        assumptions  
        critical\_assumptions

    uncertainty:  
        uncertainty\_sources  
        uncertainty\_level

    alternatives:  
        alternative\_hypotheses

    constraints:  
        confidence\_ceiling  
        claim\_strength\_ceiling

    output:  
        overall\_finding\_confidence  
        claim\_strength  
        limitations  
        reason\_codes

    temporal:  
        assessed\_at

    relationships:  
        supersedes\_assessment\_id

---

# **150\. EXAMPLE — HIGH DATA, LOW CAUSAL CONFIDENCE**

Observation:  
CAC increased from €35 to €48

Data confidence:  
High

Historical comparison confidence:  
High

Pattern confidence:  
High

Hypothesis:  
Audience saturation

Hypothesis confidence:  
Low

Reason:  
Frequency data unavailable  
creative data unavailable  
channel mix changed

Correct output:

CAC deterioration is strongly supported.

Audience saturation remains  
a tentative explanation.

---

# **151\. EXAMPLE — LOW DATA QUALITY**

Revenue ↓ 20%

Tracking outage:  
12 hours

Coverage:  
62%

Data confidence:  
Low

Comparison confidence:  
Low

No debería producir:

Revenue definitely collapsed.

---

# **152\. EXAMPLE — STRONG MULTI-SOURCE CONFIRMATION**

Shopify orders ↓

Finance revenue ↓

Warehouse shipments ↓

Todos consistentes.

Puede reforzar:

business deterioration confidence

---

# **153\. EXAMPLE — PLATFORM ATTRIBUTION**

Meta ROAS ↑ 30%

MER ↓ 12%

new customer share ↓

Confidence:

Meta reported improvement:  
high

incremental performance improvement:  
low

pattern indicating attribution distortion:  
medium/high

Esto demuestra por qué confidence debe ser por capa.

---

# **154\. EXAMPLE — LTV**

Predicted 12m LTV:  
€250

cohort age:  
45 days

Podemos tener:

model output confidence:  
medium

observed 12m LTV confidence:  
insufficient

---

# **155\. EXAMPLE — GUARDRAIL**

Maximum sustainable CAC:  
€45

Derivado de:

gross margin:  
high quality

first order contribution:  
high quality

repeat contribution:  
modeled, medium confidence

Resultado:

guardrail confidence:  
medium

---

# **156\. EXAMPLE — HIGH SEVERITY, LOW CONFIDENCE**

Potential stockout risk:  
critical

inventory feed:  
stale 18h

confidence:  
low

Salida correcta:

Potential critical condition.  
Urgent validation required.

No:

Critical stockout confirmed.

---

# **157\. CONFIDENCE AND COMMUNICATION**

La comunicación debe reflejar:

what is known

what is interpreted

what is hypothesized

what remains unknown

---

# **158\. FACT**

Ejemplo:

Observed mobile CVR fell 18%.

---

# **159\. INTERPRETATION**

Mobile conversion performance deteriorated.

---

# **160\. HYPOTHESIS**

The decline may be related to  
a traffic-mix shift.

---

# **161\. LIMITATION**

Traffic temperature is not fully available.

---

# **162\. RECOMMENDATION**

No pertenece a C6.8.

---

# **163\. INVARIANTES C6.8**

## **INV-C6.8-001**

Toda confidence debe tener sujeto explícito.

---

## **INV-C6.8-002**

No utilizar una única confidence global como sustituto de confidences por capa.

---

## **INV-C6.8-003**

La fuerza del claim no puede superar la fuerza de la evidencia.

---

## **INV-C6.8-004**

La quality de la conclusión no puede superar la quality de la evidencia.

---

## **INV-C6.8-005**

Data confidence y causal confidence deben poder diferir.

---

## **INV-C6.8-006**

Confidence no es severity.

---

## **INV-C6.8-007**

Confidence no es priority.

---

## **INV-C6.8-008**

Confidence no es impact.

---

## **INV-C6.8-009**

Confidence score no es probabilidad salvo calibración explícita.

---

## **INV-C6.8-010**

No comunicar precisión falsa.

---

## **INV-C6.8-011**

Missing critical evidence debe limitar confidence.

---

## **INV-C6.8-012**

Critical dependency baja debe poder imponer confidence ceiling.

---

## **INV-C6.8-013**

Contradictory evidence no puede ocultarse.

---

## **INV-C6.8-014**

Assumptions materiales deben declararse.

---

## **INV-C6.8-015**

Critical assumptions deben identificarse.

---

## **INV-C6.8-016**

Hypothesis nunca debe presentarse como fact.

---

## **INV-C6.8-017**

Alternative hypotheses deben conservarse cuando sean plausibles.

---

## **INV-C6.8-018**

No duplicar evidencia correlacionada como evidencia independiente.

---

## **INV-C6.8-019**

LLM self-confidence no puede ser fundamento único.

---

## **INV-C6.8-020**

Historical confidence assessments no deben sobrescribirse.

---

## **INV-C6.8-021**

Una reassessment debe producir un nuevo assessment.

---

## **INV-C6.8-022**

High severity \+ low confidence debe comunicarse como riesgo potencial que requiere validación.

---

## **INV-C6.8-023**

Insufficient evidence debe poder producir claim strength unsupported.

---

## **INV-C6.8-024**

Confidence debe ser trazable a evidencia.

---

## **INV-C6.8-025**

El lenguaje de comunicación debe respetar claim strength.

---

# **164\. VALIDACIONES MÍNIMAS**

Antes de emitir un confidence assessment:

subject exists?

subject type valid?

required evidence assessed?

data quality available?

comparability available?

reference quality available?

critical dependencies identified?

contradictory evidence considered?

missing evidence recorded?

assumptions recorded?

confidence ceiling respected?

claim strength compatible?

alternative hypotheses considered?

---

# **165\. VALIDATION — CLAIM TOO STRONG**

Debe bloquear:

claim\_strength \= established

evidence\_strength \= weak

---

# **166\. VALIDATION — HIGH CONFIDENCE WITH INSUFFICIENT DATA**

Debe bloquear:

data\_quality \= insufficient

overall\_confidence \= high

salvo que la conclusión no dependa de ese dato.

---

# **167\. VALIDATION — MISSING SUBJECT**

confidence \= high

sin subject debe ser inválido.

---

# **168\. VALIDATION — FAKE PROBABILITY**

No permitir:

probability \= 0.93

si el confidence model no produce probabilidades calibradas.

---

# **169\. VALIDATION — CONTRADICTION IGNORED**

Si existe contradictory evidence material:

contradiction must be represented.

---

# **170\. RELACIÓN CON C6.0**

C6.0 aporta:

run  
versions  
confidence\_model\_version

---

# **171\. RELACIÓN CON C6.1**

C6.1 aporta semántica y naturaleza:

observed

predicted

modeled

inferred

---

# **172\. RELACIÓN CON C6.2**

C6.2 aporta:

context completeness

comparability

---

# **173\. RELACIÓN CON C6.3**

C6.3 es una de las fuentes principales:

data quality

evidence strength

blockers

limitations

---

# **174\. RELACIÓN CON C6.4**

C6.4 aporta:

benchmark methodology

sample

source

limitations

---

# **175\. RELACIÓN CON C6.5**

C6.5 aporta:

guardrail dependencies

assumptions

derivation

---

# **176\. RELACIÓN CON C6.6**

C6.6 puede definir:

confidence policies

minimum evidence

confidence caps

---

# **177\. RELACIÓN CON C6.7**

C6.7 aporta:

selected references

reference disagreement

fallback use

resolution limitations

---

# **178\. RELACIÓN CON C6.9**

C6.9 deberá utilizar C6.8 para limitar:

evaluation strength

Ejemplo:

status \= risk

confidence \= low

---

# **179\. RELACIÓN CON C6.10**

C6.10 producirá:

anomaly\_confidence

apoyándose en este contrato.

---

# **180\. RELACIÓN CON C6.11**

C6.11 utilizará:

pattern\_confidence

supporting signal confidence

contradictory signal confidence

---

# **181\. RELACIÓN CON C6.12**

C6.12 debe poder reconstruir:

evidence  
→ assumptions  
→ uncertainty  
→ confidence  
→ claim strength

---

# **182\. RELACIÓN CON C6.13**

Cada Finding debe separar:

status

severity

confidence

impact

y conservar limitations.

---

# **183\. RELACIÓN CON FASE 3**

Fase 3 podrá utilizar:

hypothesis confidence

cause confidence

sin confundirlos con evidencia observacional.

---

# **184\. RELACIÓN CON FASE 4**

Fase 4 deberá poder distinguir:

high severity \+ high confidence

de:

high severity \+ low confidence

al priorizar.

---

# **185\. RELACIÓN CON FASE 7**

Fase 7 podrá añadir:

recommendation\_confidence

sobre la base de toda la evidencia anterior.

---

# **186\. RELACIÓN CON FASE 9**

Fase 9 podrá calibrar:

confidence accuracy

usando resultados posteriores.

---

# **187\. TESTS MÍNIMOS**

## **TEST 1 — High Data / High Comparison**

Debe permitir high comparison confidence.

---

## **TEST 2 — Low Data Quality**

Debe limitar claim strength.

---

## **TEST 3 — Missing Critical Evidence**

Debe imponer confidence ceiling.

---

## **TEST 4 — High Severity / Low Confidence**

Debe conservar ambas dimensiones.

---

## **TEST 5 — Low Severity / High Confidence**

También.

---

## **TEST 6 — Fact vs Hypothesis**

No deben compartir necesariamente confidence.

---

## **TEST 7 — Alternative Hypotheses**

Debe soportar varias alternativas.

---

## **TEST 8 — Contradictory Evidence**

Debe reducir o limitar confidence cuando sea material.

---

## **TEST 9 — Correlated Signals**

No debe contabilizarlas como evidencia independiente.

---

## **TEST 10 — Multi-source Confirmation**

Debe poder aumentar evidence strength.

---

## **TEST 11 — Predicted LTV**

No debe tratarse como observed confidence.

---

## **TEST 12 — Modeled Guardrail**

Debe heredar incertidumbre del modelo.

---

## **TEST 13 — Weak Benchmark**

Debe limitar benchmark confidence.

---

## **TEST 14 — Low Comparability**

Debe limitar comparison confidence.

---

## **TEST 15 — Reference Disagreement**

Debe reflejar uncertainty.

---

## **TEST 16 — LLM Self Confidence**

No debe dominar assessment.

---

## **TEST 17 — Historical Reassessment**

Debe crear nueva versión/assessment.

---

## **TEST 18 — Calibrated Probability**

Solo debe permitirse cuando el modelo lo soporte.

---

## **TEST 19 — Claim Strength**

No permitir `established` con weak evidence.

---

## **TEST 20 — Evidence Gap**

Debe listar qué información falta.

---

## **TEST 21 — Critical Assumption**

Debe degradar confidence si permanece unverified.

---

## **TEST 22 — Tracking Incident**

Debe afectar solo findings dependientes.

---

## **TEST 23 — Independent Fact Confidence**

Una causa low-confidence no debe reducir necesariamente un fact high-confidence.

---

## **TEST 24 — Summary Confidence**

Si existe, debe conservar confidences por capa.

---

# **188\. ANTI-PATRÓN — ONE CONFIDENCE NUMBER**

Incorrecto:

confidence \= 82%

como toda la explicación.

---

# **189\. ANTI-PATRÓN — FALSE PRECISION**

Incorrecto:

confidence \= 87.63%

sin modelo probabilístico real.

---

# **190\. ANTI-PATRÓN — STRONG CLAIM FROM WEAK DATA**

Incorrecto:

data quality \= low

root cause confirmed

---

# **191\. ANTI-PATRÓN — NO CONTRADICTIONS**

Ocultar evidencia contraria para mantener una conclusión limpia.

---

# **192\. ANTI-PATRÓN — LLM FEELING**

Incorrecto:

The AI feels 90% confident.

---

# **193\. ANTI-PATRÓN — HYPOTHESIS AS FACT**

Incorrecto:

CVR dropped because price is too high.

cuando solo existe correlación.

---

# **194\. ANTI-PATRÓN — SEVERITY DETERMINES CONFIDENCE**

Un problema crítico no es automáticamente cierto.

---

# **195\. ANTI-PATRÓN — CONFIDENCE DETERMINES PRIORITY**

Una observación muy cierta puede ser poco importante.

---

# **196\. ANTI-PATRÓN — COUNTING SAME SIGNAL TWICE**

Ejemplo:

Meta ROAS

Meta attributed revenue

tratadas como dos pruebas independientes sin revisar dependencia.

---

# **197\. ANTI-PATRÓN — MISSING \= CONTRADICTORY**

La ausencia de evidencia no siempre es evidencia contraria.

Debe distinguirse:

missing evidence

de:

contradictory evidence

---

# **198\. ANTI-PATRÓN — UNKNOWN \= LOW**

`unknown` no significa necesariamente `low`.

Significa que la confianza no puede evaluarse.

---

# **199\. ACCEPTANCE CRITERIA**

Para cualquier conclusión material debemos poder responder:

1\. ¿A qué objeto se refiere esta confidence?

2\. ¿Cuál es la semantic confidence?

3\. ¿Cuál es la data confidence?

4\. ¿Cuál es la context confidence?

5\. ¿Cuál es la reference confidence?

6\. ¿Cuál es la comparison confidence?

7\. ¿Cuál es la guardrail confidence?

8\. ¿Cuál es la pattern confidence si existe?

9\. ¿Cuál es la hypothesis confidence si existe?

10\. ¿Qué evidencia la soporta?

11\. ¿Qué evidencia la contradice?

12\. ¿Qué evidencia falta?

13\. ¿Qué evidencia es crítica?

14\. ¿Qué assumptions existen?

15\. ¿Cuáles son críticas?

16\. ¿Qué incertidumbres permanecen?

17\. ¿Qué hipótesis alternativas existen?

18\. ¿Existe confidence ceiling?

19\. ¿Qué la impone?

20\. ¿Qué claim strength puede utilizarse?

21\. ¿Qué reason codes explican el resultado?

22\. ¿La confidence es score o probabilidad calibrada?

23\. ¿Cuándo fue evaluada?

24\. ¿Ha sido reevaluada?

25\. ¿Puede reconstruirse por qué el sistema tenía ese nivel de confianza?

---

# **200\. DEFINITION OF DONE**

C6.8 estará formalmente definido cuando exista:

Confidence Assessment Identity

Confidence Subject

Semantic Confidence

Data Confidence

Context Confidence

Reference Confidence

Comparison Confidence

Guardrail Confidence

Anomaly Confidence

Pattern Confidence

Hypothesis Confidence

Finding Confidence

Confidence Levels

Optional Confidence Score

Probability Calibration Rules

Evidence Strength

Evidence Sufficiency

Supporting Evidence

Contradictory Evidence

Missing Evidence

Critical Evidence

Evidence Independence

Assumption Model

Critical Assumptions

Uncertainty Model

Uncertainty Sources

Alternative Hypotheses

Confidence Ceiling

Claim Strength

Claim Type

Communication Strength

Temporal Confidence

Reassessment

Calibration Support

Human Validation

Reason Codes

Validation Rules

Test Fixtures

---

# **201\. RESULTADO ARQUITECTÓNICO**

Sin C6.8:

CAC \= €48

Status \= risk

Confidence \= 80%

Con C6.8:

OBSERVATION

CAC \= €48

Semantic confidence:  
High

Data confidence:  
High

HISTORICAL COMPARISON

Reference:  
€35

Comparability confidence:  
High

Conclusion:  
CAC materially deteriorated

Confidence:  
High

ECONOMIC GUARDRAIL

Maximum sustainable CAC:  
€43

Guardrail confidence:  
Medium

Reason:  
depends partly on modeled repeat contribution

INTERPRETATION

Current acquisition economics  
appear unsustainable.

Confidence:  
Medium / High

HYPOTHESIS

Audience saturation  
may be contributing.

Confidence:  
Low

Missing evidence:  
frequency  
creative fatigue  
marginal reach

ALTERNATIVE HYPOTHESES

traffic mix deterioration

offer deterioration

market competition increase

Esto permite que el sistema diga:

> Sabemos con alta confianza que CAC se ha deteriorado. Existe confianza razonable en que ha superado el límite económico, aunque ese límite depende parcialmente de repeat economics modelados. No tenemos evidencia suficiente para afirmar que la causa sea saturación de audiencia.

Eso es muy distinto de:

CAC is bad because Meta is saturated.

---

# **202\. PRINCIPIO FINAL DE C6.8**

C6.8 debe imponer:

Confidence is not certainty.

Confidence is not severity.

Confidence is not impact.

Confidence is not priority.

Confidence is not causality.

Y:

Strong evidence  
permits strong claims.

Weak evidence  
permits only weak claims.

Además:

FACT  
can be high confidence

while

HYPOTHESIS  
remains low confidence.

Y:

If uncertainty exists,  
represent it.

Do not hide it.

---

# **203\. SALIDA FORMAL DE C6.8**

C6.8 produce:

CONFIDENCE\_ASSESSMENT

UNCERTAINTY\_PROFILE

ASSUMPTION\_SET

EVIDENCE\_GAP\_SET

y, cuando corresponda:

ALTERNATIVE\_HYPOTHESIS\_SET

Estas salidas serán consumidas por:

C6.9 — Benchmark Evaluation

C6.10 — Anomaly Detection

C6.11 — Pattern & Red Flag Detection

C6.12 — Evidence & Traceability

C6.13 — Evaluation Finding

C6.14 — Inter-Phase Handoff

y posteriormente por:

Fase 3 — Diagnóstico

Fase 4 — Priorización

Fase 7 — Recomendaciones

Fase 9 — Aprendizaje

C6.8 no produce:

FINAL ROOT CAUSE

BUSINESS PRIORITY

PLAYBOOK

RECOMMENDATION

EXECUTION ACTION

---

# **C6.8 — ESTADO**

CONTRACT:  
C6.8 Confidence & Uncertainty

TYPE:  
Epistemic Control / Evidence Strength

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

NEXT CONTRACT:  
C6.9 — Benchmark Evaluation Contract

