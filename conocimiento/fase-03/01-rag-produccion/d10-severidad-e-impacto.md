# Fase 03 · D10 — Severidad e impacto

## Propósito

D10 responde:

> ¿Cuánto importa realmente este problema para el negocio?

Hasta D9 el sistema conoce qué ocurrió, dónde, por qué, la root cause y el current constraint. D10 transforma ese diagnóstico causal en una medida empresarial de daño actual, acumulado y potencial.

Debe mantener separados:

`HEALTH ≠ SEVERITY ≠ IMPACT ≠ PRIORITY`

- Health = estado de una capability.
- Severity = gravedad del diagnóstico actual.
- Impact = daño empresarial realizado o potencial.
- Priority = qué abordar primero; pertenece a Fase 4.

---

## 1. Magnitude ≠ Severity

Un cambio porcentual mayor no implica necesariamente mayor gravedad.

La severidad debe considerar:

- qué cambió;
- dónde;
- durante cuánto tiempo;
- cuánto negocio depende del elemento afectado;
- qué daño económico produce;
- velocidad de deterioro;
- propagación;
- continuidad.

---

## 2. Severity Levels

Estados conceptuales:

- `INFO`
- `LOW`
- `MODERATE`
- `HIGH`
- `CRITICAL`
- `BUSINESS_THREAT`

### INFO
Condición relevante sin daño material actual.

### LOW
Impacto limitado y localizado.

### MODERATE
Daño real pero contenido.

### HIGH
Impacto material sobre parte significativa del negocio.

### CRITICAL
Deterioro severo de una función importante.

### BUSINESS_THREAT
Reservado para amenaza a:
- continuidad;
- liquidez;
- capacidad de transaccionar;
- confianza crítica del cliente;
- continuidad legal/operativa.

`BUSINESS_THREAT` debe ser excepcional.

---

## 3. Revenue Impact

Pregunta:

> ¿Qué revenue está perdiéndose, degradándose o quedando expuesto?

Distinguir:

- direct revenue impact;
- indirect revenue impact;
- `REALIZED_LOSS`;
- `REVENUE_AT_RISK`.

Un riesgo de stockout puede tener revenue perdido = 0 y revenue at risk = HIGH.

---

## 4. Impact Timing

El impacto puede ser:

- `REALIZED`
- `ONGOING`
- `POTENTIAL`
- `PROJECTED`

Estas categorías no deben mezclarse.

---

## 5. Contribution Impact

Revenue no basta para estimar daño económico.

Debe poder evaluarse:

- lost contribution;
- contribution compression;
- future contribution exposure;
- `CONTRIBUTION_AT_RISK`.

Distinguir:

- `GROSS_REVENUE_IMPACT`
- `NET_REVENUE_IMPACT`
- `CONTRIBUTION_IMPACT`

---

## 6. Cash Impact

Pregunta:

> ¿Está reduciendo liquidez o aumentando consumo de caja?

Tipos:

- `CASH_BURN`
- `WORKING_CAPITAL_PRESSURE`
- `CASH_LOCKUP`
- `PAYMENT_DELAY`
- `LIQUIDITY_RISK`

Profit impact y cash impact pueden divergir.

---

## 7. Liquidity Exposure

D10 debe prestar atención especial a riesgos que puedan impedir:

- supplier payments;
- payroll;
- tax payments;
- media spend;
- inventory replenishment.

---

## 8. Customer Impact

Debe considerar:

- users affected;
- orders affected;
- customers affected;
- % checkout users affected;
- % active customers affected.

Tipos:

- `FRICTION`
- `FAILED_PURCHASE`
- `DELAY`
- `POOR_EXPERIENCE`
- `REFUND`
- `CHURN_RISK`
- `TRUST_DAMAGE`

---

## 9. Operational Impact

Debe valorar:

- backlog;
- SLA breach;
- capacity loss;
- manual workload;
- error propagation;
- service interruption.

El impacto puede propagarse:

`Warehouse backlog → dispatch delay → tickets → refunds → retention`

---

## 10. Brand Impact

Puede afectar:

- reviews;
- word of mouth;
- trust;
- brand demand;
- future conversion.

Suele tener lag mayor que el impacto transaccional inmediato.

---

## 11. Strategic Impact

Pregunta:

> ¿El problema bloquea una iniciativa estratégica importante?

Strategic impact puede ser alto aunque el revenue actual afectado sea pequeño.

---

## 12. Continuity Impact

Pregunta:

> ¿Puede esta condición impedir que el negocio continúe operando?

Ejemplos:

- checkout outage;
- cash insolvency risk;
- warehouse shutdown;
- critical database failure;
- complete inventory depletion.

---

## 13. Business Exposure

`BUSINESS_EXPOSURE` representa qué proporción relevante del negocio está conectada al problema.

Puede usar distintos denominadores:

- revenue share;
- gross profit share;
- contribution share;
- spend share;
- order share;
- customer share;
- traffic share;
- inventory value share.

El denominador correcto depende del diagnóstico.

---

## 14. Blast Radius

Pregunta:

> ¿Cuántas capabilities downstream puede afectar el problema?

Debe distinguirse:

- direct impact;
- second-order impact;
- cascade;
- systemic propagation risk.

---

## 15. Systemic Propagation

Un problema localizado puede propagarse.

Ejemplo:

`Poor forecasting → stockout → revenue decline → cash pressure → underbuy → further stockouts`

Esto puede producir:

- `SYSTEMIC_PROPAGATION_RISK`

---

## 16. Duration

La duración modifica severidad.

Un -15 % de CVR durante una hora no equivale al mismo deterioro durante tres meses.

Pero un failure en critical path puede ser severo inmediatamente.

---

## 17. Velocity

Pregunta:

> ¿Qué tan rápido está empeorando?

Un problema MODERATE pero `RAPIDLY_DETERIORATING` puede escalar a HIGH según exposición.

---

## 18. Severity + Trajectory

Debe conservarse por separado:

- current severity;
- trajectory.

HIGH + RECOVERING no equivale a HIGH + RAPIDLY_DETERIORATING.

---

## 19. Reversibility y Recoverability

D9 aporta reversibility de la causa.

D10 debe considerar:

- qué tan fácil es revertir la causa;
- qué parte del daño puede recuperarse.

Una causa puede ser fácil de revertir y, sin embargo, las ventas perdidas no ser recuperables.

---

## 20. Time-to-Damage

Pregunta:

> ¿Cuánto tiempo puede permanecer activo antes de generar daño material?

Ejemplos:
- checkout failure: inmediato;
- creative pipeline weakness: semanas;
- inventory risk: según days of cover.

---

## 21. Current Impact vs Future Risk

No mezclar:

- `CURRENT_IMPACT`
- `FUTURE_RISK`

Puede existir:

- current severity MODERATE;
- forward risk CRITICAL.

---

## 22. Multi-dimensional Severity

No debe reducirse inmediatamente a un único score.

Puede utilizarse un `SEVERITY_VECTOR` con dimensiones:

- Revenue
- Contribution
- Cash
- Customer
- Operations
- Brand
- Strategic
- Continuity

---

## 23. Critical Dimension Dominance

Algunas dimensiones pueden dominar el overall severity.

Ejemplo:

- Revenue LOW
- Cash BUSINESS_THREAT

Overall = BUSINESS_THREAT puede ser correcto.

---

## 24. Critical Path Dominance

Si la capacidad de transaccionar está gravemente afectada, overall severity puede ser alta aunque otras dimensiones estén sanas.

---

## 25. Impact Quantification

Siempre que sea fiable, D10 debe cuantificar.

Niveles de cuantificación:

- `EXACT`
- `ESTIMATED`
- `RANGE`
- `DIRECTIONAL`
- `UNKNOWN`

No inventar precisión.

---

## 26. Counterfactual Impact

Muchas pérdidas se estiman comparando:

`EXPECTED OUTCOME vs OBSERVED OUTCOME`

Solo debe usarse si el baseline/counterfactual es suficientemente fiable.

---

## 27. False Financial Precision

No presentar una estimación modelada como cifra exacta.

Es preferible:

- €15k–€22k/day

a:

- €21,378.42/day

si no existe exactitud real.

---

## 28. Loss Rates

Puede estimarse:

- `LOSS_PER_HOUR`
- `LOSS_PER_DAY`
- `LOSS_PER_WEEK`
- cumulative loss since onset;
- contribution loss rate;
- cash burn rate;
- customer damage rate;
- operations damage rate.

---

## 29. Impact Acceleration

No basta con medir cuánto se pierde.

También:

> ¿Está aumentando el ritmo de pérdida?

La aceleración puede elevar severidad.

---

## 30. Impact Concentration

El daño puede concentrarse en:

- hero product;
- VIP customers;
- key geography;
- high-margin channel.

Un scope pequeño en volumen puede ser enorme en contribution.

---

## 31. Customer Value / Margin / Strategic Weighting

Cuando sea relevante, ponderar:

- LTV;
- contribution;
- strategic importance.

No confundir weighting con priority.

---

## 32. Opportunity Cost

Algunos constraints no generan pérdida realizada, sino crecimiento no capturado.

Debe distinguirse:

- `OPPORTUNITY_COST`
- `REALIZED_LOSS`

Opportunity cost suele tener menor confidence.

---

## 33. Severity Without Monetary Quantification

No hace falta una cifra monetaria exacta para identificar un checkout outage como CRITICAL.

La cuantificación económica debe añadirse cuando sea fiable.

---

## 34. Cause Confidence ≠ Impact Confidence

Puede conocerse bien el daño y mal la causa.

Ejemplo:

- orders -70 %;
- severity CRITICAL con alta confianza;
- root cause todavía LOW confidence.

También puede ocurrir lo contrario.

---

## 35. Risk

Conceptualmente:

`RISK ≈ LIKELIHOOD × IMPACT`

Pero no deben inventarse probabilidades falsas.

Si no existe modelo calibrado, usar:

- scenario ranges;
- qualitative likelihood.

---

## 36. Risk Matrix

Puede utilizar:

Likelihood:
- LOW
- MEDIUM
- HIGH

Impact:
- LOW
- MEDIUM
- HIGH
- CRITICAL

Likelihood puede derivar de:

- trajectory;
- leading indicators;
- known constraints;
- historical recurrence.

---

## 37. Recurrence

La recurrencia puede elevar severidad estructural.

Un bug corto pero repetido varias veces puede indicar riesgo sistémico mayor.

---

## 38. Acute, Cumulative, Forward y Structural Severity

D10 debe poder distinguir:

- `ACUTE_SEVERITY`
- `CUMULATIVE_SEVERITY`
- `FORWARD_RISK`
- `STRUCTURAL_SEVERITY`

Estos perfiles pueden diferir mucho para el mismo problema.

---

## 39. Cumulative Impact

Una debilidad moderada mantenida durante mucho tiempo puede producir más daño acumulado que un incidente crítico muy corto.

---

## 40. Business Criticality ≠ Current Impact

Una capability crítica puede tener impacto actual bajo si existe redundancia efectiva.

---

## 41. Redundancy

D10 debe considerar:

- backup provider;
- safety stock;
- cash buffer;
- alternate channel;
- spare capacity;
- redundant systems.

---

## 42. Resilience Buffer

Los buffers reducen severidad efectiva.

Misma causa + distinto buffer = distinta severidad.

---

## 43. Absorption Capacity

`ABSORPTION_CAPACITY` describe cuánto shock puede absorber el negocio.

Dimensiones:

- cash buffer;
- inventory buffer;
- operational redundancy;
- channel diversification;
- supplier redundancy;
- technical redundancy.

---

## 44. Shock × Buffer

La misma anomalía puede barely matter o threaten continuity según capacidad de absorción.

---

## 45. Severity Escalation

Puede escalar cuando:

- problem persists;
- exposure expands;
- trajectory worsens;
- buffers decline;
- secondary effects appear.

---

## 46. Severity De-escalation

Puede reducirse cuando:

- problem contained;
- scope shrinks;
- recovery begins;
- redundancy activated;
- impact stops accumulating.

---

## 47. Impact Timeline

D10 debe poder representar la evolución temporal del impacto.

Ejemplo:

- anomaly starts;
- funnel degradation;
- material lost-order impact;
- CRITICAL severity.

---

## 48. D10 Is Not Alert Policy

Los cambios de severity pueden alimentar alerts, pero notification policy pertenece a runtime/monitoring posterior.

---

## 49. Severity by Capability

### Acquisition
Considerar:
- new customer volume;
- CAC economics;
- spend exposure;
- marginal economics;
- channel dependency.

### Creative
- spend dependent on affected creatives;
- replacement availability;
- propagation;
- pipeline.

### Conversion
- funnel stage;
- traffic affected;
- lost purchase probability;
- critical-path position.

### Inventory
- revenue share;
- days cover;
- lead time;
- replacement availability;
- cash exposure.

### Operations
- orders affected;
- backlog;
- SLA;
- capacity;
- customer impact.

### Finance
- cash runway;
- negative contribution;
- working capital;
- obligations;
- liquidity.

### Data
- decisions blocked;
- diagnoses made unreliable;
- scope of distortion.

### Technology
- business function affected;
- availability;
- errors;
- scope;
- redundancy.

### Team
- critical ownership;
- execution backlog;
- dependency;
- capacity.

### Strategy
- strategic initiative blocked;
- resource waste;
- duration;
- business dependence.

---

## 50. Local vs Global Severity

Puede existir:

- local symptom CRITICAL;
- business severity LOW.

Antes de declarar BUSINESS CRITICAL:

> ¿El impacto alcanza una parte material del negocio global?

Excepción: amenazas de continuity/liquidity.

---

## 51. Severity and Uncertainty

High uncertainty no significa low severity.

Debe poder representarse:

- potential severity: CRITICAL;
- severity confidence: LOW/MEDIUM.

---

## 52. Evidence Layer

Mantener separados:

- `OBSERVED_IMPACT`
- `ESTIMATED_IMPACT`
- `INFERRED_IMPACT`
- `FORECAST_IMPACT`

No mezclarlos como hechos equivalentes.

---

## 53. Impact Graph

Conceptualmente:

`ROOT CAUSE → DIRECT IMPACT → SECONDARY IMPACT → BUSINESS OUTCOME`

D7 pregunta:

> what can cause what?

D10 pregunta:

> how much damage is flowing through that path?

---

## 54. Severity ≠ Priority

Dos problemas pueden tener:

- distinta severity;
- distinto cumulative impact;
- distinta reversibility;
- distinto strategic value.

Cuál abordar primero pertenece a F4.

---

## 55. Buffer Exhaustion

Puede estimarse horizonte de agotamiento de:

- cash buffer;
- inventory buffer;
- capacity buffer;
- creative buffer.

Un buffer fino aumenta forward severity.

---

## 56. Principio final

D10 convierte un diagnóstico causal en una medida real de impacto empresarial.

Debe preguntar:

- dónde cayó;
- cuánto negocio afecta;
- cuántos pedidos;
- cuánto revenue;
- cuánta contribution;
- qué pasa con cash;
- si se propaga;
- cuánto aguanta el negocio;
- si el daño es recuperable;
- si empeora;
- con qué confidence puede cuantificarse.

Y todavía no decide qué hacer primero.
