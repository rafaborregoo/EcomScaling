# Fase 2.20 — Replenishment

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Replenishment anticipa una necesidad probable de reposición.

Debe basarse en el ciclo esperado de recompra, naturaleza consumible del producto, cantidad adquirida e historial individual cuando exista.

No todos los productos son replenishable. Una compra reciente o una suscripción activa puede invalidar el flow.

El timing ideal se sitúa alrededor de la ventana probable de necesidad, no en un número universal de días.

Antipatrones: 30 días para todo, productos duraderos, ignorar cantidad, enviar después de una recompra ya realizada y repetir indefinidamente.

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
