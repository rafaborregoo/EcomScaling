-- Estado del envio de la factura al comprador. El correo es un efecto
-- secundario del webhook: no debe hacer que Stripe reintente el cobro, pero
-- tampoco debe perderse un fallo SMTP silenciosamente.
alter table private.billing_invoices
  add column if not exists invoice_email_status varchar(20) not null default 'pending'
    check (invoice_email_status in ('pending', 'sending', 'sent', 'failed', 'not_sent'));

alter table private.billing_invoices
  add column if not exists invoice_email_attempts integer not null default 0
    check (invoice_email_attempts >= 0);

alter table private.billing_invoices
  add column if not exists invoice_email_sent_at timestamptz;

alter table private.billing_invoices
  add column if not exists invoice_email_last_attempt_at timestamptz;

alter table private.billing_invoices
  add column if not exists invoice_email_message_id text;

alter table private.billing_invoices
  add column if not exists invoice_email_error text;

create index if not exists billing_invoices_email_status_idx
  on private.billing_invoices (invoice_email_status, invoice_email_last_attempt_at);
;
