# Fase 03 · D08 — Generador y contraste de hipótesis

## Propósito

D8 responde:

> ¿Qué explicaciones concretas podrían estar causando este patrón, cuál encaja mejor con la evidencia y cuáles deben descartarse?

El objetivo no es generar muchas ideas, sino aplicar un proceso disciplinado:

`GENERATE → TEST → COMPARE → FALSIFY → UPDATE`

D8 convierte rutas causales plausibles de D7 en explicaciones concretas y testables.

---

# 1. Principio fundamental

Nunca:

`SYMPTOM → FIRST PLAUSIBLE CAUSE → DIAGNOSIS`

Siempre:

`SYMPTOM → MULTIPLE HYPOTHESES → EVIDENCE FOR → EVIDENCE AGAINST → MISSING EVIDENCE → COMPARISON → BEST CURRENT EXPLANATION`

El sistema debe resistir confirmation bias y premature certainty.

---

# 2. Multiple hypotheses

La primera explicación plausible no debe dominar automáticamente.

Ejemplo ante:

- CAC ↑
- CTR ↓
- CPM stable
- CVR stable

pueden competir:

- Creative fatigue
- Audience saturation
- Offer response deterioration
- Placement mix deterioration
- Market mix change
- Creative-message mismatch
- Tracking distortion

---

# 3. Hypothesis statement

Una hipótesis debe ser:

- concreta;
- verificable;
- falsable;
- suficientemente específica;
- compatible con una ruta causal válida.

Mala:

> Marketing is bad.

Mejor:

> The increase in CAC is primarily driven by deterioration in paid-social click-through response rather than post-click conversion.

Más específica:

> The decline in Meta prospecting CTR is primarily explained by deterioration in creative response across mature high-spend assets.

---

# 4. Confirmed should be rare

`CONFIRMED` debe reservarse para evidencia muy fuerte.

Ejemplos:

- logs identifican configuración exacta fallida;
- rollback controlado restaura performance;
- A/B test demuestra efecto;
- outage directo coincide con failure.

En muchos diagnósticos, estados correctos serán:

- `SUPPORTED`
- `MOST_LIKELY`
- `WEAKLY_SUPPORTED`
- `CONTRADICTED`
- `INVALIDATED`
- `INCONCLUSIVE`

---

# 5. Hypothesis Types

Como mínimo:

- `DIRECT_CAUSE`
- `CONTRIBUTORY_CAUSE`
- `ROOT_CAUSE_CANDIDATE`
- `CONTEXTUAL_EXPLANATION`
- `DATA_QUALITY_EXPLANATION`
- `STRUCTURAL_EXPLANATION`
- `EXTERNAL_EXPLANATION`
- `INTERACTION_HYPOTHESIS`

---

# 6. Generation Sources

Las hipótesis pueden provenir de:

- causal graph;
- symptom templates;
- historical tenant cases;
- known business events;
- cross-source patterns;
- general expert knowledge;
- LLM reasoning.

Ninguna fuente confirma por sí sola una hipótesis.

---

# 7. D7 → D8

D7 entrega:

- candidate upstream branches.

D8 transforma cada rama relevante en:

- explicit testable explanation.

---

# 8. Candidate Count

No conviene mantener 25 hypotheses por problema.

Tampoco solo una.

Conceptualmente, 3–7 candidatas serias puede ser razonable según complejidad, sin convertirlo en regla rígida.

---

# 9. Hypothesis Relevance

Antes de entrar en shortlist, una hipótesis debe superar:

- mechanism plausibility;
- scope fit;
- temporal fit;
- magnitude fit;
- data availability;
- diagnostic relevance.

---

# 10. Prior Plausibility

Puede existir:

- `PRIOR_PLAUSIBILITY`

Representa la plausibilidad previa antes de observar toda la evidencia.

Puede depender de:

- business model;
- maturity;
- symptom family;
- historical tenant patterns;
- general causal knowledge.

Pero:

> PRIOR ≠ CONCLUSION

La evidencia contradictoria debe derrotar al prior.

---

# 11. Supporting Evidence

Toda hipótesis debe poder mantener:

- `SUPPORTING_EVIDENCE[]`

Ejemplo Creative Fatigue:

- CTR declining;
- frequency increasing;
- creative age increasing;
- spend concentration high;
- new winners scarce.

---

# 12. Contradicting Evidence

Debe existir siempre:

- `CONTRADICTING_EVIDENCE[]`

Ejemplos:

- new creatives perform equally poorly;
- frequency stable;
- same decline in untouched audience.

---

# 13. Missing Evidence

Debe poder existir:

- `MISSING_EVIDENCE[]`

Ejemplos:

- creative-level historical CTR;
- frequency by audience;
- asset launch dates.

Missing evidence crítico no es neutral: limita confidence.

---

# 14. Discriminating Evidence

La evidencia más valiosa no siempre es la que apoya una hipótesis, sino la que separa hipótesis competidoras.

Ejemplo:

CTR ↓ puede apoyar creative fatigue, audience saturation u offer weakening.

Pero:

> Only old creatives deteriorate; new creatives stable

discrimina fuertemente hacia creative fatigue.

---

# 15. Information Gain

D8 debe preguntarse:

> ¿Qué dato elimina más hipótesis?

Puede priorizarse evidencia con:

- `HIGH_INFORMATION_GAIN`

---

# 16. Hypothesis Testing

Cada hipótesis debe tener un test falsable.

Ejemplo Creative Fatigue:

Test:
- compare old high-frequency creatives vs recently launched creatives.

Expected if true:
- old assets deteriorate more.

Expected if false:
- new and old deteriorate similarly.

---

# 17. Falsifiability

Una buena hypothesis puede resultar falsa.

Mala:

> Customers are less interested.

Mejor:

> The CTR decline is primarily concentrated in high-frequency mature audiences.

---

# 18. Hypothesis Quality

Puede considerar:

- specificity;
- falsifiability;
- mechanism clarity;
- scope precision;
- testability.

La mejor hipótesis no es necesariamente la más detallada, sino la más explicativa con menos unsupported assumptions.

---

# 19. Parsimony

Debe respetarse parsimony sin oversimplification.

Si una explicación soportada explica varios cambios conectados mejor que tres explicaciones débiles, gana peso.

Pero un fenómeno multicausal no debe forzarse a una causa única.

---

# 20. Explanatory Power

Pregunta:

> ¿Cuánto del patrón observado puede explicar esta hypothesis?

Debe diferenciarse:

- confidence;
- coverage.

Una hipótesis puede tener HIGH confidence pero explicar solo una parte pequeña del fenómeno.

---

# 21. Fit Dimensions

Cada hypothesis debe contrastarse por:

- Magnitude Fit;
- Scope Fit;
- Temporal Fit;
- Mechanism Fit;
- Context Fit;
- Maturity Fit;
- Health Fit;
- Signal Fit.

---

# 22. Stable Signals as Evidence

Lo que no cambió también discrimina.

Ejemplo:

Hypothesis:
- Auction pressure

Pero:
- CPM stable

Esto es evidencia en contra.

---

# 23. Absence of Evidence vs Evidence of Absence

No son iguales.

- No CPM data → UNKNOWN.
- CPM observed and stable → CONTRADICTING EVIDENCE.

> NOT OBSERVED ≠ OBSERVED ABSENT

---

# 24. Hypothesis Status

Estados conceptuales útiles:

- `UNTESTED`
- `UNDER_TEST`
- `SUPPORTED`
- `WEAKLY_SUPPORTED`
- `PARTIALLY_SUPPORTED`
- `MOST_LIKELY`
- `CONTRADICTED`
- `INVALIDATED`
- `CONFIRMED`
- `INCONCLUSIVE`

---

# 25. Hypothesis Ledger

Una hipótesis debe poder evolucionar a medida que llega evidencia.

Ejemplo conceptual:

- UNTESTED
- SUPPORTED
- WEAKENED
- PARTIALLY_SUPPORTED

No deben borrarse hipótesis rechazadas.

---

# 26. Why Rejected Hypotheses Matter

Conservarlas sirve para:

- traceability;
- future learning;
- avoid repeated investigation;
- agent evaluation.

---

# 27. Comparative Reasoning

Las hipótesis deben compararse entre sí.

No evaluarse aisladamente.

Una Comparative Matrix puede mostrar:

- evidence for;
- evidence against;
- missing evidence;
- status.

---

# 28. Relative Explanation Roles

Puede existir:

- `PRIMARY_HYPOTHESIS`
- `SECONDARY_HYPOTHESIS`
- `ALTERNATIVE_HYPOTHESIS`
- `CHALLENGER_HYPOTHESIS`

Primary significa mejor soporte actual, no causa confirmada.

---

# 29. Challenger Hypothesis

La mejor explicación alternativa obliga a responder:

> ¿Por qué H1 es mejor que H2?

Es una defensa frente a tunnel vision.

---

# 30. Devil's Advocate Rule

Antes de elevar una hypothesis a alta confianza:

> actively search for disconfirming evidence

No debe buscarse solo evidencia que confirme la favorita.

---

# 31. Composite Hypothesis

A veces la mejor explicación es combinada.

Ejemplo:

CAC deterioration puede explicarse conjuntamente por:

- CPM inflation;
- conversion decline.

---

# 32. Hypothesis Normalization

Sinónimos o variantes deben mapearse a un mismo canonical concept.

Ejemplos:

- Creative fatigue
- Old creatives exhausted
- Creative wear-out

pueden compartir un `HYPOTHESIS_CODE`.

---

# 33. Canonical + Case-specific

Debe mantenerse:

- `hypothesis_code`
- `case_specific_statement`

Ejemplo:

Code:
`PAYMENT_CONFIG_REGRESSION`

Statement:
> A configuration change deployed on Sep 8 may be causing Mastercard 3DS authentication failures in Spain.

---

# 34. Hypothesis Families

## Acquisition

- CPM_INFLATION
- CTR_RESPONSE_DETERIORATION
- AUDIENCE_SATURATION
- CHANNEL_MIX_SHIFT
- TRAFFIC_QUALITY_DECLINE
- SCALING_SATURATION

## Creative

- CREATIVE_FATIGUE
- CREATIVE_PIPELINE_DEFICIT
- CONCEPT_EXHAUSTION
- CREATIVE_MESSAGE_MISMATCH
- FORMAT_MIX_WEAKNESS

## Conversion

- PDP_REGRESSION
- PRICE_RESISTANCE
- OFFER_WEAKNESS
- STOCK_AVAILABILITY
- CHECKOUT_FRICTION
- PAYMENT_FAILURE
- TECHNICAL_REGRESSION
- TRAFFIC_MIX

## Retention

- PRODUCT_SATISFACTION_DECLINE
- CUSTOMER_QUALITY_DECLINE
- DELIVERY_EXPERIENCE_DECLINE
- CRM_WEAKNESS
- COHORT_MIX
- SUBSCRIPTION_CHURN_DRIVER

## Inventory

- FORECAST_BIAS
- DEMAND_SPIKE
- PURCHASE_UNDERBUY
- SUPPLIER_DELAY
- LEAD_TIME_CHANGE
- PORTFOLIO_ALLOCATION_ERROR

## Operations

- CAPACITY_SATURATION
- STAFFING_GAP
- PROCESS_FAILURE
- CARRIER_DETERIORATION
- RETURN_BACKLOG

## Finance

- MARGIN_COMPRESSION
- CAC_PRESSURE
- DISCOUNT_PRESSURE
- INVENTORY_CASH_LOCKUP
- WORKING_CAPITAL_STRAIN
- PAYMENT_TERM_MISMATCH

## Data

- TRACKING_LOSS
- EVENT_DUPLICATION
- SOURCE_DIVERGENCE
- ATTRIBUTION_DRIFT
- SCHEMA_DRIFT
- PARTIAL_SYNC

## Technology

- DEPLOYMENT_REGRESSION
- LATENCY_REGRESSION
- APP_CONFLICT
- CHECKOUT_BUG
- INTEGRATION_FAILURE

## Team

- CAPACITY_SHORTFALL
- OWNERSHIP_GAP
- KEY_PERSON_DEPENDENCY
- DECISION_BOTTLENECK
- SKILL_GAP

## Strategy

- OBJECTIVE_MISALIGNMENT
- RESOURCE_MISALLOCATION
- CHANNEL_OVERDEPENDENCE
- PORTFOLIO_MISALIGNMENT
- PREMATURE_SCALING

---

# 35. Cross-capability Hypotheses

D8 debe poder proponer explicaciones que crucen áreas.

Ejemplo:

> Acquisition deterioration is downstream of inventory availability weakness.

Esto evita:

`Meta metric changed → Meta problem`

---

# 36. Hypothesis Test Planning

Cuando falta evidencia, D8 puede generar:

- `NEXT_BEST_TEST`

Esto es acción diagnóstica, no business recommendation.

Permitido:

> Inspect payment error codes to distinguish provider failure from fraud-rule rejection.

No permitido todavía:

> Switch payment provider.

---

# 37. Tool-first Diagnostic Principle

Primero:

- AVAILABLE SYSTEM DATA

Después:

- USER QUESTION

Si la plataforma puede obtener la evidencia automáticamente, no debería pedírsela al usuario.

---

# 38. Test Ranking

Los tests pueden priorizarse por:

- information gain;
- cost;
- latency;
- availability;
- intrusiveness.

Cheap evidence first cuando sea posible.

---

# 39. Hypothesis Separation

Conceptualmente puede existir:

- `HYPOTHESIS_SEPARATION`

High:
- una explicación claramente superior.

Low:
- varias encajan de forma similar.

Low separation limita confidence.

---

# 40. Evidence Saturation

Más evidencia redundante no siempre aporta información.

Diez métricas derivadas del mismo event source no equivalen a diez evidencias independientes.

---

# 41. Evidence Independence

D1 lineage ayuda a determinar independencia.

Es más valioso corroborar con:

- Shopify;
- payment logs;
- support tickets;

que con tres métricas derivadas del mismo pixel.

---

# 42. Evidence Weight

Puede depender de:

- source reliability;
- independence;
- directness;
- specificity;
- temporal fit.

---

# 43. Evidence Types

## Direct

Ejemplo:
- logs exactos de 3DS invalid config.

## Indirect

Ejemplo:
- payment success cayó después del deployment.

## Circumstantial

Ejemplo:
- support tickets mencionan card problems.

---

# 44. Contradiction Strength

Puede existir:

- WEAK
- MODERATE
- STRONG
- DECISIVE

Tipos:

- scope contradiction;
- temporal contradiction;
- magnitude contradiction;
- mechanistic contradiction.

---

# 45. Confounders

Cada hypothesis debe contemplar potential confounders.

Ejemplos:

- seasonality;
- promotion;
- traffic mix;
- price change;
- tracking.

D12 profundizará este control.

---

# 46. Competing Causal Paths

D8 debe contrastar hipótesis que compiten por explicar el mismo target.

Ejemplo CVR ↓:

- price resistance;
- product availability;
- mobile regression;
- traffic quality deterioration.

La evidencia discriminante debe separar ramas.

---

# 47. Multi-step Hypotheses

Algunas hypotheses contienen cadenas.

Ejemplo:

`Creative production slowed → winner replacement fell → concentration increased → response deteriorated → CAC increased`

Cada edge debe ser testable por separado.

---

# 48. Weakest-link Rule

Si un eslabón importante tiene soporte débil:

> overall hypothesis confidence must decrease

No basta con que downstream esté bien demostrado.

---

# 49. Hypotheses at Multiple Depths

Puede coexistir:

- surface explanation;
- intermediate explanation;
- root candidate.

Ejemplo:

- CAC rose because CPC rose.
- CPC rose because CTR deteriorated.
- CTR deteriorated because mature creative inventory stopped being replenished.

D9 decide la mejor root cause soportada.

---

# 50. Broad-to-Deep Search

Primero:

- acquisition?
- conversion?
- offer?
- inventory?

Después:

- specific mechanism.

Esto reduce tunnel vision.

---

# 51. Confidence

Debe depender de:

- mechanism strength;
- supporting evidence;
- contradictions;
- falsification;
- alternative separation;
- data quality;
- context quality;
- scope fit;
- temporal fit;
- magnitude fit.

Categorías:

- HIGH
- MEDIUM
- LOW
- INSUFFICIENT

---

# 52. Confidence Language

HIGH:
> The evidence strongly supports...

MEDIUM:
> The most likely explanation is...

LOW:
> The pattern is compatible with...

INSUFFICIENT:
> Available evidence does not allow us to distinguish...

---

# 53. No Certainty Theater

Mejor:

> La explicación más probable es X, pero Y sigue siendo plausible.

Peor:

> Tienes X.

`INCONCLUSIVE` es preferible a inventar un ganador.

---

# 54. Impact-sensitive Investigation

No todos los casos merecen la misma profundidad.

Un problema low-impact no necesita decenas de consultas.

Un payment collapse puede justificar investigación profunda inmediata.

---

# 55. Historical Hypothesis Performance

Puede medirse posteriormente:

- confirmation rate;
- false positive rate;
- invalidation rate;
- time to discrimination.

También puede detectarse bias por agente.

---

# 56. Multi-agent Hypotheses

Diferentes agentes pueden proponer hipótesis.

El orchestrator debe compararlas bajo el mismo marco de evidencia, no por autoridad del agente.

---

# 57. Multi-causal Diagnosis

D8 debe soportar:

> No single hypothesis explains the full decline.

Puede estimarse explanatory contribution cuando sea posible y assumptions sean explícitas.

---

# 58. Accounting vs Causal Contribution

Debe diferenciarse:

- ACCOUNTING CONTRIBUTION
- CAUSAL CONTRIBUTION

El primero puede ser exacto.

El segundo puede seguir incierto.

---

# 59. Recursive Hypothesis Generation

D8 debe soportar:

`HYPOTHESIS → NEW TARGET → SUB-HYPOTHESES`

Ejemplo:

Inventory shortage → Why shortage?

- demand exceeded forecast;
- supplier delay;
- under-ordering;
- lead-time assumption wrong;
- PO cancellation.

---

# 60. Root Cause Candidate

D8 puede marcar:

- `ROOT_CAUSE_CANDIDATE = true`

Pero D9 valida root cause.

Downstream metrics como revenue decline, CAC increase o CVR decline no son root cause candidates útiles por sí mismos.

---

# 61. Acute vs Structural

Distinguir:

- `ACUTE_CAUSE`
- `STRUCTURAL_DRIVER`

Ejemplo:

- Acute: Hero SKU stockout
- Structural: replenishment system insufficient for current scale

Ambas pueden ser ciertas.

---

# 62. Immediate Cause vs Underlying Driver

Ejemplo:

Immediate cause:
- payment configuration invalid.

Underlying driver:
- no deployment validation on checkout-critical configuration.

---

# 63. Root-depth Heuristic

Una causa es suficientemente profunda cuando:

- explica el mecanismo;
- está respaldada;
- es suficientemente específica;
- seguir profundizando añade poco decision value.

D9 formalizará este criterio.

---

# 64. Evidence Reuse

La misma evidencia puede:

- apoyar una hypothesis;
- contradecir otra.

Ejemplo:
- CPM stable contradice auction inflation y apoya indirectamente CTR-driven CPC increase.

---

# 65. Evidence Freshness

Una hypothesis debe usar evidencia dentro de ventana relevante.

Datos antiguos pueden tener poco valor para el issue actual.

---

# 66. Explanatory Coverage

Puede existir:

- `EXPLANATORY_COVERAGE`

Una hypothesis local puede explicar output global solo si su exposición es suficiente.

---

# 67. Unexplained Residual

Después de explicar una parte del problema:

- `UNEXPLAINED_RESIDUAL`

debe permanecer visible.

No afirmar explicación completa si el residual material sigue abierto.

---

# 68. Partial Cause

Puede existir:

- `PARTIAL_CAUSE`

Una hypothesis puede ser HIGH confidence y explicar solo 20 %.

Otra puede ser MEDIUM y potencialmente explicar 70 %.

Confidence y coverage deben permanecer separadas.

---

# 69. Diagnostic Uncertainty

Puede descomponerse en:

- `DATA_UNCERTAINTY`
- `MODEL_UNCERTAINTY`
- `CONTEXT_UNCERTAINTY`
- `CAUSAL_UNCERTAINTY`

---

# 70. Limitations

Toda conclusión debe poder declarar:

- `LIMITATIONS`

Ejemplo:

> La hipótesis de fatiga creativa es la mejor soportada, pero no puede confirmarse completamente porque falta frequency by audience.

---

# 71. Intervention Evidence

Cuando un rollback u otra intervención revierte el problema, la causal confidence puede aumentar mucho.

Pero si varias cosas cambian simultáneamente, persiste confounding.

---

# 72. Passive vs Active Tests

Passive:
- query existing data.

Active:
- A/B test;
- rollback;
- controlled change.

---

# 73. Continuous Monitoring

Una hypothesis puede permanecer:

- `UNDER_TEST`

mientras llegan nuevos datos.

No debe fingirse una respuesta inmediata si el horizonte todavía no permite validar.

---

# 74. Hypothesis Expiry

Una hypothesis puede quedar obsoleta si el fenómeno se resuelve, pero su historial no debe borrarse.

---

# 75. Recurring Hypothesis

Previous case evidence puede elevar un prior tenant-specific.

Ejemplo:

> Las dos últimas veces que apareció este patrón terminó siendo stockout del hero SKU.

Esto aumenta plausibilidad, no confirma el caso actual.

---

# 76. Tenant-specific Priors

Con suficiente historia, F9 podrá aprender conceptualmente:

`P(root cause | symptom, tenant)`

Sin histórico propio, debe usarse general business knowledge con menor confidence.

---

# 77. Expert Knowledge Role

El conocimiento experto puede aportar:

- candidate hypotheses;
- common failure modes;
- discriminating questions;
- mechanisms.

Debe entrar como:

- `GENERAL_HEURISTIC`

No como autoridad.

---

# 78. Explainability

El copiloto debe poder responder:

- Why this hypothesis?
- Why not the alternatives?
- What evidence is missing?
- What would falsify it?

---

# 79. Assumptions

Las assumptions importantes deben ser explícitas.

No convertir assumption en fact.

---

# 80. Evidence Conflict

Si dos fuentes fiables se contradicen, D8 puede concluir:

- `HYPOTHESIS_UNRESOLVED_DUE_TO_EVIDENCE_CONFLICT`

No debe forzarse resolución.

---

# 81. Meta-hypothesis

A veces la mejor explicación es:

> the data itself is inconsistent

Ejemplo:

- Shopify stable
- Stripe stable
- GA down
- Meta down

puede favorecer measurement regression.

---

# 82. Time-segmented Hypotheses

Una causa puede cambiar por periodo.

Una hypothesis puede requerir:

- `valid_from`
- `valid_to`

---

# 83. Scope Evolution

Una hypothesis puede pasar de global a:

- Meta / US / prospecting only.

Debe conservarse versionado/evolución conceptual.

---

# 84. Hypothesis Merge y Split

Varias hypotheses pueden converger en una interacción.

Una hypothesis global también puede dividirse en múltiples causas locales.

---

# 85. Hybrid Intelligence

D8 no debería ser pure LLM porque tendería a:

- confirmation bias;
- premature certainty;
- unstable terminology;
- missing alternatives;
- hallucinated causality.

Tampoco puede ser pure rules porque los casos reales contienen:

- novel combinations;
- qualitative evidence;
- multi-causal interactions;
- complex context.

Debe combinar estructura y razonamiento flexible.

---

# 86. Principio final

El objetivo no es que la IA tenga una opinión.

El objetivo es que:

> mantenga explicaciones competidoras y permita que la evidencia las vaya eliminando.

Ese es el salto entre una IA que comenta métricas y una IA que investiga un negocio.
