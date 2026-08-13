import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/server.js";

const appPromise = buildApp();

// Los tipos de `@vercel/node` (VercelRequest/VercelResponse) extienden
// IncomingMessage/ServerResponse y no aportan nada aqui: el handler solo
// reenvia el par request/response al servidor de Fastify. Usar los tipos de
// node:http elimina una dependencia de produccion que existia solo para dos
// `import type` y que arrastraba toda la cadena de build de Vercel
// (undici, path-to-regexp, js-yaml, minimatch...) al arbol de la API.
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", request, response);
}
