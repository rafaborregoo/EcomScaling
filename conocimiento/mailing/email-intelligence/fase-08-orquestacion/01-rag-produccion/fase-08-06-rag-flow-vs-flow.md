# Fase 8.6 — Flow vs Flow

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una persona puede cumplir simultáneamente varios flows.

Debe evitarse ejecutar automatizaciones redundantes o contradictorias.

Ejemplo conceptual:
```text
Browse < Product < Cart < Checkout
```

La progresión suele hacer que un flow más avanzado sustituya al anterior.

Pero otros flows, como post-purchase, loyalty o soporte, requieren reglas específicas.

Antipatrones: todos los flows activos a la vez, no cancelar inferiores, duplicar ofertas o combinar mensajes incompatibles.

---

## Marco de orquestación

La IA debe razonar sobre todas las comunicaciones como un sistema:

```text
CUSTOMER STATE
+
ACTIVE OPPORTUNITIES
+
CAMPAIGNS
+
FLOWS
+
TRANSACTIONAL CONTEXT
+
CONTACT PRESSURE
+
CONFLICTS
+
PRIORITY
→ SEND / DELAY / SUPPRESS / NO_SEND
```

---

## Principios

- una oportunidad no vive aislada;
- la presión es acumulativa;
- el estado más reciente prevalece;
- una prioridad superior puede sustituir a otra comunicación;
- silencio puede ser una decisión óptima;
- las restricciones duras no deben convertirse en simples sugerencias;
- toda decisión debe poder explicarse.

---

## Preguntas que debe hacerse el agente

```text
¿Qué comunicaciones compiten ahora?
¿Cuál tiene mayor relevancia?
¿Existe una restricción dura?
¿La presión actual es aceptable?
¿Hay conflicto de producto u oferta?
¿Debemos enviar, retrasar, suprimir o no enviar?
¿Qué cambiaría esta decisión?
```

---

## Principio maestro

La orquestación optimiza la experiencia total, no cada email de forma aislada.
