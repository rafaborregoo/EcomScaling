import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const git = (args, env = process.env) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, env });
const base = git(['rev-parse', 'HEAD']).trim();
const output = path.resolve('Meta Ads-Instagram/implementacion');
const patchFile = path.join(output, 'CANDIDATO_IMP01_2026-11-01.patch');
const tracked = [
  'apps/api/src/a24-meta-scope.test.ts',
  'apps/api/src/ai-diagnostic-activity-gate.test.ts',
  'apps/api/src/integrations.ts',
  'apps/api/src/integrations-configuration.test.ts',
  'apps/api/src/meta-measurement-evidence.ts',
  'apps/api/src/meta-measurement-evidence.test.ts',
  'apps/api/src/meta-measurement-verdict.ts',
  'apps/api/src/meta-measurement-verdict.test.ts',
  'packages/ai/src/tool-layer.ts',
  'packages/ai/src/agent-canonical-prompts.test.ts',
  'packages/ai/src/agent-mock-turn.test.ts',
];
let patch = git(['diff', '--no-ext-diff', '--no-color', '--', ...tracked]);
const runtimeDiff = git(['diff', '--no-ext-diff', '--no-color', '--unified=3', '--', 'apps/api/src/ai-runtime.ts']);
const split = runtimeDiff.split(/(?=^@@ )/m);
const runtimeHunks = split.slice(1).filter((hunk) =>
  !/marketingCreative|META_REVIEW_METHOD_GUIDANCE|creativeRequest/.test(hunk) &&
  /loadMetaMeasurementVerdict|META_MEASUREMENT_CACHE_TTL_MS|metaSpecialistWindow\(organizationId, storeId\)|complete: optimizationEventHealth.complete|review_issues:|eventMapping:.*complete|source_coverage:/.test(hunk));
if (runtimeHunks.length < 9 || runtimeHunks.length > 16) throw new Error(`Review runtime hunk selection: ${runtimeHunks.length}`);
patch += split[0] + runtimeHunks.join('');

// Preserve the concurrent unit-suite edit by taking only this release's A24 script change.
const packageFile = 'apps/api/package.json';
const packageBase = git(['show', `${base}:${packageFile}`]).replace(/\r\n/g, '\n');
const packageLines = packageBase.split('\n');
const lineIndex = packageLines.findIndex((line) => line.includes('"test:a24-contracts":'));
if (lineIndex < 0) throw new Error('A24 suite missing');
const before = packageLines[lineIndex];
const after = before.replace('src/meta-measurement-evidence.test.ts', 'src/meta-measurement-evidence.test.ts src/meta-measurement-cache.test.ts');
if (after === before) throw new Error('Suite insertion failed');
const contextBefore = packageLines.slice(lineIndex - 3, lineIndex).map((line) => ` ${line}\n`).join('');
const contextAfter = packageLines.slice(lineIndex + 1, lineIndex + 4).map((line) => ` ${line}\n`).join('');
patch += `diff --git a/${packageFile} b/${packageFile}\n--- a/${packageFile}\n+++ b/${packageFile}\n@@ -${lineIndex - 2},7 +${lineIndex - 2},7 @@\n${contextBefore}-${before}\n+${after}\n${contextAfter}`;

const added = ['apps/api/src/meta-measurement-cache.ts', 'apps/api/src/meta-measurement-cache.test.ts'];
for (const file of added) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  patch += `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map((line) => `+${line}\n`).join('');
}
fs.writeFileSync(patchFile, patch.replace(/\r\n/g, '\n'));

// A separate temporary Git index checks the candidate against HEAD without staging the user's work.
const env = { ...process.env, GIT_INDEX_FILE: path.resolve('tmp/imp-closeout-2026-11-01/candidate.index') };
git(['read-tree', base], env);
git(['apply', '--cached', '--check', patchFile], env);
git(['apply', '--cached', patchFile], env);
const tree = git(['write-tree'], env).trim();
const manifest = {
  created_on: '2026-11-01',
  base_commit: base,
  candidate_tree: tree,
  patch_file: path.basename(patchFile),
  patch_sha256: crypto.createHash('sha256').update(fs.readFileSync(patchFile)).digest('hex'),
  files: [...tracked, 'apps/api/src/ai-runtime.ts', packageFile, ...added].sort(),
  selected_runtime_hunks: runtimeHunks.length,
  verification: 'Patch applied to a separate index at base_commit; working index and branch unchanged. Tests run on the shared workspace, not on an isolated build of candidate_tree.',
  excludes: ['Concurrent creative/marketing runtime changes', 'Concurrent test:unit script changes', 'Remote historical SQL archives', 'Production activation'],
};
fs.writeFileSync(path.join(output, 'CANDIDATO_IMP01_2026-11-01.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ base, tree, files: manifest.files.length, runtimeHunks: runtimeHunks.length, patch_sha256: manifest.patch_sha256 }));
