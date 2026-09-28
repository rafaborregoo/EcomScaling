# Fase 3.7 — Restock

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Restock comunica reposición de disponibilidad. A diferencia de un flow de Back in Stock individual, una campaña de restock puede dirigirse a una audiencia más amplia cuando el producto tiene demanda general.

Debe distinguirse el interés explícito de una waitlist del interés general. Si el stock es limitado, puede existir prioridad según política de la tienda.

La campaña pierde sentido si el producto vuelve a agotarse.

Antipatrones: anunciar sin stock suficiente, ignorar variantes, audiencia demasiado amplia, no considerar regiones o seguir enviando después de agotarse.

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
