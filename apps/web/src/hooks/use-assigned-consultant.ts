"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";

/**
 * ¿Este cliente tiene consultor, o se apoya en los agentes?
 *
 * Es la pregunta que cambia la forma del portal del cliente, así que la
 * responden varias pantallas. `resolved` importa tanto como el valor: hasta
 * saberlo no se puede pintar una versión ni la otra sin que la página cambie
 * de forma delante del usuario.
 */

export type AssignedConsultant = {
  user_id: string;
  full_name: string | null;
  is_primary: boolean;
} | null;

export function useAssignedConsultant(organizationId: string | null) {
  const [consultant, setConsultant] = useState<AssignedConsultant>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!organizationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolved(true);
      return;
    }

    let cancelled = false;
    void apiFetch(`/v1/organizations/${organizationId}/my-consultant`)
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          consultant: AssignedConsultant;
        };
        setConsultant(payload.consultant);
      })
      .catch(() => {
        // Sin respuesta se asume acompañado: es el lado que no invade. Enseñar
        // de más a un cliente que sí tiene consultor es peor que enseñar de
        // menos por un fallo de red.
      })
      .finally(() => {
        if (!cancelled) setResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return { consultant, resolved, isAutonomous: resolved && consultant === null };
}
