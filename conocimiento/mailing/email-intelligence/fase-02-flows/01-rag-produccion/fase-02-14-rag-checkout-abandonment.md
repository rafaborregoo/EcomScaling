# Fase 2.14 — Checkout Abandonment

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Checkout Abandonment recupera una intención muy avanzada cuando el checkout deja de progresar.

Debe distinguir abandono silencioso de payment failure, error técnico o checkout pendiente. El copy no debe ocultar costes ni inventar urgencia.

La estrategia suele priorizar continuidad, claridad, confianza y resolución de fricción. Un descuento solo tiene sentido si otra capa lo autoriza.

Antipatrones: checkout_started = abandono, seguir tras compra, presión durante fallos técnicos, prometer precios o promociones caducadas.

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
