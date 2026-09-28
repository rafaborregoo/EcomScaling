# Fase 13.13 — Evidence Engine — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que `Evidence Engine` debe respetar.

## Reglas

- La evidencia específica de un tenant no puede exponerse como hecho de otro tenant.
- La promoción global requiere criterios explícitos y trazabilidad.
- No eliminar evidencia contraria para aumentar confidence.

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
