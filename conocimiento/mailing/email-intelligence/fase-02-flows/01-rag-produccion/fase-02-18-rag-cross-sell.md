# Fase 2.18 — Cross-Sell

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Cross-Sell recomienda productos que complementan una necesidad, compra o producto conocido.

La relación debe ser explicable: accesorio, reposición complementaria, producto de uso conjunto o extensión natural.

Debe considerar compatibilidad, productos ya poseídos, stock, margen y lifecycle.

Cross-sell no es simplemente “otro producto”.

Antipatrones: recomendaciones aleatorias, incompatibles, catálogo excesivo, confundir cross-sell con upsell o recomendar algo ya comprado cuando no es recurrente.

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
