# Fase 2.11 — Browse Abandonment — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Operar `Browse Abandonment` de forma determinista y auditable.

---

## Eventos/estados

- `MEANINGFUL_BROWSE`
- `CATEGORY_VIEWED`
- `SEARCH_PERFORMED`
- `ADD_TO_CART`
- `ORDER_PLACED`

---

## Reglas específicas

- Requiere browse_inactivity_window configurable.
- Cancelar ante señales más avanzadas.
- Agrupar eventos próximos en una misma oportunidad.
- Expirar interés.

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
