# Fase 3.18 — Calendario comercial

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El calendario comercial organiza oportunidades planificadas durante semanas, meses y temporadas.

Debe combinar fechas externas con hitos propios: lanzamientos, restocks, aniversarios, colecciones, objetivos y necesidades de negocio.

No debe convertirse en una obligación de llenar todos los huecos. Debe dejar espacio para lifecycle, flows y oportunidades no planificadas.

La IA debe detectar colisiones, semanas de alta presión y dependencias de preparación.

Antipatrones: calendario saturado, copiar calendarios genéricos, ignorar mercados, no reservar espacio para automatizaciones o improvisar promociones continuamente.

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
