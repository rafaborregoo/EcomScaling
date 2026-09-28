# Fase 2.14 — Checkout Abandonment — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Operar `Checkout Abandonment` de forma determinista y auditable.

---

## Eventos/estados

- `CHECKOUT_BECAME_ABANDONED`
- `PAYMENT_FAILED`
- `CHECKOUT_REACTIVATED`
- `ORDER_PLACED`
- `CHECKOUT_INVALID`

---

## Reglas específicas

- Consumir estado de checkout calculado.
- Separar payment failure de abandono.
- Revalidar oferta, stock y shipping.
- Cancelar inmediatamente tras conversión.

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
