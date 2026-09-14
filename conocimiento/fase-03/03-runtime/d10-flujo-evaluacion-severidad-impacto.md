# Fase 03 · D10 — Runtime de severidad e impacto

## Propósito

D10 consume el diagnóstico causal de D9 y evalúa cuánto daño está produciendo, acumulando o poniendo en riesgo.

---

## 1. Inputs

D10 consume:

- root cause;
- current constraint;
- symptom;
- scope;
- root/constraint confidence;
- D4 health/exposure;
- D5 trajectory;
- D7 blast radius;
- D9 reversibility/controllability;
- D1 data reliability;
- D2 context/baselines;
- business economics;
- buffers;
- historical recurrence.

---

## 2. Pipeline principal

### Paso 1 — Definir diagnostic scope

Localizar:
- capability;
- segment;
- market;
- channel;
- product;
- device;
- operational unit.

### Paso 2 — Determinar actual business exposure

Elegir denominador adecuado:
- revenue;
- contribution;
- customers;
- orders;
- traffic;
- spend;
- inventory.

### Paso 3 — Medir current impact

Separar dimensiones:
- revenue;
- contribution;
- cash;
- customer;
- operations;
- brand;
- strategic;
- continuity.

### Paso 4 — Separar evidence layer

Clasificar cada impacto como:
- observed;
- estimated;
- inferred;
- forecast.

### Paso 5 — Clasificar timing

Distinguir:
- realized;
- ongoing;
- potential;
- projected.

### Paso 6 — Cuantificar cuando sea fiable

Elegir:
- exact;
- estimated;
- range;
- directional;
- unknown.

### Paso 7 — Evitar falsa precisión

Preservar assumptions, method y confidence.

### Paso 8 — Estimar loss velocity

Cuando corresponda:
- per hour;
- per day;
- per week.

### Paso 9 — Calcular accumulated impact

Separar daño acumulado de gravedad instantánea.

### Paso 10 — Evaluar duration

Incorporar tiempo activo.

### Paso 11 — Evaluar velocity

Determinar si:
- stable;
- worsening;
- rapidly deteriorating;
- recovering.

### Paso 12 — Evaluar time-to-damage

Especialmente para early risks.

### Paso 13 — Evaluar blast radius

Identificar:
- direct;
- second-order;
- cascade;
- systemic propagation.

### Paso 14 — Evaluar buffers/redundancy

Comprobar:
- cash;
- stock;
- capacity;
- supplier;
- channel;
- technology redundancy.

### Paso 15 — Evaluar absorption capacity

La misma cause puede tener distinta severity según resiliencia.

### Paso 16 — Evaluar reversibility

Consumir D9.

### Paso 17 — Evaluar recoverability

Distinguir:
- cause reversible;
- damage recoverable.

### Paso 18 — Evaluar recurrence

Recurring problems pueden aumentar structural severity.

### Paso 19 — Evaluar opportunity cost

Solo cuando exista una oportunidad bloqueada razonablemente soportada.

### Paso 20 — Construir Severity Vector

Emitir dimensiones por separado.

### Paso 21 — Evaluar dominance

Permitir que:
- continuity;
- liquidity;
- ability to transact;

dominen overall severity cuando proceda.

### Paso 22 — Evaluar globalización

No elevar local CRITICAL a global CRITICAL sin exposure material, salvo continuity threat.

### Paso 23 — Construir Severity Profile

Separar:
- acute;
- cumulative;
- forward;
- structural;
- overall.

### Paso 24 — Calibrar confidence

Separar:
- cause confidence;
- impact confidence;
- severity confidence.

### Paso 25 — Construir Impact Graph

`ROOT CAUSE → DIRECT IMPACT → SECONDARY IMPACT → BUSINESS OUTCOME`

### Paso 26 — Emitir síntesis

Explicar:
- qué daño;
- cuánto;
- dónde;
- durante cuánto;
- cómo se propaga;
- cuánto se recupera;
- qué riesgo futuro existe;
- con qué confianza.

---

## 3. Severity by Domain

### Acquisition
- volume;
- CAC economics;
- spend exposure;
- marginal economics;
- channel dependency.

### Conversion
- stage;
- traffic affected;
- purchase probability;
- critical path.

### Inventory
- revenue share;
- days cover;
- lead time;
- substitutes;
- cash exposure.

### Finance
- runway;
- contribution;
- working capital;
- obligations;
- liquidity.

### Data
- decisions blocked;
- diagnoses compromised;
- measurement scope.

### Technology
- business function;
- availability;
- errors;
- scope;
- redundancy.

El resto de capabilities siguen el mismo principio contextual.

---

## 4. Risk Branch

Cuando todavía no existe daño:

1. identificar leading risk;
2. estimar time-to-damage;
3. evaluar exposure;
4. evaluar buffer;
5. evaluar likelihood cualitativa;
6. emitir forward risk separado de current severity.

---

## 5. Quantification Branch

Cuando existe baseline fiable:

1. expected outcome;
2. observed outcome;
3. delta;
4. economic translation;
5. range;
6. confidence;
7. assumptions.

---

## 6. D10 → D4 Feedback

Impact/severity pueden actualizar la representación de health, pero no deben sustituirla.

---

## 7. Output Boundary

D10 produce:
- severity;
- impact;
- exposure;
- propagation;
- risk;
- quantification.

D10 no produce:
- priority;
- action;
- playbook;
- execution order.

F4 utilizará estas salidas más adelante.
