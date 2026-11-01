# e-NORA — Paquete V03: estrategia creativa desde investigación (AUDITORÍA, NO INTEGRACIÓN)

Este ZIP es una **tercera fuente candidata** para e-NORA (SaaS ecommerce Shopify + Meta + Klaviyo). Objetivo: que Claude Code investigue en **modo solo lectura** lo ya existente, contraste con los vídeos 01/02 y determine **qué conocimiento nuevo justifica incorporación** y qué se debe fusionar o descartar.

## Tesis aportada por el vídeo

No basta con producir anuncios o copiar creativos. El vídeo propone **investigación de marca/producto**, **reputación y objeciones**, **minería de reseñas y comentarios**, **hipótesis de personas**, **auditoría de brechas persona/conciencia/diversidad**, y **roadmap trimestral/mensual**.

### Límite esencial

Este vídeo **NO enseña una producción audiovisual completa** ni aporta datos probados del rendimiento de los anuncios sugeridos. Las «personas» derivadas de reseñas no son estadísticas representativas ni justifican perfilar atributos sensibles.

## Carpetas

| Carpeta | Propósito | Estado |
|---|---|---|
| `00-corpus-maestro/` | Evidencia textual y tiempos | Fuente sin validación externa |
| `01-rag-produccion/` | 11 fichas de conocimiento candidato | NO ingerido |
| `02-contratos-IA/` | Contrato y taxonomía hipotéticos | NO implementados |
| `03-runtime/` | Dos playbooks de análisis propuestos | NO implementados |
| `04-policies-guardrails/` | Prevención de sobreinterpretación, privacidad y claims | Candidatos |
| `05-experience-learning/` | Cierre de experimento y gap de producción audiovisual | Candidatos |
| `06-tenant-context/` | Fuentes, permisos y límites multi-tenant | No verificados |
| `99-auditoria/` | Solapamientos V01/V02/V03 y matriz pendientes | Por completar |
| `00_PROMPT_MAESTRO_AUDITORIA_INCREMENTAL.md` | Prompt local anterior, sustituido por el maestro canónico | Referencia |

## Orden de trabajo recomendado

1. Pasar a Claude Code los tres ZIP y usar el prompt canónico `../ENORA_MetaAds_Conocimiento_Auditoria/PROMPT_FINAL_MAESTRO_AUDITORIA.md` del primer paquete. Adjuntar V01/V02; si falta alguno, pedir comparación parcial.
2. Claude Code inspecciona repositorio real, RAG, índices, conectores y tests sin escribir ni generar embeddings.
3. Devuelve matriz de gaps, duplicados y tensiones, con `ruta:línea` y riesgos.
4. Solo en un encargo posterior aprobado se prepara ZIP consolidado e integración incremental.

**No confundir la preparación de este material con auditoría ejecutada ni funcionalidad existente.**

