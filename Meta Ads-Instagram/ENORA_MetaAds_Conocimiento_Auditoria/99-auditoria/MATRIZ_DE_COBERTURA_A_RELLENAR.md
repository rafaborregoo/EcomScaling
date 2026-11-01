# Matriz de cobertura (rellenar tras inspeccionar repo real)

**IMPORTANTE:** celdas vacías no significan que e-NORA carezca de la funcionalidad. No se ha auditado el repositorio en este paquete.

## Estados permitidos

- `EXISTE_COMPLETO`: código + uso en runtime + datos + pruebas/evidencia.
- `EXISTE_PARCIAL`: hay componentes, faltan condiciones esenciales.
- `SOLO_DOCUMENTADO`: existe concepto/prompt/documento, no implementación validada.
- `DUPLICADO_CONFLICTIVO`: dos o más fuentes de verdad o pipelines inconsistentes.
- `NO_ENCONTRADO`: no localizado tras búsqueda documentada, no prueba inexistencia absoluta.
- `OBSOLETO`: existe pero no se usa o está deprecado, evidenciado.
- `NO_VERIFICABLE`: faltan permisos, conexión o archivos para comprobarlo.

| ID | Tema | Estado | Rutas+líneas | Qué funciona realmente | Hueco/fallo | Acción sugerida | Prioridad |
|---|---|---|---|---|---|---|---|
| META-001 | Gobernanza activos | PENDIENTE | | | | | |
| META-002 | Tracking y calidad | PENDIENTE | | | | | |
| META-003 | Objetivo/estructura | PENDIENTE | | | | | |
| META-004 | Diagnóstico embudo | PENDIENTE | | | | | |
| ECO-001 | ROAS, CPA y margen | PENDIENTE | | | | | |
| META-005 | Estrategia creativos | PENDIENTE | | | | | |
| META-006 | Presupuestos | PENDIENTE | | | | | |
| META-007 | Incidentes | PENDIENTE | | | | | |
| META-008 | IA aplicada | PENDIENTE | | | | | |
| GAP-VIDEO | Producción vídeo no cubierta | PENDIENTE | | | | | |
| CONTRACT | Contratos de análisis | PENDIENTE | | | | | |
| RUNTIME | Playbooks y herramientas | PENDIENTE | | | | | |
| GUARD | Guardrails | PENDIENTE | | | | | |
| DATA | Conectores y calidad por tenant | PENDIENTE | | | | | |
| INGEST | Idempotencia del RAG | PENDIENTE | | | | | |

## Campos adicionales por hallazgo

`evidencia_código` · `evidencia_documentación` · `evidencia_tests` · `fuente_de_verdad` · `riesgo_duplicación` · `nivel_confianza` · `dependencias` · `coste_estimado` · `riesgo_privacidad`.
