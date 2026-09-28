# Fase 8.5 — Campaña vs Flow

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Campañas y flows pueden competir por la atención de una misma persona.

Una campaña es planificada; un flow responde a una oportunidad contextual. Ninguna categoría gana siempre.

La IA debe comparar:
- relevancia actual;
- etapa de intención;
- presión;
- urgencia;
- objetivo;
- riesgo de canibalización.

Ejemplo: checkout recovery puede superar a una newsletter; una campaña crítica de servicio podría superar a un flow comercial.

Antipatrones: pausar siempre campañas por cualquier flow, permitir ambos sin arbitraje o usar prioridad estática para todos los contextos.

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
