# Fase 2.19 — Upsell

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Upsell presenta una alternativa o ampliación de mayor valor cuando aporta un beneficio adicional razonable.

Debe existir una relación clara de upgrade. Precio mayor no basta.

Antes de compra puede ayudar a elegir una versión superior. Después de compra debe evitar hacer sentir al cliente que eligió mal, salvo que exista una ampliación natural.

Antipatrones: más caro = mejor, presión para aumentar ticket, upgrade irrelevante, invalidar la compra anterior y ofrecer productos sin relación.

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
