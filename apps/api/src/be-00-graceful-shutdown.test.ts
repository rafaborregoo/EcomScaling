/**
 * BE-00: `server.ts` no tenia ningun manejador de SIGTERM/SIGINT -- un
 * `docker stop`/redeploy/scale-down mataba el proceso a mitad de request en
 * vez de drenar conexiones. Test real: arranca el servidor como proceso hijo
 * de verdad (no `app.inject`, que corre en el mismo proceso y no ejercita
 * `process.on("SIGTERM", ...)`), le manda SIGTERM y confirma que sale con
 * codigo 0 bien por debajo del timeout de seguridad de 10s (si colgara,
 * `registerGracefulShutdown` lo forzaria a los 10s con codigo 1).
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY/etc (las
 * mismas variables que necesita `server.ts` para arrancar).
 * Ejecutar con `npm run test:remote -w @e-nora/api` en un proyecto aislado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createShutdownHandler } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.join(__dirname, "server.ts");
const TEST_PORT = 4123;

// Verifica la LOGICA del handler directamente (timeout, guard de senal
// duplicada, codigos de salida) sin depender de un SIGTERM real del SO --
// portable a cualquier plataforma, a diferencia del test de proceso hijo de
// mas abajo que si necesita Linux para significar algo.
test("createShutdownHandler: cierre normal llama exit(0) tras app.close()", async () => {
  const closeCalls: number[] = [];
  const exitCalls: number[] = [];
  const fakeApp = {
    close: async () => {
      closeCalls.push(1);
    },
  };

  const shutdown = createShutdownHandler(fakeApp, {
    exit: (code) => exitCalls.push(code),
    timeoutMs: 5000,
  });
  await shutdown("SIGTERM");

  assert.deepEqual(closeCalls, [1]);
  assert.deepEqual(exitCalls, [0]);
});

test("createShutdownHandler: app.close() que nunca resuelve fuerza exit(1) al timeout", async () => {
  const exitCalls: number[] = [];
  const fakeApp = { close: () => new Promise<void>(() => {}) }; // nunca resuelve

  const shutdown = createShutdownHandler(fakeApp, {
    exit: (code) => exitCalls.push(code),
    timeoutMs: 50,
  });
  void shutdown("SIGTERM");

  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.deepEqual(exitCalls, [1]);
});

test("createShutdownHandler: app.close() que rechaza llama exit(1)", async () => {
  const exitCalls: number[] = [];
  const fakeApp = {
    close: async () => {
      throw new Error("boom");
    },
  };

  const shutdown = createShutdownHandler(fakeApp, {
    exit: (code) => exitCalls.push(code),
    timeoutMs: 5000,
  });
  await shutdown("SIGTERM");

  assert.deepEqual(exitCalls, [1]);
});

test("createShutdownHandler: una segunda senal mientras ya esta cerrando no dispara un segundo cierre", async () => {
  const closeCalls: number[] = [];
  const exitCalls: number[] = [];
  let resolveClose: () => void = () => {};
  const fakeApp = {
    close: () =>
      new Promise<void>((resolve) => {
        closeCalls.push(1);
        resolveClose = resolve;
      }),
  };

  const shutdown = createShutdownHandler(fakeApp, {
    exit: (code) => exitCalls.push(code),
    timeoutMs: 5000,
  });
  const first = shutdown("SIGTERM");
  await shutdown("SIGINT"); // llega mientras el primer close() todavia esta pendiente

  assert.deepEqual(
    closeCalls,
    [1],
    "solo deberia haber un app.close() real, no uno por senal",
  );

  resolveClose();
  await first;
  assert.deepEqual(exitCalls, [0]);
});

// Windows no entrega SIGTERM real a procesos hijos (`child.kill("SIGTERM")`
// ahi simplemente termina el proceso a la fuerza, sin invocar el manejador --
// confirmado en este mismo entorno: el proceso muere con codigo `null`, no
// con la salida limpia de `registerGracefulShutdown`). CI corre en
// `ubuntu-latest` y produccion es Linux, que es donde este test si verifica
// el comportamiento real.
test(
  "SIGTERM cierra el servidor de forma graceful, con codigo 0 y bien por debajo del timeout de seguridad",
  {
    skip:
      process.platform === "win32"
        ? "SIGTERM no es real en Windows, ver comentario arriba"
        : false,
  },
  async () => {
    const child = spawn("tsx", [SERVER_ENTRY], {
      env: {
        ...process.env,
        API_PORT: String(TEST_PORT),
        API_HOST: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    await waitForListening(() => stdout, 15_000);

    const shutdownStart = Date.now();
    child.kill("SIGTERM");

    const exit = await waitForExit(child, 15_000);
    const shutdownDurationMs = Date.now() - shutdownStart;

    assert.equal(
      exit.code,
      0,
      `se esperaba salida limpia (codigo 0), se obtuvo ${exit.code}. stdout: ${stdout} stderr: ${stderr}`,
    );
    assert.ok(
      shutdownDurationMs < 9_000,
      `el shutdown tardo ${shutdownDurationMs}ms -- si se acerca a los 10s del timeout de seguridad, probablemente colgo y lo forzo el timeout en vez de cerrar limpio`,
    );
    assert.match(stdout, /Received SIGTERM, shutting down gracefully/);
    assert.match(stdout, /Shutdown complete/);
  },
);

function waitForListening(
  getStdout: () => string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (getStdout().includes("API listening on")) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(
          new Error(
            `El servidor no arranco a tiempo. stdout hasta ahora: ${getStdout()}`,
          ),
        );
      }
    }, 100);
  });
}

function waitForExit(
  child: ReturnType<typeof spawn>,
  timeoutMs: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(`El proceso no salio dentro de ${timeoutMs}ms tras SIGTERM`),
      );
    }, timeoutMs);

    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}
