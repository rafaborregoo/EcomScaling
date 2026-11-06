# Validación aislada y estado de entrega — 2 de noviembre de 2026

La entrega de medición compartida supera sus pruebas seleccionadas y compila la API en una copia aislada. El fallo inicial de compilación correspondía a dependencias que faltaban en esa copia —Fastify y compiladores instalados por workspace—, no a un cambio necesario en el código de negocio. Se enlazaron las dependencias instaladas y se repitió la emisión TypeScript con resultado correcto.

## Evidencia de código y pruebas

- Candidato: árbol `f29e8393d65543a50a89d4422ae9d1b98b4bb54d`, sobre base `9fba21e7de628c98f49b2123db103d66918b74ef`.
- Se comprobaron los blobs de los 15 archivos del [manifiesto](CANDIDATO_IMP01_2026-11-01.json) contra la copia aislada; coinciden.
- La copia aislada supera 71 pruebas A24, 291 pruebas de contratos/ejecución IA y 76 pruebas de controles: **438 casos seleccionados sin fallos ni omisiones**.
- Los siete paquetes internos se compilaron en esa copia. Los imports `@e-nora/ai` resuelven a su propio `packages/ai/dist`, no al código del workspace compartido.
- La API aislada supera la emisión con `apps/api/node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json`.
- El worker aislado supera `tsc -p apps/worker/tsconfig.json --noEmit`.
- `npm run verify` vuelve a superar las 19 guardas en el workspace actualizado el 2 de noviembre, incluidos enlaces, aislamiento, migraciones y mantenimiento de asserts/dataset.
- Las RPCs remotas `meta_save_measurement_verdict` y `meta_record_measurement_assessment` ya existen. Se inspeccionaron sus definiciones sin ejecutarlas: conservan el ámbito organización/tienda, el vínculo con la evaluación vigente y un TTL máximo de una hora en la persistencia; no restringen la versión al motor v2. Esta entrega no requiere crear esas funciones mediante más SQL.

Las pruebas son simuladas o deterministas; no generaron turnos de modelos, embeddings o publicaciones. No equivalen a una prueba completa del producto con navegador, sesión de cliente y datos sanos de Meta.

Los cambios de código y tests ya fueron incorporados por actividad externa al commit `aeaba307cbca90b3d9bf689f0549db189c6017b6`. El historial remoto archivado se incorporó en `4b70afc162f60bc3dd5b7f2b90be2bc0dff710f3`, HEAD observado al reanudar. Esta ejecución no creó esos commits ni modificó la rama del usuario.

El parche del 1 de noviembre es evidencia de un cambio sobre su base identificada. **No debe reaplicarse sobre HEAD actual:** sus cambios ya están incorporados. La copia aislada conserva el alcance seleccionado para revisión, sin los cambios concurrentes de generación creativa.

## Producción revalidada

| Superficie | Resultado observado |
|---|---|
| Frontend `ecom.noraapp.es` | Vercel READY, despliegue `dpl_5cXjapoDSPp6LGQphdS6SF5tB4Ns`, revisión `d5e74985015433c728bff2b686e1c1c1382afd0b` |
| API VPS | `GIT_SHA=04c26ec1dd1a2dd40e428ed2d5f43d628cc30a9d`; motor compilado `a24-measurement-v2` |
| Worker VPS | Mismo SHA que la API; ambos contenedores declaran salud `healthy` |
| Meta | Dos conexiones en `error`; último intento registrado del 02/11/2026 a las 00:17 UTC |
| Shopify | Una conexión en `error`; último éxito registrado el 22/09 y error posterior del 02/11 |

La autorización de Vercel se mantiene operativa. La comprobación no acredita que Meta se haya reconectado correctamente: el estado sigue requiriendo recuperación del proveedor y una sincronización completa.

## Condiciones de activación

Existe un alcance de despliegue mayor que este parche: entre la revisión de API/worker actualmente ejecutada y el candidato hay **241 archivos distintos** en `apps/api`, `apps/worker`, `packages`, `deploy` y `ops/vps` (16.490 inserciones y 2.279 eliminaciones). Esa cifra describe el delta completo, no archivos añadidos por esta entrega.

Por ello, compilar y probar estos 15 archivos no autoriza a tratar toda la revisión nueva como una corrección pequeña ya validada. Antes de producción se debe revisar el conjunto que realmente viajará, completar los checks del procedimiento de despliegue y conservar imágenes/configuración de reversión. No se utilizaron las opciones que omiten checks o permiten despliegues con cambios pendientes.

La aceptación operativa pendiente es concreta:

1. Revisar la revisión completa que se desplegará y registrar la decisión de entrega.
2. Validar el procedimiento de restauración en un entorno de prueba. La versión v2 tiene controles inferiores a v5; restaurar su imagen no certifica la fiabilidad de sus diagnósticos. Detener diagnósticos/recomendaciones afectados si no se puede garantizar la calidad del dato.
3. Desplegar API/worker de forma coordinada y comprobar SHA, salud y versión del motor.
4. Verificar Meta reconectado y sincronizado; contrastar A24 en API/panel y A09/A14/A23/A25 con idéntico ámbito y ventana. Mantener `unknown` cuando falte evidencia.
5. Ejecutar un piloto consultivo acotado y revisado, sin ampliar automatismos por defecto.

## Estado del plan y conocimiento

**IMP-00 técnico está contrastado; IMP-01 está implementado y validado en el alcance de código seleccionado; IMP-10 inicial dispone de pruebas y candidato reproducible.** La activación y el piloto siguen pendientes. IMP-10 continúa como control transversal de las fases futuras; no se declara completado para capacidades todavía no implementadas.

Los [86 SQL históricos y su excepción](../../supabase/remote-history/2026-11-01/README.md) conservan sus hashes verificados. No se han aplicado como nuevas migraciones.

La incorporación de los paquetes Meta al RAG sigue en IMP-04. El conocimiento existente usa Voyage (`voyage-context-4`, 1.024 dimensiones); la consulta del 1 de noviembre registró 584 documentos activos con ese modelo. Esta validación no importó documentos ni generó embeddings.

El detalle funcional, el mapa de seis recorridos y las justificaciones de ajustes de tests se conservan en [la entrega técnica del 1 de noviembre](CIERRE_TECNICO_IMP00_IMP01_IMP10_2026-11-01.md).
