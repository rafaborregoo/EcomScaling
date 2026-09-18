# Conocimiento global (metodologia EcomScaling)

Fuente de lo que se ingesta como conocimiento **global** (`visibility = 'global'`,
`organization_id = null`) en el indice RAG. No cuelga de ningun cliente: lo
gestiona un `platform_admin` desde `/admin/conocimiento`.

Ingesta: `npm run conocimiento:ingest -- conocimiento/<carpeta> [--dry-run] [--limit=N]`

`--dry-run` no llama a Voyage: solo lista documentos, chunks y tokens
estimados. `--limit=N` ingesta N documentos y para. Entre documento y
documento espera `INGEST_DELAY_MS` (3000 por defecto) para no encadenar
peticiones a Voyage.

Para **implementar** un bloque ya clasificado (contrato + motor + pixel), usa
[`Prompt maestro — Implementación de fases (contrato + motor + pixel).md`](Prompt%20maestro%20%E2%80%94%20Implementaci%C3%B3n%20de%20fases%20(contrato%20%2B%20motor%20%2B%20pixel).md)
junto con [`docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md`](../docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md).
Este README y el prompt de clasificación de abajo son para el paso anterior:
convertir un `.md` de origen en las 8 capas.

## Estructura por fase

Cada `fase-XX/` tiene 8 capas (ver `Prompt maestro — Clasificacion y
destilacion del conocimiento EcomScaling.md`):

```text
fase-XX/
├── 00-corpus-maestro/       fuente original, NO se indexa directamente
├── 01-rag-produccion/       lo unico que se ingesta -- ver `conocimiento:ingest`
├── 02-contratos-IA/         requisitos entre componentes/agentes
├── 03-runtime/              flujos y logica de orquestacion
├── 04-policies-guardrails/  limites, permisos, supervision humana
├── 05-experience-learning/  aprendizaje dinamico, outcomes, confidence
├── 06-tenant-context/       lo configurable por tienda/cliente
└── 99-auditoria/            manifest de clasificacion por bloque
```

Solo `01-rag-produccion` se ingesta. Las demas capas existen en el repo pero
`scripts/ingest-conocimiento.mjs` las rechaza por lista blanca.

**Importaciones nuevas**: cuando destiles un bloque y sueltes su carpeta
`fase-XX/` (con las 8 capas ya dentro) en la raiz de la fase, se fusiona con
lo que ya hay -- comprobando colisiones de nombre antes de mover -- y se
borra la carpeta importada. Avisa cuando hayas terminado de soltar todo, no a
mitad, o hay que repetir la pasada.

## Fases

| Carpeta | Tema | Bloques en `00-corpus-maestro` |
| --- | --- | --- |
| `fase-01` | Lo funcional del ecommerce | 01..16 (16, completa) |
| `fase-02` | Ciclo de vida y madurez del ecommerce | E1..E12 (12, completa) |
| `fase-03` | Sistema de diagnostico | D01..D11 (11, completa) |
| `fase-04` | Priorizacion y decision | P00..P12, falta P02 |
| `fase-05` | Estrategias y playbooks por area | 5.00..5.11 (12, completa, con destilado completo en `01-rag-produccion`) |
| `fase-06` | Benchmarks y guardrails por area | 6.00..6.13 (14, completa; destilado en `01-rag-produccion`) |
| `fase-07` | Motor de recomendaciones | 7.01..7.18, **7.16 no existe** (17 bloques reales) |
| `fase-08` | Ejecucion y supervision | 8.00..8.17 (18, completa; destilado en `01-rag-produccion` completo salvo 8.12) |
| `fase-09` | Aprendizaje continuo | 9.00..9.41, faltan 9.02 y 9.21 (40 bloques reales, destilado completo) |

`01-rag-produccion` (lo indexado) va muy por detras del corpus: la mayoria de
fases aun no tienen destilado.

## Reglas de ingesta

- **Un `.md` = un documento** en el catalogo. El titulo sale de su primer
  encabezado `#`; si varios ficheros de la misma carpeta comparten el
  primero, se desambigua con el siguiente que no compartan.
- Los encabezados markdown (`#`..`######`) importan: el chunker arrastra el
  de seccion a cada fragmento (`chunkText`, `packages/ai/src/index.ts`). No
  aplanar a texto corrido.
- Subir cada documento **completo**. A medias se indexa peor; si luego
  cambia, se reingesta y la version nueva sustituye a la anterior.
- Lo que el cliente no debe leer va `consultant_only` (el default del
  script): el copiloto del cliente no lo recupera, solo consultor y platform
  admin.
