"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  registerLocalInsights: (sourceId: string, spots: InsightSpot[]) => void;
};

const InsightsContext = createContext<InsightsContextValue>({
  spots: [],
  loading: false,
  registerLocalInsights: () => undefined,
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
  const [localInsights, setLocalInsights] = useState<Record<string, InsightSpot[]>>({});

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

  const registerLocalInsights = useCallback((sourceId: string, nextSpots: InsightSpot[]) => {
    setLocalInsights((current) => {
      if (nextSpots.length === 0) {
        if (!(sourceId in current)) return current;
        const next = { ...current };
        delete next[sourceId];
        return next;
      }
      return { ...current, [sourceId]: nextSpots };
    });
  }, []);

  const spots = useMemo(() => {
    const baseSpots = mergeInsightSpots(scope, assessments);
    const localSpots = Object.values(localInsights).flat();
    return [
      ...baseSpots,
      ...localSpots.filter((spot) => !baseSpots.some((item) => item.href === spot.href)),
    ];
  }, [assessments, localInsights, scope.connectionId, scope.isConsultant, scope.organizationId]);

  return (
    <InsightsContext.Provider value={{ spots, loading, registerLocalInsights }}>
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
