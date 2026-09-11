# Conocimiento global (metodologia EcomScaling)

Fuente de lo que se ingesta como conocimiento **global** (`visibility = 'global'`,
`organization_id = null`) en el indice RAG. No cuelga de ningun cliente: lo
gestiona un `platform_admin` desde `/admin/conocimiento`.

Ingesta: `npm run conocimiento:ingest -- conocimiento/<carpeta> [--dry-run] [--limit=N]`

`--dry-run` no llama a Voyage: solo lista documentos, chunks y tokens
estimados. `--limit=N` ingesta N documentos y para. Entre documento y
documento espera `INGEST_DELAY_MS` (2000 por defecto) para no encadenar
peticiones a Voyage.

## Reglas

- **Un `.md` = un documento** en el catalogo. El titulo sale de su primer encabezado `#`.
- Los encabezados markdown (`#`..`######`) importan: el chunker arrastra el de
  seccion a cada fragmento (`chunkText`, `packages/ai/src/index.ts`). No
  aplanar a texto corrido.
- Subir cada documento **completo**. A medias se indexa peor; si luego cambia,
  se reingesta y la version nueva sustituye a la anterior.
- Primero lo `canonical` (lo que no se mueve), despues lo `operational`.
- Lo que el cliente no debe leer va `consultant_only` (el default del script):
  el copiloto del cliente no lo recupera, solo consultor y platform admin.

## Fases

| Carpeta | Tema |
| --- | --- |
| `fase-01` | Lo funcional del ecommerce: 16 bloques (01..16), ~434k chars, ~341 chunks |
| `fase-02` | _por definir_ |
| `fase-03` | _por definir_ |
| `fase-04` | _por definir_ |
| `fase-05` | _por definir_ |
| `fase-06` | _por definir_ |
| `fase-07` | _por definir_ |
| `fase-08` | _por definir_ |
| `fase-09` | _por definir_ |
