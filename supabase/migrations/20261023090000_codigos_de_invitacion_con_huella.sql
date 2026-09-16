-- Fase 2 (codigos) de PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md
--
-- El codigo de vinculacion deja de guardarse en claro (§21, §51).
--
-- Un codigo da acceso de owner a la organizacion de un cliente. Hoy vive en
-- `client_invites.code` tal cual, al lado del email que hace falta para
-- canjearlo: quien lea esa tabla se lleva las dos mitades de la cerradura.
--
-- Se guarda una huella HMAC-SHA256 con una clave que NO esta en la base de
-- datos (`INVITE_CODE_SECRET`). No un hash a secas: el codigo tiene ~40 bits
-- de entropia y un SHA-256 pelado se revienta por fuerza bruta en un minuto.
--
-- ROTACION, no corte. La columna `code` se queda y se deja de escribir; los
-- codigos vivos emitidos antes siguen canjeandose por su valor en claro
-- mientras no caduquen (7 dias). Pasada esa ventana, una migracion de limpieza
-- borra la columna. Cortar de golpe invalidaria los codigos que un consultor
-- ya ha repartido, que es justo lo que no puede pasar.

alter table public.client_invites
  add column if not exists code_hash text;

-- `code` deja de ser obligatoria: los codigos nuevos solo llevan huella.
alter table public.client_invites
  alter column code drop not null;

-- La busqueda al canjear pasa a ser por huella, y dos codigos no pueden
-- compartirla. El indice es unico por el mismo motivo por el que lo era el
-- codigo: una colision es dos clientes con la misma llave.
create unique index if not exists client_invites_code_hash_unique
  on public.client_invites (code_hash)
  where code_hash is not null;

-- Los codigos que ya existen NO se rellenan aqui: la clave vive en el API, no
-- en la base de datos, asi que esta migracion no puede calcular su huella.
-- Se canjean por `code` mientras duren, que es exactamente para lo que se deja
-- la columna.

-- Asercion: o huella, o codigo en claro, pero nunca una fila viva sin ninguna
-- de las dos -- eso seria un codigo repartido que ya no se puede canjear.
do $$
declare
  rotas integer;
begin
  select count(*) into rotas
  from public.client_invites
  where status = 'pending'
    and expires_at > now()
    and code is null
    and code_hash is null;

  if rotas > 0 then
    raise exception '% invitaciones vivas se quedan sin forma de canjearse', rotas;
  end if;
end;
$$;
