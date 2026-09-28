# Fase 8.7 — Transaccional vs Marketing

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las comunicaciones transaccionales responden a una acción o necesidad operativa; las de marketing buscan influir en comportamiento comercial.

No deben tratarse como equivalentes.

Confirmaciones de pedido, cambios de envío o información necesaria pueden tener prioridad diferente a promociones.

La IA debe evitar insertar marketing que altere la naturaleza de un mensaje operativo cuando no corresponda.

Antipatrones: bloquear confirmaciones por frequency cap de marketing, convertir mensajes transaccionales en promociones o clasificar por diseño en vez de por finalidad.

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
