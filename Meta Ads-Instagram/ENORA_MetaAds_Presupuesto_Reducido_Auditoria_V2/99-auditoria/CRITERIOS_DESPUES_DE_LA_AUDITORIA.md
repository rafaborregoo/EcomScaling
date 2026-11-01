# Criterios para decidir integración futura (NO ejecutar aún)

## Valor incremental real

Aprobar solo una mejora que (a) no esté ya cubierta satisfactoriamente, (b) se pueda explicar en decisiones observables, (c) tenga evidencia y datos suficientes y (d) no contradiga la fuente canónica o guardrails.

## Árbol de decisión

1. **Ya existe + funciona:** `REUTILIZAR` y, si aporta matices, `AMPLIAR` la documentación canónica. No generar otro embedding igual.
2. **Existe conocimiento pero no lógica determinista:** separar contenido del RAG de fórmulas, política de incertidumbre y herramientas de agente.
3. **Existe parcialmente y no funciona en producción:** `AMPLIAR` con diseño mínimo y tests, sujeto a aprobación; no duplicar módulos.
4. **No existe y aporta valor medible:** candidato `CREAR_NUEVO` con rutas y pruebas acordadas.
5. **No hay datos o API fiable:** `BLOQUEADO` / tratar como recomendación condicional y no funcionalidad ya disponible.
6. **Es promocional, erróneo, redundante o sin valor adicional:** `DESCARTAR` y documentar motivo.

## Condiciones técnicas para una fase de integración posterior

- Preservar IDs canónicos existentes, nombres de carpeta y contratos actuales; no usar rutas del ZIP como arquitectura obligatoria.
- Identificar contenido fuente y versión por hash; ingesta idempotente / dedup semántica; prevenir duplicados entre vídeos, versiones y tenants.
- Corpus original de fuente separado de RAG activo.
- Asegurar trazabilidad de cambio, metadatos de vigencia, test de recuperación relevante y regresión de respuestas.
- Validar que embeddings sólo se recomputan cuando cambia el contenido canónico aprobado.
- Plan de rollback y validación post-sincronización, sin ejecutar en auditoría.

## Riesgos P0

Cálculo falso de ROAS/margen/beneficio; atribución doble Meta/Klaviyo; exposición de PII; recomendaciones automáticas sin permisos; reglas que traten dos conversiones como significativas; duplicidad de embeddings.

## Criterio de salida de la auditoría

Inventario y matriz completos o límites declarados, tensiones entre ambos vídeos resueltas a nivel de **propuesta de regla**, rutas reales auditadas, plan priorizado NO EJECUTADO y recomendaciones concretas para un posible segundo ZIP incremental.
