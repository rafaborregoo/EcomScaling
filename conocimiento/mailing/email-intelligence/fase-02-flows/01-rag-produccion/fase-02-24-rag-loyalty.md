# Fase 2.24 — Loyalty

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Loyalty Flow desarrolla una relación dentro de un programa de fidelización real.

Puede comunicar alta, progreso, hitos, tiers, recompensas o beneficios. La IA no debe inventar puntos, niveles ni ventajas.

El programa de loyalty es una fuente de verdad externa al flow. El email interpreta sus estados y los comunica.

Antipatrones: inventar beneficios, saldos incorrectos, demasiadas notificaciones, presentar loyalty únicamente como descuentos o calcular puntos desde el LLM.

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
