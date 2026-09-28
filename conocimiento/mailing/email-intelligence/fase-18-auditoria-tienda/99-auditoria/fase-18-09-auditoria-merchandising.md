# Fase 18.9 — Merchandising

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de merchandising revisa cómo se decide qué productos mostrar.

Debe comprobar selección, afinidad, complementariedad, cross-sell, upsell, bundles, best sellers, new arrivals, stock, margen, diversidad, ownership y recommendation logic.

Debe detectar dependencia excesiva de popularidad global o selección manual estática.

---

## Estructura de hallazgo

```text
finding_id
domain
observation
evidence
current_state
expected_or_required_state
gap
risk
confidence
dependencies
recommended_action
validation_method
```

## Estados recomendados

```text
OK
PARTIAL
GAP
RISK
BLOCKED
UNKNOWN
NOT_APPLICABLE
```

`UNKNOWN` no debe convertirse en `OK`.

## Evidencia

Distinguir siempre:
- dato observado;
- output de runtime;
- configuración del tenant;
- policy vigente;
- evidencia experimental;
- interpretación de IA.

## Principio maestro

Una auditoría útil construye una cadena trazable de evidencia → gap/riesgo → acción → validación.
