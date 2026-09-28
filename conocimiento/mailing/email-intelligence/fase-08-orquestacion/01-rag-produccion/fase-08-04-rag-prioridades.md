# Fase 8.4 — Prioridades

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Prioridad determina qué comunicación merece atención cuando varias oportunidades compiten.

La prioridad puede considerar:
- etapa de intención;
- urgencia operativa;
- lifecycle;
- valor;
- riesgo;
- objetivo.

Una regla conceptual frecuente es que estados más avanzados de compra superen a señales más tempranas, pero no debe aplicarse ciegamente a contextos de soporte o transaccionales.

Antipatrones: prioridad implícita, “último trigger gana”, campañas siempre por debajo o por encima de flows sin contexto, o resolver conflictos por orden de creación.

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
