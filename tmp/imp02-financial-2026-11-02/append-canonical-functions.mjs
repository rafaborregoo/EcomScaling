import fs from 'node:fs';
const file = 'supabase/migrations/20270115120000_imp02_financial_comparability.sql';
const financialSource = fs.readFileSync('supabase/migrations/20260929093000_panel_motor_financiero_real.sql', 'utf8');
const marginSource = fs.readFileSync('supabase/migrations/20261116000000_shopify_order_item_net_metrics.sql', 'utf8');
const extract = (source, name) => {
  const start = source.indexOf(`create function public.${name}(`);
  const end = source.indexOf('$$;', start) + 3;
  if (start < 0 || end < start) throw new Error(`Function missing: ${name}`);
  return source.slice(start, end).replace('create function ', 'create or replace function ')
    .replace('language sql\r\nstable', "language sql\r\nstable security invoker set search_path = '' set timezone = 'UTC'")
    .replace('language sql\nstable', "language sql\nstable security invoker set search_path = '' set timezone = 'UTC'");
};
let financial = extract(financialSource, 'shopify_financial_summary');
if (!financial.includes('o.current_total_price - o.refunds - o.current_total_tax')) throw new Error('Unexpected financial formula');
financial = financial.replace('o.current_total_price - o.refunds - o.current_total_tax', 'o.net_sales - o.current_total_tax')
  .replace(/coalesce\(fe.valid_until::timestamptz, p.effective_end\)/g, 'coalesce((fe.valid_until + 1)::timestamptz, p.effective_end)')
  .replace(/current_date/g, "(period_end at time zone 'UTC')::date");
financial = financial.replace(/      -- El ingreso sin IVA\.[\s\S]*?      coalesce\(sum\(o.net_sales - o.current_total_tax\)/, '      -- Net sales uses a verified before-return basis; subtract remaining tax once.\n      coalesce(sum(o.net_sales - o.current_total_tax)');
let margin = extract(marginSource, 'shopify_margin_summary')
  .replace('where pc.inventory_item_id = ii.id', 'where pc.inventory_item_id = ii.id\n          and pc.organization_id = target_organization_id')
  .replace('and ii.store_id = o.store_id', 'and ii.store_id = o.store_id\n     and ii.organization_id = o.organization_id');
const original = fs.readFileSync(file, 'utf8');
if (original.includes('-- Canonical financial functions')) throw new Error('Already appended');
fs.appendFileSync(file, '\n-- Canonical financial functions: same output contract, verified basis and period-specific fixed costs.\n' + margin.replace(/\r\n/g,'\n') + '\n\n' + financial.replace(/\r\n/g,'\n') + '\n');
console.log('Canonical margin and financial functions appended without a second calculation engine.');
