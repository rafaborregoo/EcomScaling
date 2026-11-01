# Historial remoto recuperado — 1 de noviembre de 2026

Este directorio conserva evidencia del historial que ya existía en Supabase. **No es una carpeta de migraciones ejecutables y no importa documentos al RAG ni genera embeddings.** No debe copiarse a `supabase/migrations` ni aplicarse en bloque.

La lectura de `supabase_migrations.schema_migrations` encontró 713 versiones remotas frente a 626 identificadores locales. Los 626 identificadores locales estaban registrados remotamente. Para las otras 87 versiones:

- Se recuperaron las sentencias originales de 86 versiones en archivos SQL separados.
- La versión `20261021094657`, `a23_creative_full_evidence_and_coordination`, no conserva sentencias en el historial consultado. El manifiesto la identifica como fuente no disponible. Existe una migración local posterior relacionada, `20270106110000_a23_creative_full_evidence_and_coordination.sql`; no se presenta como el original recuperado.

[manifest.json](manifest.json) enumera cada versión, nombre, disponibilidad y SHA-256 del archivo archivado. Se normalizó el salto de línea a LF y se añadieron dos comentarios que identifican su finalidad histórica; el hash corresponde a esos bytes archivados. No es un hash del archivo original que pudo ejecutarse.

Para verificar la integridad desde PowerShell en este directorio:

```powershell
$manifest = Get-Content -LiteralPath ./manifest.json -Raw | ConvertFrom-Json
foreach ($entry in $manifest.entries) {
  if ($entry.file) {
    $actual = (Get-FileHash -LiteralPath $entry.file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $entry.sha256_file) { throw "Hash distinto: $($entry.version)" }
  }
}
```

La recuperación no ejecutó DDL, no reparó registros de migraciones ni cambió datos remotos. No sustituye una reconciliación explícita de la cadena antes de usar herramientas que exigen paridad entre archivos e historial. Las diferencias entre identificadores equivalentes y la comparación de cuerpos de funciones están descritas en el seguimiento de implementación.

Los embeddings del conocimiento son un flujo diferente: el backend llama a Voyage y almacena sus vectores en las tablas de conocimiento de Supabase. La incorporación de los paquetes Meta Ads al RAG corresponde a IMP-04 y no se ha ejecutado en esta entrega.
