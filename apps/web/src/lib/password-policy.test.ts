import assert from "node:assert/strict";
import test from "node:test";
import {
  getPasswordErrorMessage,
  getPasswordRequirements,
  isPasswordValid,
} from "./password-policy";

test("matches the production Supabase password policy", () => {
  assert.equal(isPasswordValid("EcomScaling-2026!"), true);
  assert.equal(isPasswordValid("EcomScaling2026"), false);
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
