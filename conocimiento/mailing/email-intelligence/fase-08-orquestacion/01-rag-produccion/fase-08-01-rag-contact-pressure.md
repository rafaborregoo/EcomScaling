# Fase 8.1 — Contact Pressure

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Contact Pressure representa la presión total que una persona recibe de la marca a través de comunicaciones de marketing.

No equivale simplemente a frecuencia. Dos emails pueden generar presiones muy distintas según:
- proximidad temporal;
- intensidad promocional;
- repetición;
- relevancia;
- canal;
- lifecycle;
- historial reciente.

La IA debe razonar sobre presión acumulada entre campañas y flows, no analizar cada mensaje de forma aislada.

Antipatrones: contar solo emails, ignorar intensidad, medir campañas y flows por separado o considerar que un cliente engaged tolera presión ilimitada.

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
