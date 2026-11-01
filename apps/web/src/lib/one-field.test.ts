import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo campo en la app: components/ui/field.tsx (Field + FieldLabel +
// FieldDescription + FieldError, FieldGroup, FieldSet + FieldLegend,
// FieldSeparator), con `<Field label="…">` como atajo y SettingRow encima.
// Los formularios de las pantallas de diseño propio en CSS modules
// (`className={s.field}`) quedan fuera a propósito, como sus tablas.
const SRC = join(import.meta.dirname, "..");
const OWN = join("components", "ui", "field.tsx");
// El ColorPicker de HeroUI nombra cada canal con su propio Label.
const HEROUI_LABEL_OK = join("components", "ui", "color-field.tsx");
const CONTROL = "Input|Select|Textarea|DatePicker|DateRangePicker|DateTimePicker|SearchableSelect|MultiSearchableSelect|TimeInput|PasswordInput|TimezoneCombobox";

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

function offenders(pattern: RegExp, skip: string[] = []) {
  return tsxFiles()
    .filter((path) => !skip.includes(path))
    .filter((path) => pattern.test(readFileSync(join(SRC, path), "utf8")));
}

test("las piezas de campo de HeroUI no se usan: va todo por components/ui/field.tsx", () => {
  assert.deepEqual(offenders(/<(Label|Description|Fieldset|TextField|ErrorMessage)\b/, [HEROUI_LABEL_OK]), []);
});

test("ningún <fieldset>/<legend> suelto: se usa FieldSet y FieldLegend", () => {
  assert.deepEqual(offenders(/<(fieldset|legend)\b/, [OWN]), []);
});

test("ninguna etiqueta hecha a mano encima de un control: se usa <Field label>", () => {
  // <label className="…">Texto<Input …/></label> o <p className="… font-medium">Texto</p><Select …/>
  const wrapped = new RegExp(String.raw`<label className="[^"]*">\s*[^<{}]+?\s*<(?:${CONTROL})\b`);
  const paragraph = new RegExp(String.raw`<(?:p|span|div)\b[^>]*className="[^"]*\btext-sm\b[^"]*\bfont-medium\b[^"]*"[^>]*>[^<{]{2,80}</(?:p|span|div)>\s*<(?:${CONTROL})\b`);
  assert.deepEqual(offenders(wrapped), [], "Usa <Field label> de @/components/ui");
  assert.deepEqual(offenders(paragraph), [], "Usa <Field label> de @/components/ui");
  // <label className="…" htmlFor="x">Texto</label><Input id="x" …/>: la etiqueta suelta de shadcn (Label) es FieldLabel.
  const sibling = new RegExp(String.raw`<label className="[^"]*"[^>]*>\s*[^<{}]+?\s*</label>\s*<(?:${CONTROL})\b`);
  assert.deepEqual(offenders(sibling), [], "Usa <Field label> de @/components/ui");
});

test("ningún <select> nativo dentro de un Field: no se enlaza con la etiqueta", () => {
  assert.deepEqual(offenders(/<Field\b[^>]*>\s*<select\b/), [], "Usa Select o SearchableSelect de @/components/ui");
});
