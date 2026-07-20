# FE-05 - Planificacion y retencion

## Estado

- **Estado real:** `planned` (no iniciado — depende de BE-06/DB-09, ninguno de los dos existe todavia).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** BE-06, DB-09
- **Bloqueador:** ninguno tecnico; sin empezar.
- **Evidencia:** ninguna — sin codigo.
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

