import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola tarjeta en la app: components/ui/card.tsx (Card + CardHeader +
// CardTitle + CardDescription + CardAction + CardContent + CardFooter).
const SRC = join(import.meta.dirname, "..");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("la Card de HeroUI no se usa: va todo por components/ui/card.tsx", () => {
  const offenders = tsxFiles()
    .filter((path) => /import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*"@heroui\/react"/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa Card de @/components/ui:\n${offenders.join("\n")}`);
});

test("ninguna Card usa la API vieja de props (title, kicker, description, actions)", () => {
  // La cabecera se compone con CardHeader > CardKicker/CardTitle/CardDescription/CardAction.
  const offenders = tsxFiles()
    .filter((path) => /<Card\b(?:\s+[\w-]+(?:=(?:"[^"]*"|\{[^}]*\}))?)*\s+(kicker|description|actions|headingLevel)=/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, []);
});
