-- R-008: soft-delete de organizaciones. Paso 1/2: el nuevo valor de enum se
-- anade en su propia migracion porque Postgres no permite usar un valor de
-- enum en la misma transaccion en la que se crea (ALTER TYPE ... ADD VALUE
-- no es transaccional junto con otro DDL que lo consuma).
alter type public.organization_status add value if not exists 'pending_deletion';
