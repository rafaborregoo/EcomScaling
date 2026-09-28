# Fase 2.15 — Post-Purchase

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Post-Purchase protege la experiencia después de la compra. Sus objetivos pueden ser reassurance, claridad operativa, educación, reducción de buyer remorse y preparación de la siguiente relación.

Debe sincronizarse con fulfillment y delivery. No debe hablar como si el producto hubiera llegado cuando sigue en tránsito.

Las promociones posteriores deben respetar experiencia, incidencias y tiempo de uso.

Antipatrones: vender inmediatamente, pedir review al pagar, ignorar retrasos, enviar mensajes incompatibles con logística, mezclar soporte y presión comercial.

---

## Cómo debe razonar el agente

```text
trigger
→ fuerza de la oportunidad
→ estado actual
→ exclusiones
→ timing
→ siguiente mejor acción
→ exit condition
```

Debe priorizar siempre el dato más reciente y el estado más avanzado del cliente.

---

## Preguntas clave

```text
¿Por qué existe esta oportunidad?
¿Sigue vigente?
¿Qué ocurrió después del trigger?
¿Existe compra o progresión posterior?
¿Qué fricción conocemos realmente?
¿El siguiente email añade valor?
¿Debe continuar, cambiar de rama o terminar?
```

---

## Principio maestro

El flow debe responder al contexto real del cliente y desaparecer cuando deja de aportar valor.
