/**
 * Regenera packages/db/src/database.types.ts desde SUPABASE_DB_URL.
 *
 * Existe porque no lo habia: el fichero se generaba a mano y se quedo 36 tablas
 * por detras del esquema (todo Meta y medio Shopify) sin que nada fallara, hasta
 * que se comparo contra la base. La CLI de Supabase levanta pg-meta en un
 * contenedor, asi que hace falta Docker corriendo.
 *
 *   npm run db:types
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Falta SUPABASE_DB_URL.");
  process.exit(1);
}

const destino = "packages/db/src/database.types.ts";
let salida;
try {
  salida = execFileSync(
    "npx",
    ["supabase", "gen", "types", "typescript", "--db-url", url, "--schema", "public,private"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true, stdio: ["ignore", "pipe", "inherit"] },
  );
} catch (error) {
  console.error("\nLa CLI de Supabase fallo. Si el error habla del API de Docker, arranca Docker Desktop.");
  process.exit(error.status ?? 1);
}

if (!salida.includes("export type Database")) {
  console.error("La CLI no devolvio un fichero de tipos; no se toca el destino.");
  process.exit(1);
}

// El fichero del repo es UTF-8 con BOM y CRLF: mantenerlo evita un diff de 10k
// lineas por el fin de linea.
fs.writeFileSync(destino, `﻿${salida.replace(/\r?\n/g, "\r\n")}`);
console.log(`${destino}: ${salida.split("\n").length} lineas.`);
