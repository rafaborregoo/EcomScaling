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
