# DB-10 - Instagram

> **Correccion vigente 2026-08-20:** la migracion
> `20260820110000_db_10_instagram_foundation.sql` ya esta aplicada en remoto.
> Crea las seis tablas tenant-scoped, indices, RLS de lectura y grants sin
> insertar cuentas, media, insights ni ganadores. Instagram sigue no disponible
> operacionalmente hasta validar Meta/Instagram OAuth con una cuenta profesional.

## Estado

**Estado vigente:** `implemented_partial` — foundation aplicada; sync real y
validacion OAuth siguen condicionados por credenciales/permisos externos.

- **Estado real:** `implemented_partial` (foundation aplicada; sync real pendiente de credenciales).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** credenciales/permisos de Meta e Instagram (mismo bloqueador que DB-06/BE-04).
- **Evidencia:** `20260820110000_db_10_instagram_foundation.sql` aplicada en remoto; tablas vacias,
  RLS y grants verificados.
- **Gaps identificados (a resolver antes de activar el sync real):**
  - Sin matriz de metricas disponibles por tipo de contenido (imagen/video/reel/carrusel/story).
  - Sin politica de caducidad/refresco de URLs de media ni de soft deletion de contenido retirado.
  - Sin grain de snapshots ni timezone definidos.
  - Sin procedencia declarada para "ganadores de seguidores" (manual/estimado/API/nivel de confianza) —
    la regla de "no atribuir seguidores a un post sin evidencia" ya esta bien planteada y se mantiene.
- **Siguiente accion:** validar permisos y estrategia OAuth contra una cuenta profesional real; no crear
  datos sintéticos para cubrir la ausencia de conexión.

## Objetivo

Soportar analisis de contenido organico con las metricas disponibles por API y entrada manual de ganadores de seguidores.

## Preparacion de esquema 2026-08-02

La foundation de tablas ya está aplicada. La UI y los agentes toleran desde ahora la
ausencia de una cuenta conectada sin datos simulados. Cuando se active el sync real,
las métricas serán filas por medio, nombre y periodo; la procedencia manual de ganadores
de seguidores quedará separada de los datos de API.

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
