-- FASE 3 / D01 — Los fallos de datos que el cliente puede arreglar, los ve.
--
-- Decision 2026-09-14. La migracion original dejo `data_quality_issues` en
-- staff-only, con esta nota: "un issue de calidad es informacion que el cliente
-- acabara queriendo ver, pero hasta que exista pantalla y redaccion para eso,
-- abrirlo seria ensenar diagnostico tecnico a medio hacer".
--
-- Lo que la hace cambiar: hay una familia de fallos que **solo el cliente puede
-- resolver** -- dar un permiso en su cuenta de anuncios, reconectar una
-- credencial caducada, confirmar que esos pedidos eran pruebas suyas.
-- Ocultarselos garantiza que no se resuelvan y convierte al consultor en
-- recadero de algo que podria ser automatico.
--
-- DOS CONDICIONES, NO UNA. El riesgo del razonamiento a medias sigue siendo
-- real, asi que el cliente no ve un issue por ser de su incumbencia: lo ve
-- cuando ademas ha dejado de estar en `open`, es decir, cuando alguien
-- confirmo que el fallo existe. Avisar de una averia que no lo era erosiona la
-- confianza mas rapido que el fallo original.
--
-- POR QUE UNA COLUMNA Y NO UNA LISTA DE TIPOS EN LA POLITICA. "Accionable por
-- el cliente" no es una propiedad del tipo, es del caso: una regresion de
-- tracking en el tema de su tienda la arregla el cliente, y la misma regresion
-- en nuestro pixel la arreglamos nosotros. Quien escribe el issue lo sabe y lo
-- declara. La check constraint solo impide lo absurdo: marcar como accionable
-- por el cliente un rate limit de nuestra ingesta.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

alter table public.data_quality_issues
  add column if not exists client_actionable boolean not null default false;

comment on column public.data_quality_issues.client_actionable is
  'Si el fallo vive en los sistemas del cliente y solo el puede resolverlo. Con status distinto de open, es lo que lo hace visible en su panel.';

-- El catalogo de lo que PUEDE ser del cliente. Todo lo de esta lista ocurre en
-- algo suyo: su cuenta de anuncios, sus credenciales, su web, su configuracion
-- de consentimiento, sus pedidos de prueba. Lo que no esta aqui es nuestro
-- (rate limits, webhooks, backfills, agregaciones) y presentarselo a el seria
-- pedirle que arregle nuestra tuberia.
alter table public.data_quality_issues
  drop constraint if exists data_quality_issues_accionable_por_cliente;

alter table public.data_quality_issues
  add constraint data_quality_issues_accionable_por_cliente check (
    not client_actionable
    or issue_type in (
      'permission_gap',
      'credential_expired',
      'consent_loss',
      'tracking_regression',
      'missing_events',
      'schema_drift',
      'contaminated_data'
    )
  );

-- Lo que se consulta desde el panel del cliente: sus fallos accionables y ya
-- verificados.
create index if not exists data_quality_issues_cliente_idx
  on public.data_quality_issues (organization_id, detected_at desc)
  where client_actionable and status <> 'open';

-- La politica de staff sigue igual y se mantiene: el consultor lo ve todo.
-- Esta se suma para el miembro de la organizacion.
--
-- `can_access_org` ya incluye a platform_admin y al consultor asignado, asi que
-- esta politica no les quita nada; lo unico que anade es al miembro activo con
-- suscripcion al dia, y solo sobre las dos condiciones de arriba.
drop policy if exists "data_quality_issues_select_cliente" on public.data_quality_issues;
create policy "data_quality_issues_select_cliente" on public.data_quality_issues
  for select to authenticated
  using (
    client_actionable
    and status <> 'open'
    and private.can_access_org(organization_id)
  );
