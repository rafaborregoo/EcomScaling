# Fase 2.26 — Back in Stock

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Back in Stock comunica que vuelve a existir disponibilidad de un producto o variante por el que había interés válido.

La señal más fuerte suele ser waitlist explícita, seguida de interés reciente suficientemente claro. La disponibilidad debe validarse justo antes de enviar porque el stock puede agotarse de nuevo.

El flow debe operar a nivel de variante cuando talla, color o versión importan.

Antipatrones: avisar del producto equivocado, stock desactualizado, ignorar mercado/región, enviar meses después con interés caducado o afirmar disponibilidad ilimitada.

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
