# Fase 18.10 — Deliverability

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de deliverability debe combinar infraestructura, lista y comportamiento de envío.

Debe revisar consentimiento/opt-in, suppressions, bounces, complaints, hygiene, engagement, domain/IP reputation, SPF, DKIM, DMARC, one-click unsubscribe, warming, volumen y políticas de proveedor vigentes.

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
