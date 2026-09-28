# Fase 3.8 — Campañas educativas

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una campaña educativa aporta comprensión útil sobre producto, categoría, problema, uso o criterio de elección.

Puede construir confianza y demanda sin una promoción inmediata. La educación debe conectarse con necesidades reales de la audiencia y con el posicionamiento de la marca.

El contenido debe ser verificable. La IA no debe inventar claims, instrucciones ni resultados.

Antipatrones: enseñar sin objetivo, contenido genérico, education-as-sales-disguise, exceso de longitud sin jerarquía, terminar siempre en promoción agresiva.

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
