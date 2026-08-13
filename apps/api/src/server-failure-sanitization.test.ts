import assert from "node:assert/strict";
import test from "node:test";

import {
  redactFailureDetail,
  sendAuthFailure,
  sendServiceFailure,
} from "./server.js";

test("does not expose internal detail for server failures", () => {
  let payload: unknown;
  let statusCode: number | undefined;

  const reply = {
    code(code: number) {
      statusCode = code;
      return {
        send(value: unknown) {
          payload = value;
          return value;
        },
      };
    },
  };

  sendServiceFailure(reply, {
    ok: false,
    statusCode: 500,
    error: "database_query_failed",
    message: "No se pudo cargar la información.",
    detail: "relation private_table does not exist",
  });

  assert.equal(statusCode, 500);
  assert.deepEqual(payload, {
    ok: false,
    statusCode: 500,
    error: "database_query_failed",
    message: "No se pudo cargar la información.",
  });
});

test("keeps controlled detail for client errors", () => {
  let payload: unknown;

  const reply = {
    code() {
      return {
        send(value: unknown) {
          payload = value;
          return value;
        },
      };
    },
  };

  sendServiceFailure(reply, {
    ok: false,
    statusCode: 400,
    error: "invalid_input",
    detail: "El campo objetivo es obligatorio.",
  });

  assert.deepEqual(payload, {
    ok: false,
    statusCode: 400,
    error: "invalid_input",
    detail: "El campo objetivo es obligatorio.",
  });
});

test("does not expose auth infrastructure detail for server failures", () => {
  let payload: unknown;

  const reply = {
    code() {
      return {
        send(value: unknown) {
          payload = value;
          return value;
        },
      };
    },
  };

  sendAuthFailure(reply, {
    statusCode: 500,
    error: "auth_context_load_failed",
    message: "No se pudo validar la sesión.",
    detail: "relation organization_members does not exist",
  });

  assert.deepEqual(payload, {
    statusCode: 500,
    error: "auth_context_load_failed",
    message: "No se pudo validar la sesión.",
  });
});

test("redacts credentials from failure details before logging", () => {
  assert.equal(
    redactFailureDetail(
      "Bearer super-secret https://example.test/callback?access_token=abc123&ok=1",
    ),
    "Bearer [REDACTED] https://example.test/callback?access_token=[REDACTED]&ok=1",
  );
});
