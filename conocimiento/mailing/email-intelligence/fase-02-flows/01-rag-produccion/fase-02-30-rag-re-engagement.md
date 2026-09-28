# Fase 2.30 — Re-engagement

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Re-engagement intenta recuperar interacción con el canal cuando una persona ha perdido engagement.

Su objetivo principal es comprobar y recuperar interés, no conseguir una venta inmediata. Debe medirse con señales significativas como clicks, respuestas, visitas o acciones definidas por el modelo de engagement.

Las aperturas aisladas pueden ser insuficientes.

Si no existe respuesta después de intentos razonables, el siguiente paso puede ser sunset.

Antipatrones: re-engagement disfrazado de venta, basarse solo en opens, demasiados intentos o no reducir frecuencia tras falta de respuesta.

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
