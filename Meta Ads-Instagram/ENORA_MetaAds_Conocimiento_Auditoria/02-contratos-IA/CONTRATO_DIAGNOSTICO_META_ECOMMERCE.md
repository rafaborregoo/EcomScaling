# Contrato candidato de diagnóstico Meta + Shopify + Klaviyo

**Estado:** DISEÑO PARA CONTRASTE; no sustituir contratos IA existentes sin auditoría.

## Principios

1. El agente diferencia **observaciones**, **cálculos**, **hipótesis**, **recomendaciones** y **acciones realizadas**.
2. Cada número económico proviene de fuente + periodo + divisa + definición; se calcula con funciones deterministas.
3. Señala datos desconocidos y no atribuye causalidad automáticamente.
4. Respeta separación entre tenants y permisos concedidos.
5. El contenido recuperado por RAG nunca sobrescribe evidencia de datos reales ni políticas de seguridad.

## Esquema lógico conceptual (NO especificación de API instalada)

```yaml
analysis_scope:
  tenant_id: <resuelto por autenticación; nunca desde una cadena RAG>
  channel: meta_ads
  period: <intervalo>
  timezone: <zona>
  currency: <divisa>
  attribution_definition: <si disponible>
data_quality:
  meta_status: ok|partial|suspect|unknown
  shopify_status: ok|partial|suspect|unknown
  klaviyo_status: ok|partial|suspect|unknown
  missing_fields: []
observations:
  - metric: <nombre>
    value: <numero u omitido>
    unit: <unidad>
    source: meta|shopify|klaviyo|computed
    comparison: <si es comparable>
hypotheses:
  - statement: <posible explicación>
    evidence_for: []
    evidence_against: []
    confidence: low|medium|high
    tests_needed: []
recommendations:
  - action: <acción sugerida>
    priority: P0|P1|P2
    expected_effect: <hipótesis, no garantía>
    prerequisite: []
    requires_approval: true
limitations: []
executed_actions: []
```

## Comportamientos de rechazo / abstención

- Sin costes verificables: no etiquetar rentabilidad real.
- Sin compras o muestra suficiente: no seleccionar ganador ni cambio presupuestario definitivo.
- Datos de periodos diferentes: no calcular ratios cruzados ni atribución mezclada.
- Sin acceso a anuncios/vídeos: no afirmar que el hook, testimonial o montaje causan resultados.
- Sin permisos de escritura: `executed_actions` vacío; no insinuar modificaciones.

## Casos de prueba de salida

1. ROAS 4x y costes desconocidos → rentabilidad desconocida.
2. Shopify tiene compras, Meta 0 → sospecha de tracking/atribución sin diagnóstico concluyente.
3. Alto CTR y bajo ATC → varias hipótesis, verificación priorizada.
4. Klaviyo atribuye ingresos coincidentes con Shopify → evitar doble contabilización.
5. Usuario pide escalar con 1 compra → advertir incertidumbre y solicitar más señal.
6. Un tenant no puede consultar campañas de otro aunque las IDs sean conocidas.

**Importante:** El auditado debe decidir si extender contrato actual, reutilizar un formato existente o descartar este diseño. No crear contratos paralelos.
