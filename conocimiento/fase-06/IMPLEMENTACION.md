# Fase 6 — Benchmarks y guardrails

## P00 / 6.00 — Framework universal de benchmarks y guardrails

P00 queda **hecho** con contrato, motor puro, persistencia sobre el framework
universal de playbooks, worker, workflow manual, API y pantalla de consultor.

El contrato `packages/contracts/src/benchmark-guardrails.ts` separa tipos de
benchmark, contexto de comparación, economics, familias de guardrails,
requisitos de evidencia y confianza. No introduce thresholds universales ni
convierte una referencia en objetivo.

`apps/api/src/benchmark-guardrails-engine.ts` lee ventas, funnel, margen,
stock, delivery y serie diaria Shopify. Marca como observados los datos propios
disponibles, pero conserva `UNKNOWN` para definición, comparabilidad, benchmark
externo/peer, guardrails, materialidad y confianza que no pueden demostrarse.
La secuencia queda separada de diagnóstico, priorización y playbook.

La pantalla `BenchmarkGuardrailsPanel` usa el ancla
`#insight-benchmark-guardrails`. `InsightsMenu` lo descubre mediante el feed
transversal tenant-scoped, separado de las notificaciones normales; el patrón
queda preparado para P00–P13 y para las salidas compatibles de F3/F4.

### Verificación

- contrato: 3 tests P00 verdes;
- motor puro: 2 tests verdes;
- compilación: API, worker y web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

La siguiente rebanada habilitada es F6/P01, contextualización y cohortes
comparables.

## P01 / 6.01 — Contextualización y cohortes comparables

P01 queda **hecho** con contrato, motor puro, persistencia sobre el framework
universal de playbooks, worker, workflow manual, API y pantalla de consultor.

El contrato `packages/contracts/src/cohort-context.ts` representa la métrica,
dimensiones materiales, tipos de referencia, prioridad de proximidad,
compatibilidad de definiciones, requisitos de muestra, controles de mix y
limitaciones. No crea una cohorte universal, un score de comparabilidad ni
thresholds inventados.

`apps/api/src/cohort-context-engine.ts` observa la métrica, muestra, periodo e
histórico que las RPC reales de Shopify pueden demostrar. Conserva
`UNKNOWN` para contexto tenant, segmentos, referencia, definiciones
compatibles, mix, adecuación de muestra, comparabilidad y confianza cuando
esas dimensiones no existen en las fuentes consultadas. La card
`CohortContextPanel` queda anclada en `#insight-cohort-context` y la entrada de
`InsightsMenu` mantiene el canal de IA separado de las notificaciones
normales.

### Verificación

- contrato: 3 tests P01 verdes;
- motor puro: 2 tests verdes;
- compilación: API, worker y web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P01 queda hecho. El siguiente bloque habilitado es F6/P02.

## P02 / 6.02 — Calidad, suficiencia y fiabilidad de los datos

P02 queda **hecho** con contrato, motor puro, persistencia sobre el framework
universal de playbooks, worker, workflow manual, API y pantalla de consultor.

El contrato `packages/contracts/src/data-quality-reliability.ts` representa la
identidad de la métrica, dimensiones de calidad, source of truth según la
pregunta, tipo de evidencia, muestra, maduración, missingness, reconciliación,
checks matemáticos, limitaciones y confianza. No duplica el contrato D01 ni
inventa un score universal de calidad.

`apps/api/src/data-quality-reliability-engine.ts` reutiliza las evaluaciones
reales de D01 y las contrasta con ventas, funnel y serie diaria de Shopify.
Puede declarar cobertura, frescura, granularidad, trazabilidad y existencia de
issues observables; mantiene `UNKNOWN` para definición, source of truth,
reconciliación, checks matemáticos, maduración y confianza cuando no están
demostrados. La card `DataQualityReliabilityPanel` queda anclada en
`#insight-data-quality-reliability`, separada de la pantalla de incidencias D01
de Integraciones, y conectada al `InsightsMenu` de IA independiente de las
notificaciones normales.

### Verificación

- contrato: 3 tests P02 verdes;
- motor puro: 2 tests P02 verdes;
- compilación: API, worker y web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P02 queda hecho. El siguiente bloque habilitado es F6/P03.

## P03 / 6.03 — Benchmarks y guardrails de adquisición y generación de demanda

P03 queda **hecho** con contrato, motor puro, persistencia sobre el framework
universal de playbooks, worker, workflow manual, API y pantalla de consultor.

El contrato `packages/contracts/src/acquisition-demand.ts` representa nuevos
clientes, CAC, economics, calidad de cliente, roles de canal, dependencia,
eficiencia marginal, cohortes, restricciones e incrementalidad. No convierte
tráfico en demanda, ROAS en salud ni benchmarks externos en objetivos.

`apps/api/src/acquisition-demand-engine.ts` lee ventas, funnel, recurrencia,
valor de cliente, margen, resumen financiero, stock e histórico de Shopify.
Puede observar pedidos nuevos/recurrentes, economics, calidad parcial de
cliente e inventario; conserva `UNKNOWN` para gasto, CAC, CAC marginal, mix,
roles de canal, demanda generada, dependencia, payback, maduración,
incrementalidad y confianza cuando no existe una fuente compatible. La card
`AcquisitionDemandPanel` queda anclada en `#insight-acquisition-demand` y
conectada al `InsightsMenu`, separado de las notificaciones normales.

### Verificación

- contrato: 3 tests P03 verdes;
- motor puro: 2 tests P03 verdes;
- compilación: API, worker y web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P03 queda hecho. El siguiente bloque habilitado es F6/P04.

## P04 / 6.04 — Benchmarks y guardrails de Paid Media y eficiencia de tráfico

P04 queda **hecho** con contrato, motor puro, persistencia sobre el framework
universal de playbooks, worker, workflow manual, API y pantalla de consultor.

El contrato `packages/contracts/src/paid-media-benchmarks.ts` mantiene este
bloque separado del Paid Media operativo de F5.02 mediante el dominio
`PAID_MEDIA_BENCHMARKS`. Exige objetivo, cadena de métricas, contexto de
benchmark y limitaciones; no inventa umbrales, score, asignación de presupuesto
ni ejecución de campañas.

`apps/api/src/paid-media-benchmarks-engine.ts` contrasta delivery, respuesta,
tráfico, post-click, adquisición, revenue, economics y atribución con las
fuentes Meta/Shopify disponibles. Deja `UNKNOWN` para objetivo de campaña,
mix de cliente, incrementalidad, escala marginal, saturación, guardrails
tenant-specific y confianza cuando no existe evidencia compatible. La card
`PaidMediaBenchmarksPanel` queda anclada en
`#insight-paid-media-benchmarks` y conectada al `InsightsMenu`, separado de
las notificaciones normales.

### Verificación

- contrato: 3 tests P04 verdes;
- motor puro: 2 tests P04 verdes;
- compilación: API, worker y feed de `InsightsMenu` verdes;
- migración `20261029130000_f6_p04_paid_media_benchmarks.sql`: aplicada con
  `.env.local` en el proyecto de desarrollo `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P04 queda hecho. La siguiente rebanada habilitada es F6/P05.

## P05 / 6.05 — Benchmarks y guardrails de conversión y CRO

P05 queda **hecho** con contrato específico, motor puro con tests, runtime
sobre fuentes reales de Shopify, persistencia universal de playbooks, worker,
workflow, endpoint y panel de consultor. El dominio separado
`CONVERSION_CRO_BENCHMARKS` evita mezclar esta evaluación de benchmarks,
economics y guardrails con el playbook operativo de conversión de F5.03.

El contrato exige definición del denominador, funnel, segmentación, mix,
economics, evidencia técnica, contexto de oferta, hipótesis, experimentos,
guardrails, oportunidad, método, aprendizaje y limitaciones. El motor observa
sesiones, add-to-cart, checkout, purchases, pedidos, revenue, AOV derivable,
margin/contribution, histórico, returns, oferta, inventario y operaciones
cuando las RPC los demuestran. Mantiene `UNKNOWN` para product views,
fricción técnica, experimentos, benchmark comparable, customer quality,
oportunidad económica y guardrails no observados; no interpreta la tasa como
causa ni asume que todo abandono es recuperable.

### Verificación

- contrato: 3 tests P05 verdes;
- motor puro: 2 tests P05 verdes;
- compilación: API, worker y panel web verdes;
- migración `20261029140000_f6_p05_conversion_cro_benchmarks.sql`: aplicada
  con `.env.local` en el proyecto de desarrollo;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas `VALIDATION_REQUIRED` por `problem_refs` desconocidos
  y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P05 queda hecho. La siguiente rebanada habilitada es F6/P06.

## P06 / 6.06 — Benchmarks y guardrails de oferta, pricing, merchandising y AOV

P06 queda **hecho** con contrato separado del playbook operativo F5.04,
validator, motor puro con tests, runtime Shopify, migración, worker, workflow,
endpoint y panel de consultor. El dominio `OFFER_PRICING_BENCHMARKS` evita que
una evaluación de monetización se convierta en cambio automático de precio,
promoción o merchandising.

El flujo observa AOV, UPT, pedidos, revenue, funnel, contribution por pedido,
histórico, product mix, promociones, returns, inventario y cobertura de
merchandising cuando existen fuentes compatibles. Conserva `UNKNOWN` para
pricing, elasticidad, incrementalidad, customer quality, benchmark comparable
y guardrails no demostrados. La card deja explícito que AOV alto no equivale a
profit, descuento usado no equivale a ventas incrementales y revenue no basta
para declarar ganadora una promoción.

### Verificación

- contrato: 3 tests P06 verdes;
- motor puro: 2 tests P06 verdes;
- compilación: API, worker y panel web verdes;
- migración `20261029150000_f6_p06_offer_pricing_benchmarks.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` conservadoras y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P06 queda hecho. La siguiente rebanada habilitada es F6/P07.

## P07 / 6.07 — Benchmarks y guardrails de retención, CRM y LTV

P07 queda **hecho** con contrato separado de F5.05, validator, motor puro con
tests, runtime sobre clientes Shopify y configuración Klaviyo, migración,
worker, workflow, endpoint y panel de consultor. El dominio
`RETENTION_CRM_BENCHMARKS` permite evaluar la calidad de la relación con el
cliente sin convertir una repeat rate agregada en churn, LTV o causalidad.

El flujo observa identidad/base de clientes, repeat customers, estados,
pedidos, contribution, configuración CRM, consentimiento e histórico cuando
las fuentes lo permiten. Conserva `UNKNOWN` para ciclo natural, cohortes y
madurez, segunda compra, LTV, churn, customer quality e incrementalidad no
demostrados. La salida recuerda que el revenue atribuido a CRM no prueba
revenue incremental y que LTV predicho no es contribution observada.

### Verificación

- contrato: 3 tests P07 verdes;
- motor puro: 2 tests P07 verdes;
- compilación: API y worker verdes;
- migración `20261029160000_f6_p07_retention_crm_benchmarks.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` conservadoras y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P07 queda hecho. La siguiente rebanada habilitada es F6/P08.

## P08 / 6.08 — Benchmarks y guardrails de unit economics y rentabilidad

P08 queda **hecho** con contrato separado de F5.06, validator, motor puro con
tests, runtime sobre ventas, margen y resumen financiero de Shopify, migración,
worker, workflow, endpoint y panel de consultor. El flujo separa gross/net
revenue, descuentos, refunds, COGS, costes variables, costes fijos y gross
profit; no convierte `net_profit` en contribution, CAC, payback o cash por
defecto.

### Verificación

- contrato: 3 tests P08 verdes;
- motor puro: 2 tests P08 verdes;
- compilación: API y worker verdes;
- migración `20261029170000_f6_p08_unit_economics_benchmarks.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P08 queda hecho. La siguiente rebanada habilitada es F6/P09.

## P09 / 6.09 — Benchmarks y guardrails de operaciones y experiencia de cliente

P09 queda **hecho** con contrato separado de F5.08, validator, motor puro con
tests, runtime sobre delivery, ventas, returns e histórico Shopify, migración,
worker, workflow, endpoint y panel de consultor. El motor exige una promesa o
ventana comparable para hablar de puntualidad y conserva `UNKNOWN` para
capacidad, backlog, support, CX y coste no observados.

### Verificación

- contrato: 3 tests P09 verdes;
- motor puro: 2 tests P09 verdes;
- compilación: API y worker verdes;
- migración `20261029180000_f6_p09_operations_cx_benchmarks.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` y cleanup a cero;
- `db:push:dry`: sin migraciones pendientes tras la aplicación.

P09 queda hecho. La siguiente rebanada habilitada es F6/P10.

## P10 / 6.10 — Benchmarks y guardrails de inventario y salud comercial

P10 queda **hecho** con contrato separado de F5.07, validator, motor puro con
tests, runtime Shopify, migración, worker, workflow, endpoint y panel de
consultor. El flujo observa catálogo, stock, available-to-sell, demanda,
velocity, stockouts, margen e histórico cuando existen fuentes compatibles;
mantiene `UNKNOWN` para coverage, forecast, aging, lead time, accuracy,
supplier y replenishment no demostrados.

### Verificación

- contrato: 3 tests P10 verdes;
- motor puro: 2 tests P10 verdes;
- compilación: API, worker y panel web verdes en el código F6;
- migración `20261029190000_f6_p10_product_inventory_benchmarks.sql`: aplicada
  con `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` por `problem_refs` desconocidos y cleanup a cero.

P10 queda hecho. La siguiente rebanada habilitada es F6/P11.

## P11 / 6.11 — Benchmarks y guardrails de escalabilidad y límites

P11 queda **hecho** con contrato, validator, motor puro con tests, runtime
Shopify, migración, worker, workflow, endpoint y panel. Separa objetivo de
crecimiento, economics, capacidad, headroom, bottleneck y scale state; con las
fuentes actuales solo declara cobertura de demanda, economics, inventario,
operaciones e histórico, sin llamar `UNKNOWN` a headroom o bottleneck como si
fueran hechos.

### Verificación

- contrato: 3 tests P11 verdes;
- motor puro: 2 tests P11 verdes;
- migración `20261029200000_f6_p11_scalability_benchmarks.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` y cleanup a cero.

P11 queda hecho. La siguiente rebanada habilitada es F6/P12.

## P12 / 6.12 — Anomalías, red flags y combinaciones peligrosas

P12 queda **hecho** con contrato, validator, motor puro con tests, runtime
Shopify, migración, worker, workflow, endpoint y panel. El runtime valida que
hay observaciones, historia y fuentes; no etiqueta anomalía, red flag ni
pattern sin baseline, desviación, relación esperada y validación de tracking.

### Verificación

- contrato: 3 tests P12 verdes;
- motor puro: 2 tests P12 verdes;
- migración `20261029210000_f6_p12_anomalies_red_flags.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` y cleanup a cero.

P12 queda hecho. La siguiente rebanada habilitada es F6/P13.

## P13 / 6.13 — Confianza, incertidumbre y comunicación del benchmark

P13 queda **hecho** con contrato, validator, motor puro con tests, runtime
Shopify, migración, worker, workflow, endpoint y panel. La salida separa claim,
evidencia, scope, data confidence, comparator, pattern, cause e intervention;
no calcula una media global de confianza ni convierte confianza en autorización
para ejecutar cambios.

### Verificación

- contrato: 3 tests P13 verdes;
- motor puro: 2 tests P13 verdes;
- migración `20261029220000_f6_p13_benchmark_confidence.sql`: aplicada con
  `.env.local`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` y cleanup a cero.

F6 queda cerrada completa: `P00`–`P13` están hechos y cada bloque tiene
contrato, motor, runtime, persistencia, worker, API, panel y entrada en
`InsightsMenu`.

## Nota transversal posterior al cierre — Copiloto-first

El cierre anterior acredita contrato, motor y pixel de F6. Antes de abrir F7
queda pendiente la auditoría común de consumo por Copiloto: el contexto actual
ya lee los assessments tenant-scoped y `InsightsMenu` ya enlaza cada card, pero
hay que confirmar por bloque la semántica de benchmarks, `UNKNOWN`,
`VALIDATION_REQUIRED`, procedencia, permisos y aislamiento. Esta auditoría se
coordina en `conocimiento/TAREAS_PENDIENTES.md`; no convierte F6 en un motor de
escritura ni autoriza cambios automáticos.
