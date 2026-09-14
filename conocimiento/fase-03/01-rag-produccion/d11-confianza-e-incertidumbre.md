# Fase 03 · D11 — Confianza e incertidumbre

## Propósito

D11 responde:

> ¿Cuánto podemos confiar realmente en cada afirmación diagnóstica y qué parte sigue siendo incierta?

D11 no añade otra opinión. Añade disciplina epistemológica.

Principio central:

`CONFIDENCE MUST COME FROM EVIDENCE, NOT FROM LINGUISTIC CERTAINTY`

El sistema debe distinguir entre lo que observa, deriva, infiere, hipotetiza, confirma y desconoce.

---

## 1. Confidence Levels

### HIGH

Existe evidencia suficiente, fiable y coherente; las principales alternativas han sido contrastadas y no existen gaps críticos capaces de cambiar materialmente la interpretación.

HIGH no significa certeza absoluta.

### MEDIUM

Es la explicación actualmente mejor soportada, pero sigue existiendo incertidumbre relevante o alguna alternativa plausible.

### LOW

La explicación es compatible con la evidencia, pero existen gaps, alternatives o debilidades suficientes para que pueda cambiar con nueva información.

### INSUFFICIENT_DATA

La información disponible no permite distinguir responsablemente entre las principales explicaciones.

---

## 2. Confidence is Claim-specific

No existe una única confianza global útil desligada de una afirmación.

Ejemplo:

- Revenue decline: HIGH
- Payment-stage deterioration: HIGH
- Payment configuration regression: MEDIUM
- Lost revenue estimate: MEDIUM_HIGH
- Severity: HIGH

La pregunta evaluada importa.

“¿Está cayendo revenue?” puede tener HIGH confidence.

“¿Por qué está cayendo revenue?” puede tener LOW o MEDIUM.

---

## 3. Confidence Dimensions

D11 debe considerar, cuando aplique:

- `DATA_RELIABILITY`
- `DATA_COVERAGE`
- `CONTEXT_QUALITY`
- `SAMPLE_SUFFICIENCY`
- `TEMPORAL_FIT`
- `SCOPE_FIT`
- `MECHANISM_STRENGTH`
- `EVIDENCE_CONSISTENCY`
- `ALTERNATIVE_SEPARATION`
- `CONTRADICTION_LEVEL`
- `MISSING_EVIDENCE`
- `EXPLANATORY_COVERAGE`

---

## 4. Confidence Caps

La confianza final no debería superar el límite impuesto por una dimensión crítica.

Ejemplo:

- Data quality cap = MEDIUM
- Hypothesis appears very clear

Final confidence:
- MEDIUM

Si datos críticos son LOW reliability, cualquier diagnosis que dependa fuertemente de ellos no puede ser HIGH.

---

## 5. Visible Confidence Inputs

No basta con:

> confidence: MEDIUM

Debe poder explicarse:

- data high;
- scope high;
- temporal fit high;
- one serious alternative remains open.

---

## 6. Types of Uncertainty

D11 debe distinguir:

- `DATA_UNCERTAINTY`
- `CONTEXT_UNCERTAINTY`
- `MEASUREMENT_UNCERTAINTY`
- `MODEL_UNCERTAINTY`
- `CAUSAL_UNCERTAINTY`
- `SCOPE_UNCERTAINTY`
- `TEMPORAL_UNCERTAINTY`
- `IMPACT_UNCERTAINTY`
- `FORECAST_UNCERTAINTY`
- `KNOWLEDGE_UNCERTAINTY`

No toda incertidumbre tiene la misma materialidad.

---

## 7. Known Unknown vs Unknown Unknown

### KNOWN_UNKNOWN

Sabemos qué información falta.

Ejemplo:
- frequency data missing.

### UNKNOWN_UNKNOWN

No puede listarse directamente.

El sistema debe reducir sobreconfianza mediante:

- alternative generation;
- confounder checks;
- falsification;
- scope discipline.

---

## 8. Epistemic States

Cada claim debería distinguir:

- `OBSERVED`
- `DERIVED`
- `INFERRED`
- `HYPOTHESIZED`
- `CONFIRMED`
- `UNKNOWN`

### OBSERVED
Directamente presente en una fuente considerada fiable.

### DERIVED
Calculado a partir de observaciones.

### INFERRED
Interpretación respaldada por varias evidencias.

### HYPOTHESIZED
Explicación todavía abierta.

### CONFIRMED
Suficientemente validada.

### UNKNOWN
No puede establecerse.

Nunca deben aplanarse estos estados como si fueran hechos equivalentes.

---

## 9. Claim-level Traceability

Una claim debería poder asociar:

- claim;
- epistemic state;
- confidence;
- evidence;
- assumptions;
- contradictions;
- limitations.

Ejemplo conceptual:

Claim:
> The issue is isolated to Mobile Safari.

State:
- INFERRED

Confidence:
- HIGH

Evidence:
- device conversion breakdown.

---

## 10. Evidence Hierarchy

En igualdad de source quality, generalmente:

`DIRECT OBSERVATION > DERIVED METRIC > MECHANISTIC INFERENCE > HEURISTIC INFERENCE > SPECULATION`

Pero una observación directa puede ser poco fiable si el sistema de medición está roto.

Por tanto:

> SOURCE RELIABILITY ALWAYS MATTERS

---

## 11. Evidence Strength

Tipos conceptuales:

- direct evidence;
- strong indirect evidence;
- indirect evidence;
- weak evidence;
- anecdotal evidence.

Ejemplos:

### Direct
Log identifica failure exacto.

### Strong indirect
Issue empieza tras deployment y desaparece con rollback.

### Indirect
Support complaints aumentan simultáneamente.

### Weak
El patrón se parece a un caso histórico.

### Anecdotal
Un miembro del equipo dice que “los ads parecen stale”.

---

## 12. Evidence Independence

La confianza aumenta más cuando coinciden fuentes independientes.

Ejemplo útil:

- payment logs;
- Shopify orders;
- customer complaints.

Es más fuerte que tres métricas derivadas del mismo pixel.

Debe poder identificarse:

- `DEPENDENT_EVIDENCE`

Regla:

`EVIDENCE COUNT ≠ EVIDENCE STRENGTH`

---

## 13. Evidence Diversity

Puede evaluarse:

- source diversity;
- measurement diversity;
- method diversity.

---

## 14. Contradiction Handling

Las contradicciones nunca deben ocultarse.

Una material contradiction debe reducir confidence.

Una decisive contradiction puede invalidar una hypothesis.

Ejemplo:

Hypothesis:
- deployment caused decline.

Evidence:
- decline began three days before deployment.

Puede invalidarla como onset cause.

---

## 15. Alternative Separation

D8 aporta competing hypotheses.

D11 evalúa:

- `ALTERNATIVE_SEPARATION`

### Strong separation
Primary fuerte; challengers seriamente contradichos.

### Weak separation
Primary y challenger tienen soporte parecido.

Weak separation limita confidence.

El número de alternatives no importa tanto como la fuerza de las que sobreviven.

---

## 16. Confidence ≠ Completeness

Una causa puede tener HIGH confidence y explicar solo parte del fenómeno.

Ejemplo:

- Stockout: HIGH-confidence cause
- Explains: 40 % of revenue decline
- Diagnosis completeness: PARTIAL

También puede existir:

- confidence MEDIUM
- completeness COMPLETE_ENOUGH

si una explicación cubre casi todo pero falta confirmación causal definitiva.

---

## 17. Residual Uncertainty

Aunque una root cause esté bien identificada, puede quedar:

- unexplained residual;
- impact uncertainty;
- alternative uncertainty.

D11 debe mantenerlo visible.

---

## 18. Confidence Target

Todo confidence object debe conocer:

> qué claim está evaluando.

No debe existir “confidence = 75 %” sin claim.

---

## 19. Confidence Rules by Diagnostic Layer

Una conclusión HIGH puede requerir requisitos diferentes según su tipo.

### Root Cause HIGH

Puede requerir:

- valid causal chain;
- high data quality;
- strong temporal fit;
- strong scope fit;
- serious alternatives rejected;
- no material contradiction.

### Constraint HIGH

Puede requerir:

- target defined;
- capacity limit observed;
- binding relation demonstrated;
- plausible counterfactual.

### Impact HIGH

Puede requerir:

- reliable baseline/counterfactual;
- reliable exposure;
- reliable business metric.

### Severity HIGH confidence

Puede existir aun sin impact monetario exacto cuando el critical path failure es evidente.

---

## 20. Confidence Evolution

Confidence puede cambiar con nueva evidencia.

Ejemplo:

- LOW → MEDIUM because payment errors identified.
- MEDIUM → HIGH because rollback restored payment success.

Debe registrarse por qué cambió.

---

## 21. Confidence Decay

Algunas conclusiones pierden vigencia.

La recencia depende del dominio.

Ejemplos:

- Payments: minutes/hours
- Finance: days/weeks
- Retention: weeks/months

El decay debe ser domain-specific.

---

## 22. Uncertainty Materiality

No toda incertidumbre importa igual.

### Low materiality
Exact onset uncertain by 20 minutes cuando no afecta diagnosis.

### High materiality
No saber si hubo price change al investigar conversion decline.

### Critical unknown
Falta de payment logs cuando dos causes igualmente plausibles siguen abiertas.

---

## 23. Resolvability

Una incertidumbre puede ser:

- `RESOLVABLE_NOW`
- `WITH_NEW_DATA`
- `OVER_TIME`
- `NOT_RESOLVABLE`

Ejemplos:

- Query transaction logs → resolvable now.
- Missing COGS mapping → with new data.
- 60-day repeat → over time.
- Lost competitor demand without controls → possibly not resolvable.

---

## 24. Uncertainty Budget

Es preferible mostrar:

- 2 critical unknowns;
- 1 material contradiction;
- 1 challenger hypothesis;

que un score opaco como:

- uncertainty = 37 %.

---

## 25. Confidence Matrix

Una matriz útil puede incluir:

| Claim | Confidence | Why |
|---|---|---|
| Revenue declined | HIGH | source reconciled |
| Conversion decline | HIGH | funnel consistent |
| Payment stage affected | HIGH | upstream stable, payment down |
| Payment config root cause | MEDIUM | temporal fit, logs incomplete |
| Lost revenue estimate | MEDIUM | counterfactual uncertainty |
| Severity critical | HIGH | large checkout exposure |

---

## 26. Confidence by Conclusion Layer

Puede existir:

- WHAT: HIGH
- WHERE: HIGH
- WHY: MEDIUM
- IMPACT: HIGH
- ROOT: MEDIUM

No colapsar todo a un único label.

---

## 27. Confidence-aware Language

### HIGH
> La evidencia indica que...

### MEDIUM
> La explicación más probable es...

### LOW
> Existe una señal compatible con...

### INSUFFICIENT
> Con la información disponible no puede determinarse...

No usar:

> Está claro que...

cuando confidence no sea HIGH.

La generación de lenguaje debe consumir:

- confidence;
- epistemic_state.

---

## 28. Confidence Audit

Una conclusión debería poder explicar:

### UP
Factores que elevan confidence.

### DOWN
Factores que la reducen.

### TO REACH HIGH
Qué evidencia adicional permitiría elevarla.

---

## 29. Assumptions

Las assumptions importantes deben ser explícitas.

Ejemplo:

> AOV would have remained €78 without outage.

No convertir assumptions en facts.

Si baseline confidence es LOW, impact estimate confidence no puede ser HIGH.

---

## 30. Deterministic vs Interpretive Claims

Una métrica puede ser prácticamente exacta y su significado seguir incierto.

Ejemplo:

- Revenue = €420,531 → deterministic/direct.
- Revenue -18 % → exact.
- Why revenue fell → uncertain.

Debe separarse:

- measurement uncertainty;
- interpretive uncertainty.

---

## 31. High Severity + Low Root Confidence

Es completamente válido:

- Orders -70 %
- Severity CRITICAL
- Root cause LOW confidence

También:

- Minor email bug
- Cause HIGH confidence
- Severity LOW

Confidence y severity no deben confundirse.

---

## 32. Confidence and Risk

Un futuro riesgo puede tener:

- potential severity CRITICAL;
- likelihood confidence LOW.

No colapsar risk en certainty.

---

## 33. Applicability Confidence

El conocimiento recuperado puede tener:

- `APPLICABILITY_CONFIDENCE`

Una regla general:

> creative fatigue can reduce CTR

no demuestra:

> this store has creative fatigue.

---

## 34. Retrieval Confidence ≠ Diagnosis Confidence

Regla crítica:

`VECTOR_SIMILARITY ≠ BUSINESS_TRUTH`

Debe separarse:

- retrieval confidence;
- source authority;
- source validity/version;
- applicability confidence;
- case evidence confidence;
- diagnosis confidence.

Un documento RAG stale reduce knowledge applicability, no directamente metric reliability.

---

## 35. Expert Heuristic Confidence

Una heurística experta general puede aportar:

- LOW/MEDIUM prior support

hasta que se contraste con el caso.

El tono autoritativo nunca debe superar la evidencia.

---

## 36. Confidence by Granularity

Una diagnosis global puede tener HIGH confidence y un subsegmento LOW por sample insuficiente.

Fine-grained claims requieren suficiente data.

---

## 37. Confidence by Time Window

El horizon debe corresponder al fenómeno.

- 1 hour puede servir para payment outage.
- 1 hour no sirve para retention.
- 90 days puede servir para retention pero ocultar un outage corto.

Si window no coincide con el fenómeno, confidence debe degradarse.

---

## 38. Confidence and Maturity

Si D3 stage/maturity es incierto, un juicio stage-relative debe degradarse.

---

## 39. Complexity-adjusted Confidence

Negocios más complejos necesitan mayor coverage antes de global claims.

Una tienda single-market permite claims globales con menor evidence burden que una operación de 10 mercados.

---

## 40. Confidence Burden Principle

`CLAIM BREADTH ↑ → REQUIRED EVIDENCE ↑`

Una claim específica puede alcanzar HIGH con evidencia estrecha.

Una claim global requiere evidencia mucho más amplia.

---

## 41. Novelty

Un patrón nuevo sin analogías históricas debería empezar con mayor cautela.

Novelty no es evidence against.

Solo implica menor prior support.

---

## 42. External Cause Confidence

External explanations suelen ser más difíciles de probar.

Ejemplo:

> competition increased

requiere external evidence.

No basta con CPM ↑.

Si el fenómeno externo no se observa, puede aplicarse confidence cap LOW/MEDIUM.

---

## 43. Hidden Variables

En causal claims debe asumirse que pueden existir variables no observadas.

La cautela aumenta cuando la observación es limitada.

---

## 44. Confidence of Negative Conclusions

Decir:

> No hay problema de conversión.

también requiere coverage.

Debe distinguirse:

- `NO_EVIDENCE`
- `EVIDENCE_OF_NO_PROBLEM`
- `EVIDENCE_OF_STABILITY`

Payment data missing:
- NO_EVIDENCE

Payment data complete and stable:
- EVIDENCE_OF_STABILITY

---

## 45. Invalidation Confidence

También debe medirse confidence al rechazar una hypothesis.

Ejemplo:

- Auction inflation INVALIDATED — HIGH confidence because CPM stable and complete.

Versus:

- Audience saturation less supported — LOW confidence because frequency partial.

Debe distinguirse:

- `LESS_SUPPORTED`
- `INVALIDATED`

---

## 46. Diagnostic Certainty Ladder

Puede representarse conceptualmente:

`KNOWN → STRONGLY_SUPPORTED → MOST_LIKELY → PLAUSIBLE → UNKNOWN`

No todas las capas necesitan scoring numérico.

---

## 47. Completeness vs Reliability

Mantener separado:

- data quality/reliability;
- coverage/completeness;
- evidence sufficiency.

High-quality partial data puede producir MEDIUM confidence.

Broad low-quality data puede producir LOW confidence.

---

## 48. Confidence Improvement Requirement

El sistema debería poder responder:

> ¿Qué evidencia necesito para pasar de MEDIUM a HIGH?

Ejemplo:

- validate payment authentication logs.

Esto ayuda al orchestrator a decidir si una nueva query diagnóstica aporta valor.

---

## 49. Confidence Saturation

Llegado cierto punto, más datos similares no aumentan confidence materialmente.

Cinco métricas correlacionadas adicionales pueden tener bajo information gain.

---

## 50. Cost of Error

Cuando la falsa certeza es especialmente costosa, el lenguaje debe ser más conservador.

Ejemplos:

- cash survival;
- major inventory commitments;
- critical platform outages.

Pero baja confidence no debe ocultar serious risk.

---

## 51. Uncertainty Transparency

La persona usuaria debe entender:

- WHAT WE KNOW
- WHAT WE THINK
- WHAT WE DO NOT KNOW

Un formato útil:

- KNOWN
- LIKELY
- UNKNOWN

---

## 52. Limitations

Las limitations deben ser específicas.

Mala:

> Data may be imperfect.

Buena:

> Meta frequency is only available at ad-set level, so we cannot fully distinguish audience saturation from creative fatigue at asset level.

---

## 53. Positive Diagnosis

Las buenas noticias deben pasar el mismo rigor.

Una mejora de CAC no debe declararse “sustained improvement” sin suficiente persistence.

---

## 54. Opportunity Confidence

Claims de oportunidad suelen tener menor certeza por depender de counterfactuals.

Mejor:

> There may be additional scaling headroom.

No:

> You can safely double spend.

---

## 55. Principio final

La inteligencia diagnóstica también se mide por saber distinguir:

- ESTO LO SÉ.
- ESTO ES LO MÁS PROBABLE.
- ESTO SOLO ES POSIBLE.
- ESTO NO LO PUEDO SABER TODAVÍA.

D11 convierte la incertidumbre en parte explícita de la arquitectura y evita que el sistema suene más seguro de lo que permite la evidencia.
