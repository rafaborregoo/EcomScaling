"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/bootstrap";
import {
  mergeInsightSpots,
  insightSpotForAnchor,
  type InsightScope,
  type InsightSpot,
  type PlaybookInsightAssessment,
} from "@/lib/insights-registry";

type InsightsContextValue = {
  spots: InsightSpot[];
  loading: boolean;
};

const InsightsContext = createContext<InsightsContextValue>({
  spots: [],
  loading: false,
});

export function InsightsProvider({
  scope,
  children,
}: {
  scope: InsightScope;
  children: ReactNode;
}) {
  const [assessments, setAssessments] = useState<PlaybookInsightAssessment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scope.isConsultant || !scope.organizationId) {
      setAssessments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const organizationId = encodeURIComponent(scope.organizationId);
    apiFetch(`/v1/consultant/ai-playbook-insights?organizationId=${organizationId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los insights de IA.");
        return response.json() as Promise<{ assessments: PlaybookInsightAssessment[] }>;
      })
      .then((payload) => {
        if (!cancelled) setAssessments(payload.assessments ?? []);
      })
      .catch(() => {
        if (!cancelled) setAssessments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope.isConsultant, scope.organizationId]);

  const spots = useMemo(
    () => mergeInsightSpots(scope, assessments),
    [assessments, scope.connectionId, scope.isConsultant, scope.organizationId],
  );

  return (
    <InsightsContext.Provider value={{ spots, loading }}>
      {children}
    </InsightsContext.Provider>
  );
}

export function useInsights() {
  return useContext(InsightsContext);
}

export function useInsightForAnchor(anchorId: string | undefined) {
  const { spots } = useInsights();
  return anchorId ? insightSpotForAnchor(spots, anchorId) : undefined;
}
