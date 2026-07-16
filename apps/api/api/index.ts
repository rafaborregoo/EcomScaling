import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/server.js";

const appPromise = buildApp();

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", request, response);
}
