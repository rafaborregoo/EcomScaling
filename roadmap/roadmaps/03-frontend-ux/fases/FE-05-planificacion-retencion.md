# FE-05 - Planificacion y retencion

> Corrección de estado 2026-08-02: FE-05 está en `implemented_partial`. Integraciones muestra el estado
> real de Klaviyo y su métrica de conversión, y `/marketing` permite generar, editar, versionar y revisar
> borradores. El calendario/reporting visual completo, stock, lead time, safety stock y forecast siguen
> pendientes; no se presentan como implementados.

## Estado

- **Estado real:** `implemented_partial` (hay superficies de integración y contenido revisable; el plan
  de retención, reporting visual y stock/forecast permanecen incompletos).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** BE-06, DB-09
- **Bloqueador:** ninguno tecnico; sin empezar.
- **Evidencia vigente:** `apps/web/src/app/integraciones/page.tsx` y `apps/web/src/app/marketing/page.tsx`;
  la ausencia de calendario/forecast no debe confundirse con ausencia total de código.
- **Gaps identificados:**
  - Agrupa Klaviyo + campanas + stock, tres subdominios sin relacion visual/tecnica directa; dividir en
    FE-05A-klaviyo.md, FE-05B-campaign-calendar.md, FE-05C-stock-planning.md antes de disenar pantallas.
  - El forecast de stock necesita mostrar formula, supuestos, intervalo de confianza, datos faltantes,
    explicacion de la recomendacion y trazabilidad de cambios al lead time — nada de esto esta definido
    (depende de que BE-06C defina la formula primero).
- **Siguiente accion:** ninguna hasta que BE-06/DB-09 tengan contrato definido.

## Objetivo

Cubrir Klaviyo, campanas mensuales y planificacion de stock.

## Entregables

- Estado conexion Klaviyo.
- Flows, campanas, forms y metricas principales.
- Calendario/listado de campanas.
- Stock, lead time, safety stock, forecast y alertas.

## Criterios de cierre

- Las recomendaciones de stock muestran supuestos.
- Campanas pueden cruzarse con productos y stock.
- Klaviyo muestra periodo, fuente y freshness.
