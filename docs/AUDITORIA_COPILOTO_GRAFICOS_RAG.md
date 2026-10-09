# Auditoría del copiloto: preguntas sobre gráficos y RAG

## Alcance

Revisión estática de los disparadores `useCopilotAsk` (17 archivos de pantallas), del contexto enviado al turno A09 y de la recuperación de conocimiento compartida con otros agentes. No es una medición de calidad sobre conversaciones de clientes reales.

## Hallazgos

| Prioridad | Hallazgo | Evidencia | Consecuencia |
| --- | --- | --- | --- |
| Alta | El botón de un gráfico envía texto libre, pero no una referencia estructurada al punto seleccionado. En Meta, la pregunta del día incluye la fecha mostrada como `dd mes`, sin año ni valor del punto. | `apps/web/src/app/meta/insights-sections.tsx` (`askAboutDay`, `daily_roas`, `daily_spend`) | El agente tiene que reconstruir qué dato vio la persona y puede analizar otra fecha, ventana o cifra. |
| Alta | `focusLabel` se muestra en el panel, pero no viaja como dato estructurado al backend. Las fichas de producto, campaña, promoción y email añaden nombre y periodo al texto de la pregunta, sin un `entity_id` tipado. | `apps/web/src/components/copilot-ask.tsx`, `apps/web/src/components/copilot-panel.tsx`, fichas `*/[id]/page.tsx` | La pregunta puede ser ambigua si hay nombres repetidos o cambian los filtros. |
| Alta | `view_context` solo incluye ruta, título, tienda, periodo, hasta 12 métricas de resumen y notas. No transporta la serie ni el punto del gráfico. El backend lo identifica correctamente como contexto no verificado. | `apps/web/src/components/copilot-panel.tsx` (`toViewContext`), `apps/api/src/ai-runtime.ts` (`sanitizeChatViewContext`), `apps/api/src/decision-playbook-chat-context.ts` | Las cifras visibles pueden faltar y ninguna cifra enviada por el navegador debe usarse como prueba sin consulta al servidor. |
| Media | El RAG devuelve hasta 8 fragmentos, con candidatos ampliados y reranking opcional. La función SQL híbrida ordena documentos activos, pero no tiene un umbral de «no hay evidencia». | `apps/api/src/ai-runtime.ts` (`search_knowledge`), `apps/api/src/knowledge.ts` (`executeKnowledgeSearch`), `supabase/migrations/20260910120000_ai_04_retrieval_espanol_y_rrf.sql` | Una pregunta fuera del corpus puede recibir fragmentos irrelevantes. |
| Media | La evaluación histórica de retrieval usa seis documentos de temas distintos y una pregunta por documento. No representa el corpus de clientes ni valida la respuesta, las citas o las preguntas sobre un punto del gráfico. | `apps/api/src/eval-ai04-rag-retrieval.ts` | El 6/6 histórico de Recall@3/8 no estima la calidad actual del copiloto. |

## Qué hacer

1. **Contrato de pregunta contextual.** Añadir al evento del botón una referencia tipada: `source`, `entity_type`, `entity_id`, `metric_key`, fecha ISO, ventana, tienda y filtros. El backend debe resolverla dentro del tenant y recuperar los valores autorizados. El valor visible puede viajar para facilitar la interfaz, pero la fuente de verdad debe ser la consulta del servidor.
2. **Evidencia antes de respuesta.** Para preguntas sobre gráficos, cargar el punto, la serie vecina, cobertura, moneda y fecha de actualización de forma determinista. Usar `search_knowledge` para metodología y reglas, no para sustituir datos de Meta, Shopify o Klaviyo. Si faltan datos, el copiloto debe decirlo.
3. **Evaluación en tres capas.** (a) recuperación documental con Precision@k, Recall@k y preguntas sin evidencia; (b) identificación del gráfico y sus datos; (c) respuesta final con cifras, periodo, fuente y abstención correctos. Etiquetar casos reales por tipo de botón y por tenant de prueba.
4. **Prioridad de implantación.** Empezar por los gráficos diarios de Meta y las fichas de campaña/producto, que muestran la ambigüedad más concreta. Extender el mismo contrato a los demás botones sin crear formatos distintos por pantalla.

## Implementación posterior a la auditoría

- Todos los botones que usan `useCopilotAsk` pasan por `CopilotAskProvider`, que adjunta `evidence_reference` con ruta, sección, tienda, filtros y periodo. Las fichas de campaña Meta, producto/promoción Shopify y email Klaviyo, los flows seleccionados y las piezas de marketing guardadas incluyen el identificador de entidad. Una pieza del estudio aún sin guardar usa referencia de sección. Los dos gráficos diarios de Meta incluyen métrica, fecha ISO y ventana; no envían como prueba el valor visible.
- Los endpoints JSON y streaming del copiloto aceptan el mismo contrato. El servidor valida su forma y que la tienda coincida con la seleccionada, vuelve a consultar los detalles autorizados y, para los puntos de Meta, recupera siete días alrededor. Comprueba por separado si existen filas originales porque `meta_performance_daily` rellena huecos con cero. Comunica ausencia de datos y moneda desconocida o mezclada.
- El contexto del modelo distingue la evidencia de proveedores de `search_knowledge`, reservado para documentos y metodología. Las referencias de sección orientan la pregunta, pero no certifican cifras. Los botones sobre otras series que se añadan deberán incorporar una clave de métrica tipada y un resolutor del proveedor correspondiente antes de presentar sus puntos como evidencia verificada.
- `copilot-quality-evals.ts` puntúa por separado la identificación de gráfico (fuente, entidad, métrica, fecha, periodo y tienda) y los hechos, fuentes y citas de la respuesta. Sus pruebas usan casos etiquetados sintéticos. Para medir calidad real faltan casos revisados por humanos de cada pantalla, incluyendo periodos con huecos, monedas mixtas y preguntas que exijan abstenerse.

## Evaluación incorporada

`apps/api/src/rag-retrieval-metrics.ts` calcula Precision@k, Recall@k y rango recíproco a nivel de documento. `eval-ai04-rag-retrieval.ts` incluye preguntas de uno y varios documentos y presenta P@1, P@3, R@3, R@8 y MRR. Es un banco sintético para detectar regresiones técnicas; **no produce una puntuación de producción** ni cubre la exactitud de cifras de gráficos. El caso sin evidencia sigue siendo informativo hasta contar con criterios de relevancia y abstención etiquetados.
