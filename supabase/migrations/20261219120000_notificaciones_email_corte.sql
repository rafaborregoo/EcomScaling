-- El primer tick de emails (20261219110000) recorre los avisos de los últimos
-- 8 días sin `email_sent_at`. Sin este corte, al desplegar le llegaría a cada
-- persona un correo con avisos viejos que ya vio en la campana. Lo anterior a
-- la puesta en marcha se da por decidido. Corte fijo: reaplicar no toca avisos
-- nuevos.
update public.notifications
set email_sent_at = created_at
where email_sent_at is null
  and created_at < '2026-10-12T12:00:00Z';
