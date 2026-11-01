# A06: revisión con contexto runtime real

31/10/2026. Solo A06. Organización Prueba Borrego / E-NORA Demo TEST.

## Contexto y método

Caso `a06_planificador_stock:real-store-runtime-2026-10-31`. Se capturó el prompt final y los bloques exactos preparados por `runStockPlannerAgent`, mediante el hook interno `beforeModel`, que impidió la llamada API LLM. Captura `f3693829-f42a-4a67-8066-e28d21206265`. No se eligieron herramientas dinámicamente en la simulación CLI.

El snapshot tiene 39 bloques y unos 59.918 caracteres: ventas de 30 días, doce semanas cuando están observadas, ocho productos con demanda, inventario por variante/ubicación, marca/contexto de la tienda, tareas e hitos y dos propuestas anteriores pendientes. La fuente incluye datos de demostración de TEST; es el contexto real de la aplicación de pruebas, no demanda validada de un comercio real. Se probaron Haiku, Sonnet, Opus, Luna, Sol y Terra; Astra excluido.

## Resultados

Los seis cumplen el contrato, usan UUID de productos recibidos y no duplican las propuestas pendientes de Bruma/Arena. No se compró ni creó una tarea automáticamente.

| Modelo | Tareas propuestas | Hallazgos | CLI segundos | Referencia USD/30 revisiones sin caché |
| --- | ---: | ---: | ---: | ---: |
| Haiku 5.5 | 2 | 9 | 89,4 | 0,44 |
| Sonnet 5.5 | 2 | 6 | 55,3 | 7,25 |
| Opus 5.5 | 3 | 9 | 85,3 | 10,18 |
| Luna | 2 | 6 | 21,5 | 0,15 |
| Sol | 6 | 20 | 143,9 | 5,44 |
| Terra | 4 | 9 | 37,0 | 1,94 |

Precios calculados con tarifas internas de referencia del 28/10/2026 y los tokens informados por CLI, convirtiendo el perfil a ausencia de caché. Incluyen el volumen de esa CLI, que puede tener formato/razonamiento/overhead diferente de API. No son tarifas verificadas de nuevo hoy, factura ni predicción exacta del consumo de producción. Latencia CLI tampoco acredita latencia API. Anthropic acredita el modelo mediante el recibo; Codex JSONL no acredita el ID servido.

Se mantiene Haiku para la rutina y Sol de respaldo de mayor capacidad y otro proveedor. Haiku cubre los ocho riesgos y propone Arcilla/Boreal, los dos más urgentes sin revisión pendiente. El resto queda en seguimiento. Sus defectos se conservan: usa el plazo del hito interno de preparación en el resumen y rellena `source_flow_refs` con etiquetas inaplicables; este campo se ignora en la entrega actual de stock.

Sonnet ofrece la lectura más compacta y prudente, pero su volumen CLI es bastante más caro. Terra es una alternativa equilibrada y sus revisiones adicionales de Cargo/Camiseta son razonables; omite advertir la repetición de las cuatro últimas semanas. Las seis tareas de Sol también están justificadas, con prioridades diferentes: no se penaliza su cantidad; sí la repetición de veinte hallazgos entre riesgo y escenario por producto.

Luna habla de cuatro productos con menos de ocho días, aunque la fuente contiene cinco (1,3; 2,3; 2,4; 5,6; 7), y usa confianza alta. Opus atribuye sin evidencia individual la ausencia de los agotados a que no tuvieron ventas. Una sola respuesta por modelo no permite presentar porcentajes de precisión ni un ganador universal.

## Frecuencia y coste

`platform_ai_agent_settings.runs_per_day` es null: se conserva la cadencia de diseño, una revisión diaria si cambia la actividad. Cliente y consultor leen el mismo resultado; abrir ambas vistas no genera dos llamadas.

El piloto de eventos de esta tienda sigue `shadow`, umbral de revisión de cobertura de 3 días, cooldown de 15 minutos y cap configurado de 4 llamadas adicionales/día si se habilitara `live`. En shadow no llama al LLM. La observación y la base de datos siguen consumiendo infraestructura. Treinta revisiones mensuales es una hipótesis comparable; los eventos live, manuales, reintentos y futuras variaciones de contexto se sumarían.

El perfil compartido de costes de A06 ahora usa 31.165 tokens de entrada y 23.334 de salida CLI, sin asumir caché. Conserva Haiku/Sol en código y en las pantallas que leen esa política.

## Fallos corregidos y UI

- La revisión periódica/manual omitía propuestas pendientes, aunque el modo de eventos sí las consultaba. Ahora ambos leen las pendientes y fallan si no pueden comprobarlas. La captura real incluyó dos pendientes y los seis modelos evitaron repetirlas.
- El bloque de lectura A06 en Shopify estaba limitado a consultores. Ahora cliente y consultor tienen la lectura completa en Dashboard > Shopify > Stock.
- Evitar duplicados no puede ocultar las propuestas anteriores: la API entrega las pendientes del agente/tienda aunque procedan de otro diagnóstico o periodo; WorkQueue las reúne y deduplica por output. Se verifica que las antiguas Bruma/Arena y las nuevas Arcilla/Boreal sigan disponibles.
- El hook interno de preparación permite capturar el prompt final y contexto de un diagnóstico antes del modelo. Los callers anteriores que no usan sus argumentos conservan el comportamiento.

Run compartido `1d581e89-81cf-432d-8cb1-7940f1873beb`, output `5cfca320-5109-41d5-b3e9-86a6c96762b9`, `pending_approval`, modelo Haiku, origen `cli-lab:a06-real-store-2026-10-31`, coste API LLM null. No se aprobaron propuestas. El inspector verifica con las cuentas reales de cliente y consultor el mismo output y dos outputs pendientes, con dos propuestas cada uno. La lectura de permisos/payload no equivale a captura visual autenticada.

Artefactos: `a06-real-store-review.json` en el laboratorio local y los resultados completos del caso. El laboratorio abre por defecto este caso real para A06 y la auditoría explica la comparación y sus límites. Se mantienen las simulaciones históricas para contraste.

Verificación: 20 pruebas de reglas/evidencia, build de contratos, revisión del contrato y UUID/deduplicación de las seis respuestas e inspección compartida de cliente/consultor. Las comprobaciones TypeScript y health del servidor se registran al terminar. El código requiere despliegue para producción; este trabajo no activó eventos live.

Cierre de comprobaciones: typecheck API/web correctos, API local reiniciada y health/dashboard HTTP 200. Relectura idempotente con ambos accesos: mismo output seleccionado y dos outputs pendientes conservados. No hubo llamada API LLM, compra ni aprobación automática.
