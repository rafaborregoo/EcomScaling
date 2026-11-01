# e-NORA | Pack incremental 02 — Meta Ads con presupuestos reducidos

**Fecha del paquete:** 2026-10-31  ·  **Estado:** CANDIDATO, NO APROBADO PARA PRODUCCIÓN  ·  **Ámbito:** ecommerce / Meta Ads / Shopify / Klaviyo

## Finalidad

Convertir un segundo vídeo (transcripción facilitada, duración ~27:33) en conocimiento trazable y **proponer una auditoría incremental** respecto al paquete anterior `ENORA_MetaAds_Conocimiento_Auditoria.zip` y al repositorio real de e-NORA.

**No integra código, RAG, embeddings, base de datos, agentes ni anuncios.** No afirmar que algo está implementado o ausente sin pruebas del repositorio. El material se entrega para comparar, fusionar, descartar o proponer cambios posteriormente.

## Pasos de uso

1. Entregar este ZIP a Claude Code en el contexto del repositorio de e-NORA.
2. Darle como instrucción principal `../ENORA_MetaAds_Conocimiento_Auditoria/PROMPT_FINAL_MAESTRO_AUDITORIA.md`, que compara los tres vídeos. El prompt local antiguo queda sustituido.
3. Si se conserva el **primer ZIP**, facilitarlo también o su informe anterior para comparación; si no existe, el agente debe indicar que solo pudo cotejar nombres/repo.
4. Solicitar informe **solo lectura**, con evidencias en rutas y líneas, cobertura real e identificación de colisiones entre vídeos.
5. Solo tras evaluar ese informe se prepara una segunda fase de integración aprobada.

## Índice

- `00-corpus-maestro/`: metadatos y transcripción literal (NO indexar directamente).
- `01-rag-produccion/`: **9 fichas candidatas** de conocimiento empresarial/publicitario (NO indexar aún).
- `02-contratos-IA/`: especificación propuesta para respuestas de recomendación con presupuestos reducidos.
- `03-runtime/`: dos playbooks de decisión propuestos, independientes del modelo de lenguaje.
- `04-policies-guardrails/`: condicionantes que impiden recomendaciones excesivamente categóricas.
- `05-experience-learning/`: diseño de experimentos y límites de la creación audiovisual.
- `06-tenant-context/`: requisitos y disponibilidad de campos multi-fuente a comprobar.
- `99-auditoria/`: matriz vacía, mapa de solapamientos entre vídeos y plan de decisión.
- `00_PROMPT_MAESTRO_AUDITORIA_INCREMENTAL.md`: referencia antigua, sustituida por el prompt final maestro del primer paquete.

## Etiquetas de procedencia

- **[FUENTE]**: lo expresa el ponente; no significa que sea una verdad general, ni una política oficial de Meta.
- **[INFERENCIA]**: conclusión derivada de la fuente, no pronunciada literalmente.
- **[PROPUESTA e-NORA]**: comportamiento recomendado del software, sujeto a revisión del repo.
- **[VERIFICAR]**: dependencia de datos reales, documentación oficial, experimentos o límites de API.
- **[PATROCINADO]**: promoción comercial en el material, no evidencia de eficacia.

Los tiempos se refieren a la transcripción proporcionada por el usuario. No se ha recibido ni verificado la URL ni identidad de publicación del vídeo. Se preserva el contenido fuente, incluido cualquier fallo de transcripción. El documento de origen no equivale a documentación técnica de Meta.

## Tres conclusiones antes de auditar

1. **Nuevo valor potencial:** cadencia de cambios condicionada al número de conversiones; optimización bajo escasez de datos; economía del cliente y diferencia entre ROAS y beneficio absoluto; nicho y reutilización de contenido orgánico.
2. **Solapamiento potencial importante:** objetivos, aprendizaje, creativos, ROAS/CPA, estructura y gestión del presupuesto ya aparecían en el primer pack. Priorizar FUSIONAR/AMPLIAR, no nuevos embeddings.
3. **No aporta un método para producir vídeos:** menciona ángulos, anuncios UGC, formatos e incluso una herramienta patrocinada, pero no ofrece un proceso verificable de guion, grabación y edición.

## Principio de diseño

Datos identificables y fiables → métricas reproducibles → evaluación de cobertura y muestra → políticas/umbrales contextuales → diagnóstico fundamentado → propuesta explicada **sin escrituras automáticas**.
