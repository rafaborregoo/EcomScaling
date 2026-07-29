# FE-02 - Dashboard

## Estado

- **Estado real:** `functionally_complete_e2e_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** BE-03, FE-00
- **Bloqueador:** ninguno
- **Evidencia:** `apps/web/src/app/dashboard/page.tsx` — facturacion/pedidos/AOV/beneficio neto desde
  `shopify/metrics` (con banner de "datos incompletos" cuando faltan costes/gastos fijos), inversion
  Meta/ROAS cuando hay datos, selector de periodo compartido (7/30/90/Todo) entre la tabla multi-tienda y
  el resumen ejecutivo, y tabla "Todas las tiendas" (consultor/admin) para no perder de vista una tienda
  cuando hay varias — resuelto explicitamente esta semana: **la metrica mostrada declara si es de la
  tienda activa o agregada** (titulo cambia a "Resumen de la tienda seleccionada" cuando hay una tienda
  activa via el selector global).
- **Resuelto 2026-07-22**: `IntegrationAction` (renombrado `AccountAction`) ya es un catalogo cerrado
  (`@ecomscaling/contracts`, `ACCOUNT_ACTION_TYPES = ["integration_error", "shopify_reauthorization_required"]`),
  compartido entre `apps/api/src/actions.ts` y `apps/web/src/lib/bootstrap.ts` -- antes `type: string` podia
  desincronizarse entre backend y frontend sin que TypeScript lo detectara. De paso, `severity` (que ya
  existia pero no se usaba) ahora si cambia el estilo visual de la banda de avisos (`portal-shell.tsx`):
  error y warning ya no comparten el mismo rojo de marca.
  - Responsive auditado 2026-07-22: la tabla "Todas las tiendas" ya tenia `overflow-x-auto` + `min-w`, sin
    cambios necesarios -- se confirma que funciona en 375px sin romper el layout de la pagina.
  - Se quito una tarjeta de "Agentes IA: Bloqueado por datos" hardcodeada que contradecia el resto de la
    pagina (los agentes ya corren, ver `AiDiagnosticSection` en la misma vista).
- **Cerrado 2026-07-29 (comparacion contra periodo anterior)**: `getShopifyMetrics`
  (`apps/api/src/shopify-metrics.ts`) llama las mismas funciones SQL stable ya usadas
  (`shopify_sales_summary`, `shopify_financial_summary`) para el rango inmediatamente anterior al periodo
  seleccionado (mismo numero de dias) -- sin agregar nada en Node, respeta la regla del `CLAUDE.md` del
  repo. No aplica a "Todo" (`previous_period: null`, no hay un "periodo anterior" bien definido para el
  historico completo). Fallo no fatal: si la consulta del periodo anterior falla, se loguea y se omite,
  sin tumbar el dashboard. En el frontend, `PeriodDeltaBadge` (`apps/web/src/app/dashboard/page.tsx`)
  muestra un `Badge` verde/rojo ("+12,3%"/"-5,1%") junto a Facturacion neta, Pedidos, AOV y Beneficio neto
  estimado; se omite (no "0%"/"n/a" enganoso) cuando no hay base valida para comparar (periodo "Todo" o
  valor anterior 0, evitando division por cero). 2 tests reales de extremo a extremo
  (`fe-02-period-comparison.test.ts`, servidor Fastify real, 5 pedidos sembrados en dos periodos distintos
  contra Supabase real) confirman que distingue de verdad 3 pedidos del periodo actual de 2 del anterior, y
  que `days=all` no devuelve `previous_period`. **Sin verificar visualmente en navegador** (este entorno no
  tiene el dev server levantado con Supabase configurado para eso) -- typecheck/lint limpios, pendiente
  confirmacion visual real.
- **Gaps identificados que siguen abiertos:**
  - Sin timezone/moneda explicitos en el propio dashboard (heredados de la organizacion, no mostrados).
  - Sin drill-down ni exportacion.
- **Siguiente accion:** verificar visualmente en navegador real (Rafa o una sesion con el dev server
  levantado) que los badges de comparacion se ven bien con datos reales, sobre todo casos extremos
  (delta muy grande, delta negativo, sin periodo anterior).

## Objetivo

Mostrar la foto real del negocio con KPIs calculados y frescura de datos.

## Entregables

- Facturacion, pedidos, AOV, recurrencia y stock desde Shopify.
- Inversion, ROAS y break-even cuando Meta este conectado.
- Estados de sync: en curso, parcial, fallido, desactualizado.
- Mensajes de datos incompletos.
- Banda superior persistente cuando una integracion requiera accion de empresa.
- Caso Shopify: si faltan scopes concedidos respecto a los scopes requeridos, mostrar aviso en header con CTA para reautorizar.

## Criterios de cierre

- No hay KPIs sin fuente y periodo.
- Cambios de configuracion financiera se reflejan en calculos.
- Vista util en desktop y movil.
- Los usuarios entienden cuando faltan permisos externos y pueden resolverlo sin soporte tecnico.
