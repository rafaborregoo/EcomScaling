import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarFileExtension, avatarFileProblem } from "./avatar-file";

test("la foto de perfil se valida igual que el bucket avatars", () => {
  assert.equal(avatarFileProblem({ type: "image/jpeg", size: 500_000 }), null);
  assert.match(avatarFileProblem({ type: "image/heic", size: 500_000 }) ?? "", /HEIC/);
  assert.match(avatarFileProblem({ type: "image/png", size: 3 * 1024 * 1024 }) ?? "", /3\.0 MB/);
  assert.equal(avatarFileExtension("image/jpeg"), "jpg");
});
