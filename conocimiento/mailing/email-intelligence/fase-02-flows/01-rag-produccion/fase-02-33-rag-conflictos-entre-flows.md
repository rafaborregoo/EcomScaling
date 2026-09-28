# Fase 2.33 — Conflictos entre flows

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Los conflictos aparecen cuando una persona cumple simultáneamente criterios de varios flows.

El sistema no debe tratar cada automatización como un silo. Debe arbitrar según intención, prioridad, experiencia, operación y presión.

Ejemplos clásicos:

```text
Browse < Product < Cart < Checkout
```

Cuando aparece un estado más avanzado, el flow inferior suele perder prioridad.

Post-Purchase puede invalidar abandonments anteriores. Una incidencia de soporte puede requerir pausar marketing. Los mensajes transaccionales necesarios no deben competir como si fueran marketing opcional.

También pueden existir conflictos entre oferta, producto o timing.

Antipatrones: enviar todos los flows, prioridad implícita, cart y checkout simultáneos, abandono después de compra, varias ofertas contradictorias y no considerar presión global.

---

## Marco de decisión

La IA debe razonar:

```text
opportunity
+
customer lifecycle
+
current state
+
recency
+
operational context
+
other active flows
+
contact pressure
→ next best action
```

---

## Preguntas clave

```text
¿Qué evidencia justifica este flow?
¿Sigue vigente?
¿Qué ocurrió después?
¿Existe una condición de salida?
¿Existe otro flow superior?
¿El cliente está saturado?
¿Tenemos los datos necesarios?
¿Debemos enviar, esperar, cambiar de rama o terminar?
```

---

## Principio maestro

La automatización solo debe continuar mientras su objetivo siga siendo relevante y compatible con la experiencia global.
