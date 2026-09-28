# Fase 2.16 — Product Education — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Operar `Product Education` de forma determinista y auditable.

---

## Eventos/estados

- `PRODUCT_INTEREST_CONFIRMED`
- `PRODUCT_PURCHASED`
- `ORDER_DELIVERED`
- `RETURN_REQUESTED`

---

## Reglas específicas

- Asociar secuencia a product_id o product_family.
- Versionar contenido educativo.
- Cancelar o cambiar ante return/refund.
- No utilizar instrucciones no verificadas.

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
