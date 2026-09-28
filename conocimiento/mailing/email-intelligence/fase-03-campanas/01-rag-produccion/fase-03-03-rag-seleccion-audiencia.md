# Fase 3.3 — Selección de audiencia

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La audiencia debe derivarse del objetivo y de la relevancia. Puede utilizar lifecycle, intención, engagement, afinidad, compras, valor, geografía, comportamiento o preferencias.

Una audiencia correcta se define por inclusiones y exclusiones. El tamaño no determina su calidad.

La IA debe evitar tanto “toda la lista” como microsegmentaciones que no cambian ninguna decisión. Un segmento merece existir si modifica mensaje, producto, oferta, timing, frecuencia o interpretación de resultados.

También debe considerar suficiente tamaño para medir y aprender.

Antipatrones: audiencias basadas en datos antiguos, no excluir compradores incompatibles, duplicar identidades entre variantes, ignorar presión o segmentar sin una consecuencia estratégica.

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
