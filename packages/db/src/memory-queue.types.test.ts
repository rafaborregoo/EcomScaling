import type { DatabaseWithMemoryQueueClaims } from "./memory-queue.types.js";

type QueueRow =
  DatabaseWithMemoryQueueClaims["public"]["Tables"]["memory_ingestion_queue"]["Row"];

const typedClaim: QueueRow["processing_started_at"] = null;

// Compile-time contract only: the generated type now exposes the migration
// column without pretending that the remote migration was applied here.
void typedClaim;
