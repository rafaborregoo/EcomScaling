# Fase 2.25 — VIP Flow

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

VIP Flow ofrece una experiencia diferenciada a personas que cumplen la definición VIP de la tienda.

Puede incluir reconocimiento, acceso anticipado, servicios, exclusividad o beneficios reales. VIP no significa automáticamente más descuento ni más frecuencia.

La IA debe usar exclusivamente beneficios definidos por la marca.

Antipatrones: inventar privilegios, discount-first, aumentar presión por ser VIP, no actualizar estatus o utilizar lenguaje exclusivo cuando la persona ya dejó de cumplir criterios.

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
