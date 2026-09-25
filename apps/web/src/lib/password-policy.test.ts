import assert from "node:assert/strict";
import test from "node:test";
import {
  getPasswordErrorMessage,
  getPasswordRequirements,
  isPasswordValid,
  passwordConfirmationState,
} from "./password-policy";

test("matches the production Supabase password policy", () => {
  assert.equal(isPasswordValid("Enora-2026!"), true);
  assert.equal(isPasswordValid("Enora2026"), false);
  assert.deepEqual(getPasswordRequirements("solo-minuscula1!"), {
    minLength: true,
    lowercase: true,
    uppercase: false,
    number: true,
    symbol: true,
  });
});

test("translates Supabase weak-password errors into a useful message", () => {
  assert.equal(
    getPasswordErrorMessage({
      message: "Password should contain at least one character of each: ...",
    }),
    "La contraseña debe tener al menos 8 caracteres e incluir una minúscula, una mayúscula, un número y un símbolo.",
  );
});

test("explains the provider reason when a locally valid password is rejected", () => {
  assert.equal(
    getPasswordErrorMessage(
      {
        code: "weak_password",
        message: "Password should contain at least one character of each: ...",
        reasons: ["pwned"],
      },
      "Rb49832956!",
    ),
    "Esta contraseña aparece en filtraciones conocidas. Elige una contraseña diferente.",
  );
});

test("validates the confirmation field explicitly", () => {
  assert.equal(passwordConfirmationState("Enora-2026!", ""), "empty");
  assert.equal(
    passwordConfirmationState("Enora-2026!", "Enora-2026!"),
    "match",
  );
  assert.equal(
    passwordConfirmationState("Enora-2026!", "Enora-2026?"),
    "mismatch",
  );
});
