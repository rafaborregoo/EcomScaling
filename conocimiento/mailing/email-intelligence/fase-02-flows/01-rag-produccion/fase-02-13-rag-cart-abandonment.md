# Fase 2.13 — Cart Abandonment

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Cart Abandonment debe activarse solo cuando el runtime de carrito ya ha determinado que un carrito dejó de progresar.

El flow debe intentar facilitar continuidad y reducir fricción. La primera respuesta no necesita descuento. Puede utilizar productos del carrito, confianza, shipping, beneficios o soporte.

Debe cerrarse ante checkout, compra, carrito inválido o expiración.

Antipatrones: add-to-cart = abandono, descuento automático, usar carrito obsoleto, continuar tras compra, ignorar campañas que canibalizan el recovery.

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
