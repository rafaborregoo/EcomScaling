export type MetaRpcEvidenceStatus = {
  availability: "available" | "no_data_returned" | "unavailable";
  row_count: number | null;
  error_code: string | null;
};

/** Preserve the difference between an empty result and a failed Meta RPC. */
export function metaRpcEvidenceStatus(
  rows: readonly unknown[] | null | undefined,
  error: { code?: string | null } | null | undefined,
): MetaRpcEvidenceStatus {
  if (error) {
    return {
      availability: "unavailable",
      row_count: null,
      error_code:
        typeof error.code === "string" && error.code.length > 0
          ? error.code.slice(0, 40)
          : "META_RPC_ERROR",
    };
  }
  const rowCount = rows?.length ?? 0;
  return {
    availability: rowCount > 0 ? "available" : "no_data_returned",
    row_count: rowCount,
    error_code: null,
  };
}
