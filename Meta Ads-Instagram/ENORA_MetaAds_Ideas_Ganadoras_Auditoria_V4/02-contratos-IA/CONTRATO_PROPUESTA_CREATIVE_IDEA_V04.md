# Contrato candidato — propuesta creativa con evidencia

## Objetivo
Que un agente de e-NORA proponga hipótesis y experimentos creativos sin presentar inferencias como hechos. **Contrato por auditar, no implementación existente.**

## Estructura lógica sugerida
```json
{
  "tenant_scope": "tenant autorizada (identificador interno; no cruzar)",
  "analysis_period": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
  "strategy_route": "HISTORICO_PROPIO | EXPLORACION_ORGANICA | COMBINADA | SIN_DATOS",
  "big_idea": "Promesa o insight comercial definido en una frase",
  "problem_or_desire": "Necesidad comercial sin datos sensibles",
  "persona_hypothesis": "Arquetipo por necesidad, no identidad real",
  "angle": "Enfoque del mensaje",
  "hook": "Apertura de prueba; no copy que deba publicarse sin revisión",
  "format": "STATIC | UGC_VIDEO | FOUNDER | DEMO | PARTNERSHIP | OTHER",
  "evidence": [{"source_type": "META_ADS | SHOPIFY | REVIEW | ORGANIC | MANUAL", "source_id": "identificador verificable", "period": "intervalo", "limitation": "sesgo o acceso"}],
  "evidence_level": "INTERNA_RESULTADOS | INTERNA_CUALITATIVA | EXTERNA_OBSERVACIONAL | SIN_EVIDENCIA",
  "hypothesis": "Qué esperamos comprobar; no resultado confirmado",
  "minimum_viable_test": {"asset": "pieza", "primary_kpi": "métrica apropiada", "success_criteria": "regla acordada"},
  "business_constraints": ["margen", "presupuesto", "derechos", "claims"],
  "risks": ["muestra insuficiente"],
  "next_action": "propuesta para aprobación humana"
}
```

## Invariantes
- Campos de evidencias no fabricados: si faltan, `unknown`, nunca datos sintéticos mostrados como reales.
- Estado `recomendación`, nunca `publicado`, salvo comprobación real de la acción.
- El nivel de evidencia se evalúa por atributo; no usar un porcentaje automático de probabilidad de éxito.
- No hacer profiling sensible ni promesas publicitarias no demostradas.
- No publicar anuncios ni variar gasto sin permisos, validación humana y capacidad real implementada.

## Ejemplos de respuestas
Correcta: “Idea: rapidez; existe evidencia interna limitada en CTR, no en ventas; probar variación estática antes de nuevo vídeo”.
Incorrecta: “Con un 93 % de probabilidad este vídeo tendrá ROAS 6” sin datos suficientes.
