# Fase 2.29 — Win-Back

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Win-Back busca recuperar una relación comercial que ya ha alcanzado un nivel significativo de inactividad.

Debe partir de un `LAPSED` calculado en contexto, no de una ventana universal. El historial permite recuperar con productos, categorías o razones relevantes.

Un win-back debe tener un número limitado de intentos. Si no existe respuesta, seguir insistiendo puede empeorar presión y entregabilidad.

El descuento es una opción, no una obligación.

Antipatrones: 90 días para todo, campañas interminables, incentivos crecientes sin límite, ignorar mala experiencia y confundir win-back con re-engagement.

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
