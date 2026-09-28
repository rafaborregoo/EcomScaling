# Fase 2.27 — Price Drop

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Price Drop comunica una reducción real de precio a personas con interés previo relevante.

Debe existir un precio anterior válido, un precio actual inferior y suficiente relación entre la persona y el producto. El sistema no debe utilizar precios artificialmente elevados como referencia.

La oportunidad pierde relevancia si el cliente ya compró, el precio vuelve a subir o el interés caducó.

Antipatrones: falsa bajada, avisar a toda la lista, ignorar compra posterior, comunicar una promoción expirada o tratar cualquier descuento como urgencia.

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
