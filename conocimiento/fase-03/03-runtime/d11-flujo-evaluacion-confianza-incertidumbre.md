# Fase 03 · D11 — Runtime de confianza e incertidumbre

## Propósito

D11 evalúa claim por claim la fuerza epistemológica de las salidas de D1–D10 y produce confidence, uncertainty, limitations y requisitos de evidencia adicional.

---

## 1. Inputs

D11 consume:

- D1 reliability/coverage/lineage;
- D2 context quality;
- D3 maturity confidence;
- D4 health claims;
- D5 signal evidence;
- D6 symptom evidence;
- D7 mechanisms/paths;
- D8 alternatives/contradictions/missing evidence;
- D9 root cause/constraint;
- D10 impact/severity;
- source authority/version/freshness;
- claim scope and time window.

---

## 2. Pipeline principal

### Paso 1 — Enumerar claims

Separar:
- what;
- where;
- signal;
- symptom;
- why;
- root cause;
- constraint;
- impact;
- severity;
- forecast/risk.

### Paso 2 — Asignar epistemic state

Para cada claim:
- OBSERVED;
- DERIVED;
- INFERRED;
- HYPOTHESIZED;
- CONFIRMED;
- UNKNOWN.

### Paso 3 — Evaluar data reliability

Consumir D1.

### Paso 4 — Evaluar coverage

¿Se observa suficiente parte del fenómeno?

### Paso 5 — Evaluar context quality

Consumir D2.

### Paso 6 — Evaluar sample sufficiency

Ajustado a granularidad.

### Paso 7 — Evaluar temporal fit

Incluyendo domain-appropriate horizon.

### Paso 8 — Evaluar scope fit

Cause/effect/claim deben cubrir el scope afirmado.

### Paso 9 — Evaluar mechanism strength

Consumir D7/D8/D9.

### Paso 10 — Evaluar evidence consistency

Buscar conflictos entre fuentes.

### Paso 11 — Evaluar evidence independence

Usar lineage para identificar dependent evidence.

### Paso 12 — Evaluar alternatives

Medir separation frente a challengers.

### Paso 13 — Evaluar contradictions

Clasificar materiality y decisiveness.

### Paso 14 — Registrar missing evidence

Distinguir:
- unknown;
- observed absent;
- critical unknown.

### Paso 15 — Evaluar explanatory coverage

Separar confidence de completeness.

### Paso 16 — Aplicar confidence caps

Ejemplos:
- low data quality;
- insufficient coverage;
- weak temporal fit;
- external cause unobserved;
- inadequate horizon.

### Paso 17 — Determinar confidence level

Emitir:
- HIGH;
- MEDIUM;
- LOW;
- INSUFFICIENT_DATA.

### Paso 18 — Clasificar uncertainties

Por tipo y materialidad.

### Paso 19 — Clasificar resolvability

- now;
- new data;
- over time;
- not resolvable.

### Paso 20 — Determinar improvement requirement

Responder:
> ¿Qué evidencia permitiría elevar confidence?

### Paso 21 — Evaluar freshness/decay

Según dominio y context changes.

### Paso 22 — Evaluar applicability de RAG

Separar:
- retrieval similarity;
- authority;
- version;
- applicability;
- case evidence.

### Paso 23 — Calibrar lenguaje

La generación debe consumir confidence + epistemic state.

### Paso 24 — Construir Confidence Matrix

Una fila por claim.

### Paso 25 — Construir uncertainty summary

Preferir:
- known;
- likely;
- unknown;
- critical unknowns;
- limitations.

No un score opaco.

---

## 3. Confidence Update Runtime

Cuando llega nueva evidencia:

1. registrar evidence;
2. reevaluar contradiction/alternatives;
3. actualizar confidence;
4. registrar por qué cambió;
5. preservar previous state.

---

## 4. Confidence Decay Runtime

Si:
- pasa demasiado tiempo;
- cambia market;
- cambia price;
- cambia strategy;
- cambia measurement architecture;

reevaluar applicability y freshness.

No aplicar un decay universal.

---

## 5. Negative Claim Runtime

Antes de afirmar:
> no hay problema

comprobar:
- data availability;
- coverage;
- stability evidence.

Si faltan datos:
- NO_EVIDENCE.

Si datos completos y estables:
- EVIDENCE_OF_STABILITY.

---

## 6. Invalidation Runtime

Al rechazar una hypothesis:
- registrar invalidation confidence;
- separar LESS_SUPPORTED de INVALIDATED;
- registrar decisive evidence cuando exista.

---

## 7. Orchestrator Use

El orchestrator puede usar D11 para decidir si:
- another query has high information gain;
- diagnostic answer is ready;
- answer must carry limitations;
- diagnosis is not ready.

---

## 8. Output

D11 debe producir:
- claim confidence matrix;
- epistemic states;
- uncertainty list;
- critical unknowns;
- confidence caps;
- assumptions;
- limitations;
- confidence improvement requirements;
- freshness/applicability notes;
- user-facing known/likely/unknown synthesis.

---

## 9. Boundary

D11 no:
- añade nueva causalidad sin evidence;
- convierte uncertainty en priority;
- ejecuta business action;
- sustituye D1–D10;
- convierte RAG retrieval score en diagnosis truth.

---

## Actualizacion de integracion D07-D09 — 2026-09-16

El runtime ya no trata las capas causales como una plantilla fija. Antes de
llamar a `assessConfidence`, el adaptador carga, siempre dentro de la
organizacion y del caso:

- `causal_paths` y `causal_case_evidence` de D07;
- hipotesis vivas de `diagnostic_hypotheses` de D08;
- causas raiz y constraints activos de D09.

La funcion pura conserva esas salidas como evidencia: una ruta parcial produce
una lectura causal parcial y una candidata `latent` se muestra como candidata,
no como constraint vinculante. Si no hay filas para el caso, se mantiene
`insufficient_data`, pero el motivo pasa a ser "no hay salidas causales
enlazadas" y no que los motores D07-D09 no existan. La confianza global hereda
la capa `why` y las alternativas de D08 se reflejan en `alternative_separation`.

La escritura sigue siendo una foto completa: se borran claims, dimensiones,
caps e incertidumbres anteriores y se reescribe el conjunto actual. La prueba
real con `.env.local` sembró una ruta D07, la pasó por D08 y D09, confirmó tres
claims causales no genéricos en D11, ejecutó dos pasadas idénticas y limpió el
caso a cero.
