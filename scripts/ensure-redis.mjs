// Arranca Redis en local si no hay nada escuchando en el puerto, antes de `npm run dev`.
// Solo aplica en desarrollo local (Windows); en CI/produccion no hace nada porque
// o bien REDIS_URL apunta a un Redis remoto o el ejecutable no existe.
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

const REDIS_HOST = "127.0.0.1";
const REDIS_PORT = 6379;
const REDIS_EXE =
  process.env.REDIS_SERVER_EXE ??
  "C:\\Users\\borre\\Redis\\Redis-8.8.0-Windows-x64-msys2-with-Service\\redis-server.exe";

function portOpen() {
  return new Promise((resolve) => {
    const socket = connect({ host: REDIS_HOST, port: REDIS_PORT, timeout: 1000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

if (await portOpen()) {
  console.log(`[redis] ya hay un Redis escuchando en ${REDIS_HOST}:${REDIS_PORT}`);
  process.exit(0);
}

if (!existsSync(REDIS_EXE)) {
  console.warn(
    `[redis] no hay Redis en ${REDIS_HOST}:${REDIS_PORT} y no existe ${REDIS_EXE}; el worker fallara al conectar`
  );
  process.exit(0);
}

const child = spawn(REDIS_EXE, [], {
  cwd: dirname(REDIS_EXE),
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();

for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (await portOpen()) {
    console.log(`[redis] redis-server arrancado en ${REDIS_HOST}:${REDIS_PORT} (pid ${child.pid})`);
    process.exit(0);
  }
}

console.error("[redis] redis-server no llego a abrir el puerto tras 10s");
process.exit(1);
