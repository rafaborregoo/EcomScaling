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
