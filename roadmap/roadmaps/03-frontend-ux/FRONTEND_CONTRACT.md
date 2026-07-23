# Contrato global del frontend — reglas para Codex

> Reglas de comportamiento, no documentacion narrativa. Antes de tocar cualquier `fases/FE-XX-*.md` o
> codigo en `apps/web/src`, aplica esto. No lo repitas ni lo contradigas en los documentos de fase —
> enlaza aqui. Para el contrato del backend ver
> [`BE-README.md`](../02-backend-api/BE-README.md); estados/evidencia siguen viviendo en
> [`ESTADOS_Y_EVIDENCIA.md`](../99-decisiones-y-seguimiento/ESTADOS_Y_EVIDENCIA.md).

## Estado actual honesto

Nada de esto es un contrato ejecutable todavia (no hay tipos compartidos de capacidades ni de metricas en
`@ecomscaling/contracts` mas alla de `AccountAction`). Este documento fija la regla; migrar pantallas
existentes a cumplirla es trabajo aparte.

## 1. Modelo de acceso: capacidades, no roles

El frontend nunca debe ramificar sobre `platformRole`/`organizationRole` directamente en un componente de
pantalla (`if (platformRole === "consultant")`). Ramifica sobre capacidades. En cuanto aparezca un cuarto
tipo de acceso (auditor, especialista externo, acceso de solo lectura), una condicion sobre el rol se
rompe; una condicion sobre la capacidad no.

```ts
type FrontendCapabilities = {
  canSwitchOrganization: boolean;
  canSwitchStore: boolean;
  canManageOrganization: boolean;
  canManageIntegrations: boolean;
  canEditFinancialSettings: boolean;
  canViewInternalTasks: boolean;
  canWriteInternalNotes: boolean;
  canApproveAgentOutputs: boolean;
  canApproveCallSummaries: boolean;
  canViewTechnicalDiagnostics: boolean;
};
```

El backend calcula estas capacidades (a partir de `AuthContext`/`OrganizationAccess`, ver BE-01) y las
sirve en `bootstrap`; el frontend solo las lee. La verdad de "quien puede que" vive en el backend, nunca se
reinfiera en el cliente a partir del rol.

### Matriz de referencia (2026-07-22, verificada contra `apps/api/src/consultant.ts` en FE-07)

| Capacidad | Cliente | Consultor asignado | `platform_admin` |
| --- | --- | --- | --- |
| Ver su organizacion | Si | Si | Si |
| Cambiar de cliente | No | Si (asignados) | Si (todos) |
| Cambiar de tienda | Si, dentro de su org | Si | Si |
| Ver tareas internas / escribir notas internas | No | Si | Si |
| Aprobar resumen de llamada / output IA | No | Si (si asignado) | Si |
| Editar organizacion / anadir-borrar tienda / restaurar | No | No | Si |
| Configurar finanzas / lanzar sync | Segun decision de producto | Segun asignacion | Si |
| Ver diagnostico tecnico | No | Si | Si |

Esta tabla ya coincide con lo verificado en FE-07 (`requirePlatformAdmin` en 5 puntos, aprobaciones
abiertas a consultor asignado + `platform_admin`). Si el backend cambia esta matriz, se actualiza aqui en
el mismo cambio — nunca queda solo en el codigo de un endpoint.

## 2. Contratos compartidos frontend-backend

Todo lo de esta lista vive en `@ecomscaling/contracts` (como ya existe `AccountAction`), nunca duplicado
como `string` libre en un lado y un enum en el otro: roles, capacidades, estados de organizacion/
suscripcion/conexion/sync/tarea/llamada/resumen/output IA, prioridades, categorias, tipos de alerta,
codigos de error, monedas, periodos, DTO de paginacion/freshness/calidad de dato.

### Error

```ts
type ApiErrorResponse = {
  error: {
    code: ApiErrorCode; // enum cerrado en @ecomscaling/contracts
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
  };
};
```

El frontend decide comportamiento por `code`, nunca inspeccionando `message` (`error.message.includes(...)`
esta prohibido).

### Dinero

```ts
type Money = { amount: string; currency: string };
```

Nunca `amount: number`. Ver DB-03: `payment_fee_pct`/`vat_pct` usan escala 0-100 — un input de porcentaje
en el frontend envia `3.5`, nunca `0.035`; el formulario es responsable de esa conversion, no un handler
generico.

### Metrica

```ts
type MetricValue = {
  key: string;
  value: string | null;
  unit: "money" | "count" | "percentage" | "ratio" | "days";
  currency?: string;
  period: { from: string; to: string; timezone: string };
  scope: { organizationId: string; connectionId?: string; aggregated: boolean };
  freshness: DataFreshness;
  quality: DataQuality;
  calculationVersion?: string;
};
```

Toda cifra que se muestre en dashboard/reporting necesita estos 5 elementos visibles: que mide, periodo,
alcance (tienda vs. todas), freshness, calidad. Un titulo cambiante no puede ser la unica forma de
comunicar alcance (riesgo ya detectado en FE-02).

### Paginacion

```ts
type PaginatedResponse<T> = {
  items: T[];
  page: { cursor?: string; nextCursor?: string; previousCursor?: string; total?: number; hasMore: boolean };
};
```

Una sola forma de paginar en toda la app — ninguna tabla nueva inventa su propio esquema de pagina.

## 3. Reglas de contenido

No usar subtitulos decorativos ni repetir el titulo. Usar helper text solo cuando evite una decision
erronea, explique una restriccion o comunique una consecuencia (regla matizada 2026-07-22, reemplaza la
version absoluta anterior de FE-00).

**Categorias donde SI hace falta explicar** (no son opcionales): configuracion financiera, permisos,
eliminacion/recuperacion, estados de integracion, atribucion (ventanas de Meta), freshness de datos,
limitaciones de IA, acciones irreversibles, onboarding, campos con unidades/porcentajes, forecast, datos
incompletos.

**Donde sigue sin hacer falta**: titulos evidentes, KPIs, navegacion, tablas, acciones ya conocidas por el
usuario.

Ejemplo innecesario: "Tareas" + "Aqui puedes consultar las tareas que tienes."
Ejemplo necesario: "Gastos fijos mensuales" + "Se prorratean sobre el periodo seleccionado para estimar el
beneficio neto."

## 4. Query keys (capa de datos)

Toda query se scopea explicitamente por usuario, organizacion, tienda, periodo y filtros relevantes —
nunca una key generica como `["dashboard"]`, que mezclaria datos entre clientes o tiendas al cambiar de
contexto:

```ts
["organization", organizationId, "store", connectionId, "dashboard", period]
```

## 5. Definition of Done de una pantalla

Una pantalla no pasa a `done` sin: ruta/navegacion definidas, capacidades aplicadas (no roles crudos),
contexto organizacion/tienda visible, contratos de la seccion 2 usados (no tipos ad-hoc), estados de
loading/empty/error/partial/stale/permission-denied, responsive 375px, teclado/foco/labels, sin datos
ficticios, mutaciones con feedback y doble-submit bloqueado, test positivo + test por rol + test
cross-tenant.

## Que no es tarea de Codex sin pedirlo explicitamente

- El contrato exacto de precedencia de contexto activo (URL vs. localStorage vs. unica opcion) y el
  checklist completo de que pasa al cambiar de organizacion (cancelar peticiones, invalidar queries,
  validar tienda) — es una decision de arquitectura de experiencia pendiente, no implicita en este
  documento.
- Dividir FE-04/05/06/08 en subdocumentos, o crear la home adaptativa — decisiones de organizacion/
  producto que el usuario cierra primero.
- Construir signup/invitacion propios, recuperacion de contrasena o cualquier pantalla de FE-01 mas alla
  del EmptyState ya anadido, sin que el usuario decida si hace falta para el piloto actual.
