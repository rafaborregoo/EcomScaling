/**
 * BE-00: escaneo de dependencias para CI.
 *
 * `npm audit --audit-level=high` no sirve tal cual aqui: quedan 3
 * vulnerabilidades high en el arbol de Next (postcss, sharp y el propio next)
 * cuyo unico "arreglo" segun npm es bajar a next@9.3.3, que no es una opcion.
 * Un paso que siempre falla se termina ignorando o tapando con `|| true`, y
 * entonces no protege de nada.
 *
 * Este guard falla solo cuando la situacion EMPEORA: si aparece una
 * vulnerabilidad high/critical nueva fuera de las aceptadas, o si una aceptada
 * deja de estar en la lista. Cuando Next publique el parche, el paquete
 * desaparece del informe y hay que bajarlo de ACCEPTED — el guard obliga a ese
 * repaso en vez de dejar la excepcion viva para siempre.
 *
 * Uso: `node scripts/audit-guard.mjs`
 */
import { execFileSync } from "node:child_process";

/**
 * Paquetes con vulnerabilidad high/critical aceptada a dia de hoy, con el
 * motivo. Revisado 2026-08-03.
 */
const BLOCKING = new Set(["high", "critical"]);

function runAudit() {
  try {
    // npm audit sale con codigo != 0 cuando encuentra algo; el JSON es valido
    // igualmente, asi que el error se lee, no se propaga.
    return execFileSync("npm", ["audit", "--json", "--omit=dev"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) {
      return error.stdout;
    }
    throw error;
  }
}

const report = JSON.parse(runAudit());
const vulnerabilities = Object.values(report.vulnerabilities ?? {}).filter(
  (item) => BLOCKING.has(item.severity),
);

for (const item of vulnerabilities) {
  console.log(`${item.severity.padEnd(8)} ${item.name}`);
}

if (vulnerabilities.length > 0) {
  console.error(
    `\n${vulnerabilities.length} vulnerabilidad(es) high/critical en dependencias de produccion. ` +
      "Revisar `npm audit` y actualizar de forma compatible.",
  );
  process.exit(1);
}

console.log(
  "\nOK: no hay vulnerabilidades high/critical en dependencias de produccion.",
);
