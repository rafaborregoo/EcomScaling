# Fase 8.14 — Conflictos de oferta

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un conflicto de oferta ocurre cuando una persona puede recibir incentivos diferentes o contradictorios en un periodo cercano.

Ejemplos:
- 10% en flow y 20% en campaña;
- free shipping y bundle incompatible;
- VIP offer inferior a promoción pública.

La incoherencia puede erosionar confianza y margen.

La IA debe considerar precedencia, elegibilidad y economía.

Antipatrones: mostrar siempre la oferta más agresiva, stacking accidental, precios finales contradictorios o invalidar beneficios VIP.

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
