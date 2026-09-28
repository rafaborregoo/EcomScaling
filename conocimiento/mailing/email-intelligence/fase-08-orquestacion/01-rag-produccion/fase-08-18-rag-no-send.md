# Fase 8.18 — NO_SEND

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

NO_SEND significa que una comunicación concreta no debería ejecutarse.

Puede ser correcto por:
- baja relevancia;
- ausencia de objetivo;
- presión;
- conflicto;
- timing;
- falta de stock;
- margen;
- datos insuficientes;
- compra posterior;
- experiencia sensible.

NO_SEND no es un fracaso. Es una decisión de optimización de atención, margen y relación.

La IA debe tener capacidad real de concluir NO_SEND, incluso cuando exista una campaña preparada.

Antipatrones: forzar siempre una salida comercial, convertir NO_SEND en DELAY infinito o ignorar que el silencio puede ser la mejor acción.

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
