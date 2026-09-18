# Implementación fase 5 — estrategias y playbooks

## P00 / 5.00 — framework universal de playbooks

### Decisión de diseño

F5.00 es el contrato raíz de la fase. Mantiene separados:

- STRATEGY_PLAYBOOK_CONTEXT: referencias al ciclo de decisión, prioridad,
  diagnóstico, evidencia, restricciones y contexto del tenant.
- PLAYBOOK_TEMPLATE: conocimiento reusable, versionado e inmutable.
- PLAYBOOK_CANDIDATE_EVALUATION: aplicabilidad determinista bajo un contexto.
- PLAYBOOK_INSTANCE: adaptación concreta con lineage y trace.
- STRATEGY_PLAYBOOK_OUTPUT: disposición auditable para el siguiente consumidor.

La interfaz no contiene ranking, score, ejecución técnica, rollback operativo ni
aprendizaje. Los pasos son lógica de intervención, no tareas de Fase 8.

Las condiciones usan TRUE, FALSE y UNKNOWN. Un UNKNOWN no se convierte en
cumplimiento: según la política del template exige validación, bloquea o
permite continuar con limitaciones. La selección solo acepta templates ACTIVE
y nunca crea una intervención fuera del catálogo.

### Primera rebanada entregada

- Contrato y seis tests públicos en packages/contracts/src/playbook.ts y
  playbook.test.ts.
- Migración 20261028090000_f5_p00_playbook_framework.sql con catálogo de
  templates versionados, snapshots por organización, huella idempotente y RLS.
- Motor determinista apps/api/src/playbook-engine.ts, que consume los
  diagnósticos y la salida decisional de F3/F4, valida templates activos y
  persiste la disposición.
- Worker apps/worker/src/playbook-once.ts, API /v1/consultant/playbooks,
  panel apps/web/src/app/shopify/diagnostico/playbook.tsx y workflow
  .github/workflows/playbook-framework-p00.yml.

### Verificación

La migración se aplicó usando .env.local al proyecto de desarrollo
kopcblejsxpkxoykldyh. La prueba recorrió las cinco organizaciones
active/onboarding: 5 correctas, 0 fallidas y 5 assessments. Como aún no hay
templates activos sembrados en el catálogo, las cinco salidas fueron
NO_APPLICABLE_PLAYBOOK con cero candidatos; las cinco filas temporales se
eliminaron y el cleanup quedó en cero.

P00 queda hecho. F5 queda abierta y el siguiente bloque habilitado es P01 /
5.01, adquisición y generación de demanda.

## P01 / 5.01 — Adquisición y generación de demanda

### Decisión de contrato

El artefacto clasifica P01 como B, extensión del contrato universal P00. No se
crea `ACQUISITION_CONTRACT`, `ACQUISITION_OUTPUT` ni una entidad de canal o
audiencia duplicada. Se añadieron `domain` y `domain_extension` al template y
a la instancia universal, y `packages/contracts/src/acquisition.ts` expone el
value object `ACQUISITION_INTERVENTION_PROFILE` con:

- `acquisition_motion`;
- `target_population_ref` opcional;
- `channel_scope` y referencias de canal coherentes;
- `qualification_objective_ref` opcional;
- `acquisition_evidence_requirements`.

El validator impide extensión de adquisición fuera del dominio, exige
referencias para templates específicos/multicanal y exige población para
`AUDIENCE_EXPANSION`. No añade métricas, fórmulas ni thresholds al contrato.

### Runtime y persistencia

El flujo `03-runtime/5.01-flujo-diagnostico-seleccion-y-escalado-de-adquisicion.md`
se traduce en `apps/api/src/acquisition-engine.ts`: reutiliza la evaluación
determinista P00, filtra únicamente templates `ACQUISITION` válidos y declara
como `UNKNOWN` las evidencias de audiencia, canal, economics, medición,
inventario y capacidad que el proyecto no proporciona. El resultado continúa
siendo `STRATEGY_PLAYBOOK_OUTPUT`.

La única persistencia nueva es la columna/index `domain` sobre
`playbook_framework_runs`, mediante `20261028100000_f5_p01_acquisition_playbook.sql`.
El worker, workflow manual, endpoint `/v1/consultant/acquisition` y panel
`AcquisitionPlaybookPanel` consumen esa misma tabla. Sin templates activos no
se fabrica recomendación: la salida observada permanece
`NO_APPLICABLE_PLAYBOOK`.

### Verificación

- contrato: 4 pruebas P01 y suite completa de contracts verde (`650` tests);
- compilación: contracts, API, worker y typecheck web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: 5 organizaciones procesadas, 5 correctas, 0 fallos;
- cleanup: 0 filas temporales restantes;
- workflow: todas las variables exigidas por `loadApiEnv`, incluidas las de
  Shopify, declaradas.

P01 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P02 / 5.02, paid media y eficiencia de tráfico.

## P02 / 5.02 — Paid media y eficiencia de tráfico

### Decisión de contrato

El corpus no aporta un contrato runtime específico ni una entidad nueva: P02
es una especialización del framework universal P00. Se reutilizan
`playbookTemplateSchema`, `evaluatePlaybookFramework` y la instancia/salida
trazable de P00. El test público `packages/contracts/src/paid-media.test.ts`
fija la regla principal: un template `PAID_MEDIA` no autoriza por sí solo una
recomendación; con medición `UNKNOWN` queda en `VALIDATION_REQUIRED`.

### Runtime y persistencia

El flujo `03-runtime/5.02-flujo-diagnostico-recuperacion-y-escalado-paid-media.md`
se traduce en `apps/api/src/paid-media-engine.ts`: construye contexto Paid
Media sobre el contexto universal, declara como `UNKNOWN` medición, coste de
distribución, respuesta del anuncio, calidad de tráfico, conversión post-click,
economics, incrementalidad, inventario, capacidad operativa y cash-flow, y
evalúa solo templates `PAID_MEDIA`. No inventa CAC, ROAS, MER, presupuesto,
audiencia, umbrales ni atribución.

La migración `20261028110000_f5_p02_paid_media.sql` amplía el check de dominio
compartido de `playbook_framework_runs`. El worker, workflow manual, endpoint
`/v1/consultant/paid-media` y `PaidMediaPlaybookPanel` consumen la misma
persistencia de P00 y muestran la disposición/unknowns sin convertir métricas
de plataforma en una orden.

### Verificación

- contrato: suite completa de contracts verde (`652` tests);
- compilación: API, worker y typecheck/build web con `.env.local` verdes;
- migración: aplicada en el proyecto de desarrollo de `.env.local`;
- datos reales: plantilla temporal PAID_MEDIA y cinco organizaciones evaluadas,
  cinco `VALIDATION_REQUIRED` por medición insuficiente;
- worker real: cinco organizaciones, `5 succeeded`, `0 failed`, `5 assessments`;
- cleanup: plantilla, ejecuciones y filas del worker eliminadas; restante `0`.

P02 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P03 / 5.03, conversión y CRO.

### Integración transversal F4/F5 con el Copiloto

El adaptador `apps/api/src/decision-playbook-chat-context.ts` incorpora al
contexto de A09 los últimos snapshots de decisión de F4 y las evaluaciones de
playbooks de F5, siempre filtrados por `organization_id`. Reduce la salida a
estado, motivos, confianza, unknowns, evidencia, precondiciones, requisitos
de validación y stop conditions. Si falta un snapshot, el Copiloto recibe esa
ausencia explícitamente y no puede rellenarla por inferencia.

La integración se verifica con
`decision-playbook-chat-context.test.ts`, typecheck/build de API y worker, y
una lectura real en `.env.local` sobre las cinco organizaciones, con tres
bloques de contexto por organización y sin escrituras.

## P03 / 5.03 — Conversión y CRO

### Decisión de contrato

P03 reutiliza el framework universal P00 y añade la extensión acotada
`domain_extension.conversion_cro` en `packages/contracts/src/conversion-cro.ts`.
El perfil conserva modo de intervención (`FIX`, `RESEARCH` o `TEST`), etapa del
funnel, segmento, hipótesis, métrica primaria, guardrails, métrica económica y
requisitos de evidencia. Un template `TEST` exige hipótesis y métrica primaria.
No se han añadido benchmarks, umbrales, sample size, p-values ni significancia
estadística porque el corpus no los define.

### Runtime y persistencia

`apps/api/src/conversion-engine.ts` filtra templates `CONVERSION` válidos y
enriquece el contexto con `shopify_funnel_summary` de los últimos 30 días.
Solo convierte en `TRUE` la disponibilidad observada de sesiones y la
cobertura completa del funnel. Una cobertura parcial o un error de lectura
queda en `UNKNOWN`; el motor no infiere una fuga desde una tasa ni propone una
intervención sin etapa, evidencia y contexto económico. La migración
`20261028120000_f5_p03_conversion_cro.sql` amplía el dominio permitido de la
tabla universal. Worker, workflow, endpoint `/v1/consultant/conversion` y
`ConversionCroPlaybookPanel` consumen la misma salida trazable.

### Verificación

- contrato: validator CRO y motor puro verdes;
- compilación: contracts, API, worker y typecheck web verdes;
- migración: aplicada con `.env.local` sobre `kopcblejsxpkxoykldyh`;
- datos reales: template temporal, cinco organizaciones, cinco evaluaciones;
- resultado: `VALIDATION_REQUIRED` en las cinco por evidencia no suficiente;
- cleanup: template y las cinco ejecuciones temporales eliminados.

P03 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P04 / 5.04, oferta, pricing, merchandising y AOV.

## P04 / 5.04 — Oferta, pricing, merchandising y AOV

### Decisión de contrato

P04 añade `domain_extension.offer_pricing` en
`packages/contracts/src/offer-pricing.ts`. El perfil separa la familia de
intervención (bundle, cross-sell, upsell, threshold, cambio de precio,
promoción, merchandising, racionalización de SKU, liquidación, financiación o
escalera de producto), la métrica primaria, la métrica económica, guardrails,
productos afectados y reversibilidad. El validator exige dos productos para un
bundle y métrica primaria para un cambio de precio; no inventa descuentos,
elasticidades, márgenes mínimos, umbrales ni modelos estadísticos.

### Runtime y persistencia

`apps/api/src/offer-pricing-engine.ts` filtra templates `OFFER_PRICING` válidos
y enriquece el contexto con las RPC Shopify reales de ventas, margen, stock y
productos principales de los últimos 30 días. Declara como observables AOV,
descuentos, margen, catálogo e inventario solo cuando la respuesta los sostiene;
elasticidad de precio, incrementalidad de promociones y calidad de cliente
permanecen `UNKNOWN` porque no existe historial suficiente. El motor no optimiza
AOV aislado, no hace repricing automático y no recomienda una intervención
irreversible.

La migración `20261028130000_f5_p04_offer_pricing.sql` amplía el dominio de la
tabla universal. Worker, workflow, endpoint
`/v1/consultant/offer-pricing` y `OfferPricingPlaybookPanel` muestran la misma
salida trazable, incluyendo el bloqueo de validación y sus unknowns.

### Verificación

- contrato y validator: verdes;
- motor puro: AOV no se confunde con margen y stock se conserva separado;
- compilación: contracts, API, worker y web verificables;
- migración aplicada en el proyecto de `.env.local` `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones evaluadas;
- resultado: `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` en las cinco;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P04 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P05 / 5.05, retención, CRM, lifecycle y LTV.

## P05 / 5.05 — Retención, CRM, lifecycle y LTV

### Decisión de contrato

P05 añade `domain_extension.retention_crm` en
`packages/contracts/src/retention-crm.ts`. El perfil separa familia de
intervención (welcome, post-purchase, second purchase, replenishment, cross-sell,
win-back, loyalty, subscription, service recovery, proactive service, no-action
y contact policy), estado lifecycle, segmento, canal, incentivo, métricas,
consentimiento requerido y reversibilidad. El contrato no fija una state machine,
umbral universal de churn, fórmula obligatoria de LTV, frecuencia de contacto,
ventana de atribución ni significancia estadística porque el artefacto no las
define.

### Runtime y persistencia

`apps/api/src/retention-crm-engine.ts` filtra templates `RETENTION_CRM` válidos y
lee directamente el contexto disponible del tenant: conteo de clientes activos,
clientes con más de un pedido, estados lifecycle, ventas/refunds, cobertura de
coste, cuenta/flows/campaigns de Klaviyo y eventos de consentimiento. A partir de
ello declara solo disponibilidad observada de base, repeat, lifecycle,
contribution, CRM, refunds y consentimiento. Cohortes, LTV, churn,
suscripciones, incrementalidad y customer quality permanecen `UNKNOWN` cuando
no existe observación suficiente. No envía mensajes, no crea descuentos, no
predice churn y no sobrecomunica.

La migración `20261028140000_f5_p05_retention_crm.sql` amplía el dominio de la
tabla universal. El worker, el workflow manual
`.github/workflows/retention-crm-p05.yml`, el endpoint
`/v1/consultant/retention-crm` y `RetentionCrmPlaybookPanel` consumen la misma
salida trazable. El Copiloto recibe estas evaluaciones a través del adaptador
transversal F4/F5 ya existente, siempre aisladas por organización.

### Verificación

- contrato y validator: 3 tests verdes;
- motor puro: 2 tests verdes; base/repeat no se convierten en cohortes ni LTV;
- contracts completo: 661 tests verdes;
- API typecheck, worker build y web typecheck: verdes;
- migración aplicada en `.env.local`, proyecto `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones;
- resultado contado directamente: `5 succeeded`, `0 failed`, `5` filas,
  disposición conservadora `BLOCKED`;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P05 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P06 / 5.06, unit economics y rentabilidad.

## P06 / 5.06 — Unit economics y rentabilidad

### Decisión de contrato

P06 añade `domain_extension.unit_economics` en
`packages/contracts/src/unit-economics.ts`. El perfil declara familia de
intervención, unidad de análisis (pedido, cliente, SKU, canal, cohorte,
segmento, geografía o mercado), métrica económica, guardrails, escenario
opcional y reversibilidad. No fija CAC, payback, margen, LTV, contribution ni
presupuestos universales.

### Runtime y persistencia

`apps/api/src/unit-economics-engine.ts` implementa el flujo de 5.06 sobre el
framework P00. Lee en ventana de 90 días las RPC reales
`shopify_sales_summary`, `shopify_margin_summary` y
`shopify_financial_summary`. Declara por separado gross/discounts/refunds/net
revenue, pedidos, COGS, margen bruto, fees, shipping, fixed costs y resumen
financiero. No convierte `net_profit` en contribution porque el RPC existente
ya incluye costes fijos; CAC, payback, cash, cohortes, segmentación,
escenarios y comparabilidad quedan `UNKNOWN` hasta disponer de datos y
definiciones comparables.

La migración `20261028150000_f5_p06_unit_economics.sql` amplía el dominio
compartido. El worker, el workflow manual
`.github/workflows/unit-economics-p06.yml`, el endpoint
`/v1/consultant/unit-economics` y `UnitEconomicsPlaybookPanel` consumen la
misma salida trazable. El Copiloto la recibe mediante el adaptador transversal
F4/F5 ya existente, aislado por organización y en solo lectura.

### Verificación

- contrato: 3 tests P06 y suite completa de contracts (`664`) verdes;
- motor puro: 2 tests verdes; waterfall y resumen financiero no se confunden
  con contribution, CAC, payback o cash;
- compilación: API, worker y typecheck web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`, sin pendientes
  en `db:push:dry`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas contadas directamente;
- resultado: `VALIDATION_REQUIRED` en las cinco por comparabilidad,
  contribution y payback no demostrados;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P06 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P07 / 5.07, producto, catálogo e inventario.

## P07 / 5.07 — Producto, catálogo e inventario

### Decisión de contrato

P07 extiende el framework universal con
`domain_extension.product_inventory` en
`packages/contracts/src/product-inventory.ts`. El perfil separa movimiento de
intervención, superficie (producto, SKU, variante, categoría, catálogo,
inventario, reposición o proveedor), scope, referencias, estado de inventario,
relación demanda/supply, contexto de reposición y requisitos de evidencia.
Exige referencias para un scope de producto único y contexto de reposición
para `STOCKOUT_PREVENTION`. No crea entidades WMS, fórmulas de safety stock,
reorder point, forecast, supplier scoring ni compras automáticas.

### Runtime y persistencia

`apps/api/src/product-inventory-engine.ts` implementa el flujo de 5.07 sobre
P00. Lee catálogo y variantes del tenant, `shopify_stock_summary`, ventas y
margen en una ventana de 90 días. Declara solo cobertura observable de
catálogo, inventario, stock bajo/agotado, pedidos, velocidad y economics.
Mantiene `UNKNOWN` para overstock, forecast, reposición, proveedores, calidad,
precisión del inventario, demand/supply alignment y racionalización: un stock
absoluto no prueba demanda, exceso ni la acción correcta.

La migración `20261028160000_f5_p07_product_inventory.sql` amplía el dominio
compartido. El worker, el workflow manual
`.github/workflows/product-inventory-p07.yml`, el endpoint
`/v1/consultant/product-inventory` y `ProductInventoryPlaybookPanel` consumen
la salida trazable. El Copiloto la recibe mediante el adaptador transversal
F4/F5, aislado por organización y en solo lectura.

### Verificación

- contrato: 4 tests P07 y suite completa de contracts (`668`) verdes;
- motor puro: 2 tests verdes; stockout no se convierte en orden de compra y
  stock absoluto no se convierte en overstock;
- compilación: API typecheck, worker build y web typecheck verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas contadas directamente;
- resultado: `BLOCKED` conservador por snapshot, precisión y alignment no
  demostrados;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P07 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P08 / 5.08, operaciones, fulfillment y customer experience.

## P08 / 5.08 — Operaciones, fulfillment y customer experience

### Decisión de contrato

P08 extiende el framework universal con `domain_extension.operations_cx` en
`packages/contracts/src/operations-cx.ts`. El perfil separa movimiento
operativo, superficie, scope, referencias de entidad, impacto en clientes,
estado de capacidad, estado de servicio, contexto operativo y requisitos de
evidencia, servicio, economics y medición. El contrato impide declarar
recuperación de servicio sin alcance de clientes y exige contexto/SLA cuando
el servicio está en riesgo o incumplido.

### Runtime y persistencia

`apps/api/src/operations-cx-engine.ts` implementa el flujo de 5.08 sobre P00.
Lee `shopify_delivery_times`, `shopify_sales_summary` y el conteo tenant-scoped
de `shopify_returns` en una ventana de 90 días. Declara cobertura observable de
pedidos, fulfillment, preparación, tránsito, promesa y comparación de
puntualidad. Mantiene `UNKNOWN` para backlog, capacidad, cuello de botella,
costes, soporte, WISMO, recuperación de servicio y experiencia de cliente si
no hay una fuente específica; un retraso no se convierte en causa ni se culpa
al carrier por defecto.

La migración `20261028170000_f5_p08_operations_cx.sql` amplía el dominio
compartido. El worker, el workflow manual
`.github/workflows/operations-cx-p08.yml`, el endpoint
`/v1/consultant/operations-cx` y `OperationsCxPlaybookPanel` consumen la misma
salida trazable. El Copiloto la recibe mediante el adaptador transversal F4/F5,
aislado por organización y en solo lectura.

### Verificación

- contrato: 4 tests P08 y suite completa de contracts (`672`) verdes;
- motor puro: 2 tests verdes; la evidencia de entrega no se confunde con SLA,
  capacidad, backlog, soporte ni una causa raíz;
- compilación: API, worker y web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas contadas directamente;
- resultado: `VALIDATION_REQUIRED` en las cinco por capacidad/SLA no observados;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P08 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P09 / 5.09, datos, tracking y experimentación.

## P09 / 5.09 — Datos, tracking y experimentación

### Decisión de contrato

P09 extiende el framework universal con
`domain_extension.measurement_experimentation` en
`packages/contracts/src/measurement-experimentation.ts`. El perfil separa
movimiento de medición, superficie, alcance de datos, fuentes, eventos,
métricas, identidad, estado de calidad y diseño experimental. Cuando existe un
diseño causal exige modo, unidad, scope de tratamiento, primary outcome,
guardrails y requisitos de experimento antes de permitirlo. Una recuperación de
tracking no queda obligada a inventar un A/B test.

### Runtime y persistencia

`apps/api/src/measurement-experimentation-engine.ts` implementa el flujo de
5.09 sobre P00. Lee `shopify_sales_summary`, `shopify_funnel_summary` y
`shopify_sales_daily` en una ventana de 90 días. Declara disponibilidad de
pedidos, sesiones, pasos del funnel y baseline diario cuando la fuente existe,
pero mantiene `UNKNOWN` para completitud, precisión, consistencia, freshness,
uniqueness, lineage, semántica de eventos, identidad, atribución,
reconciliación, causalidad y capacidad experimental: ver datos no demuestra
que sean correctos ni que una intervención haya causado un resultado.

La migración `20261028180000_f5_p09_measurement_experimentation.sql` amplía el
dominio compartido. El worker, el workflow manual
`.github/workflows/measurement-experimentation-p09.yml`, el endpoint
`/v1/consultant/measurement-experimentation` y
`MeasurementExperimentationPlaybookPanel` consumen la salida trazable. El
Copiloto la recibe mediante el adaptador transversal F4/F5, aislado por
organización y en solo lectura.

### Verificación

- contrato: 4 tests P09 y suite completa de contracts (`676`) verdes;
- motor puro: 2 tests verdes; cobertura observada no se convierte en calidad,
  reconciliación ni evidencia causal;
- compilación: API, worker y web verdes;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas contadas directamente;
- resultado: `VALIDATION_REQUIRED` en las cinco por reconciliación y semántica
  no observadas;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P09 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P10 / 5.10, escalabilidad y eliminación de constraints.

## P10 / 5.10 — Escalabilidad y eliminación de constraints

### Decisión de contrato

P10 extiende el framework universal con `domain_extension.scalability` en
`packages/contracts/src/scalability-constraints.ts`. El perfil ancla cualquier
intervención a un `constraint_ref`, declara el `scale_scope`, el movimiento
estructural, los requisitos de readiness y la evidencia necesaria. No duplica
capacidad, utilización, throughput, headroom ni economics: los referencia y
mantiene los valores sin evidencia en `UNKNOWN`.

### Runtime y persistencia

`apps/api/src/scalability-constraints-engine.ts` implementa el flujo de mapear
el sistema, observar demanda/throughput y separar readiness de capacidad real.
Lee las RPC Shopify de ventas, margen, stock, delivery y serie diaria en una
ventana de 90 días. Declara cobertura cuando existe una fuente, pero no deduce
el bottleneck, la capacidad, el headroom, la fragilidad ni el siguiente
constraint del volumen actual. El worker, el workflow manual
`.github/workflows/scalability-p10.yml`, el endpoint
`/v1/consultant/scalability` y `ScalabilityPlaybookPanel` consumen la salida
universal trazable.

La pantalla presenta las señales como una lectura ordenada de cobertura: las
cards pueden reutilizar esta salida y el panel muestra visualmente qué está
observado y qué sigue pendiente, sin convertir un hueco de datos en una
recomendación de escala. La zona `InsightsMenu` existente, hermana de la
campana normal, queda como canal de avisos de IA y sus enlaces deben apuntar al
ancla de la card concreta; no se mezcla con las notificaciones generales.

### Verificación

- contrato: 3 tests P10 verdes y suite de contracts compilable;
- motor puro: 2 tests verdes; throughput observado no se convierte en capacidad
  ni bottleneck;
- compilación: API, worker y web;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: template temporal y cinco organizaciones; `5 succeeded`,
  `0 failed`, cinco filas contadas directamente;
- resultado: `VALIDATION_REQUIRED` en las cinco por capacidad/headroom y demás
  evidencias no observadas;
- cleanup: template y ejecuciones temporales eliminados, restante `0`.

P10 queda **hecho**. F5 continúa abierta y el siguiente bloque habilitado es
P11 / 5.11, recovery, crisis y playbooks transversales.

## P11 / 5.11 — Recovery, crisis y playbooks transversales

### Contrato y runtime

P11 queda implementado con `domain_extension.recovery_crisis` en
`packages/contracts/src/recovery-crisis.ts`. El contrato expresa el movimiento
de recuperación, el alcance, la continuidad, el containment, la estabilización,
la reversibilidad, la comunicación y la evidencia requerida. No crea una nueva
máquina de estados de incidentes ni declara una crisis a partir de un único KPI.

`apps/api/src/recovery-crisis-engine.ts` ejecuta el triage conservador sobre
ventas, delivery, stock y serie diaria Shopify. Distingue hechos observados de
hipótesis y desconocidos, pero deja `UNKNOWN` para crisis, severidad, blast
radius, customer impact, continuidad, containment, estabilización, baseline,
root cause y comunicación cuando no hay evidencia específica. El worker,
`.github/workflows/recovery-crisis-p11.yml`, el endpoint
`/v1/consultant/recovery-crisis` y `RecoveryCrisisPlaybookPanel` consumen la
salida universal y trazable.

### Integración transversal con la UI

`InsightsMenu` es una zona propia de IA, al lado de la campana de
notificaciones normal. Desde ahora consulta el feed tenant-scoped de
`/v1/consultant/ai-playbook-insights`, conserva el último assessment por
dominio y enlaza a `#insight-*` en la card exacta. La integración es transversal
a F5 y queda preparado para las salidas de fases anteriores y siguientes; el
feed actual consume los assessments F5 que ya comparten ese contrato, sin
inventar diagnósticos retrospectivos. No mezcla avisos de IA con notificaciones
generales. Las cards F5.01–F5.11 y
el resumen transversal tienen anclas estables para ese deep-link.

### Verificación y cierre

- contrato: 3 tests P11 verdes;
- motor puro: 2 tests verdes;
- compilación: contracts, API, worker y web verdes; worker: 41 tests;
- migración: aplicada con `.env.local` en `kopcblejsxpkxoykldyh`;
- datos reales: cinco organizaciones, `5 succeeded`, `0 failed`, cinco filas
  `VALIDATION_REQUIRED` y cleanup a cero;
- feed de IA real: assessment `SCALABILITY` sembrado temporalmente en
  `.env.local`, devuelto por las cinco consultas tenant-scoped y borrado al
  terminar;
- UI: seam público del feed 2/2 y build local con `.env.local` correcto.

P11 queda **hecho** y F5 queda **cerrada**. La siguiente fase habilitada por el
índice es F6, benchmarks y guardrails.
