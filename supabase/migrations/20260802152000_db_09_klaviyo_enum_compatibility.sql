-- DB-09: keep fresh installations compatible with the flat production contract.
-- Production currently has text-compatible columns and no these enums; a new
-- installation created by the foundation migration does. The conditional block
-- makes the migration safe in both shapes.

do $$
begin
  if to_regtype('public.klaviyo_report_type') is not null then
    alter type public.klaviyo_report_type add value if not exists 'campaign-values-report';
    alter type public.klaviyo_report_type add value if not exists 'flow-values-report';
    alter type public.klaviyo_report_type add value if not exists 'form-values-report';
    alter type public.klaviyo_report_type add value if not exists 'segment-values-report';
  end if;
  if to_regtype('public.klaviyo_report_status') is not null then
    alter type public.klaviyo_report_status add value if not exists 'succeeded';
  end if;
end
$$;
