# Fase 3.11 — UGC — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la responsabilidad determinista del software para operar `UGC`.

---

## Reglas específicas

- Consumir solo UGC con usage_status permitido.
- Guardar asset_id y rights metadata.
- Excluir assets revocados o expirados.
- No inferir permisos desde el contenido.

---

## Pipeline de ejecución

```text
campaign_definition
→ validate objective
→ build audience
→ apply exclusions
→ validate product / offer / content
→ check contact pressure
→ resolve conflicts
→ schedule
→ final revalidation
→ SEND / DELAY / SUPPRESS / NO_SEND
```

---

## Invariantes

- cada campaña está versionada;
- la audiencia final es reproducible;
- la identidad se deduplica antes de envío;
- un cambio relevante de stock, precio, supresión o consentimiento puede invalidar el envío;
- toda decisión final produce un `reason_code`;
- el runtime no inventa copy, claims, beneficios, descuentos ni datos de cliente;
- el estado actual prevalece sobre snapshots cuando una acción depende de disponibilidad vigente.

---

## Auditoría mínima

```text
campaign_id
campaign_version
objective
audience_definition_version
audience_size
scheduled_at
decision
reason_code
product_set_id
offer_id
pressure_snapshot
created_at
```

---

## Principio maestro

El runtime convierte una estrategia aprobada en una ejecución controlada y trazable.
