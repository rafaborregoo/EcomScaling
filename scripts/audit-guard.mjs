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
const ACCEPTED = new Map([
  ["next", "sin version parcheada; npm solo ofrece bajar a next@9.3.3"],
  ["postcss", "transitiva de next, misma situacion"],
  ["sharp", "transitiva de next (libvips), misma situacion"],
]);

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

const unexpected = vulnerabilities.filter((item) => !ACCEPTED.has(item.name));
const found = new Set(vulnerabilities.map((item) => item.name));
const resolved = [...ACCEPTED.keys()].filter((name) => !found.has(name));

for (const item of vulnerabilities) {
  const status = ACCEPTED.has(item.name) ? "aceptada" : "NUEVA";
  console.log(`${status.padEnd(8)} ${item.severity.padEnd(8)} ${item.name}`);
}

if (unexpected.length > 0) {
  console.error(
    `\n${unexpected.length} vulnerabilidad(es) high/critical fuera de la lista aceptada: ` +
      unexpected.map((item) => item.name).join(", ") +
      "\nRevisar `npm audit`; si tiene arreglo sin breaking change, `npm audit fix`.",
  );
  process.exit(1);
}

if (resolved.length > 0) {
  console.error(
    `\n${resolved.join(", ")} ya no aparece(n) en el informe: quitar de ACCEPTED en scripts/audit-guard.mjs.`,
  );
  process.exit(1);
}

console.log(
  `\nOK: ${vulnerabilities.length} vulnerabilidad(es) high/critical, todas aceptadas y documentadas.`,
);
