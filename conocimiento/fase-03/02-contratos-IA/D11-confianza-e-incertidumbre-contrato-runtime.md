D11 — CONFIANZA E INCERTIDUMBRE — CONTRATO / RUNTIME

0\. Propósito  
D11 formaliza cuánto puede confiar el sistema en cada afirmación diagnóstica y qué parte sigue siendo incierta. No añade una opinión adicional: impone disciplina epistemológica sobre D1–D10.

Principio rector:  
CONFIDENCE must come from EVIDENCE, not from LINGUISTIC CERTAINTY.

El sistema debe poder decir I DON'T KNOW YET cuando la evidencia no permite una conclusión responsable.

1\. Estados canónicos de confidence  
CONFIDENCE:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT\_DATA

UNKNOWN puede existir internamente antes de evaluar una claim, pero una conclusión entregada debe terminar en HIGH, MEDIUM, LOW o INSUFFICIENT\_DATA.

Confidence ≠ Probability.  
No emitir porcentajes tipo P(root cause)=83.6% salvo que exista en el futuro un modelo probabilístico calibrado y validado para ese claim\_type.

2\. Semántica mínima  
HIGH:  
Existe evidencia suficiente, fiable y coherente para sostener la conclusión; las principales alternativas materiales han sido contrastadas y no existe un gap crítico capaz de cambiar materialmente la interpretación.

MEDIUM:  
La explicación es la mejor soportada actualmente, pero permanece incertidumbre relevante o alguna alternativa plausible abierta.

LOW:  
La conclusión es compatible con la evidencia, pero gaps, contradicciones, alternativas o debilidades pueden cambiarla fácilmente con nueva información.

INSUFFICIENT\_DATA:  
La información no permite distinguir de forma responsable entre las principales explicaciones o no satisface los requisitos mínimos del claim.

HIGH nunca significa certeza absoluta.

3\. Confidence es claim-specific y target-dependent  
No existe una única confidence válida para todo el diagnóstico.

Mantener separadas, según apliquen:  
problem\_confidence  
location\_confidence  
signal\_confidence  
symptom\_confidence  
root\_cause\_confidence  
constraint\_confidence  
impact\_confidence  
severity\_confidence  
forecast\_confidence  
overall\_confidence

La confidence global debe referirse siempre al diagnostic target original.  
Ejemplo conceptual: la pregunta “¿cayó revenue?” puede tener HIGH mientras “¿por qué cayó?” permanece LOW/MEDIUM.

No crear global confidence desconectada del claim being evaluated.

4\. Confidence Dimensions  
D11 debe considerar al menos:  
DATA\_RELIABILITY  
DATA\_COVERAGE  
CONTEXT\_QUALITY  
SAMPLE\_SUFFICIENCY  
TEMPORAL\_FIT  
SCOPE\_FIT  
MECHANISM\_STRENGTH  
EVIDENCE\_CONSISTENCY  
ALTERNATIVE\_SEPARATION  
CONTRADICTION\_LEVEL  
MISSING\_EVIDENCE  
EXPLANATORY\_COVERAGE

Estas dimensiones no se promedian ciegamente.

5\. Confidence Caps  
La confidence final nunca puede superar el límite impuesto por una dependencia crítica necesaria para sostener el claim.

FINAL\_CONFIDENCE ≤ WEAKEST\_CRITICAL\_DEPENDENCY, salvo que exista evidencia directa independiente que elimine esa dependencia para ese claim concreto.

CONFIDENCE\_CAP sources:  
DATA\_QUALITY\_CAP  
CONTEXT\_CAP  
SAMPLE\_CAP  
CAUSAL\_EDGE\_CAP  
ALTERNATIVE\_CAP  
MISSING\_EVIDENCE\_CAP

Caps y razones deben permanecer visibles en trazabilidad.

6\. UNCERTAINTY  
UNCERTAINTY  
\- uncertainty\_id  
\- type  
\- description  
\- affected\_claim  
\- materiality  
\- resolvability  
\- required\_evidence  
\- confidence\_effect  
\- source\_refs  
\- status

UNCERTAINTY\_TYPE:  
DATA\_UNCERTAINTY  
CONTEXT\_UNCERTAINTY  
MEASUREMENT\_UNCERTAINTY  
MODEL\_UNCERTAINTY  
CAUSAL\_UNCERTAINTY  
SCOPE\_UNCERTAINTY  
TEMPORAL\_UNCERTAINTY  
IMPACT\_UNCERTAINTY  
FORECAST\_UNCERTAINTY  
KNOWLEDGE\_UNCERTAINTY

7\. Known Unknowns  
Representar KNOWN\_UNKNOWN explícitamente.  
UNKNOWN\_UNKNOWN no puede enumerarse directamente; el sistema debe protegerse contra sobreconfianza mediante alternative generation, confounder checks, falsification y scope discipline.

No fingir que la lista de unknowns es exhaustiva.

8\. Epistemic States  
Cada claim debe poder marcar su naturaleza:  
OBSERVED  
DERIVED  
INFERRED  
HYPOTHESIZED  
CONFIRMED  
UNKNOWN

Semántica:  
OBSERVED \= presente directamente en datos suficientemente fiables.  
DERIVED \= calculado a partir de observaciones con lineage trazable.  
INFERRED \= interpretación basada en múltiples evidencias.  
HYPOTHESIZED \= explicación todavía abierta.  
CONFIRMED \= suficientemente validada según el claim\_type.  
UNKNOWN \= no puede establecerse.

Nunca presentar OBSERVED, DERIVED, INFERRED y HYPOTHESIZED como hechos equivalentes.

9\. CLAIM  
CLAIM  
\- claim\_id  
\- diagnostic\_id  
\- claim\_type  
\- statement  
\- scope  
\- epistemic\_state  
\- confidence  
\- confidence\_cap  
\- supporting\_evidence  
\- contradicting\_evidence  
\- assumptions  
\- open\_alternatives  
\- critical\_unknowns  
\- limitations  
\- valid\_from  
\- valid\_until  
\- model\_version

Toda conclusión material debe ser reconstruible a nivel claim.

10\. Evidence Strength  
EVIDENCE\_STRENGTH:  
DIRECT  
STRONG\_INDIRECT  
INDIRECT  
WEAK  
ANECDOTAL

La fuerza de evidencia depende también de source reliability.

Evidence count ≠ Evidence strength.  
Varias métricas derivadas de la misma fuente no constituyen corroboración independiente.

Marcar DEPENDENT\_EVIDENCE cuando varias piezas comparten el mismo lineage o evento base.

La independencia de fuentes puede elevar confidence; la multiplicidad de agentes que consumen la misma fuente no.

11\. CONTRADICTION  
CONTRADICTION  
\- contradiction\_id  
\- claim  
\- evidence  
\- strength  
\- possible\_resolution  
\- status

CONTRADICTION\_STATUS:  
OPEN  
EXPLAINED  
RESOLVED  
MATERIAL  
DECISIVE

Reglas:  
\- Las contradicciones nunca se ocultan.  
\- Una contradicción MATERIAL no resuelta bloquea normalmente HIGH.  
\- Una contradicción DECISIVE puede invalidar el claim.  
\- Si la contradicción se explica de forma verificable puede dejar de limitar confidence.

12\. Alternatives  
ALTERNATIVE\_SEPARATION evalúa cuánto mejor soportada está la conclusión principal frente a challengers que sobreviven.

El número bruto de alternativas no reduce confidence por sí solo.  
Importa la fuerza de las alternativas supervivientes.

En diagnósticos complejos, HIGH normalmente requiere que el primary claim haya sido confrontado contra al menos un challenger serio, salvo evidencia directa decisiva.

13\. Residual y Completeness  
UNEXPLAINED\_RESIDUAL  
\- magnitude  
\- scope  
\- confidence

DIAGNOSTIC\_COMPLETENESS:  
COMPLETE\_ENOUGH  
PARTIAL  
MATERIAL\_GAPS  
INSUFFICIENT

CONFIDENCE ≠ COMPLETENESS.  
Una causa puede tener HIGH confidence y explicar solo parte del fenómeno.  
Una explicación casi completa puede permanecer MEDIUM si falta validación causal definitiva.

14\. DIAGNOSTIC\_CONFIDENCE  
DIAGNOSTIC\_CONFIDENCE  
\- target  
\- problem\_confidence  
\- location\_confidence  
\- symptom\_confidence  
\- root\_cause\_confidence  
\- constraint\_confidence  
\- impact\_confidence  
\- severity\_confidence  
\- forecast\_confidence  
\- overall\_confidence  
\- completeness  
\- evidence\_sufficiency

Overall confidence debe estar limitado por las claims necesarias para responder al target; no por dimensiones irrelevantes.

15\. Evidence Sufficiency  
EVIDENCE\_SUFFICIENCY:  
SUFFICIENT  
PARTIAL  
INSUFFICIENT

Mantener por separado:  
\- evidence quality.  
\- evidence coverage/sufficiency.  
\- claim confidence.

Datos de alta calidad pero parciales pueden producir MEDIUM; cobertura amplia pero baja reliability puede producir LOW.

16\. Materiality of Uncertainty  
UNCERTAINTY\_MATERIALITY:  
LOW  
MEDIUM  
HIGH  
CRITICAL

No toda incertidumbre pesa igual. Una incertidumbre es material cuando resolverla podría cambiar sustancialmente la conclusión, scope, root cause, severity o impacto.

CRITICAL\_UNKNOWN  
\- question  
\- why\_material  
\- claims\_affected  
\- required\_data  
\- resolvability

Un CRITICAL\_UNKNOWN puede bloquear una conclusión concreta aunque otras layers del diagnóstico sean HIGH.

17\. Resolvability  
UNCERTAINTY\_RESOLVABILITY:  
RESOLVABLE\_NOW  
RESOLVABLE\_WITH\_NEW\_DATA  
RESOLVABLE\_OVER\_TIME  
NOT\_RESOLVABLE

No prometer resolver una incertidumbre que solo puede aclararse con datos futuros, controles inexistentes o nueva observación.

18\. Conclusion Readiness  
CONCLUSION\_READINESS:  
READY\_HIGH\_CONFIDENCE  
READY\_WITH\_LIMITATIONS  
PARTIAL  
NOT\_READY

Readiness debe evaluarse por conclusión/claim, no solo por diagnostic case global.

19\. Confidence Gate  
Flujo conceptual obligatorio:  
CLAIM  
→ DEPENDENCY CHECK  
→ EVIDENCE QUALITY  
→ ALTERNATIVE CHECK  
→ CONTRADICTION CHECK  
→ MISSINGNESS CHECK  
→ CONFIDENCE CAP  
→ CONFIDENCE

El LLM no puede saltarse este gate mediante lenguaje convincente.

20\. Confidence Rule Registry  
CONFIDENCE\_RULE  
\- claim\_type  
\- requirements\_high  
\- requirements\_medium  
\- caps  
\- downgrade\_conditions  
\- direct\_evidence\_exceptions  
\- required\_scope  
\- version

Ejemplos de reglas:  
Root cause HIGH puede requerir causal chain válida, high data quality, strong temporal fit, strong scope fit, alternativas serias rechazadas y ausencia de material contradiction.  
Constraint HIGH puede requerir target definido, capacity limit observado, binding relation demostrada y counterfactual plausible.  
Impact HIGH puede requerir reliable counterfactual, exposure fiable y business metric fiable.  
Severity HIGH confidence puede existir aunque el impacto monetario exacto sea MEDIUM si la exposición crítica es directamente observable.

21\. Deterministic Confidence Caps  
Las siguientes comprobaciones no deben delegarse exclusivamente al LLM:  
\- source reliability.  
\- data completeness.  
\- sample sufficiency.  
\- context availability.  
\- evidence dependency/lineage.  
\- temporal ordering cuando sea calculable.  
\- scope coverage.  
\- unresolved material contradiction flags.  
\- confidence caps ya emitidos por módulos upstream.

CRITICAL\_EVIDENCE\_MISSING puede impedir HIGH.  
Una root cause compleja sin falsification normalmente no alcanza HIGH salvo evidencia directa.

22\. Confidence Downgrade Reasons  
DOWNGRADE\_REASON:  
LOW\_DATA\_QUALITY  
LOW\_SAMPLE  
MISSING\_CONTEXT  
SOURCE\_CONFLICT  
OPEN\_CHALLENGER  
MATERIAL\_CONTRADICTION  
WEAK\_CAUSAL\_EDGE  
SCOPE\_UNCERTAINTY  
TEMPORAL\_UNCERTAINTY  
LOW\_EXPLANATORY\_COVERAGE  
UNVALIDATED\_ASSUMPTION  
STALE\_EVIDENCE  
DEPENDENT\_EVIDENCE

23\. Confidence Upgrade Reasons  
UPGRADE\_REASON:  
DIRECT\_EVIDENCE  
MULTI\_SOURCE\_CORROBORATION  
CONTROL\_GROUP\_SUPPORT  
SUCCESSFUL\_ROLLBACK  
TEMPORAL\_ALIGNMENT  
SCOPE\_ALIGNMENT  
ALTERNATIVES\_REJECTED  
REPEATED\_PATTERN

Repeated tenant-specific pattern puede elevar prior plausibility, pero no sustituye evidence actual.

24\. History y Revision  
Guardar CONFIDENCE\_HISTORY por claim.  
Cada cambio debe registrar:  
\- old\_confidence  
\- new\_confidence  
\- reason  
\- evidence\_added/removed  
\- contradiction change  
\- timestamp  
\- model\_version

CONFIDENCE\_CHANGED  
\- claim  
\- old\_confidence  
\- new\_confidence  
\- reason  
\- evidence\_added

La confidence debe poder subir o bajar. No preservar una conclusión por “prestigio” o porque fue afirmada previamente.

DIAGNOSIS\_REVISED reasons pueden incluir:  
new\_evidence  
data\_correction  
context\_update  
contradiction  
model\_update

25\. Evidence Recency y Claim Expiry  
Confidence debe considerar evidence freshness.  
Un claim puede incluir valid\_until o require\_reevaluation.

Recency es capability/domain-specific: la evidencia válida para pagos puede caducar mucho antes que evidencia de retención o estructura organizativa.

No usar evidencia stale como si describiera necesariamente el estado actual.

26\. Calibration  
Los diagnósticos cerrados deben poder alimentar un dataset de calibración con:  
\- claim\_type.  
\- predicted\_confidence.  
\- final\_validation.  
\- outcome.  
\- agent/domain.  
\- model\_version.

Objetivo: cuando el sistema dice HIGH, ese label debe correlacionar con alta corrección empírica.

Detectar:  
OVERCONFIDENCE cuando demasiados HIGH terminan invalidados.  
UNDERCONFIDENCE cuando demasiados LOW terminan confirmados.

Calibration puede analizarse por agente y dominio.

Guardar confidence\_model\_version para reproducibilidad histórica.

27\. Language Calibration  
La generación de lenguaje debe consumir confidence y epistemic\_state.

HIGH: “La evidencia indica que…”  
MEDIUM: “La explicación más probable es…”  
LOW: “Existe una señal/explicación compatible con…”  
INSUFFICIENT\_DATA: “Con la información disponible no puede determinarse…”

No utilizar fórmulas de certeza fuerte como “está claro que” o “definitivamente causado por” cuando el claim no sea HIGH y la evidencia no lo permita.

La UI puede simplificar labels, pero debe permitir explicar el porqué.

28\. Assumption Confidence  
Las assumptions usadas por D8/D10 deben poder tener ASSUMPTION\_CONFIDENCE.

Un estimate que depende críticamente de una assumption no puede tener confidence superior a la reliability de esa assumption sin evidencia independiente.

Baseline confidence LOW debe limitar impact estimate confidence.

29\. Path Confidence  
Las rutas causales conservan confidence por edge.  
No calcular path confidence mediante promedio simple.  
Una ruta con un eslabón crítico débil debe reflejarlo.  
Múltiples caminos realmente independientes pueden reforzar una conclusión.

30\. Confidence Aggregation  
Combinar:  
\- caps.  
\- weak links.  
\- independent corroboration.  
\- contradictions.  
\- missing evidence.  
\- alternative separation.

No average simple.

31\. Measurement vs Interpretation  
Separar:  
MEASUREMENT\_CONFIDENCE  
INFERENCE\_CONFIDENCE  
CAUSAL\_CONFIDENCE  
FORECAST\_CONFIDENCE

Un número puede estar medido con precisión y su interpretación causal seguir siendo incierta.

32\. RAG / Knowledge Boundary  
APPLICABILITY\_CONFIDENCE del conocimiento recuperado debe mantenerse separado de case evidence confidence.

VECTOR\_SIMILARITY ≠ BUSINESS\_TRUTH.  
Retrieval confidence ≠ diagnosis confidence.

Un documento RAG puede aportar prior, mecanismo o patrón; no convierte automáticamente ese patrón en hecho del tenant.

Knowledge source authority, validity, version y freshness pueden alterar applicability, pero no sustituyen evidence del caso.

General expert heuristics solo dan prior support hasta ser verificadas contra el caso.

33\. User-reported Evidence  
USER\_REPORTED\_EVIDENCE debe conservar verificación separada.

USER\_EVIDENCE\_STATUS:  
UNVERIFIED  
CORROBORATED  
CONTRADICTED

Un reporte del usuario puede tener alta relevancia y seguir UNVERIFIED.  
No tratarlo como verdad automática ni descartarlo por ser cualitativo.

34\. Qualitative Evidence  
Support tickets, reviews, call summaries y observaciones cualitativas deben registrar, cuando aplique:  
\- classification confidence.  
\- coverage.  
\- representativeness.  
\- denominator.

No inferir prevalence sin denominador adecuado.

35\. Granularity / Horizon / Breadth  
Fine-grained claims requieren suficiente data para ese scope.  
La ventana temporal debe corresponder al fenómeno.  
Una ventana válida para payment outage puede ser insuficiente para retention.

Maturity confidence puede limitar stage-relative claims.  
Business complexity aumenta el evidence burden de global claims.

CLAIM BREADTH ↑ → REQUIRED EVIDENCE ↑.  
No extrapolar evidencia de un canal/mercado/subsegmento a “el negocio” sin cobertura suficiente.

36\. Novelty y External Causes  
Novelty no es evidencia en contra, pero reduce prior support si no existen analogías validadas.  
Repeated tenant pattern puede aumentar prior plausibility; current evidence sigue siendo obligatorio.

Una causa externa no observada directamente debe tener confidence limitada. No afirmar “competition increased” solo porque CPM subió.

Reconocer hidden/unobserved variables, especialmente en causal claims.

37\. Negative Claims  
NO\_EVIDENCE ≠ EVIDENCE\_OF\_NO\_PROBLEM.

Afirmar “no hay problema” también requiere coverage suficiente.  
Con datos faltantes usar NO\_EVIDENCE/UNKNOWN, no “healthy”.

La invalidación de una hipótesis también debe llevar confidence.  
LESS\_SUPPORTED ≠ INVALIDATED.

38\. UNCERTAINTY\_SUMMARY  
UNCERTAINTY\_SUMMARY  
\- knowns  
\- high\_confidence\_inferences  
\- medium\_confidence\_inferences  
\- low\_confidence\_hypotheses  
\- critical\_unknowns  
\- open\_alternatives  
\- material\_contradictions  
\- unresolved\_residual

Debe permitir al usuario/admin distinguir claramente qué se sabe, qué es probable y qué sigue desconocido.

39\. Certainty Ladder  
Para lenguaje humano puede mapearse:  
KNOWN  
STRONGLY\_SUPPORTED  
MOST\_LIKELY  
PLAUSIBLE  
UNKNOWN

Este ladder no reemplaza los estados de confidence; sirve como representación narrativa consistente.

40\. Numeric Internal Score  
Puede existir un score interno 0–1 si sirve para lógica de reglas, pero:  
\- debe mapear a reglas explícitas de evidencia.  
\- no puede ser una salida arbitraria del LLM.  
\- no debe mostrarse como porcentaje de verdad sin calibración real.

41\. Confidence Matrix Engine  
CLAIM  
→ REQUIRED DEPENDENCIES  
→ QUALITY BY DEPENDENCY  
→ CONTRADICTIONS  
→ ALTERNATIVES  
→ CAPS  
→ CONFIDENCE

DIAGNOSTIC\_CASE\_CONFIDENCE resume confidence respecto al target original, no respecto a todas las afirmaciones posibles.

42\. Uncertainty Reduction / Information Value  
D11 puede identificar WHAT WOULD INCREASE CONFIDENCE?

CONFIDENCE\_UPGRADE\_PATH  
\- current\_confidence  
\- required\_for\_high  
\- unresolved\_questions  
\- evidence\_requests  
\- expected\_information\_value

Solicitar evidencia adicional es diagnóstico, no recomendación de negocio.

INFORMATION\_VALUE:  
HIGH  
MEDIUM  
LOW

Priorizar dentro de la investigación el missing evidence que más pueda discriminar entre alternativas o resolver un critical unknown.

43\. Stop Investigation Rule  
D11 puede declarar que la investigación es suficiente cuando:  
\- confidence satisface el diagnostic purpose.  
\- remaining uncertainty es no material.  
\- no existe critical unknown necesario para el target.

El threshold de confidence depende del purpose; D11 no autoriza ejecución ni acciones de negocio.  
DECISION\_CONFIDENCE pertenece a capas posteriores y no debe confundirse con DIAGNOSTIC\_CONFIDENCE.

44\. Cost of Error y Transparency  
Cuando el coste de una falsa certeza sea alto, el lenguaje debe ser más conservador.  
No ocultar un riesgo serio porque la causal confidence sea baja: separar severity/problem confidence de root cause confidence.

El usuario debe poder entender:  
\- what we know.  
\- what we think.  
\- what we do not know.

45\. LIMITATION  
LIMITATION  
\- description  
\- affected\_claim  
\- severity/materiality  
\- resolvable

Limitations deben ser específicas, no boilerplate genérico.  
Una limitación material debe aparecer prominentemente; una menor puede quedar en trace técnico.

46\. Positive Diagnosis  
El mismo rigor aplica a mejoras y oportunidades.  
No convertir ruido positivo en “sustained improvement” sin persistencia.  
Las opportunity claims suelen tener mayor counterfactual uncertainty y D11 no autoriza acciones futuras.

47\. Multi-Agent Confidence  
Cada especialista puede devolver confidence, pero el orquestador no promedia labels ni cuenta acuerdo de agentes como evidencia independiente si comparten lineage.

Ante disagreement debe comparar:  
\- evidence.  
\- scope.  
\- definitions.  
\- dependency lineage.  
\- domain authority.

Domain authority puede orientar qué agente evalúa mejor una claim, pero evidence still governs.

48\. Admin Observability  
Admin debe poder ver por claim:  
\- statement.  
\- epistemic\_state.  
\- confidence.  
\- confidence cap.  
\- positive/negative reason codes.  
\- supporting evidence.  
\- contradictions.  
\- open alternatives.  
\- critical unknowns.  
\- limitations.  
\- last updated / validity.  
\- confidence history.  
\- model version.

Reason codes deben permitir auditar por qué subió o bajó confidence.

49\. Confidence Snapshot  
CONFIDENCE\_SNAPSHOT  
\- diagnostic\_id  
\- target  
\- claims  
\- confidence  
\- caps  
\- uncertainties  
\- alternatives  
\- contradictions  
\- evidence  
\- model\_version  
\- created\_at

Todo major diagnosis debe preservar snapshot reproducible.

50\. Runtime vs LLM  
Runtime debe gestionar principalmente:  
\- confidence schema.  
\- deterministic confidence caps.  
\- evidence dependency graph.  
\- critical unknown flags.  
\- contradiction flags.  
\- claim-level confidence constraints.  
\- confidence history/change events.  
\- model version.  
\- source reliability/sample/data completeness.

LLM puede:  
\- explicar uncertainty.  
\- identificar assumptions.  
\- sintetizar contradictory evidence.  
\- comparar surviving alternatives dentro de reglas.  
\- calibrar language to confidence.

No delegar al LLM como decisión libre: source reliability, sample sufficiency, data completeness, dependency lineage ni hard caps.

51\. Handoff  
D11 consume D1–D10 y debe producir objetos compatibles para D12/D13/D14 y capas posteriores.

D11 debe estar preparado para bajar confidence cuando un confounder, nueva evidencia, cambio contextual o contradicción posterior invalide assumptions previas.

52\. DIAGNOSTIC\_CONFIDENCE\_RESULT  
DIAGNOSTIC\_CONFIDENCE\_RESULT  
\- target  
\- problem\_confidence  
\- location\_confidence  
\- symptom\_confidence  
\- root\_cause\_confidence  
\- constraint\_confidence  
\- impact\_confidence  
\- severity\_confidence  
\- forecast\_confidence  
\- overall\_confidence  
\- evidence\_sufficiency  
\- diagnostic\_completeness  
\- critical\_unknowns  
\- open\_alternatives  
\- material\_contradictions  
\- confidence\_caps  
\- limitations  
\- confidence\_upgrade\_requirements  
\- uncertainty\_summary  
\- confidence\_model\_version

53\. Tests mínimos  
\- test\_high\_data\_low\_causal\_confidence  
\- test\_low\_data\_caps\_root\_confidence  
\- test\_open\_challenger\_caps\_high  
\- test\_material\_contradiction\_downgrades  
\- test\_temporal\_mismatch\_invalidates  
\- test\_independent\_sources\_raise\_confidence  
\- test\_correlated\_evidence\_not\_double\_counted  
\- test\_high\_problem\_confidence\_low\_root\_confidence  
\- test\_confidence\_target\_dependence  
\- test\_missing\_data\_vs\_evidence\_of\_absence  
\- test\_confidence\_revision  
\- test\_confidence\_decay  
\- test\_no\_fake\_probability  
\- test\_claim\_breadth\_requires\_more\_evidence

54\. Evals / Fixtures  
Fixture 1 — High measurement / low cause  
Orders down confirmed; CVR down confirmed; no upstream evidence.  
Expected: Problem HIGH; Root Cause LOW / INSUFFICIENT.

Fixture 2 — Data Cap  
Critical conversion data LOW reliability; pattern strong.  
Expected: root cause confidence cannot be HIGH.

Fixture 3 — Open Challenger  
Creative fatigue strong support; Audience saturation strong support.  
Expected: primary root confidence MEDIUM at most.

Fixture 4 — Direct Evidence  
Payment config changed; error log identifies invalid config; rollback restores normality.  
Expected: Root Cause HIGH.

Fixture 5 — Correlated Evidence  
CAC, ROAS y MER derivados de los mismos purchase/spend data.  
Expected: no contarlos como tres fuentes independientes.

Fixture 6 — Independent Evidence  
Shopify orders ↓; payment logs failures ↑; support card complaints ↑.  
Expected: confidence strengthened si las fuentes son realmente independientes.

Fixture 7 — Missing vs Stable  
Case A: CPM unavailable → auction inflation UNKNOWN.  
Case B: CPM reliably stable → auction inflation contradicted.

Fixture 8 — Target Dependence  
Same case.  
Question: Did revenue decline? → HIGH.  
Question: Why did revenue decline? → MEDIUM.

Fixture 9 — Broad Claim  
Evidence only Meta Spain. Claim: “The business has an acquisition problem.”  
Expected: confidence capped / scope too broad.

Fixture 10 — Revision  
Initial Root Cause MEDIUM creative fatigue. New evidence: new creatives also deteriorate.  
Expected: confidence decreases; challenger reopened.

Fixture 11 — Severity Independence  
Orders down 80%; cause unknown.  
Expected: Severity CRITICAL/HIGH confidence; Root Cause INSUFFICIENT.

Fixture 12 — Impact Uncertainty  
Payment failure confirmed; counterfactual baseline weak.  
Expected: Root Cause HIGH; Impact estimate confidence LOW/MEDIUM.

55\. Invariantes D11  
El sistema nunca debe:  
\- Inferir confidence por fluidez o seguridad del lenguaje.  
\- Presentar certeza categórica sin evidencia suficiente.  
\- Usar probabilidades falsas.  
\- Asignar un único confidence a todas las layers.  
\- Permitir que root-cause confidence supere critical dependency quality.  
\- Ocultar caps, material contradictions, alternatives o critical unknowns.  
\- Tratar missing data como evidence of absence.  
\- Contar derived metrics correlacionadas como evidencia independiente.  
\- Contar varios agentes sobre la misma fuente como corroboración independiente.  
\- Ignorar scope, temporal, context o sample uncertainty.  
\- Confundir confidence con completeness, severity o priority.  
\- Reducir severity porque causal confidence sea baja.  
\- Aumentar causal confidence porque severity sea alta.  
\- Tratar RAG knowledge como case evidence.  
\- Tratar retrieval similarity como verdad.  
\- Tratar user report como verified evidence automáticamente.  
\- Usar stale evidence como current.  
\- Mantener confidence solo porque se afirmó anteriormente.  
\- Negarse a bajar confidence ante evidencia contraria.  
\- Generalizar narrow high-confidence finding.  
\- Ocultar qué evidencia aumentaría confidence.  
\- Ocultar unresolved unknowns.  
\- Forzar HIGH/MEDIUM/LOW cuando corresponde INSUFFICIENT\_DATA.

56\. Definition of Done  
D11 está correctamente construido cuando el sistema puede responder explícitamente:  
\- ¿Qué afirmaciones son OBSERVED, DERIVED, INFERRED, HYPOTHESIZED o CONFIRMED?  
\- ¿Con qué confidence está confirmado el problema?  
\- ¿Con qué confidence está localizado?  
\- ¿Con qué confidence conocemos symptom, root cause, constraint, impact y severity?  
\- ¿Qué limita cada confidence?  
\- ¿Qué evidence es independiente y cuál comparte lineage?  
\- ¿Qué contradicciones existen?  
\- ¿Qué alternatives siguen abiertas?  
\- ¿Qué unknowns son materiales?  
\- ¿Qué información aumentaría más la confidence?  
\- ¿La diagnosis está COMPLETE\_ENOUGH, PARTIAL, MATERIAL\_GAPS o INSUFFICIENT?  
\- ¿Qué residual sigue sin explicar?  
\- ¿Ha cambiado confidence con nueva evidencia?  
\- ¿Está el lenguaje calibrado a la confidence real?

D11 debe hacer explícita la incertidumbre; nunca ocultarla para producir una respuesta aparentemente más segura.  
