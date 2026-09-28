# Fase 3.19 — Frequency Planning

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Frequency Planning define cuánto contacto planificado es razonable para una audiencia.

Debe considerar campañas, flows, transactional context, engagement, lifecycle, seasonality y presión acumulada.

No existe una cifra universal de emails por semana. La frecuencia debe adaptarse y medirse.

En periodos intensos puede aumentar temporalmente si existe suficiente relevancia y una política explícita.

Antipatrones: misma frecuencia para todos, medir solo campañas, ignorar flows, subir volumen sin guardrails o no reaccionar ante señales de fatiga.

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
