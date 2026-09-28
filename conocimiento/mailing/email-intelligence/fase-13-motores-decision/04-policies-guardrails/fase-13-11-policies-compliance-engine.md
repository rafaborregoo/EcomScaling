# Fase 13.11 — Compliance Engine — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que `Compliance Engine` debe respetar.

## Reglas

- Una policy hard fallida bloquea ejecución.
- Las reglas externas deben resolverse por versión y vigencia.
- No se puede marcar compliance como PASS con evidencia crítica UNKNOWN.

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
