// Development-only HTTPS ingress. Only signed integration webhook routes are exposed.
import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = resolve(root, ".env.local");
const port = Number(process.env.WEBHOOK_INGRESS_PORT ?? 4011);
const apiPort = Number(process.env.PORT ?? 4000);
const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") { response.writeHead(200).end("ok"); return; }
  if (request.method !== "POST" || !/^\/v1\/(shopify\/webhooks|klaviyo\/webhooks\/[0-9a-f-]{36})$/.test(request.url ?? "")) {
    response.writeHead(404).end(); return;
  }
  if (Number(request.headers["content-length"] ?? 0) > 2 * 1024 * 1024) { response.writeHead(413).end(); return; }
  const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => /^(content-type|x-shopify-|klaviyo-)/.test(name)));
  const upstream = http.request({ hostname: "127.0.0.1", port: apiPort, method: "POST", path: request.url, headers, timeout: 4500 }, (result) => {
    response.writeHead(result.statusCode ?? 502, { "content-type": "application/json" });
    result.pipe(response);
  });
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) { upstream.destroy(); if (!response.headersSent) response.writeHead(413).end(); }
  });
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(503).end('{"error":"webhook_upstream_unavailable"}'); else response.destroy(); });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
});
server.listen(port, "127.0.0.1", () => console.log(`[webhooks] restricted ingress listening on ${port}`));
const windowsBinary = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const binary = process.env.CLOUDFLARED_EXE ?? (existsSync(windowsBinary) ? windowsBinary : "cloudflared");
const tunnel = spawn(binary, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`], { windowsHide: true });
let saved = false;
let output = "";
const receive = (chunk) => {
  output = (output + chunk.toString()).slice(-16000);
  const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!saved && match) {
    saved = true;
    const line = `INTEGRATION_WEBHOOK_BASE_URL=${match[0]}`;
    const existing = readFileSync(envFile, "utf8");
    writeFileSync(envFile, /^INTEGRATION_WEBHOOK_BASE_URL=.*$/m.test(existing)
      ? existing.replace(/^INTEGRATION_WEBHOOK_BASE_URL=.*$/m, line)
      : `${existing.trimEnd()}\n${line}\n`);
    console.log(`[webhooks] ${match[0]} (saved to .env.local; restart API and worker after a URL change)`);
  }
};
tunnel.stdout.on("data", receive);
tunnel.stderr.on("data", receive);
tunnel.on("error", (error) => { console.error(`[webhooks] tunnel failed: ${error.message}`); server.close(); process.exitCode = 1; });
tunnel.on("exit", (code) => { console.log(`[webhooks] tunnel stopped (${code})`); server.close(); process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { tunnel.kill(); server.close(); });
