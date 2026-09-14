FASE 3 — SISTEMA DE DIAGNÓSTICO  
D9 — ROOT CAUSE & CONSTRAINT ENGINE

0\. Propósito contractual  
D9 recibe las hipótesis contrastadas de D8 y debe formalizar la conclusión causal sin invadir priorización ni recomendación.  
Debe distinguir obligatoriamente:  
SYMPTOM  
IMMEDIATE\_CAUSE  
INTERMEDIATE\_CAUSE  
ROOT\_CAUSE  
UNDERLYING\_DRIVER  
CURRENT\_CONSTRAINT

Invariante central:  
ROOT\_CAUSE ≠ CONSTRAINT

La root cause responde por qué está ocurriendo o se originó el problema investigado.  
El constraint responde qué parte del sistema está limitando actualmente el target relevante.  
Una root cause puede estar resuelta mientras el constraint sigue activo, y un constraint puede desaparecer mientras el driver estructural permanece.

1\. Inputs mínimos de D9  
D9 debe consumir, cuando estén disponibles:  
diagnostic\_case\_id  
business\_context  
maturity\_context  
capability\_health  
signals  
symptoms  
hypothesis\_result  
causal\_graph\_result  
data\_quality\_result  
context\_result  
known\_events  
historical\_case\_evidence  
requested\_scope  
target

La ausencia de evidencia crítica debe expresarse como limitación, no rellenarse mediante inferencia libre.

2\. Root Cause Promotion Gate  
Un ROOT\_CAUSE\_CANDIDATE de D8 solo puede promocionarse cuando pasa, como mínimo:  
VALID\_CAUSAL\_PATH  
TEMPORAL\_FIT  
SCOPE\_FIT  
MAGNITUDE\_FIT  
EVIDENCE\_SUPPORT  
ALTERNATIVE\_DISCRIMINATION  
FALSIFICATION\_ATTEMPT  
SUFFICIENT\_DEPTH

Secuencia contractual:  
HYPOTHESIS SUPPORTED  
→ CAUSAL PATH VALID  
→ FALSIFICATION PASSED  
→ ALTERNATIVES CHECKED  
→ DEPTH SUFFICIENT  
→ ROOT CAUSE

No se permite promocionar una hipótesis únicamente porque sea la mejor de un conjunto débil.

3\. Root Cause Status  
Estados canónicos:  
CANDIDATE  
PROBABLE  
SUPPORTED  
CONFIRMED  
PARTIAL  
INCONCLUSIVE  
UNRESOLVED  
REJECTED

CONFIRMED debe ser excepcional y requerir evidencia causal apropiada, por ejemplo evidencia directa, intervención suficientemente aislada, control comparable, logs o corroboración independiente.  
UNRESOLVED es una salida válida cuando no existe discriminación suficiente.  
PARTIAL se utiliza cuando una causa está soportada pero deja residual material sin explicar.

4\. ROOT\_CAUSE  
Objeto canónico:  
ROOT\_CAUSE  
id  
code  
statement  
family  
type  
status  
scope  
onset  
duration  
state  
causal\_path  
immediate\_cause  
intermediate\_causes  
underlying\_driver  
supporting\_evidence  
contradicting\_evidence  
rejected\_alternatives  
confidence  
explanatory\_coverage  
residual  
controllability  
reversibility  
affected\_capabilities  
limitations  
created\_at  
updated\_at  
version

El statement debe ser específico, falsable, scoped y respaldado por la cadena causal observada.

5\. Root Cause Families  
Taxonomía canónica disponible:  
MARKET  
PRODUCT  
OFFER  
ECONOMICS  
ACQUISITION  
CREATIVE  
CONVERSION  
RETENTION  
INVENTORY  
OPERATIONS  
FINANCE  
DATA  
TECHNOLOGY  
TEAM  
STRATEGY  
EXTERNAL

6\. Root Cause Type  
Tipos canónicos:  
ACUTE  
CHRONIC  
STRUCTURAL  
EVENT\_DRIVEN  
PROCESS  
CAPACITY  
CONFIGURATION  
QUALITY  
PLANNING  
DEPENDENCY  
EXTERNAL  
POSITIVE\_DRIVER

La clasificación no sustituye la evidencia del caso.

7\. Root Depth  
Niveles canónicos:  
D0 — Outcome  
D1 — Surface Driver  
D2 — Immediate Cause  
D3 — Root Cause  
D4 — Structural Driver

D9 debe detener la profundización cuando ir más arriba no mejora materialmente la utilidad diagnóstica.  
No debe detenerse demasiado pronto en una métrica intermedia si existe una rama causal upstream respaldada.  
No debe profundizar hasta causas abstractas sin soporte o utilidad diagnóstica.

8\. Causal Chain Contract  
CAUSAL\_CHAIN  
root  
structural\_driver  
intermediate\_nodes  
immediate\_cause  
symptom  
outcome  
edge\_confidences  
overall\_confidence  
scope  
onset

Roles permitidos en una cadena:  
STRUCTURAL\_DRIVER  
ROOT\_CAUSE  
INTERMEDIATE\_CAUSE  
IMMEDIATE\_CAUSE  
SYMPTOM  
OUTCOME

Cada edge crítico debe poder rastrearse a D7/D8 y a evidencia del caso.  
La confidence global no puede superar la confidence del eslabón crítico más débil cuando la conclusión depende de él.

9\. Root Cause Confidence  
Etiquetas:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT

HIGH requiere normalmente cadena fuertemente soportada, buen fit temporal/scope/magnitud, evidencia de calidad, pocas alternativas serias y falsification pass adecuado.  
MEDIUM: es la mejor explicación, pero permanece una incertidumbre material.  
LOW: es plausible, pero está débilmente discriminada.  
INSUFFICIENT: no puede establecerse una causa raíz.

Confidence caps obligatorios:  
\- La confidence de D9 no puede superar el límite impuesto por D1 cuando la causa depende de datos degradados.  
\- Una causal edge débil de D7 limita la conclusión salvo evidencia experimental/directa posterior que la refuerce.  
\- Si una alternativa seria permanece prácticamente igual de soportada, la root cause no puede presentarse como HIGH.  
\- La confidence debe disminuir cuando falla parcialmente temporalidad, scope, magnitud, mecanismo o falsificación.

10\. Causal Language Calibration  
HIGH: la evidencia indica que...  
MEDIUM: la causa más probable es...  
LOW: existe una explicación plausible...  
INSUFFICIENT: no puede establecerse todavía una causa raíz.

No usar lenguaje causal absoluto cuando la evidencia no lo permite.

11\. Multicausalidad y cobertura  
D9 debe soportar:  
PRIMARY\_ROOT\_CAUSE  
SECONDARY\_ROOT\_CAUSE  
CONTRIBUTING\_CAUSE  
ROOT\_CAUSES\[\]

No debe forzar una única causa cuando el fenómeno es materialmente multicausal.  
Cada causa puede incluir EXPLANATORY\_COVERAGE.  
Si la cuantificación exacta no está justificada, utilizar categorías cualitativas en lugar de pseudo-precisión.

Siempre conservar:  
UNEXPLAINED\_RESIDUAL  
cuando exista una parte material no explicada.

Root Cause Completeness:  
COMPLETE\_ENOUGH  
PARTIAL  
MATERIAL\_RESIDUAL  
INSUFFICIENT

Una causa puede tener HIGH confidence y explicar solo una parte limitada del fenómeno; confidence y coverage son dimensiones distintas.

12\. Root Cause Onset, Duration y State  
onset debe registrarse cuando pueda determinarse.  
Duration:  
TRANSIENT  
PERSISTENT  
CHRONIC

State:  
ACTIVE  
RESOLVED  
RECURRENT  
UNKNOWN

Una causa resuelta no se elimina del historial.  
Nueva evidencia puede actualizar estado y versión, manteniendo trazabilidad.

13\. Root Cause Rejection  
Un candidato debe marcarse REJECTED cuando la evidencia invalida de forma material:  
time  
scope  
mechanism  
magnitude  
evidence

Las causas rechazadas deben conservarse en REJECTED\_CAUSE\_LEDGER; nunca deben borrarse para ocultar rutas investigadas.

14\. Recurrence y final falsification  
Antes de cerrar una causa raíz, D9 debe comprobar:  
Has this root cause appeared before?  
What evidence would make this cause impossible?

Final falsification pass mínimo:  
TEMPORAL  
SCOPE  
MAGNITUDE  
MECHANISM  
ALTERNATIVE

La recurrencia puede justificar investigar un UNDERLYING\_DRIVER estructural, pero una repetición histórica no constituye prueba del caso actual.

15\. CONSTRAINT Definition  
Un CONSTRAINT es la capacidad, recurso, condición o dependencia que actualmente limita el resultado, throughput, crecimiento, eficiencia o estabilidad del target definido.

No toda weakness es constraint.  
No todo maturity gap es constraint.  
No todo estado de salud negativo es constraint.  
No todo problema diagnosticado requiere un constraint empresarial.

16\. Constraint Applicability  
APPLICABLE  
NOT\_APPLICABLE  
UNKNOWN

Puede existir root cause conocida sin business constraint aplicable, especialmente cuando el problema afecta medición y no throughput del negocio.  
Puede existir constraint conocido aunque la causa raíz que lo originó continúe UNRESOLVED.

17\. Constraint Target  
Toda evaluación debe declarar TARGET.  
Targets canónicos mínimos:  
Revenue  
Profitability  
Cash  
Growth  
Customer Experience  
Operational Capacity

El constraint es target-dependent. No existe un constraint universal para todos los objetivos simultáneamente.

18\. Constraint Types  
Taxonomía mínima:  
DEMAND\_CONSTRAINT  
PRODUCT\_CONSTRAINT  
OFFER\_CONSTRAINT  
ACQUISITION\_CONSTRAINT  
CREATIVE\_CONSTRAINT  
CONVERSION\_CONSTRAINT  
RETENTION\_CONSTRAINT  
INVENTORY\_CONSTRAINT  
OPERATIONS\_CONSTRAINT  
FINANCIAL\_CONSTRAINT  
DATA\_CONSTRAINT  
TECHNOLOGY\_CONSTRAINT  
TEAM\_CONSTRAINT  
STRATEGY\_CONSTRAINT

19\. Constraint Scope  
GLOBAL  
CAPABILITY  
CHANNEL  
MARKET  
PRODUCT  
SEGMENT  
TEMPORARY  
STRUCTURAL

Un constraint localizado no puede generalizarse al negocio completo sin evidencia de exposición suficiente.  
D9 debe permitir múltiples constraints simultáneos cuando pertenecen a scopes distintos.

20\. Constraint Horizon  
CURRENT  
NEAR\_TERM  
NEXT\_STAGE

Binding status:  
BINDING\_CONSTRAINT  
LATENT\_CONSTRAINT

BINDING\_CONSTRAINT limita el target actual.  
LATENT\_CONSTRAINT todavía no limita el output actual, pero existe evidencia suficiente de que puede convertirse en binding al siguiente nivel de escala.

21\. Constraint Ladder  
PRIMARY\_CONSTRAINT  
SECONDARY\_CONSTRAINT  
LATENT\_CONSTRAINT

PRIMARY\_CONSTRAINT: limita en mayor medida el target actual.  
SECONDARY\_CONSTRAINT: puede convertirse en relevante cuando desaparece el primario.  
LATENT\_CONSTRAINT: probablemente emergerá al aumentar la carga o escala.

22\. Constraint Strength  
WEAK  
MODERATE  
STRONG  
BINDING

Constraint Confidence:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT

Constraint Duration:  
TEMPORARY  
PERSISTENT  
STRUCTURAL

Constraint Severity puede registrarse como señal preliminar LOW/MODERATE/HIGH/CRITICAL, pero D10 es responsable de formalizar severidad e impacto empresarial.

23\. CONSTRAINT Object  
CONSTRAINT  
id  
code  
target  
capability  
subcapability  
scope  
type  
applicability  
binding\_status  
strength  
confidence  
capacity\_state  
capacity\_gap  
business\_effect  
evidence  
dependency  
time\_horizon  
duration  
trajectory  
controllability  
limitations  
created\_at  
updated\_at  
version

24\. Constraint Detection Engine  
Flujo mínimo:  
CURRENT BUSINESS TARGET  
→ REQUIRED FLOW  
→ CAPACITY / PERFORMANCE LIMITS  
→ ACTIVE BOTTLENECKS  
→ BINDING CONSTRAINT

D9 debe demostrar que el candidato limita el target, no solo que está débil.

25\. Constraint Binding Test  
Pregunta contractual:  
Which one currently prevents additional target output first?

Binding relation requerida:  
more upstream input  
→ cannot produce more target output  
→ because of this node

Counterfactual mínimo:  
Si esta restricción desapareciera manteniendo el resto igual, ¿podría mejorar materialmente el target?  
Si la respuesta es no, el candidato no debe declararse binding constraint.

26\. Constraint Evidence Types  
CAPACITY\_LIMIT  
HARD\_UNAVAILABILITY  
MARGINAL\_DEGRADATION  
QUEUE  
RESOURCE\_SHORTAGE  
ECONOMIC\_GUARDRAIL  
SYSTEM\_DEPENDENCY

La evidencia debe poder falsar el constraint candidato, no solo apoyarlo.

27\. Constraint Finalization Gate  
TARGET DEFINED  
→ CAPACITY LIMIT IDENTIFIED  
→ LIMIT BINDS TARGET  
→ COUNTERFACTUAL PLAUSIBLE  
→ CONSTRAINT

No debe declararse un constraint basándose únicamente en utilización alta, health bajo, maturity gap grande o intuición del LLM.

28\. Constraint Shift  
Cuando cambia el cuello de botella activo debe registrarse:  
CONSTRAINT\_SHIFT

Mantener:  
constraint\_history

El runtime debe poder representar que una corrección desbloquea una capacidad y hace emerger otra como nuevo constraint.

29\. Root Cause y Constraint Registries  
ROOT\_CAUSE\_DEFINITION  
code  
family  
mechanism  
common\_symptoms  
required\_evidence  
possible\_constraints  
common\_confounders  
version  
status

CONSTRAINT\_DEFINITION  
code  
target  
capability  
binding\_conditions  
capacity\_metric  
evidence\_requirements  
version  
status

Los registries ayudan a normalizar terminología; nunca autorizan un mapping rígido SYMPTOM → ROOT\_CAUSE ni sustituyen evidencia del tenant.

30\. Canonical Cause Codes  
El runtime puede mapear conceptos equivalentes a códigos canónicos, conservando statement específico del caso.  
Ejemplos existentes en el conocimiento:  
PAYMENT\_CONFIG\_REGRESSION  
HERO\_SKU\_STOCKOUT  
FORECAST\_UNDERESTIMATION  
CREATIVE\_PIPELINE\_CAPACITY\_SHORTFALL  
AUDIENCE\_SATURATION  
PRICE\_RESISTANCE  
FULFILLMENT\_CAPACITY\_SATURATION  
TRACKING\_REGRESSION  
WORKING\_CAPITAL\_SHORTFALL

31\. Conflictos y deduplicación  
ROOT\_CAUSE\_CONFLICT debe registrarse cuando agentes/caminos proponen conclusiones incompatibles.  
Resolución debe comparar:  
evidence  
causal\_path  
scope  
time  
coverage  
confidence

La autoridad del agente no decide el ganador.

Root Cause Deduplication:  
conceptos semánticamente equivalentes no deben registrarse como causas distintas por diferencias de redacción.

Constraint Conflict:  
si varias capacidades parecen limitar, aplicar target, scope y binding test antes de determinar primary/secondary/parallel constraints.

32\. Orquestación multiagente  
El orquestador debe poder sintetizar causas cross-capability a partir de outputs especializados.  
Todos los agentes deben compartir los objetos y estados definidos por D9.  
Una conclusión downstream de un agente puede ser un nodo intermedio para otro; el orquestador debe reconstruir la cadena más profunda que siga estando respaldada.

33\. Controllability y Reversibility  
Controllability:  
CONTROLLABLE  
PARTIALLY\_CONTROLLABLE  
EXTERNAL

Reversibility:  
EASILY\_REVERSIBLE  
REVERSIBLE  
DIFFICULT  
UNKNOWN

Estas dimensiones describen la naturaleza de la causa/constraint; D9 no puede convertirlas en prioridad o recomendación.

34\. Boundaries de D9  
D9 identifica y describe, pero no recomienda acciones empresariales.  
Permitido:  
\- identificar root cause;  
\- identificar underlying driver;  
\- identificar constraint;  
\- generar pruebas diagnósticas read-only o proponer qué evidencia faltaría;  
\- estimar dirección del throughput desbloqueable cuando esté soportado.

No permitido en D9:  
\- decidir qué atacar primero;  
\- recomendar una estrategia;  
\- ordenar inventario, cambiar proveedores, modificar campañas u otras acciones operativas;  
\- ejecutar tests riesgosos para demostrar una causa.

D10 recibe root cause, constraint, scope, coverage y trajectory para estimar severidad/impacto.  
D11 formaliza incertidumbre final.  
D12 realiza el último control de confounders/false diagnoses.  
D13 analiza onset, persistence, regression y recovery.  
D14 presenta el diagnóstico final.

35\. ROOT\_CAUSE\_RESULT  
Salida canónica de D9:  
ROOT\_CAUSE\_RESULT  
primary\_root\_cause  
secondary\_root\_causes  
immediate\_causes  
intermediate\_causes  
underlying\_drivers  
current\_constraint  
secondary\_constraints  
latent\_constraints  
causal\_chain  
explanatory\_coverage  
unexplained\_residual  
root\_cause\_completeness  
confidence  
constraint\_confidence  
rejected\_causes  
limitations  
scope  
trajectory

Root cause y constraint deben poder ser null/UNRESOLVED/NOT\_APPLICABLE según evidencia y aplicabilidad; nunca se rellenan para completar el schema.

36\. Persistencia y memoria  
Mantener por tenant:  
root\_cause\_history  
constraint\_history  
rejected\_cause\_ledger  
constraint\_shifts

Diagnostic Case Memory puede conservar:  
Problem  
Symptom  
Root Cause  
Constraint  
Evidence  
Resolution  
Outcome

La memoria histórica puede elevar priors o ayudar a detectar recurrencia, pero nunca constituye evidencia suficiente para el caso actual por sí sola.

37\. Runtime vs LLM  
Runtime debe gestionar como mínimo:  
root cause schema  
candidate promotion rules  
confidence caps  
causal path integrity  
constraint binding tests  
scope  
state transitions  
versioning  
history  
deduplication  
finalization gates

LLM puede:  
synthesize causal chain  
determine useful root depth  
compare root candidates  
explain constraint  
identify structural driver  
redact narrative causal

Todo output del LLM debe volver a validación estructural/evidencial.

Debe permanecer determinista cuando sea posible:  
metric decomposition  
time ordering  
scope checks  
exposure  
capacity ratios  
known equations

Arquitectura híbrida:  
D8 HYPOTHESES  
→ CAUSAL VALIDATOR  
→ ROOT DEPTH ANALYZER  
→ ROOT CAUSE SYNTHESIS  
→ CONSTRAINT ENGINE  
→ D9 RESULT

38\. Admin Observability  
Para cada Diagnostic Case debe poder reconstruirse:  
Surface symptom  
Immediate cause  
Intermediate causes  
Root cause candidates  
Primary root cause  
Underlying driver  
Causal chain  
Alternative root causes  
Rejected causes  
Current constraint  
Secondary constraints  
Latent constraints  
Constraint shifts  
Explanatory coverage  
Residual  
Root confidence  
Constraint confidence  
Evidence links  
Falsification checks  
Versions

39\. Tests mínimos D9  
test\_symptom\_not\_root\_cause  
test\_immediate\_vs\_root\_cause  
test\_root\_depth\_not\_too\_shallow  
test\_root\_depth\_not\_too\_abstract  
test\_multicausal\_root\_causes  
test\_partial\_root\_cause  
test\_unresolved\_root\_cause  
test\_temporal\_invalid\_root\_rejected  
test\_scope\_invalid\_root\_rejected  
test\_magnitude\_invalid\_root\_rejected  
test\_constraint\_differs\_from\_root  
test\_binding\_constraint  
test\_latent\_constraint  
test\_constraint\_shift  
test\_data\_problem\_no\_fake\_business\_root

40\. Evals / fixtures D9  
Los fixtures de D9 deben cubrir como mínimo:  
\- causa demasiado superficial;  
\- causa correctamente profundizada;  
\- causa demasiado abstracta;  
\- inventory: stockout vs forecast/under-ordering y constraint de disponibilidad;  
\- data: tracking regression sin inventar business conversion root cause;  
\- caso multicausal;  
\- root cause UNRESOLVED por falta de evidencia;  
\- binding inventory constraint;  
\- weakness que no es constraint;  
\- latent operations constraint;  
\- constraint shift tras desbloquear el anterior.

Expected outputs deben validar roles, estados, confidence, residual, applicability y separación root cause/constraint.

41\. Invariantes D9  
El sistema nunca debe:  
\- confundir síntoma con causa;  
\- confundir causa inmediata con root cause;  
\- confundir root cause con underlying driver;  
\- confundir root cause con constraint;  
\- confundir weakness con constraint;  
\- confundir constraint con prioridad;  
\- forzar una única causa cuando existe multicausalidad;  
\- forzar root cause cuando los datos son insuficientes;  
\- declarar root cause sin causal path válido;  
\- ignorar temporalidad, scope o magnitud;  
\- profundizar hasta causas abstractas sin utilidad;  
\- detenerse demasiado pronto en una métrica intermedia cuando existe evidencia upstream;  
\- ocultar unexplained residual;  
\- generalizar una causa localizada;  
\- culpar a una persona sin evidencia y sin necesidad diagnóstica;  
\- confundir problema de medición con problema del negocio;  
\- asumir que el peor health state es el constraint;  
\- asumir que el mayor maturity gap es el constraint;  
\- asumir que un constraint es permanente;  
\- ocultar constraint shifts;  
\- recomendar acciones desde D9;  
\- convertir controllability en prioridad;  
\- presentar confidence mayor que la evidencia causal disponible.

42\. Definition of Done  
D9 está completo cuando puede responder estructuradamente:  
¿Cuál es el síntoma?  
¿Cuál es la causa inmediata?  
¿Qué mecanismos intermedios existen?  
¿Cuál es la causa raíz mejor soportada?  
¿Es suficientemente profunda?  
¿Estoy profundizando demasiado?  
¿Existe un underlying structural driver?  
¿Hay una sola causa o varias?  
¿Cuánto del fenómeno explica cada una?  
¿Qué parte sigue sin explicación?  
¿Qué causas fueron rechazadas?  
¿Cuál es el constraint actual?  
¿Ese constraint realmente limita el target?  
¿Es global o localizado?  
¿Es temporal o estructural?  
¿Existe un constraint latente?  
¿Ha cambiado el constraint respecto a periodos anteriores?  
¿La causa sigue activa?  
¿Con qué confianza afirmamos cada nivel?

D9 termina con una conclusión causal formal y un constraint correctamente delimitado. No decide todavía prioridad ni acción empresarial.  
