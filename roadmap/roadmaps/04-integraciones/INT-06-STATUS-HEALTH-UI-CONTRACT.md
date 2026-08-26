# INT-06 - Contrato de estado y salud en la UI

## Estado

`implemented`: la presentación reutilizable de integraciones separa
configuración, conexión y salud.

## Regla

Una conexión `connected` no oculta una salud `stale`, `degraded` o
`reauthorization_required`. La UI muestra respectivamente `Desactualizado`,
`Degradado` o `Reautorizar`; únicamente `connected + healthy` aparece como
`Conectado`.

Esto evita que un token expirado, un sync fallido o una freshness vencida se
presente como cuenta sana cuando se activen Meta, Klaviyo o Instagram.
