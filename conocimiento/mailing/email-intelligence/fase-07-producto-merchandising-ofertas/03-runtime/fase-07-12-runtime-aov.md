# Fase 7.12 — AOV — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista necesaria para operar `AOV`.

---

## Reglas específicas

- Calcular AOV con pedidos válidos.
- Permitir ventanas temporales.
- Separar AOV global, segmento y cohort.
- No usar AOV como único objetivo económico.

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
