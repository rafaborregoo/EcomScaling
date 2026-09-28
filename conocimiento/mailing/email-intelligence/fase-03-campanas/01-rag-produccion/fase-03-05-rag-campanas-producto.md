# Fase 3.5 — Campañas de producto

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una campaña de producto centra la comunicación en uno o varios productos por una razón concreta: relevancia, novedad, demanda, disponibilidad, afinidad o estrategia de merchandising.

El producto no debe seleccionarse simplemente porque existe stock o porque “hay que venderlo”. Debe existir una historia comercial y una audiencia plausible.

La comunicación puede enfatizar beneficio, caso de uso, diferenciación, demostración, comparación, prueba social o novedad.

Antipatrones: catálogo genérico, demasiados SKUs, producto sin stock, producto irrelevante para la audiencia, copy basado únicamente en features.

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
