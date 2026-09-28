# Fase 8.17 — SUPPRESS

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

SUPPRESS significa bloquear una comunicación o categoría de comunicaciones para una persona dentro de un ámbito definido.

Puede ser temporal o persistente según la razón.

Debe diferenciarse de NO_SEND:
- NO_SEND es una decisión sobre una oportunidad concreta;
- SUPPRESS modifica elegibilidad futura dentro de un ámbito.

La IA debe entender la fuerza de esta decisión y no sugerir reactivación arbitraria.

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
