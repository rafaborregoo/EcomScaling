import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const file = 'Meta Ads-Instagram/implementacion/CANDIDATO_IMP01_2026-11-01.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const candidate = path.resolve('tmp/imp-closeout-2026-11-01/release-candidate');
for (const entry of manifest.files) {
  const expected = execFileSync('git', ['rev-parse', `${manifest.candidate_tree}:${entry}`], { encoding: 'utf8' }).trim();
  const actual = execFileSync('git', ['hash-object', '--path', entry, entry], { cwd: candidate, encoding: 'utf8' }).trim();
  if (expected !== actual) throw new Error(`Candidate source changed: ${entry}`);
}
for (const [name, count] of [['candidate-a24', 71], ['candidate-ai', 291], ['candidate-controls', 76]]) {
  const bytes = fs.readFileSync(`tmp/imp-closeout-2026-11-01/${name}.log`);
  const log = bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8');
  if (!log.includes(`pass ${count}`) || !log.includes('fail 0')) throw new Error(`Incomplete validation: ${name}`);
}
manifest.verification = 'Patch applied to a separate Git index at base_commit and an isolated worktree; all 15 source blobs match candidate_tree. The isolated candidate passes the same 71 A24, 291 AI and 76 control tests. Workspace dependencies reuse installed third-party packages; internal @e-nora packages resolve to the isolated worktree and were rebuilt there.';
manifest.validation = {
  source_blobs_matched: 15,
  isolated_worktree: 'tmp/imp-closeout-2026-11-01/release-candidate',
  test_runs: [
    { command: 'npm run test:a24-contracts --workspace @e-nora/api', passed: 71, failed: 0 },
    { command: 'npm test --workspace @e-nora/ai', passed: 291, failed: 0 },
    { command: 'Eight targeted API control suites listed in closeout report', passed: 76, failed: 0 },
  ],
  shared_workspace_guards_passed: 19,
  production_deployed: false,
  live_meta_success_verified: false,
  full_product_end_to_end_verified: false,
};
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log('15 candidate blobs matched; 71 + 291 + 76 isolated tests recorded.');
