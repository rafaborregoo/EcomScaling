# Fase 13.5 — Eligibility Engine — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que `Eligibility Engine` debe respetar.

## Reglas

- Una hard suppression invalida elegibilidad.
- Una restricción legal o de proveedor prevalece sobre cualquier prioridad comercial.
- La elegibilidad debe reevaluarse antes de ejecución cuando el contexto pueda cambiar.

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
