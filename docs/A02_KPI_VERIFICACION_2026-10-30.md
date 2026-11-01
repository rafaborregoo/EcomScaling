# A02: recuperación de páginas y valoraciones por KPI

Fecha: 30/10/2026. Cuenta TEST: borregorafa99@gmail.com. Consultor: rafael@noraapp.es.

## Páginas

`http://localhost:3001/dashboard?tab=todo` devolvía HTTP 404 aunque el archivo de ruta y su entrada en el manifiesto existían. Reiniciar el proceso `next dev` recuperó la ruta, sin modificar ni eliminar páginas. El marco persistente explicaba que siguiera visible la navegación mientras el contenido mostraba 404.

Comprobadas después por HTTP con resultado 200: Dashboard Todo, Shopify, Meta, Klaviyo, Rentabilidad y Laboratorio IA. No se eliminaron cachés ni datos.

## Ejecuciones

Se utilizó `scripts/a02-refresh-kpi-lab.mts` contra TEST, con el constructor de contexto y la persistencia del runtime real. Solo la generación del modelo se transportó a Codex CLI, solicitando `gpt-6.1-terra`, con razonamiento medium y herramientas CLI deshabilitadas. No se hicieron peticiones a la API de modelos. No se verifica el ID servido, porque la salida JSONL de Codex no lo expone; queda registrado en `ai_lab`.

Los resultados vigentes incluyen la tienda activa E-NORA Demo y el alcance completo de su organización, a 30 días:

| Vista | KPI por alcance | Resultados vigentes |
| --- | ---: | ---: |
| Resumen general | 8 | 2 |
| Shopify | 5 | 2 |
| Meta | 4 | 2 |
| Klaviyo | 8 | 2 |
| Rentabilidad del consultor | 7 | 2 |
| Total | 32 | 10 |

Son 64 valoraciones vigentes. Cada clave debe aparecer exactamente una vez y cada resumen tiene diez palabras como máximo. Se generaron 12 llamadas CLI en total: las dos primeras de Rentabilidad quedaron sustituidas al completar el inventario de sus tarjetas. La estimación de catálogo para las 12 llamadas es 0,398852 USD; no representa un cargo API. Se conserva el uso reportado y la procedencia por ejecución.

Evidencias y respuestas completas: `.e-nora-test-lab/a02-kpi-refresh/`, carpetas `2026-10-30T09-49-15-315Z`, `2026-10-30T09-50-21-042Z` y `2026-10-30T09-53-35-413Z`.

## Correcciones

- Avisos de A02 enlazados a las tarjetas correspondientes, con valoración y modal de detalle.
- Eliminada la duplicación de hallazgos al combinar secciones y su copia plana.
- Protegidos dos accesos a propuestas opcionales del analista de email en Klaviyo.
- Añadidos enlaces de valoración a las tarjetas de Rentabilidad de cliente y tienda. Sus claves distinguen ingresos sin IVA, ticket sin IVA y margen neto; no se reutilizan claves de ventas con impuestos o margen bruto.
- Migración `20270115110000_a02_panel_kpi_coverage.sql` aplicada y registrada en TEST y producción: agente v13, prompt v12, Terra. Las respuestas de laboratorio se guardaron exclusivamente en TEST.

## Comprobaciones

- Compilación de `@e-nora/ai`: correcta.
- TypeScript web: correcto después de las correcciones.
- Pruebas existentes de alcance A02/panel: 6 de 6 correctas.
- Peticiones HTTP autenticadas con ambas cuentas: 18 lecturas correctas. Cliente y consultor reciben los mismos IDs en las cuatro vistas compartidas, tanto por tienda como por organización. Las dos lecturas del panel interno desde cliente devuelven 403, como corresponde.
- Las 18 lecturas validan el conjunto exacto de KPI, resúmenes de diez palabras como máximo y estado aprobado sin intervención humana. Evidencia: `.e-nora-test-lab/a02-kpi-refresh/access-verification.json`.
- Verificación visual del navegador: pendiente de completar; no se confunde la comprobación HTTP con una revisión visual.

La aplicación web funciona en localhost. Este trabajo no incluye un despliegue de la aplicación web a producción.
