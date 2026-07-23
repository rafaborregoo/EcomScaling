# Contrato global del backend — reglas para Codex

> Reglas de comportamiento, no documentacion narrativa. Antes de tocar cualquier `fases/BE-XX-*.md`,
> `apps/api/src` o `apps/worker/src`, aplica esto. No lo repitas ni lo contradigas en los documentos de
> fase — enlaza aqui. Para el dominio de esquema/migraciones ver
> [`DB-README.md`](../01-base-de-datos/DB-README.md); las reglas de estados/evidencia siguen viviendo en
> [`ESTADOS_Y_EVIDENCIA.md`](../99-decisiones-y-seguimiento/ESTADOS_Y_EVIDENCIA.md).

## Estado actual honesto

Nada de lo que sigue esta implementado como contrato transversal todavia — hoy cada endpoint improvisa su
propia version (formato de error, propagacion de `organizationId`, etc.), y funciona porque los pocos
endpoints existentes se escribieron a mano con cuidado, no porque haya un contrato que lo garantice. Este
documento fija la regla; migrar los endpoints existentes a cumplirla es trabajo aparte, no implicito en
crear este archivo.

## 1. Autenticacion y tenancy

- Toda ruta protegida resuelve un `AuthContext` (`apps/api/src/auth-context.ts`) antes de tocar negocio.
- Toda ruta organizacional resuelve el acceso a esa organizacion especifica — nunca confiar directamente
  en el `organizationId` recibido por URL, body o query sin verificarlo contra el `AuthContext`.
- `service_role` no sustituye la autorizacion. Toda operacion con `service_role` debe llevar
  `organization_id` explicito en el `WHERE`/`INSERT`, resuelto desde el usuario autenticado, nunca desde
  el parametro recibido sin validar.
- Todo endpoint organizacional necesita un test negativo cross-tenant (usuario de A pidiendo el
  `organizationId` de B → 403/404) ademas del test positivo. Ver el riesgo abierto en BE-01: hoy esto solo
  esta cubierto en bootstrap y el listado de consultor, no en el resto de endpoints de negocio.
- La forma de representar el acceso (membership real vs. consultor asignado vs. platform admin) es una
  decision de contrato pendiente en BE-01 (`OrganizationAccess` tipado con `accessSource`/`permissions`).
  No inventar una tercera representacion en un endpoint nuevo mientras esa decision siga abierta.
- Decidir 403 vs. 404 para recursos cross-tenant es una decision global, no por endpoint: por defecto usa
  403 salvo que el propio documento de fase pida 404 para no revelar existencia.

## 2. Validacion de entrada

- Params, query y body se validan con Zod antes de tocar Supabase.
- Operaciones sensibles (escritura, financiero, credenciales) no aceptan propiedades desconocidas
  (`.strict()` o equivalente).
- UUIDs se validan con el schema antes de usarse en una query.
- Fechas, monedas, porcentajes y timezones usan el contrato ya fijado en DB-03 (porcentajes 0-100, moneda
  ISO `^[A-Z]{3}$`) — no reinventar el formato por endpoint.

## 3. Errores

Formato unico de error para toda la API (no existe todavia — crearlo es prerequisito antes de que un
endpoint nuevo pueda considerarse "cerrado" segun la seccion 7):

```json
{
  "error": {
    "code": "ORGANIZATION_ACCESS_DENIED",
    "message": "No tienes acceso a esta organizacion.",
    "requestId": "req_...",
    "details": {}
  }
}
```

- Codex no inventa mensajes, codigos o status HTTP nuevos por endpoint sin registrarlos en un catalogo
  comun. Si un codigo nuevo hace falta, se anade al catalogo en el mismo cambio.
- Los codigos son estables entre endpoints (`ORGANIZATION_ACCESS_DENIED`, no
  `SHOPIFY_ORG_ACCESS_DENIED` y `META_ORG_ACCESS_DENIED` por separado).

## 4. Idempotencia

- Operaciones externas y jobs necesitan `idempotencyKey`.
- Un reintento no puede duplicar el efecto de negocio (distinto de no duplicar la fila de recepcion — ver
  DB-04, que ya distingue estas dos garantias para webhooks).
- Distinguir explicitamente: peticion duplicada, ejecucion reintentada, ejecucion parcialmente completada,
  efecto ya aplicado. No colapsar los cuatro casos en un solo booleano.

## 5. Observabilidad

Todo log/evento de negocio relevante debe poder correlacionarse por:
`requestId`, `traceId`, `organizationId`, `userId`, `integrationConnectionId` (si aplica), `syncRunId` (si
aplica), `agentRunId` (si aplica), duracion, resultado, error normalizado (mismo `code` que la seccion 3).

## 6. Jobs (worker)

Contrato minimo de envelope para cualquier job nuevo en `apps/worker`:

```ts
type JobEnvelope<T> = {
  jobName: string;
  organizationId: string;
  idempotencyKey: string;
  requestedBy?: string;
  requestId?: string;
  traceId: string;
  attempt: number;
  payload: T;
};
```

Retry/backoff/DLQ/timeout/concurrencia por tipo de job son decisiones de BE-00 (ver su seccion Gaps) —
no las fije este documento por job individual.

## 7. Definition of Done de un endpoint

Un endpoint no pasa a `done` sin, en el mismo cambio:

1. Validacion (seccion 2).
2. Autorizacion y tenant scoping (seccion 1), con test negativo cross-tenant.
3. Errores normalizados (seccion 3).
4. Logs con los campos de la seccion 5.
5. Test positivo.
6. Test negativo (auth) y test cross-tenant (tenancy) — son dos tests distintos, no uno.
7. Actualizacion del documento de fase correspondiente (`fases/BE-XX-*.md`).
8. Contrato de API actualizado (OpenAPI o equivalente), si existe para ese endpoint.

## Que no es tarea de Codex sin pedirlo explicitamente

- Elegir 403 vs. 404 global, o el `IntegrationConnector` de BE-02, o el `OrganizationAccess` de BE-01: son
  decisiones de contrato que el usuario cierra, no que Codex infiera por endpoint.
- Dividir BE-03/BE-05/BE-06 en subdocumentos — decision de organizacion documental, no correccion de
  contrato.
- Implementar forecast de stock (BE-06) antes de que existan las recomendaciones deterministas previas
  (dias de cobertura, velocidad de venta, stock comprometido) — ver Gaps de BE-06.
