# Fase 2.21 — Review Request

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Review Request solicita una valoración cuando el cliente ya ha tenido oportunidad razonable de recibir y experimentar el producto.

El trigger correcto no debería ser simplemente `ORDER_PLACED`. Debe considerar entrega, ventana de uso, producto e incidencias.

La solicitud debe facilitar una opinión auténtica, no condicionar la valoración positiva. Si existe devolución, queja o problema abierto, puede ser mejor posponer o cancelar.

Antipatrones: pedir review al pagar, solicitar durante una incidencia, repetir excesivamente, premiar solo reviews positivas o asumir que entrega equivale a uso.

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
