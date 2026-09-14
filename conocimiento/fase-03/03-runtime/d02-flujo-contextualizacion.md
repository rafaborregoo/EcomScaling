# Fase 03 · D02 — Flujo operativo de contextualización

## Propósito

Este artefacto describe cómo debe comportarse D2 antes de que el sistema avance hacia hipótesis causales o root cause.

---

## 1. Entrada mínima

D2 consume:

- la señal o métrica observada;
- el periodo y scope;
- la evaluación de fiabilidad de D1;
- el contexto disponible del tenant;
- contexto histórico relevante cuando exista.

Si D1 degrada una fuente, D2 debe conservar esa incertidumbre.

---

## 2. Secuencia operacional

### Paso 1 — Determinar la pregunta

Identificar qué se intenta interpretar:

- adquisición;
- conversión;
- retención;
- inventario;
- margen;
- operaciones;
- revenue;
- otra dimensión.

La profundidad contextual depende de la pregunta.

### Paso 2 — Definir scope

Determinar si el fenómeno es:

- global;
- market-specific;
- channel-specific;
- product-specific;
- device-specific;
- cohort-specific;
- time-specific.

No continuar únicamente con agregados si el scope puede estar oculto.

### Paso 3 — Seleccionar baseline

Priorizar conceptualmente:

1. histórico propio comparable;
2. cohortes o segmentos internos comparables;
3. objetivos y restricciones;
4. patrones de categoría/mercado;
5. benchmarks externos generales.

La comparabilidad importa más que la proximidad temporal.

### Paso 4 — Validar comparabilidad temporal

Comprobar:

- weekday mix;
- trading days;
- seasonality;
- holidays;
- paydays;
- promotions;
- launches;
- stock availability;
- market expansion;
- attribution logic;
- measurement state.

Si el periodo no es comparable, degradar la interpretación.

### Paso 5 — Cargar contexto de negocio

Recuperar, cuando sea relevante:

- business model;
- purchase cycle;
- ticket;
- product economics;
- maturity;
- strategy;
- objectives;
- constraints.

### Paso 6 — Analizar mix

Comparar:

- product mix;
- customer mix;
- channel mix;
- market mix;
- device mix.

Separar cambio dentro de segmentos de cambio en composición.

### Paso 7 — Evaluar economía y trade-offs

Comprobar si una métrica local empeora dentro de una estrategia que mejora el resultado global.

Ejemplos:

- CVR ↓ pero contribution profit ↑;
- ROAS blended ↓ pero nuevos clientes rentables ↑;
- inventory ↑ para cubrir lead times largos.

### Paso 8 — Revisar promociones y eventos comerciales

Identificar:

- sale;
- flash sale;
- Black Friday;
- launch;
- bundle;
- price change;
- free shipping;
- influencer activation.

Distinguir promotional lift de structural improvement.

### Paso 9 — Revisar cambios internos

Buscar change events:

- site;
- checkout;
- tracking;
- theme;
- pricing;
- shipping policy;
- agency;
- campaign structure;
- creative rotation;
- warehouse;
- email flows;
- market launch.

Registrar lag plausible.

### Paso 10 — Revisar contexto externo

Cuando sea material, considerar:

- competitor actions;
- platform changes;
- macro;
- weather;
- regulation;
- payment incidents;
- search algorithm changes.

No convertirlos en explicación automática.

### Paso 11 — Revisar disponibilidad y capacidad

Comprobar:

- stock;
- supplier constraints;
- warehouse backlog;
- support saturation;
- production limits;
- creative capacity.

Distinguir demanda débil de oferta o capacidad limitada.

### Paso 12 — Revisar medición

Comprobar discontinuidades:

- attribution window;
- consent;
- pixel;
- event definitions;
- reporting logic;
- FX logic.

Si existe `MEASUREMENT_DISCONTINUITY`, limitar comparaciones alrededor del cambio.

### Paso 13 — Revisar declared vs observed

Conservar por separado:

- contexto declarado por usuario/equipo;
- contexto observado en datos/sistemas.

Si contradicen, elevar la contradicción como evidencia contextual.

### Paso 14 — Revisar experiencia histórica

Consultar diagnósticos, experimentos y decisiones previas relevantes.

Ejemplo: una caída de CVR tras retirar descuentos puede haber sido esperada para recuperar margen.

No usar historial como verdad automática; usarlo como contexto.

### Paso 15 — Evaluar context completeness

Determinar qué variables relevantes faltan.

No rellenar ausencias con supuestos.

### Paso 16 — Emitir salida D2

La salida contextual debe resumir:

- baseline;
- scope;
- factores explicativos plausibles;
- mix shifts;
- change events;
- confounders;
- regime changes;
- restricciones;
- contexto desconocido;
- comparabilidad;
- uncertainty.

D2 debe acotar hipótesis, no confirmar causalidad.

---

## 3. Ramas operativas

### A. CVR agregado cae

1. segmentar por canal, device, market o customer type;
2. comprobar si el rendimiento interno cambia;
3. comprobar si cambia el peso de segmentos;
4. clasificar como `PERFORMANCE_CHANGE` o `MIX_SHIFT`.

### B. Revenue cae WoW

1. comprobar promoción previa;
2. comprobar lanzamientos;
3. comprobar stock;
4. comprobar trading days;
5. seleccionar baseline equivalente.

### C. CAC sube

1. revisar prospecting vs remarketing;
2. revisar new customer share;
3. revisar contribution;
4. revisar objetivo de crecimiento;
5. evitar asumir deterioro puro si la expansión incremental es rentable.

### D. AOV baja

1. revisar product mix;
2. revisar nuevos SKUs o líneas;
3. revisar units/order;
4. revisar margin;
5. diferenciar monetización deteriorada de mix shift.

### E. Retención cae

1. comparar cohort age;
2. revisar acquisition source;
3. revisar first-order discount;
4. revisar first product;
5. considerar causas aguas arriba.

### F. Métrica local empeora y resultado económico mejora

1. revisar objetivo;
2. revisar trade-off;
3. priorizar business optimum frente a local optimum;
4. registrar que la variación puede ser deliberada.

---

## 4. Límite funcional

D2 no debe cerrar causalidad.

Su resultado sirve para:

- eliminar comparaciones inválidas;
- seleccionar baselines;
- identificar confounders;
- localizar cambios;
- acotar hipótesis;
- preparar bloques posteriores de causalidad.
