-- AI-11: input de "plantilla" del generador de marketing. El consultor fija
-- una paleta de marca (roles -> hex) y una lista de textos que deben aparecer
-- literalmente; ambos viajan en el brief/contexto del agente a11 y se guardan
-- con el borrador para trazabilidad y para regenerar con los mismos ajustes.
--
-- No se toca el prompt ni la version del agente: el prompt v2 ya trabaja "a
-- partir del brief del consultor" y usa el contexto de empresa via las tools
-- de conocimiento. Si en validacion la IA no respeta bien colores/textos
-- literales, se hara un prompt v3 (iteracion aparte).

alter table public.marketing_content_drafts
  add column if not exists brand_colors jsonb not null default '{}'::jsonb,
  add column if not exists verbatim_texts jsonb not null default '[]'::jsonb;

comment on column public.marketing_content_drafts.brand_colors is
  'AI-11: paleta de marca del input del consultor (roles -> hex, p.ej. {"primary":"#1d4ed8"}). El agente la usa para fondos/botones/texto del HTML y los bloques.';
comment on column public.marketing_content_drafts.verbatim_texts is
  'AI-11: textos que el agente debe incluir literalmente en el contenido, sin reescribir.';
