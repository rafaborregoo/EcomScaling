# INT-07 - Activation gate dependiente de capacidades

## Estado

`implemented`: `getIntegrationActivationGateKeys` deriva los requisitos de
cierre a partir del catálogo de capacidades del proveedor.

## Ejemplos

- Fathom webhook-only no exige OAuth, redirect URI, scopes, asset selection ni
  sync inicial; exige credenciales, respuesta del proveedor, freshness y error
  recuperable.
- Meta exige OAuth, scopes, selección de cuenta, sync inicial/incremental,
  freshness, reautorización y manejo de errores.
- La llamada sin capacidades mantiene el gate estricto histórico para evitar
  romper integraciones existentes que todavía no han migrado al perfil.

Los booleanos describen evidencia, nunca contienen tokens ni payloads externos.

`recoverableErrorVerified` ya no es un bloqueo permanente: la API lo deriva de
los `integration_sync_runs` de la conexión cuando existe un run `failed` o
`partial` seguido cronológicamente por uno `succeeded`. Así la recuperación se
demuestra con operación real, sin simularla ni guardar payloads del proveedor.

La API lo expone en `GET /v1/organizations/:organizationId/integrations` como
`provider.activation = { ready, missing }`; la UI lo presenta con
`IntegrationActivationChecklist`. La respuesta es deliberadamente conservadora:
la recuperación sólo se da por verificada después de observarla realmente.

La evidencia de recuperación se materializa ahora automáticamente cuando los
sync runs de una conexión contienen un `failed` o `partial` seguido por un
`succeeded`. Sin esa secuencia real, el gate permanece pendiente.
