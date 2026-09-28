# Fase 8.2 — Frequency Caps

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Frequency Caps limitan cuántas comunicaciones de marketing puede recibir una persona dentro de una ventana.

Son guardrails, no objetivos. Llegar al límite no significa que la frecuencia óptima sea exactamente ese máximo.

Los caps pueden variar por:
- segmento;
- engagement;
- temporada;
- canal;
- tipo de mensaje.

La IA debe entender que el cap protege la experiencia, pero una campaña irrelevante debería poder ser NO_SEND incluso por debajo del límite.

Antipatrones: mismo cap para todos, tratar el máximo como objetivo, ignorar flows o aplicar caps a comunicaciones que no pertenecen a marketing si la política no lo indica.

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
