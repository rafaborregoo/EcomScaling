# Fase 8.8 — Exclusiones

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las exclusiones eliminan de una acción a personas que no deben recibirla aunque pertenezcan a la audiencia base.

Pueden depender de:
- compra reciente;
- producto;
- lifecycle;
- soporte;
- geografía;
- presión;
- estado operativo.

La exclusión es contextual y puede ser temporal.

Antipatrones: exclusiones duplicadas y contradictorias, no documentar motivo o aplicar exclusiones antiguas a nuevas oportunidades.

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
