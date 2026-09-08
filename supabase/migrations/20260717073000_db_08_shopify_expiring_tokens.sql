alter table private.integration_credentials
  add column if not exists refresh_token_expires_at timestamptz,
  add column if not exists refresh_locked_at timestamptz;

comment on column private.integration_credentials.expires_at is
  'Expiracion del access token. Para tokens Shopify offline expiring=1, se refresca antes de este instante.';
comment on column private.integration_credentials.refresh_token_expires_at is
  'Expiracion del refresh token asociado. Cuando pasa, ya no se puede renovar y hace falta reconectar.';
comment on column private.integration_credentials.refresh_locked_at is
  'Claim temporal para evitar que dos procesos renueven el mismo token a la vez. Se limpia tras renovar o expira sola a los 20s.';
