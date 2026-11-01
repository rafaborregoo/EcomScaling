# e-NORA | Pack de conocimiento: vídeo de Meta Ads

**Versión:** 1.0 · **Fecha:** 2026-10-31 · **Estado:** PROPUESTA PENDIENTE DE AUDITORÍA

## Objetivo

Extraer, depurar y organizar el conocimiento transmitido por una transcripción de ~33 minutos de un tutorial de Meta Ads y compararlo con el repositorio real de e-NORA antes de introducir material nuevo en el RAG, alterar agentes o reindexar embeddings.

**Esto NO es una implementación ni una orden de ingestión.** Los documentos son candidatos que requieren comprobación de duplicados, cobertura del conocimiento actual, pertinencia técnica y políticas vigentes.

## Cómo usarlo

1. Entrega los tres ZIP a Claude Code con acceso al repositorio de e-NORA: este paquete, `ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2` y `ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3`.
2. Abre y pasa como instrucción principal `PROMPT_FINAL_MAESTRO_AUDITORIA.md`. Es el prompt canónico consolidado para los tres vídeos; los prompts anteriores quedan señalados como sustituidos.
3. Claude Code debe leer la matriz y los candidatos, inspeccionar el código/RAG/documentación en modo solo lectura y entregar el informe solicitado **sin modificar nada**.
4. Después de revisar la auditoría, se decidirá qué reutilizar, ampliar, fusionar o descartar. **No indexar automáticamente este paquete.**

## Estructura

- `00_PROMPT_MAESTRO_AUDITORIA.md`: referencia antigua, sustituida por el prompt final maestro.
- `00-corpus-maestro/`: ficha de fuente y transcripción original íntegra; material de referencia, no conocimiento aprobado.
- `01-rag-produccion/`: nueve fichas candidatas con observaciones, criterios y límites de uso.
- `02-contratos-IA/`: contrato de salida de diagnósticos y límites de certeza.
- `03-runtime/`: flujo de decisión propuesto (diseño, no implementación).
- `04-policies-guardrails/`: reglas para evitar recomendaciones financieras/publicitarias inseguras.
- `05-experience-learning/`: experimentos creativos, distinguiendo vídeo fuente de propuesta externa.
- `06-tenant-context/`: métricas y señales de Shopify/Meta/Klaviyo requeridas (disponibilidad por auditar).
- `99-auditoria/`: inventario de cobertura a rellenar y criterios de aceptación.
- `../ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/`: segundo vídeo y candidatos de presupuesto reducido, comparados por el prompt maestro.
- `../ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/`: tercer vídeo y candidatos de estrategia creativa, investigación y privacidad, comparados por el prompt maestro.

## Convenciones de procedencia

- **[VÍDEO]**: idea presente en el material aportado; no equivale a validación externa ni recomendación definitiva.
- **[INFERENCIA]**: derivación analítica de las ideas del vídeo, que no aparece expresamente en él.
- **[PROPUESTA e-NORA]**: diseño/funcionalidad posible, pendiente de contraste con lo que ya existe.
- **[VERIFICAR]**: afirmación que necesita documentación oficial, datos, pruebas o auditoría.

Los rangos de minuto son aproximados y remiten a la transcripción suministrada, no a un vídeo comprobado externamente. El vídeo no proporciona identificación o URL verificada. La transcripción contiene errores de reconocimiento: no corregir silenciosamente en los archivos de fuente.

## Qué NO enseña este vídeo

No ofrece un curso práctico de preproducción, guion, rodaje, montaje, sonido, retención o generación detallada de vídeos UGC. Solo menciona tipos de creativos, variación de ángulos, formatos, recursos de inspiración y herramientas de IA; la producción audiovisual queda como **gap documentado**, nunca como contenido inventado atribuido al vídeo.

## Principio arquitectónico

Datos verificables (Shopify/Meta/Klaviyo) + fórmulas deterministas + reglas/guardrails + recuperación contextual RAG + explicación trazable. La recuperación semántica por sí sola no debe calcular rentabilidad ni activar cambios presupuestarios.
