# Fase 8.9 — Supresiones

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Suppression representa un bloqueo explícito para determinadas comunicaciones.

Puede derivar de:
- unsubscribe;
- bounce;
- complaint;
- sunset;
- política interna;
- restricción de canal.

Debe distinguirse de exclusión temporal: la supresión suele ser una condición más fuerte y persistente.

Antipatrones: ignorar suppression, reactivar automáticamente, confundir marketing suppression con eliminación total del cliente o perder la razón de supresión.

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
