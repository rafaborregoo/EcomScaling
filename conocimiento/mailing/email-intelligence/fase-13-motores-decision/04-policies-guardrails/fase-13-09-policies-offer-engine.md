# Fase 13.9 — Offer Engine — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que `Offer Engine` debe respetar.

## Reglas

- No aprobar ofertas que violen hard margin floor.
- No aplicar stacking incompatible.
- No crear descuentos inexistentes.
- Una oferta expirada o no elegible debe rechazarse.

---

## Precedencia

```text
HARD_POLICY
>
ENGINE_SCORE
>
MODEL_RECOMMENDATION
```

Una puntuación alta nunca convierte una acción prohibida en válida.

---

## Auditoría

Toda regla aplicada debe poder conservar:
- `rule_id`;
- `rule_version`;
- `scope`;
- `result`;
- `reason`;
- `evaluated_at`.

---

## Principio maestro

Los límites duros son ejecutables y auditables, no sugerencias semánticas.
