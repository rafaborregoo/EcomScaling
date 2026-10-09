import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickActionInput } from "./campaign-quick-actions.js";

test("normaliza y devuelve solo los campos presentes", () => {
  assert.deepEqual(parseQuickActionInput({ name: "  Newsletter  ", whenKind: "dow", dow: 4 }), {
    ok: true,
    data: { name: "Newsletter", when_kind: "dow", dow: 4 },
  });
});

test("rechaza entradas invalidas", () => {
  const cases: Array<[Parameters<typeof parseQuickActionInput>[0], string]> = [
    [{ name: "   " }, "quick_action_name_required"],
    [{ name: "x".repeat(33) }, "quick_action_name_too_long"],
    [{ visibility: "all" }, "quick_action_visibility_invalid"],
    [{ icon: "rocket" }, "quick_action_icon_invalid"],
    [{ dow: 7 }, "quick_action_dow_invalid"],
    [{ offsetDays: 121 }, "quick_action_offset_invalid"],
    [{ brief: "x".repeat(2001) }, "quick_action_brief_too_long"],
  ];
  for (const [input, error] of cases) {
    const parsed = parseQuickActionInput(input);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok === false && parsed.error, error);
  }
});
