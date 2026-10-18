-- Tareas que el consultor propone al cliente: nacen en 'proposed' y el
-- cliente las acepta (-> 'pending') o las rechaza (-> 'ignored').
-- Fuera de 'pending'/'in_progress' no cuentan como trabajo abierto hasta que
-- el cliente las acepta. Idempotente (CLAUDE.md: se puede reaplicar).
alter type public.task_status add value if not exists 'proposed';
