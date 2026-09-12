D12 — CONTRATO DE CONFUSORES Y FALSOS DIAGNÓSTICOS

1\. Propósito operativo

D12 funciona como capa adversarial del diagnóstico. Su función es comprobar si una explicación aparentemente correcta puede ser falsa, incompleta o engañosa por variables de confusión, problemas de comparabilidad, cambios de composición, errores de medición, muestras insuficientes, causalidad inversa, intervenciones simultáneas u otros factores materiales.

Regla fundamental: un diagnóstico no debe aceptarse como causalidad suficiente solo porque A cambia, B cambia, A ocurre antes que B y existe un mecanismo plausible. Antes de cerrar la conclusión deben comprobarse confusores relevantes, comparabilidad, baseline, composición, medición, muestra, lags y posibles explicaciones alternativas.

D12 debe proteger tanto contra falsos positivos como contra falsos negativos. NO DIAGNOSIS puede ser una salida correcta cuando la evidencia no permite una conclusión robusta.

2\. FALSE\_DIAGNOSIS\_RISK

Todo diagnóstico debe poder recibir un nivel de riesgo de falso diagnóstico:  
LOW  
MEDIUM  
HIGH  
CRITICAL

Un riesgo CRITICAL puede bloquear la finalización del diagnóstico cuando la evidencia utilizada esté sistemáticamente distorsionada.

3\. CONFOUNDER

Objeto mínimo:  
CONFOUNDER  
confounder\_id  
type  
description  
affected\_claims  
affected\_metrics  
scope  
time\_window  
evidence  
plausibility  
materiality  
status  
confidence\_effect

Tipos de confusores que el sistema debe poder reconocer como mínimo:  
SEASONALITY  
PROMOTION  
LAUNCH  
TRAFFIC\_MIX  
CUSTOMER\_MIX  
PRODUCT\_MIX  
MARKET\_MIX  
DEVICE\_MIX  
CHANNEL\_MIX  
PRICE\_CHANGE  
INVENTORY\_CHANGE  
ATTRIBUTION\_CHANGE  
TRACKING\_CHANGE  
METRIC\_DEFINITION\_CHANGE  
PARTIAL\_PERIOD  
DAY\_OF\_WEEK  
HOLIDAY  
SAMPLE\_SIZE  
OUTLIER  
EXTERNAL\_EVENT  
OPERATIONAL\_CHANGE  
TECHNOLOGY\_CHANGE  
CURRENCY\_CHANGE  
SHIPPING\_CHANGE  
PAYMENT\_CHANGE

Categorías conceptuales mínimas:  
MEASUREMENT  
CONTEXT  
COMPOSITION  
TEMPORAL  
SELECTION  
EXTERNAL  
BEHAVIORAL  
OPERATIONAL

4\. Metric Comparability Gate

Antes de utilizar una métrica como evidencia causal, D12 debe comprobar:  
SAME DEFINITION?  
SAME SCOPE?  
SAME TIME LOGIC?  
SAME CURRENCY?  
SAME STATUS FILTER?

Estados de comparabilidad:  
COMPARABLE  
PARTIALLY\_COMPARABLE  
NOT\_COMPARABLE  
UNKNOWN

Una métrica NOT\_COMPARABLE no puede sostener un diagnóstico fuerte.

5\. Estados del confusor

CONFOUNDER\_STATUS:  
CANDIDATE  
PLAUSIBLE  
SUPPORTED  
MATERIAL  
REJECTED  
RESOLVED

Semántica:  
CANDIDATE \= posible confusor.  
PLAUSIBLE \= existe mecanismo plausible.  
SUPPORTED \= existe evidencia de que el factor cambió.  
MATERIAL \= puede explicar una parte significativa del diagnóstico.  
REJECTED \= la evidencia muestra que no puede explicar el fenómeno.  
RESOLVED \= su efecto ya ha sido contabilizado, aislado o controlado.

6\. CONFOUNDER\_TEST

Objeto mínimo:  
CONFOUNDER\_TEST  
confounder  
required\_data  
expected\_pattern  
result  
effect\_on\_diagnosis

Cada confusor material debe poder vincularse a una prueba verificable cuando sea posible. El sistema debe preferir controles naturales, segmentos tratados/no tratados, comparaciones within-segment, cohortes maduras y otras evidencias que permitan separar el efecto.

7\. Ranking y checks obligatorios por familia diagnóstica

Los confusores pueden ordenarse por:  
plausibility  
materiality  
ease\_of\_testing

El runtime no debe ejecutar mecánicamente todos los checks posibles. Debe seleccionar los relevantes según la familia diagnóstica, pero existen comprobaciones mínimas:

Revenue:  
period comparability  
seasonality  
promotions  
tracking  
traffic  
CVR  
AOV  
product availability

CAC:  
CPM  
CTR  
CVR  
traffic/channel mix  
new customer definition  
attribution  
scale level

Conversion:  
traffic mix  
device mix  
market mix  
product mix  
inventory  
price  
promotion  
tracking

Retention:  
cohort maturity  
customer mix  
product mix  
promotion cohorts  
identity resolution

Finance:  
accounting timing  
one-offs  
inventory  
cash vs accrual  
cost completeness

Inventory:  
demand spike  
promotion  
lead time  
inbound stock  
SKU mix  
forecast horizon

Data:  
schema  
tracking  
definitions  
sync  
permissions  
timezone

Technology:  
deployment  
traffic load  
third-party outage  
browser/device

8\. Adversarial checklist

Antes de una conclusión final, D12 debe evaluar de forma contextual si podrían explicar el patrón:  
seasonality  
promotion  
mix  
tracking  
definitions  
low sample  
timing  
reverse causality  
simultaneous changes  
external factor

Además debe comprobar cuando aplique:  
regression to the mean  
selection/survivorship bias  
denominator changes  
cohort maturity  
attribution methodology  
currency effects  
one-off financial events  
masking/compensation effects  
strategic trade-offs

9\. FALSE\_DIAGNOSIS\_RISK\_RESULT

Output mínimo:  
FALSE\_DIAGNOSIS\_RISK\_RESULT  
diagnostic\_id  
risk\_level  
candidate\_confounders  
material\_confounders  
rejected\_confounders  
measurement\_risks  
mix\_effects  
baseline\_risks  
sample\_risks  
causal\_risks  
remaining\_uncertainty  
confidence\_adjustment

D12 debe alimentar a D11 con cualquier ajuste de confianza derivado de la revisión adversarial.

10\. Diagnosis Survival

Después de D12 todo diagnóstico debe quedar en uno de estos estados:  
SURVIVES  
SURVIVES\_WITH\_LIMITATIONS  
WEAKENED  
REQUIRES\_REVISION  
INVALIDATED

Semántica:  
SURVIVES \= no se encontró confusor material.  
SURVIVES\_WITH\_LIMITATIONS \= existen confusores, pero no invalidan la conclusión.  
WEAKENED \= el diagnóstico sigue siendo plausible, pero pierde confianza.  
REQUIRES\_REVISION \= un confusor cambia materialmente la interpretación.  
INVALIDATED \= el diagnóstico ya no está soportado.

11\. Revisión diagnóstica y recursión

D12 puede producir REVISED\_DIAGNOSIS, pero cuando un confusor modifica la explicación debe reabrir D6/D7/D8/D9 según corresponda. Si el ajuste modifica el impacto, debe solicitar recálculo en D10; si modifica confianza o incertidumbre, debe actualizar D11.

Flujo conceptual:  
D9 ROOT CAUSE  
→ D12 ADVERSARIAL CHECK  
→ CONFOUNDER FOUND?  
→ NO: continuar  
→ YES: revisar  
→ D6/D7/D8/D9 según necesidad

D12 no es estrictamente one-pass. El runtime debe tener un límite de recursión/revision budget para evitar bucles infinitos y solo permitir nuevas reformulaciones automáticas cuando exista nueva evidencia o una revisión material justificable.

12\. Red Team

Antes de finalizar un diagnóstico importante, el sistema debe ejecutar un stress test equivalente a:  
¿Qué tendría que ser cierto para que este diagnóstico fuera incorrecto?

El red team no debe depender únicamente de generación libre del LLM; debe apoyarse en la biblioteca conocida de confusores y en checks deterministas disponibles.

RED\_TEAM\_RESULT:  
strongest\_counter\_explanation  
supporting\_evidence  
required\_evidence  
diagnosis\_effect

El challenger de D8 y el red team de D12 son distintos: D8 busca la mejor hipótesis causal competidora; D12 busca la mejor razón por la que la interpretación completa podría ser engañosa.

13\. Robustez y sensibilidad

ROBUSTNESS:  
HIGH  
MEDIUM  
LOW

La robustez debe reflejar si la conclusión sobrevive a cambios razonables de baseline, segmentación, confusores y alternativas.

SENSITIVITY:  
assumption  
low\_case  
base\_case  
high\_case  
diagnosis\_changes

DIAGNOSIS\_STABILITY:  
STABLE\_TO\_ASSUMPTIONS  
SENSITIVE  
HIGHLY\_SENSITIVE

Un diagnóstico HIGHLY\_SENSITIVE debe degradar la confianza y explicitar la dependencia de supuestos.

14\. Materialidad, fuerza y resolución de confusores

Solo los confusores materiales deben afectar fuertemente la conclusión final. Un confusor hipotético sin evidencia no puede destruir un diagnóstico fuerte.

CONFOUNDER\_STRENGTH:  
WEAK  
MODERATE  
STRONG  
DECISIVE

CONFOUNDER\_RESOLUTION:  
ADJUSTED\_FOR  
SEGMENTED\_OUT  
REJECTED  
UNRESOLVED

Los confusores sin evidencia deben mantenerse como SPECULATIVE. Si se ajusta un confusor, la salida final debe indicar explícitamente que el diagnóstico se expresa después de ajustar/controlar ese factor.

15\. DIAGNOSTIC\_ROBUSTNESS

Objeto mínimo:  
DIAGNOSTIC\_ROBUSTNESS  
false\_diagnosis\_risk  
robustness  
material\_confounders  
resolved\_confounders  
unresolved\_confounders  
sensitivity  
confidence\_adjustment  
survival\_status

16\. D12\_RESULT

Salida contractual:  
D12\_RESULT  
diagnostic\_id  
false\_diagnosis\_risk  
diagnosis\_survival\_status  
candidate\_confounders  
material\_confounders  
rejected\_confounders  
mix\_effects  
measurement\_distortions  
baseline\_distortions  
sample\_risks  
temporal\_risks  
reverse\_causality\_risks  
simultaneous\_change\_risks  
masking\_effects  
sensitivity\_analysis  
revised\_claims  
confidence\_adjustments  
remaining\_limitations

D14 no debe finalizar un diagnóstico sin registrar los confusores comprobados, los confusores materiales, los riesgos restantes y la robustez del diagnóstico.

17\. Runtime Responsibility

El runtime debe calcular de forma determinista o semideterminista, cuando sea posible:  
same-period alignment  
mix decomposition  
sample sufficiency  
cohort maturity  
constant-currency comparison  
metric comparability  
tracking/source conflicts  
event timing  
normalized rates

No deben depender únicamente del LLM:  
period alignment  
sample size  
metric definitions  
source reconciliation  
cohort maturity  
known promotion/event dates

Arquitectura híbrida:  
CURRENT DIAGNOSIS  
→ MANDATORY CONFOUNDER CHECKS  
\+ STATISTICAL / MIX CHECKS  
\+ LLM RED TEAM  
→ ROBUSTNESS VALIDATION  
→ SURVIVES / REVISE / INVALIDATE

18\. LLM Responsibility

El LLM puede:  
identify plausible confounders  
challenge causal narrative  
interpret mixed evidence  
detect possible reverse causality  
explain diagnostic revision

El LLM no puede presentar como hecho un confusor externo meramente plausible ni sobreescribir checks deterministas sin evidencia trazable.

19\. Admin Observability

El panel de administración debe permitir reconstruir:  
Diagnosis  
Confounders evaluated  
Why each was considered  
Evidence  
Status  
Materiality  
Diagnosis before D12  
Diagnosis after D12  
Confidence before  
Confidence after

También debe quedar trazado qué checks fueron obligatorios, cuáles se ejecutaron, cuáles no pudieron ejecutarse y por qué, qué confusores quedaron unresolved y qué revisión diagnóstica se disparó.

20\. Tests mínimos

test\_seasonality\_confounder  
test\_promotion\_baseline  
test\_partial\_period  
test\_traffic\_mix\_simpsons\_paradox  
test\_product\_mix\_margin  
test\_market\_mix\_cac  
test\_cohort\_maturity  
test\_low\_sample  
test\_tracking\_regression  
test\_metric\_definition\_drift  
test\_attribution\_window\_change  
test\_reverse\_causality  
test\_simultaneous\_interventions  
test\_scale\_normalization  
test\_one\_off\_cash\_event  
test\_hidden\_deterioration  
test\_masking\_effect  
test\_diagnosis\_survives\_confounders

Fixtures mínimos:  
Simpson's Paradox: los segmentos mejoran pero el mix provoca caída global; no debe diagnosticarse deterioro within-segment.  
Partial Period: periodo actual parcial frente a periodo completo; comparación inválida.  
Promo: CVR actual normal frente a Black Friday; no debe inferirse deterioro material.  
Tracking: GA cae mientras Shopify permanece estable tras deploy de tracking; measurement confounder decisivo.  
Scale: tickets \+50 % con pedidos \+100 %; la tasa mejora y no soporta deterioro.  
Cohort: repeat global cae por aumento de cohortes recientes mientras cohortes maduras permanecen estables; mix/cohort confounder.  
Product Mix: margen global cae con márgenes within-SKU estables y mayor peso de SKU de bajo margen; product mix explanation.  
Reverse Causality: revenue cae antes de recortar spend; el recorte no puede explicar el onset.  
Simultaneous Changes: precio, PDP y creatividades cambian en la misma fecha; no se puede atribuir la mejora de forma única.  
Hidden Deterioration: revenue estable con traffic \+40 % y CVR \-28 %; deterioro de conversión enmascarado por tráfico.  
One-off Finance: cash cae con contribution estable y pago fiscal anual; no diagnosticar automáticamente deterioro operativo.  
Attribution: Meta ROAS cae, Shopify estable y cambia attribution window; attribution confounder.

21\. Invariantes

El sistema nunca debe:  
\- aceptar correlación temporal como causalidad suficiente;  
\- ignorar seasonality, promociones o lanzamientos cuando sean relevantes;  
\- ignorar traffic mix, customer mix, product mix, market mix o device/browser mix;  
\- ignorar cambios de attribution, tracking o metric-definition drift;  
\- comparar periodos parciales con periodos completos;  
\- diagnosticar desde cohortes inmaduras;  
\- interpretar porcentajes sin considerar tamaño muestral;  
\- ignorar regression to the mean o survivorship/selection bias;  
\- ignorar cambios de denominador;  
\- ignorar el lag entre causa y efecto;  
\- ignorar reverse causality;  
\- atribuir un resultado a un único cambio cuando hubo múltiples intervenciones simultáneas;  
\- usar eventos externos especulativos como si estuvieran confirmados;  
\- confundir attribution con incrementality;  
\- confundir crecimiento de volumen absoluto con deterioro de tasa;  
\- confundir cambio agregado con cambio within-segment;  
\- ignorar one-off financial events, currency effects o accounting timing cuando sean materiales;  
\- confundir trade-offs estratégicos deliberados con fallos;  
\- ignorar masking y compensation effects;  
\- destruir un diagnóstico fuerte por un confusor hipotético sin soporte;  
\- ocultar confusores materiales en la salida final;  
\- mantener intacta la confianza después de un confusor decisivo;  
\- forzar que el diagnóstico sobreviva la revisión adversarial;  
\- preferir una historia causal limpia a una realidad incompleta.

22\. Definition of Done

D12 está correctamente construido cuando puede responder de forma trazable:  
¿Qué podría distorsionar este diagnóstico?  
¿Existe seasonality, promoción o lanzamiento relevante?  
¿Cambió el mix?  
¿Cambió la medición, atribución o definición de métrica?  
¿El periodo es comparable?  
¿La muestra es suficiente?  
¿Los cohortes están maduros?  
¿Existe regression to the mean o selection bias?  
¿Cambió el denominador?  
¿Se respetan los lags?  
¿Puede existir causalidad inversa?  
¿Hubo cambios simultáneos?  
¿Un factor está enmascarando otro?  
¿El cambio global existe también within-segment?  
¿La conclusión es robusta a distintos baselines?  
¿Qué confusores fueron rechazados?  
¿Cuáles siguen siendo materiales?  
¿Sobrevive, se debilita, debe revisarse o invalidarse el diagnóstico?  
¿Cómo cambia la confianza?

Principio de cierre: D12 debe intentar refutar la primera explicación, no protegerla. Solo una conclusión que sobrevive a los confusores relevantes merece ganar confianza.  
