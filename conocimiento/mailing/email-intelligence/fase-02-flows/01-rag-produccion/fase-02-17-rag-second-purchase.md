# Fase 2.17 — Second Purchase

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Second Purchase busca transformar una primera compra satisfactoria en repetición.

La oportunidad no debería abrirse automáticamente al instante de pagar. Debe considerar entrega, uso, categoría, complementariedad y ciclo esperado.

Puede apoyarse en cross-sell, replenishment, nueva necesidad o ampliación de categoría. El objetivo es relevancia, no simplemente otro pedido.

Antipatrones: vender antes de entrega, descuento automático, recomendar cualquier producto, ignorar incidencias y seguir después de la segunda compra.

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
