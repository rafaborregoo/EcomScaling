# Fase 2.13 — Cart Abandonment — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Operar `Cart Abandonment` de forma determinista y auditable.

---

## Eventos/estados

- `CART_BECAME_ABANDONED`
- `CART_REACTIVATED`
- `CHECKOUT_STARTED`
- `ORDER_PLACED`
- `CART_INVALID`

---

## Reglas específicas

- Consumir CART_ABANDONED como source of truth.
- Cancelar ante checkout o purchase.
- Revalidar contenido actual del carrito.
- No ejecutar si el carrito ya no es recuperable.

---

## Pipeline

```text
event/state
→ normalize
→ identify opportunity
→ check entry
→ check eligibility
→ check exclusions
→ resolve conflicts
→ schedule step
→ revalidate
→ execute or exit
```

---

## Invariantes

- idempotencia por evento/oportunidad;
- cancelación de pasos pendientes cuando termina la oportunidad;
- source of truth externo para pedido, stock, precio y customer state;
- reason codes en cada transición;
- versión de flow persistida;
- no generar descuentos ni claims desde este runtime.

---

## Auditoría mínima

```text
flow_instance_id
customer_id
opportunity_key
trigger
step
decision
reason_code
state_before
state_after
timestamp
```

---

## Principio maestro

El runtime mantiene el estado del flow; no sustituye a los motores de elegibilidad, oferta, presión o copy.
