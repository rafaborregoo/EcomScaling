# Contrato de preparación de conectores futuros

> Actualizado: 2026-08-02. Referencia común para que Meta Ads, Klaviyo e Instagram
> puedan activarse cuando existan credenciales, sin rediseñar el dominio, la interfaz
> ni los agentes.

## Verificacion vigente 2026-08-24

El contrato y sus gates actuales pasan 14/14 tests con `npx tsx --test` en
`packages/integrations` y API. La nota de 10/10 y 6/6 de las correcciones
historicas queda supersedida; el alcance externo (credenciales, App Review y
cuentas reales) permanece pendiente y no se simula.

> **Contrato de activación vigente 2026-08-24:** `GET /v1/.../integrations` devuelve `provider.configuration` por conector con los estados `configured`, `credentials_missing`, `feature_disabled` o `not_implemented`. El backend no expone secretos; la UI habilita OAuth/sync únicamente cuando la app está configurada y el feature flag está activo. `integrations-configuration.test.ts` pasa 1/1 y los typechecks de API y web pasan.

> **Permisos Meta concedidos 2026-08-24:** el callback inspecciona el token real con `debug_token`, comprueba que pertenece a la app configurada y compara los scopes concedidos con los solicitados. Si falta alguno, no guarda el token ni marca la conexión como conectada. La tabla de scopes y el payload cifrado conservan permisos reales, no solo los solicitados.

> **Klaviyo OAuth actualizado 2026-08-24:** los scopes se normalizan a formato separado por espacios para la autorización; el callback exige y persiste el scope concedido por Klaviyo. Las respuestas sin scope o con permisos incompletos quedan en error accionable y no activan la conexión.

## Objetivo de producto

EcomScaling debe ser plenamente utilizable con Shopify como única fuente operativa.
Los conectores futuros deben estar presentes desde ahora como contratos, capacidades,
estados y pantallas reutilizables, pero nunca deben mostrar datos inventados ni crear
conexiones ficticias. La ausencia de credenciales es un estado de producto válido.

## Estado real y criterio de activación

| Proveedor | Estado actual                           | UI actual/futura                                                 | Desbloqueo                                   |
| --------- | --------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Shopify   | Operativo                               | conexión, sync, salud, métricas y diagnósticos reales            | credenciales de tienda                       |
| Meta Ads  | Preparado; validación externa pendiente | OAuth, permisos, cuentas descubiertas y métricas solo si existen | App real, App Review, permisos y cuenta real |
| Klaviyo   | Contrato preparado; no disponible       | estado honesto y próxima acción, sin datos simulados             | OAuth, revisión y scopes aprobados           |
| Instagram | Contrato preparado; depende de Meta     | estado honesto y dependencia de Meta                             | permisos y cuenta profesional real           |

“Preparado” significa que el conector puede conectarse al contrato común y reutilizar
las mismas pantallas, estados, auditoría y sincronización. No significa que se haya
validado contra la API de un cliente real.

> **Instagram actualizado 2026-08-24:** `packages/integrations` contiene la matriz reutilizable de las dos estrategias oficiales, con host, dependencia de Página, scopes y limitaciones. El futuro adapter debe elegir la estrategia por cuenta y no mezclar capacidades de ambas rutas.

## Invariantes

1. El frontend solo consume el catálogo y el estado normalizado del backend; nunca
   conoce tokens, payloads externos ni asume que existe una cuenta.
2. Cada dato conserva proveedor, cuenta/activo, periodo, `source` y `freshness`.
   Los datos calculados por EcomScaling se distinguen de los observados.
3. La selección de activos es explícita y multi-cuenta por organización. No se debe
   sincronizar silenciosamente una cuenta no seleccionada.
4. Cada operación es tenant-scoped, idempotente y auditable. Un token o activo de una
   organización nunca puede aparecer en otra.
5. La UI reutiliza `IntegrationCard`, `StatusBadge`, `EmptyState`, `LoadingBlock`,
   `ErrorBlock`, diálogos y tablas existentes. Un proveedor nuevo añade capacidades y
   mapeadores, no una segunda versión del portal.
6. Los agentes solo analizan datos disponibles y citables. Sin Meta o Klaviyo deben
   degradar a “fuente no conectada”, nunca rellenar métricas de demo.

## Estados de producto

El estado persistente de conexión sigue siendo `pending | connected | syncing |
error | disconnected | revoked`. La salud derivada puede ser `healthy | syncing |
degraded | reauthorization_required | permissions_missing | stale | external_outage |
unknown`.

Toda pantalla y módulo que consuma datos externos cubre loading, conectado y fresco,
conectado pero incompleto/desactualizado, permisos insuficientes, reautorización,
conector no disponible, sin activos seleccionados, error recuperable/permanente,
reintento y organización sin datos. La ausencia de filas no se presenta como cero.

## Preparación específica de Meta Ads

Se separan identidad autorizada, origen del acceso (`oauth_direct` o acceso compartido
mediante Business Manager/System User), cuenta publicitaria y activos seleccionados.
Los IDs se normalizan como `act_<id>` y toda paginación se sigue mediante el cursor de
Meta.

El flujo futuro es: autorizar → validar identidad real → descubrir negocios, cuentas,
Páginas e Instagram profesional → mostrar permisos y cuentas disponibles → seleccionar
activos → sync inicial → sync incremental y reconciliación de días recientes. La
reautorización no debe duplicar conexiones ni activos.

Insights debe guardar nivel, rango, zona horaria, ventana de atribución,
`action_report_time`, breakdowns y `action_type`. `actions`, `action_values` y ROAS no
se colapsan a una única “compra” sin una decisión documentada por cuenta. Las consultas
voluminosas deben poder migrar a reportes asíncronos sin cambiar el contrato de la UI.
Tokens de usuario y de System User son sesiones de acceso distintas; no se asume un
token global para toda la agencia. Scopes solicitados, concedidos y pendientes de
revisión son visibles sin exponer secretos.

## Preparación específica de Klaviyo e Instagram

- Klaviyo se conectará mediante OAuth versionado, Reporting API y una
  `conversion_metric_id` explícita por cuenta. La UI acepta que listas, segmentos,
  flows, campañas y reporting estén ausentes.
- EcomScaling podrá generar borradores de emails y plantillas desde el módulo de
  Klaviyo aunque el conector no esté conectado. El agente producirá asunto,
  preheader, texto plano, HTML seguro, bloques reutilizables, tokens de
  personalización, tono, idioma, audiencia y notas de cumplimiento, siempre con
  fuentes y advertencias.
- Un borrador generado por IA se guarda como `draft`/`pending_approval` y puede
  revisarse, editarse y versionarse dentro de EcomScaling. Ningún agente puede
  enviarlo, publicarlo o modificar una campaña de Klaviyo directamente. Esas
  acciones serán propuestas explícitas y requerirán aprobación humana y una
  conexión Klaviyo saludable.
- La UI reutiliza los componentes del portal para crear, previsualizar, comparar
  variantes, revisar tokens faltantes y aprobar/publicar. Sin conexión, “Publicar
  en Klaviyo” permanece deshabilitado y se explica el motivo; no se muestran
  listas, segmentos ni métricas simuladas.
- Instagram reutiliza la conexión Meta y solo admite cuentas profesionales. Los datos
  orgánicos permanecen separados de Ads Insights y las métricas son filas por medio,
  métrica y periodo. No se prometen seguidores ganados por publicación sin fuente válida.

## Activación cuando lleguen credenciales

1. Configurar secretos y redirect URIs.
2. Confirmar App Review, business verification, scopes y acceso del cliente.
3. Ejecutar OAuth y comprobar identidad real.
4. Revisar y seleccionar explícitamente los activos de la organización.
5. Ejecutar sync inicial y comprobar paginación, rate limits, freshness e idempotencia.
6. Comparar una muestra con el panel del proveedor y registrar discrepancias.
7. Activar el feature flag por proveedor y organización.
8. Habilitar agentes solo con evidencia, límites de coste y revisión humana para toda
   propuesta de escritura.

> Correccion de alcance 2026-08-02: el flag implementado actualmente es global por proveedor
> (`INTEGRATION_FEATURE_FLAGS`). La organizacion se autoriza por membership/RLS despues de ese
> gate; no existe todavia un rollout independiente por tenant y no debe darse por implementado.

## Correccion Instagram Login/Facebook Login 2026-08-02

Instagram se prepara con dos estrategias oficiales de autorizacion, segun la
cuenta y los permisos concedidos: Instagram Login y Facebook Login. Facebook
Login puede reutilizar una conexion Meta cuando proceda; Instagram Login no
debe depender artificialmente de ella. Ambas estrategias reutilizan la misma
UI, estados, auditoria y contrato de datos.

- [Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login)
- [Instagram API with Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login)

Hasta validar permisos, tipos de cuenta, App Review y credenciales reales,
INT-05 permanece no disponible y no ejecuta OAuth ni sincronizacion.

## Evidencia local

- Catálogo/capacidades: `packages/integrations/src/index.ts`.
- Estado/rutas: `apps/api/src/integrations.ts`.
- OAuth/descubrimiento Meta: `apps/api/src/meta.ts` y `apps/api/src/meta-oauth.ts`.
- Sync Meta: `apps/api/src/meta-sync.ts`.
- Adaptadores y estados no disponibles: `apps/api/src/integration-adapters.ts`.
- UI: `apps/web/src/app/integraciones/page.tsx`.

## Referencia oficial de Meta para escritura futura (2026-08-02)

La guía [Basic Ad Creation de Meta](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation)
queda incorporada como fuente canónica del contrato de creación. La jerarquía que debe
respetar el dominio es `campaign → ad set → ad creative → ad`.

La capacidad futura deberá usar contratos tipados, IDs externos persistidos, creación
idempotente en orden, estado inicial `PAUSED`, previsualización y aprobación humana.
`ads_management` será un permiso de escritura separado de `ads_read` y no se solicitará
ni activará hasta disponer de App Review, credenciales y validación con una cuenta real.
Mientras tanto se prepara la interfaz y el adaptador sin ejecutar POSTs contra Meta ni
mostrar campañas ficticias.

La escritura de Meta Ads ya tiene un contrato tipado y un executor reanudable en
`packages/integrations/src/meta-ad-write-contract.ts` y `meta-ad-executor.ts`. La UI puede construir
la propuesta y someterla a aprobación, pero el transporte productivo sigue protegido por dry-run hasta
contar con `ads_management`, App Review y una cuenta real validada.
