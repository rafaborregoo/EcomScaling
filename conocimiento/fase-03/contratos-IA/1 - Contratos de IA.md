FASE 3 — SISTEMA DE DIAGNÓSTICO  
D0 — CONTRATO DE DIAGNÓSTICO

0\. Propósito de D0  
El Contrato de Diagnóstico define cómo debe pensar, estructurar y comunicar un diagnóstico el sistema.  
No determina todavía:  
qué métricas son buenas o malas;  
qué acción debe ejecutarse;  
qué estrategia debe utilizarse;  
qué problema debe priorizarse;  
qué playbook debe activarse.  
Todo eso pertenece a fases posteriores.  
D0 establece algo anterior:  
qué información puede entrar en un diagnóstico, qué proceso lógico debe respetarse y qué tipo de conclusión está permitido devolver.  
Su función es impedir que el copiloto salte directamente desde:  
métrica → recomendación  
cuando el proceso correcto debe ser:  
datos → contexto → señales → síntomas → hipótesis → contraste → causa → diagnóstico

1\. Principio fundamental  
Un diagnóstico no es una opinión.  
Tampoco es una recomendación.  
Tampoco es una observación aislada.  
Un diagnóstico debe ser una conclusión apoyada en evidencia suficiente acerca del estado, causa o mecanismo que está produciendo un determinado comportamiento empresarial.  
Por tanto:  
Toda afirmación diagnóstica debe poder reconstruirse hacia atrás hasta los datos que la originaron.  
Ejemplo incorrecto:  
“Tus creatividades están fatigadas.”  
No sabemos:  
qué datos lo indican;  
durante qué periodo;  
en qué campañas;  
frente a qué baseline;  
qué otras explicaciones existían;  
qué evidencia fue descartada;  
qué confianza tiene la conclusión.  
Ejemplo correcto:  
“Existe evidencia moderada de deterioro creativo en adquisición de pago. Durante los últimos 14 días el CTR outbound cayó un 21 %, el CPC aumentó un 18 % y el CPM permaneció prácticamente estable. La conversión post-click no presenta una degradación equivalente, lo que concentra el deterioro antes de la visita a tienda. La hipótesis de fatiga creativa tiene confianza MEDIA y debe distinguirse de posibles cambios en audience mix.”  
Esto ya constituye razonamiento diagnóstico.

2\. Separación obligatoria de responsabilidades  
El sistema debe mantener separadas las siguientes capas:  
Capa — Pregunta  
Dato — ¿Qué ocurrió objetivamente?  
Contexto — ¿En qué condiciones ocurrió?  
Señal — ¿Qué variable cambió de forma relevante?  
Síntoma — ¿Qué patrón empresarial aparece?  
Hipótesis — ¿Qué podría explicar ese patrón?  
Evidencia — ¿Qué apoya o contradice cada hipótesis?  
Causa — ¿Qué mecanismo está produciendo el problema?  
Constraint — ¿Qué limita actualmente el sistema?  
Severidad — ¿Cuánto daño produce?  
Confianza — ¿Cuánto sabemos realmente?  
Diagnóstico — ¿Qué podemos afirmar?  
Prioridad — ¿Qué deberíamos abordar primero?  
Acción — ¿Qué deberíamos hacer?  
D0 termina en Diagnóstico.  
Las dos últimas capas quedan fuera:  
Prioridad → Fase 4  
Acción → Fase 5+  
Esta separación es fundamental para evitar razonamientos circulares.

3\. Objetivo operativo  
Ante cualquier consulta del usuario, evento automático o anomalía detectada, el sistema debe poder construir una unidad denominada:  
DIAGNOSTIC\_CASE  
Un DIAGNOSTIC\_CASE representa una investigación empresarial concreta.  
Ejemplos:  
Revenue ha caído un 24 %.  
Meta Ads está perdiendo eficiencia.  
Estamos vendiendo mucho pero no tenemos caja.  
El producto principal empieza a quedarse sin stock.  
Ha aumentado muchísimo el CAC.  
La conversión móvil ha caído.  
Klaviyo está generando menos revenue.  
Estamos escalando inversión pero el beneficio no crece.  
Cada situación debe convertirse en un caso diagnóstico estructurado.

4\. Contrato lógico de entrada  
Todo diagnóstico debe disponer de una estructura de entrada común.  
DIAGNOSTIC\_INPUT  
diagnostic\_input  
business\_context  
time\_context  
maturity\_context  
data\_sources  
metrics  
dimensions  
events  
known\_changes  
user\_observations  
previous\_diagnostics  
data\_quality  
requested\_scope  
Cada bloque cumple una función diferente.

5\. BUSINESS\_CONTEXT  
Describe el ecommerce que se está diagnosticando.  
Debe contener, cuando esté disponible:  
business\_id  
brand  
business\_model  
vertical  
primary\_markets  
currency  
sales\_channels  
acquisition\_channels  
product\_model  
catalog\_size  
hero\_products  
price\_positioning  
average\_order\_value  
customer\_type  
gross\_margin\_profile  
fulfillment\_model  
current\_scale  
No todos estos campos serán obligatorios.  
Pero cuanto más contexto existe, mejor puede interpretarse una misma métrica.  
Un CAC de 80 € puede ser:  
DISASTER  
para un producto de 45 €.  
Y perfectamente sostenible para un producto de 600 € con fuerte margen y recurrencia.  
Por eso:  
las métricas nunca se interpretarán completamente fuera de su contexto económico.

6\. TIME\_CONTEXT  
Todo diagnóstico debe estar anclado temporalmente.  
Campos conceptuales:  
analysis\_period  
comparison\_period  
timezone  
aggregation  
business\_calendar  
seasonality\_context  
promotion\_period  
launch\_period  
special\_events  
Ejemplo:  
analysis\_period:  
01/09 → 07/09  
comparison\_period:  
25/08 → 31/08  
aggregation:  
daily  
special\_context:  
summer\_sale  
Comparar periodos incorrectos puede generar un diagnóstico completamente falso.

7\. DATA\_SOURCES  
El motor debe conocer de dónde proviene cada dato.  
Ejemplos de fuentes:  
Shopify  
Meta Ads  
Google Ads  
Google Analytics  
Klaviyo  
TikTok Ads  
Stripe  
Recharge  
ERP  
WMS  
Gorgias  
Search Console  
Finance system  
custom database  
manual user input  
Cada fuente debe incluir cuando sea posible:  
source  
connection\_status  
last\_sync  
coverage  
granularity  
reliability  
known\_issues  
La procedencia del dato forma parte de la evidencia.

8\. OBSERVATION  
La unidad mínima del sistema diagnóstico será una observación.  
Ejemplo:  
OBSERVATION  
metric:  
conversion\_rate  
value:  
2.11%  
previous\_value:  
2.89%  
change:  
\-26.99%  
period:  
last\_14\_days  
segment:  
mobile  
source:  
Shopify  
reliability:  
HIGH  
Una observación todavía no constituye una señal ni un diagnóstico.  
Es simplemente un hecho medido.

9\. SIGNAL  
Una señal aparece cuando una observación adquiere relevancia empresarial.  
Ejemplo:  
SIGNAL  
type:  
conversion\_decline  
metric:  
mobile\_conversion\_rate  
direction:  
DOWN  
magnitude:  
\-27%  
persistence:  
11\_days  
scope:  
mobile  
statistical\_relevance:  
MEDIUM  
business\_relevance:  
HIGH  
El motor debe distinguir:  
variación  
de:  
señal  
No toda variación merece investigación.

10\. SYMPTOM  
Un síntoma es una interpretación empresarial producida por una o varias señales relacionadas.  
Ejemplo:  
CTR ↓  
CPC ↑  
CPM →  
CVR →  
puede generar:  
SYMPTOM  
possible\_creative\_efficiency\_deterioration  
Otro ejemplo:  
Traffic →  
PDP views →  
ATC →  
Checkout →  
Payment success ↓↓↓  
produce:  
SYMPTOM  
checkout\_payment\_failure  
El síntoma describe qué patrón parece estar ocurriendo, pero todavía no afirma la causa.

11\. HYPOTHESIS  
Ante cada síntoma deben generarse múltiples explicaciones posibles.  
Nunca se permitirá:  
Síntoma → única explicación automática  
Ejemplo:  
Síntoma  
CAC \+34%  
Hipótesis posibles  
H1 Creative fatigue  
H2 Audience saturation  
H3 CPM inflation  
H4 Conversion deterioration  
H5 Offer deterioration  
H6 Traffic mix shift  
H7 Tracking distortion  
H8 Attribution change  
H9 Promotional baseline distortion  
H10 Product availability issue  
El objetivo del motor será reducir progresivamente este espacio de hipótesis.

12\. Evidencia a favor y en contra  
Toda hipótesis debe poder contener:  
supporting\_evidence  
contradicting\_evidence  
missing\_evidence  
Ejemplo:  
HYPOTHESIS  
Creative fatigue  
SUPPORTING  
CTR:  
\-24%  
Thumbstop rate:  
\-18%  
Creative frequency:  
\+31%  
CPM:  
stable  
CONTRADICTING  
CVR:  
stable  
Audience size:  
stable  
MISSING  
creative-level historical performance  
hook-level performance  
creative launch dates  
Este sistema es extremadamente importante para evitar confirmación sesgada.

13\. UNKNOWN  
El motor debe representar explícitamente lo que desconoce.  
Nunca debe rellenar información mediante imaginación.  
Estados posibles:  
KNOWN  
UNKNOWN  
UNAVAILABLE  
UNRELIABLE  
NOT\_APPLICABLE  
Ejemplo:  
Meta CTR:  
KNOWN  
Creative production volume:  
UNKNOWN  
TikTok Ads:  
NOT\_APPLICABLE  
Google Analytics:  
UNRELIABLE  
Contribution margin:  
UNAVAILABLE  
UNKNOWN es información diagnóstica.  
No es un error.

14\. DATA GAP  
Cuando una hipótesis no pueda confirmarse por falta de información, debe generarse un DATA\_GAP.  
Ejemplo:  
DATA\_GAP  
required\_data:  
payment\_gateway\_failure\_rate  
reason:  
Needed to distinguish checkout UX deterioration  
from payment provider failure.  
impact\_on\_diagnosis:  
HIGH  
affected\_hypothesis:  
H3\_payment\_failure  
Esto permitirá posteriormente que el copiloto diga:  
“Con los datos actuales puedo localizar el deterioro en checkout, pero no distinguir con suficiente confianza entre fricción UX y errores del proveedor de pago.”  
Eso es mucho más valioso que inventar una explicación.

15\. DIAGNOSTIC\_SCOPE  
El sistema debe conocer qué está investigando.  
Ejemplos:  
BUSINESS\_GLOBAL  
ACQUISITION  
META\_ADS  
GOOGLE\_ADS  
CREATIVE  
CONVERSION  
PRODUCT  
OFFER  
RETENTION  
EMAIL  
INVENTORY  
OPERATIONS  
FINANCE  
DATA  
TECHNOLOGY  
TEAM  
STRATEGY  
También puede existir un scope más específico:  
channel:  
META  
campaign:  
ASC\_EUROPE  
device:  
MOBILE  
market:  
SPAIN  
product:  
HERO\_SKU\_01  
Esto evita conclusiones excesivamente generales.  
Un problema en Meta España Mobile no debe convertirse automáticamente en:  
“Tu adquisición está rota.”

16\. Granularidad del diagnóstico  
El diagnóstico debe poder existir en varios niveles.  
L0 BUSINESS  
L1 CAPABILITY  
L2 CHANNEL  
L3 FUNNEL  
L4 CAMPAIGN / PRODUCT / MARKET  
L5 METRIC  
L6 EVENT  
Ejemplo:  
L0  
Business revenue deteriorating  
L1  
Acquisition deteriorating  
L2  
Meta Ads deteriorating  
L3  
Pre-click efficiency deteriorating  
L4  
Prospecting campaigns affected  
L5  
CTR declining  
L6  
Decline begins after creative rotation stops  
Cuanto más profundo se llega, más localizada puede quedar la causa.

17\. DIAGNOSTIC\_TARGET  
Cada investigación necesita definir claramente el fenómeno que intenta explicar.  
Ejemplo:  
TARGET  
metric:  
Revenue  
change:  
\-18%  
period:  
14\_days  
scope:  
Business  
question:  
What is causing the decline in revenue?  
Otro ejemplo:  
TARGET  
metric:  
Contribution margin  
change:  
\-31%  
revenue:  
\+12%  
question:  
Why is profitability falling while revenue grows?  
Esto evita investigaciones sin objetivo.

18\. CAUSAL\_CHAIN  
Cuando exista suficiente evidencia, el diagnóstico debe reconstruir la cadena causal.  
Ejemplo:  
Creative refresh rate ↓  
        ↓  
Creative fatigue ↑  
        ↓  
CTR ↓  
        ↓  
CPC ↑  
        ↓  
CAC ↑  
        ↓  
Contribution margin ↓  
Otro:  
Hero SKU stockout  
        ↓  
High-intent PDP availability ↓  
        ↓  
Conversion ↓  
        ↓  
Revenue ↓  
Otro:  
Discount depth ↑  
        ↓  
Gross margin ↓  
        ↓  
Contribution margin ↓  
        ↓  
Cash generation ↓  
La cadena causal debe diferenciar correlación de causalidad probable.

19\. ROOT CAUSE  
El motor debe distinguir cuatro conceptos.  
Concepto — Significado  
Signal — Una variable relevante ha cambiado  
Symptom — Varias señales forman un patrón  
Intermediate Cause — Explica parte del deterioro  
Root Cause — Origen más profundo respaldado por evidencia  
Ejemplo:  
Revenue ↓  
no es causa.  
CVR ↓  
tampoco necesariamente.  
Checkout completion ↓  
puede ser causa intermedia.  
Payment provider failure after deployment  
puede constituir root cause.

20\. CONSTRAINT  
El constraint no es exactamente igual a root cause.  
La root cause explica:  
¿Por qué está ocurriendo el problema?  
El constraint explica:  
¿Qué parte del sistema limita actualmente el rendimiento?  
Ejemplo:  
Root cause:  
creative fatigue  
Constraint:  
acquisition efficiency  
Otro:  
Root cause:  
hero SKU stockout  
Constraint:  
inventory availability  
Otro:  
Root cause:  
poor offer-market fit  
Constraint:  
offer  
Un negocio puede contener numerosos problemas pero normalmente sólo unos pocos constraints realmente limitantes.  
La identificación del constraint se utilizará posteriormente en la Fase 4\.

21\. CURRENT\_STATE frente a ROOT\_CAUSE  
El sistema debe distinguir:  
CURRENT\_STATE  
de:  
ROOT\_CAUSE  
Ejemplo:  
CURRENT\_STATE:  
CAC critical  
ROOT\_CAUSE:  
conversion decline  
UNDERLYING DRIVER:  
mobile PDP regression after theme deployment  
Sin esta separación, el copiloto puede recomendar atacar CAC cuando el verdadero problema está dentro del sitio web.

22\. BUSINESS AREA  
Todo diagnóstico debe conectarse con la arquitectura funcional construida en Fase 1\.  
Ejemplo conceptual:  
affected\_capabilities:  
Acquisition  
Creative  
Conversion  
Product  
Offer  
Retention  
Inventory  
Operations  
Finance  
Data  
Technology  
Team  
Strategy  
Esto permite relacionar:  
Fase 1 → Fase 2 → Fase 3  
La IA conoce:  
qué órgano está analizando;  
qué nivel de madurez tiene;  
qué problema está sufriendo actualmente.

23\. MATURITY\_CONTEXT  
El diagnóstico debe conocer la etapa de madurez detectada en Fase 2\.  
Ejemplo:  
BUSINESS\_STAGE:  
E5  
CAPABILITY\_STAGE:  
Acquisition:  
E6  
Creative:  
E4  
Conversion:  
E5  
Retention:  
E2  
Finance:  
E3  
Esto es importante porque una tienda puede tener madurez desigual.  
No debe imponerse una única etapa global a todos los sistemas.

24\. Diagnóstico relativo a la madurez  
Una misma observación puede tener una interpretación diferente dependiendo de la etapa.  
Ejemplo:  
Una empresa temprana con:  
forecast\_accuracy:  
LOW  
puede simplemente no haber desarrollado todavía capacidades avanzadas de forecasting.  
Una empresa madura con:  
Revenue:  
€40M  
Markets:  
8  
Inventory:  
complex  
forecast\_accuracy:  
LOW  
puede tener un riesgo operacional crítico.  
Por tanto:  
La gravedad de una carencia depende también de la capacidad que razonablemente debería existir en esa etapa.

25\. DIAGNOSTIC\_STATUS  
Todo caso debe tener un estado.  
OPEN  
INVESTIGATING  
PARTIALLY\_CONFIRMED  
CONFIRMED  
INCONCLUSIVE  
INSUFFICIENT\_DATA  
INVALIDATED  
Esto permite que un diagnóstico evolucione.  
Ejemplo:  
Day 1:  
INVESTIGATING  
Day 3:  
PARTIALLY\_CONFIRMED  
Day 5:  
CONFIRMED  
El diagnóstico no tiene por qué ser una respuesta estática.

26\. CONFIDENCE  
Cada conclusión debe incluir nivel de confianza.  
Estados principales:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT\_DATA  
HIGH  
Existe evidencia consistente procedente de múltiples señales y pocas explicaciones alternativas plausibles.  
MEDIUM  
La hipótesis está razonablemente respaldada pero existen explicaciones alternativas o datos relevantes todavía ausentes.  
LOW  
Existen indicios pero la evidencia es limitada o ambigua.  
INSUFFICIENT\_DATA  
No existe información suficiente para formular una conclusión responsable.  
La confianza nunca debe utilizarse como decoración.  
Debe derivarse de:  
data reliability  
evidence quantity  
evidence consistency  
hypothesis discrimination  
causal coherence  
confounder exposure  
missing data  
sample size

27\. SEVERITY  
La severidad representa el daño empresarial.  
Escala:  
INFO  
LOW  
MODERATE  
HIGH  
CRITICAL  
BUSINESS\_THREAT  
Debe considerar:  
Revenue impact  
Contribution impact  
Cash impact  
Customer impact  
Operational impact  
Strategic impact  
Duration  
Propagation risk  
Reversibility  
Un problema pequeño pero que se propaga rápidamente puede tener severidad alta.

28\. IMPACT\_SCOPE  
No todos los problemas afectan al negocio completo.  
Ejemplo:  
impact\_scope  
market:  
Spain  
channel:  
Meta  
device:  
Mobile  
customer:  
New customers  
product:  
Hero SKU  
revenue\_share\_affected:  
31%  
Esto permite evitar alarmismo.

29\. TEMPORAL\_STATE  
Todo diagnóstico debe incluir trayectoria.  
Estados:  
IMPROVING  
STABLE  
DETERIORATING  
RAPIDLY\_DETERIORATING  
RECOVERING  
VOLATILE  
UNKNOWN  
Ejemplo:  
severity:  
MODERATE  
trajectory:  
RAPIDLY\_DETERIORATING  
puede ser más peligroso que:  
severity:  
HIGH  
trajectory:  
RECOVERING

30\. ONSET  
El sistema debe intentar localizar cuándo empezó el problema.  
detected\_onset:  
2026-09-03 14:00  
confidence:  
HIGH  
Esto permite correlacionarlo posteriormente con:  
theme deployments  
pricing changes  
campaign launches  
creative rotations  
tracking modifications  
stockouts  
promotion start/end  
payment changes  
shipping changes  
market events  
El tiempo constituye una herramienta causal fundamental.

31\. CHANGE\_EVENTS  
El contrato debe permitir registrar eventos empresariales.  
Ejemplo:  
CHANGE\_EVENT  
timestamp:  
2026-09-03 12:40  
type:  
technology\_deployment  
component:  
checkout  
description:  
Payment configuration updated  
Si posteriormente:  
payment success ↓  
empieza inmediatamente después, existe evidencia causal relevante.

32\. EVIDENCE  
Cada conclusión importante debe conservar referencias a evidencia.  
Conceptualmente:  
evidence\_id  
source  
metric  
period  
segment  
observation  
reliability  
supports  
contradicts  
Ejemplo:  
EV-0042  
source:  
Shopify  
metric:  
checkout\_payment\_success  
observation:  
\-21.4%  
period:  
7d  
supports:  
H3\_payment\_failure

33\. EVIDENCE LEDGER  
El sistema debe mantener un registro completo de evidencias.  
Ejemplo:  
DIAG-2041  
EV-001  
Traffic stable  
EV-002  
ATC stable  
EV-003  
Checkout initiated stable  
EV-004  
Payment success \-21%  
EV-005  
Payment errors \+184%  
EV-006  
Payment configuration changed 47 min before anomaly  
Esto permitirá auditoría posterior desde el panel administrativo.

34\. HYPOTHESIS LEDGER  
También deben conservarse las hipótesis descartadas.  
Ejemplo:  
H1 Traffic loss  
STATUS: REJECTED  
H2 PDP deterioration  
STATUS: REJECTED  
H3 Checkout UX problem  
STATUS: POSSIBLE  
H4 Payment provider failure  
STATUS: STRONGLY\_SUPPORTED  
H5 Seasonality  
STATUS: REJECTED  
Guardar únicamente la conclusión final destruiría gran parte de la trazabilidad.

35\. DIAGNOSTIC LIMITATIONS  
Todo diagnóstico debe poder declarar sus limitaciones.  
Ejemplo:  
LIMITATIONS  
No payment-provider error logs available.  
No checkout session replay available.  
Attribution model changed during comparison period.  
Esto aumenta enormemente la fiabilidad del copiloto.

36\. FALSIFICATION  
El motor debe intentar demostrar que su hipótesis favorita es falsa.  
Ejemplo:  
Hipótesis:  
Creative fatigue  
Preguntas de falsificación:  
¿El CPM explica por sí solo el aumento del CAC?  
¿El CVR cayó al mismo tiempo?  
¿Cambió el audience mix?  
¿Las creatividades nuevas también deterioraron?  
¿El deterioro existe en todos los markets?  
¿Coincide con un cambio de atribución?  
Una hipótesis que sobrevive mejor a intentos de falsificación obtiene mayor confianza.

37\. Confusores  
Todo diagnóstico debe comprobar posibles confusores.  
Conceptualmente:  
seasonality  
promotion  
launch  
stockout  
pricing\_change  
traffic\_mix  
market\_mix  
device\_mix  
attribution\_change  
tracking\_change  
catalog\_change  
sample\_size  
external\_event  
day\_of\_week  
holiday  
currency  
shipping\_change  
Estos conceptos serán desarrollados profundamente en D12.  
D0 simplemente exige que puedan existir dentro del contrato.

38\. DIAGNOSTIC\_CONCLUSION  
La conclusión debe tener una estructura estándar.  
DIAGNOSIS  
status:  
CONFIRMED  
primary\_issue:  
Payment success deterioration  
root\_cause:  
Payment provider configuration failure  
affected\_area:  
Conversion / Checkout  
constraint:  
Payment completion  
severity:  
CRITICAL  
confidence:  
HIGH  
trajectory:  
DETERIORATING  
business\_impact:  
Revenue loss  
onset:  
2026-09-03 14:00  
evidence:  
EV-004  
EV-005  
EV-006  
alternative\_hypotheses:  
Checkout UX regression  
limitations:  
No provider-level error classification available

39\. DIAGNOSTIC\_SUMMARY  
Además del objeto técnico debe existir una explicación humana.  
Ejemplo:  
Durante los últimos siete días la caída de revenue no parece originarse en adquisición ni en intención de compra. El tráfico, la navegación de producto y el inicio del checkout permanecen estables. El deterioro se concentra en la fase final de pago, donde la tasa de éxito ha descendido un 21 % y los errores han aumentado un 184 %. El inicio de la anomalía coincide temporalmente con una modificación de configuración del sistema de pagos. La evidencia apunta con confianza alta a un fallo relacionado con dicha configuración. El problema tiene severidad crítica porque afecta directamente a usuarios con intención inmediata de compra.  
Obsérvese que todavía no dice:  
“Revertir configuración.”  
Eso sería una acción.  
Y corresponde a una fase posterior.

40\. Separación entre diagnóstico y recomendación  
El copiloto debe respetar esta frontera incluso cuando el usuario pregunte:  
“¿Qué está fallando?”  
Puede responder con diagnóstico.  
Si pregunta:  
“¿Qué harías?”  
podrán activarse posteriormente los motores correspondientes de F4/F5/F7.  
Conceptualmente:  
DIAGNOSTIC ENGINE  
        ↓  
FINDING  
        ↓  
PRIORITY ENGINE  
        ↓  
DECISION  
        ↓  
PLAYBOOK ENGINE  
        ↓  
ACTION  
Nunca:  
METRIC ↓  
   ↓  
ACTION

41\. Múltiples diagnósticos simultáneos  
Un ecommerce puede contener varios problemas simultáneos.  
Ejemplo:  
DIAG-01  
Creative deterioration  
DIAG-02  
Hero SKU stock risk  
DIAG-03  
Retention weakness  
DIAG-04  
Cash conversion deterioration  
Fase 3 identifica los cuatro.  
Fase 4 determinará cuál merece atención primero.

42\. Diagnósticos relacionados  
Los casos pueden estar conectados.  
Ejemplo:  
DIAG-001  
Creative fatigue  
      ↓  
DIAG-002  
CAC deterioration  
      ↓  
DIAG-003  
Contribution margin deterioration  
      ↓  
DIAG-004  
Cash generation deterioration  
Esto posteriormente permitirá construir clusters causales.

43\. Diagnóstico primario y secundario  
Debe diferenciarse:  
PRIMARY\_DIAGNOSIS  
SECONDARY\_DIAGNOSIS  
CONSEQUENCE  
ASSOCIATED\_RISK  
Ejemplo:  
PRIMARY:  
Inventory shortage  
CONSEQUENCE:  
Conversion decline  
SECONDARY:  
Paid media inefficiency  
ASSOCIATED RISK:  
Revenue loss  
Sin esta separación, el sistema podría interpretar la ineficiencia publicitaria como el problema principal cuando en realidad el tráfico está llegando hacia productos sin disponibilidad.

44\. Tipología inicial de diagnósticos  
El motor debe soportar al menos las siguientes grandes familias:  
Tipo — Qué detecta  
Performance — Deterioro de rendimiento  
Structural — Capacidad empresarial deficiente  
Constraint — Cuello de botella  
Risk — Amenaza todavía no materializada  
Anomaly — Comportamiento inesperado  
Regression — Algo que funcionaba dejó de funcionar  
Dependency — Un área está dañando otra  
Data — Información incorrecta o insuficiente  
Operational — Fallo de ejecución  
Financial — Problema económico o de caja  
Strategic — Desalineación estructural  
Opportunity — Capacidad claramente infrautilizada  
Aunque hablamos de “problemas”, el motor también puede diagnosticar:  
OPPORTUNITY  
Ejemplo:  
Retention healthy  
Repeat purchase strong  
Email penetration low  
Diagnosis:  
Retention opportunity underexploited.  
Diagnosticar no significa únicamente detectar fallos.

45\. Diagnósticos negativos y positivos  
Estados posibles:  
STRENGTH  
HEALTHY  
WATCH  
WEAKNESS  
PROBLEM  
CRITICAL\_PROBLEM  
RISK  
OPPORTUNITY  
Esto permitirá que el copiloto pueda responder:  
“No encuentro un problema de conversión. El funnel está sano. El deterioro actual viene de adquisición.”  
Evitar buscar problemas donde no existen es tan importante como encontrarlos.

46\. Evidencia mínima  
No se podrá afirmar una root cause únicamente porque una métrica relacionada haya cambiado.  
Ejemplo prohibido:  
CTR ↓  
→ Creative fatigue CONFIRMED  
Como mínimo deberá existir:  
CTR ↓  
\+  
otros indicadores compatibles  
\+  
ausencia de explicaciones alternativas relevantes  
o la conclusión deberá degradarse a:  
POSSIBLE  
LOW CONFIDENCE

47\. Lenguaje epistemológico  
El copiloto debe hablar de acuerdo con lo que sabe.  
Alta confianza  
“La caída se concentra en…”  
“La evidencia indica…”  
Confianza media  
“La explicación más probable es…”  
“Los datos apuntan principalmente a…”  
Confianza baja  
“Existe una señal compatible con…”  
“Una posible explicación es…”  
Datos insuficientes  
“Con la información disponible no puede determinarse todavía…”  
Está prohibido utilizar lenguaje categórico para evidencia débil.

48\. No inventar benchmarks  
Si el motor desconoce un benchmark contextual adecuado, no debe afirmar:  
“Tu CVR debería ser 4 %.”  
Puede afirmar:  
“La conversión ha caído un 31 % respecto a su propio baseline reciente.”  
Los benchmarks externos pertenecerán especialmente a Fase 6\.  
Antes de F6, el diagnóstico puede funcionar mediante:  
historical baseline  
peer baseline if available  
business target  
trend  
structural relationship

49\. Baseline  
Toda señal debería especificar contra qué se compara.  
Tipos posibles:  
previous\_period  
year\_over\_year  
rolling\_average  
business\_target  
historical\_normal  
pre\_event  
control\_group  
peer\_group  
benchmark  
Comparación sin baseline explícito no debe considerarse evidencia fuerte.

50\. Segmentación  
Antes de emitir una conclusión global, el motor debe intentar determinar si el problema está concentrado.  
Dimensiones habituales:  
channel  
campaign  
adset  
creative  
market  
country  
device  
browser  
customer\_type  
product  
collection  
landing\_page  
traffic\_source  
discount  
shipping\_method  
payment\_method  
cohort  
Ejemplo:  
Global CVR:  
\-8%  
Mobile Safari:  
\-37%  
Desktop:  
\+2%  
Chrome Mobile:  
\-1%  
La conclusión correcta probablemente no será:  
“La tienda convierte peor.”  
Será:  
“Existe una regresión concentrada en Mobile Safari.”

51\. Cambio absoluto frente a cambio relativo  
El motor debe conservar ambos.  
Ejemplo:  
CVR:  
before:  
2.0%  
after:  
1.5%  
absolute\_change:  
\-0.5 pp  
relative\_change:  
\-25%  
Confundir puntos porcentuales con porcentaje relativo puede generar análisis erróneos.

52\. Magnitud y persistencia  
Una señal necesita dos dimensiones diferentes:  
magnitude  
persistence  
Ejemplo A:  
Revenue:  
\-40%  
duration:  
1 hour  
Ejemplo B:  
Revenue:  
\-11%  
duration:  
28 days  
El segundo puede resultar empresarialmente más importante.

53\. Correlación temporal  
Las relaciones deben registrar cuándo ocurren.  
Ejemplo:  
Creative refresh stops  
DAY 0  
CTR begins deterioration  
DAY 5  
CAC begins deterioration  
DAY 6  
Esto constituye evidencia causal más sólida que observar simplemente tres métricas deterioradas simultáneamente.

54\. Propagación  
Algunos problemas se propagan entre sistemas.  
Ejemplo:  
Forecast error  
↓  
Inventory imbalance  
↓  
Stockout  
↓  
Conversion decline  
↓  
Paid media efficiency decline  
↓  
Revenue decline  
D0 debe permitir representar este tipo de estructura.  
D7 desarrollará el grafo causal completo.

55\. Meta-diagnóstico  
El sistema debe ser capaz de diagnosticar su propia incapacidad para diagnosticar.  
Ejemplo:  
DIAGNOSIS TYPE:  
DATA  
ISSUE:  
Attribution inconsistency  
SEVERITY:  
HIGH  
CONFIDENCE:  
HIGH  
IMPACT:  
Acquisition performance cannot be reliably diagnosed.  
Esta capacidad es crucial.  
Un copiloto experto debe poder decir:  
“El problema que tengo delante ahora mismo no es Meta Ads. Es que los datos de Meta, Shopify y Analytics no pueden reconciliarse suficientemente como para diagnosticar adquisición con fiabilidad.”

56\. Contrato de salida  
Todo diagnóstico deberá poder devolver conceptualmente:  
DIAGNOSTIC\_OUTPUT  
diagnostic\_id  
timestamp  
scope  
target  
business\_context  
maturity\_context  
data\_quality  
observations  
signals  
symptoms  
hypotheses  
supporting\_evidence  
contradicting\_evidence  
confounders  
data\_gaps  
root\_cause  
constraint  
affected\_capabilities  
impact\_scope  
severity  
trajectory  
confidence  
limitations  
alternative\_explanations  
diagnostic\_summary  
status  
No todos los campos tendrán siempre contenido.  
Pero la estructura debe permanecer estable.

57\. Ejemplo completo simplificado  
INPUT  
Revenue:  
\-18%  
Traffic:  
\+4%  
PDP views:  
\+3%  
ATC rate:  
\-1%  
Checkout initiation:  
\-2%  
Payment success:  
\-21%  
Payment errors:  
\+184%  
Deployment:  
Payment configuration changed 47 minutes  
before anomaly onset.  
OBSERVATIONS  
Traffic healthy  
Product engagement stable  
Checkout initiation stable  
Payment completion deteriorating  
Payment errors increasing sharply  
SIGNALS  
SIGNAL 1  
Payment success decline  
SIGNAL 2  
Payment error spike  
SYMPTOM  
Checkout payment completion failure  
HYPOTHESES  
H1 Traffic deterioration  
REJECTED  
H2 Product deterioration  
REJECTED  
H3 Checkout UX regression  
POSSIBLE  
H4 Payment configuration failure  
STRONGLY\_SUPPORTED  
H5 Seasonality  
UNSUPPORTED  
ROOT CAUSE  
Probable payment configuration failure  
CONSTRAINT  
Payment completion  
SEVERITY  
CRITICAL  
CONFIDENCE  
HIGH  
TRAJECTORY  
DETERIORATING  
DIAGNOSTIC SUMMARY  
Revenue has declined because fewer high-intent checkout sessions are successfully completing payment. Acquisition and upper-funnel conversion remain broadly stable. The failure begins at the payment stage and coincides closely with a payment configuration deployment. Current evidence strongly supports a payment configuration failure as the primary cause.  
No recommendation se produce todavía.

58\. Reglas inviolables del motor  
El copiloto nunca deberá:  
Convertir correlación directamente en causalidad.  
Diagnosticar usando una única métrica cuando existan dependencias relevantes.  
Ocultar falta de información.  
Inventar benchmarks.  
Confundir un síntoma con una root cause.  
Confundir root cause con constraint.  
Confundir severidad con prioridad.  
Presentar hipótesis como hechos.  
Generalizar un problema localizado al negocio entero.  
Ignorar calidad de datos.  
Ignorar contexto temporal.  
Ignorar cambios recientes del negocio.  
Ignorar hipótesis alternativas.  
Recomendar acciones dentro del motor diagnóstico.  
Cambiar silenciosamente su interpretación sin conservar trazabilidad.  
Estas reglas constituyen invariantes del sistema.

59\. Relación con el RAG  
Este documento no debería almacenarse como un único chunk gigante.  
Conceptualmente deberá dividirse en conocimiento recuperable por categorías como:  
diagnostic\_contract  
diagnostic\_input  
observation  
signal  
symptom  
hypothesis  
evidence  
root\_cause  
constraint  
severity  
confidence  
data\_gap  
confounder  
temporal\_diagnosis  
diagnostic\_output  
diagnostic\_invariants  
Cada fragmento debería conservar metadata relacionada con:  
phase:  
F3  
block:  
D0  
domain:  
diagnostics  
knowledge\_type:  
contract  
version:  
...  
dependencies:  
F1  
F2  
Así el retrieval podrá recuperar exactamente la regla necesaria durante una investigación.

60\. Relación con el copiloto  
El RAG aporta conocimiento.  
Pero el runtime debe imponer comportamiento.  
Por tanto, reglas críticas como:  
No diagnosis without evidence.  
Always expose confidence.  
Always expose uncertainty.  
Never invent unavailable data.  
Separate symptoms from causes.  
Separate diagnosis from action.  
no deberían depender exclusivamente de que el vector search encuentre este documento.  
Deben convertirse posteriormente en:  
system instructions  
runtime schemas  
validation rules  
diagnostic state machine  
evaluation tests  
El RAG recuerda la doctrina.  
El runtime obliga a cumplirla.

61\. Relación con observabilidad  
Cada diagnóstico debería poder reconstruirse posteriormente desde un panel administrativo.  
Debe ser posible responder:  
¿Qué preguntó el usuario?  
¿Qué datos estaban disponibles?  
¿Qué fuentes fueron consultadas?  
¿Qué documentos recuperó el RAG?  
¿Qué observaciones detectó?  
¿Qué hipótesis generó?  
¿Cuáles descartó?  
¿Por qué?  
¿Qué evidencias utilizó?  
¿Qué información faltaba?  
¿Qué root cause determinó?  
¿Qué confianza asignó?  
¿Qué conclusión enseñó al usuario?  
Esta trazabilidad será fundamental para:  
debugging  
evaluación de agentes  
mejora de prompts  
detección de alucinaciones  
análisis de errores  
auditoría  
aprendizaje futuro

62\. Relación con agentes especializados  
D0 será un contrato común.  
Posteriormente diferentes agentes podrán investigar áreas diferentes:  
Acquisition Agent  
Creative Agent  
Conversion Agent  
Retention Agent  
Inventory Agent  
Finance Agent  
Operations Agent  
Data Agent  
Technology Agent  
Pero todos deberán producir conclusiones compatibles con el mismo:  
DIAGNOSTIC\_OUTPUT  
Esto permitirá que un orquestador superior compare y combine investigaciones.

63\. Ejemplo de diagnóstico multiagente  
BUSINESS MONITOR  
detecta:  
Revenue \-17%  
        ↓  
DIAGNOSTIC ORCHESTRATOR  
        ↓  
ACQUISITION AGENT  
No major deterioration  
CONVERSION AGENT  
Checkout payment failure detected  
INVENTORY AGENT  
No significant issue  
DATA AGENT  
Tracking reliable  
        ↓  
DIAGNOSTIC SYNTHESIS  
Primary diagnosis:  
Payment completion failure  
Confidence:  
HIGH  
Sin un contrato común, cada agente respondería con estructuras y criterios incompatibles.

64\. Relación con la futura memoria del sistema  
Cada diagnóstico terminado podrá transformarse posteriormente en experiencia histórica.  
Ejemplo:  
CASE:  
DIAG-2041  
Problem:  
Payment completion decline  
Root cause:  
Payment configuration failure  
Evidence:  
...  
Resolution:  
...  
Outcome:  
...  
Time to recovery:  
...  
Fase 9 podrá utilizar estos casos para que el consultor aprenda:  
“Ya hemos observado anteriormente este patrón en esta tienda.”  
Pero el aprendizaje futuro dependerá de que D0 capture correctamente los diagnósticos desde el principio.

65\. Definition of Done de D0  
D0 estará correctamente implementado cuando cualquier diagnóstico pueda responder de forma trazable:  
WHAT HAPPENED?  
WHERE?  
WHEN?  
HOW MUCH?  
COMPARED TO WHAT?  
WHAT EVIDENCE EXISTS?  
WHAT PATTERN DOES IT CREATE?  
WHAT COULD EXPLAIN IT?  
WHAT EXPLANATIONS WERE REJECTED?  
WHAT IS THE MOST LIKELY CAUSE?  
WHAT IS THE CURRENT CONSTRAINT?  
WHAT BUSINESS AREA IS AFFECTED?  
HOW SEVERE IS IT?  
WHAT IS THE TRAJECTORY?  
HOW CONFIDENT ARE WE?  
WHAT DO WE NOT KNOW?  
WHAT PREVENTS HIGHER CONFIDENCE?  
Y deliberadamente no responder todavía:  
WHAT SHOULD WE DO FIRST?  
WHAT ACTION SHOULD WE TAKE?  
WHAT STRATEGY SHOULD WE EXECUTE?  
Esas preguntas pertenecen a las fases siguientes.

66\. Principio final  
El objetivo de este sistema no es construir una IA que siempre tenga una respuesta.  
El objetivo es construir una IA que sepa distinguir entre:  
lo que observa  
lo que interpreta  
lo que sospecha  
lo que puede demostrar  
lo que no sabe  
Un consultor mediocre responde rápidamente.  
Un buen sistema diagnóstico reduce progresivamente la incertidumbre hasta encontrar la explicación que mejor encaja con la evidencia.  
Ese será el estándar de toda la Fase 3\.  
