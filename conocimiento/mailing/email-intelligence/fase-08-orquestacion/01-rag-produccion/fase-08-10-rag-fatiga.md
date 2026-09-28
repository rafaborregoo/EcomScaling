# Fase 8.10 — Fatiga

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Fatiga es la reducción progresiva de respuesta o tolerancia causada por exposición repetida.

Puede manifestarse mediante:
- caída de clicks;
- menor conversión;
- aumento de unsubscribe;
- menor interacción;
- comportamiento de ignorar comunicaciones.

La fatiga no se diagnostica por una sola métrica ni por un único email.

La IA debe comparar comportamiento contra baseline y presión previa.

Antipatrones: asumir fatiga solo por open rate, esperar a que exista unsubscribe masivo o responder a fatiga enviando promociones más agresivas.

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
