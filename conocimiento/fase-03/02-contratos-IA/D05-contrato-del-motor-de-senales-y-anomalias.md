FASE 3 — SISTEMA DE DIAGNÓSTICO  
D5 — CONTRATO DEL MOTOR DE SEÑALES Y ANOMALÍAS

0\. Propósito y frontera de responsabilidad  
D5 consume las métricas validadas por D1, el contexto y baselines de D2, la madurez y complejidad aportadas por D3 y el estado de salud de D4. Su responsabilidad es determinar qué está cambiando de forma suficientemente relevante como para merecer observación, investigación o alerta.

D5 debe separar siempre NOISE de SIGNAL. No todo cambio es una señal y no toda señal es un problema.

Cadena conceptual obligatoria:  
OBSERVATION → VARIATION → SIGNAL → ANOMALY → SYMPTOM

D5 se ocupa principalmente de VARIATION, SIGNAL y ANOMALY. D6 transforma conjuntos de señales en síntomas empresariales. D5 no debe convertir una señal en síntoma, root cause, prioridad o recomendación.

La detección debe buscar CHANGES THAT MATTER, no cualquier variación numérica.

1\. Taxonomía mínima de señales  
El motor debe soportar como mínimo los siguientes signal\_type:  
LEVEL\_SIGNAL  
TREND\_SIGNAL  
CHANGE\_SIGNAL  
RATE\_SIGNAL  
VOLATILITY\_SIGNAL  
CONCENTRATION\_SIGNAL  
MIX\_SIGNAL  
RATIO\_SIGNAL  
CAPACITY\_SIGNAL  
DEPENDENCY\_SIGNAL  
REGRESSION\_SIGNAL  
POSITIVE\_SIGNAL  
RISK\_SIGNAL

D5 debe poder reconocer además familias de anomalía equivalentes a:  
POINT\_ANOMALY  
CONTEXTUAL\_ANOMALY  
COLLECTIVE\_ANOMALY

La existencia de una anomalía no implica automáticamente deterioro. Puede existir una anomalía positiva. Puede existir una señal sin anomalía extrema y una anomalía sin problema empresarial.

2\. SIGNAL — contrato de datos  
Todo signal debe poder representarse estructuradamente mediante un objeto equivalente a SIGNAL con, como mínimo cuando aplique:  
signal\_id  
metric  
signal\_type  
direction  
polarity  
baseline  
current\_value  
previous\_value  
absolute\_change  
relative\_change  
magnitude  
velocity  
persistence  
scope  
segment  
context  
data\_confidence  
signal\_confidence  
business\_relevance  
detected\_at

Cuando sea necesario para exposición y trazabilidad, el signal debe poder conservar también:  
business\_share\_affected  
profit\_exposure  
leading\_indicator  
expected\_lag\_min  
expected\_lag\_max  
expectedness  
signal\_quality  
state  
alertability

La magnitud debe conservar tanto absolute\_change como relative\_change cuando ambas sean calculables. Una variación porcentual no debe eliminar la magnitud absoluta ni viceversa.

3\. Estados y enums canónicos  
3.1 Signal Direction  
UP  
DOWN  
FLAT  
VOLATILE  
MIXED

Direction no implica polarity. Un valor UP puede ser positivo, negativo o ambiguo según la métrica y el contexto.

3.2 Signal Polarity  
POSITIVE  
NEGATIVE  
NEUTRAL  
AMBIGUOUS

3.3 Signal Strength  
WEAK  
MODERATE  
STRONG  
VERY\_STRONG

SIGNAL\_STRENGTH y SIGNAL\_CONFIDENCE deben permanecer separados. Una señal puede tener gran magnitud y, sin embargo, poca confianza si los datos son poco fiables.

3.4 Persistence State  
TRANSIENT  
EMERGING  
PERSISTENT  
CHRONIC

3.5 Signal Velocity  
SLOW  
MODERATE  
FAST  
EXTREME

3.6 Signal State Machine  
NEW  
OBSERVING  
CONFIRMED  
PERSISTENT  
RESOLVED  
DISMISSED

NEW representa primera detección. OBSERVING indica evidencia todavía insuficiente para confirmar persistencia. CONFIRMED supera las reglas de evidencia. PERSISTENT se mantiene en el tiempo. RESOLVED ha regresado al rango esperado. DISMISSED corresponde a ruido, error de datos o cambio explicado por contexto.

Un signal no desaparece del historial al resolverse o descartarse: cambia de estado.

3.7 Recurrence Pattern  
DAILY  
WEEKLY  
MONTHLY  
EVENT\_DRIVEN  
SEASONAL

3.8 Expectedness  
EXPECTED  
UNEXPECTED  
PARTIALLY\_EXPECTED  
UNKNOWN

3.9 Alertability  
SILENT  
LOG\_ONLY  
WATCH  
ALERT  
URGENT\_ALERT

3.10 Signal Quality  
HIGH  
MEDIUM  
LOW

3.11 Signal Horizon  
REAL\_TIME  
SHORT\_TERM  
MEDIUM\_TERM  
LONG\_TERM

4\. Baselines y expected ranges  
D5 no debe depender de un único benchmark universal. Debe poder comparar una métrica contra los baselines válidos disponibles y conservar qué baseline produjo cada comparación.

Puede existir un EXPECTED\_LOW y EXPECTED\_HIGH por métrica. El rango esperado debe poder ser dinámico según, entre otros factores disponibles: weekday, season, market, channel, business stage y promotion.

Cuando existan varios baselines, D5 puede contrastarlos en paralelo. La coincidencia entre baselines puede reforzar una señal; la discrepancia entre ellos debe quedar visible y no simplificarse falsamente a una única conclusión.

D5 debe distinguir ANOMALY de REGIME\_SHIFT. Un cambio suficientemente estable puede convertirse en nueva realidad operacional, pero el baseline no debe adaptarse demasiado pronto.

5\. Baseline governance  
Los estados mínimos de gobierno del baseline son:  
BASELINE\_CANDIDATE  
BASELINE\_ACTIVE  
BASELINE\_REJECTED

La actualización de un baseline debe considerar, cuando aplique:  
sufficient duration  
business event understood  
data quality high  
state stable  
no unresolved incident

El motor no debe aprender un sistema roto como nuevo normal por el mero paso del tiempo. Un incidente no resuelto puede requerir BASELINE\_FREEZE o impedir la promoción de un candidato a BASELINE\_ACTIVE.

En cold start, una tienda sin histórico puede usar business targets, stage expectations, conservative defaults y más adelante external guardrails, pero con menor confidence. Debe poder mantenerse una noción de BASELINE\_MATURITY, por ejemplo LOW o HIGH, para expresar cuánto historial fiable sostiene el baseline.

6\. Configuración de thresholds  
Los signal thresholds no deben hardcodearse globalmente. Debe existir una precedencia configurable equivalente a:  
GLOBAL\_DEFAULT  
TENANT\_OVERRIDE  
CAPABILITY\_OVERRIDE  
METRIC\_OVERRIDE

Con suficiente histórico, los thresholds pueden adaptarse al comportamiento propio del tenant. Una tienda estable puede requerir menor desviación para detectar una señal que una tienda inherentemente volátil.

Algunos eventos pueden admitir guardrails absolutos, pero incluso estos deben formar parte de una definición versionada/configurable del sistema.

El motor debe poder distinguir, cuando aplique:  
CROSSING\_UP  
CROSSING\_DOWN  
APPROACHING\_GUARDRAIL  
GUARDRAIL\_BREACH

Los tipos de guardrail pueden incluir:  
ECONOMIC  
OPERATIONAL  
TECHNICAL  
RISK

7\. Determinismo e intervención del LLM  
Gran parte de D5 debe ser determinista. Siempre que sea posible, el runtime debe calcular o normalizar:  
baseline calculations  
deltas  
trend slopes  
persistence  
change points  
volatility  
segment analysis  
concentration ratios  
sample checks  
signal state  
alert cooldown

El LLM no debe mirar números y decidir subjetivamente si han cambiado cuando el cálculo puede ejecutarse de forma reproducible.

El LLM puede:  
interpret unusual combinations  
explain why a signal matters  
identify possible patterns  
identify meaningful relationships  
prepare signals for symptom reasoning

El LLM no debe sustituir cálculos disponibles.

Arquitectura conceptual:  
CANONICAL METRICS  
→ BASELINE ENGINE  
→ VARIATION ENGINE  
   → level changes  
   → trends  
   → velocity  
   → volatility  
   → concentration  
   → mix  
   → ratios  
→ SIGNIFICANCE ENGINE  
   → sample  
   → persistence  
   → context  
   → exposure  
   → confidence  
→ SIGNAL REGISTRY  
→ SIGNAL RESULT

8\. Calidad, confidence y control de falsos positivos  
Signal confidence debe considerar como mínimo, cuando existan:  
Data Quality  
Baseline Quality  
Context Quality  
Persistence  
Sample Sufficiency  
Cross-source Support

Esta combinación no obliga a una multiplicación literal.

Si D1 marca LOW\_SAMPLE, DATA\_UNRELIABLE u otra limitación relevante, D5 debe degradar confidence o suprimir la confirmación según corresponda. Un cambio porcentual extremo con una muestra mínima no puede convertirse automáticamente en una señal de alta confianza.

Si el contexto está incompleto o contaminado por promociones, launches u otros eventos relevantes, debe poder marcarse CONTEXT\_CONTAMINATED y limitar signal\_confidence.

El objetivo de false-positive control es precision over noise, especialmente para alertas. A la vez, el sistema debe aplicar mayor sensibilidad a fallos de critical path como payment, checkout, security, data integrity, cash o inventory cuando el negocio dependa de ellos.

Un signal de bajo impacto puede requerir persistencia; un critical-path failure puede confirmarse inmediatamente si la evidencia suficiente lo justifica.

9\. Statistical significance y business relevance  
STATISTICAL SIGNIFICANCE ≠ BUSINESS SIGNIFICANCE.

Una señal estadísticamente creíble puede ser empresarialmente irrelevante. D5 debe mantener business\_relevance separada de signal\_strength y signal\_confidence.

Business relevance debe poder adoptar, como mínimo:  
LOW  
MEDIUM  
HIGH  
CRITICAL

Para determinarla pueden considerarse:  
revenue share  
margin share  
customer share  
critical path  
risk exposure  
strategic relevance

La misma magnitud puede tener diferente relevancia según el business\_share\_affected. Un cambio enorme en un segmento con exposición marginal no debe generalizarse al negocio completo.

D5 puede ordenar señales por relevancia técnica o de negocio, pero no decide la prioridad final de intervención. Esa responsabilidad pertenece a Fase 4\.

10\. Deduplicación, dependencia y corroboración  
Un mismo fenómeno puede producir múltiples señales correlacionadas. D5 no debe tratar automáticamente cada métrica derivada como evidencia independiente ni generar varias alertas equivalentes del mismo fenómeno.

D5 debe utilizar metric lineage de D1 y relaciones matemáticas conocidas para identificar dependencia entre señales.

Cada señal puede declarar una relación de independencia equivalente a:  
INDEPENDENT  
PARTIALLY\_DEPENDENT  
DERIVED\_FROM\_SAME\_SOURCE

Para agrupar señales, pueden considerarse:  
temporal correlation  
scope overlap  
metric dependency

D5 puede construir SIGNAL\_CLUSTER. D6 será quien convierta clusters y conjuntos de señales en síntomas; la agrupación D5 no confirma causalidad.

La corroboración entre fuentes suficientemente independientes puede elevar confidence. Si las fuentes se contradicen, debe poder generarse SIGNAL\_CONFLICT o DATA\_SIGNAL en lugar de presentar una falsa business signal fuerte.

11\. Segmentación y localización  
D5 debe analizar tanto el global como segmentos materiales. Entre las dimensiones posibles se incluyen:  
market  
device  
browser  
channel  
campaign  
creative  
product  
SKU  
customer type  
cohort  
landing page  
payment method

No debe explorar millones de segmentos indiscriminadamente. Un segmento debería cumplir minimum\_sample y minimum\_business\_exposure para producir una señal ordinaria.

Puede existir una excepción para un segmento pequeño cuando represente un critical customer group o high-value segment.

D5 debe poder detectar LOCALIZED\_ANOMALY y preservar el scope. Una anomalía localizada nunca debe globalizarse automáticamente.

La detección debe ser compatible con un enfoque híbrido:  
TOP\_DOWN  
BOTTOM\_UP

Top-down permite detectar una anomalía global y hacer targeted drilldown sobre candidate dimensions. Bottom-up permite encontrar un subsegmento grave aunque el global permanezca estable.

12\. Eventos, lags y ventanas temporales  
D5 debe poder asociar señales a eventos conocidos sin convertir simultaneidad en causalidad.

Un evento puede tener expected\_effect\_window. Las comparaciones pueden distinguir:  
PRE\_EVENT\_BASELINE  
POST\_EVENT

Una señal que comienza tras un evento puede marcarse como EVENT\_LINKED\_SIGNAL, conservando la proximidad temporal sin afirmar root cause.

Las relaciones entre señales o eventos pueden almacenar:  
expected\_lag\_min  
expected\_lag\_max

No debe utilizarse la misma correlation window para todos los dominios. Payment puede operar en minutos/horas mientras Retention puede requerir semanas/meses.

D5 debe poder clasificar señales según expectedness:  
EXPECTED  
UNEXPECTED  
PARTIALLY\_EXPECTED  
UNKNOWN

Una señal EXPECTED puede registrarse sin generar una alerta visible si el contexto la explica.

13\. Cadencia de evaluación  
No todas las métricas deben evaluarse con la misma frecuencia. Debe existir un SIGNAL CADENCE REGISTRY capaz de definir por métrica:  
evaluation\_frequency  
minimum\_window  
settlement\_delay

Los periodos todavía abiertos o no asentados no deben confirmarse como anomalía con el mismo criterio que periodos cerrados. D5 puede posponer confirmación cuando D1/D2 indiquen que los datos aún no están asentados.

Algunos eventos sí admiten detección inmediata, como checkout outage, payment failure o integration disconnect.

Otros signals pueden evaluarse en batch diario, semanal o mensual según su naturaleza.

Cada señal debe poder declarar un horizonte:  
REAL\_TIME  
SHORT\_TERM  
MEDIUM\_TERM  
LONG\_TERM

Cuando sea útil, D5 puede mantener comparativas multi-horizon como 1D, 7D, 28D y 90D sin confundir una oscilación de corto plazo con una tendencia estructural.

14\. Alert Policy y prevención de alert fatigue  
DETECTED\_SIGNAL ≠ USER\_VISIBLE\_ALERT.

La arquitectura de alertas debe permanecer separada del motor de detección:  
SIGNALS  
→ ALERT POLICY  
→ SUPPRESSION  
→ DEDUPLICATION  
→ ESCALATION  
→ USER NOTIFICATION

No todas las señales deben convertirse en alertas. Cada señal puede tener alertability:  
SILENT  
LOG\_ONLY  
WATCH  
ALERT  
URGENT\_ALERT

La persistencia o deterioro puede permitir escalado, por ejemplo WATCH → ALERT → URGENT\_ALERT. La recuperación puede permitir de-escalado, por ejemplo ALERT → WATCH → RESOLVED.

Debe existir ALERT\_COOLDOWN para evitar notificar repetidamente el mismo estado sin información nueva.

Una nueva notificación sobre una señal existente debería requerir MATERIAL UPDATE, como por ejemplo:  
severity changed  
confidence changed  
scope expanded  
new evidence  
new root cause candidate

Los suppression reasons mínimos deben poder incluir:  
LOW\_SAMPLE  
EXPECTED\_CONTEXT  
LOW\_BUSINESS\_RELEVANCE  
INSUFFICIENT\_PERSISTENCE  
DATA\_UNRELIABLE  
DUPLICATE\_SIGNAL  
KNOWN\_PATTERN

El sistema debe poder explicar por qué una señal fue suprimida o no llegó a producir alerta.

15\. Signal Registry  
D5 necesita una biblioteca canónica y versionada de definiciones de señal.

Cada SIGNAL\_DEFINITION debe poder incluir, cuando aplique:  
signal\_code  
domain  
metric  
type  
direction  
dependencies  
possible\_symptoms  
capability  
required\_metrics  
optional\_metrics  
minimum\_sample  
baseline\_type  
context\_requirements  
detection\_logic  
severity\_logic

Los códigos deben ser estables y machine-readable. La etiqueta humana de UI debe mantenerse separada del código canónico.

Ejemplos de códigos válidos contenidos en el conocimiento de D5 incluyen:  
ACQ\_CAC\_UP  
ACQ\_CPM\_UP  
ACQ\_CTR\_DOWN  
CREATIVE\_VELOCITY\_DOWN  
CONV\_ATC\_DOWN  
CONV\_CHECKOUT\_DOWN  
CONV\_PAYMENT\_DOWN  
RET\_REPEAT\_DOWN  
INV\_COVERAGE\_DOWN  
FIN\_CONTRIBUTION\_DOWN

Si cambia la lógica de una definición debe incrementarse signal\_definition\_version en lugar de alterar silenciosamente el significado histórico del código.

16\. Persistencia, history, lineage y versionado  
Cada signal debe persistirse. El almacenamiento conceptual debe poder conservar:  
id  
tenant\_id  
metric\_id  
capability  
signal\_type  
state  
direction  
strength  
confidence  
first\_detected  
last\_detected  
resolved\_at  
scope  
metadata

SIGNAL\_HISTORY debe poder conservar, cuando aplique:  
first\_detected  
last\_detected  
peak\_magnitude  
duration  
resolution\_time  
recurrence

La relación señal-evidencia debe poder representarse mediante campos equivalentes a:  
signal\_id  
observation\_id  
weight  
role

Debe poder reconstruirse el lineage:  
raw data → canonical metric → baseline → variation → signal

Toda ejecución puede producir un SIGNAL\_RUN con:  
run\_id  
time  
model\_version  
metrics\_evaluated  
signals\_detected  
signals\_updated  
errors

Debe guardarse signal\_model\_version. Las reglas pueden evolucionar.

Si se mejoran las reglas, los historical signals pueden recalcularse, pero nunca deben sobrescribirse silenciosamente diagnósticos antiguos. La trazabilidad de qué versión produjo cada resultado debe permanecer disponible.

17\. Composite signals y scores internos  
D5 puede utilizar señales compuestas derivadas de varias métricas, pero deben ser explicables. Todo composite signal debe permitir identificar qué inputs contribuyeron.

Puede existir normalized\_signal\_score para comparación interna entre métricas diferentes, pero no debe convertirse en la verdad principal ni presentarse sin explicación.

No crear scores opacos.

18\. Signal-level severity  
D5 puede asignar severidad preliminar de señal:  
INFORMATIONAL  
LOW  
MODERATE  
HIGH  
CRITICAL

Esta variable representa signal-level severity y no sustituye la severidad diagnóstica formal determinada posteriormente por D10.

D5 tampoco debe asumir que una gran variación porcentual equivale a gran impacto. Magnitude, exposure, critical-path relevance y business relevance deben conservarse separadamente.

19\. SIGNAL\_RESULT — contrato de salida  
D5 debe entregar un objeto equivalente a SIGNAL\_RESULT capaz de incluir:  
signals  
anomalies  
signal\_clusters  
resolved\_signals  
watch\_signals  
critical\_signals  
positive\_signals  
suppressed\_signals  
blind\_spots

El resultado debe preservar señales positivas, negativas, neutrales o ambiguas cuando sean relevantes. Señales opuestas no deben cancelarse entre sí automáticamente si describen dimensiones distintas.

20\. Observabilidad administrativa  
El panel de administración debe poder reconstruir, para una señal evaluada:  
why signal fired  
why it did not fire  
threshold  
baseline  
context  
sample  
confidence  
signal definition/version  
state/history  
scope/segment  
suppression reason  
alertability

La ausencia de una alerta debe ser explicable. No basta con observar únicamente las señales que sí dispararon.

21\. Relación D4 ↔ D5 y apertura de investigaciones  
D4 y D5 forman un loop operativo. Un cambio de health puede generar una señal y varias señales D5 pueden provocar una reevaluación de health en D4.

Cadena conceptual:  
METRICS → SIGNALS → HEALTH → HEALTH CHANGE → NEW INVESTIGATION

Una señal suficientemente fuerte puede abrir automáticamente un DIAGNOSTIC\_CASE sin esperar a que el usuario pregunte, pero no toda señal abre caso.

La SIGNAL-TO-CASE POLICY debe ser configurable y puede considerar conjuntamente:  
business relevance  
confidence  
severity

Un ejemplo conceptual permitido es:  
LOW → log only  
MODERATE → watch  
HIGH → open diagnostic case  
CRITICAL → open \+ alert

Estos mapeos son configurables y no deben tratarse como thresholds universales inmutables.

22\. Interfaces con el resto del sistema de diagnóstico  
D1 aporta trusted metrics, data confidence, source conflicts, sample quality y metric lineage. D5 debe respetar esos límites.

D2 aporta expected context, baselines, seasonality, promotions, mix y events. D5 debe detectar anomalías contextualizadas en lugar de comparar periodos ciegamente.

D3 aporta maturity y business complexity. El significado y sensibilidad de algunas señales pueden cambiar según stage.

D4 consume señales para actualizar CURRENT\_CAPABILITY\_STATE y puede originar señales ante cambios de health.

D6 recibe signals, signal\_clusters, stability signals y contradicting signals y los convierte en BUSINESS SYMPTOMS.

D7 utiliza relaciones entre las variables detrás de las señales para el causal graph.

D8 utiliza señales y síntomas como evidencia para generar y contrastar hipótesis.

D10 determina la severidad real del problema. D5 solo aporta magnitud, exposición y relevancia inicial de la señal.

23\. Invariantes D5  
El sistema nunca debe:  
\- Tratar cualquier variación como señal.  
\- Ignorar sample size.  
\- Ignorar persistencia.  
\- Ignorar velocidad.  
\- Ignorar contexto.  
\- Ignorar calidad de datos.  
\- Interpretar direction como impacto automáticamente.  
\- Usar thresholds universales sin justificación.  
\- Tratar una métrica derivada como evidencia independiente de sus inputs.  
\- Duplicar alertas del mismo fenómeno.  
\- Alertar repetidamente sin información nueva.  
\- Confundir anomalía con problema.  
\- Confundir señal con síntoma.  
\- Confundir señal con root cause.  
\- Confundir señal con prioridad.  
\- Confundir señal con recomendación.  
\- Generalizar una anomalía localizada.  
\- Ignorar concentración creciente.  
\- Ignorar señales positivas.  
\- Convertir un estado roto en baseline demasiado pronto.  
\- Omitir señales de datos.  
\- Ocultar conflictos entre fuentes.  
\- Ignorar critical-path failures por falta de persistencia cuando existe evidencia suficiente de fallo.  
\- Sobrealertar métricas de baja relevancia.  
\- Dejar la detección numérica enteramente al LLM.

D5 puede afirmar que existe CTR deterioration signal; no debe saltar directamente a Creative fatigue como causa confirmada.  
D5 puede detectar una caída de CTR; no debe convertirla directamente en una recomendación como create new ads.

24\. Tests obligatorios iniciales  
D5 necesita un paquete fuerte de tests. Como mínimo:  
test\_no\_signal\_on\_noise  
test\_persistent\_trend  
test\_step\_change  
test\_low\_sample\_suppression  
test\_contextual\_anomaly  
test\_expected\_promotion\_change  
test\_mix\_shift  
test\_concentration\_signal  
test\_capacity\_signal  
test\_positive\_signal  
test\_data\_conflict\_signal  
test\_regression\_signal  
test\_signal\_resolution  
test\_signal\_recurrence  
test\_alert\_deduplication  
test\_critical\_path\_immediate\_alert

25\. Fixtures obligatorios iniciales  
Fixture 1 — Noise  
Input: CAC baseline 40; daily 39, 42, 41, 38, 43\.  
Expected: NO MATERIAL SIGNAL.

Fixture 2 — Persistent deterioration  
Input: CAC 40, 42, 44, 46, 49, 52\.  
Expected: TREND\_SIGNAL; CONFIRMED.

Fixture 3 — Step change  
Input: CVR 2.8, 2.9, 2.8, 1.7, 1.6, 1.6.  
Expected: STEP\_CHANGE.

Fixture 4 — Low sample  
Input: Orders 3 → 1\.  
Expected: LOW\_SAMPLE; NO HIGH\_CONFIDENCE\_SIGNAL.

Fixture 5 — Promotion/context  
Input: Revenue \-30%; previous comparison Black Friday.  
Expected: EXPECTED\_CONTEXTUAL\_CHANGE; no strong alarm.

Fixture 6 — Payment collapse  
Input: Payment success 97% → 60%; duration 20 min; business exposure 90%.  
Expected: CRITICAL SIGNAL; IMMEDIATE.

Fixture 7 — Mix effect  
Input: Global CVR \-15%; all segment CVRs stable; Mobile share \+30%.  
Expected: MIX\_SHIFT\_SIGNAL.

Fixture 8 — Concentration  
Input: Top creative spend share 25% → 75%.  
Expected: CONCENTRATION\_SIGNAL aunque CAC permanezca estable.

Fixture 9 — Recovery  
Input: CAC high for 20 days, then returns to baseline for 7 days.  
Expected: SIGNAL state RESOLVED.

Fixture 10 — Recurring pattern  
Input: support backlog spikes every Monday.  
Expected: RECURRING\_SIGNAL.

Fixture 11 — Positive improvement  
Input: Refund rate 8% → 4%, persistent 30 days.  
Expected: POSITIVE\_SIGNAL.

26\. Definition of Done  
D5 estará correctamente construido cuando el sistema pueda responder de forma reproducible y trazable:  
\- qué métricas han cambiado;  
\- cuánto han cambiado;  
\- desde cuándo;  
\- a qué velocidad;  
\- si el cambio persiste;  
\- si existe muestra suficiente;  
\- si es estadísticamente creíble;  
\- si es empresarialmente relevante;  
\- si es esperado bajo el contexto actual;  
\- si está fuera de su rango histórico o contextual;  
\- si existe ruptura de tendencia o cambio de régimen;  
\- si aumenta volatilidad o concentración;  
\- si ha cambiado el mix;  
\- si se acerca o cruza un guardrail;  
\- si existe un riesgo adelantado;  
\- si la anomalía está localizada;  
\- si las fuentes corroboran o contradicen la señal;  
\- si es business signal o data signal;  
\- si es nueva, persistente, recurrente, resuelta o descartada;  
\- si debe registrarse, vigilarse o alertarse;  
\- qué señales deben agruparse sin convertir esa agrupación en causalidad.

D5 es la capa sensorial del copiloto: detecta cambios relevantes y los entrega estructurados al sistema diagnóstico sin afirmar todavía síntoma, causa final, prioridad ni recomendación.