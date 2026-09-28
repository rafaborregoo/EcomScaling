# Fase 3.20 — Send vs No-Send

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Send vs No-Send es la decisión final sobre si una campaña merece consumir atención.

`SEND` requiere oportunidad válida, audiencia adecuada, contexto vigente, presión aceptable, producto/oferta disponible y ausencia de un conflicto superior.

`NO_SEND` puede ser la mejor decisión cuando falta objetivo, relevancia, margen, stock, audiencia, timing o compatibilidad con la experiencia del cliente.

También pueden existir decisiones intermedias: `DELAY`, `REDUCE_AUDIENCE` o `SUPPRESS_SEGMENT`.

La IA debe poder recomendar explícitamente no lanzar una campaña.

Antipatrones: siempre encontrar una razón para enviar, confundir hueco de calendario con oportunidad, priorizar revenue bruto ignorando margen/list health, no registrar por qué se canceló.

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
