FASE 3 — SISTEMA DE DIAGNÓSTICO  
D4 — CONTRATO DE DIAGNÓSTICO DE SALUD POR CAPACIDAD

0\. Propósito  
D4 convierte las capacidades definidas por la anatomía de Fase 1 en estados de salud empresariales observables. D1 determina si los datos son fiables, D2 aporta el contexto, D3 aporta madurez actual, madurez requerida y gaps estructurales, y D4 determina cómo está funcionando ahora cada capacidad.

D4 debe separar siempre MATURITY de HEALTH. La madurez describe cuánto ha desarrollado una capacidad el negocio; la salud describe cómo está funcionando esa capacidad en el momento evaluado. Un fallo puntual grave no reduce automáticamente la madurez y una capacidad básica puede estar HEALTHY\_FOR\_STAGE.

D4 no confirma root cause, no prioriza problemas y no genera recomendaciones. D4 responde WHERE IS THE ORGANISM UNHEALTHY? Los bloques posteriores profundizarán en WHY y Fase 4 decidirá prioridad.

1\. Estados canónicos de salud  
Toda capacidad evaluable debe poder adoptar uno de los siguientes estados:  
ELITE  
HEALTHY  
FRAGILE  
BAD  
CRITICAL  
DISASTER  
UNKNOWN  
NOT\_ASSESSABLE

ELITE: rendimiento fuerte y estable, resiliencia elevada y funcionamiento por encima de lo razonablemente esperado para el contexto y madurez, sin implicar perfección absoluta.  
HEALTHY: dentro de un rango operativo saludable, sin deterioro material y cumpliendo razonablemente su función empresarial.  
FRAGILE: funciona actualmente, pero existen warning signs, buffer limitado, concentración, dependencia, vulnerabilidad o deterioro inicial.  
BAD: existe underperformance material y daño empresarial real.  
CRITICAL: existe impacto empresarial grave, propagación rápida o afectación de un critical path.  
DISASTER: una función core está efectivamente fallando o la continuidad del negocio está amenazada. Debe reservarse para situaciones excepcionales.  
UNKNOWN: el estado no puede conocerse con la información disponible.  
NOT\_ASSESSABLE: no existe evidencia/cobertura suficiente para evaluar la capacidad.

NO DETECTED PROBLEM ≠ HEALTHY cuando la cobertura no es suficiente.  
UNKNOWN y NOT\_ASSESSABLE nunca deben sustituirse silenciosamente por HEALTHY.

2\. Capacidades mínimas evaluadas  
D4 debe poder evaluar como mínimo:  
Market  
Product  
Offer  
Unit Economics  
Acquisition  
Creative  
Conversion  
Retention  
Inventory  
Operations  
Finance  
Data  
Technology  
Team  
Strategy

La criticidad relativa de cada capacidad debe poder adaptarse al business model. Debe existir un registro de BUSINESS\_CRITICAL\_CAPABILITIES por modelo de negocio cuando sea aplicable.

3\. Dimensiones de evaluación  
CAPABILITY HEALTH es multidimensional. Como mínimo, el motor debe poder considerar, cuando sean relevantes y observables:  
Performance  
Efficiency  
Stability  
Trend / Trajectory  
Reliability  
Resilience  
Capacity  
Exposure  
Dependency  
Control

Toda clasificación debe considerar el CURRENT OUTPUT, pero nunca debe reducirse a una única métrica.  
ONE KPI ≠ CAPABILITY HEALTH.

4\. CAPABILITY\_HEALTH  
Cada evaluación por capacidad debe poder representarse mediante un objeto equivalente a CAPABILITY\_HEALTH con, como mínimo cuando aplique:  
capability  
health\_state  
health\_score  
confidence  
maturity\_stage  
required\_maturity  
performance\_state  
efficiency\_state  
stability\_state  
trajectory  
resilience  
risk\_exposure  
primary\_signals  
supporting\_evidence  
contradicting\_evidence  
current\_constraints  
limitations

health\_score puede existir internamente en una escala 0–100 para cálculo y ordenación, pero no es la verdad principal ni debe presentarse con falsa precisión. El estado y su explicación son prioritarios.

Deben mantenerse separadas las variables:  
health\_score  
maturity\_stage  
risk\_score  
confidence

No deben colapsarse en un único Business Score como output principal.

5\. Trayectoria  
Toda capacidad evaluable debe poder mantener una trayectoria independiente de su health\_state:  
IMPROVING  
STABLE  
DETERIORATING  
RAPIDLY\_DETERIORATING  
RECOVERING  
VOLATILE

Un estado HEALTHY puede coexistir con RAPIDLY\_DETERIORATING. Un estado BAD puede coexistir con RECOVERING. Estado actual y dirección de cambio no son la misma variable.

6\. Health scope  
Toda clasificación debe preservar su alcance. Valores conceptuales mínimos:  
GLOBAL  
LOCALIZED  
SEGMENTED

Un problema localizado no debe globalizarse automáticamente. Un parent HEALTHY puede coexistir con una subcapability CRITICAL de exposición pequeña. La evaluación debe preservar heterogeneidad por device, browser, geography, channel, cohort, SKU u otro segmento material cuando la evidencia lo permita.

7\. Evidencia obligatoria  
Cada health classification debe poder responder:  
Why this health state?  
Which metrics?  
Compared to what?  
For how long?  
Which segment?  
What business impact?  
What uncertainty exists?

La clasificación debe preservar supporting\_evidence y contradicting\_evidence. La evidencia positiva también importa; el sistema no debe registrar únicamente anomalías negativas.

Cada HEALTH\_FINDING debe quedar enlazado a evidencia identificable y, cuando corresponda, a scope, trajectory, exposure y confidence.

8\. Jerarquía de comparación  
D4 no puede depender de thresholds universales. La comparación debe priorizar, según disponibilidad y naturaleza de la métrica:  
1\. Hard business constraint  
2\. Internal target  
3\. Historical baseline  
4\. Context-adjusted baseline  
5\. External benchmark

F6 podrá aportar benchmarks externos y guardrails adicionales, pero D4 debe funcionar sin depender completamente de ellos.

No existe una regla universal del tipo \-10% \= FRAGILE, \-20% \= BAD, \-30% \= CRITICAL. La misma magnitud puede tener impacto distinto según la función, criticidad y exposición.

Como principio conceptual, la clasificación debe considerar conjuntamente:  
MAGNITUDE × BUSINESS CRITICALITY × EXPOSURE  
sin asumir que esto deba implementarse necesariamente como una fórmula literal única.

9\. State Classification Inputs  
Como mínimo, el motor de clasificación debe poder considerar:  
magnitude  
duration  
persistence  
business\_exposure  
economic\_impact  
trajectory  
resilience  
critical\_path\_position

Además puede considerar stability, concentration, dependency, capacity utilization y redundancies cuando sean materiales.

10\. Orden de evaluación del Health Engine  
La evaluación debe seguir conceptualmente esta secuencia:  
TRUSTED DATA  
→ CONTEXT ADJUSTMENT  
→ MATURITY EXPECTATION  
→ PERFORMANCE / EFFICIENCY / STABILITY / TRAJECTORY / RESILIENCE / CAPACITY / EXPOSURE  
→ HEALTH CLASSIFICATION

D4 debe consumir D1 antes de sostener una clasificación en datos dudosos. Debe consumir D2 para evitar interpretar cambios fuera de contexto. Debe consumir D3 para distinguir CURRENT HEALTH de STRUCTURAL MATURITY y REQUIRED MATURITY.

La evaluación debe preferir CONTEXT\_ADJUSTED\_PERFORMANCE cuando esté disponible.

11\. Determinismo e inferencia  
No se debe dejar la clasificación de health completamente al LLM.

El runtime debería calcular o normalizar, cuando sea posible:  
metric deltas  
historical baselines  
targets  
trajectory  
persistence  
exposure  
capacity utilization  
concentration  
coverage

El modelo debe utilizar esos resultados para:  
interpret combined evidence  
explain health state  
identify uncertainty  
connect cross-capability symptoms

Los componentes cuantificables y reproducibles deben calcularse determinísticamente cuando sea posible. El modelo aporta interpretación y explicación, no sustituye el cálculo disponible.

12\. Confidence  
Cada clasificación debe devolver confidence:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT

La confianza debe considerar al menos:  
data\_quality  
context\_quality  
sample\_size  
coverage  
maturity\_confidence  
signal\_consistency

Si la calidad de datos relevante es LOW, la health classification dependiente de esos datos no puede recibir HIGH confidence sin evidencia independiente suficiente que lo justifique.

La confianza global de BUSINESS\_HEALTH debe considerar también HEALTH\_COVERAGE, entendida como porcentaje de capacidades evaluables, no como una medida de calidad del negocio.

13\. Risk, horizon y warning state  
D4 debe poder mantener separados CURRENT\_HEALTH y NEAR\_TERM\_RISK.

Cuando los datos lo permitan, el horizonte puede representarse conceptualmente como:  
NOW  
7D  
30D  
90D

Esto representa exposición conocida, no un forecast completo.

D4 puede emitir EARLY\_WARNING antes de que exista daño material, siempre que exista evidencia de señales adelantadas. HEALTHY\_WITH\_RISK puede existir internamente, aunque la representación de UI pueda mantenerse como HEALTHY \+ Risk: HIGH.

D4 debe poder representar PROPAGATION\_RISK cuando una debilidad pueda afectar a otras capacidades.

14\. Health taxonomy y reason codes  
D4 debe poder tipificar findings mediante categorías canónicas, al menos:  
PERFORMANCE\_WEAKNESS  
EFFICIENCY\_WEAKNESS  
STABILITY\_WEAKNESS  
CAPACITY\_WEAKNESS  
RESILIENCE\_WEAKNESS  
STRUCTURAL\_WEAKNESS  
DATA\_WEAKNESS  
DEPENDENCY\_RISK

Reason codes conceptuales mínimos:  
PERFORMANCE\_DECLINE  
EFFICIENCY\_DECLINE  
CAPACITY\_LIMIT  
CONCENTRATION\_RISK  
DEPENDENCY\_RISK  
VOLATILITY  
REGRESSION  
STRUCTURAL\_GAP  
DATA\_UNCERTAINTY

Estos códigos no sustituyen la explicación ni la evidencia.

15\. Relaciones entre capacidades  
D4 no debe asumir independencia entre capacidades. Debe poder conservar relaciones potenciales sin afirmar todavía causalidad formal.

Puede distinguir:  
PRIMARY\_HEALTH\_ISSUE  
DOWNSTREAM\_HEALTH\_EFFECT  
PROPAGATION\_RISK  
COMPENSATED\_BY  
RELATED\_HEALTH\_FINDINGS

Una capacidad puede aparentar un output sano porque otra compensa su deterioro. El mecanismo de compensación debe poder registrarse sin convertir la capacidad deteriorada en HEALTHY.

D4 puede agrupar RELATED\_HEALTH\_FINDINGS, pero la deduplicación causal y la confirmación de relaciones causales corresponde a bloques posteriores.

16\. Aggregation de subcapacidades  
Parent Health nunca debe obtenerse mediante un promedio ingenuo.

La agregación debe considerar:  
worst critical component  
business exposure  
propagation  
duration  
trajectory  
redundancy  
critical-path importance

Una subcapacidad de CRITICAL\_PATH puede dominar el estado del parent cuando su fallo compromete una función obligatoria. Un componente DISASTER no puede diluirse por promediarlo con componentes HEALTHY.

Los pesos pueden considerar business\_dependency, revenue\_share y critical\_path\_importance, pero el sistema no debe convertirse en una simple media ponderada que oculte fallos críticos.

17\. Overall Business Health  
El estado global del negocio no es el promedio de las capacidades.

BUSINESS\_HEALTH debe considerar al menos:  
critical\_capabilities  
current\_constraints  
economic\_survival  
propagation  
exposure  
health\_coverage

Trece capacidades HEALTHY y una DISASTER en Payment pueden producir BUSINESS\_HEALTH CRITICAL.

18\. Estado, riesgo, madurez y readiness  
D4 debe mantener separadas:  
CURRENT\_HEALTH  
STRUCTURAL\_MATURITY  
REQUIRED\_MATURITY  
STRUCTURAL\_RISK  
SCALING\_READINESS  
TRAJECTORY

Una capacidad puede estar HEALTHY hoy y presentar STRUCTURAL\_RISK HIGH por un maturity gap. Del mismo modo, una capacidad madura puede estar CRITICAL por un fallo operativo actual.

D4 no debe convertir un maturity gap en un health failure automáticamente ni reducir maturity\_stage por una incidencia temporal.

19\. State history y transiciones  
Cada capacidad y subcapacidad debe poder mantener HEALTH\_HISTORY.

Todo cambio relevante puede producir:  
CAPABILITY\_HEALTH\_CHANGED  
from: \<previous\_state\>  
to: \<new\_state\>

D4 debe poder detectar HEALTH\_DEGRADATION y registrar recuperación sin sobrescribir silenciosamente el estado histórico.

También puede mantener, cuando aplique:  
RECOVERY\_SPEED  
CHRONIC\_WEAKNESS  
ACUTE\_FAILURE  
HEALTH\_DEBT

CHRONIC\_WEAKNESS representa deterioro persistente; ACUTE\_FAILURE un fallo agudo. HEALTH\_DEBT puede acumularse cuando una capacidad permanece FRAGILE/BAD durante un periodo material sin corrección.

20\. STATE\_HYSTERESIS  
El motor debe evitar cambios de estado continuos causados por ruido.

Debe existir STATE\_HYSTERESIS mediante criterios de persistence, magnitude u otros controles apropiados a la métrica. Puede requerirse minimum\_persistence o magnitude\_threshold para confirmar una transición.

Eventos extremos pueden provocar cambios inmediatos. Por ejemplo, un checkout unavailable no necesita esperar una ventana ordinaria para deteriorar el estado.

La recuperación debe confirmarse: una hora buena no significa recuperación completa.

State machine conceptual:  
ELITE ↔ HEALTHY ↔ FRAGILE ↔ BAD ↔ CRITICAL ↔ DISASTER

Se permiten direct jumps cuando la evidencia lo justifique, por ejemplo HEALTHY → DISASTER ante un outage total. Toda transición debe quedar registrada.

21\. Evidence Snapshot y reproducibilidad  
Cada cambio de estado material debería almacenar un HEALTH EVIDENCE SNAPSHOT con, al menos cuando esté disponible:  
metrics  
context  
events  
maturity  
confidence

La combinación de:  
data snapshot  
context snapshot  
maturity snapshot  
health\_model\_version  
debe permitir reconstruir la clasificación.

El motor debe estar versionado mediante un campo equivalente a health\_model\_version, porque sus reglas pueden evolucionar.

22\. Capability Registry  
Cada capacidad debe disponer de un registro que pueda declarar:  
metrics  
signals  
dependencies  
critical\_components  
leading\_indicators  
lagging\_indicators  
risk\_factors  
health\_rules

Arquitectura conceptual:  
CAPABILITY REGISTRY  
→ HEALTH ENGINE  
→ HEALTH\_RESULT

Los leading indicators y lagging indicators deben poder coexistir. Un motor basado únicamente en lagging indicators detectaría el deterioro demasiado tarde.

23\. Multi-agent compatibility  
Todos los agentes especializados que evalúen una capacidad deben devolver un formato compatible equivalente a CAPABILITY\_HEALTH\_RESULT.

Cada agente debe limitarse al dominio que conoce. Un Creative Agent no debe diagnosticar cashflow como si fuera especialista financiero.

El parent orchestrator integra:  
capability\_health  
cross\_capability\_dependencies  
global\_business\_health

Si dos agentes producen evaluaciones incompatibles debe registrarse AGENT\_ASSESSMENT\_CONFLICT. El conflicto no debe ocultarse ni resolverse por autoridad arbitraria de un agente.

La reconciliación debe utilizar:  
shared canonical metrics  
scope  
definitions  
evidence

24\. BLIND\_SPOTS y cobertura  
D4 debe exponer BLIND\_SPOTS cuando no exista cobertura suficiente en una capacidad o área.

La ausencia de una integración o fuente necesaria puede producir NOT\_ASSESSABLE, no HEALTHY.

HEALTH\_COVERAGE debe representar el porcentaje de capacidades evaluables. Un estado HEALTHY con confidence LOW debe distinguirse claramente de HEALTHY con confidence HIGH.

25\. HEALTH\_FINDING  
Cada finding de salud debe poder conservar, según aplique:  
capability  
state  
confidence  
trajectory  
scope  
primary\_signal  
business\_exposure  
evidence  
supporting\_evidence  
contradicting\_evidence  
health\_type  
reason\_codes  
limitations

El estado de una capacidad no es una root cause. Un HEALTH\_FINDING identifica la condición observada; D6–D9 profundizan en síntomas, hipótesis, causalidad, root cause y constraint.

26\. CAPABILITY\_HEALTH\_RESULT  
Cada resultado por capacidad debe poder incluir, cuando sea evaluable:  
capability  
maturity  
required\_maturity  
health  
health\_confidence  
trajectory  
risk  
scope  
primary\_signals  
business\_exposure  
structural\_gap  
health\_type  
supporting\_evidence  
contradicting\_evidence  
limitations

27\. HEALTH\_RESULT  
D4 debe entregar un objeto equivalente a HEALTH\_RESULT capaz de incluir:  
business\_health  
business\_health\_confidence  
capabilities\[\]  
blind\_spots  
cross\_capability\_deteriorations  
critical\_paths  
emerging\_risks  
health\_changes  
limitations

El output global puede conservar además PRIMARY\_UNHEALTHY\_CAPABILITIES y CRITICAL\_LOCALIZED\_FAILURES cuando resulten útiles y estén respaldados por evidencia.

28\. Observabilidad administrativa  
El panel de administración debe poder reconstruir, por capacidad:  
Capability  
Current health  
Previous health  
Trajectory  
Confidence  
Primary evidence  
Exposure  
Maturity  
Structural gap

No basta con mostrar un heatmap. El heatmap es PRESENTATION, no REASONING. La evidencia y el historial deben permanecer accesibles para trazabilidad.

29\. Diagnóstico continuo  
D4 debe ser compatible con un CURRENT BUSINESS HEALTH STATE actualizado en el tiempo, no únicamente con evaluaciones ad hoc iniciadas por una pregunta del usuario.

Una transición de health puede disparar investigación diagnóstica, pero no acción automática en esta fase.

Cadena conceptual:  
HEALTH CHANGE  
→ D5 SIGNAL ENGINE  
→ D6 SYMPTOM  
→ D8 HYPOTHESIS

30\. Dependencias D0–D9  
D0 aporta DIAGNOSTIC\_CASE.  
D1 controla fiabilidad de datos; D4 solo debe sostener health en trusted / sufficiently reliable data.  
D2 aporta contexto y CONTEXT\_ADJUSTED\_PERFORMANCE.  
D3 aporta current\_maturity, required\_maturity y structural\_gaps.  
D4 aporta CURRENT\_CAPABILITY\_STATE.  
D5 detecta signals, anomalies y changes que pueden modificar el estado.  
D6 combina señales en síntomas.  
D7–D9 profundizan en causal graph, hypotheses, root cause y constraint.

31\. Invariantes D4  
El sistema nunca debe:  
\- Confundir madurez con salud.  
\- Utilizar una única métrica para clasificar toda una capacidad.  
\- Considerar revenue como proxy de salud global.  
\- Considerar ausencia de datos como salud.  
\- Utilizar thresholds universales sin contexto.  
\- Ignorar exposición empresarial.  
\- Ignorar trayectoria.  
\- Ignorar estabilidad.  
\- Ignorar resiliencia.  
\- Ignorar concentración.  
\- Ignorar dependencias entre capacidades.  
\- Promediar ciegamente subcapacidades críticas.  
\- Ignorar problemas localizados.  
\- Generalizar un segmento pequeño al negocio completo.  
\- Ocultar deterioro compensado por otra métrica.  
\- Cambiar continuamente de estado por ruido.  
\- Reducir maturity stage por una incidencia puntual.  
\- Confundir health state con root cause.  
\- Confundir health state con prioridad.  
\- Generar recomendaciones.  
\- Convertir una oportunidad de optimización en una enfermedad.

NOT OPTIMAL ≠ UNHEALTHY.  
HEALTHY ≠ OPTIMIZED.  
WORST HEALTH ≠ HIGHEST PRIORITY AUTOMATICALLY.

32\. Fixtures obligatorios iniciales  
Fixture 1 — Growth masking economics  
Input:  
Revenue \+20%  
CAC \+45%  
Contribution \-18%  
Expected:  
Acquisition BAD o FRAGILE según contexto.  
Economics BAD.  
No clasificar business HEALTHY solo porque revenue crece.

Fixture 2 — Advanced checkout outage  
Input:  
Conversion maturity E9  
Payment success \-70%  
Exposure 90% orders  
Expected:  
Conversion DISASTER / CRITICAL.  
Maturity unchanged.

Fixture 3 — Early-stage healthy  
Input:  
Business E2  
Retention system basic  
Repeat appropriate for stage  
No deterioration  
Expected:  
Retention HEALTHY\_FOR\_STAGE.

Fixture 4 — High risk but currently operating  
Input:  
Inventory currently in stock  
Hero SKU coverage 11 days  
Supplier lead time 90 days  
Expected:  
Health FRAGILE.  
Current damage LOW.  
Risk CRITICAL/HIGH.

Fixture 5 — Localized technical issue  
Input:  
Global CVR stable  
Safari CVR \-45%  
Safari share 8%  
Expected:  
Conversion overall HEALTHY/FRAGILE.  
Safari CRITICAL.  
Globalize issue false.

Fixture 6 — Data blind spot  
Input:  
No inventory integration  
Expected:  
Inventory NOT\_ASSESSABLE.

Fixture 7 — Compensated deterioration  
Input:  
Traffic \+50%  
CVR \-25%  
Revenue \+12%  
Expected:  
Conversion BAD.  
Revenue output positive.  
Compensating factor traffic.

Fixture 8 — Scaling context  
Input:  
Spend \+80%  
CAC \+10%  
Customers \+65%  
Contribution \+40%  
Expected:  
Acquisition HEALTHY or FRAGILE.  
No clasificar BAD automáticamente por aumento de CAC.

Fixture 9 — Chronic fragility  
Input:  
90% spend dependent on one creative for 4 months  
Expected:  
Creative FRAGILE.  
Reason: concentration risk.

Fixture 10 — Operations capacity  
Input:  
SLA still healthy  
Capacity utilization 97%  
Volume growth \+30%  
Expected:  
Operations FRAGILE.

Fixture 11 — Topline masking cash issue  
Input:  
Revenue \+35%  
Cash \-40%  
Inventory \+70%  
Contribution flat  
Expected:  
Commercial HEALTHY.  
Economic/Finance BAD.  
No global health based solely on revenue.

Fixture 12 — Temporary recovery  
Input:  
Conversion BAD  
Last 2 days improving  
Expected:  
Health BAD.  
Trajectory RECOVERING.  
No marcar HEALTHY prematuramente.

33\. Definition of Done  
D4 estará correctamente construido cuando pueda determinar, para cada capacidad y para el negocio global:  
\- health\_state actual;  
\- trajectory;  
\- confidence;  
\- scope;  
\- evidence y contradictions;  
\- exposure y critical-path relevance;  
\- current risk y emerging risk;  
\- blind spots y coverage;  
\- cambios respecto al estado anterior;  
\- diferencias entre current health, maturity, structural risk y scaling readiness;  
\- deterioros compensados y posibles relaciones cross-capability sin afirmar causalidad no demostrada.

D4 debe permitir localizar dónde el organismo está sano, frágil o fallando y con qué certeza, sin decidir todavía qué atacar primero ni qué acción ejecutar.  
