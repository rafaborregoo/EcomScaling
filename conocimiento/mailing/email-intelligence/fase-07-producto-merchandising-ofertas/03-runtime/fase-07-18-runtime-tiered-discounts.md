# Fase 7.18 — Tiered Discounts — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista necesaria para operar `Tiered Discounts`.

---

## Reglas específicas

- Representar tiers ordenados.
- Aplicar exactamente un tier o regla explícita de acumulación.
- Validar margin floor por tier.
- Mostrar siguiente threshold correctamente.

---

## Pipeline recomendado

```text
candidate generation
→ hard eligibility filters
→ availability
→ compatibility
→ economic validation
→ ranking
→ explanation
→ output
```

Los filtros duros deben ejecutarse antes del ranking.

---

## Invariantes

- no recomendar productos no comprables;
- no prometer descuentos no vigentes;
- no superar límites de margen;
- no usar datos de catálogo inventados;
- los cálculos económicos deben ser reproducibles;
- toda exclusión o selección relevante debe tener `reason_code`;
- el LLM no debe ser source of truth de precio, stock o margen.

---

## Auditoría mínima

```text
customer_id
candidate_set
selected_items
offer_id
price_snapshot
inventory_snapshot
margin_snapshot
rules_version
decision_reasons
calculated_at
```

---

## Principio maestro

El runtime decide sobre datos estructurados; la IA interpreta y comunica la decisión.
