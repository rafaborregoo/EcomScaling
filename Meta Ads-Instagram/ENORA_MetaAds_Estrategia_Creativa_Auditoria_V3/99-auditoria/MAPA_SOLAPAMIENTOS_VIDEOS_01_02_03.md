# Solapamientos y tensiones — V01 vs V02 vs V03

**No implica que los anteriores ZIP estén integrados.** Usar como ayuda para detectar redundancia documental y de runtime, no como estado verificado.

| Tema | V01 | V02 | V03 | Resolución propuesta para auditar |
|---|---|---|---|---|
| Creativos | 3–5 ángulos y formatos, importancia sobre ajustes | Productividad con pocos recursos, 10–20 variaciones en promoción | Calidad estratégica previa al formato | Priorizar hipótesis/ángulos; variaciones solo si hay presupuesto y diseño de test |
| Competidores | Biblioteca de anuncios como inspiración | «Modelar lo que funciona», largo tiempo activo como proxy | Critica copiar y priorizar impresiones | Benchmark como inspiración; ni longevidad ni impresiones prueban ROAS/beneficio; diferenciación y datos propios |
| Audiencias/personas | Segmentación broad puede ayudar | Nicho en mensaje de negocio para presupuesto pequeño | Personas inferidas por investigación de consumidores | Separar segmentación Meta, mensajes de persona y características privadas/sensibles |
| TOFU / awareness | Campañas Sales para compra, medir conversiones | Con poco presupuesto, priorizar Sales/Leads vs awareness | Puede faltar contenido TOFU | **Contenido TOFU ≠ campaña de awareness**; etapa del mensaje y objetivo de optimización independientes |
| Rentabilidad | CPA/ROAS de equilibrio | CAC, LTV, beneficio absoluto y caja | Bundles y AOV antes de Ads | Contribución/unidad y estrategia creativa deben apoyarse en costes reales, no AOV aislado |
| Diagnóstico | Embudo de Meta y tienda | Baja señal y frecuencia de cambios | Brechas persona/ángulo/conciencia/diversidad | Distintos niveles: diagnóstico de funnel, decisiones de gasto y cobertura creativa |
| Datos de cliente | Métricas Meta/Shopify | Retención/cohortes/valor cliente | Reviews, comentarios y reputación | Fuente/permiso, minimización, representatividad, evitar unir identidades sin justificación |
| Metodología IA | Capturas/LLM con datos | Reportes sin cambios impulsivos | Reseñas y reputación como contexto LLM | RAG y retrieval con evidencias, idempotencia y distinción evidencia/hipótesis |
| Producción de vídeo | Menciones superficiales de formatos | Mención promoción de herramientas | No da guía audiovisual completa | Mantener GAP; no inventar un SOP de producción |

## Conflictos que Claude Code debe resolver explícitamente

1. V02 sugiere «copiar lo que funciona», V03 afirma que copiar es la peor estrategia: definir línea fina entre **patrones inspiradores** y **duplicación acrítica**.
2. V02 desaconseja awareness con poco presupuesto; V03 pide cubrir huecos de contenido TOFU: separar **objetivo de campaña** de **tema del anuncio**.
3. V01/V02 promueven variaciones de creativos, V03 critica producción sin estrategia: construir primero taxonomía y justificación, después ejecutar variaciones.
4. V02 subraya foco/nicho, V03 explora personas nuevas: compatibilizar **foco inicial en demanda rentable** y **expansión controlada**.
5. V03 sugiere nuevas personas a partir de comentarios: no confundir opinión de terceros con estadísticas representativas ni permitir inferencias sensibles.
6. V01/V02 hablan de rentabilidad publicitaria, V03 de aumentar AOV: validar **contribución incremental**, no ROAS ni AOV por separado.

## Regla de destino

Una fuente de verdad canónica por concepto, IDs versionados y referencias a las 3 fuentes; no hacer tres chunks casi iguales. La auditoría propone el destino, no lo ejecuta.
