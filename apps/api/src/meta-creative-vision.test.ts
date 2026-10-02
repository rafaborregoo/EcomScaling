import assert from "node:assert/strict";
import test from "node:test";
import {
  A23_MAX_VISION_IMAGE_BYTES,
  A23_PRIVATE_IMAGE_BUCKET,
  a23VisualFailureCoverage,
  selectA23VisionAdIds,
  validateA23PrivateImageMetadata,
} from "./meta-creative-vision.js";

test("A23 visual selection is bounded, deterministic, and prioritizes ads with spend", () => {
  assert.deepEqual(selectA23VisionAdIds([
    { ad_id: "00000000-0000-4000-8000-000000000002", spend: 30 },
    { ad_id: "00000000-0000-4000-8000-000000000001", spend: 90 },
    { ad_id: "00000000-0000-4000-8000-000000000003", spend: 0 },
    { ad_id: "not-a-uuid", spend: 500 },
  ]), ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]);
});

test("A23 visual bytes must be a small image in this organization's private Meta bank", () => {
  const organizationId = "org-a";
  const valid = {
    organizationId,
    bucket: A23_PRIVATE_IMAGE_BUCKET,
    path: "org-a/marketing-visual-bank/asset.png",
    contentType: "image/png",
    byteSize: 1024,
  };
  assert.equal(validateA23PrivateImageMetadata(valid), true);
  assert.equal(validateA23PrivateImageMetadata({ ...valid, bucket: "public-images" }), false);
  assert.equal(validateA23PrivateImageMetadata({ ...valid, path: "org-b/marketing-visual-bank/asset.png" }), false);
  assert.equal(validateA23PrivateImageMetadata({ ...valid, path: "org-a/marketing-visual-bank/../asset.png" }), false);
  assert.equal(validateA23PrivateImageMetadata({ ...valid, contentType: "text/html" }), false);
  assert.equal(validateA23PrivateImageMetadata({ ...valid, byteSize: A23_MAX_VISION_IMAGE_BYTES + 1 }), false);
});

test("A23 visual lookup failures stay distinct from a successful empty private bank", () => {
  assert.deepEqual(a23VisualFailureCoverage("creative_asset_metadata", 2), {
    status: "visual_evidence_unavailable",
    ads_considered: 2,
    images_attached: 0,
    failure_stage: "creative_asset_metadata",
    note: "No se pudo verificar la evidencia visual; esto no significa que el anuncio carezca de activos importados.",
  });
});
