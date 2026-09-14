# Fase 03 · D09 — Runtime de Root Cause & Constraint

## Propósito

D9 transforma las hypotheses mejor soportadas de D8 en una conclusión causal calibrada y, separadamente, determina qué capability limita actualmente el target.

---

## 1. Inputs

D9 consume:

- primary hypothesis;
- challenger;
- supported causal paths;
- root cause candidates;
- residual uncertainty;
- evidence ledger;
- D7 graph;
- D4 exposure/health;
- D3 maturity gaps;
- D2 context;
- D1 reliability;
- historical recurrence.

---

## 2. Root Cause Pipeline

### Paso 1 — Seleccionar candidate root paths

Partir de D8.

### Paso 2 — Clasificar levels

Separar:

- symptom;
- intermediate cause;
- immediate cause;
- root cause candidate;
- underlying driver.

### Paso 3 — Validar causal path

Cada link debe tener:
- mechanism;
- evidence;
- temporal fit;
- scope fit;
- magnitude fit.

### Paso 4 — Aplicar weakest-link rule

La confidence de la cadena no debe superar el eslabón crítico más débil.

### Paso 5 — Revisar direct evidence

Buscar:
- logs;
- config diff;
- system evidence;
- intervention result;
- controls.

### Paso 6 — Buscar contradictions

Preguntar:
> What evidence would make this cause impossible?

### Paso 7 — Comparar alternatives

Preferir:
- higher evidence quality;
- better scope fit;
- better time fit;
- greater explanatory coverage;
- fewer unsupported assumptions.

### Paso 8 — Permitir multicausality

Si varias causas contribuyen materialmente:
- MULTICAUSAL.

### Paso 9 — Calcular coverage/residual

No cerrar si queda residual material.

### Paso 10 — Determinar root depth

Parar cuando:
- mechanism explained;
- evidence sufficient;
- specificity adequate;
- deeper search adds little diagnostic value.

### Paso 11 — Clasificar cause

Asignar:
- family;
- type;
- role;
- controllability;
- reversibility;
- active/resolved;
- recurrent/non-recurrent.

### Paso 12 — Cerrar provisionalmente

Posibles resultados:
- CONFIRMED;
- PROBABLE;
- PARTIAL_ROOT_CAUSE;
- UNRESOLVED.

---

## 3. Constraint Pipeline

### Paso 1 — Definir target

Pregunta:
> What output are we trying to explain or grow?

### Paso 2 — Enumerar candidate constraints

Usar:
- causal graph;
- capacity data;
- maturity gaps;
- health;
- backlog/queues;
- stock;
- economic guardrails;
- dependencies.

### Paso 3 — Evaluar binding test

Pregunta:
> Which capability currently prevents additional target output first?

### Paso 4 — Evaluar demand vs capacity

Cuando sea aplicable:

`DEMAND ON CAPABILITY > AVAILABLE CAPACITY`

### Paso 5 — Evaluar counterfactual

Pregunta:
> If this constraint disappeared, would target improve materially?

### Paso 6 — Evaluar falsifier

Pregunta:
> What evidence would show this is NOT the constraint?

### Paso 7 — Clasificar

Puede resultar:
- primary;
- secondary;
- latent;
- hard;
- soft;
- structural;
- temporary.

### Paso 8 — Localizar scope

No generalizar.

### Paso 9 — Evaluar blast radius/exposure

Con D4.

### Paso 10 — Separar priority

No convertir binding constraint en prioridad automáticamente.

---

## 4. Root Cause / Constraint Consistency

D9 debe permitir:

### Root resolved + constraint active
Ejemplo:
supplier delay resolved, stock todavía ausente.

### Constraint resolved + structural driver active
Ejemplo:
emergency stock arrives, forecasting weakness sigue.

### Root known + no business constraint
Ejemplo:
tracking regression.

### Constraint known + root unresolved
Ejemplo:
inventory availability limita, causa aún desconocida.

---

## 5. Recurrence Check

Antes de cerrar:

1. buscar casos previos similares;
2. marcar RECURRENT si aplica;
3. elevar investigación de structural driver;
4. no convertir recurrencia en prueba automática.

---

## 6. Positive Diagnosis

D9 también puede cerrar positive drivers si existe evidencia.

---

## 7. Multi-agent Synthesis

El orchestrator debe:

1. recoger partial causal chains;
2. alinear canonical concepts;
3. conectar cross-capability paths;
4. identificar upstream root candidate;
5. separar root cause de current constraint;
6. preservar confidence y uncertainty.

---

## 8. Output

D9 debe emitir:

- target;
- symptom;
- immediate cause;
- intermediate causes;
- root cause;
- underlying driver;
- current constraint;
- root confidence;
- constraint confidence;
- coverage;
- residual;
- controllability;
- reversibility;
- recurrence;
- active/resolved state;
- limitations.

---

## 9. Boundary

D9 no:
- calcula severity final;
- decide priority;
- selecciona playbook;
- ejecuta acciones.

D10 recibe el resultado causal para medir daño e impacto.
