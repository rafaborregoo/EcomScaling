# DB-10 - Instagram

## Estado

- **Estado real:** `planned` (no iniciado — sin migracion, sin codigo).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** credenciales/permisos de Meta e Instagram (mismo bloqueador que DB-06/BE-04).
- **Evidencia:** ninguna todavia — no existe migracion `db_10_*` en `supabase/migrations/`.
- **Gaps identificados (a resolver antes de escribir la primera migracion):**
  - Sin matriz de metricas disponibles por tipo de contenido (imagen/video/reel/carrusel/story).
  - Sin politica de caducidad/refresco de URLs de media ni de soft deletion de contenido retirado.
  - Sin grain de snapshots ni timezone definidos.
  - Sin procedencia declarada para "ganadores de seguidores" (manual/estimado/API/nivel de confianza) —
    la regla de "no atribuir seguidores a un post sin evidencia" ya esta bien planteada y se mantiene.
- **Siguiente accion:** ninguna posible en el schema hasta credenciales Meta/Instagram; documentar el
  contrato mientras tanto no requiere acceso real.

## Objetivo

Soportar analisis de contenido organico con las metricas disponibles por API y entrada manual de ganadores de seguidores.

## Preparacion de esquema 2026-08-02

El modelo se implementará cuando exista acceso real a una cuenta profesional. La UI y
los agentes toleran desde ahora la ausencia de estas tablas sin datos simulados. Cuando
se active, las métricas serán filas por medio, nombre y periodo; la procedencia manual
de ganadores de seguidores quedará separada de los datos de API.

## Tablas

- `instagram_accounts`
- `instagram_account_snapshots`
- `instagram_account_insight_values`
- `instagram_media`
- `instagram_media_insight_values`
- `instagram_follower_winners`

## Criterios de cierre

- No afirmar seguidores ganados por post salvo dato manual/API disponible.
- Media URLs y snapshots tienen politica de refresco.
- Ranking por alcance, engagement y visitas al perfil disponible.
