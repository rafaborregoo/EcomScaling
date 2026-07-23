# Reglas para Codex — dominio Base de datos

> Este archivo es un contrato de comportamiento, no documentacion narrativa. Antes de tocar cualquier
> `fases/DB-XX-*.md` o su migracion asociada, aplica estas reglas. No las repitas ni las contradigas en
> los documentos de fase — enlaza aqui.

## Jerarquia de fuentes de verdad

Ya definida en [`ESTADOS_Y_EVIDENCIA.md`](../99-decisiones-y-seguimiento/ESTADOS_Y_EVIDENCIA.md#regla-de-resolucion-de-contradicciones):
migraciones aplicadas > codigo y tests > documentacion de fase > roadmap maestro > modelo conceptual
(`schema_conceptual_snapshot.sql`, nunca ejecutable ni fuente de estado). Si un documento de fase
contradice el esquema remoto real, el documento esta mal — se corrige el documento, nunca al reves.

## Estados

Usa unicamente los 6 estados de `ESTADOS_Y_EVIDENCIA.md` (`planned`, `in_progress`, `blocked`,
`verification_pending`, `done`, `deprecated`). Matices van en el campo `Matiz` o `Tipo de bloqueador`,
nunca inventando un estado compuesto nuevo.

## Reglas obligatorias antes de proponer o escribir una migracion

1. **No editar una migracion ya aplicada en remoto.** Todo cambio de esquema es una migracion nueva,
   forward-only.
2. **Buscar antes de crear.** Antes de proponer una tabla, columna o enum, verificar si ya existe
   (`supabase/migrations/*.sql`, `mcp__plugin_supabase_supabase__list_tables`) — no confiar en el
   `schema_conceptual_snapshot.sql` retirado para esto.
3. **No implementar nada marcado como `open_decision`/"decision de diseno" en la seccion Gaps o
   Siguiente accion de un documento de fase** sin que el usuario cierre esa decision primero. Documentar
   el contrato no es lo mismo que escribir la migracion.
4. **Todo cambio de esquema requiere, en el mismo cambio:** migracion, test, actualizacion del documento
   de fase correspondiente, evidencia reproducible (comando + resultado), y revision explicita de RLS y
   aislamiento cross-tenant si la tabla es multi-tenant.
5. **No declarar `done`** sin ejecutar las pruebas listadas en "Criterios de cierre" y pegar el resultado
   real (comando + pass/fail) en "Evidencia". Un criterio sin evidencia formal se queda en
   `verification_pending`.
6. **Ninguna consulta con `service_role` puede ejecutarse sin filtro explicito de `organization_id`.**
   `service_role` ignora RLS — la garantia de aislamiento en ese camino vive en el codigo Node, no en la
   base de datos. Ver DB-02, seccion Gaps.
7. **No crear enums, tablas de agregados o columnas "por si acaso"** para fases futuras. Ver DB-01,
   "No incluido".
8. **No usar la palabra "cifrado"** para credenciales en `private.integration_credentials` (o
   equivalentes) hasta que exista un diseño real documentado: algoritmo, clave maestra, `key_version`,
   rotacion, comportamiento ante fallo de descifrado. Ver DB-04, Gaps.
9. **No mezclar la garantia de idempotencia de recepcion de un webhook con la idempotencia del efecto
   de negocio del handler.** Son dos garantias distintas; probar una no prueba la otra.

## Que no es tarea de Codex sin pedirlo explicitamente

- Decidir el modelo de reproducibilidad historica financiera (DB-03: configuracion efectiva por periodo
  vs. snapshot de calculo por ejecucion) — es una decision arquitectonica del usuario, no una migracion.
- Convertir DB-09 (Klaviyo) o DB-10 (Instagram) en migraciones reales antes de que su documento de fase
  tenga las decisiones de contrato cerradas (natural keys, metrica de conversion primaria, timezone,
  moneda, grain, retencion). Hoy son `planned`, no `design_required` a medias.
- Dividir DB-07 o DB-08 en sub-documentos (A/B/C) sin que el usuario lo pida — es una decision de
  organizacion documental, no una correccion de estado.
