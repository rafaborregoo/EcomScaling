# A13 · operativa de Shopify · 3 de noviembre de 2026

Se selecciona **GPT-6.1 Sol**, con **GPT-6.1 Terra como fallback de modelo**. Terra es el segundo candidato observado, más económico y menos detallado. Ambos pertenecen a OpenAI: este fallback responde a rate limit/timeout/indisponibilidad de modelo antes de consumo; no cubre caída completa, autenticación o falta de saldo de OpenAI.

## Alcance y resultado

A13 prioriza la operativa de Shopify usando ventas, pedidos, ticket, finanzas, stock, embudo, objetivos, Camino aprobado, tareas e historial de especialistas. Usa 30 días y periodo anterior para la lectura operativa; el objetivo mensual se mide con el mes natural correspondiente. No compra, cambia anuncios, crea reposiciones ni ejecuta las tareas que propone.

Resultado de Sol: tres hallazgos (stock crítico, pedidos que crecen más que ventas/ticket, noviembre por debajo del ritmo del plan), sin tareas nuevas porque las propuestas y tareas vigentes ya cubren stock, oferta y cesta. Cliente y consultor lo consultan en **Shopify → Resumen → A13 · Operativa de Shopify**, `/shopify#shop-pendiente`. Se retiró la condición que ocultaba esta lectura al cliente; el botón de actualización manual sigue siendo del consultor.

## Fallo importante corregido

El caller de A13 entregaba al calculador de progreso cifras de treinta días, mientras este esperaba una ventana de siete. Al normalizarlas a mes, transformaba **49.723,80 EUR en 216.227,50 EUR** y marcaba la meta como alcanzada. No era un error aritmético de los modelos: era contexto incorrecto del backend.

La primera tanda de seis modelos se archiva explícitamente y queda excluida del veredicto, con respuestas y consumo conservados. Se añadieron lecturas separadas de ventas/finanzas del **mes natural actual** y del mes anterior completo, siempre por organización/tienda. La nueva medición observa **3.847,10 EUR del 1 al 3 de noviembre**, frente al ritmo de referencia acumulado del plan de **7.500 EUR**: estado `at_risk`, no `achieved`. No garantiza cierre mensual ni atribuye una causa. El baseline histórico del plan conserva su procedencia y límites; no se reescribió la meta aprobada.

Implementación: `apps/api/src/a13-goal-period.ts` y caller de `runOperativaShopifyAgent`. Prueba de regresión: las cifras de treinta días no pueden convertirse en una observación de siete ni sustituir la lectura de mes natural. Se conserva la lectura operativa de treinta días como contexto separado.

## Comparación válida: seis modelos, mismo snapshot

Diecisiete bloques del runtime, histórico y tareas de E-NORA Demo. **Datos de demostración persistidos en TEST**, no actividad comercial real. Caso válido `a13_operativa_shopify:real-store-runtime-2026-11-03-calendar`, una salida por modelo, sin Astra. Los seis cumplen el contrato nativo.

| Modelo | Evaluación observada | USD sin caché/ejecución | USD por 60 ejecuciones |
|---|---|---:|---:|
| Haiku 5.5 | Útil tarea de costes y evita repetir stock; referencias de flow inaplicables, plazo antiguo y un recuento de clientes incorrecto | 0,0121592 | 0,729552 |
| Sonnet 5.5 | Cifras/ritmo correctos; duplica parcialmente reposición y asume política de envío gratis por un cobro registrado cero | 0,109692 | 6,58152 |
| Opus 5.5 | Mucho detalle; repite trabajo de stock y prescribe cantidades sin plazo/campaña verificados | 0,325908 | 19,55448 |
| Luna | Muy barato; lectura casi solo de stock, duplicación y recomendación de tramitar reposición sin suficiente contexto | 0,0045154 | 0,270924 |
| **Sol** | Mejor cobertura observada de ventas/ticket, stock y meta; prudente y sin duplicar tareas | **0,102828** | **6,16968** |
| **Terra** | Prioridades correctas y sin duplicados; deja fuera evolución de ventas y ticket | **0,046365** | **2,7819** |

No se penaliza proponer más tareas. Se contrasta si están justificadas, aportan trabajo nuevo y respetan responsables, hitos y límites. Aquí la diferencia de Sol/Terra consiste en no repetir el trabajo ya cubierto; las otras propuestas se conservan con notas sobre duplicación o supuestos, no se eliminan.

La revisión es retrospectiva por el asistente, no un panel humano independiente. No se prueban herramientas dinámicas ni API pagada. Claude confirmó sus IDs; Codex no informa el ID servido, por lo que no se presenta como verificado. Una muestra no demuestra superioridad universal.

## Coste y frecuencia

Referencia Sol: 43.639 tokens de entrada y 1.555 de salida de CLI. Sin asumir caché: **0,102828 USD/ejecución**, **3,08484 USD** si hay 30 lecturas de tienda y **6,16968 USD** si se añaden otras 30 organizativas. Son estimaciones API, no factura. El orquestador evalúa actividad, antigüedad, cupos y presupuesto; no garantiza 60 ejecuciones. Más tiendas, peticiones manuales y reintentos cambian el gasto. Ver el mismo diagnóstico en cliente/consultor no duplica generación.

La decisión compartida actualiza runtime, Costes, contador de agentes cerrados y laboratorio. La comparación abre por defecto el caso corregido y conserva el anterior como archivado. Los diagnósticos sin propuestas se leen sin aprobación; las futuras tareas siguen requiriéndola.

## Evidencia y verificaciones

- `.e-nora-test-lab/a13-real-2026-11-03/review.json`: comparación y costes.
- `.e-nora-test-lab/a13-real-2026-11-03/visibility.json`: verificación autenticada terminada de cliente y consultor: mismo run `68d233d7-aaf9-4665-ad70-27c3f9482323`, output `fbcb8ebf-9ad6-4c0b-a118-53d08b16b78f`, tres hallazgos y cero tareas; lectura sin aprobación. Página Shopify HTTP 200.
- `scripts/a13-capture-real-store.mts`, `a13-review-real-store.mts`, `a13-share-and-verify-real-store.mts`: reproducción idempotente.
- Diez pruebas focalizadas conjuntas de ficha, seguridad, prioridad de modelos y calendario A13 correctas; además seis pruebas existentes del cálculo de progreso correctas.

Build de contratos, typechecks API/web y ESLint dirigido de las pantallas nuevas/A13 correctos. La ficha anterior de email conserva un aviso de lint preexistente sobre un efecto; no hay errores de lint en las comprobaciones dirigidas.

Sin compras, nuevas tareas ni cambios Shopify. Sin migraciones o despliegue remoto; cambios en código y TEST/local. Inspección visual de navegador pendiente porque su host de acceso no está disponible.
