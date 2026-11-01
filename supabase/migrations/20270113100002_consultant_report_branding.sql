alter table public.organizations add column if not exists brand_accent_color text;
alter table public.organizations drop constraint if exists organizations_brand_accent_color_format;
alter table public.organizations add constraint organizations_brand_accent_color_format
  check (brand_accent_color is null or brand_accent_color ~ '^#[0-9A-Fa-f]{6}$');
