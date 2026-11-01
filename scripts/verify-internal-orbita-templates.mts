import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { internalReferenceEmailTemplates } from "./fixtures/internal-reference-email-templates.js";
const endpoint = "http://127.0.0.1:9239";
const target = await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json()) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise<void>((done, reject) => { socket.addEventListener("open", () => done(), { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const pending = new Map<number, { done: (result: any) => void; reject: (error: Error) => void }>();
socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); const callback = pending.get(message.id); if (!callback) return; pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.done(message.result); });
const call = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((done, reject) => {
  const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
  pending.set(key, { done: (result) => { clearTimeout(timer); done(result); }, reject: (error) => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: key, method, params }));
});
const rows = [];
await call("Page.enable");
try {
  const from = Number(process.argv.find((arg) => arg.startsWith("--from="))?.slice(7) ?? 1);
  assert.ok(Number.isInteger(from) && from >= 1 && from <= internalReferenceEmailTemplates.length);
  const templateKeys = internalReferenceEmailTemplates.slice(from - 1).map((preset) => preset.template.key).filter((key) => !process.argv.includes("--new-only") || !["orbita-search-story", "orbita-everyday-checklist", "orbita-editorial-thread"].includes(key));
  for (const key of templateKeys) for (const width of [600, 360]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1200, deviceScaleFactor: 1, mobile: width === 360 });
    const loaded = new Promise<void>((done) => { const listener = (event: MessageEvent) => { if (JSON.parse(String(event.data)).method === "Page.loadEventFired") { socket.removeEventListener("message", listener); done(); } }; socket.addEventListener("message", listener); });
    await call("Page.navigate", { url: pathToFileURL(resolve(`.e-nora-test-lab/marketing-internal-templates/${key}.html`)).href });
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error("page load timeout")), 15000))]);
    await call("Runtime.evaluate", { awaitPromise: true, expression: `Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,10000)})))` });
    const evaluated = await call("Runtime.evaluate", { returnByValue: true, expression: `JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,images:[...document.images].map(i=>({complete:i.complete,loaded:i.naturalWidth>0})),headings:document.querySelectorAll('h1').length})` });
    const metrics = JSON.parse(evaluated.result.value); assert.equal(metrics.width, width); assert.ok(metrics.scroll <= width + 1, `${key} overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.images.length > 0 && metrics.images.every((image: any) => image.complete && image.loaded)); assert.equal(metrics.headings, 1);
    const capture = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.height, scale: 1 } });
    const path = width === 600 ? `apps/web/public/marketing-demo/${key}.png` : `.e-nora-test-lab/marketing-internal-templates/${key}-mobile.png`;
    await writeFile(path, Buffer.from(capture.data, "base64"));
    rows.push({ key, width, height: metrics.height, no_horizontal_overflow: true, images_loaded: true });
  }
  await writeFile(`.e-nora-test-lab/marketing-internal-templates/visual-check${from > 1 ? `-from-${from}` : process.argv.includes("--new-only") ? "-extension" : ""}.json`, JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows, null, 2));
} finally { try { await call("Browser.close"); } finally { socket.close(); } }
