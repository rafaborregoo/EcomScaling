# Fase 18.1 — Estado actual

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría debe comenzar construyendo una fotografía verificable de la tienda antes de recomendar cambios.

Debe identificar modelo de negocio, mercados, catálogo, lifecycle, flows, campañas, segmentación, ofertas, infraestructura de email, métricas, experimentación, herramientas conectadas y calidad/frescura de datos.

El objetivo inicial no es juzgar: es establecer qué existe, qué falta y qué puede verificarse.

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
