# Fase 3.2 — Selección de objetivo

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Toda campaña necesita un objetivo primario claro. El objetivo describe el cambio que se quiere provocar, no la táctica utilizada.

Ejemplos: conversión, activación, product discovery, lanzamiento, educación, retención, reactivación, awareness, generación de demanda o social proof.

“Enviar un 20% de descuento” no es un objetivo: es una táctica. “Aumentar conversión de una audiencia concreta sin deteriorar margen” sí expresa un resultado estratégico.

La IA debe distinguir objetivo primario, objetivos secundarios, métrica principal y métricas guardrail. Una campaña puede mejorar revenue y empeorar unsubscribe, margen o complaints; por eso no debe optimizar una sola métrica de forma ciega.

Antipatrones: demasiados objetivos equivalentes, cambiar el objetivo después de observar resultados, usar “ventas” como objetivo universal, confundir KPI con objetivo.

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
