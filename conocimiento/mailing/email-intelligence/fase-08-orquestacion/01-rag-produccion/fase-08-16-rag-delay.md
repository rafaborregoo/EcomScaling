# Fase 8.16 — DELAY

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

DELAY significa que la oportunidad puede seguir siendo válida, pero ahora no es el mejor momento.

Puede deberse a:
- presión alta;
- cooldown;
- conflicto temporal;
- otra comunicación superior;
- espera por evento;
- ventana comercial futura.

DELAY no es una cancelación. Requiere una condición o momento de reevaluación.

Antipatrones: delays sin razón, retrasar indefinidamente, no reevaluar al despertar o usar DELAY para evitar decidir NO_SEND.

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
