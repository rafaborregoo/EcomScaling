# IMP-02 — Economía comparable y cobertura de costes

Fecha: 2 de noviembre de 2026, Europe/Madrid. Alcance: implementación local del siguiente punto del plan. El despliegue se reserva para la entrega final, según la indicación del usuario.

## Resultado funcional

La economía usa el motor financiero existente y una política compartida de suficiencia. A09, A14, A23, las vistas de cliente y la cartera del consultor reciben el estado de los datos antes de usar una cifra de rentabilidad. No se ha creado otro agente ni otro calculador de beneficio.

Los estados son `comparable`, `estimated`, `incomplete`, `incompatible`, `unknown` y `not_assessable`. Solo `comparable` habilita `can_use_financial_model`. Una estimación visible se etiqueta como tal; no habilita una conclusión económica firme o una tarea de inversión de A14. Comparar ROAS atribuido con el umbral económico exige además el veredicto vigente de A24.

## Correcciones de cálculo

**Devoluciones.** El bulk de Shopify utilizaba `currentTotalPriceSet` y después restaba las devoluciones otra vez. Se incorpora `total_before_returns`, obtenido de `totalPriceSet` en GraphQL y `total_price` en webhooks REST. El trigger canónico deriva `net_sales = total_before_returns - refunds`. El ingreso sin impuestos parte de esas ventas netas y resta el impuesto restante una sola vez.

La semántica se contrastó con [Order, API 2026-07 de Shopify](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Order): el total actual y el total anterior a devoluciones tienen significados distintos. Las dos variantes completas del bulk se validaron contra el esquema 2026-07 configurado por defecto en el cliente de la aplicación. También se solicita el envío actual para evitar presentar el importe anterior a un reembolso como envío neto actual.

Ejemplo sintético ejecutado en PostgreSQL: total anterior 120 €, devolución 60 €, total actual 60 €, impuesto restante 10 € y coste del producto 20 €. Resultado: ventas netas 60 €, ingreso sin impuesto 50 € y beneficio modelado 30 € cuando los demás costes son cero.

Los históricos no se dan por corregidos sin evidencia: la nueva columna queda en `NULL` hasta que llegue una reconciliación completa del proveedor. No se han reescrito importes históricos ni aplicado esta migración en producción. Hay una ruta de compatibilidad para que la ingesta continúe si el código llega antes que la columna; esa ruta no acredita una base financiera verificada.

**Ventanas.** A14 y la cartera utilizan días completos UTC. El final inclusivo es el último milisegundo del último día; el periodo anterior termina justo antes del actual. Esto evita incluir publicidad del día siguiente o compartir pedidos de medianoche entre dos periodos. Las vistas generales de Shopify conservan su periodo interactivo; si contiene días parciales, la comparación con publicidad diaria se marca como estimación.

**Gastos fijos.** La fecha final de vigencia incluye ese día. El gasto mensual de referencia se calcula a la fecha del informe, en lugar de la fecha en que se abre el informe. Se mantiene el prorrateo canónico de 30,44 días/mes.

**Ámbito.** Los costes fechados, inventario, líneas y cuentas publicitarias se vinculan explícitamente con su organización y tienda. El gasto histórico de cuentas deseleccionadas sigue contando cuando hay gasto registrado; su moneda también entra en la comprobación. No se elimina gasto real para hacer que cuadren las monedas.

## Cobertura y política común

[shopify-financial-comparability.ts](../../apps/api/src/shopify-financial-comparability.ts) contiene la decisión compartida. La nueva RPC `shopify_financial_coverage` reúne el resultado del motor canónico y sus pruebas de cobertura en una sola lectura estable de PostgreSQL. Los consumidores internos no necesitan dos llamadas HTTP para obtener cálculo y procedencia.

Se contrastan:

- Organización, tienda, versión y ventana exacta de la lectura.
- Pedidos con base monetaria sin verificar, discrepancias entre total actual/devoluciones y pedidos sin líneas.
- Reembolsos posteriores al último snapshot completo del pedido.
- Líneas exactas, estimadas, ausentes o con valores inválidos; coste fechado, coste actual estimado y coste ausente.
- Denominadores de pedidos y líneas, y coherencia entre contadores.
- Importes afectados agrupados por moneda. Un importe desconocido permanece en `NULL`; no se sustituye por cero.
- Monedas de los inputs realmente usados: pedidos, costes aplicados, configuración, gastos, reglas de envío y publicidad del periodo. No hay conversión de divisas.
- Conexiones Shopify y Meta disponibles y recientes, con errores posteriores al éxito tratados como no verificables.
- Gastos organizativos sin una asignación verificada a las tiendas.
- Conciliación del beneficio con sus componentes. La tolerancia de reconstrucción es de hasta 0,03 € porque el SQL redondea componentes y total por separado; las referencias con entradas exactas en céntimos se comprueban al céntimo.

Un coste fechado de cero es válido. La ausencia de coste no equivale a cero. Aplicar el coste actual de Shopify a un pedido histórico produce una estimación. Una línea de bundle sin una variante/coste vinculable queda sin cobertura; no se inventa un coste para completarla. Un denominador de ingresos nulo o no positivo no genera un CAC, ROAS de equilibrio o rentabilidad fiable.

La lectura adicional de cobertura de `/shopify/metrics` se realiza solo después de comprobar pertenencia y acceso a la tienda. Se usa el contexto del servidor para conocer el número total de tiendas de la organización: una vista RLS limitada a una tienda podría ocultar las demás y aparentar que los gastos no son compartidos. El resultado financiero visible por el usuario se contrasta con ese mismo modelo; si las visibilidades no coinciden, la evaluación queda en `unknown` y no devuelve los agregados privados de cobertura.

La RPC nueva es `SECURITY INVOKER`, con `search_path` vacío y acceso únicamente para `service_role`. Se conservan las lecturas canónicas sujetas a RLS. No se introducen funciones `SECURITY DEFINER` ni acceso anónimo.

## Consumidores alcanzados

| Consumidor | Cambio observable |
|---|---|
| A09, `shopify_margin_health` | Tienda obligatoria, ventana común completa y política económica explícita; beneficio, margen y umbrales derivados se omiten cuando no son utilizables |
| A14, análisis actual/anterior | Ventanas contiguas; estado y motivos para cada periodo; datos económicos derivados filtrados por la política |
| A14, lectura guardada y materialización | Revalidación actual de suficiencia; una tarea de inversión exige economía comparable, moneda compatible y A24 válido. Se mantiene la excepción de investigación de medición |
| A23 | Manifiesto y bloque económico consumen la misma política; las hipótesis creativas no reciben un beneficio parcial como dato confirmado |
| API de métricas Shopify | Cobertura actual y anterior explícitas; nuevas versiones de caché para no servir el contrato anterior como si ya incluyera esos controles |
| Cliente, Pulso y Shopify | Avisos con motivo y siguiente paso; cifras estimadas etiquetadas; no se construye un titular de ganancia/pérdida firme con un modelo no verificable; comparación de beneficio solo con dos periodos verificados |
| Cartera y comparación del consultor | Tiendas no verificadas marcadas como datos pendientes y sin palancas de ROI; quedan fuera de totales y comparativas confirmadas, con contador de exclusiones. El cliente agregado no recibe un beneficio firme si alguna tienda carece de verificación |

La asignación histórica por facturación del panel sigue disponible como modelo de presentación; no convierte por sí sola los gastos compartidos en una asignación verificada para A14 o para una recomendación de inversión.

## SQL y cambios de contrato

Se ha preparado **una migración funcional nueva**: [20270115120000_imp02_financial_comparability.sql](../../supabase/migrations/20270115120000_imp02_financial_comparability.sql). Los 86 SQL del archivo histórico de la auditoría anterior siguen siendo otra cosa; no se han reaplicado.

La migración añade una columna, actualiza el trigger/constraint, crea la lectura de cobertura y reemplaza los cuerpos de las funciones canónicas de margen, finanzas y gasto. Conserva sus firmas y columnas de salida. No crea tablas, no activa prompts y no modifica la allowlist de herramientas de los agentes.

La guarda estática de idempotencia requería una excepción explícita para `RETURNS TABLE` aun sin cambio de firma. Se documentó la excepción del archivo, siguiendo el mecanismo ya existente. Se conserva `CREATE OR REPLACE` para mantener grants y dependencias; las pruebas reales aplican la migración dos veces. No se desactiva la guarda global.

El constructor de filas de cartera ahora exige una decisión financiera explícita; `null` se trata como no verificado. Los fixtures numéricos anteriores indican explícitamente su supuesto de fuente verificada. Se mantienen sus valores esperados y se añade una regresión que impide inflar cliente/cartera con una tienda no verificada.

Dos suites puras de marketing creadas por trabajo concurrente estaban fuera de los scripts. Se registraron y ejecutaron para recuperar la guarda general; su implementación no se atribuye a IMP-02.

## Verificación y límites

Las pruebas SQL ejecutan las rutinas reales en una base nueva del PostgreSQL local de Supabase, con esquema mínimo y datos completamente sintéticos. Se verifica el contexto Docker local y un prefijo exclusivo antes de crear/eliminar la base de pruebas. No se clonaron datos de clientes ni se escribieron datos en Supabase remoto.

La batería cubre devoluciones, impuestos, descuentos, coste ausente/cero/actual/fechado, divisas, cuenta histórica deseleccionada, multitienda/tenant, bundle sin coste, fechas de vigencia, medianoche, denominador cero, permisos y RLS. Incluye la referencia de cuatro pedidos: ingresos sin impuesto 840 €, COGS 240 €, comisiones 26,20 €, envío 20 €, fijos 310 € y Meta 100 €; beneficio esperado **143,80 €**.

Resultados por comando, con logs en `tmp/imp02-financial-2026-11-02/`:

| Comprobación | Resultado |
|---|---|
| Contratos financieros, base monetaria y consumidor real A09 | 35 pruebas superadas |
| PostgreSQL local, rutinas reales y migración aplicada dos veces | 14 pruebas superadas |
| Contratos de cartera y presentación del cliente | 29 pruebas superadas |
| Regresión A24 | 71 pruebas superadas |
| Conexiones, actividad, promoción, juez, envolvente, ingesta y métricas | 99 pruebas superadas |
| Paquete IA | 292 pruebas superadas |
| Suites concurrentes de marketing registradas | 9 pruebas superadas |
| GraphQL bulk normal y con extras, API 2026-07 | Ambas consultas válidas |
| Tipos de API y web | Ambos comandos superados |
| Lint de los seis archivos de interfaz afectados | 0 errores; 1 advertencia previa |
| Verificación general del repositorio | 19 guardas superadas |

Los conteos corresponden a cada comando; no se presentan como un inventario de casos únicos ni como una evaluación de modelos reales. Se mantiene una advertencia de lint en un parámetro `_props` ya existente; no se ha eliminado código ajeno para silenciarla.

Esta entrega no equivale a una conciliación contable de pasarela, banco o todos los proveedores de publicidad. Comisiones/envío siguen el modelo configurado y el gasto publicitario canónico cubre Meta. Las series históricas son estimaciones del estado reconciliado de los pedidos, no cierres contables inmutables ni prueba de incrementabilidad. No se ha certificado todo el producto mediante navegador o todas las combinaciones de roles reales; esa trazabilidad se continúa en IMP-03.

## Incorporación a la entrega final

1. Revisar el cambio y aplicar esta migración en el entorno de validación completo del proyecto; las pruebas de esta fase no sustituyen un reset de toda la cadena histórica.
2. Entregar los paquetes/API/worker y la interfaz compatibles, manteniendo las versiones de caché nuevas.
3. Reconciliar de forma acotada cada tienda con Shopify mediante el flujo existente. Comprobar que desaparecen las bases monetarias no verificadas, que las devoluciones cuadran y que los costes necesarios están fechados y en la moneda correcta.
4. Habilitar recomendaciones económicas solo donde la política lo permita. Conservar el resto como estimación o datos pendientes.

Para revertir, detener primero las recomendaciones económicas afectadas y conservar la procedencia capturada. No borrar la columna ni convertir valores desconocidos a cero. Restaurar una versión anterior puede reintroducir el tratamiento incorrecto de devoluciones; no se considera una verificación económica por sí misma.

El siguiente punto del plan es **IMP-03: contratos, ámbito, aprobaciones y trazabilidad**. La publicación queda reservada para la entrega final y no bloquea el avance del desarrollo local.
