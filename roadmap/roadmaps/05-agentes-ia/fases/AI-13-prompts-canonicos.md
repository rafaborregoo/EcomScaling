# AI-13 — Prompts canónicos por agente

## Estado

`done` a nivel de infraestructura y activación remota — 2026-08-24.

## Qué se implementó

- Migración `supabase/migrations/20260824120000_ai_13_canonical_prompt_sections.sql` aplicada al proyecto remoto.
- Nuevas prompt versions estructuradas para A01, A02, A04, A06, A09 y A11.
- Versiones históricas conservadas; se desactivan solo las versiones activas anteriores.
- Cada prompt usa `ROLE`, `GOAL`, `CONTEXT`, `INPUT`, `RULES / CONSTRAINTS`, `TOOLS`, `OUTPUT`, `FAILURE BEHAVIOUR` y `EXAMPLES`.
- Se mantienen herramientas, permisos y `approval_mode` del diseño vigente.

## Verificación

- `npx supabase db push --linked --dry-run`: migración válida, sin escrituras durante el dry-run.
- `npx supabase db push --linked`: migración aplicada.
- `npx supabase migration list --linked`: `20260824120000` local y remoto.
- `node scripts/regenerate-generated-schema.mjs --check`: `GENERATED_SCHEMA_OK: 64 migrations`.
- `npx tsx --test packages/ai/src/index.test.ts`: 53/53.

## Límites honestos

La activación de prompts no equivale a validar el comportamiento con datos reales de Meta/Klaviyo/Instagram. Esa validación requiere las credenciales, scopes y cuentas externas correspondientes. Los agentes siguen protegidos por el contrato de salida, provenance, presupuestos, shadow mode y aprobación humana.
