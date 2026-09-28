# Fase 2.12 — Product Abandonment

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Product Abandonment recupera consideración sobre un producto concreto cuando existe evidencia suficiente de interés sin progresión posterior.

La señal puede reforzarse mediante repetición, wishlist, review views, selección de variante o visitas en varias sesiones.

Debe comprobarse stock, precio, variante, compra posterior y recencia. Puede ser más útil resolver objeciones o mostrar prueba social que ofrecer descuento.

Antipatrones: una vista = abandono, descuento inmediato, personalización invasiva, producto agotado, ignorar compra posterior.

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
