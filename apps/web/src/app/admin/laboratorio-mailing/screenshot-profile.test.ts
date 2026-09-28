import test from "node:test";
import assert from "node:assert/strict";
import { profileScreenshotPixels } from "./screenshot-profile.js";

test("estima los colores dominantes por proporción de píxeles y bandas verticales", () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255, 0, 0, 0, 255,
    255, 255, 255, 255, 255, 255, 255, 255,
  ]);
  const profile = profileScreenshotPixels(2, 2, pixels);
  assert.equal(profile.method, "sampled_pixels_quantized");
  assert.equal(profile.colors[0]?.hex, "#000000");
  assert.equal(profile.colors[0]?.share_percent, 50);
  assert.equal(profile.vertical_bands.length, 8);
  assert.equal(profile.vertical_bands[0]?.dominant_hex, "#000000");
  assert.equal(profile.vertical_bands[7]?.dominant_hex, "#ffffff");
});

test("compone transparencia sobre blanco y acota el formato de entrada", () => {
  const profile = profileScreenshotPixels(1, 1, new Uint8ClampedArray([0, 0, 0, 0]));
  assert.equal(profile.colors[0]?.hex, "#ffffff");
  assert.throws(() => profileScreenshotPixels(0, 1, new Uint8ClampedArray()), /dimensions/);
  assert.throws(() => profileScreenshotPixels(1, 1, new Uint8ClampedArray(3)), /buffer/);
  assert.throws(() => profileScreenshotPixels(12_001, 1, new Uint8ClampedArray()), /dimensions/);
});
