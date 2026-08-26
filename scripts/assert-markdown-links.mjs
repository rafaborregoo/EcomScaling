import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const broken = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", ".next"].includes(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath);
      continue;
    }
    if (!entry.name.endsWith(".md")) continue;

    const source = await readFile(filePath, "utf8");
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].trim();
      if (/^(?:https?:\/\/|mailto:|#|app:\/\/)/i.test(target)) continue;

      const fileTarget = target.split("#", 1)[0].split("?", 1)[0];
      if (!fileTarget) continue;

      const resolved = path.resolve(path.dirname(filePath), fileTarget);
      try {
        await readFile(resolved);
      } catch {
        broken.push(`${path.relative(root, filePath)} -> ${target}`);
      }
    }
  }
}

await walk(root);

if (broken.length > 0) {
  console.error("MARKDOWN_LOCAL_LINKS_BROKEN");
  for (const item of broken) console.error(`- ${item}`);
  process.exit(1);
}

console.log("MARKDOWN_LOCAL_LINKS_OK");
