# Fase 3.15 — Early Access

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Early Access ofrece acceso previo real a una audiencia definida antes de la disponibilidad general.

Puede utilizarse para VIP, loyalty, waitlist o cohortes estratégicas. Su valor es la prioridad real; no necesita descuento.

La IA no debe llamar early access a una oferta ya disponible públicamente.

Antipatrones: acceso no exclusivo, audiencia excesivamente amplia, ventanas mal configuradas, promesa de prioridad que el sistema no puede cumplir.

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
