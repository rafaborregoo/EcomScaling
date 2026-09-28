# Fase 2.17 — Second Purchase — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Operar `Second Purchase` de forma determinista y auditable.

---

## Eventos/estados

- `FIRST_ORDER_DELIVERED`
- `FIRST_PURCHASE_MATURED`
- `SECOND_ORDER_PLACED`
- `RETURN_REQUESTED`

---

## Reglas específicas

- Abrir ventana solo tras hitos configurados.
- Cerrar con segundo pedido válido.
- Consultar incidencias y devoluciones.
- Utilizar catálogo de oportunidades relevantes.

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
