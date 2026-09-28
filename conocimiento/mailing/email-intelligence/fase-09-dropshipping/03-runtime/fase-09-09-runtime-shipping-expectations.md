# Fase 9.9 — Shipping Expectations — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista necesaria para `Shipping Expectations`.

---

## Reglas específicas

- Consumir ETA y shipping status de source of truth.
- Separar processing_time y transit_time.
- Actualizar ETA si cambia.
- No marcar como guaranteed salvo dato explícito.

---

## Principios de ejecución

- utilizar fuentes operativas actuales;
- mantener estados `UNKNOWN` cuando falte información;
- no convertir estimaciones en garantías;
- revalidar antes de comunicaciones sensibles;
- registrar cambios de shipping, tracking, refund o soporte;
- conservar trazabilidad por pedido, shipment y cliente.

---

## Auditoría mínima

```text
customer_id
order_id
shipment_id
source
source_timestamp
operational_state
decision
reason_code
evaluated_at
```

---

## Principio maestro

El runtime representa lo que está ocurriendo.

La IA decide cómo explicarlo dentro de los límites permitidos.
