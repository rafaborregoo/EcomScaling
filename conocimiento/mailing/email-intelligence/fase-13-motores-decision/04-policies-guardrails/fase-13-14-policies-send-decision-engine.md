# Fase 13.14 — Send Decision Engine — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que `Send Decision Engine` debe respetar.

## Reglas

- SEND nunca puede sobreescribir una hard suppression, hard exclusion o compliance failure.
- DELAY debe incluir condición o momento de reevaluación.
- SUPPRESS debe tener scope explícito.
- NO_SEND no puede ser ignorado por una capa de copy o creatividad.

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
