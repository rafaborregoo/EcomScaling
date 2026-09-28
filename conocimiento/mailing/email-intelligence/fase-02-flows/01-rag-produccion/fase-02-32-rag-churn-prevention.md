# Fase 2.32 — Churn Prevention

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Churn Prevention interviene antes de que un cliente recurrente pierda su relación comercial.

Debe apoyarse en señales de `AT_RISK`: retraso respecto a ciclo esperado, caída de frecuencia, engagement decreciente, incidencias u otros indicadores fiables.

El objetivo es resolver la causa o recuperar relevancia antes de llegar a lapse. No debe confundirse churn comercial con unsubscribe de email.

Antipatrones: descuento automático, riesgo sin evidencia, ignorar soporte, misma ventana para todos y actuar cuando el cliente ya está lapsed.

---

## Marco de decisión

La IA debe razonar:

```text
opportunity
+
customer lifecycle
+
current state
+
recency
+
operational context
+
other active flows
+
contact pressure
→ next best action
```

---

## Preguntas clave

```text
¿Qué evidencia justifica este flow?
¿Sigue vigente?
¿Qué ocurrió después?
¿Existe una condición de salida?
¿Existe otro flow superior?
¿El cliente está saturado?
¿Tenemos los datos necesarios?
¿Debemos enviar, esperar, cambiar de rama o terminar?
```

---

## Principio maestro

La automatización solo debe continuar mientras su objetivo siga siendo relevante y compatible con la experiencia global.
