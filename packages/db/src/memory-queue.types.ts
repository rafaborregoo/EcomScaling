import type { Database } from "./database.types.js";

type GeneratedMemoryQueueTable =
  Database["public"]["Tables"]["memory_ingestion_queue"];

/**
 * Tipos de transición para AI-07 mientras Supabase no permite regenerar el
 * archivo generado. No reemplaza database.types.ts: solo añade la columna de
 * la migración 20260824130000_ai_07_memory_queue_claims.sql.
 */
export type MemoryIngestionQueueTable = Omit<
  GeneratedMemoryQueueTable,
  "Row" | "Insert" | "Update"
> & {
  Row: GeneratedMemoryQueueTable["Row"] & {
    processing_started_at: string | null;
  };
  Insert: GeneratedMemoryQueueTable["Insert"] & {
    processing_started_at?: string | null;
  };
  Update: GeneratedMemoryQueueTable["Update"] & {
    processing_started_at?: string | null;
  };
};

export type DatabaseWithMemoryQueueClaims = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "memory_ingestion_queue"> & {
      memory_ingestion_queue: MemoryIngestionQueueTable;
    };
  };
};
