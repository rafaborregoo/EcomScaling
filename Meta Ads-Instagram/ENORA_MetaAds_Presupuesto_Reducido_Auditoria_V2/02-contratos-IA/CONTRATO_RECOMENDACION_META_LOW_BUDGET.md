# Contrato candidato | Respuesta de diagnóstico para Meta Ads con poco presupuesto

**NO implementar sin revisión del contrato de agentes actual.** Reutilizar su formato canónico si ya existe. Esquema conceptual; no afirma campos disponibles hoy.

## Entradas requeridas según decisión

- `tenant_id` y ámbito de permisos; sin PII.
- Periodo solicitado, zona horaria, moneda y versión de atribución.
- Objetivo de campaña, evento optimizado y alcance de las métricas.
- Gasto, conversiones, CPA/ROAS observado y ventanas comparadas.
- Datos económicos Shopify/contabilidad confirmados o `unavailable`.
- Datos de retención/recompra de Shopify o Klaviyo cuando la recomendación depende de LTV.
- Cambios significativos recientes de campañas, si se observan.
- Incertidumbre de tracking, cobertura y retraso de datos.

## Salida mínima conceptual

```json
{
  "decision_type": "monitor|investigate|experiment|recommend_change|not_enough_data",
  "scope": "account|campaign|adset|ad|store",
  "observation": "Hecho medido, con cifras, rango temporal y fuente",
  "hypotheses": ["Interpretaciones plausibles, no causas declaradas"],
  "recommended_next_step": "Acción humana concreta y verificable",
  "business_constraints": ["margen", "caja", "capacidad", "restricciones"],
  "evidence": ["Origen + ID + ventana + limitación"],
  "uncertainties": ["Falta de datos, límites de atribución"],
  "validation_plan": "Qué medir y cuándo reevaluar según muestra",
  "requires_human_approval": true,
  "write_actions_executed": false
}
```

*El JSON es solo especificación de discusión.* El contrato real debe derivarse del schema vigente, no duplicarse.

## Reglas de lenguaje

- `observed`: «Registró 5 compras atribuidas entre X e Y».
- `hypothesis`: «La fragmentación podría estar limitando la señal; necesita verificación».
- `recommendation`: «Revisaría consolidación si los ad sets persiguen el mismo objetivo y no hay restricciones de país/oferta».
- `not_supported`: «No puedo afirmar si el creativo funciona mejor sin datos del experimento o assets».

## Prohibiciones

- No llamar «significativo» un resultado sin diseño y método apropiados.
- No inferir ROAS de competidores desde biblioteca pública.
- No afirmar rentabilidad con solo ROAS.
- No actualizar presupuestos, campañas ni conectar cuentas sin autorización humana y herramientas auditadas.
- No crear o guardar información sensible sobre clientes individuales a partir de cohortes.

## Compatibilidad con pack anterior

`02-contratos-IA/CONTRATO_DIAGNOSTICO_META_ECOMMERCE.md`. Auditar y, si procede, **extenderlo en lugar de construir otro schema paralelo**.
