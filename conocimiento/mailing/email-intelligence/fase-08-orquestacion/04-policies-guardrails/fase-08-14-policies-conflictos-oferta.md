# Fase 8.14 — Conflictos de oferta — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que el sistema debe respetar al aplicar `Conflictos de oferta`.

## Reglas

- No combinar ofertas incompatibles.
- No superar límites económicos mediante stacking.
- La oferta comunicada debe seguir siendo válida en el destino.

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
