# Auditoría de modelos y costes de IA

Actualizacion individual 29/10: A02 queda fijado a GPT-6.1 Terra, con GPT-6.1 Sol como fallback. La nueva comparacion de Overview cliente y Panel consultor usa datos reales de TEST e historico de seis meses: Terra 29/0/3 y Sol 30/0/2 (sin fallo detectado/fallos coincidentes/dudas); coste estimado por el par de lecturas: $0.084 Terra y $0.182 Sol. Esta decision sustituye el veredicto del 28/10 descrito en el historial. No son tarifas facturadas ni una prueba de API.

Fecha: 27/10/2026. Alcance: código local del workspace E-NORA, con cambios previos del usuario. Proveedores objetivo confirmados: Anthropic/Claude y OpenAI; cualquier modelo de sus catálogos puede evaluarse. Política objetivo: configuración de plataforma por agente; selección del usuario únicamente en el copiloto.

La página `/admin/auditoria-ia` contiene el inventario de 27 agentes, sus funciones, lecturas, candidatos y criterios de aceptación. Las recomendaciones están en `apps/web/src/app/admin/auditoria-ia/audit-data.ts`. Es una revisión de ingeniería, no un benchmark ni una certificación de producción. Los datos consultados desde la página pertenecen al entorno al que apunte su API.

## Cómo se resuelve hoy el modelo

Actualizacion individual 29/10: A01 sigue fijado a GPT-6.1 Sol. A02 fue reabierto por el propietario para una comparacion con datos historicos reales de la tienda y queda ahora fijado a Terra con fallback Sol; detalle y recibos en `docs/SEGUIMIENTO_LABORATORIO_IA_2026-10-27.md`.

- `apps/api/src/agent-schedule.ts`, `resolveAgentModel`: para la mayoría de agentes, configuración del cliente > plataforma > defecto. A02 y A29: plataforma > versión. A09 se resuelve por separado con selección, plan y saldo.
- El defecto de la mayoría es `gpt-6-luna`; el arquitecto de Mi camino usa `gpt-6-sol`. A02/A29 conservan el modelo de su versión si plataforma no fija otro.
- `apps/api/src/ai-runtime.ts`, `runAgentTurnWithFallbackCore`: selección explícita, activación por organización y fallback pueden afectar el resultado. La configuración exacta y el proveedor ejecutado se deben contrastar con los recibos de `agent_runs`.
- Las ejecuciones sin organización pueden seguir defaults de entorno y `AI_MODEL_ROUTING_JSON`; la auditoría no inspecciona sus valores desplegados.
- `apps/api/src/copilot-tokens.ts`: son elegibles Sonnet 5, Opus 5, Luna y Sol según plan/proveedor; el modo reducido continúa en Haiku 4.5. El comentario sobre «dos modelos elegibles» quedó desactualizado respecto a la lista.

## Hallazgos y orden de corrección

Corrección operativa A02 (28/10): la proyección de 4,33 ejecuciones/día omitía el panel del consultor. El desglose de planificación para una tienda con consultor es aproximadamente 4,34 de dashboards + 2 del panel = 6,34/día. Sol estima 12,58 USD/30 días, frente a Haiku 0,58–0,67, usando precios por vista y sin asumir hits de caché entre pasadas. No son costes API medidos: faltan ventanas 7/90, herramientas y tasa de fallos representativa. El cálculo, límites y consulta histórica se documentan en Seguimiento y aparecen tanto en Laboratorio como en Costes. La conclusión queda revisada a candidato de calidad, sin afirmar rentabilidad comercial ni asignar A02 todavía.

| Prioridad | Hallazgo                                               | Evidencia                                                                                        | Resolución propuesta                                                                                         |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Alta      | El modelo del cliente prevalece en muchos agentes      | `agent-schedule.ts`, `resolveAgentModel`                                                         | Política central por agente; retirar override global del cliente para especialistas; conservar selección A09 |
| Alta      | El simulador puede convertir un modelo a otro          | `ai-cost-model.ts`, `toKnownModel`; `costes-ia/page.tsx`, fallback `data.models[0]`              | ID exacto y tarifa desconocida visible, sin inventar un total completo                                       |
| Alta      | Runtime y simulador no comparten base de coste         | `provider-capabilities.ts`, `estimateCostUsd`; `index.ts`, `createTurnAccounting`; `cost-sim.ts` | Contabilidad por llamada, desglosada por proveedor, con creación/lectura de caché, salida y tramos           |
| Alta      | Sol/Luna con tools se ejecutan con razonamiento `none` | `packages/ai/src/index.ts`, `runAgentTurnOpenAI`, `requestBase`                                  | Evaluar adaptador Responses para razonamiento con herramientas                                               |
| Media     | Catálogos de precios, capacidades y selección divergen | `MODEL_PRICING`, `MODEL_CAPABILITIES`, `AGENT_MODEL_IDS`                                         | Unificar catálogo y verificar modelos nuevos, SDK y formatos                                                 |
| Media     | Media de 30 días o línea base de pruebas no segmentada | `ai-cost-model.ts`, `MIN_MEASURED_RUNS`, `BASELINE`                                              | p50/p95 por modelo, versión, cliente, llamadas y tipo de ejecución                                           |
| Media     | Respaldo asimétrico entre proveedores                  | `ai-runtime.ts`, rama `selectedModelOverride.startsWith("gpt-")`                                 | Política de fallback por agente, intentos y gasto acumulado verificables                                     |
| Media     | Coste de tokens no equivale al coste completo del SaaS | `ai-cost-model.ts`, `ai-model-pricing.ts`                                                        | Separar IA, infraestructura y operación; reconciliar facturas                                                |

En Anthropic, `input_tokens` no incluye la lectura ni creación de caché, que el adaptador registra aparte. La fórmula actual solo recibe entrada y salida: no basta con aplicar un descuento genérico; debe respetar las definiciones de uso de cada proveedor. La tarifa dinámica carga solo entrada y salida en memoria aunque la tabla también tenga precio de caché. El simulador tampoco modela creación de caché ni tramos largos.

El perfil A20 de pruebas acumula 446.049 tokens de entrada por ejecución. No significa necesariamente una sola petición de ese tamaño: puede sumar varias llamadas. Optimizar consultas, agregaciones y segmentación antes de decidir el modelo. No asumir que cambiar de proveedor mantiene el tokenizador o el acierto de caché.

## Selección por función

Las 27 fichas de la página distinguen extracción, análisis causal, estrategia, visión y conversación. Primera tanda propuesta:

- A01, A04, A15: comparar Haiku 5.5 y Luna; añadir Terra en visión.
- A02 y A29: comparar Sonnet 5.5 y GPT-6.1 Sol con evidencias y abstención.
- A20: reducir lectura y después comparar coste por resultado útil.
- Arquitecto de Mi camino: base Sonnet/Sol, comparar Opus y Astra. Fable es un candidato adicional si los anteriores no cumplen calidad.
- A09: preservar selección del usuario según plan y saldo, probando todas las opciones y el modelo realmente ejecutado.

No se afirma que estos sean los ganadores. Antes de activar: verificar acceso de cuenta, imágenes, tools, salida estructurada, streaming, razonamiento, timeout y presupuesto. Comparar un conjunto fijo de casos anonimizados, incluidos datos ausentes y contradictorios; medir calidad humana, errores críticos, p95 de latencia, retries y coste facturado por resultado aceptado. Aprovechar los datasets y controles de release existentes.

## Fuentes oficiales consultadas

- [Claude: catálogo](https://platform.claude.com/docs/en/models/overview).
- [Haiku 5.5: capacidad y tarifas por longitud](https://platform.claude.com/docs/en/models/haiku-5-5/overview).
- [Sonnet 5.5: tarifas y compatibilidad](https://platform.claude.com/docs/en/models/sonnet-5-5/overview).
- [Opus 5.5: tarifas y compatibilidad](https://platform.claude.com/docs/en/models/opus-5-5/overview).
- [Haiku 4.5: modelo reducido actual](https://platform.claude.com/docs/en/models/haiku-4-5/overview).
- [OpenAI: catálogo](https://developers.openai.com/api/docs/models), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [tarifas](https://developers.openai.com/api/docs/pricing).

La calculadora ilustrativa usa tarifas Standard directas de Claude 5.5, fecha de revisión explícita y los dos tramos de Haiku. Permite comparar entrada nueva, caché ya disponible y salida. Excluye creación de caché, herramientas facturables, retries, impuestos, descuentos y otros costes del SaaS. Rechaza entradas imposibles y no presupone que una media por ejecución sea una petición válida.

## Cambios entregados y límites

- Nueva página de solo lectura, enlazada desde el menú del administrador y protegida con `PlatformAdminShell`; reutiliza los endpoints administrativos existentes.
- La API de Costes incorpora `version_model` y `runtime_default_model` para mostrar IDs exactos sin pasar por la conversión del simulador. No se altera el comportamiento de los agentes ni las asignaciones guardadas.
- Tarifas guardadas y fecha de comprobación se muestran aparte de las fuentes oficiales de candidatos. Los errores de consulta permanecen visibles y no borran la revisión estática.
- Se comprueban cálculos de tramos, caché, límites y unicidad del inventario; se ejecutan también las pruebas del simulador existente.
- La sesión de navegador disponible es de cliente: confirmó el rechazo de acceso a esta ruta. No se acredita revisión visual completa de administrador en escritorio/móvil ni consulta de overrides de cada cliente.
- No se ejecutaron generaciones de pago, cambios de modelos, escrituras en base de datos ni despliegue. La contabilidad y el routing señalados siguen pendientes de corrección; esta entrega los hace revisables antes de cambiar comportamiento.

Validación realizada: seis pruebas aprobadas (cuatro de la nueva comparativa/inventario y dos del simulador existente), ESLint dirigido sin errores y TypeScript del frontend sin errores. TypeScript de API encuentra un error fuera de esta entrega en `apps/api/src/camino-routes.test.ts:13` (`Object is possibly 'undefined'`); no se modifica ese trabajo previo del usuario.

## Continuación: laboratorio de seis modelos

Se creó `/admin/laboratorio-ia` y una página por agente. El estado, los resultados disponibles, las cuotas y los pasos para continuar están en [SEGUIMIENTO_LABORATORIO_IA_2026-10-27.md](SEGUIMIENTO_LABORATORIO_IA_2026-10-27.md).

Se corrigieron en código la precedencia del modelo del cliente sobre los especialistas, la sustitución silenciosa de modelos al simular costes, la tarifa de respaldo de Sol, las entradas de capacidades de Sol/Luna y el contrato JSON estricto de propuestas. Se mantiene la selección del copiloto. El laboratorio no elige automáticamente modelos de producción y ninguna corrección se ha desplegado.

# Revisión individual: A01 Analista de llamadas (28/10/2026)

**Estado vigente: cerrado y asignado a GPT-6.1 Sol por decisión del propietario.** El ID exacto `gpt-6.1-sol` está fijado en la política compartida del runtime y administración; usa Responses API con herramientas, salida estructurada y razonamiento medio. El laboratorio, auditoría y Costes de IA muestran la decisión cerrada. Costes usa referencia CLI de 60 minutos y escenarios de 30/60/120 minutos, con precio Standard de Sol de 2 USD/MTok de entrada, 0,10 USD/MTok de caché leída y 10 USD/MTok de salida. Los límites de contexto de A01 se amplían para reuniones largas y una entrada recortada se rechaza antes de generar. El registro siguiente conserva el análisis previo al cierre; sus frases de asignación pendiente quedan superadas.

**Ampliación posterior:** la revisión de todos los campos encontró errores que los 14 controles de referencia no cubrían (señales, huecos, citas y alcance de tareas). Sol queda como candidato para las tres duraciones; Opus no es una referencia de calidad máxima porque sus señales mezclan compromisos del cliente y del consultor. Véanse los resultados, limitaciones y propuesta de asignación en [la segunda evaluación por campos](SEGUIMIENTO_LABORATORIO_IA_2026-10-27.md#a01-segunda-evaluación-de-los-14-campos-28102026). La matriz detallada y la propuesta por duración están en la ficha de A01.

**Limitación de la evidencia:** la muestra positiva inicial tenía cuatro intervenciones, y la recomendación inicial de Sol/Astra fue demasiado firme. Después se añadieron las pruebas largas y la revisión de campos. Los ensayos CLI sintéticos no acreditan facturación API ni constituyen una evaluación humana independiente.

Para explorar reuniones largas se añadieron tres conversaciones sintéticas de 30, 60 y 120 minutos nominales, con seis interlocutores y 14 criterios congelados antes de las ejecuciones. Son variaciones de una misma plantilla, con eventos de control distribuidos por el diálogo. No representan grabaciones reales, diversidad natural entre reuniones, calidad de transcripción ni diarización.

Los seis modelos cumplieron el contrato JSON nativo en los tres tamaños (18/18). Dos revisores automáticos, Sol y Sonnet, evaluaron a ciegas 42 comprobaciones por modelo. Opus y Sol coincidieron en 42/42; Sonnet, 41/42; Astra, 41/42; Haiku y Luna, 40/42 cada uno. No hubo fallos coincidentes; seis comprobaciones quedaron como dudosas por desacuerdo entre revisores. Parte del arbitraje usa Sol, que también es candidato, por lo que estas cifras no son una evaluación humana independiente.

En duración CLI, Sonnet fue rápido en esta plantilla (24–26 s), Luna también (19–32 s), Opus tardó 50–55 s y Sol 57–66 s. Opus y Sol tuvieron la misma cobertura de referencia; Sol produjo una respuesta más concisa y Opus más extensa. En 120 min, la estimación API calculada a partir del uso registrado y las tarifas públicas es de 0,1293 USD para Sol, 0,3672–0,5092 para Opus y 0,0122–0,0158 para Haiku; el rango de Claude depende de la duración de la escritura de caché (5 min o 1 h). Haiku a 30 min muestra una discrepancia: la CLI informa 0,0265 USD y la estimación API da 0,1147–0,1327 USD, ya que el uso registrado supera 100.000 tokens y aplica la tarifa de contexto largo. La pantalla separa ambas cifras y enlaza las tarifas de [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) y [OpenAI](https://developers.openai.com/api/docs/pricing). Los importes son estimaciones, no facturas. Sol/Luna/Astra no exponen en el recibo el ID realmente servido. Cada salida pasó el esquema, pero la referencia cubre 14 hechos y condiciones conocidos: no prueba que se capturase todo lo relevante en una reunión espontánea.

Tras ampliar la revisión a todos los campos y recibir la decisión explícita del propietario, A01 queda cerrado y asignado a GPT-6.1 Sol para todas las duraciones. Opus conserva buen control de hechos, pero la nueva revisión detectó errores en sus señales; no se presenta como techo de calidad. La selección está aplicada en código y en las pantallas de administración. Se conservan las limitaciones de la evidencia sintética y los costes estimados: no se ha realizado generación API de pago ni se ha medido audio.
