# Fase 03 · D03 — Flujo operativo de detección de madurez

## Propósito

D3 determina qué capacidades debería haber construido razonablemente el ecommerce y compara esa expectativa con las capacidades observadas.

---

## 1. Entrada

D3 consume:

- Stage Gates de Fase 2;
- contexto de D2;
- fiabilidad de D1;
- evidencia observable;
- respuestas estructuradas del tenant cuando sean necesarias.

---

## 2. Secuencia

### Paso 1 — Identificar business stage

Usar Fase 2 como referencia.

D3 no redefine stages.

### Paso 2 — Medir complejidad actual

Considerar:

- revenue scale;
- orders;
- SKUs;
- markets;
- channels;
- team;
- fulfillment;
- customer base;
- growth;
- inventory exposure;
- cash exposure.

### Paso 3 — Construir capability profile

Evaluar por separado:

- Market;
- Product;
- Offer;
- Unit Economics;
- Acquisition;
- Creative;
- Conversion;
- Retention;
- Inventory;
- Operations;
- Finance;
- Data;
- Technology;
- Team;
- Strategy.

### Paso 4 — Evaluar dimensiones de cada capability

Comprobar:

- existencia;
- consistencia;
- repetibilidad;
- medición;
- ownership;
- automatización;
- predictibilidad;
- optimización;
- resiliencia;
- aprendizaje.

### Paso 5 — Determinar required maturity

Estimar qué nivel mínimo/esperado necesita cada capability dada la complejidad actual.

### Paso 6 — Comparar available vs required

Clasificar:

- appropriate;
- behind;
- critically behind;
- advanced;
- overengineered.

### Paso 7 — Detectar asimetrías

Buscar combinaciones peligrosas entre capabilities.

### Paso 8 — Evaluar dependencies

Comprobar si una capability avanzada depende de otra rezagada.

### Paso 9 — Detectar bottlenecks

Identificar `MATURITY_BOTTLENECK`.

No convertirlo automáticamente en prioridad operativa.

### Paso 10 — Separar state y stage

Un fallo actual no debe reclasificar automáticamente la madurez estructural.

### Paso 11 — Evaluar regresión

Si una capacidad empeora durante un periodo prolongado, evaluar `MATURITY_REGRESSION`.

### Paso 12 — Evaluar latent risk

Una capability insuficiente puede generar riesgo aunque las métricas actuales estén sanas.

### Paso 13 — Evaluar growth-system fit

Detectar:

- fragile growth;
- sustainable growth;
- growth-system gap;
- premature scaling;
- structural debt.

### Paso 14 — Evaluar overengineering

Detectar sofisticación que excede la necesidad real.

### Paso 15 — Contrastar evidencia

Priorizar:

1. observed behavior;
2. system data;
3. documented process;
4. user claim.

### Paso 16 — Actualizar confidence

Nueva evidencia puede estrechar el rango o elevar confidence sin significar cambio real de maturity.

### Paso 17 — Emitir maturity findings

La salida debe indicar:

- capability;
- observed maturity;
- required maturity;
- gap;
- confidence;
- evidence;
- dependency;
- structural risk;
- bottleneck;
- interpretación.

---

## 3. Ramas operativas

### A. High acquisition + low finance

Emitir riesgo de unprofitable scaling.

### B. High acquisition + low inventory

Emitir riesgo de stockout-driven growth failure.

### C. High creative + low conversion

Emitir riesgo de escalar tráfico hacia funnel ineficiente.

### D. High growth + low operations

Emitir riesgo de deterioro de customer experience.

### E. High revenue + low data

Emitir riesgo de management blindness.

### F. Current issue crítico en negocio maduro

Mantener stage si la capacidad estructural sigue existiendo y tratar el problema como state.

### G. Capacidad simple pero suficiente

No penalizar si encaja con la necesidad y estrategia.

### H. Infraestructura compleja sin necesidad

Detectar overengineering o complexity theater.
