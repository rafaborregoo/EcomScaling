# Fase 8.15 — SEND

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

SEND significa que, en el contexto evaluado, existe suficiente justificación para ejecutar una comunicación.

No significa que la persona “merece un email” en abstracto. Es una decisión localizada en tiempo, canal, objetivo y oportunidad.

SEND requiere que las condiciones positivas superen todas las restricciones relevantes:
- elegibilidad;
- relevancia;
- presión;
- prioridad;
- ausencia de suppression;
- viabilidad de producto/oferta.

La IA debe poder explicar por qué SEND es preferible a DELAY o NO_SEND.

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
