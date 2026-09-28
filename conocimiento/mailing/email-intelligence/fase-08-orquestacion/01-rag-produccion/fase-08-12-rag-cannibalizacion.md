# Fase 8.12 — Cannibalización

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Cannibalización ocurre cuando una comunicación reduce el valor de otra oportunidad o regala incentivo a una conversión que probablemente ocurriría igualmente.

Ejemplos:
- campaña de descuento mientras alguien está en checkout;
- promoción general que supera una oferta de flow;
- dos campañas compitiendo por el mismo producto.

La IA debe evaluar incrementalidad probable, conflicto de oferta y timing.

Antipatrones: medir solo revenue atribuido, asumir que más mensajes suman siempre, descuentos simultáneos o no considerar compra orgánica probable.

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
