import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConsultantProposalGuidance,
  parseConsultantProposalGuidance,
} from "./consultant-proposal-guidance.js";

test("proposal guidance routes to an assigned consultant and bounds their display name", () => {
  assert.deepEqual(
    buildConsultantProposalGuidance({
      has_consultant: true,
      consultant_name: "  Ana   Pérez ",
    }),
    {
      reviewer: "assigned_consultant",
      reviewer_name: "Ana Pérez",
      destination: "tasks",
    },
  );
});
test("proposal guidance does not infer a reviewer when no consultant is assigned or lookup failed", () => {
  assert.deepEqual(
    buildConsultantProposalGuidance({
      has_consultant: false,
      consultant_name: "ignored",
    }),
    {
      reviewer: "client",
      reviewer_name: null,
      destination: "tasks",
    },
  );
  assert.equal(
    buildConsultantProposalGuidance({
      has_consultant: null,
      consultant_name: null,
    }).reviewer,
    "unverified",
  );
});
test("proposal guidance rejects malformed persisted metadata and normalizes valid metadata", () => {
  assert.equal(
    parseConsultantProposalGuidance({
      reviewer: "platform_admin",
      destination: "tasks",
    }),
    null,
  );
  assert.deepEqual(
    parseConsultantProposalGuidance({
      reviewer: "client",
      reviewer_name: null,
      destination: "tasks",
    }),
    {
      reviewer: "client",
      reviewer_name: null,
      destination: "tasks",
    },
  );
});
