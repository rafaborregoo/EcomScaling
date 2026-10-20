# Auditoría del agente de stock y diseño de reposición útil

Fecha de revisión: 19 de octubre de 2026, Europe/Madrid. Alcance: lectura del código y migraciones presentes en el workspace; pruebas unitarias locales existentes. No se ejecutaron agentes, sincronizaciones, llamadas a proveedores ni escrituras remotas. No se inspeccionó la configuración real de producción.

## 1. Dictamen

El objetivo es factible: **“Sudadera, quedan 30 unidades. Al ritmo previsto terminarías Black Friday con 6; durante la semana siguiente te quedarías sin existencias. Prepara una reposición de 30 para recibirla antes del 27 de noviembre.”** Esa frase necesita un cálculo verificable por variante/ubicación, una campaña confirmada y sus supuestos, entradas de mercancía y plazo de entrega. Una redacción más convincente del agente actual no basta.

E-NORA ya cruza ventas e inventario, calcula cobertura descriptiva, contiene una previsión reciente determinista y protege la creación de tareas frente a datos obsoletos y duplicados. Pero **A06 hoy prioriza revisiones de reposición; no calcula un pedido ni una proyección de campaña de extremo a extremo**. El propio código prohíbe inventar cantidades de compra, proveedor y plazos que no tiene.

El HTML aportado por el usuario es una observación de una salida anterior, no evidencia de la situación actual del inventario. Su stock tenía unas 99,9 horas de antigüedad: entonces era correcto abstenerse de afirmar una rotura actual. El problema de producto consiste en mostrar cuatro párrafos de limitaciones y contexto en lugar de una incidencia breve con acceso a corregir la sincronización. No se puede concluir que Sudadera tenga hoy 25, 30 o cualquier otra cantidad sin lectura reciente.

## 2. Cómo se ha verificado

Se usó primero `search_graph`, `trace_path` y `get_code_snippet` del proyecto `E-NORA`. El grafo devolvió ubicaciones obsoletas: el snippet de `runStockPlannerAgent` contenía ahora código del planificador de mailing. Todas las conclusiones siguientes se confirmaron en los archivos actuales. Los números de línea son de esta copia y pueden variar con cambios posteriores.

Hay migraciones con nombres que incluyen noviembre/diciembre de 2026, posteriores a la fecha de esta auditoría. Se tratan como **artefactos presentes en el repositorio**, sin asumir que estén desplegados ni activos. En particular, una migración registra A06 v11/v12 como versiones inactivas. Para cerrar una auditoría de ejecución hay que comparar versiones, migraciones y grants reales en un entorno autorizado.

## 3. Flujo existente y piezas aprovechables

1. `runStockPlannerAgent` exige membresía y resuelve tienda estrictamente antes de generar un análisis: [ai-runtime.ts:12618](../../apps/api/src/ai-runtime.ts#L12618).
2. Carga resumen agregado, cruce producto/ventas/inventario, calendario, tareas cerradas, Camino y configuración de mercados: [ai-runtime.ts:12644](../../apps/api/src/ai-runtime.ts#L12644).
3. El cruce específico A06 devuelve producto, SKU agregados, ventas, días con ventas, pedidos, variantes y cantidades. La definición local más reciente usa la **lectura más antigua** entre existencias incluidas para la frescura: [20261228110000_a06_oldest_inventory_freshness.sql:59](../../supabase/migrations/20261228110000_a06_oldest_inventory_freshness.sql#L59). Una variante sin mapear, gestionar, cantidad o sincronización invalida el total fiable.
4. Enriquece con puertas transparentes: periodo mínimo 14 días, al menos 5 unidades y 3 días con ventas; inventario completo con lectura de hasta 48 horas; una fecha futura de más de 5 minutos no se acepta: [stock-risk-evidence.ts:3](../../apps/api/src/stock-risk-evidence.ts#L3), [stock-risk-evidence.ts:65](../../apps/api/src/stock-risk-evidence.ts#L65).
5. Carga hasta doce semanas completas para candidatos, sin convertir semanas ausentes en demanda cero: [ai-runtime.ts:12717](../../apps/api/src/ai-runtime.ts#L12717). Ordena por cobertura y entrega al modelo hasta 12 productos: [ai-runtime.ts:12763](../../apps/api/src/ai-runtime.ts#L12763).
6. Calcula señal de demanda mediante una función compartida: [stock-demand-forecast.ts:17](../../packages/contracts/src/stock-demand-forecast.ts#L17). Usa media de las ocho semanas recientes ponderada por actualidad; tendencia de cuatro semanas frente a las cuatro anteriores, amortiguada y limitada a ±12,5%; convierte a 30 días. No incorpora promociones ni estacionalidad. `strong` significa suficientes semanas con ventas, no probabilidad de acierto calibrada.
7. El contexto distingue calendario de referencia y campañas propias. Lee fechas, estado, descuento y `product_ids` de metadata; el descuento no produce automáticamente un multiplicador de demanda: [ai-runtime.ts:12876](../../apps/api/src/ai-runtime.ts#L12876).
8. La generación añade instrucciones explícitas para abstenerse con cobertura incompleta, distinguir producto de variante, evitar fechas de rotura garantizadas y no inventar cantidades: [ai-runtime.ts:6333](../../apps/api/src/ai-runtime.ts#L6333). El objetivo actual pide español comprensible sin campos internos: [ai-runtime.ts:12639](../../apps/api/src/ai-runtime.ts#L12639).
9. Las propuestas de A06 se vinculan a UUID de producto, se contrastan con tareas abiertas, se revalida inventario al decidir y se adquiere una reserva contra concurrencia: [ai-runtime.ts:24219](../../apps/api/src/ai-runtime.ts#L24219). Materializan tareas; no hacen pedidos de compra al proveedor.
10. El GET entrega el último análisis exitoso sin lanzar uno nuevo: [ai-runtime.ts:6927](../../apps/api/src/ai-runtime.ts#L6927). La UI actual muestra resumen y findings de Stock dentro de “Qué ha detectado la IA”: [client-pulse.tsx:522](../../apps/web/src/app/dashboard/client-pulse.tsx#L522).

## 4. Hallazgos priorizados

| ID | Prioridad | Hecho verificado y efecto | Corrección propuesta |
| --- | --- | --- | --- |
| ST-01 | P1 | No existe cálculo de compra en A06: `lead_time_days` y `reorder_quantity` se fuerzan a `null` en [stock-risk-evidence.ts:100](../../apps/api/src/stock-risk-evidence.ts#L100), y el objetivo prohíbe cantidades por falta de plazo/seguridad. No satisface “aumenta X unidades”. | Añadir configuración real de proveedores, plazos, mínimos/múltiplos, seguridad y presupuesto; calcular la cantidad en servidor. |
| ST-02 | P1 | La señal de doce semanas excluye campañas/estacionalidad por diseño ([stock-demand-forecast.ts:13](../../packages/contracts/src/stock-demand-forecast.ts#L13)). El contexto carga calendario, pero no produce una curva diaria de campaña ni intervalos de incertidumbre. | Separar cálculo base, escenario confirmado y escenario de estrés; incorporar comparables con cobertura demostrada y supuestos explícitos. |
| ST-03 | P1 | La revalidación local de tarea impone ventas de últimos 30 días y stock de hasta 14 días al ritmo medio, sin plazo ni evento ([20261228100000_a06_risk_sample_and_atomic_restock.sql:143](../../supabase/migrations/20261228100000_a06_risk_sample_and_atomic_restock.sql#L143)). Una reposición necesaria hoy por proveedor a 40 días o campaña dentro de 39 días puede rechazarse aunque el escenario sea válido. | Validar el mismo contrato versionado que originó la propuesta: horizonte, proveedor, campaña y riesgo; no una regla fija distinta. |
| ST-04 | P1 | La unidad del cruce A06 es el producto; suma variantes y ubicaciones, y expone una lista de SKU. No demuestra que la talla M o el almacén que sirve online estén cubiertos ([ai-runtime.ts:12826](../../apps/api/src/ai-runtime.ts#L12826)). | Proyectar por `variant_id` + `inventory_item_id` + `location_id`; agregar al producto después, conservando restricciones de venta/mercado y transferencias. |
| ST-05 | P1 | Semántica desigual entre pantallas. El catálogo usa `tracked_variants > 0` para habilitar cobertura ([page.tsx:138](../../apps/web/src/app/shopify/productos/page.tsx#L138), [page.tsx:350](../../apps/web/src/app/shopify/productos/page.tsx#L350)). El detalle revisa frescura con la fecha **más reciente** ([detalle:217](../../apps/web/src/app/shopify/productos/[productId]/page.tsx#L217)); A06 usa la más antigua. Una lectura nueva puede ocultar otra vieja en el detalle. | Entregar desde backend un único estado de completitud/frescura por entidad, con más antigua/más reciente y ubicaciones esperadas; usarlo igual en catálogo, detalle, móvil y agente. |
| ST-06 | P1 | El catálogo rellena semanas ausentes con cero ([shopify-catalog.ts:185](../../apps/api/src/shopify-catalog.ts#L185)); A06 las trata como desconocidas ([ai-runtime.ts:12741](../../apps/api/src/ai-runtime.ts#L12741)). Dos superficies pueden estimar demanda diferente del mismo producto. | Incorporar cobertura de ingesta por intervalo. Solo rellenar cero cuando la semana esté verificada completa y sin ventas. |
| ST-07 | P1 | El GET cacheado de A06 marca frescura por edad del análisis; la comprobación actual de cobertura Shopify se aplica a A13, no a A06 ([ai-runtime.ts:7037](../../apps/api/src/ai-runtime.ts#L7037), [ai-runtime.ts:7062](../../apps/api/src/ai-runtime.ts#L7062)). La cadencia general A06 es 20 h ([ai-runtime.ts:16411](../../apps/api/src/ai-runtime.ts#L16411), [ai-runtime.ts:16524](../../apps/api/src/ai-runtime.ts#L16524)). Stock de 47 h al analizar puede pasar de 48 h antes de vencer ese análisis. | Distinguir edad del análisis y de cada evidencia; invalidar el estado operativo ante caducidad, webhook, sincronización nueva, ajuste de stock, campaña/entrada cambiada. |
| ST-08 | P2 | La definición SQL toma solo productos con ventas en el periodo, limita a 100 y luego el modelo recibe 12 ([SQL:99](../../supabase/migrations/20261228110000_a06_oldest_inventory_freshness.sql#L99), [SQL:122](../../supabase/migrations/20261228110000_a06_oldest_inventory_freshness.sql#L122), [ai-runtime.ts:12822](../../apps/api/src/ai-runtime.ts#L12822)). Un lanzamiento sin ventas o un agotado antiguo puede no estar entre ellos. | Universo adicional de productos anunciados/confirmados en campañas y lanzamientos; lista de cobertura y exclusiones. No presentar una muestra como catálogo completo. |
| ST-09 | P2 | `weeklyCoverageStatus` es global al bloque: una serie incompleta lo vuelve `incomplete`, aunque otras sí tengan doce semanas; la instrucción dice abstenerse de cuantificar cuando ese estado global es incompleto ([ai-runtime.ts:12747](../../apps/api/src/ai-runtime.ts#L12747), [ai-runtime.ts:6334](../../apps/api/src/ai-runtime.ts#L6334)). Puede silenciar un producto válido por otro incompleto. | Gate y razón por producto; estado global informativo. |
| ST-10 | P2 | Una versión candidata **inactiva** de prompt espera `weekly_units_last_52` y fija posiciones de Black Friday respecto a una serie que comienza en 2025-10-13; el backend actual entrega `weekly_units_last_12` ([migración v10:45](../../supabase/migrations/20261225120000_a06_v11_v12_modelo_real_y_contexto.sql#L45), [ai-runtime.ts:12845](../../apps/api/src/ai-runtime.ts#L12845)). Es deuda en un artefacto de release, no prueba del prompt activo. | Eliminar fechas/posiciones fijas; pruebas automáticas de compatibilidad prompt/contexto antes de activar versión. |
| ST-11 | P2 | La presentación actual sigue siendo texto de findings. Limita el número a 3 por sección o 4 sin secciones, pero no ofrece contrato obligatorio de SKU, curva, unidades necesarias, razón y botón al producto ([client-pulse.tsx:567](../../apps/web/src/app/dashboard/client-pulse.tsx#L567)). | Renderizar tarjetas de riesgo desde campos tipados; evidencia técnica desplegable. La concisión debe ser una propiedad del producto, no depender solo del prompt. |

P1 significa brecha que impide prometer reposición fiable o permite discrepancias importantes; no afirma un incidente de producción. P2 significa cobertura, utilidad o mantenibilidad que debe resolverse antes de escalar el agente.

### Datos que existen, pero no deben confundirse con planificación completa

La sincronización recoge cantidades `available`, `on_hand`, `committed`, `incoming` por ubicación ([shopify-sync.ts:1829](../../apps/api/src/shopify-sync.ts#L1829), [shopify-sync.ts:1973](../../apps/api/src/shopify-sync.ts#L1973)). El contexto de A06 resume `available`; no integra una agenda verificable de entradas con ETA, recepciones parciales, proveedor y asignación de destino. `available` ya tiene su propia semántica: no restar `committed` por segunda vez sin definir la ecuación. Una entrada agregada sin fecha no garantiza que llegue antes de Black Friday.

Es viable incorporar lectura de órdenes de compra en Shopify Admin API **2026-10 o posterior**, con `read_inventory_purchase_orders`; transferencias requieren además su permiso. La publicación oficial del 17 de septiembre de 2026 aclara que es **solo lectura**, sin mutaciones de órdenes de compra, y que 2026-07 no obtiene esas consultas. Hace falta actualizar versión y permisos concedidos e implementar ingesta, sin prometer creación nativa de PO desde esa API. [Fuente oficial Shopify](https://shopify.dev/changelog/posts/purchase-order-read-api). Para tiendas que no registren compras allí, usar ERP/WMS/CSV o entrada manual con procedencia y fecha.

## 5. Qué debe calcular el servidor y qué debe explicar el agente

El servidor debe calcular y conservar resultados versionados; el modelo convierte esos resultados en una explicación legible y puede pedir un dato que falta. No debería inventar curvas, cantidades, probabilidades ni fechas a partir de un párrafo.

### Línea base y calidad

- Estimar demanda diaria por variante y canal/mercado relevante. Conservar intervalo de observación y cobertura de ingesta. Separar unidades pedidas, canceladas, devueltas y demanda no atendida.
- No interpretar días agotados como demanda cero: las ventas están limitadas por disponibilidad. Incorporar histórico diario de disponibilidad; si falta, declarar sesgo y ampliar incertidumbre.
- Comparar métodos mediante backtest temporal: media móvil, día de semana, patrón estacional cuando exista histórico suficiente; la heurística actual sirve como baseline a superar.
- Producir rango de demanda y no llamar “95 % de confianza” a un rango sin calibración empírica. La etiqueta actual de semanas suficientes no equivale a exactitud predictiva.

### Escenario comercial

Una fecha general de Black Friday informa planificación; no demuestra que la tienda haga una promoción. La campaña confirmada debe definir productos/variantes, fechas, mercados, oferta y stock asignado. Su efecto puede proceder de comparables propios, experimentos o un supuesto introducido por una persona; en ese último caso, mostrar “escenario supuesto”, no “demanda prevista demostrada”. No sumar ventas atribuidas de Meta y Klaviyo a Shopify como si fueran ventas incrementales independientes.

### Proyección y reposición

Para cada variante y ubicación apta para servir el canal, calcular un balance diario coherente:

```text
saldo_proyectado[d] = disponible_hoy
                      + entradas_confirmadas_hasta[d]
                      + transferencias_netas_confirmadas_hasta[d]
                      - demanda_acumulada_del_escenario_hasta[d]
```

La disponibilidad de partida y el tratamiento de reservas deben definirse una sola vez; una cantidad ya descontada no se resta de nuevo. Una entrada cancelada o con ETA incierta no cuenta como mercancía segura.

```text
horizonte_objetivo = plazo_reposición + intervalo_revisión
necesidad_bruta = demanda_del_horizonte + stock_seguridad
necesidad_neta = max(0, necesidad_bruta - disponible - entradas_útiles)
cantidad_sugerida = redondear_a_múltiplo_y_MOQ(necesidad_neta)
```

Es una política inicial propuesta, no fórmula implementada. Para eventos, extender el horizonte hasta la cola posterior de campaña cuando corresponda; preservar la curva diaria. Un pedido suficiente en total puede llegar después de una rotura anterior: comprobar cada día y plazo de recepción. Si el proveedor llega tarde, mostrar alternativas concretas, como traslado, proveedor alternativo, limitar la promoción o revisar exposición publicitaria. Ninguna implica ejecución externa automática.

### Ejemplo hipotético completo

**Datos inventados para explicar el producto; no representan una tienda real.** Fecha del escenario: 19-11-2026 a las 00:00, tienda en Europe/Madrid. Variante Sudadera Arena / M, almacén online, 30 unidades disponibles; sin entradas ni transferencias. Demanda escenario: 1 unidad/día del 19 al 26 de noviembre (8 días), 4/día del 27 al 30 (4 días), 2/día del 1 al 7 de diciembre (7 días). Campaña confirmada en este ejemplo. El incremento es un supuesto explícito de la persona responsable, pendiente de validación; no se deduce del descuento.

| Tramo | Demanda | Disponible al terminar |
| --- | ---: | ---: |
| 19–26 noviembre | 8 | 22 |
| 27–30 noviembre | 16 | 6 |
| 1–7 diciembre | 14 | -8 teórico; ventas reales limitadas por stock |

Se alcanzaría cero al terminar el 3 de diciembre y la primera demanda no atendida sería el 4, si se cumple este escenario y no hay entradas. Para acabar el 7 de diciembre con 10 unidades de seguridad hacen falta `38 + 10 - 30 = 18`. Con pedido mínimo 20 y cajas de 10, sugerencia **20 unidades**. Con plazo confirmado de 7 días y compra el 19, recepción prevista el 26; el proveedor debe confirmar fecha. Si el objetivo fuese una seguridad de 15, serían 23 netas y **30** por múltiplo de caja. La cantidad depende de la política, no de la preferencia del modelo.

Texto al propietario: **“Sudadera Arena · M: quedan 30. En el escenario confirmado terminarías la promoción con 6 y empezarías a perder ventas el 4 de diciembre. Prepara 20 para recibir antes del 27 de noviembre y mantener 10 de seguridad hasta el día 7. El aumento de demanda de la campaña es un supuesto pendiente de validar.”** Si no hay datos para cuantificar campaña, mostrar la base y solicitar ese dato; no afirmar una rotura posterior como hecho.

El calendario del código calcula Black Friday como el viernes después del cuarto jueves de noviembre ([commercial-calendar.ts:86](../../apps/api/src/commercial-calendar.ts#L86)). En 2026 resulta **27-11-2026**; la fecha de Thanksgiving del 26-11 está contrastada con el [calendario oficial OPM 2026](https://piv.opm.gov/policy-data-oversight/pay-leave/federal-holidays/). Esto verifica la fecha, no una promoción de la tienda.

## 6. Contrato de salida propuesto

Propuesta de contrato nuevo, no implementación existente. Una salida puede ser `actionable`, `watch`, `healthy`, `insufficient_data` o `sync_required`; debe indicar por qué y qué desbloquea el siguiente estado.

```ts
type StockDecision = {
  decision_id: string;
  organization_id: string;
  store_id: string;
  product_id: string;
  variant_id: string;
  inventory_item_id: string;
  location_ids: string[];
  title: string;
  sku: string | null;
  evaluated_at: string;
  inventory_as_of: string;
  evidence_valid_until: string;
  coverage_status: "complete" | "partial" | "unknown";
  decision_status: "actionable" | "watch" | "healthy" | "insufficient_data" | "sync_required";
  available_units: number | null;
  confirmed_inbound: Array<{ source_id: string; units: number; eta: string; status: string }>;
  scenario: {
    id: string;
    campaign_ids: string[];
    kind: "baseline" | "confirmed_campaign" | "assumption" | "stress";
    start: string;
    end: string;
    daily_projection_ref: string;
    demand_low: number | null;
    demand_base: number | null;
    demand_high: number | null;
    assumptions: string[];
  };
  projected_after_campaign_units: number | null;
  first_unserved_demand_at: string | null;
  replenishment: {
    supplier_id: string | null;
    lead_time_days: number | null;
    safety_units: number | null;
    moq: number | null;
    order_multiple: number | null;
    suggested_units: number | null;
    order_by: string | null;
    needed_arrival_at: string | null;
    policy_version: string;
  };
  reason_codes: string[];
  evidence_refs: string[];
  evidence_digest: string;
  linked_task_id: string | null;
  next_action: { kind: string; label: string; href: string };
  headline: string;
  explanation: string;
};
```

Reglas del contrato: campos desconocidos permanecen desconocidos; no sustituir por cero. `first_unserved_demand_at` es condicional al escenario, no una garantía. Debe existir evidencia para cada entrada, supuesto y número. `suggested_units` es nulo si no puede calcularse una política válida. El CTA es una ruta real con tienda/variante/filtro; el dashboard muestra las 3 prioridades y enlaza a Inventario, que conserva todo el detalle y exclusiones. Una incidencia de sincronización muestra fecha, alcance y acción para resolverla, sin listado comercial extenso.

## 7. Backlog y aceptación

| Orden | Trabajo | Criterio observable de aceptación |
| --- | --- | --- |
| S0 | Contrato común de evidencias y salud de sincronización | Catálogo, detalle, móvil y A06 coinciden ante variante sin gestionar, lectura antigua, ubicación parcial y datos desconocidos. Edad de análisis y de inventario se muestran separadas. |
| S1 | Corregir series incompletas y universo de productos | Semana sin cobertura queda desconocida; semana completa sin ventas es cero. La falta de una serie no invalida productos completos. Lanzamientos/campañas pueden estar sin ventas, con incertidumbre explícita. |
| S2 | Página Inventario enlazada desde catálogo y dashboard | Tabla por SKU/variante, ubicación, disponibilidad, reservado/entrante, antigüedad, cobertura, estado; filtros guardables; aviso abre exactamente los afectados y conserva tienda. |
| S3 | Datos de reposición y entradas | Cada proveedor tiene plazo y procedencia; MOQ/múltiplo/seguridad pueden configurarse; entradas con ETA/estado y recepción parcial. No dar cantidad final cuando falte una dependencia imprescindible. |
| S4 | Motor diario por escenarios | Reproduce los balances del ejemplo; calcula antes, durante y después de campaña y compara escenario base/confirmado/estrés. Contrasta plazos y redondeo; conserva método y versión. |
| S5 | Tarjetas del agente y tareas coherentes | Frase de producto con unidades y fecha condicional generadas desde el motor; enlace concreto; hasta una tarea activa por necesidad. Al aprobar revalida el escenario y sus dependencias, no solo el umbral 14 días. |
| S6 | Evaluación temporal y operación | Backtest sin fuga de futuro, datos completos y campañas fuera del ajuste; monitor de errores, falsas alarmas, stockouts evitables y utilidad de tareas. Activación de prompt solo después de contrato y pruebas. |

Casos de regresión necesarios:

1. 30 unidades, escenario del ejemplo y MOQ 20/múltiplo 10: saldo final -8, primera demanda no atendida 04-12, pedido sugerido 20 para objetivo seguridad 10.
2. Mismo caso con entrada confirmada de 20 el 26-11: no volver a sumar un pedido innecesario; con ETA 05-12 se detecta la rotura anterior.
3. Proveedor con 40 días de plazo y stock con 25 días de cobertura: riesgo relevante hoy aunque sea superior a 14; el validador no rechaza por esa regla antigua.
4. Producto con 200 unidades en talla S y cero en M, con demanda concentrada en M: no declararlo cubierto por el agregado.
5. Dos ubicaciones, una no apta para online o para ese mercado: su stock no cuenta como disponible allí sin traslado confirmado.
6. Última lectura de una ubicación hoy y otra de hace 4 días: resultado parcial/obsoleto en todas las superficies.
7. Una semana sin ingesta y otra con cero real: resultados distintos; sin sustitución silenciosa. Una serie completa conserva su proyección aunque otro producto esté incompleto.
8. Producto nuevo con campaña confirmada: pedir supuestos/referencias y reflejar incertidumbre; no desaparecer del universo por falta de ventas.
9. Evento general BF sin campaña propia/productos: no aplicar uplift automáticamente. Campaña con fecha/descuento pero sin comparables: escenario supuesto o demanda de campaña desconocida.
10. Inventario stale, RPC fallida, backlog no disponible, cantidad nula, fecha futura: no inventar cero ni crear tarea de compra.
11. Dos aprobaciones concurrentes, misma variante/necesidad: una tarea. Otra tienda o campaña distinta conserva identidad; una tarea ignorada solo se reabre por cambio material documentado.
12. Cambian stock, ETA, campaña o plazo entre análisis y aprobación: recalcular y mostrar la diferencia antes de materializar.
13. Identidad/permiso de otra organización o tienda: nunca aparecen entidades ni tareas ajenas.
14. Texto sin campos internos, sin rangos probabilísticos inventados y sin números sin evidencia. CTA existente al SKU/variante y filtro adecuados.

## 8. Métricas de calidad y salida a producción

- Exactitud numérica del balance, redondeo y fechas: 100 % en fixtures deterministas. Tasa de número sin evidencia: 0 %.
- Falsas afirmaciones de cero ante desconocido/obsoleto: 0 %; errores de entidad/tienda: 0 %; duplicados concurrentes de una necesidad: 0 % en pruebas.
- Error de demanda: MAE y WAPE por horizonte y cohortes, sesgo firmado y rendimiento frente al baseline; no usar MAPE cuando demanda sea cero. Segmentar campañas, lanzamientos, demanda intermitente y periodos limitados por stock.
- Intervalos: cobertura empírica de cuantiles e intervalos frente a la nominal; amplitud. No publicar probabilidad hasta calibrarla y mostrar tamaño de muestra.
- Riesgo: precisión/recall de alertas en ventanas definidas, anticipación útil antes del pedido límite, alertas por SKU/semana y falsas alarmas. No penalizar como falso positivo una rotura evitada por reposición: medir escenario contrafactual y acción tomada por separado.
- Impacto operativo: proporción de propuestas que acaban en tarea útil, aprobación, revisión/descartes con motivos, días hasta resolver incidencia, roturas y ventas perdidas estimadas con supuestos, exceso de stock y capital comprometido.
- Fiabilidad: cobertura completa de ventas/inventario, latencia de sincronización por entidad, porcentaje de recomendaciones caducadas servidas como operativas y diferencias entre superficies.
- Coste: tiempo/coste por análisis y por propuesta aceptada; un cambio sin evidencia material debe actualizar estado sin repetir narración extensa.

No fijar un porcentaje universal de “buena predicción” sin baseline, volumen y distribución. Publicar resultados por cohorte y fecha de evaluación.

## 9. Verificación realizada y pendiente

Se ejecutó localmente, sin llamadas remotas, el comando:

```powershell
& './node_modules/.bin/tsx.cmd' --test apps/api/src/stock-risk-evidence.test.ts apps/api/src/stock-forecast.test.ts apps/api/src/commercial-calendar.test.ts
```

Resultado: **14 pruebas, 14 correctas, 0 fallos**. Cubren muestras/frescura, cero frente a desconocido, deduplicación exacta, selector móvil y calendario. No validan stock de producción, esquema desplegado, forecasts de campaña, proveedores, concurrencia real ni fidelidad de la salida del modelo.

No se ejecutó `eval-a06-stock-planner.ts`: crea usuarios/organizaciones/datos y llama a modelos reales ([archivo:30](../../apps/api/src/eval-a06-stock-planner.ts#L30)). Su dataset documenta tres casos básicos (sin datos, casi agotado con demanda, amplio stock con poca demanda); no basta como aceptación del producto propuesto.

Pendiente para cerrar la auditoría funcional: revisar migraciones realmente aplicadas, prompt/modelo activo y contrato runtime; ejecutar casos de aceptación en entorno aislado con datos representativos; comprobar flujos de navegación reales, permisos y sincronización; evaluar modelos y previsiones con series de tienda y fechas observadas. Las limitaciones actuales no se resuelven afirmando más certeza desde el LLM.
