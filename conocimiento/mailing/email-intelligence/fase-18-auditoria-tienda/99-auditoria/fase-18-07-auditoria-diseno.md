# Fase 18.7 — Diseño

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría visual revisa si el email facilita comprensión y acción.

Debe comprobar jerarquía, mobile-first, hero, módulos, product cards, CTA visual, tipografía, spacing, imágenes, alt text, dark mode, accesibilidad, responsive, continuidad con marca/landing y sistema de templates.

La estética no debe eclipsar legibilidad, compatibilidad o función.

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
