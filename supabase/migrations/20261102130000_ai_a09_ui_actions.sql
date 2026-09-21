-- A09: conserva las acciones visuales estructuradas junto al mensaje para que
-- los botones sigan disponibles al recargar una conversacion.
alter table public.ai_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;
