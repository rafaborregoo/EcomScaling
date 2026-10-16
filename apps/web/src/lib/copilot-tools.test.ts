import assert from "node:assert/strict";
import test from "node:test";
import { expandCopilotCommand, matchingCopilotCommands } from "./copilot-tools.js";

test("a command expands into a full question and keeps what follows it", () => {
  assert.equal(
    expandCopilotCommand("/informe de septiembre"),
    "Genera un informe PDF con la plantilla que mejor encaje. de septiembre",
  );
  assert.match(expandCopilotCommand("/EMBUDO"), /^¿En qué paso del embudo/);
});

test("plain text and unknown commands pass through untouched", () => {
  assert.equal(expandCopilotCommand("  ¿qué pasó ayer?  "), "¿qué pasó ayer?");
  assert.equal(expandCopilotCommand("/nada que ver"), "/nada que ver");
});

test("the menu filters by prefix only while the command is being typed", () => {
  assert.deepEqual(matchingCopilotCommands("/ma").map((c) => c.command), ["/margen"]);
  assert.equal(matchingCopilotCommands("/").length, 6);
  assert.equal(matchingCopilotCommands("/informe algo").length, 0);
  assert.equal(matchingCopilotCommands("hola").length, 0);
});
