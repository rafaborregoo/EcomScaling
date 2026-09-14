# Fase 03 · D02 — Requisitos contractuales de contextualización

## Estado del artefacto

El documento fuente define vocabulario, dimensiones y requisitos conceptuales de contexto, pero no implementa un schema técnico definitivo.

Este archivo formaliza únicamente qué información debe poder intercambiar el sistema para contextualizar una señal.

---

## 1. Requisitos generales de contexto

Una evaluación contextual debe poder representar, cuando aplique:

- métrica o señal observada;
- periodo;
- segmento o scope;
- baseline utilizado;
- modelo de negocio;
- etapa de madurez;
- objetivos;
- restricciones;
- mix de productos;
- mix de clientes;
- mix de canales;
- mercados;
- estrategia;
- estacionalidad;
- cambios recientes;
- disponibilidad;
- capacidad;
- estado de medición;
- calidad de datos heredada de D1.

---

## 2. Requisitos de comparación temporal

Debe poder comunicarse:

- ventana actual;
- baseline;
- weekday mix;
- número de días operativos;
- estacionalidad;
- promoción;
- lanzamientos;
- stock;
- expansión de mercado;
- attribution logic;
- comparabilidad resultante.

El contrato técnico definitivo no está definido en el documento fuente.

---

## 3. Requisitos de mix y segmentación

La contextualización debe poder distinguir entre cambio de rendimiento y cambio de composición.

Debe poder representar:

- dimensión de segmentación;
- segmentos;
- peso relativo;
- rendimiento dentro del segmento;
- cambio agregado;
- clasificación conceptual como `PERFORMANCE_CHANGE` o `MIX_SHIFT`.

Scopes definidos conceptualmente:

- `GLOBAL`
- `MARKET_SPECIFIC`
- `CHANNEL_SPECIFIC`
- `PRODUCT_SPECIFIC`
- `DEVICE_SPECIFIC`
- `COHORT_SPECIFIC`
- `TIME_SPECIFIC`

---

## 4. Requisitos de eventos de cambio

Debe poder comunicarse un change event con información suficiente para relacionarlo temporalmente con una señal:

- tipo de cambio;
- fecha o periodo;
- sistema o área afectada;
- alcance;
- relación temporal con la observación;
- lag plausible cuando corresponda.

La proximidad temporal no debe serializarse como causalidad confirmada.

---

## 5. Requisitos de estrategia y objetivos

Para interpretar métricas el sistema debe poder conocer:

- objetivo actual;
- estrategia relevante;
- trade-offs aceptados;
- posicionamiento;
- prioridades económicas;
- restricciones.

El documento no define catálogo cerrado de estrategias ni objetivos.

---

## 6. Requisitos de dependencias y concentración

Debe poder expresarse, cuando sea material:

- canal dominante;
- SKU dominante;
- mercado dominante;
- supplier concentration;
- customer concentration;
- creative concentration;
- peso relativo;
- dependencia resultante.

---

## 7. Requisitos de restricciones

El contexto debe poder comunicar restricciones como:

- cash;
- inventory;
- team capacity;
- supplier;
- platform policy;
- regulatory;
- warehouse;
- technology.

No se define un enum técnico final.

---

## 8. Requisitos de confounders

Debe poder registrarse:

- variable potencialmente confusora;
- momento;
- scope;
- posible relación con la señal;
- grado de conocimiento;
- coexistencia con otros cambios.

El documento no define scoring causal.

---

## 9. Requisitos de regime change

Debe poder indicarse la existencia de `REGIME_CHANGE` y la fecha o periodo desde el que la comparabilidad histórica puede quedar limitada.

Ejemplos conceptuales incluyen:

- expansión internacional;
- subscription launch;
- marketplace entry;
- price repositioning;
- warehouse model change;
- product category expansion.

---

## 10. Requisitos de benchmark y baseline

Debe poder identificarse:

- baseline interno;
- cohorte o segmento comparable;
- objetivo del negocio;
- benchmark externo;
- grado de comparabilidad;
- limitaciones.

Los benchmarks externos deben distinguirse de la evidencia interna.

---

## 11. Requisitos de medición

Debe poder comunicarse:

- cambio de attribution window;
- consent rate change;
- pixel implementation change;
- event definition change;
- reporting logic change;
- currency conversion logic change;
- existencia de `MEASUREMENT_DISCONTINUITY`.

---

## 12. Requisitos de declared vs observed context

Debe poder conservarse por separado:

- `DECLARED_CONTEXT`
- `OBSERVED_CONTEXT`

También debe poder expresarse:

- coincidencia;
- contradicción;
- contexto desconocido;
- fuente de cada afirmación.

Una contradicción no debe resolverse silenciosamente.

---

## 13. Requisitos de context completeness

La salida contextual debe poder expresar:

- contexto disponible;
- contexto faltante;
- variables críticas desconocidas;
- profundidad contextual requerida;
- si el contexto es suficiente para continuar.

---

## 14. Requisitos de economía

Cuando el diagnóstico lo requiera, el sistema debe poder conocer o intercambiar:

- gross margin;
- contribution margin;
- COGS;
- shipping cost;
- payment fees;
- returns cost;
- discount burden;
- CAC;
- LTV;
- payback;
- working capital;
- cash position.

No se define en este documento cómo se calculan o almacenan.

---

## 15. Requisitos de experiencia histórica

El documento exige que diagnósticos, experimentos y decisiones anteriores puedan formar parte del contexto futuro.

Debe poder referenciarse:

- diagnóstico anterior;
- experimento;
- decisión tomada;
- cambio esperado;
- contexto vigente entonces;
- resultado posterior cuando esté disponible.

El documento no define todavía schema de experiencia ni mecanismo de aprendizaje.

---

## 16. Requisitos de context snapshot

Para reconstruir un diagnóstico histórico debe poder conservarse un snapshot contextual que incluya, cuando aplique:

- business model;
- markets;
- channels;
- product mix;
- promotion state;
- known changes;
- seasonality;
- objectives;
- constraints;
- measurement state.

Este snapshot debe representar el contexto vigente en ese momento, no sobrescribirse con el estado actual.

---

## 17. Requisitos de salida de D2

D2 debe poder producir una interpretación contextual que indique:

- baseline seleccionado;
- scope;
- principales factores contextuales;
- mix shifts;
- change events;
- confounders;
- restricciones;
- incertidumbres;
- contexto faltante;
- si existe discontinuidad o regime change;
- nivel de comparabilidad.

No debe producir por sí solo causalidad confirmada.

---

## 18. Elementos no definidos por la fuente

No se consideran implementados:

- JSON Schema;
- tablas;
- interfaces TypeScript;
- endpoints;
- ids definitivos;
- versionado;
- persistencia;
- protocolo de transporte;
- algoritmo causal;
- algoritmo de scoring contextual.
