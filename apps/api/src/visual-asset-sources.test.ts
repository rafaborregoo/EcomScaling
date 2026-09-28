import assert from "node:assert/strict";
import test from "node:test";
import {
  attachVisualAssetSources,
  buildVisualAnalysisFingerprint,
  isOwnedVisualStoragePath,
} from "./visual-asset-sources.js";

test("attachVisualAssetSources returns only source badges scoped by image id", () => {
  const images = [{ id: "image-a", analysis: { description: "fixture" } }, { id: "image-b" }];
  const rows = [
    {
      image_id: "image-a",
      channel: "instagram",
      source_kind: "manual_upload",
      origin_key: "must-not-leak",
      origin_host: "must-not-leak.example",
    },
    {
      image_id: "image-a",
      channel: "meta",
      source_kind: "meta_creative_asset",
      origin_key: "must-not-leak-either",
    },
  ];

  const result = attachVisualAssetSources(images, rows);
  assert.deepEqual(result[0], {
    id: "image-a",
    analysis: { description: "fixture" },
    sources: [
      { channel: "instagram", source_kind: "manual_upload" },
      { channel: "meta", source_kind: "meta_creative_asset" },
    ],
  });
  assert.deepEqual(result[1], { id: "image-b", sources: [] });
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
});

test("private storage paths must match the exact organization prefix", () => {
  assert.equal(isOwnedVisualStoragePath("org-a", "org-a/marketing-visual-bank/a.png"), true);
  assert.equal(isOwnedVisualStoragePath("org-a", "org-ab/marketing-visual-bank/a.png"), false);
  assert.equal(isOwnedVisualStoragePath("org-a", "other/marketing-visual-bank/a.png"), false);
});

test("analysis fingerprint changes with model or prompt version but not asset origin", () => {
  const input = {
    agentVersion: "v2",
    model: "vision-model",
    promptCode: "a15-system",
    promptVersion: "v2",
  };
  const original = buildVisualAnalysisFingerprint(input);
  assert.equal(buildVisualAnalysisFingerprint(input), original);
  assert.notEqual(buildVisualAnalysisFingerprint({ ...input, model: "other-model" }), original);
  assert.notEqual(buildVisualAnalysisFingerprint({ ...input, promptVersion: "v3" }), original);
});
