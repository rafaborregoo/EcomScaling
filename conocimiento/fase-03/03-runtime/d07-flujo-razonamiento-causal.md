# Fase 03 · D07 — Runtime del grafo causal

## Propósito

D7 usa el grafo para restringir la búsqueda causal, recorrer rutas plausibles y preparar hipótesis explícitas para D8 sin confirmar root cause.

---

## 1. Inputs

D7 consume:

- reliable observations de D1;
- context/events/confounders de D2;
- structural relations de D3;
- health/exposure de D4;
- changed nodes de D5;
- symptoms de D6;
- global causal graph;
- tenant-specific relations cuando existan.

---

## 2. Pipeline principal

### Paso 1 — Seleccionar target

Ejemplos:

- Revenue ↓
- CAC ↑
- Payment Completion Failure
- Cash Pressure

### Paso 2 — Resolver node y scope

Identificar:

- canonical node;
- market/channel/product/device/etc.;
- observed vs real variable.

### Paso 3 — Recuperar parents directos

Obtener candidate parents del target.

### Paso 4 — Evaluar signal support

Usar D5 para saber qué candidate nodes cambiaron realmente.

### Paso 5 — Podar branches contradichas

Ejemplo:

- target CAC ↑;
- CVR stable;
- branch CVR pierde soporte.

### Paso 6 — Evaluar mechanism

Descartar relaciones sin mecanismo suficiente.

### Paso 7 — Evaluar temporal fit

Comprobar:

- cause before effect;
- expected lag;
- observed lag.

### Paso 8 — Evaluar scope fit

Cause y effect deben afectar scopes compatibles.

### Paso 9 — Evaluar magnitude fit

Comprobar exposure y capacidad explicativa.

### Paso 10 — Evaluar context conditions

Aplicar conditions y contextual factors.

### Paso 11 — Revisar confounders

Evitar relaciones aparentes por seasonality, mix u otros common causes.

### Paso 12 — Revisar measurement layer

Separar:

- actual business change;
- observed metric distortion.

### Paso 13 — Calcular case causal confidence

Usar evidencia del caso, no solo edge strength global.

### Paso 14 — Expandir upstream

Recorrer ancestors si el parent inmediato sigue siendo síntoma/intermediario.

### Paso 15 — Mantener alternativas

Preservar competing paths.

### Paso 16 — Detectar multicausalidad

Permitir varias causes contributory.

### Paso 17 — Detectar interactions

Considerar hyperedges y threshold effects.

### Paso 18 — Construir supported paths

Producir rutas con:

- support;
- contradictions;
- missing evidence;
- confidence.

### Paso 19 — Identificar next evidence

Señalar qué datos/tests discriminarían entre paths.

### Paso 20 — Enviar a D8

Cada branch restante puede convertirse en hypothesis explícita.

---

## 3. Forward traversal

Desde un evento/cause candidate:

1. recorrer descendants;
2. comprobar si downstream effects esperados aparecen;
3. comparar scope y timing;
4. detectar missing downstream evidence.

Esto ayuda a validar o debilitar la relación.

---

## 4. Backward traversal

Desde un outcome/symptom:

1. recuperar parents;
2. contrastar changed nodes;
3. podar branches;
4. repetir rootward.

---

## 5. Causal evidence evaluation

Orden conceptual:

- randomized experiment;
- natural experiment;
- before/after with control;
- temporal + mechanistic;
- multi-source corroboration;
- correlation-only.

Correlation-only no debe producir HIGH confidence.

---

## 6. Control logic

Cuando existan:

- unaffected segments;
- control markets;
- devices;
- cohorts;

usar estos grupos para contrastar candidate paths.

---

## 7. Scoped graph runtime

Instanciar templates globales por scope cuando sea válido.

Ejemplo:

`STOCK_AVAILABILITY → CVR`

puede convertirse en:

`SKU_123 availability → SKU_123 PDP CVR`

---

## 8. Measurement runtime

Antes de concluir business deterioration:

1. comprobar tracking/config;
2. distinguir real-world node de observed metric;
3. buscar fuentes independientes.

---

## 9. Constraint traversal

Además de causal edges, D7 puede revisar:

- LIMITS;
- REQUIRES;
- capacity dependencies.

Esto prepara bottleneck/root-cause search posterior.

---

## 10. Output

D7 debe emitir:

- target;
- supported paths;
- rejected/contradicted paths;
- untested paths;
- edge confidence;
- case confidence;
- weak links;
- alternative explanations;
- missing evidence;
- next branches for D8.

---

## 11. Boundary

D7 no debe:

- declarar root cause final;
- elegir acción;
- priorizar;
- convertir correlation en causality;
- ocultar causal ambiguity.
