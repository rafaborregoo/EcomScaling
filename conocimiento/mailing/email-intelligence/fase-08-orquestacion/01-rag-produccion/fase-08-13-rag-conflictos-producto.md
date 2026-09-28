# Fase 8.13 — Conflictos de producto

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un conflicto de producto aparece cuando varias comunicaciones presentan productos incompatibles, redundantes o estratégicamente contradictorios.

Puede ocurrir por:
- recomendaciones diferentes;
- compra posterior;
- producto agotado;
- sustitutos enfrentados;
- categoría incompatible.

La IA debe priorizar el producto más relevante y actual.

Antipatrones: recomendar producto comprado hace minutos, ofrecer dos sustitutos en mensajes consecutivos sin contexto o promocionar un producto agotado.

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
