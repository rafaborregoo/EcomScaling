FASE 3 — SISTEMA DE DIAGNÓSTICO  
D2 — CONTRATO DE CONTEXTUALIZACIÓN

0\. Propósito

Este contrato define las reglas obligatorias mediante las que el sistema debe construir el contexto diagnóstico antes de interpretar señales, síntomas, anomalías, madurez o causas.

D2 responde:

¿EN QUÉ CONTEXTO OCURRE LO OBSERVADO?

D2 no decide prioridad, estrategia ni acción. Tampoco confirma causalidad. Produce un marco contextual estructurado que consumen D3 y los siguientes bloques del Sistema de Diagnóstico.

1\. Posición en el pipeline

D1 — Calidad y Fiabilidad de los Datos  
        ↓  
D2 — Contextualización  
        ↓  
D3 — Detección de Etapa de Madurez  
        ↓  
D4+ — Salud, señales, síntomas, hipótesis y causa raíz

D2 debe consumir el resultado de D1 y preservar sus limitaciones.

2\. Invariante principal

NO DIAGNOSTIC INTERPRETATION WITHOUT CONTEXT

El sistema no debe convertir una métrica, cambio o anomalía en una conclusión empresarial sin haber identificado previamente el contexto material disponible para esa interpretación.

3\. CONTEXT\_INPUT

D2 debe poder recibir, cuando estén disponibles:

business\_profile  
time\_context  
maturity\_context  
data\_quality\_result  
metrics  
segments  
channels  
markets  
products  
customer\_mix  
promotion\_state  
inventory\_state  
business\_objectives  
known\_changes  
external\_events  
constraints  
previous\_diagnostics  
user\_observations  
measurement\_changes  
requested\_scope

Los campos ausentes deben conservar su estado de conocimiento; no deben completarse mediante suposición silenciosa.

4\. Estados de conocimiento contextual

Cada variable relevante puede adoptar uno de estos estados:

KNOWN  
UNKNOWN  
UNAVAILABLE  
UNRELIABLE  
CONFLICTING  
NOT\_APPLICABLE

UNKNOWN no equivale a false.  
UNRELIABLE no equivale a unavailable.  
CONFLICTING debe conservar las versiones incompatibles.

5\. CONTEXT\_SCOPE

D2 debe identificar el alcance material del análisis:

GLOBAL  
MARKET  
CHANNEL  
PRODUCT  
SKU  
DEVICE  
CUSTOMER\_SEGMENT  
COHORT  
FUNNEL\_STAGE  
OPERATIONAL\_AREA  
TIME\_WINDOW

Puede existir más de un scope simultáneamente.

6\. BUSINESS\_CONTEXT

El contexto de negocio debe poder representar al menos:

business\_model  
category  
primary\_value\_proposition  
price\_positioning  
purchase\_cycle  
revenue\_scale  
order\_volume  
market\_count  
channel\_count  
sku\_count  
customer\_base  
subscription\_presence  
business\_stage\_if\_known

La ausencia de alguno de estos campos no bloquea automáticamente D2, pero puede reducir la confianza contextual cuando sea material.

7\. TIME\_CONTEXT

Toda observación cuantitativa debe conservar:

observation\_window  
comparison\_window  
comparison\_type  
timezone\_if\_relevant  
seasonality\_state  
commercial\_event\_state

comparison\_type puede incluir:

PREVIOUS\_PERIOD  
YEAR\_OVER\_YEAR  
ROLLING\_BASELINE  
COHORT\_COMPARISON  
SEGMENT\_COMPARISON  
TARGET\_COMPARISON  
EXTERNAL\_BENCHMARK  
NO\_VALID\_COMPARISON

8\. Regla de comparabilidad

La proximidad temporal no garantiza comparabilidad.

Antes de interpretar una variación, D2 debe comprobar, cuando sea material:

seasonality  
weekday mix  
promotion state  
stock availability  
market configuration  
channel mix  
product mix  
measurement logic  
major internal changes

Si las condiciones cambian de forma sustancial, debe marcar:

COMPARABILITY: DEGRADED

o

COMPARABILITY: INVALID

9\. Baseline selection

D2 debe identificar explícitamente el baseline usado.

Cuando existan varias referencias posibles, debe preferir la más comparable y suficientemente fiable para la pregunta concreta.

La selección puede considerar:

own comparable history  
internal segment/cohort baseline  
explicit business target  
category/market pattern  
external benchmark

Un benchmark externo genérico no debe sustituir automáticamente una referencia interna más comparable.

10\. Prohibición de benchmark inventado

El sistema nunca debe fabricar:

industry averages  
healthy ranges  
market standards  
expected conversion rates  
expected CAC  
expected retention

Si no existe evidencia para un benchmark, debe declararse:

BENCHMARK: UNKNOWN

11\. SEGMENT\_CONTEXT

D2 debe comprobar si un cambio agregado puede estar producido por variación de composición.

Dimensiones candidatas:

channel  
device  
market  
product  
SKU  
new\_vs\_repeat  
customer\_cohort  
traffic\_intent  
landing\_page  
promotion\_status

Cuando corresponda, puede emitir:

MIX\_SHIFT

12\. PERFORMANCE\_CHANGE vs MIX\_SHIFT

D2 debe distinguir conceptualmente:

PERFORMANCE\_CHANGE

cambio dentro de un segmento comparable

de

MIX\_SHIFT

cambio en el peso relativo de segmentos con comportamientos diferentes.

Ambos pueden coexistir.

13\. PRODUCT\_CONTEXT

Cuando producto o catálogo sea material, D2 debe poder representar:

product\_mix  
hero\_sku\_dependency  
stock\_availability  
price\_points  
product\_lifecycle  
launch\_state  
seasonality  
return\_profile  
margin\_profile

Un cambio en aggregate AOV, CVR o margin no debe atribuirse a eficiencia sin descartar primero cambios relevantes de product mix.

14\. CUSTOMER\_CONTEXT

Cuando sea material, debe distinguir:

new\_customers  
repeat\_customers  
reactivated\_customers  
cohort\_age  
first\_product  
acquisition\_source  
first\_order\_discount

No deben compararse cohortes de distinta madurez temporal como si fueran equivalentes.

15\. CHANNEL\_CONTEXT

D2 debe conservar, cuando proceda:

channel\_mix  
prospecting\_vs\_remarketing  
brand\_vs\_non\_brand  
paid\_vs\_organic  
new\_vs\_existing\_targeting  
attribution\_scope

Un resultado de plataforma no debe tratarse automáticamente como resultado incremental del negocio.

16\. ATTRIBUTION\_CONTEXT

Cuando existan varias fuentes de atribución, el sistema debe distinguir su función.

Ejemplos:

platform\_attributed  
store\_revenue  
blended\_revenue  
analytics\_attributed

Las discrepancias deben registrarse como información diagnóstica.

El sistema no debe seleccionar oportunistamente la fuente que más favorezca una conclusión.

17\. ECONOMIC\_CONTEXT

Antes de interpretar adquisición, pricing, promociones o crecimiento, D2 debe incorporar la economía disponible:

gross\_margin  
contribution\_margin  
COGS  
shipping\_cost  
payment\_fees  
returns\_cost  
discount\_burden  
CAC  
LTV  
payback  
working\_capital

Si la rentabilidad relevante es desconocida, no debe declararse una iniciativa como rentable basándose solo en revenue o ROAS.

18\. PROMOTION\_CONTEXT

D2 debe identificar si el periodo está afectado por:

PROMOTION  
FLASH\_SALE  
LAUNCH  
BLACK\_FRIDAY  
CYBER\_MONDAY  
FREE\_SHIPPING  
PRICE\_CHANGE  
BUNDLE\_CAMPAIGN  
INFLUENCER\_ACTIVATION  
OTHER\_COMMERCIAL\_EVENT

Los efectos promocionales no deben clasificarse automáticamente como cambios estructurales.

19\. PROMOTIONAL\_LIFT vs STRUCTURAL\_IMPROVEMENT

Una mejora durante una promoción debe mantenerse como contextual hasta demostrar persistencia fuera del evento.

D2 puede marcar:

PROMOTIONAL\_LIFT  
DEMAND\_PULL\_FORWARD  
POST\_PROMO\_NORMALIZATION

cuando exista evidencia compatible.

20\. CHANGE\_EVENT

Todo cambio interno material conocido debe registrarse estructuradamente:

change\_type  
occurred\_at  
affected\_scope  
description  
source  
confidence

Tipos posibles:

SITE\_DEPLOYMENT  
CHECKOUT\_CHANGE  
TRACKING\_CHANGE  
PRICE\_CHANGE  
SHIPPING\_POLICY\_CHANGE  
CAMPAIGN\_RESTRUCTURE  
CREATIVE\_CHANGE  
PRODUCT\_LAUNCH  
WAREHOUSE\_CHANGE  
CRM\_CHANGE  
MARKET\_LAUNCH  
TEAM\_CHANGE  
OTHER

21\. Temporal proximity rule

La proximidad temporal entre un change event y una anomalía aumenta su relevancia como hipótesis contextual.

Nunca debe transformarse por sí sola en causalidad confirmada.

TEMPORAL\_PROXIMITY ≠ CAUSALITY

22\. Lag awareness

D2 debe permitir efectos retardados.

Un cambio no debe descartarse únicamente porque la métrica no reaccionó el mismo día.

Cuando exista un lag plausible, puede registrarse:

EXPECTED\_LAG  
POSSIBLE\_LAG  
UNKNOWN\_LAG

23\. MEASUREMENT\_CONTEXT

D2 debe consumir cambios de medición relevantes:

tracking implementation  
metric definition  
attribution window  
consent changes  
currency conversion  
source reconciliation  
analytics configuration

Cuando una serie atraviesa un cambio de medición material debe marcar:

MEASUREMENT\_DISCONTINUITY

24\. Regla de discontinuidad

Datos situados antes y después de una discontinuidad de medición no deben tratarse automáticamente como una serie homogénea.

25\. INVENTORY\_CONTEXT

Cuando stock pueda limitar ventas, D2 debe comprobar, si es posible:

stock availability  
hero SKU availability  
stockout periods  
lead times  
inventory coverage  
supplier constraints

No debe inferirse caída de demanda sin considerar restricciones de oferta cuando existan señales de stockout.

26\. CAPACITY\_CONTEXT

Cuando volumen y operaciones sean materiales, D2 debe poder representar:

warehouse\_capacity  
support\_capacity  
production\_capacity  
supplier\_capacity  
creative\_capacity  
team\_capacity  
technology\_capacity

Una caída de servicio durante fuerte crecimiento puede representar capacidad insuficiente y no necesariamente pérdida de demanda.

27\. STRATEGY\_CONTEXT

D2 debe conservar objetivos y elecciones estratégicas declaradas u observadas:

premium positioning  
growth focus  
profit focus  
market expansion  
full-price strategy  
promotional strategy  
SKU simplification  
channel concentration  
brand investment

Una ausencia deliberada no debe clasificarse automáticamente como incapacidad.

28\. CANNOT vs CHOOSES\_NOT\_TO

Cuando exista evidencia suficiente, D2 debe distinguir:

CANNOT

la capacidad no existe o no puede ejecutarse

de

CHOOSES\_NOT\_TO

la empresa puede hacerlo, pero decide no hacerlo por estrategia o restricción.

29\. OBJECTIVE\_CONTEXT

Toda evaluación de desempeño debe poder asociarse, cuando exista, con:

primary\_objective  
secondary\_objectives  
success\_criteria  
explicit\_tradeoffs

Una métrica que empeora puede ser coherente con una estrategia si mejora el objetivo prioritario dentro de límites aceptables.

30\. TRADEOFF\_CONTEXT

D2 debe permitir registrar trade-offs como:

margin\_vs\_growth  
AOV\_vs\_CVR  
speed\_vs\_cost  
inventory\_availability\_vs\_cash  
retention\_incentive\_vs\_contribution  
brand\_control\_vs\_distribution

No debe calificarse una mejora local como mejora del negocio sin considerar impactos relevantes aguas abajo.

31\. EXTERNAL\_CONTEXT

Variables externas pueden registrarse cuando exista evidencia:

platform\_change  
competitor\_event  
macroeconomic\_event  
weather\_event  
regulatory\_event  
logistics\_disruption  
cultural\_event  
market\_demand\_shift

La existencia de un evento externo no demuestra que sea causa de la variación observada.

32\. CONFOUNDER

D2 debe registrar variables que puedan explicar total o parcialmente una asociación.

Cada confounder puede incluir:

factor  
evidence  
scope  
timing  
confidence

La presencia de confounders debe reducir la fuerza de atribuciones simples.

33\. MULTIPLE\_SIMULTANEOUS\_CHANGES

Cuando varios cambios materiales ocurran dentro de una ventana causal plausible, D2 debe marcar:

MULTIPLE\_SIMULTANEOUS\_CHANGES

Esto debe reducir la confianza de cualquier explicación monocausal no contrastada.

34\. REGIME\_CHANGE

D2 debe detectar o aceptar como contexto cambios estructurales que alteren la comparabilidad histórica:

international expansion  
subscription launch  
marketplace entry  
major repositioning  
warehouse model change  
category expansion  
business model change

Puede emitir:

REGIME\_CHANGE: TRUE

con fecha, alcance y evidencia.

35\. DECLARED\_CONTEXT vs OBSERVED\_CONTEXT

El sistema debe distinguir información declarada por el usuario de información observada en datos, integraciones o documentos.

Cuando entren en conflicto debe registrar:

CONTEXT\_CONFLICT

sin sobrescribir silenciosamente una fuente con otra.

36\. Context evidence hierarchy

La fuerza de evidencia contextual puede considerar:

OBSERVED\_SYSTEM\_DATA  
DOCUMENTED\_CHANGE  
INTEGRATION\_DATA  
USER\_CONFIRMED  
USER\_REPORTED  
INFERRED  
GENERAL\_KNOWLEDGE

La jerarquía no es absoluta: calidad, actualidad y alcance siguen siendo relevantes.

37\. TENANT\_CONTEXT vs GENERAL\_KNOWLEDGE

D2 debe separar:

TENANT\_CONTEXT

hechos o estados del ecommerce concreto

de

GENERAL\_CONTEXT\_KNOWLEDGE

patrones reutilizables recuperados desde RAG.

Conocimiento general nunca debe presentarse como hecho específico del tenant sin evidencia.

38\. CONTEXT\_GAP

Cuando una variable desconocida sea material para distinguir entre interpretaciones plausibles, debe emitirse:

CONTEXT\_GAP

Campos recomendados:

field  
why\_it\_matters  
affected\_interpretations  
possible\_source  
severity\_of\_gap

39\. Context completeness

D2 debe calcular o representar cualitativamente suficiencia contextual:

SUFFICIENT  
PARTIAL  
INSUFFICIENT

La suficiencia depende del scope y de la pregunta, no del número bruto de campos disponibles.

40\. Adaptive contextual depth

El sistema no debe exigir el mismo contexto para todos los diagnósticos.

Un fallo técnico evidente puede requerir contexto reducido.

Una caída de rentabilidad multicanal puede requerir contexto profundo de economía, mix, atribución, mercados, promociones y cambios recientes.

41\. Context confidence

D2 debe emitir confianza contextual:

HIGH  
MEDIUM  
LOW  
INSUFFICIENT\_DATA

Debe considerar al menos:

data\_quality  
context\_breadth  
source\_quality  
source\_consistency  
temporal\_alignment  
number\_of\_material\_unknowns  
number\_of\_conflicts

42\. Scope localization

D2 debe evitar globalizar una anomalía localizada.

Debe intentar determinar si el fenómeno es:

GLOBAL  
LOCALIZED  
MIX\_DRIVEN  
UNKNOWN\_SCOPE

43\. Maturity interaction

D2 debe suministrar a D3 contexto suficiente para interpretar capacidades respecto a:

business complexity  
current scale  
growth velocity  
strategy  
constraints

D2 no debe decidir por sí solo la etapa E0–E12.

44\. Data-quality interaction

Si D1 marca una fuente como FAIL o UNRELIABLE, D2 debe degradar la confianza de cualquier contexto dependiente de esa fuente.

No debe restaurar credibilidad a un dato únicamente porque encaje con una narrativa plausible.

45\. Historical context

El sistema debe poder conservar snapshots contextuales para reconstruir diagnósticos históricos.

CONTEXT\_SNAPSHOT puede incluir:

snapshot\_id  
timestamp  
business\_context  
time\_context  
market\_context  
channel\_context  
product\_context  
customer\_context  
promotion\_context  
inventory\_context  
strategy\_context  
known\_changes  
measurement\_context  
constraints  
external\_context  
data\_quality\_reference

46\. Versioning

Los context snapshots no deben sobrescribirse silenciosamente.

Cuando cambie una variable material debe poder registrarse:

CONTEXT\_CHANGE\_REASON

47\. CONTEXT\_RESULT

D2 debe producir un objeto equivalente a:

CONTEXT\_RESULT

context\_id  
timestamp  
scope  
business\_context  
time\_context  
comparison\_context  
baseline  
comparability  
market\_context  
channel\_context  
product\_context  
customer\_context  
economic\_context  
promotion\_context  
inventory\_context  
capacity\_context  
strategy\_context  
objective\_context  
measurement\_context  
known\_changes  
external\_context  
constraints  
confounders  
mix\_shifts  
regime\_changes  
context\_conflicts  
context\_gaps  
context\_completeness  
confidence  
limitations

48\. Output obligatorio hacia D3+

Como mínimo, cuando sea material, los siguientes bloques deben poder consumir:

scope  
business\_context  
time\_context  
baseline  
comparability  
known\_changes  
promotion\_state  
measurement\_state  
mix\_shifts  
constraints  
confounders  
context\_gaps  
confidence

49\. D2 invariants

El sistema nunca debe:

Interpretar una métrica sin conservar su ventana temporal.  
Usar revenue, ROAS, CVR, CAC, AOV o cualquier KPI aislado como diagnóstico autosuficiente.  
Comparar periodos materialmente no comparables sin advertirlo.  
Inventar benchmarks.  
Confundir benchmark con objetivo del negocio.  
Confundir mejora promocional con mejora estructural.  
Confundir proximidad temporal con causalidad.  
Ignorar cambios de tracking o definición de métricas.  
Ignorar stockouts cuando pueden limitar revenue.  
Ignorar cambios relevantes de product, channel, customer o market mix.  
Confundir un cambio de mix con un cambio de performance.  
Presentar conocimiento general como hecho del tenant.  
Ocultar contradicciones entre contexto declarado y observado.  
Rellenar variables desconocidas con supuestos no declarados.  
Globalizar un problema localizado.  
Asumir que ausencia implica incapacidad.  
Asumir que simplicidad implica inmadurez.  
Seleccionar la fuente de atribución que mejor encaje con una narrativa.  
Confirmar causalidad dentro de D2.  
Recomendar acciones.  
Decidir prioridad.

50\. Tests mínimos de D2

Debe existir cobertura para casos como:

test\_channel\_mix\_explains\_aggregate\_cvr\_change  
test\_product\_mix\_changes\_aov\_without\_efficiency\_change  
test\_invalid\_period\_comparison  
test\_black\_friday\_vs\_normal\_week  
test\_promotion\_lift\_not\_structural\_improvement  
test\_demand\_pull\_forward  
test\_stockout\_limits\_revenue  
test\_measurement\_discontinuity  
test\_declared\_vs\_observed\_context\_conflict  
test\_unknown\_context\_preserved  
test\_external\_benchmark\_not\_invented  
test\_temporal\_proximity\_not\_causality  
test\_multiple\_simultaneous\_changes\_reduce\_confidence  
test\_regime\_change\_degrades\_historical\_comparability  
test\_unreliable\_d1\_source\_degrades\_context\_confidence  
test\_premium\_strategy\_not\_treated\_as\_missing\_discount\_capability  
test\_local\_problem\_not\_globalized  
test\_context\_snapshot\_versioning

51\. Definition of Done

D2 estará correctamente construido cuando el sistema pueda responder, antes de diagnosticar:

¿Qué negocio estoy observando?  
¿Sobre qué alcance?  
¿En qué periodo?  
¿Contra qué baseline lo comparo?  
¿La comparación es válida?  
¿Qué mix ha cambiado?  
¿Qué promociones o eventos comerciales existen?  
¿Qué cambios internos ocurrieron recientemente?  
¿Ha cambiado la medición?  
¿Existe una restricción de stock o capacidad?  
¿Qué estrategia y objetivo condicionan la interpretación?  
¿Qué variables externas son relevantes?  
¿Qué confounders existen?  
¿Qué contexto está confirmado, declarado, inferido o en conflicto?  
¿Qué contexto crítico falta?  
¿Con qué confianza puedo usar este marco?

Solo después debe continuar el Sistema de Diagnóstico.

52\. Principio final

D2 no existe para añadir explicaciones decorativas alrededor de una métrica.

Existe para impedir que el sistema trate como equivalentes situaciones empresariales que no lo son.

La misma señal puede significar cosas distintas según el negocio, el periodo, el segmento, la estrategia, el mix, las restricciones y los cambios que la rodean.

El contrato de D2 obliga al copiloto a reconstruir ese marco antes de interpretar.  
