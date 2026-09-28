# Fase 3.1 — Arquitectura de una campaña

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una campaña es una comunicación iniciada por decisión de la marca hacia una audiencia definida. Puede responder a una oportunidad comercial, editorial, promocional, de producto o estacional.

El diseño correcto comienza por el objetivo y no por el asunto, el descuento o la creatividad. Una campaña madura debe poder explicar: qué pretende cambiar, a quién se dirige, por qué ahora, qué producto/oferta/contenido utiliza, quién queda fuera, qué presión genera y cómo se medirá.

La IA debe distinguir campaña de flow. Una campaña nace de una decisión de planificación; un flow responde automáticamente a un evento, condición o cambio de estado.

Antes de recomendar una campaña, el agente debe revisar relevancia, lifecycle, intención, engagement, afinidad, historial comercial, presión, conflictos, stock, oferta y contexto operativo.

Una campaña no debe existir por el simple hecho de que “toca enviar”. Debe tener una hipótesis explícita sobre por qué merece consumir atención.

Antipatrones: empezar por diseño o copy; enviar a toda la lista por defecto; no definir exclusiones; usar el calendario como única razón; medir solo opens; confundir revenue atribuido con causalidad.

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
