import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

const dir = resolve(process.cwd(), ".e-nora-test-lab/ai-models");
await mkdir(dir, { recursive: true });
const cwd = resolve(tmpdir(), "e-nora-ai-cli-lab");
await mkdir(cwd, { recursive: true });
const models = [
  ["anthropic", "claude-haiku-5-5"], ["anthropic", "claude-sonnet-5-5"], ["anthropic", "claude-opus-5-5"],
  ["openai", "gpt-6-luna"], ["openai", "gpt-6.1-sol"], ["openai", "gpt-6-astra"],
];
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(ANTHROPIC_|OPENAI_|CODEX_API_KEY|CLAUDE_CODE_OAUTH_TOKEN)/.test(key)) delete env[key];
const output = [];
for (const [provider, model] of models) {
  const cli = provider === "anthropic" ? resolve(homedir(), ".local/bin/claude.exe") : "codex";
  const prompt = 'Prueba de acceso sin herramientas. Responde únicamente con el JSON {"ok":true}. No consultes archivos ni ejecutes comandos.';
  const args = provider === "anthropic"
    ? ["-p", "--model", model, "--output-format", "json", "--tools", "", "--safe-mode", "--strict-mcp-config", "--no-session-persistence"]
    : ["exec", "--ignore-user-config", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--model", model, "--json", "-"];
  const started = Date.now();
  const result = await new Promise((done) => {
    const child = spawn(cli, args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill(); }, 90000);
    child.stdout.on("data", (s) => { stdout += s; });
    child.stderr.on("data", (s) => { stderr += s; });
    child.once("error", (e) => { clearTimeout(timer); done({ exit_code: -1, stdout, stderr: e.message }); });
    child.once("close", (exit_code) => { clearTimeout(timer); done({ exit_code, stdout, stderr }); });
    child.stdin.end(prompt);
  });
  output.push({ provider, model, at: new Date().toISOString(), duration_ms: Date.now() - started, ...result });
  await writeFile(resolve(dir, "access-probes.json"), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ model, exit_code: result.exit_code, duration_ms: Date.now() - started, preview: (result.stdout || result.stderr).slice(-900) }));
}
