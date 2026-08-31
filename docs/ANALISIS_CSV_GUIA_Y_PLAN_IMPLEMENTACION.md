# Análisis de la guía CSV y plan de implementación

Fecha de revisión: 31/08/2026

## Resultado ejecutivo

La guía CSV no describe siete funcionalidades independientes. Describe un único flujo operativo de crecimiento:

1. medir ventas, margen y rentabilidad;
2. decidir cuánto invertir en adquisición con ROAS/CAC y break-even;
3. planificar campañas y contenidos;
4. registrar la ejecución y comparar resultado contra objetivo.

La plataforma ya cubre buena parte de la capa de datos: Shopify aporta pedidos, ventas, stock y clientes; Meta aporta inversión, compras atribuidas, ROAS y CAC; Klaviyo aporta reporting de email; y la configuración financiera aporta COGS, envíos, comisiones, gastos fijos y objetivos. El hueco principal era la superficie operativa que unifica esos datos y hace visible el plan de campañas/tracking.

## Inventario de la guía

| CSV | Qué pide | Cobertura actual | Decisión |
|---|---|---|---|
| `instrucciones.csv` | KPI mensual, objetivo, crecimiento, margen, GP:CAC, CAC máximo, ROAS break-even, funnel, rentabilidad y campañas de fin de semana | Datos y cálculos parciales ya existen en Dashboard, funciones SQL financieras, Meta y objetivos | Reutilizar endpoints actuales y exponer una vista operativa |
| `kpi-mensual.csv` | La misma plantilla mensual con ventas, costes, adquisición, rentabilidad y funnel | No existía una vista mensual específica | Cubrir con resumen KPI y tabla mensual preparada para series reales |
| `ingeniería-inversa.csv` | Modelo mínimo de facturación, AOV, pedidos, recurrencia, pedidos por canal, CAC y ads | Shopify/Meta/Klaviyo ya proporcionan la mayoría; recurrencia y canales dependen de atribución disponible | Mostrar disponibilidad y no inventar datos faltantes |
| `roas-cac.csv` | Inputs económicos y decisión de primera compra: CAC máximo, ROAS mínimo, gasto máximo | Configuración financiera + `shopify_financial_summary` + `meta_spend_summary` | Mostrar ROAS/CAC con umbrales y estado accionable |
| `calendario.csv` | Battle map anual de eventos estacionales, campañas y preparación | Marketing tiene drafts/assets, pero no un calendario operativo | Añadir calendario inicial basado en los eventos de la guía |
| `cal-rebajas.csv` | Calendario diario de email, stories, post/carrusel y reel/TikTok | Marketing/Klaviyo cubren contenido, pero no la planificación multicanal | Añadir tabla semanal de ejecución |
| `tracking-sheet.csv` | Registro simple de valores por mes | No existe persistencia de esta hoja | Mostrar captura local en la primera iteración y dejar persistencia como siguiente bloque |

## Qué ya está aplicado y por qué

- **Dashboard**: `apps/web/src/app/dashboard/page.tsx` ya consume ventas Shopify, stock, margen financiero, Meta y operaciones. Es la fuente de verdad del resumen ejecutivo.
- **Finanzas**: `apps/api/src/financial-config.ts` gestiona configuración, gastos fijos, reglas de envío y objetivos por organización. La función SQL `shopify_financial_summary` calcula beneficio neto estimado, margen y break-even.
- **Adquisición**: `meta_spend_summary` y las rutas de Meta ya calculan gasto, compras atribuidas, ROAS y CAC. Se debe advertir que la atribución puede solaparse según los tipos de compra recibidos de Meta.
- **Costes de producto y stock**: Shopify sincroniza inventario y permite cargar costes; existen señales de poco stock, agotados y planner IA.
- **Marketing**: `/marketing` tiene drafts, versiones, notas, assets, generación IA e integración con Meta/Klaviyo. El calendario debe orquestar ese trabajo, no duplicarlo.
- **Diseño**: el portal usa `PortalShell` y componentes de `@/components/ui`; la implementación nueva sigue ese sistema y no crea una librería visual paralela.

## Huecos reales

### Prioridad P0 — necesaria para usar la guía hoy

- Una vista única de **Planificación** con KPI mensual, ROAS/CAC, calendario y tracking.
- Estados explícitos de datos: conectado, sin datos, incompleto y estimado.
- Enlace visible hacia Configuración, Integraciones, Shopify y Marketing cuando falte una fuente.
- Cálculos seguros: división por cero devuelve `—`; no convertir ausencia de datos en cero.

### Prioridad P1 — necesaria para operación continua

- Persistir campañas y piezas del calendario por organización, canal, fecha, estado, campaña y responsable.
- Persistir snapshots KPI mensuales/semanales para comparar contra objetivos y evitar que una re-sincronización cambie históricos.
- Registrar ejecución de cada acción de campaña y asociarla a drafts, campañas Meta o flows Klaviyo.
- Añadir exportación CSV de KPI y tracking.

### Prioridad P2 — automatización

- Alertas por ROAS por debajo del break-even, CAC por encima del máximo, margen neto negativo, stock bajo y campañas no ejecutadas.
- Recomendaciones IA enlazadas a una tarea aprobable, usando el sistema de tareas existente.
- Atribución unificada por UTM/canal con una política documentada.

## Contratos de cálculo

Los valores mostrados deben seguir estas reglas:

- `AOV = ventas netas / pedidos`, solo si pedidos > 0.
- `CAC = inversión / clientes nuevos o compras atribuidas`, solo si el denominador > 0.
- `ROAS = ventas atribuidas / inversión`, solo si inversión > 0.
- `GP por pedido = ventas sin IVA - COGS - envío - comisiones` dividido entre pedidos.
- `CAC máximo = AOV sin IVA - COGS - envío - gastos indirectos - beneficio objetivo`.
- `ROAS break-even = ventas atribuidas / gasto máximo sostenible`; si el margen no es positivo, mostrar “No disponible”.
- Los porcentajes de atribución pueden superar 100% o ser negativos en modelos multicanal; deben mostrarse como señal de calidad de atribución, no normalizarse silenciosamente.

## Implementación realizada en esta iteración

- Nueva ruta `/planificacion` reutilizando el shell y componentes existentes.
- KPI operativos conectados a Shopify y Meta para el periodo seleccionado.
- Vista de cartera para `consultant`/`platform_admin`, agregada por cliente y con entrada posterior al detalle de una organización.
- En detalle, el selector global de tienda mantiene el comportamiento actual: `connectionId` concreto = una tienda; vacío = todas las tiendas autorizadas de la organización.
- Panel de decisión ROAS/CAC con comparación contra break-even cuando exista configuración financiera.
- Calendario anual y calendario diario de rebajas derivados de la guía, con enlaces al módulo Marketing.
- Tracking semanal editable en cliente para poder trabajar hoy sin introducir datos falsos en base de datos.
- Navegación actualizada para consultor y cliente.

## Regla de visibilidad

| Rol | Vista inicial | Alcance de datos |
|---|---|---|
| `consultant` / `platform_admin` | Cartera de clientes | Todas las organizaciones asignadas; nunca se mezclan en un detalle sin etiquetar |
| Cliente | Detalle de su organización | Solo su organización y sus conexiones autorizadas |
| Cualquier rol con tienda activa | Detalle de tienda | `connectionId` se envía en las métricas y sirve como filtro adicional |

El consultor no recibe por defecto una tabla de métricas mezclando clientes: primero ve el rollup de cartera y después entra en una organización concreta. Así se conserva el patrón ya usado por `/dashboard`, donde la organización activa y la tienda activa se resuelven desde `PortalShell`.

## Siguiente bloque recomendado

La base de persistencia de Fase 2 ya está implementada como `campaign_calendars` + `campaign_calendar_items` + `kpi_snapshots`, siempre con `organization_id`, `store_id` opcional, RLS y validaciones cross-tenant. El siguiente incremento es añadir soft delete/auditoría específica y conectar cada ítem a `marketing_content_drafts`, Meta o Klaviyo.

## Criterios de terminado

- La ruta carga sin tienda o con integraciones ausentes y explica qué falta.
- Ningún KPI inventa cero cuando no hay datos.
- El usuario puede cambiar periodo y revisar KPI, adquisición, campañas y tracking desde una sola vista.
- La UI usa exclusivamente componentes existentes y respeta los tokens actuales.
- TypeScript y tests del workspace pasan.

## Fase 3 implementada

La migraciÃ³n `20260901170000_phase3_campaign_planning_links_audit.sql` aÃ±ade archivado lÃ³gico y auditorÃ­a de `campaign_calendar_items`, y permite conectar cada Ã­tem con `marketing_content_drafts`, `meta_campaigns` o `klaviyo_campaigns`. Las relaciones se validan contra la misma organizaciÃ³n en API y en trigger SQL. La UI muestra las conexiones y permite archivar una acciÃ³n sin borrar historial.

Siguiente incremento: selectores de estos recursos dentro del editor de acciones y alertas automÃ¡ticas de acciones vencidas o no ejecutadas.
