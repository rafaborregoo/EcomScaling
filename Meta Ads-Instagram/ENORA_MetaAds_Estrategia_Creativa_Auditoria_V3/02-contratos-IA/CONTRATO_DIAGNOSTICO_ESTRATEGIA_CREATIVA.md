# Contrato candidato IA — Creative Research → Creative Strategy

**Estado: PROPUESTA PARA AUDITAR; no modificar contratos existentes sin inspeccionar el repo.**

## Entrada lógica (no asumir que APIs/entidades existen)

- `tenant_scope`: tenant autorizado y permisos de acceso.
- `objective`: objetivo empresarial, producto/categoría, geografía, ventana de medición, presupuesto de producción/test y nivel de riesgo.
- `sources[]`: origen, propiedad, permiso, fecha, idioma, IDs, completitud, caducidad y filtros aplicados.
- `products[]`: catálogo y ofertas; costos/margen solamente si existen.
- `creative_inventory[]`: IDs de campaña/ad/asset reales o `NOT_AVAILABLE`.
- `feedback[]`: reseñas/comentarios previamente autorizados; sin PII innecesaria.
- `performance[]`: métricas con definición, atribución, moneda, moneda de cuenta, período y procedencia; opcionales.

## Salida lógica

```yaml
strategy_assessment:
  audit_status: CANDIDATE | SUPPORTED | PARTIAL | NOT_EVALUABLE
  objective: string
  coverage_window: {start: date_or_null, end: date_or_null}
  available_sources: [source_id]
  source_limitations: [string]
  detected_signals:
    - signal_id: string
      statement: string
      evidence_refs: [source_id]
      strength: LOW | MEDIUM | HIGH | NOT_ASSESSED
      bias_and_uncertainty: [string]
  persona_hypotheses:
    - persona_id: string
      needs_based_description: string
      evidence_refs: [source_id]
      confidence: LOW | MEDIUM | HIGH
  candidate_gaps:
    - axis: PERSONA | ANGLE | AWARENESS | FORMAT | OFFER
      observed_coverage: string
      is_intentional_unknown: boolean
      opportunity_hypothesis: string
      evidence_refs: [source_id]
  proposed_experiments:
    - experiment_id: string
      target_business_outcome: string
      persona_hypothesis_id: string
      creative_angle: string
      concept: string
      candidate_format: string
      differentiating_reason: string
      primary_metric: string
      guardrails: [string]
      data_requirements: [string]
      assumptions: [string]
      approval_required: true
  unsupported_claims: [string]
  prohibited_actions_not_taken: [string]
```

## Invariantes

1. Ninguna «persona» o «objección frecuente» sin fuentes identificables y límites de muestra.
2. No confundir resultados de Meta Ads con ingresos Shopify o atribución Klaviyo; no sumar ventas atribuidas de plataformas distintas.
3. No generar claims de producto no verificados ni inferir características sensibles del público.
4. No prescribir automáticamente acciones de escritura en campañas, generación/publicación de contenido ni scraping.
5. Si faltan datos indispensables, `PARTIAL` o `NOT_EVALUABLE`; no rellenar huecos con suposiciones.
6. No declarar causalidad de ideas creativas sin experimento; distinguir `observado`, `hipótesis` y `resultado`.

## Tests de contrato

- Mismos testimonios en dos fuentes → un hallazgo consolidado, dos referencias, sin duplicar prevalencia.
- Sin catálogo/márgenes → no declarar bundle rentable.
- Con campaña de conversión y anuncio educativo → no denunciar configuración TOFU como inconsistente.
- Sin soporte de API comentarios → no fingir que se leyó Meta.
- Un prospecto de salud en comentarios → no perfilado ni publicidad dirigida sobre ese atributo.
