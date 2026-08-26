export type CurrentTranscript = {
  id: string;
  version: number;
};

export type PublishedSummaryReference = {
  status: string;
  transcript_id: string | null;
};

export function isSummaryCurrentForTranscript(
  summary: PublishedSummaryReference,
  transcript: CurrentTranscript | null,
) {
  if (summary.status !== "published") return false;
  if (!transcript) return true;
  return (
    summary.transcript_id === transcript.id ||
    (summary.transcript_id === null && transcript.version === 1)
  );
}

