# Fase 8.8 — Exclusiones — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que el sistema debe respetar al aplicar `Exclusiones`.

## Reglas

- Una exclusión hard debe prevalecer sobre reglas de inclusión.
- No se debe eliminar una exclusión hard mediante scoring.
- Toda exclusión debe ser explicable.

---

## Precedencia

Cuando una policy hard entra en conflicto con una recomendación de IA:

```text
POLICY
>
MODEL_RECOMMENDATION
```

La IA puede explicar el conflicto, pero no debe invalidar la política.

---

## Auditoría

Toda aplicación o excepción autorizada debe quedar registrada con:
- rule_id;
- version;
- reason;
- scope;
- timestamp.

---

## Principio maestro

Los guardrails limitan lo que puede ejecutarse, aunque el modelo considere atractiva otra acción.
