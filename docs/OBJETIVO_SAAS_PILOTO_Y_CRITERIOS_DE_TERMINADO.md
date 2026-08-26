# Objetivo global de EcomScaling

> **Estado ejecutivo vigente 2026-08-26:** el núcleo del piloto está implementado. Shopify es el
> conector operativo; Meta Ads, Klaviyo e Instagram están preparados para activarse sin rediseñar la
> UI ni los agentes. Supabase está alineado con 71 migraciones locales/remotas y los tipos oficiales
> se regeneraron desde `public,private`. Lo pendiente real es validación con proveedores, QA manual
> final, restore drill y observabilidad/APM avanzada; no falta construir un CRM completo.

> Estado canonico vigente 2026-08-24: hay 64 migraciones locales/remotas alineadas, con
> `supabase db push --linked --include-all --dry-run` al dia y `supabase db lint` sin errores.
> Las cifras 55/56/59/60 que aparecen mas abajo pertenecen a auditorias historicas y quedan
> supersedidas por esta correccion y por `ESTADO_GLOBAL.md`.

> Evidencia de cierre parcial 2026-08-24: gates de producto/UI/accesibilidad/enlaces pasan; contratos
> de integraciones 14/14 y suite IA 50/50 pasan con runners directos. El CI manual genera SBOM,
> construye y escanea API/worker con Trivy. Shopify es el unico conector operativo; Meta/Klaviyo/
> Instagram siguen preparados sin datos ficticios. El objetivo global permanece abierto por el
> restore drill, validaciones externas y gaps de profundidad/APM que este documento exige verificar.

> Correccion operativa 2026-08-02: los feature flags de integraciones son un allowlist real en
> rutas HTTP, callbacks OAuth, sincronizaciones internas y reconciliacion programada. Meta Ads y
> Klaviyo pueden permanecer preparados sin credenciales reales, pero no se ejecutan por un bypass
> interno cuando el proveedor esta desactivado.

> Observabilidad vigente 2026-08-24: el API registra requests HTTP y runs/coste
> IA con etiquetas de baja cardinalidad, sin prompts ni datos de tenant. Esto
> cubre el piloto en una instancia; la agregacion compartida y APM se activan
> cuando exista la infraestructura externa correspondiente.

> Actualizacion vigente 2026-08-20: se aplico en produccion la foundation DB-10 de Instagram, aditiva
> y sin datos. Hay 64 migraciones locales/remotas alineadas; dry-run y
> lint de Supabase pasan.

> Verificacion adicional 2026-08-02: el catalogo UI vigente centraliza tambien `Drawer`,
> `RouterProvider`, `Alert`, `Modal` y `Toast` en `apps/web/src/components/ui`; el typecheck web y
> la suite API completa pasan. `packages/ui` queda como historial sustituido por ADR-0015, sin crear
> un segundo catalogo que pueda divergir.

> Evidencia de gates 2026-08-20: CI verifica que no haya imports HeroUI fuera del catálogo UI
> (`scripts/assert-ui-catalog-surface.mjs`) y que DB-10 conserve sus seis tablas con RLS,
> políticas tenant, grants de lectura y ninguna mutación de datos de negocio
> (`scripts/assert-instagram-foundation.mjs`).

> Nota histórica supersedida: una auditoría intermedia registró 59 migraciones locales y remotas.
> DB-09 usa `20260802140000_db_09_klaviyo_foundation.sql` y los alineamientos `20260802150000`,
> `20260802150100` y `20260802151000`, todos aplicados.

> Nota histórica supersedida: posteriormente se aplicó la compatibilidad condicional de enums de DB-09
> (`20260802152000`) y el total vigente pasó a 60 antes de los forward-fixes posteriores.

> Nota histórica supersedida: una auditoría intermedia registró 132 archivos Markdown y 59 migraciones;
> el estado vigente es el de la cabecera (134 Markdown y 64 migraciones locales/remotas alineadas) y no hay migraciones
> pendientes según el dry-run. Klaviyo ya tiene DB-09 aplicada y un vertical slice parcial de OAuth,
> credenciales cifradas, sync agregado, Reporting API, métrica de conversión y reconciliación programada.
> Siguen pendientes la validación externa, el backfill profundo, el reporting visual y las pruebas con
> una cuenta real.

> La auditoría de estado real, evidencias y gaps vivos se mantiene en [AUDITORIA_ESTADO_REAL_PILOTO.md](./AUDITORIA_ESTADO_REAL_PILOTO.md).

> Documento canónico de producto y ejecución. Si un roadmap, briefing o fase contradice este documento,
> debe actualizarse antes de considerar cerrada la fase. La implementación real (código, migraciones,
> tests y evidencias) prevalece sobre cualquier intención histórica no verificada.

## Objetivo

Convertir EcomScaling en una aplicación SaaS funcional y preparada para un piloto real, partiendo del
estado actual del repositorio.

Shopify es la única integración operativa actualmente. Meta Ads, Klaviyo e Instagram deben quedar
preparados mediante contratos, adaptadores, feature flags, estados de producto completos y datos
simulados controlados únicamente para desarrollo/demo/shadow; nunca se deben presentar datos simulados
como datos reales ni depender de credenciales que todavía no existen.

El producto debe poder activarse con una cuenta Shopify real y, cuando se disponga de las credenciales y
permisos de cada proveedor, conectar los demás canales sin rehacer la UI, los contratos de dominio, los
agentes ni el modelo de permisos. “Conectar el proveedor” debe ser una activación/configuración del
adaptador y de sus capacidades, no un rediseño del producto.

## Alcance obligatorio

### Fundación de IA y Tool Layer

El objetivo incluye construir la infraestructura IA sobre un Tool Layer centralizado: schemas Zod versionados,
permisos runtime (`read`, `propose`, `write`, `admin`), coste declarado, errores corregibles, paginación,
provenance, idempotencia, dry-run, rollback, auditoría y observabilidad. El inventario y orden de implementación
se mantienen en `roadmap/roadmaps/05-agentes-ia/fases/AI-00A-tool-layer-foundation.md`.

La generación de emails y plantillas de Klaviyo con IA produce borradores reutilizables y HTML sanitizado.
Publicar flows o enviar campañas requiere conexión válida, scopes, preview, aprobación humana, idempotencia y
rollback; la ausencia de credenciales debe mostrarse como estado honesto y nunca como éxito simulado.

- Auditar los archivos Markdown, el código y las migraciones para que la documentación refleje el estado
  real, las contradicciones y el trabajo pendiente.
- Completar el portal del cliente y el panel del consultor.
- Mantener una UI/UX personalizada, responsive, accesible y consistente, basada en componentes
  reutilizables y patrones compartidos.
- El design system debe tener un único origen de verdad. En el estado actual ese origen es
  `apps/web/src/components/ui` sobre HeroUI v3, conforme a ADR-0015; no se crea un `packages/ui` paralelo
  que duplique componentes. Si aparecen otros consumidores de UI, se deberá aprobar una extracción a un
  paquete compartido y migrar todos los imports de forma atómica.
- Cubrir dashboard, tareas, alertas, llamadas, plan estratégico, integraciones, conocimiento y
  Consultor IA.
- Ejecutar agentes IA auditables, con evidencia, citas, límites de coste, aprobación humana, shadow mode
  y aislamiento multi-tenant.
- Implementar de forma consistente los estados de loading, empty, error, datos incompletos, conector no
  disponible, demo y shadow.
- Mantener Shopify end-to-end: OAuth, sincronización inicial e incremental, webhooks, reconciliación,
  métricas y diagnósticos.
- Preparar Meta Ads, Klaviyo e Instagram con contratos de capacidades, ciclo de vida de conexión,
  selección de activos, paginación, sincronización, errores, reautorización y feature flags, aunque no
  haya todavía una cuenta real conectada.
- Mantener seguridad, RLS, permisos por capacidades, aislamiento por organización, observabilidad,
  auditoría, tests, CI, runbooks y documentación.
- Tratar la base de datos productiva como datos reales: priorizar lecturas y verificaciones seguras; no
  borrar ni sobrescribir datos sin autorización explícita; revisar migraciones y contexto de base de
  datos antes de modificar SQL.

## Reglas de implementación

1. La UI consume contratos normalizados del dominio y no payloads específicos de un proveedor.
2. Cada conector declara capacidades y estados honestos: disponible, no configurado, pendiente de
   autorización, conectado, incompleto, degradado, reautorización requerida, no disponible o demo.
3. Los IDs externos, cursores de paginación, ventanas de atribución, permisos y freshness se conservan
   con trazabilidad; no se inventan nombres, cuentas, métricas ni resultados.
4. Las capacidades de escritura de un conector y las acciones de los agentes requieren permisos y, cuando
   corresponda, aprobación humana explícita.
5. Los datos simulados solo pueden entrar por fixtures/seed/demo/shadow claramente etiquetados y nunca por
   la ruta normal de producción.
6. Un componente o contrato compartido se reutiliza antes de crear una variante específica de pantalla o
   proveedor.
7. Una fase solo se cierra con evidencia reproducible: test, build, validación de contrato, consulta segura
   o verificación externa claramente identificada.

## Definition of Done global

**Correccion AI-13 (2026-08-02):** el modo shadow de los agentes queda
persistido y auditable en `agent_runs.execution_mode`, con `shadow` como valor
por defecto; la UI no es la fuente unica de esa garantia.

Además de los criterios de este documento, el Tool Layer debe tener catálogo central verificable, tools de
lectura/contexto y propuestas, y acciones de escritura con idempotencia, auditoría, rollback y degradación.

El objetivo se considera alcanzado cuando:

- una cuenta Shopify real puede completar conexión, sincronización, métricas, navegación y uso semanal;
- cada módulo tiene estados de producto completos y no muestra datos falsos como reales;
- los agentes operan en shadow mode, dejan evidencia/citas y cualquier propuesta de escritura pasa por
  revisión humana;
- un usuario o consultor de una organización no puede leer ni modificar datos de otra;
- Meta Ads, Klaviyo e Instagram tienen contratos y superficies de conexión/estado listas para activarse
  con credenciales reales sin rediseños;
- los tests, typechecks, builds y controles de CI pertinentes pasan, y las excepciones quedan documentadas;
- la documentación, el estado global, los riesgos y los runbooks coinciden con el código, las migraciones
  aplicadas y la evidencia disponible.

## Referencias por dominio

- [Roadmap operativo](../roadmap/00_INDICE_ROADMAPS_OPERATIVOS.md)
- [Estado global y evidencias](../roadmap/roadmaps/99-decisiones-y-seguimiento/ESTADO_GLOBAL.md)
- [Integraciones](../roadmap/roadmaps/04-integraciones/README.md)
- [Frontend y UX](../roadmap/roadmaps/03-frontend-ux/README.md)
- [Agentes IA](../roadmap/roadmaps/05-agentes-ia/README.md)
- [Seguridad, QA y observabilidad](../roadmap/roadmaps/06-seguridad-qa-observabilidad/README.md)

## Auditoria documental vigente (2026-08-20, revisión ampliada)

Actualización de implementación 2026-08-20: el dashboard ya consume el endpoint de operaciones para
ordenar una superficie adaptativa determinista (`AdaptiveFocus`) con alertas críticas, tareas vencidas,
tareas urgentes, estado de conectores y KPIs. El runtime IA conserva el control del contenido narrado,
pero nunca decide ni muta el layout. Además, el bloque `Resumen ejecutivo IA` reutiliza A02 en modo
compacto y muestra evidencia, fuentes, confianza, completitud y warnings; las propuestas siguen en
shadow/revisión humana.

Se revisaron los 170 archivos Markdown del repositorio y se corrigieron las contradicciones operativas
que afectaban a la ejecucion del piloto. La jerarquia de verdad es: codigo y migraciones aplicadas,
tests/evidencias reproducibles, este documento y despues los roadmaps historicos. En particular:

- **Corrección vigente Klaviyo/DB-09:** el vertical slice de persistencia, reporting, selección de métrica,
  sincronización y reconciliación programada ya está implementado parcialmente; no debe describirse como
  únicamente `not_available`. La falta de credenciales solo bloquea su validación externa y los datos reales.
- **Corrección histórica de migraciones:** hubo 62 archivos locales alineados con 62 versiones remotas; las
  referencias históricas a 55/56 migraciones quedan supersedidas.

- No se exige staging para el pipeline normal ni para el Piloto 1; los fixtures RLS quedan fuera del
  pipeline y nunca deben apuntar a produccion. La decision vigente esta en R-015 y la correccion de R-021.
- `packages/ui` pertenece al historial del Libro Mayor v2. El catalogo vigente y reutilizable es
  `apps/web/src/components/ui` sobre HeroUI v3, segun ADR-0015. Si aparece un segundo consumidor real,
  se hara una extraccion atomica a un paquete compartido, no se mantendran dos catalogos.
- Meta Ads ya dispone de catalogo y seleccion de activos en el portal; la falta de credenciales reales
  solo deja pendiente la validacion externa de OAuth/Graph API y no justifica datos inventados.
- Klaviyo ya tiene configuración opcional, primitives OAuth/PKCE, persistencia alineada, idempotencia,
  sync agregado, reporting y reconciliación; la conexión real, el backfill profundo y el reporting visual
  siguen pendientes y deben mostrarse con estados honestos, nunca como datos conectados.
- La verificacion historica de migraciones confirma 62 archivos locales alineados con 62 versiones
  remotas; `supabase db push --dry-run` devuelve `Remote database is up to date`. AI-14 se aplico como
  `20260802130100_ai_14_abstention_quality_tools.sql` despues de corregir un timestamp duplicado.

## Corrección vigente de auditoría 2026-08-02

Las referencias históricas a 55/56 migraciones quedan supersedidas: hay 59 archivos locales y 59
versiones remotas alineadas. El vertical slice Klaviyo incluye ahora persistencia alineada con producción,
idempotencia, reconciliación y lectura de reporting en Integraciones; siguen pendientes credenciales,
validación externa, backfill profundo y reporting visual avanzado.
