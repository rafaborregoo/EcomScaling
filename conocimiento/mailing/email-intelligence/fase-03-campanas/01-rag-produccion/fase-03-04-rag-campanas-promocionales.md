# Fase 3.4 — Campañas promocionales

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una campaña promocional utiliza un incentivo para acelerar una acción. Puede emplear descuento, free shipping, bundle, gift, quantity break u otra propuesta.

El incentivo debe existir por una razón económica y estratégica. La IA debe considerar margen, sensibilidad promocional, historial de promociones y riesgo de entrenar al cliente a esperar descuentos.

La promoción no debe ser el modo por defecto del canal. Muchas oportunidades se resuelven mejor con relevancia, prueba social, educación o producto.

Urgencia y escasez deben ser reales.

Antipatrones: descuento constante, aumentar profundidad sin aprendizaje, falsa urgencia, audiencia indiscriminada, canibalizar compras a precio completo.

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
