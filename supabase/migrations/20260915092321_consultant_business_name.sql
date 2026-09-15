alter table public.profiles
  add column if not exists business_name text;

comment on column public.profiles.business_name is
  'Nombre del negocio o agencia mostrado durante el onboarding del consultor.';
