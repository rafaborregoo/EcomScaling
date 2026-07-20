# FE-04 - Mis Llamadas y Mi Camino

## Estado

- **Estado real:** `functionally_complete_ux_validation_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-08, BE-05
- **Bloqueador:** ninguno
- **Evidencia:** `/camino` operativo; `/llamadas`: registro, transcripcion versionada, resumen
  manual/A01, aprobacion/rechazo antes de publicar, tareas y notas internas desde la llamada (ver BE-05
  para el contrato de endpoints y estados verificado en codigo).
- **Correccion importante:** "deteccion de proveedor Loom/Fathom" en el estado original sugeria una
  integracion activa. En realidad es deteccion del dominio del enlace pegado por el consultor (heuristica
  de UI), **no** una conexion via webhook real — Fathom real (webhook, firma, idempotencia) sigue sin
  implementar (ver BE-06E). No presentar esto como "integracion Fathom" hasta que exista el webhook.
- **Gaps identificados:**
  - Documento agrupa dos modulos sin relacion tecnica directa (Llamadas y Mi Camino); dividir en
    FE-04A-calls.md y FE-04B-strategic-roadmap.md facilitaria auditarlos por separado.
  - Sin documentacion de reproductor/enlace de grabacion, errores de proveedor, ni carga manual como
    fallback.
  - Mi Camino: sin documentar quien crea/activa fases, como se calcula el progreso, que pasa al reabrir
    una tarea de un hito, si los hitos pueden reordenarse, ni versionado de planes.
- **Siguiente accion:** corregir la descripcion de "deteccion de proveedor" para no sugerir integracion
  activa, y dividir el documento en los dos submodulos.

## Objetivo

Conectar aprendizaje mensual, resumenes aprobados, tareas y plan estrategico.

## Entregables

- Listado de llamadas.
- Link Loom/Fathom, transcripcion y resumen aprobado.
- Revision consultor antes de publicar.
- Timeline de Mi Camino con fases, hitos y progreso.
- Notas internas solo consultor.

## Criterios de cierre

- Cliente no ve borradores no aprobados.
- Hitos y tareas asociadas mantienen coherencia.
- El plan se puede editar desde panel consultor.

