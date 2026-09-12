D13 — CONTRATO DE DIAGNÓSTICO TEMPORAL Y REGRESIÓN

1\. Propósito operativo

D13 constituye la capa temporal del diagnóstico. Debe determinar cuándo comenzó un fenómeno, cómo ha evolucionado, con qué velocidad y persistencia, si es recurrente o regresivo, si está recuperándose, si existe un cambio de régimen y si la secuencia temporal es compatible con la cadena causal propuesta.

Invariante central:  
STATE ≠ TRAJECTORY.  
El estado actual describe cómo está ahora una capacidad; la trayectoria describe hacia dónde se mueve. El sistema debe permitir combinaciones como BAD \+ IMPROVING o HEALTHY \+ DETERIORATING sin colapsarlas en una única etiqueta.

2\. TRAJECTORY\_STATE

Estados temporales mínimos:  
IMPROVING  
STABLE  
DETERIORATING  
RAPIDLY\_DETERIORATING  
RECOVERING  
VOLATILE  
REGRESSED  
RECURRENT  
NEW\_REGIME  
MIXED  
UNKNOWN

La trayectoria debe evaluarse en una ventana apropiada para la capacidad y nunca inferirse únicamente de dos observaciones sin historia suficiente.

3\. TEMPORAL\_DIAGNOSIS

Objeto mínimo:  
TEMPORAL\_DIAGNOSIS  
target  
current\_state  
trajectory  
onset  
onset\_confidence  
change\_type  
change\_point  
velocity  
acceleration  
persistence  
duration  
recurrence  
regression\_status  
recovery\_status  
regime  
temporal\_scope  
temporal\_evidence  
relevant\_events  
lag\_analysis  
confidence  
limitations

4\. ONSET

El onset debe intentar localizar la FIRST MATERIAL DEVIATION, no el primer movimiento insignificante.

ONSET:  
estimated\_at  
range\_start  
range\_end  
precision  
confidence  
detection\_method  
supporting\_evidence

ONSET\_CONFIDENCE:  
HIGH  
MEDIUM  
LOW  
UNKNOWN

La precisión máxima del onset queda limitada por la granularidad real de los datos. El sistema nunca debe inventar una hora exacta cuando la fuente solo permite precisión diaria u otra granularidad inferior.

FIRST\_OBSERVED no equivale necesariamente a TRUE\_ONSET. En onboarding o backfills debe poder marcarse una condición como:  
PRE\_EXISTING  
LIKELY\_PRE\_EXISTING  
NEW  
UNKNOWN

5\. CHANGE\_TYPE y velocidad

CHANGE\_TYPE:  
ABRUPT  
GRADUAL  
ACCELERATING  
DECELERATING  
CYCLICAL  
INTERMITTENT  
STEP\_CHANGE

VELOCITY:  
VERY\_SLOW  
SLOW  
MODERATE  
FAST  
EXTREME

La velocidad es relativa al dominio/capacidad; no existe una escala temporal universal.

Cada capacidad debe poder disponer de CAPABILITY\_TIME\_PROFILE:  
evaluation\_window  
minimum\_observation\_window  
expected\_lag  
settlement\_delay  
baseline\_horizon  
recurrence\_horizon

6\. Suficiencia temporal y persistencia

TEMPORAL\_SUFFICIENCY:  
SUFFICIENT  
PARTIAL  
INSUFFICIENT

PERSISTENCE:  
TRANSIENT  
EMERGING  
PERSISTENT  
CHRONIC

La ausencia de historia suficiente debe producir UNKNOWN o degradación explícita de confianza, no una trayectoria inventada.

7\. Baseline y gobernanza de régimen

Un problema persistente no puede aprenderse automáticamente como nueva normalidad.

BASELINE\_REGIME\_STATUS:  
ACTIVE  
UNDER\_REVIEW  
FROZEN  
SUPERSEDED

Mientras exista un incidente no resuelto, el baseline puede quedar FROZEN.

Un NEW\_REGIME\_CANDIDATE solo puede considerarse cuando exista evidencia suficiente de:  
sufficient duration  
stable behavior  
business change understood  
no unresolved incident  
data quality high

La promoción de candidato a nuevo régimen no puede ser automática. Debe existir validación contextual. Un baseline antiguo puede quedar SUPERSEDED únicamente cuando el cambio de régimen esté suficientemente soportado.

8\. Regression

Una REGRESSION requiere un estado previo mejor y legítimamente estable. Si nunca existió ese estado mejor, no puede clasificarse como regresión.

REGRESSION\_TYPE:  
PERFORMANCE\_REGRESSION  
TECHNICAL\_REGRESSION  
PROCESS\_REGRESSION  
OPERATIONAL\_REGRESSION  
DATA\_REGRESSION  
MATURITY\_REGRESSION  
BEHAVIORAL\_REGRESSION

REGRESSION:  
type  
previous\_state  
current\_state  
previous\_stable\_period  
regression\_onset  
trigger\_event  
scope  
severity  
recurrence  
supporting\_evidence  
confidence

La regresión de madurez requiere pérdida estructural persistente de capacidad; un deterioro temporal de KPI no es suficiente.

9\. Recovery

RECOVERY\_STATUS:  
NOT\_RECOVERING  
EARLY\_RECOVERY  
PARTIAL\_RECOVERY  
NEAR\_BASELINE  
RECOVERED  
RELAPSED

D13 debe distinguir tres capas independientes:  
CAUSE\_RECOVERY  
SYSTEM\_RECOVERY  
BUSINESS\_IMPACT\_RECOVERY

Root cause resolved ≠ system recovered ≠ business impact recovered.

No debe marcarse RECOVERED por un rebote breve. La recuperación requiere persistencia suficiente según el dominio.

10\. Temporal Causal Fit

D13 consume los lags plausibles definidos por el grafo causal y valida el timing observado.

Por cada relación causal debe poder registrar:  
cause\_time  
effect\_time  
observed\_lag  
expected\_lag  
lag\_fit

LAG\_FIT:  
STRONG  
ACCEPTABLE  
WEAK  
INCOMPATIBLE  
UNKNOWN

La causa debe preceder al efecto. Debe utilizarse EVENT\_TIME cuando sea posible y no INGESTION\_TIME si ambos difieren. Los eventos tardíos no pueden alterar silenciosamente el orden causal.

Un lag INCOMPATIBLE debe debilitar o invalidar la relación causal correspondiente.

11\. DIAGNOSTIC\_TIMELINE y cadena temporal

DIAGNOSTIC\_TIMELINE puede contener:  
business events  
metric changes  
signals  
symptoms  
hypotheses  
root-cause events  
data-quality events  
recoveries

TEMPORAL\_CAUSAL\_CHAIN:  
root\_event  
intermediate\_events  
symptom\_onset  
outcome\_onset  
observed\_lags  
expected\_lags  
temporal\_fit

D13 debe comprobar si los efectos aparecen en el orden esperado y distinguir root-cause onset, symptom onset y outcome onset.

12\. Recurrence

RECURRENCE\_STATUS:  
FIRST\_OCCURRENCE  
SECOND\_OCCURRENCE  
RECURRING  
SYSTEMATIC

El mismo síntoma recurrente no implica automáticamente la misma causa raíz recurrente.

RECURRENCE\_PATTERN:  
count  
frequency  
common\_trigger  
common\_scope  
average\_duration  
average\_recovery  
shared\_root\_cause

La recurrencia debe poder clasificarse como:  
EXPECTED\_RECURRENCE  
PATHOLOGICAL\_RECURRENCE

13\. DIAGNOSTIC\_EPISODE

Cada ocurrencia histórica puede persistirse como:  
DIAGNOSTIC\_EPISODE  
episode\_id  
diagnosis\_type  
start  
peak  
end  
root\_cause  
severity  
recovery\_time  
outcome

El historial de episodios debe permitir comparar recurrencias sin convertir por sí solo la similitud histórica en prueba causal.

14\. KPIs temporales operativos

D13 debe poder registrar:  
TIME\_TO\_DETECTION \= actual onset → system detection  
TIME\_TO\_DIAGNOSIS \= detection → sufficiently supported explanation  
TIME\_TO\_RESOLUTION \= confirmed diagnosis → root cause resolution  
TIME\_TO\_RECOVERY \= incident onset → business state recovery

Alias operativos:  
TTD \= Time to Detect  
TTDiag \= Time to Diagnose  
TTR \= Time to Resolve  
TTRec \= Time to Recover

ONSET y DETECTED\_AT deben mantenerse separados.

15\. Health transitions e hysteresis

HEALTH\_TRANSITION:  
capability  
from\_state  
to\_state  
transition\_at  
reason  
confidence

El runtime debe aplicar hysteresis para evitar state flapping. La entrada en un estado degradado y la salida pueden requerir condiciones distintas.

STATE\_STABILIZATION:  
minimum\_persistence  
recovery\_persistence  
critical\_override

Una capacidad debe permanecer en RECOVERING hasta demostrar estabilidad suficiente. Un evento crítico puede activar critical\_override y cambiar el estado inmediatamente sin esperar la ventana normal de hysteresis.

16\. Temporal Noise Filtering

Clasificación mínima:  
NOISE  
SHORT\_LIVED\_SPIKE  
MATERIAL\_EPISODE  
STRUCTURAL\_TREND

El motor debe utilizar historia suficiente y, cuando proceda, métodos robustos de extracción de tendencia. Una variación aislada no puede convertirse automáticamente en tendencia.

TREND\_CONFIDENCE:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT

17\. Lifecycle de root cause y constraint

ROOT\_CAUSE\_STATUS puede incluir:  
ACTIVE  
RESOLVED  
RECURRENT

ROOT\_CAUSE\_LIFECYCLE:  
EMERGED  
ACTIVE  
PEAKED  
MITIGATED  
RESOLVED  
RECURRENT

CONSTRAINT\_LIFECYCLE:  
LATENT  
EMERGING  
BINDING  
EASING  
REMOVED  
SHIFTED

Los constraints no son permanentes por definición. D13 debe registrar constraint shifts y no tratarlos automáticamente como problemas independientes.

18\. Maturity temporal

MATURITY\_TRAJECTORY:  
ADVANCING  
STABLE  
STAGNATING  
REGRESSING  
UNKNOWN

Puede registrarse:  
HISTORICAL\_PEAK\_STAGE  
CURRENT\_EFFECTIVE\_STAGE

El avance de madurez requiere cambio estructural persistente; la regresión de madurez requiere pérdida persistente de capacidad.

19\. Scope y multi-horizon

TEMPORAL\_SCOPE puede ser:  
global  
channel  
market  
product  
device  
cohort

Una trayectoria localizada nunca debe generalizarse silenciosamente al negocio completo. Si existen direcciones opuestas entre segmentos, el agregado puede expresarse como MIXED conservando las trayectorias locales.

Cuando sea útil deben mantenerse por separado:  
SHORT\_TERM\_TRAJECTORY  
MEDIUM\_TERM\_TRAJECTORY  
LONG\_TERM\_TRAJECTORY

Los conflictos entre horizontes son válidos y deben preservarse; el sistema no debe forzar una única historia temporal.

TEMPORAL\_COMPARISON\_TYPE:  
PREVIOUS\_PERIOD  
ROLLING  
YOY  
PRE\_EVENT  
POST\_EVENT  
HISTORICAL\_NORMAL  
REGIME\_BASELINE

No se puede seleccionar arbitrariamente el timeframe que mejor apoye la hipótesis preferida.

TREND\_ROBUSTNESS:  
HIGH  
MEDIUM  
LOW

20\. EVENT\_RESPONSE y eventos confusos

EVENT\_RESPONSE:  
event\_id  
affected\_metric  
pre\_event\_state  
post\_event\_state  
lag  
persistence  
recovery  
confidence

La proximidad temporal de un evento solo crea evidencia/candidatura, no causalidad automática.

Cuando múltiples eventos relevantes comiencen en una ventana que impida atribución única, D13 debe señalar:  
TEMPORALLY\_CONFOUNDED\_EVENTS

y derivar la ambigüedad causal a D8/D12.

21\. Confidence temporal

D13 debe mantener confianza a nivel de claim temporal:  
onset\_confidence  
trajectory\_confidence  
regression\_confidence  
recovery\_confidence  
lag\_confidence

No debe existir una única confianza que oculte diferencias entre estas afirmaciones.

HISTORY\_COVERAGE:  
SHORT  
MODERATE  
DEEP

HISTORY\_QUALITY:  
HIGH  
MEDIUM  
LOW

History quality debe considerar al menos:  
data continuity  
metric definitions  
business regime

Más historia no implica automáticamente mejor evidencia si pertenece a un régimen no comparable.

22\. TEMPORAL\_SNAPSHOT, reproducibilidad y revisiones

Los snapshots temporales deben versionarse, especialmente cuando existe backfill.

TEMPORAL\_SNAPSHOT:  
snapshot\_id  
diagnostic\_id  
as\_of  
history\_window  
trajectory  
onset  
regression  
recovery  
recurrence  
baseline\_version  
data\_snapshot  
model\_version

Debe poder reconstruirse por qué en un momento concreto el sistema clasificó una trayectoria de una determinada manera, incluso si posteriormente llegaron datos tardíos.

Una nueva evaluación debe registrarse como REVISED\_TEMPORAL\_ASSESSMENT, no reescribir silenciosamente la historia.

REVISION\_REASON puede incluir:  
late data  
baseline correction  
event discovery  
metric-definition correction

El audit trail debe conservar al menos:  
previous trajectory  
new trajectory  
why changed

23\. Raw vs context-adjusted trajectory

D13 debe consumir las series corregidas/ajustadas por D12 cuando existan confusores temporales materiales.

Debe conservar por separado:  
RAW\_TRAJECTORY  
CONTEXT\_ADJUSTED\_TRAJECTORY

La trayectoria ajustada debe dirigir el diagnóstico, manteniendo visible la trayectoria raw para trazabilidad.

24\. Impacto acumulado y peak

D13 puede aportar a D10 la evolución temporal de:  
cumulative revenue loss  
cumulative contribution loss  
customers affected  
backlog accumulation

D10 mantiene la lógica de impacto; D13 mantiene su dimensión temporal.

PEAK\_DEGRADATION debe poder registrar:  
timestamp  
worst\_state  
worst\_value  
severity

25\. Temporal events y deduplicación

D13 puede emitir cambios de estado tales como:  
NEW\_DETERIORATION  
ACCELERATION  
REGRESSION  
RECURRENCE  
RECOVERY\_STARTED  
RECOVERED  
RELAPSE  
REGIME\_SHIFT

La notificación pertenece a otras capas; D13 solo emite el evento temporal.

No debe generar repetidamente “still deteriorating” en cada evaluación. Debe emitir únicamente transiciones temporales materiales y deduplicadas.

26\. Temporal State Machine

Modelo conceptual base:  
NORMAL  
→ EMERGING\_DETERIORATION  
→ DETERIORATING  
→ SEVERE  
→ RECOVERING  
→ RECOVERED

Con posible:  
RELAPSE

Esta secuencia no es universal. El runtime debe permitir state machines adecuadas al tipo de caso y no forzar todos los episodios a recorrer exactamente los mismos estados.

27\. Historial de entidades diagnósticas

El sistema debe conservar temporalidad de los componentes del diagnóstico.

SYMPTOM\_HISTORY:  
first\_detected  
confirmed\_at  
peak  
resolved\_at

HYPOTHESIS\_HISTORY:  
when hypothesis emerged  
when support increased  
when rejected

ROOT\_CAUSE\_HISTORY:  
when probable  
when supported  
when resolved

CONFIDENCE\_HISTORY:  
how confidence changed over time

También puede registrar para evaluación posterior:  
MISSED\_EARLY\_WARNING  
FALSE\_WARNING

28\. Temporal Root Cause Validation

Antes de D14, D13 debe comprobar:  
Did proposed cause exist before effect?  
Did intermediate nodes change in expected order?  
Is lag plausible?  
Does recovery follow expected reverse sequence?  
Has same chain appeared before?

Reverse Recovery Test:  
CAUSE REMOVED  
→ EFFECT SHOULD IMPROVE  
si el resto de condiciones relevantes permanece estable.

Si una causa supuestamente resuelta no produce la recuperación esperada, el diagnóstico debe poder reabrirse:  
REOPENED

Case closure no debe producirse únicamente porque se haya modificado/resuelto la causa. Debe existir outcome verification según el caso.

RESOLUTION ≠ RECOVERY.

29\. Temporal completeness

TEMPORAL\_COMPLETENESS:  
FULL\_HISTORY  
PARTIAL\_HISTORY  
RECENT\_ONLY  
UNKNOWN

Los gaps históricos materiales deben aparecer como limitaciones explícitas. No se deben interpolar silenciosamente eventos causalmente importantes.

30\. TEMPORAL\_RESULT

Salida contractual de D13:  
TEMPORAL\_RESULT  
target  
current\_state  
short\_term\_trajectory  
medium\_term\_trajectory  
long\_term\_trajectory  
onset  
change\_point  
change\_type  
velocity  
acceleration  
persistence  
duration  
peak  
regression\_status  
recurrence\_status  
recovery\_status  
root\_cause\_lifecycle  
constraint\_lifecycle  
relevant\_events  
lag\_analysis  
regime\_status  
baseline\_status  
temporal\_confidence  
history\_quality  
temporal\_gaps  
limitations

D14 debe poder consumir esta salida para mostrar WHAT, WHY, WHEN IT STARTED, HOW IT EVOLVED, WHERE IT PEAKED, WHETHER IT IS RECOVERING y WHETHER IT HAS HAPPENED BEFORE.

31\. Runtime Responsibility

El runtime debe gestionar principalmente:  
time series  
change points  
trend slopes  
persistence  
onset  
event alignment  
lag calculations  
recurrence matching  
health transitions  
baseline versions  
temporal snapshots

Arquitectura:  
CANONICAL TIME SERIES  
\+ CONTEXT EVENTS  
\+ HISTORICAL SNAPSHOTS  
→ TEMPORAL ENGINE  
→ Trend / Change Point / Onset / Persistence / Regression / Recurrence / Recovery / Regime  
→ TEMPORAL\_RESULT

32\. LLM Responsibility

El LLM puede:  
interpret temporal patterns  
explain timeline  
distinguish plausible regression  
synthesize multi-horizon states  
describe recovery  
identify meaningful recurrence

El LLM no debe inventar temporalidad ausente ni sustituir cálculos deterministas de timestamps, periodos, lags, change points, historia disponible o event alignment cuando estos puedan resolverse desde datos estructurados.

33\. Tests mínimos

test\_state\_vs\_trajectory  
test\_bad\_but\_improving  
test\_healthy\_but\_deteriorating  
test\_abrupt\_change\_point  
test\_gradual\_deterioration  
test\_accelerating\_deterioration  
test\_transient\_noise  
test\_chronic\_condition  
test\_regression\_requires\_previous\_health  
test\_technical\_regression  
test\_maturity\_regression\_not\_kpi\_decline  
test\_recurrence\_same\_symptom\_different\_cause  
test\_recurrent\_root\_cause  
test\_recovery\_not\_resolved  
test\_root\_resolved\_impact\_not\_recovered  
test\_lag\_mismatch\_invalidates  
test\_temporal\_precedence  
test\_new\_regime  
test\_baseline\_not\_adapted\_to\_broken\_state  
test\_constraint\_shift  
test\_multi\_horizon\_conflict  
test\_partial\_history\_returns\_unknown

Fixtures mínimos:  
\- Bad but improving: estado BAD y trayectoria IMPROVING.  
\- Healthy but deteriorating: estado HEALTHY y trayectoria DETERIORATING.  
\- Abrupt: cambio estable seguido de STEP\_CHANGE/ABRUPT.  
\- Gradual: deterioro progresivo sostenido.  
\- Noise: variación dentro del rango histórico debe quedar STABLE.  
\- Regression: fallo previamente corregido reaparece después de un deployment.  
\- Not Regression: debilidad histórica continua debe ser CHRONIC\_WEAKNESS, no REGRESSION.  
\- Maturity: un mal mes no es maturity regression; pérdida estructural de capacidad sí puede serlo.  
\- Recurrence Different Causes: mismo síntoma CAC en episodios con causas diferentes no implica recurrent root cause.  
\- Recovery: aproximación parcial al baseline debe ser RECOVERING, no RECOVERED.  
\- Root Resolved / Impact Active: root cause y sistema pueden estar recuperados mientras el impacto acumulado no lo está.  
\- Lag Mismatch: una causa reciente no puede explicar un outcome cuyo horizonte causal es incompatible.  
\- New Regime: cambio contextual seguido de estado estable durante meses puede ser NEW\_REGIME\_CANDIDATE/SUPPORTED tras checks.  
\- Broken Baseline: no normalizar un estado roto mientras el incidente continúe abierto.  
\- Multi-Horizon: deterioro corto y mejora larga deben coexistir, no fusionarse en una única tendencia.  
\- Constraint Shift: al eliminarse un constraint puede aparecer otro binding constraint.

34\. Invariantes

El sistema nunca debe:  
\- confundir estado actual con trayectoria;  
\- confundir un valor malo con deterioro;  
\- confundir un valor bueno con mejora;  
\- inferir tendencia desde dos observaciones sin contexto suficiente;  
\- utilizar la misma ventana temporal para todas las capacidades;  
\- declarar regresión si nunca existió un estado mejor previo;  
\- confundir deterioro de KPIs con regresión de madurez;  
\- confundir root cause resuelta con recuperación completa;  
\- confundir recuperación parcial con recuperación final;  
\- confundir recurrencia de síntoma con recurrencia de causa;  
\- adaptar el baseline a un sistema roto sin validación;  
\- tratar post-promo normalization como regresión automáticamente;  
\- ignorar seasonality o lags causales;  
\- aceptar una causa que ocurre después del efecto;  
\- utilizar ingestion time como event time cuando no sean equivalentes;  
\- confundir nueva normalidad con incidente persistente;  
\- ignorar cambios de régimen;  
\- generalizar una tendencia localizada al negocio completo;  
\- ocultar trayectorias opuestas entre segmentos;  
\- ocultar conflictos entre horizontes temporales;  
\- confundir un rebote breve con recuperación estable;  
\- ignorar hysteresis y provocar state flapping;  
\- ignorar historia previa del problema;  
\- asumir que el primer día observado es el verdadero onset;  
\- inventar onset exacto con datos de baja granularidad;  
\- reescribir silenciosamente evaluaciones históricas tras backfill;  
\- considerar un constraint permanente;  
\- confundir constraint shift con un problema independiente;  
\- recomendar acciones o decidir prioridades dentro de D13.

35\. Definition of Done

D13 está correctamente construido cuando puede responder de forma trazable:  
¿Cuándo comenzó realmente el problema?  
¿Con qué precisión conocemos el onset?  
¿Fue abrupto o gradual?  
¿Está acelerándose?  
¿Está empeorando, estable, mejorando o recuperándose?  
¿Ha alcanzado un peak?  
¿Cuánto tiempo lleva activo?  
¿Es transitorio, persistente o crónico?  
¿Había ocurrido antes?  
¿Es recurrente y es la misma causa que en episodios anteriores?  
¿Es una regresión de algo que antes funcionaba?  
¿Es regresión operativa o de madurez?  
¿La causa precede temporalmente al efecto?  
¿Los lags son compatibles?  
¿La secuencia de efectos coincide con la cadena causal?  
¿La desaparición de la causa produce recuperación coherente?  
¿Ha cambiado el constraint?  
¿Estamos ante un nuevo régimen?  
¿Debe cambiar el baseline?  
¿La evolución corta, media y larga cuentan la misma historia?  
¿Existe historia suficiente para sostener las afirmaciones anteriores?

Principio de cierre: D13 transforma la fotografía diagnóstica en la película completa del problema, sin introducir priorización ni recomendaciones.  
