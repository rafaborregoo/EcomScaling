# Fase 8.11 — Saturación

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Saturación representa un nivel de presión en el que añadir otra comunicación tiene alta probabilidad de aportar poco valor o deteriorar experiencia.

Es un estado más inmediato que la fatiga acumulada.

Puede producirse por:
- varias campañas cercanas;
- múltiples flows;
- promoción intensa;
- periodo estacional.

La respuesta correcta puede ser DELAY o NO_SEND.

Antipatrones: ignorar mensajes del mismo día, tratar cada canal por separado o considerar que high intent elimina saturación.

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
