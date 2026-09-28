# Fase 3.6 — Lanzamientos

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una campaña de lanzamiento introduce un producto, colección o propuesta nueva. Puede organizarse en etapas como tease, announce, educate, proof, early access y cierre, pero no todos los lanzamientos necesitan todas.

La audiencia puede variar entre prospects, clientes, VIP, waitlist y personas con afinidad relevante.

La IA debe explicar por qué la novedad importa; “nuevo” no es una propuesta de valor por sí sola.

Antipatrones: lanzar a toda la base, teasers sin contenido, falsa escasez, claims no demostrados, no adaptar timing a disponibilidad real.

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
