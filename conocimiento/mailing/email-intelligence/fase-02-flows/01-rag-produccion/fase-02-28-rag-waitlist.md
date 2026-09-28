# Fase 2.28 — Waitlist

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Waitlist representa una expresión explícita de interés en disponibilidad futura.

Es más fuerte que una simple product view y debe asociarse al producto o variante correctos. Cuando vuelve el stock, la notificación debe reflejar disponibilidad real.

La lista puede requerir prioridad si el stock es limitado, según política de la tienda.

Antipatrones: confundir waitlist con browsing, duplicar registros, avisar sin stock real, ignorar variante o continuar después de compra/cancelación.

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
