# Limpieza y nueva planificación A05

31/10/2026. Solicitud expresa del propietario y aclaración: solo NORA y base de datos TEST; no eliminar en Klaviyo externo.

## Limpieza definitiva

Proyecto `kopcblejsxpkxoykldyh`, organización Prueba Borrego (`5ebc7b02-ca86-402e-bd61-9abd22f1ee04`), propietario verificado `borregorafa99@gmail.com`. Antes de borrar se comprobó la identidad y que no hubiera ejecuciones de marketing en curso. La operación fue transaccional y quedó limitada a esa organización.

Se eliminaron 25 borradores de NORA, sus versiones/notas y registros de generación/exportación/edición asociados; 3 calendarios y sus 2 acciones; 1 secuencia de mailing con sus checkpoints y entregables; 2 diseños de flow; 32 ejecuciones/propuestas anteriores A05/A11/A27/A28 con sus dependencias. La comprobación posterior devolvió cero borradores, calendarios, acciones, secuencias y diseños de flow. No se guardó una copia del contenido eliminado.

Se conservaron marca, productos, ventas, métricas históricas, integraciones y las copias sincronizadas de lo que sigue existiendo en Klaviyo/Meta. Por tanto, los 13 borradores externos de email pueden seguir apareciendo en la UI y forman parte del contexto para evitar duplicarlos. No son borradores de NORA conservados por error. Las comparaciones históricas locales del laboratorio siguen existiendo fuera de la base de datos de la cuenta.

## Ejecución nueva

Se preparó contexto con `runCampaignStrategist`, detenido mediante `beforeModel` antes de la API LLM. El arnés añadió lecturas reales de marca, rendimiento, medición, entregabilidad, contenido histórico y catálogo. Fuente: `f222408f-cca9-4f18-a02e-4430876a5e5b` (captura, no llamada LLM). La primera simulación se detuvo porque el arnés filtraba una conexión Shopify en estado syncing y omitía el catálogo. Se corrigió el filtro para igualar el runtime y se incorporaron 25 productos observados antes de repetir.

Caso válido: `a05_estrategia_campanas:clean-runtime-v2-2026-10-31`. Sol solicitado por Codex CLI; JSON nativo válido. Duración CLI: 166.785 ms. Tokens registrados: 91.213 entrada, 6.425 salida, cero caché informada. No es una factura API y JSONL no acredita el ID servido; `model_verified=false`. Las lecturas fueron preseleccionadas por el arnés y no prueban selección dinámica de herramientas por el modelo.

Resultado conservado sin editar: 3 iniciativas y 4 mensajes Email, confianza baja y requisitos explícitos.

| Fecha | Propuesta |
| --- | --- |
| 12/11/2026 | Cinco colores, una elección informada |
| 27/11/2026 | Selección de Black Friday con disponibilidad comprobada |
| 10/12/2026 | Un regalo que deja elegir |
| 22/12/2026 | Qué comprobar antes de regalar una tarjeta |

Todas las horas son propuestas a las 10:00 America/New_York, según la configuración de la tienda, no una optimización horaria para ES. Dos propuestas replantean borradores externos existentes; el resto depende de preparación y audiencias válidas. No se aprobó, programó, envió ni exportó contenido.

La diferencia entre 15 campañas del proveedor y 14 de email corresponde al alcance por canal, no prueba pérdida de datos. El modelo advierte esa diferencia sin disponer de una etiqueta suficientemente clara; se han aclarado los nombres de cobertura de la herramienta para próximas lecturas. El JSON original se mantiene.

## Cuenta y UI

Run compartido `f087aaed-f67b-4ec2-9754-1bfd22ef6b6b`; output `4a361ea7-d8f6-4340-a14c-7448f2b17c9d`, estado `pending_approval`, origen `cli-lab:a05-clean-v3`, modelo solicitado `gpt-6.1-sol`, coste API LLM nulo. Se guardó el contexto redactado que recibió la CLI, sin sustituirlo por otro snapshot.

`scripts/a05-verify-shared-plan.mts` comprobó usando los accesos reales de cliente y consultor que `getCampaignPlanProposal` devuelve el mismo output, contenido válido y las cuatro acciones. Ruta: `/marketing?section=campanas`, seleccionando E-NORA Demo. La comprobación del acceso y payload no equivale a una captura visual autenticada de navegador.

El Laboratorio IA abre por defecto el caso nuevo de contexto runtime completo para A05. Las respuestas anteriores se conservan únicamente como comparaciones históricas del laboratorio.
