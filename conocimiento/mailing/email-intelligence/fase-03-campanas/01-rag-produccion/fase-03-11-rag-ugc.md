# Fase 3.11 — UGC

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las campañas UGC utilizan contenido generado por usuarios para demostrar producto, uso, contexto y autenticidad.

La IA debe distinguir contenido existente, contenido autorizado y contenido apto para una campaña concreta.

El UGC puede ser especialmente útil en demonstration, problem/solution y lifestyle. El valor proviene de mostrar experiencias reales y relevantes.

Antipatrones: utilizar contenido sin autorización, seleccionar material engañoso, ocultar relaciones incentivadas cuando deban declararse o emplear assets con derechos caducados.

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
