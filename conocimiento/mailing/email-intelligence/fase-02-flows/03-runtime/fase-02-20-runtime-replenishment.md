# Fase 2.20 — Replenishment — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Operar `Replenishment` de forma determinista y auditable.

---

## Eventos/estados

- `REPLENISHMENT_WINDOW_OPENED`
- `REORDER_PLACED`
- `SUBSCRIPTION_ACTIVE`
- `PRODUCT_DISCONTINUED`

---

## Reglas específicas

- Consumir expected_repurchase_interval.
- Cerrar tras recompra.
- Excluir subscription cuando ya cubre necesidad.
- Expirar la oportunidad tras ventana definida.

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
