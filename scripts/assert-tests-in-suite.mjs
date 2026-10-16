// Un test que no esta en ningun script de package.json no se ejecuta nunca, y
// su verde no significa nada. Paso dos veces: untrusted-context.test.ts (la
// suite de la frontera de seguridad) y 76 ficheros de api y web descubiertos
// el 2026-09-24, dos de ellos ya rotos sin que nadie lo supiera.
//
// La web y los paquetes usan glob y no necesitan esto; la api mantiene lista
// manual porque separa los tests que necesitan base de datos (test:remote).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonText = readFileSync(
  path.join(root, "apps/api/package.json"),
  "utf8",
).replace(/^\uFEFF/, "");
const scripts = Object.values(JSON.parse(packageJsonText).scripts).join(" ");
const tests = execFileSync(
  "git",
  ["ls-files", "-co", "--exclude-standard", "apps/api/src"],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => file.replace("apps/api/", ""));
const orphans = tests.filter((file) => !scripts.includes(file));

if (orphans.length) {
  console.error(
    `Tests de apps/api que ningun script ejecuta:\n- ${orphans.join("\n- ")}\nAnadelos a test:unit (o a test:remote si necesitan base de datos).`,
  );
  process.exit(1);
}
console.log(
  `TESTS_IN_SUITE_OK: ${tests.length} ficheros de test de apps/api referenciados`,
);
