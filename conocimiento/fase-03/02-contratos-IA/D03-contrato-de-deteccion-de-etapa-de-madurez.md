FASE 3 — SISTEMA DE DIAGNÓSTICO  
D3 — CONTRATO DE DETECCIÓN DE ETAPA DE MADUREZ

0\. Propósito  
D3 convierte el modelo de madurez de la Fase 2 en una variable diagnóstica operable. Debe determinar qué nivel estructural ha construido el negocio, qué nivel presenta cada capacidad y qué madurez exige razonablemente su complejidad actual.

D1 responde si los datos son fiables.  
D2 establece el contexto correcto.  
D3 determina la madurez estructural y los gaps que condicionarán la interpretación de D4 y de los bloques posteriores.

D3 no decide prioridad, estrategia ni acción. Tampoco debe confundir una carencia estructural con un problema operativo actual.

1\. Invariantes centrales  
REVENUE ≠ MATURITY  
STATE ≠ STAGE  
USING TOOL ≠ HAVING CAPABILITY  
PERFORMANCE ≠ MATURITY

CAPABILITY HEALTH debe interpretarse respecto a BUSINESS MATURITY \+ CAPABILITY MATURITY \+ BUSINESS COMPLEXITY \+ CURRENT SCALE.

La etapa no puede derivarse únicamente de facturación, rendimiento puntual, número de empleados, herramientas instaladas, automatizaciones o documentación existente.

2\. Fuente de verdad de Stage Gates  
D3 reutiliza el modelo E0–E12 definido en Fase 2:  
E0 — Pre-Business  
E1 — Validation  
E2 — Initial Traction  
E3 — Repeatability  
E4 — Functional Foundation  
E5 — Controlled Growth  
E6 — Scaling  
E7 — Professionalization  
E8 — Multi-System Scaling  
E9 — Operational Sophistication  
E10 — Advanced Organization  
E11 — Enterprise Intelligence  
E12 — Adaptive Organization

Los nombres y requisitos definitivos deben mantenerse consistentes con Fase 2\. D3 no redefine los Stage Gates: los utiliza.

3\. Dependencias de entrada  
D3 debe consumir, cuando estén disponibles:  
\- resultado de D1 / DATA\_QUALITY;  
\- resultado de D2 / CONTEXT\_RESULT;  
\- evidencia de capacidades;  
\- procesos, sistemas y comportamientos observados;  
\- documentación disponible;  
\- integraciones y métricas;  
\- información declarada por el usuario;  
\- escala y complejidad del negocio;  
\- cambios históricos de madurez cuando existan.

Una fuente marcada por D1 como poco fiable no puede sostener por sí sola una clasificación de madurez alta.

4\. BUSINESS\_STAGE y CAPABILITY\_STAGE  
Toda evaluación debe poder representar un BUSINESS\_STAGE.

Además, cada capacidad relevante debe poder tener su propio CAPABILITY\_STAGE.

La etapa global no debe copiarse automáticamente a todas las áreas. La madurez asimétrica es válida y esperable.

5\. COMPLEXITY\_PROFILE  
D3 debe construir un COMPLEXITY\_PROFILE capaz de representar, cuando sean materiales:  
revenue\_scale  
order\_volume  
sku\_complexity  
market\_complexity  
channel\_complexity  
fulfillment\_complexity  
team\_complexity  
technology\_complexity  
financial\_complexity  
customer\_complexity

La complejidad no equivale a madurez. Su función es ayudar a determinar qué madurez necesita realmente el negocio.

6\. AVAILABLE MATURITY vs REQUIRED MATURITY  
D3 debe separar la madurez disponible de la madurez requerida.

REQUIRED MATURITY puede depender de factores como:  
Revenue Scale  
Order Volume  
SKU Complexity  
Market Count  
Channel Count  
Team Size  
Fulfillment Complexity  
Customer Base  
Growth Rate  
Inventory Exposure  
Cash Exposure

No toda capacidad avanzada ausente constituye un problema. Solo debe considerarse gap cuando la capacidad sea material para los requisitos actuales del negocio.

7\. MATURITY\_GAP  
Conceptualmente:  
REQUIRED\_STAGE \- CURRENT\_CAPABILITY\_STAGE \= MATURITY\_GAP

El gap debe calcularse por capacidad, no únicamente a nivel global.

Un gap aislado no equivale a prioridad.

8\. Dependency-weighted gap  
Cuando existan dependencias relevantes debe considerarse:  
MATURITY\_GAP × DEPENDENCY\_IMPORTANCE

Un gap menor en una capacidad crítica puede ser más importante estructuralmente que un gap mayor en una capacidad poco relevante para la estrategia actual.

9\. STRATEGIC\_RELEVANCE  
Cada maturity gap relevante debe poder asociarse con STRATEGIC\_RELEVANCE.

D3 debe considerar si la capacidad forma parte de la estrategia actual, sostiene otras capacidades o concentra una exposición material.

10\. Maturity Risk  
Como marco conceptual, el riesgo de madurez puede considerar:  
Gap  
× Business Dependency  
× Complexity  
× Growth Velocity  
× Exposure

No debe implementarse necesariamente como fórmula literal. Su objetivo es impedir que todos los gaps reciban el mismo significado.

11\. Estados diagnósticos de madurez por capacidad  
Cada capacidad debe poder adoptar uno de estos estados respecto a lo requerido:  
AHEAD\_OF\_STAGE  
APPROPRIATE\_FOR\_STAGE  
SLIGHTLY\_BEHIND  
MATERIALLY\_BEHIND  
CRITICALLY\_BEHIND  
NOT\_ASSESSABLE

NOT\_ASSESSABLE debe utilizarse cuando no existe evidencia suficiente. Nunca debe sustituirse por una etapa inferida desde el BUSINESS\_STAGE.

12\. Stage Detection  
D3 no debe resolver la etapa preguntando al LLM únicamente “¿Qué etapa crees que es?”.

La clasificación debe apoyarse en evidencia estructurada y en los Stage Gates de Fase 2\.

13\. STAGE\_EVIDENCE  
D3 debe poder asociar evidencia a cada clasificación.

STAGE\_EVIDENCE puede incluir hechos como:  
repeatable acquisition  
documented unit economics  
basic forecasting  
multi-channel acquisition  
dedicated team  
advanced retention  
formal financial planning

Cada evidencia debe conservar su procedencia y estado de verificación cuando sea posible.

14\. Stage Gates  
Cada etapa debe exigir una combinación mínima de:  
capabilities  
processes  
systems  
behaviors

No solo métricas económicas.

15\. Gate Principle  
Para superar un Stage Gate deben existir los core prerequisites definidos para ese nivel.

Una sofisticación avanzada en una capacidad no compensa automáticamente la ausencia de un requisito estructural fundamental.

16\. HARD\_GATE y SOFT\_GATE  
D3 debe distinguir:  
HARD\_GATE — requisito cuya ausencia bloquea una determinada clasificación.  
SOFT\_GATE — elemento que aporta evidencia de madurez pero cuya ausencia no bloquea por sí sola el Stage.

Los hard gates y soft gates concretos deben derivar del modelo de Fase 2 y no inventarse durante la inferencia.

17\. Stage Confidence  
Toda clasificación debe devolver confianza.

Ejemplos válidos:  
stage: E6  
confidence: HIGH

o  
stage: E6–E7  
confidence: MEDIUM

El sistema no debe fingir una precisión que la evidencia no sostiene.

18\. Stage Range  
Cuando la evidencia no permita un único Stage preciso, D3 debe poder representar:  
MINIMUM\_CONFIRMED\_STAGE  
MOST\_LIKELY\_STAGE  
POSSIBLE\_STAGE

19\. MATURITY\_ASSESSMENT status  
La evaluación global debe poder adoptar:  
COMPLETE  
PARTIAL  
INSUFFICIENT

La ausencia de evidencia en áreas relevantes debe degradar la completitud y la confianza.

20\. Capability Evidence  
Cada CAPABILITY\_STAGE debe enlazar la evidencia que lo justifica.

Ejemplo de estructura conceptual:  
CAPABILITY: Finance  
stage: E4  
evidence:  
weekly cash visibility: true  
contribution margin: partial  
forecasting: false  
scenario planning: false  
channel profitability: partial

21\. Claimed vs Observed Capability  
D3 debe distinguir:  
CLAIMED\_CAPABILITY  
OBSERVED\_CAPABILITY

Una descripción del usuario no basta por sí sola para elevar la madurez si el comportamiento observable no la confirma.

22\. Capability Verification  
Estados de verificación permitidos:  
VERIFIED  
PARTIALLY\_VERIFIED  
SELF\_REPORTED  
INFERRED  
UNKNOWN

La clasificación debe preservar el estado de verificación de la evidencia.

23\. Maturity evidence hierarchy  
Como principio de fuerza probatoria, D3 debe favorecer evidencia del comportamiento real sobre afirmaciones no contrastadas. El orden conceptual del documento fuente es:  
OBSERVED SYSTEM BEHAVIOR  
SYSTEM DATA  
DOCUMENTED PROCESS  
USER CLAIM

Esta jerarquía no elimina la necesidad de considerar calidad, actualidad, alcance y contradicciones de la evidencia.

24\. MATURITY\_EVIDENCE\_CONFLICT  
Cuando una capacidad declarada como avanzada contradiga requisitos o evidencia estructural, D3 debe registrar MATURITY\_EVIDENCE\_CONFLICT en lugar de resolver la contradicción silenciosamente.

Ejemplo: advanced profitability system \+ COGS unreliable.

25\. Automated maturity inference  
D3 puede inferir madurez automáticamente desde integraciones, métricas, procesos, documentos, conversaciones y acciones cuando exista evidencia suficiente.

Debe evitar sobreinferir. La ausencia de una señal observable no demuestra automáticamente ausencia de capacidad.

26\. Passive maturity detection  
El perfil de madurez puede refinarse progresivamente al obtener nueva evidencia.

Una evaluación posterior puede reducir un rango amplio o elevar la confianza sin reescribir silenciosamente la evaluación histórica anterior.

27\. Structural maturity vs current health  
D3 debe preservar STRUCTURAL\_MATURITY.

D4 y los bloques de salud reflejarán CURRENT\_HEALTH.

Un fallo temporal grave no debe reclasificar automáticamente la madurez estructural del negocio.

28\. MATURITY\_REGRESSION  
Una capacidad puede perder madurez estructural cuando existe evidencia sostenida de pérdida de procesos, equipo, sistemas utilizados o calidad de datos.

Un incidente temporal no constituye por sí solo MATURITY\_REGRESSION.

29\. Maturity Trajectory  
Cada capacidad debe poder adoptar:  
ADVANCING  
STABLE  
STAGNATING  
REGRESSING  
UNKNOWN

La trayectoria debe apoyarse en evidencia histórica o snapshots comparables.

30\. STRUCTURAL\_DEBT y MATURITY\_DEBT  
Cuando una capacidad permanece por debajo de la complejidad empresarial durante un periodo material puede existir STRUCTURAL\_DEBT.

MATURITY\_DEBT debe poder representar:  
capability  
required\_stage  
current\_stage  
gap  
duration  
business\_dependency  
risk

31\. STRUCTURAL\_ANOMALY  
D3 puede marcar STRUCTURAL\_ANOMALY cuando una capacidad esté fuertemente desalineada respecto al resto o respecto a los requisitos del negocio.

32\. CAPABILITY\_STAGE\_VARIANCE  
D3 puede representar la dispersión entre etapas mediante CAPABILITY\_STAGE\_VARIANCE.

La dispersión no implica automáticamente un problema: debe diferenciar especialización saludable de un desequilibrio peligroso.

33\. Stage Compatibility  
D3 debe poder reconocer combinaciones estructuralmente incompatibles o peligrosas, especialmente cuando una capacidad avanzada depende de otra claramente rezagada.

Ejemplos del modelo:  
High Acquisition \+ Low Finance → unprofitable scaling  
High Acquisition \+ Low Inventory → stockout-driven growth failure  
High Creative \+ Low Conversion → more traffic into inefficient funnel  
High Growth \+ Low Operations → customer experience collapse  
High Revenue \+ Low Data → management blindness

34\. Capability dependency maturity  
Una capacidad avanzada no debe considerarse plenamente sustentada cuando requiere una capacidad base que no existe o no es fiable.

Ejemplo: advanced profitability optimization requiere reliable unit economics.

35\. Structural Constraint Candidate  
D3 puede producir STRUCTURAL\_CONSTRAINT\_CANDIDATE cuando una capacidad insuficientemente desarrollada pueda limitar el siguiente nivel estructural.

El candidato deberá ser investigado posteriormente por el bloque correspondiente de root cause/constraint. D3 no lo confirma como prioridad.

36\. MATURITY\_BOTTLENECK  
D3 puede identificar MATURITY\_BOTTLENECK como la capacidad insuficientemente desarrollada que limita el siguiente nivel estructural.

MATURITY\_BOTTLENECK ≠ CURRENT ISSUE  
MATURITY\_BOTTLENECK ≠ PRIORITY

37\. Growth-System Gap y Fragile Growth  
Cuando BUSINESS COMPLEXITY supera materialmente SYSTEM MATURITY puede existir GROWTH\_SYSTEM\_GAP.

Si el output económico crece más rápido que las capacidades que lo sostienen puede marcarse FRAGILE\_GROWTH cuando la evidencia sea compatible.

38\. PREMATURE\_SCALING  
D3 puede detectar PREMATURE\_SCALING cuando el negocio incrementa spend, team, markets o inventory sin capacidades base suficientes para sostener esa escala.

39\. OVERENGINEERING y COMPLEXITY\_THEATER  
D3 debe poder distinguir capacidad madura de complejidad innecesaria.

Puede existir OVERENGINEERING cuando SYSTEM COMPLEXITY excede claramente BUSINESS NEED.

Puede existir COMPLEXITY\_THEATER cuando el negocio parece sofisticado por herramientas, dashboards, automatizaciones o arquitectura, pero carece de fundamentos suficientes.

40\. CANNOT vs CHOOSES\_NOT\_TO  
D3 debe distinguir:  
CANNOT — la capacidad no existe o no puede ejecutarse.  
CHOOSES\_NOT\_TO — la empresa podría hacerlo, pero deliberadamente no lo hace por estrategia o restricción.

La simplicidad deliberada no debe clasificarse automáticamente como inmadurez.

41\. D1 consistency  
D3 debe consumir el resultado de D1.

Si DATA\_QUALITY \= FAIL o una fuente es unreliable, debe reducirse la fuerza de la evidencia de madurez dependiente de esa fuente.

No puede restaurarse la credibilidad de un dato solo porque encaje con una etapa plausible.

42\. D2 consistency  
D3 debe consumir el contexto de D2.

La evaluación debe respetar estrategia, complejidad, restricciones y elecciones deliberadas. Por ejemplo, una estrategia premium sin promociones complejas no demuestra por sí sola baja Offer maturity.

43\. SCALING\_READINESS  
D3 puede producir SCALING\_READINESS para describir si la infraestructura está estructuralmente preparada para soportar la complejidad actual o adicional.

SCALING\_READINESS no decide si el negocio debe escalar.

44\. Scaling Readiness Domains  
Los dominios pueden adoptar, cuando sea aplicable:  
READY  
PARTIAL  
NOT\_READY

La readiness global debe considerar dependencias críticas; no puede obtenerse como simple promedio de dominios.

45\. STAGE\_GATE\_FAILURE  
Cuando el negocio opera con complejidad propia de un nivel pero incumple un requisito estructural relevante, D3 puede emitir STAGE\_GATE\_FAILURE.

46\. MATURITY\_TRANSITION  
Los cambios estructurales deben poder registrarse como MATURITY\_TRANSITION.

Campos conceptuales:  
from  
to  
status

Ejemplo:  
from: AD\_HOC  
to: SYSTEMIZED  
status: INCOMPLETE

47\. MATURITY\_SNAPSHOT  
Cada evaluación debe poder guardar un MATURITY\_SNAPSHOT con:  
business\_stage  
capability\_stages  
complexity\_profile  
required\_stages  
maturity\_gaps  
confidence  
evidence  
timestamp

48\. Versioning  
Los snapshots no deben sobrescribirse silenciosamente.

Cada cambio relevante de Stage debe poder justificar MATURITY\_CHANGE\_REASON.

Una mejora puntual de métricas durante una semana no constituye por sí sola promoción de Stage.

49\. Primary representation  
Las puntuaciones numéricas pueden existir como representación secundaria, pero el objeto principal de D3 debe ser estructural y explicable:  
capability stage  
evidence  
gap  
required stage  
risk

D3 no debe degradarse a un vanity score sin significado diagnóstico.

50\. MATURITY\_RESULT  
D3 debe producir un objeto equivalente a MATURITY\_RESULT capaz de incluir:  
business\_stage  
business\_stage\_confidence  
complexity\_profile  
capabilities  
required\_capability\_stages  
maturity\_gaps  
structural\_debt  
maturity\_trajectory  
scaling\_readiness  
structural\_risks  
stage\_gate\_failures  
evidence  
limitations

Para cada capability, cuando sea evaluable, debe poder conservar al menos:  
stage  
required\_stage  
status  
confidence  
evidence  
verification\_state

Cuando sea relevante también puede conservar:  
strategic\_relevance  
business\_dependency  
structural\_anomaly  
maturity\_debt  
trajectory

51\. Output obligatorio hacia D4+  
D3 debe entregar como mínimo, cuando exista evidencia suficiente:  
business\_stage  
business\_stage\_confidence  
capability\_stages  
required\_capability\_stages  
maturity\_gaps  
structural\_debt  
maturity\_trajectory  
complexity\_profile  
scaling\_readiness  
structural\_risks  
stage\_gate\_failures  
evidence  
limitations

52\. Maturity-aware questioning  
El copiloto no debe formular exactamente las mismas preguntas a todos los negocios.

Las preguntas deben adaptarse al nivel y complejidad relevantes. Una empresa temprana puede necesitar confirmar gross margin; una empresa avanzada puede requerir contribution por channel, cohort y market.

53\. Adaptive diagnostic depth  
El nivel de profundidad debe escalar con la madurez y complejidad del negocio.

SAME DIAGNOSTIC QUALITY ≠ SAME DIAGNOSTIC COMPLEXITY

Una empresa temprana merece el mismo rigor, pero no análisis avanzados irrelevantes.

54\. NEXT\_REQUIRED\_CAPABILITY  
D3 debe poder identificar la NEXT\_REQUIRED\_CAPABILITY estructural cuando sea útil para los bloques posteriores.

Esto no equivale todavía a recomendar una acción ni a asignar prioridad.

55\. D3 invariants  
El sistema nunca debe:  
\- Utilizar revenue como único indicador de madurez.  
\- Asumir que todas las capacidades tienen la misma etapa.  
\- Penalizar una capacidad avanzada que no es necesaria.  
\- Confundir complejidad con madurez.  
\- Confundir herramientas con capacidades.  
\- Confundir empleados con madurez.  
\- Confundir automatización con calidad.  
\- Confundir buen rendimiento puntual con madurez.  
\- Confundir un fallo temporal con regresión estructural.  
\- Inferir madurez de una capacidad sin evidencia.  
\- Asumir que la etapa global determina todas las áreas.  
\- Ignorar la complejidad del negocio.  
\- Ignorar el ritmo de crecimiento.  
\- Ignorar dependencias entre capacidades.  
\- Comparar empresas únicamente por tamaño.  
\- Exigir sofisticación irrelevante.  
\- Tratar simplicidad deliberada como inmadurez.  
\- Permitir que un framework externo contradiga evidencia del negocio sin justificación.  
\- Recomendar acciones.  
\- Confundir maturity gap con prioridad.

56\. Runtime rules que no dependen únicamente de retrieval  
Las siguientes reglas deben residir en runtime/contrato y no depender solo del RAG:  
stage calculation  
required-stage mapping  
gap detection  
confidence  
hard gates  
structural debt detection

También deben permanecer en runtime los enums, estados de verificación, reglas de versionado, dependencias D1/D2 y el contrato MATURITY\_RESULT.

57\. Tests necesarios  
Fixtures iniciales obligatorios:  
test\_high\_revenue\_low\_maturity  
test\_low\_revenue\_high\_maturity  
test\_asymmetric\_capabilities  
test\_temporary\_failure\_preserves\_stage  
test\_maturity\_regression  
test\_overengineering  
test\_premature\_scaling  
test\_complexity\_exceeds\_systems  
test\_deliberate\_simplicity  
test\_tool\_does\_not\_imply\_capability  
test\_missing\_evidence\_returns\_unknown  
test\_dependency\_weighted\_gap

58\. Fixture — High revenue / low maturity  
Input de referencia:  
Revenue: €12M  
Acquisition: founder-managed  
Finance: basic monthly P\&L  
Inventory: manual  
Creative: ad hoc  
Data: platform dashboards only

Expected:  
Business output: HIGH  
Structural maturity: materially lower than economic scale  
Fragile growth: LIKELY

59\. Fixture — Advanced failure  
Input:  
Business: E10  
Conversion system: advanced  
Deployment: checkout bug  
CVR: \-40%

Expected:  
Conversion maturity: remains advanced  
Current health: critical

60\. Fixture — Overengineering  
Input:  
Revenue: €15k/month  
4 SKUs  
1 country  
basic operations  
Technology: custom warehouse \+ complex ML forecasting project

Expected:  
possible overengineering

61\. Fixture — Maturity imbalance  
Input:  
Acquisition: E9  
Finance: E3  
Inventory: E4

Expected:  
structural imbalance: HIGH  
scaling readiness: DEGRADED

62\. Fixture — Deliberate simplicity  
Input:  
No discounting  
premium positioning  
strong margins  
stable CVR  
clear pricing policy

Expected:  
Do not infer low Offer maturity merely because promotions are absent.

63\. Fixture — Missing evidence  
Input:  
Finance information: none

Expected:  
Finance stage: NOT\_ASSESSABLE  
No: E3

64\. Definition of Done  
D3 estará correctamente construido cuando el sistema pueda responder:  
¿En qué etapa estructural está el negocio?  
¿Con qué confianza?  
¿En qué etapa está cada capacidad?  
¿Qué evidencia justifica cada etapa?  
¿Qué complejidad real tiene el ecommerce?  
¿Qué madurez exige esa complejidad?  
¿Qué capacidades están por delante?  
¿Cuáles están alineadas?  
¿Cuáles están rezagadas?  
¿Qué gaps son estructuralmente importantes?  
¿Existe deuda de madurez?  
¿Está creciendo más rápido que sus sistemas?  
¿Existe premature scaling?  
¿Existe overengineering?  
¿Hay dependencias peligrosas?  
¿Está preparado estructuralmente para operar su complejidad actual?  
¿Está preparado para soportar más escala?  
¿Qué capacidades no puedo evaluar?  
¿La debilidad observada es propia de su etapa o anómala?  
¿Estamos viendo un problema actual o una carencia estructural?

65\. Arquitectura runtime conceptual  
FASE 2 / MATURITY KNOWLEDGE  
        ↓  
STAGE GATE ENGINE  
        ├── Business Stage  
        ├── Capability Stage  
        ├── Evidence  
        └── Confidence  
        ↓  
COMPLEXITY ENGINE  
        ├── Scale  
        ├── Markets  
        ├── SKUs  
        ├── Channels  
        ├── Team  
        ├── Operations  
        └── Financial Exposure  
        ↓  
REQUIRED MATURITY  
        ↓  
GAP ENGINE  
        ├── Maturity Gaps  
        ├── Structural Debt  
        ├── Imbalances  
        ├── Stage Gate Failures  
        └── Scaling Readiness  
        ↓  
MATURITY\_RESULT

66\. Principio final  
D3 no mide cuántas cosas tiene el ecommerce. Determina si ha construido capacidades suficientemente repetibles, predecibles, controlables y resilientes para el nivel de complejidad que realmente soporta.

La clasificación debe ser explicable, respaldada por evidencia, sensible al contexto y compatible con D1, D2 y los Stage Gates de Fase 2\.  
