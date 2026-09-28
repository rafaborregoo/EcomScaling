# Fase 3.13 — Black Friday / Cyber Monday

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

BFCM concentra alta competencia, presión y sensibilidad promocional. La estrategia debe planificar oferta, margen, audiencias, frecuencia, early access y coordinación con flows.

No debe reducirse a “enviar más”. Es especialmente importante controlar canibalización, saturación, coherencia de ofertas y presión por segmento.

La IA debe diferenciar fases y mantener consistencia comercial.

Antipatrones: descuentos cambiantes sin lógica, falsa urgencia, regalar margen a compradores que ya convertirían, ignorar flows o saturar a toda la lista.

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
