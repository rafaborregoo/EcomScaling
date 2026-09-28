# Fase 8.3 — Cooldowns

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Cooldown es una ventana mínima de descanso después de determinados eventos o comunicaciones.

Puede existir después de:
- compra;
- campaña intensa;
- incidencia;
- flow;
- promoción.

Su objetivo es evitar presión redundante y permitir que la persona actúe sin interferencia inmediata.

El cooldown debe responder a contexto, no convertirse en una pausa universal.

Antipatrones: cooldown fijo para todo, bloquear mensajes operativos importantes o ignorar nueva oportunidad de mayor prioridad.

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
