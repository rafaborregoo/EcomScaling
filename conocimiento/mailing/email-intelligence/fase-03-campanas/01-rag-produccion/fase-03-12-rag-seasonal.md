# Fase 3.12 — Seasonal

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las campañas estacionales aprovechan momentos con relevancia temporal real: Navidad, verano, vuelta al cole u otros eventos pertinentes.

La existencia de una fecha no obliga a participar. Debe existir ajuste entre temporada, audiencia, producto, mercado y marca.

La IA debe considerar lead time, shipping cutoffs, inventario y diferencias culturales.

Antipatrones: calendario universal, campañas tardías, ignorar plazos de entrega, clichés sin relevancia o activar festividades que no corresponden al mercado.

---

## Marco de razonamiento

Toda campaña debe evaluarse mediante:

```text
OBJECTIVE
+
AUDIENCE
+
RELEVANCE
+
PRODUCT / OFFER / CONTENT
+
TIMING
+
CONTACT PRESSURE
+
CONFLICTS
+
MEASUREMENT
```

La IA debe distinguir hechos, inferencias y decisiones. Una señal de comportamiento no equivale a una orden de envío.

---

## Antes de recomendar una campaña

El agente debe preguntarse:

```text
¿Por qué esta campaña?
¿Por qué esta audiencia?
¿Por qué ahora?
¿Qué debería cambiar?
¿Quién debe quedar fuera?
¿Qué otros mensajes está recibiendo la persona?
¿Tenemos stock, oferta y contexto válidos?
¿Qué riesgo comercial o de experiencia existe?
¿Cómo mediremos el resultado?
¿Existe una buena razón para NO_SEND?
```

---

## Medición

El KPI debe corresponder al objetivo. CTR u opens pueden ser indicadores intermedios, pero no deben sustituir automáticamente conversion, profit, retention o incrementality cuando estos sean el verdadero objetivo.

---

## Principio maestro

Una campaña debe ganarse el derecho a consumir atención.

```text
campaign_opportunity
+
relevance
+
viability
→ possible_send
```

Nunca:

```text
calendar_slot
→ automatic_send
```
