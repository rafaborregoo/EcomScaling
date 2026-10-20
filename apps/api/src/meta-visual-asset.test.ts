import assert from "node:assert/strict";
import test from "node:test";
import { resolveMetaVisualRepresentation } from "./meta-visual-asset.js";

test("Meta static images use image media with thumbnail fallback", () => {
  assert.deepEqual(
    resolveMetaVisualRepresentation({
      assetType: "image",
      mediaUrl: "https://cdn.test/image.jpg",
      thumbnailUrl: "https://cdn.test/thumb.jpg",
    }),
    { kind: "static_image", imageUrl: "https://cdn.test/image.jpg" },
  );
  assert.deepEqual(
    resolveMetaVisualRepresentation({
      assetType: "image",
      mediaUrl: null,
      thumbnailUrl: "https://cdn.test/thumb.jpg",
    }),
    { kind: "static_thumbnail", imageUrl: "https://cdn.test/thumb.jpg" },
  );
});

test("Meta videos expose only their still thumbnail, never the video URL", () => {
  assert.deepEqual(
    resolveMetaVisualRepresentation({
      assetType: "video",
      mediaUrl: "https://cdn.test/video.mp4",
      thumbnailUrl: "https://cdn.test/frame.jpg",
    }),
    { kind: "video_thumbnail", imageUrl: "https://cdn.test/frame.jpg" },
  );
  assert.equal(
    resolveMetaVisualRepresentation({
      assetType: "video",
      mediaUrl: "https://cdn.test/video.mp4",
      thumbnailUrl: null,
    }),
    null,
  );
});

test("unsupported Meta asset types are not exposed to the image pipeline", () => {
  assert.equal(
    resolveMetaVisualRepresentation({
      assetType: "audio",
      mediaUrl: "https://cdn.test/audio.mp3",
      thumbnailUrl: null,
    }),
    null,
  );
});
