import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicAddress,
  sniffStaticImageMime,
  validateMetaStaticImageUrl,
} from "./meta-static-image.js";

test("Meta static-image URLs accept only HTTPS Meta-owned CDN hosts", () => {
  assert.equal(
    validateMetaStaticImageUrl("https://scontent-mad1-1.xx.fbcdn.net/image.jpg?token=secret").hostname,
    "scontent-mad1-1.xx.fbcdn.net",
  );
  for (const value of [
    "http://scontent.xx.fbcdn.net/image.jpg",
    "https://facebook.com.evil.example/image.jpg",
    "https://user:pass@scontent.xx.fbcdn.net/image.jpg",
    "https://127.0.0.1/image.jpg",
    "https://scontent.xx.fbcdn.net:8443/image.jpg",
  ]) {
    assert.throws(() => validateMetaStaticImageUrl(value));
  }
});

test("pinned Meta CDN lookups reject private, loopback and link-local IPs", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "172.20.1.5", "192.168.1.2", "169.254.10.2", "::1", "fc00::1", "fe80::2", "::ffff:192.168.1.2"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("Meta static-image MIME is determined from bytes, not filename", () => {
  assert.equal(
    sniffStaticImageMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(sniffStaticImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(
    sniffStaticImageMime(Buffer.from("RIFF0000WEBP", "ascii")),
    "image/webp",
  );
  assert.equal(sniffStaticImageMime(Buffer.from("GIF89a")), null);
});
