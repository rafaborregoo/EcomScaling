FASE 3 — SISTEMA DE DIAGNÓSTICO  
D8 — GENERADOR Y CONTRASTE DE HIPÓTESIS

0\. Propósito y límite de D8

D8 convierte síntomas y ramas causales plausibles en explicaciones explícitas, comprobables y competidoras. Debe responder qué explicaciones concretas podrían estar causando el patrón, cuál encaja mejor con la evidencia, cuáles pierden soporte y cuáles no pueden discriminarse todavía.

La secuencia obligatoria es:  
GENERATE → TEST → COMPARE → FALSIFY → UPDATE

Nunca:  
SYMPTOM → FIRST PLAUSIBLE CAUSE → DIAGNOSIS

Siempre que existan alternativas plausibles:  
SYMPTOM → MULTIPLE HYPOTHESES → EVIDENCE FOR → EVIDENCE AGAINST → MISSING EVIDENCE → COMPARISON → BEST CURRENT EXPLANATION

D8 no valida definitivamente la root cause ni determina el constraint. D8 puede marcar ROOT\_CAUSE\_CANDIDATE; D9 realiza esa validación y cierre causal.

1\. Contrato HYPOTHESIS

Toda hipótesis debe representarse mediante un objeto estructurado y debe ser concreta y verificable.

HYPOTHESIS  
\- hypothesis\_id  
\- diagnostic\_case\_id  
\- hypothesis\_code  
\- case\_specific\_statement  
\- statement  
\- hypothesis\_type  
\- target  
\- candidate\_cause  
\- causal\_path  
\- scope  
\- valid\_from  
\- valid\_to  
\- status  
\- prior\_plausibility  
\- supporting\_evidence  
\- contradicting\_evidence  
\- missing\_evidence  
\- confounders  
\- tests  
\- confidence  
\- explanatory\_power  
\- explanatory\_coverage  
\- falsifiability  
\- root\_cause\_candidate  
\- assumptions  
\- created\_at  
\- updated\_at  
\- hypothesis\_version

Una hipótesis nueva nace como UNTESTED, no como CONFIRMED.

2\. Tipos de hipótesis

hypothesis\_type debe usar, como mínimo:  
\- DIRECT\_CAUSE  
\- CONTRIBUTORY\_CAUSE  
\- ROOT\_CAUSE\_CANDIDATE  
\- CONTEXTUAL\_EXPLANATION  
\- DATA\_QUALITY\_EXPLANATION  
\- STRUCTURAL\_EXPLANATION  
\- EXTERNAL\_EXPLANATION  
\- INTERACTION\_HYPOTHESIS

Cuando sea útil distinguir profundidad causal, puede clasificarse también como:  
\- SURFACE\_EXPLANATION  
\- INTERMEDIATE\_EXPLANATION  
\- ROOT\_CAUSE\_CANDIDATE

Cuando proceda distinguir naturaleza temporal/estructural:  
\- ACUTE\_CAUSE  
\- STRUCTURAL\_DRIVER

Una hipótesis puede ser compuesta o multicausal. No debe forzarse una única causa cuando varias contribuciones están soportadas.

3\. Estados y ciclo de vida

HYPOTHESIS\_STATUS:  
\- UNTESTED  
\- UNDER\_TEST  
\- SUPPORTED  
\- WEAKLY\_SUPPORTED  
\- PARTIALLY\_SUPPORTED  
\- CONTRADICTED  
\- INVALIDATED  
\- CONFIRMED  
\- INCONCLUSIVE

CONFIRMED debe reservarse para evidencia muy fuerte. FAILED\_TO\_FALSIFY ≠ TRUE.

Una hipótesis puede cerrarse como:  
\- CONFIRMED  
\- INVALIDATED  
\- INCONCLUSIVE

Nueva evidencia puede reabrir una hipótesis cerrada, pero nunca de forma silenciosa: debe registrarse la reapertura, el motivo y una nueva hypothesis\_version.

Las hipótesis invalidadas no se eliminan del historial.

4\. Rol relativo entre hipótesis

La comparación puede asignar:  
\- PRIMARY\_HYPOTHESIS  
\- CHALLENGER\_HYPOTHESIS  
\- SECONDARY\_HYPOTHESIS  
\- ALTERNATIVE\_HYPOTHESIS

PRIMARY\_HYPOTHESIS significa mejor explicación actual, no causa confirmada.

Mientras la evidencia no sea definitiva, debe mantenerse al menos una alternativa seria cuando exista una alternativa causalmente plausible. CHALLENGER\_HYPOTHESIS representa la mejor explicación alternativa a la principal y obliga a responder por qué la primaria encaja mejor.

5\. Generación de candidatos

Las hipótesis pueden originarse en:  
\- D7 causal graph  
\- symptom templates  
\- historical tenant cases  
\- known business events  
\- cross-source patterns  
\- general expert knowledge  
\- LLM reasoning

Ninguna fuente por sí sola confirma una hipótesis.

D7 entrega candidate upstream branches y D8 transforma cada rama relevante en una explicit testable explanation.

Antes de entrar en shortlist, cada candidato debe pasar:  
\- mechanism plausibility  
\- scope fit  
\- temporal fit  
\- magnitude fit  
\- data availability  
\- diagnostic relevance

La cantidad de candidatos debe cubrir las explicaciones razonables sin producir explosión combinatoria. Como referencia conceptual, el documento de diseño contempla 3–7 serious candidates según complejidad, pero no como regla rígida.

Debe evitarse duplicar sinónimos del mismo mecanismo. Hipótesis equivalentes deben normalizarse a un hypothesis\_code común conservando case\_specific\_statement. También debe evitarse diversidad artificial: no se añaden alternativas absurdas solo para llenar categorías.

6\. Priors

PRIOR\_PLAUSIBILITY representa cuán plausible era una explicación antes de considerar toda la evidencia del caso.

Puede apoyarse en:  
\- business model  
\- maturity  
\- symptom family  
\- historical tenant patterns  
\- general causal knowledge

Reglas:  
\- prior ≠ conclusión  
\- common cause ≠ actual cause  
\- evidencia contradictoria debe poder derrotar un prior alto  
\- histórico tenant-specific puede aumentar plausibilidad, pero no constituye prueba actual  
\- general expert knowledge entra como GENERAL\_HEURISTIC, no como autoridad

7\. Evidencia

Cada hipótesis debe mantener explícitamente:  
\- SUPPORTING\_EVIDENCE\[\]  
\- CONTRADICTING\_EVIDENCE\[\]  
\- MISSING\_EVIDENCE\[\]

CONTRADICTING\_EVIDENCE debe existir como dimensión obligatoria, incluso si actualmente está vacía.

Cada vínculo de evidencia debe poder conservar:  
HYPOTHESIS\_EVIDENCE\_LINK  
\- evidence\_id  
\- role  
\- weight  
\- source

Evidence role:  
\- SUPPORTS  
\- CONTRADICTS  
\- NEUTRAL  
\- REQUIRED  
\- DISCRIMINATING

Evidence weight debe considerar, como mínimo:  
\- source reliability  
\- independence  
\- directness  
\- specificity  
\- temporal fit

La misma evidencia puede apoyar una hipótesis y contradecir otra.

La evidencia debe corresponder a una ventana temporal relevante. Evidencia stale puede degradarse.

No contar varias métricas derivadas del mismo evento como múltiples evidencias independientes. D1 lineage debe permitir detectar dependencia de evidencias.

Distinción obligatoria:  
NOT OBSERVED ≠ OBSERVED ABSENT

Falta de evidencia no equivale a evidencia negativa. Una métrica estable y fiable sí puede actuar como evidencia contradictoria cuando el mecanismo esperado requeriría que cambiase.

8\. Confounders y assumptions

Cada hipótesis debe declarar potential confounders relevantes. D12 profundizará su tratamiento, pero D8 debe considerarlos durante el contraste.

Cada conclusión debe conservar ASSUMPTIONS\[\]. Nunca convertir assumption en fact.

Antes de cerrar D8, el runtime debe exigir una autocrítica equivalente a:  
\- What am I assuming?  
\- What evidence contradicts me?  
\- What alternative explains the same facts?  
\- What data would change my conclusion?

Si dos fuentes fiables permanecen en conflicto y alteran el resultado, D8 puede devolver:  
HYPOTHESIS\_UNRESOLVED\_DUE\_TO\_EVIDENCE\_CONFLICT

No debe forzarse resolución antes de investigar ese conflicto.

9\. HYPOTHESIS\_TEST

Cada hipótesis debe poder generar pruebas discriminantes.

HYPOTHESIS\_TEST  
\- question  
\- required\_data  
\- expected\_if\_true  
\- expected\_if\_false  
\- result  
\- status  
\- information\_gain  
\- cost  
\- latency  
\- availability  
\- intrusiveness  
\- test\_risk

TEST\_RESULT:  
\- supports  
\- contradicts  
\- inconclusive  
\- unavailable

Diagnostic Test Categories:  
\- DATA\_QUERY  
\- SEGMENTATION  
\- TEMPORAL\_COMPARISON  
\- CROSS\_SOURCE\_CHECK  
\- CONFIG\_INSPECTION  
\- LOG\_INSPECTION  
\- CONTROL\_COMPARISON  
\- EXPERIMENT  
\- USER\_QUESTION

Las pruebas deben priorizarse por capacidad discriminante y eficiencia, considerando information gain, cost, latency, availability e intrusiveness.

Principio tool-first:  
AVAILABLE SYSTEM DATA FIRST → USER QUESTION SECOND

Si el sistema puede obtener un dato automáticamente, no debe pedírselo al usuario.

NEXT\_BEST\_TEST es una acción diagnóstica, no una recomendación empresarial.

10\. Seguridad de pruebas diagnósticas

D8 puede identificar una prueba activa útil, pero la ejecución de acciones pertenece a capas posteriores y a F8 cuando requiera permisos o produzca cambios.

No ejecutar cambios importantes de negocio solo para comprobar una hipótesis.

TEST\_RISK:  
\- SAFE\_READ\_ONLY  
\- LOW\_RISK  
\- MEDIUM\_RISK  
\- HIGH\_RISK

Preferir evidencia read-only siempre que discrimine suficientemente.

11\. Falsificación

Una hipótesis útil debe ser falsable. Hipótesis con baja falsabilidad deben marcarse LOW\_FALSIFIABILITY y recibir menor valor diagnóstico.

Antes de promover una hipótesis principal a alta confianza cuando la gravedad lo justifique, debe existir:  
FALSIFICATION\_ATTEMPT: completed

FALSIFICATION\_RESULT:  
\- FAILED\_TO\_FALSIFY  
\- PARTIALLY\_FALSIFIED  
\- FALSIFIED  
\- NOT\_TESTABLE

FAILED\_TO\_FALSIFY ≠ TRUE.

El sistema debe buscar activamente evidencia desconfirmatoria y no únicamente evidencia que confirme la hipótesis favorita.

12\. Evaluación y comparación

HYPOTHESIS\_EVALUATION\_DIMENSIONS:  
\- MECHANISM\_FIT  
\- TEMPORAL\_FIT  
\- SCOPE\_FIT  
\- MAGNITUDE\_FIT  
\- SIGNAL\_FIT  
\- CONTEXT\_FIT  
\- EVIDENCE\_QUALITY  
\- CONTRADICTION\_LEVEL  
\- MISSINGNESS  
\- PARSIMONY

También deben considerarse specificity, falsifiability, mechanism clarity, scope precision y testability.

La mejor hipótesis no es necesariamente la más detallada ni la más común. Debe maximizar explanatory power con el menor número de assumptions no soportadas, sin forzar una explicación simple cuando el fenómeno es multicausal.

Contradiction strength puede etiquetarse:  
\- WEAK  
\- MODERATE  
\- STRONG  
\- DECISIVE

Criterios que pueden invalidar una hipótesis:  
\- temporal impossibility  
\- scope mismatch  
\- direct contradiction  
\- mechanism impossible  
\- magnitude insufficient  
\- controlled evidence rejects

Criterios de INCONCLUSIVE:  
\- critical evidence unavailable  
\- alternatives remain equivalent  
\- data unreliable  
\- sample insufficient

13\. Ranking y separación

La evaluación puede producir un score interno, pero no debe presentarse como probabilidad calibrada si no existe modelo probabilístico calibrado.

Nunca presentar pseudo-probabilidades como “87.34% chance” por mera inferencia del LLM.

HYPOTHESIS\_RANKING debe poder devolver:  
\- rank  
\- status  
\- confidence  
\- reason

Las hipótesis deben competir entre sí y no evaluarse de forma aislada.

HYPOTHESIS\_SEPARATION expresa cuánto mejor soportada está la principal frente a las alternativas. Si varias explicaciones encajan de forma similar, la confianza queda limitada y el resultado puede ser INCONCLUSIVE.

14\. Confidence

HYPOTHESIS\_CONFIDENCE:  
\- HIGH  
\- MEDIUM  
\- LOW  
\- INSUFFICIENT

HIGH requiere normalmente evidencia directa fuerte, buen temporal/scope fit, pocas contradicciones y alternativas mayoritariamente descartadas.

MEDIUM: existe una mejor explicación, pero persiste incertidumbre material.

LOW: explicación compatible, pero débilmente discriminada.

INSUFFICIENT: la evidencia disponible no permite distinguir explicaciones.

La confianza debe depender de:  
\- mechanism strength  
\- supporting evidence  
\- contradictions  
\- falsification  
\- alternative separation  
\- data quality  
\- context quality  
\- scope fit  
\- temporal fit  
\- magnitude fit

Confidence caps obligatorios:  
\- si los datos de los que depende una hipótesis tienen confidence MEDIUM, la hypothesis no puede subir a HIGH por ignorar ese límite;  
\- si el edge causal de D7 es PLAUSIBLE/weak, la hypothesis completa no debe saltar a HIGH salvo evidencia fuerte del caso, especialmente experimental/intervencional;  
\- si existe un challenger igualmente fuerte, primary confidence cannot be HIGH;  
\- missing critical evidence debe imponer confidence cap.

Puede usarse un razonamiento tipo prior \+ new evidence → updated belief, pero sin fingir matemáticas bayesianas o probabilidades exactas que no existen.

15\. Belief update y ledger

Cada nueva evidencia puede:  
\- increase confidence  
\- decrease confidence  
\- invalidate  
\- leave unchanged

Toda evolución debe quedar registrada en HYPOTHESIS\_LEDGER.

El ledger debe permitir reconstruir:  
\- hypothesis\_version  
\- estado anterior y nuevo  
\- evidencia incorporada  
\- evidencia contradictoria  
\- test ejecutado  
\- cambio de confidence  
\- motivo del cambio  
\- timestamps

Hipótesis invalidadas, expiradas o reabiertas permanecen en el historial para trazabilidad, future learning, evitar repetir investigaciones y evaluar agentes.

16\. Árbol, búsqueda y branching

D8 puede mantener hipótesis a distintas profundidades dentro de un hypothesis tree.

HYPOTHESIS\_TREE\_NODE\_STATUS:  
\- OPEN  
\- SUPPORTED  
\- WEAK  
\- REJECTED  
\- UNKNOWN

La investigación puede empezar broad y profundizar después de que la evidencia reduzca el espacio. Puede usarse conceptualmente una estrategia breadth-first inicial y depth-first tras el narrowing, sin obligar a una implementación concreta.

Para evitar explosión combinatoria, el runtime puede mantener solo las mejores ramas activas, preservando alternativas relevantes y ramas rechazadas en el ledger.

Una chain hypothesis debe tener cada edge por separado testable. Weakest-link rule: si un eslabón carece de soporte, overall hypothesis confidence debe degradarse.

17\. Recursión y root-cause candidates

D8 debe soportar:  
HYPOTHESIS → NEW TARGET → SUB-HYPOTHESES

Una explicación intermedia puede convertirse en nuevo target para profundizar.

D8 puede marcar:  
ROOT\_CAUSE\_CANDIDATE: true

pero D9 decide si realmente constituye root cause y cuál es el constraint.

No sobreprofundizar en causas abstractas si añadir profundidad ya no aporta utilidad diagnóstica.

18\. Scope, tiempo y magnitud

Toda hipótesis debe quedar vinculada a un scope explícito y, cuando proceda, a valid\_from / valid\_to.

Regla crítica:  
No construir una hipótesis global desde datos locales sin exposición suficiente.

Una hipótesis local puede explicar un output global solo si su exposición/magnitud permite razonablemente cubrir el efecto observado.

Si el scope evoluciona durante la investigación, debe versionarse.

La causa debe anteceder al efecto o ser compatible con el lag esperado del mecanismo de D7.

19\. Explanatory coverage y residual

Separar siempre:  
HYPOTHESIS\_CONFIDENCE  
≠  
EXPLANATORY\_COVERAGE

Una hipótesis puede tener HIGH confidence y explicar solo una parte menor del fenómeno.

Debe mantenerse:  
UNEXPLAINED\_RESIDUAL

Nunca afirmar explicación completa si permanece un residual material.

Cuando una causa está bien soportada pero explica solo parte del resultado, puede marcarse:  
PARTIAL\_CAUSE

La prioridad de investigación puede combinar plausibility, explanatory coverage, information gap y business impact. Esto es orden de investigación, no business action priority.

20\. Incertidumbre

La incertidumbre puede descomponerse en:  
\- DATA\_UNCERTAINTY  
\- MODEL\_UNCERTAINTY  
\- CONTEXT\_UNCERTAINTY  
\- CAUSAL\_UNCERTAINTY

Cada conclusión debe declarar LIMITATIONS.

21\. Normalización, merge y split

Dos hipótesis que describen esencialmente la misma ruta con nombres distintos deben fusionarse hacia el mismo concepto canónico.

Toda hipótesis debe poder conservar:  
\- hypothesis\_code  
\- case\_specific\_statement

Una hipótesis puede split cuando la evidencia revela scopes o causas diferentes.

Dos hipótesis pueden merge cuando la evidencia muestra una interacción común.

Multicausal diagnosis requires split support: cada componente causal debe disponer de soporte propio suficiente y no debe asumirse por pertenecer a una explicación compuesta.

22\. Hipótesis novedosas y aprendizaje

El LLM puede sugerir una hipótesis no registrada, pero debe quedar:  
PROPOSED

hasta validar el mecanismo contra D7 o el sistema causal correspondiente.

No incorporar automáticamente una hipótesis novedosa al conocimiento permanente.

Si se confirma repetidamente, podrá alimentar posteriormente un tenant pattern o conocimiento general revisado bajo la lógica de aprendizaje de F9.

Nunca aprender una regla permanente desde un único caso.

23\. Multi-agent contract

Distintos agentes pueden proponer hipótesis, pero todos deben usar el mismo HYPOTHESIS object y el mismo sistema de evidencias/estados.

Los desacuerdos deben preservarse como:  
AGENT\_HYPOTHESIS\_CONFLICT

Evidence wins over agent authority. El peso de una propuesta depende de evidence quality y domain relevance, no de que un agente sea tratado como “más senior”.

24\. Hybrid architecture

Arquitectura objetivo:  
D7 CAUSAL GRAPH  
↓  
RULE-BASED CANDIDATES  
↓  
LLM HYPOTHESIS GENERATION  
↓  
SCHEMA VALIDATION  
↓  
EVIDENCE ENGINE  
↓  
FALSIFICATION  
↓  
HYPOTHESIS RESULT

Runtime controla como mínimo:  
\- hypothesis schema  
\- status transitions  
\- evidence links  
\- confidence caps  
\- test tracking  
\- falsification flag  
\- versioning  
\- candidate limits

El LLM aporta principalmente:  
\- generating plausible alternatives  
\- synthesizing evidence  
\- identifying discriminating tests  
\- comparing explanations  
\- explaining uncertainty

No debe ser un sistema pure LLM porque eso favorece confirmation bias, premature certainty, unstable terminology, missing alternatives y hallucinated causality.

Tampoco debe ser pure rules: los casos reales pueden contener novel combinations, qualitative evidence, multi-causal interactions y complex context.

25\. HYPOTHESIS\_RESULT

D8 debe devolver:

HYPOTHESIS\_RESULT  
\- primary\_hypothesis  
\- challenger\_hypothesis  
\- secondary\_hypotheses  
\- invalidated\_hypotheses  
\- untested\_hypotheses  
\- supporting\_evidence  
\- contradicting\_evidence  
\- missing\_evidence  
\- next\_best\_tests  
\- confidence  
\- explanatory\_coverage  
\- unexplained\_residual  
\- limitations  
\- assumptions  
\- hypothesis\_separation  
\- root\_cause\_candidates  
\- residual\_uncertainty

Handoff a D9:  
\- primary hypothesis  
\- challenger  
\- supported causal paths  
\- root-cause candidates  
\- residual uncertainty

26\. Admin Observability

Para cada Diagnostic Case, el sistema debe poder reconstruir:  
\- Hypotheses generated  
\- Why generated  
\- Evidence for  
\- Evidence against  
\- Tests executed  
\- Tests pending  
\- Confidence changes  
\- Rejected hypotheses  
\- Primary hypothesis  
\- Challenger  
\- Unexplained residual  
\- assumptions  
\- hypothesis versions  
\- source conflicts

El panel de hipótesis debe poder exponer, al menos:  
\- Hypothesis  
\- Status  
\- Confidence  
\- Support count  
\- Contradiction count  
\- Coverage  
\- Last test  
\- Next test

Las ramas invalidadas pueden ocultarse en la vista simplificada del usuario, pero deben permanecer disponibles para administración/auditoría.

27\. Invariantes D8

El sistema nunca debe:  
\- Generar una única hipótesis cuando existan alternativas plausibles.  
\- Convertir la primera explicación en diagnosis.  
\- Buscar solo evidencia confirmatoria.  
\- Ocultar contradicciones.  
\- Confundir falta de evidencia con evidencia negativa.  
\- Ignorar hipótesis de calidad de datos.  
\- Ignorar scope.  
\- Ignorar temporalidad.  
\- Ignorar magnitud.  
\- Ignorar causal graph.  
\- Asignar probabilidades falsas.  
\- Dar HIGH confidence cuando alternativas siguen igualmente abiertas.  
\- Eliminar hipótesis invalidadas del historial.  
\- Confundir hypothesis con root cause confirmada.  
\- Confundir hypothesis ranking con business prioritization.  
\- Confundir test diagnóstico con recomendación empresarial.  
\- Pedir al usuario datos ya disponibles automáticamente.  
\- Ejecutar pruebas riesgosas de negocio desde esta capa.  
\- Forzar una única causa en problemas multicausales.  
\- Dar por explicado el 100% del problema cuando queda residual material.  
\- Ignorar señales estables como evidencia.  
\- Sobrevalorar heurísticas generales frente a evidencia del tenant.  
\- Aprender una regla permanente desde un único caso.  
\- Sobreespecificar una hipótesis sin evidencia.  
\- Promover una hipótesis sin intento de falsificación cuando la gravedad lo justifique.  
\- Convertir assumption en fact.  
\- Forzar resolución cuando evidencias fiables permanecen en conflicto.

28\. Tests mínimos D8

\- test\_multiple\_hypotheses\_generated  
\- test\_first\_hypothesis\_not\_auto\_selected  
\- test\_contradicting\_evidence\_reduces\_confidence  
\- test\_temporal\_mismatch\_invalidates  
\- test\_scope\_mismatch\_invalidates  
\- test\_magnitude\_insufficient  
\- test\_missing\_evidence\_caps\_confidence  
\- test\_challenger\_required  
\- test\_falsification\_attempt\_required  
\- test\_multicausal\_case  
\- test\_measurement\_hypothesis  
\- test\_hypothesis\_split  
\- test\_hypothesis\_merge  
\- test\_unexplained\_residual  
\- test\_no\_fake\_probability

29\. Fixtures mínimos de aceptación

Fixture — Creative fatigue  
CTR ↓; CPM stable; CVR stable; old creatives ↓; new creatives stable; creative age ↑.  
Expected: Creative fatigue SUPPORTED; audience saturation WEAK; auction inflation INVALIDATED.

Fixture — Audience saturation  
CTR ↓; Frequency ↑↑; reach growth flat; old and new creatives both ↓; CPM stable.  
Expected: Audience saturation PRIMARY SUPPORTED; creative fatigue possible secondary.

Fixture — Tracking issue  
Meta conversions ↓; GA purchases ↓; Shopify stable; Stripe stable; tracking deployment.  
Expected: Measurement regression PRIMARY; no business conversion collapse.

Fixture — Price vs inventory  
CVR ↓; price unchanged; traffic stable; hero variants out of stock.  
Expected: Inventory availability SUPPORTED; price resistance INVALIDATED.

Fixture — Temporal invalidation  
Symptom begins Sep 1; deployment Sep 5\.  
Expected: deployment regression INVALIDATED as onset cause.

Fixture — Partial explanation  
Revenue \-30%; stockout affects 10% expected sales.  
Expected: stockout PARTIAL\_CAUSE; unexplained residual material.

Fixture — Multi-causal  
Contribution \-25%; discount \+10 impact; CAC \+8 impact; shipping \+5 impact.  
Expected: MULTICAUSAL EXPLANATION.

Fixture — Insufficient  
CAC ↑ with no CTR, CPM or CVR.  
Expected: multiple hypotheses remain open; confidence INSUFFICIENT.

Fixture — Challenger  
Primary evidence supports fatigue moderately; audience saturation also plausible.  
Expected: Creative fatigue primary; Audience saturation challenger; confidence MEDIUM, not HIGH.

Fixture — Intervention  
Payment decline after config change; rollback → immediate recovery.  
Expected: Payment config regression CONFIRMED / HIGH when no material confounding remains.

30\. Definition of Done de D8

D8 estará correctamente construido cuando pueda responder, de forma trazable:  
\- ¿Qué explicaciones plausibles existen?  
\- ¿Hay suficientes alternativas?  
\- ¿Qué mecanismo respalda cada una?  
\- ¿Qué evidencia apoya cada hipótesis?  
\- ¿Qué evidencia la contradice?  
\- ¿Qué evidencia falta?  
\- ¿Qué hipótesis explica mayor parte del fenómeno?  
\- ¿Qué hipótesis es la mejor alternativa?  
\- ¿Qué dato discriminaría mejor entre ellas?  
\- ¿Qué prueba podemos hacer?  
\- ¿Qué suponemos?  
\- ¿Qué podría demostrar que nuestra hipótesis principal es falsa?  
\- ¿Qué hypotheses pueden descartarse?  
\- ¿Cuáles permanecen abiertas?  
\- ¿Existe una combinación de causas?  
\- ¿Cuánto del problema queda sin explicar?  
\- ¿Con qué confianza mantenemos cada explicación?

D8 debe terminar con una mejor explicación actual, alternativas explícitas, evidencia a favor y en contra, incertidumbre/residual visibles y un handoff estructurado hacia D9; nunca con una opinión libre del modelo presentada como causa demostrada.  
