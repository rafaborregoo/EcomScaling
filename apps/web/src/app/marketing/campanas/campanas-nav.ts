"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveConnection } from "@/components/active-connection";
import { useActiveOrganization } from "@/components/active-organization";

/**
 * Cómo se baja y se sube por Campañas: cartera -> cliente -> tienda -> campaña.
 *
 * Los dos primeros saltos son los MISMOS selectores del shell (cliente y
 * tienda), así que la cabecera y la pantalla nunca se contradicen. Saltar a la
 * tienda de OTRO cliente y abrir una campaña van por la URL (`organizationId`,
 * `connectionId`, `campaign`), que el shell ya sabe leer: un aviso de la
 * campana puede llevar directo a una campaña.
 */
export type CampaignsNav = {
  portfolio: () => void;
  client: (organizationId: string) => void;
  clientOfStore: () => void;
  store: (organizationId: string, connectionId: string | null) => void;
  campaign: (organizationId: string, itemId: string) => void;
  closeCampaign: () => void;
  openQuickActions: () => void;
  closeQuickActions: () => void;
};

export function useCampaignsNav(): CampaignsNav {
  const router = useRouter();
  const query = useSearchParams().toString();
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const { setConnectionId } = useActiveConnection();

  // Estable entre renders: la pantalla lo recibe por props. Los setters del
  // shell cambian de identidad en cada render, y lo que decide adónde ir es el
  // cliente activo y la URL.
  return useMemo<CampaignsNav>(() => {
    const urlWith = (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(query);
      params.set("section", "campanas");
      mutate(params);
      return `/marketing?${params.toString()}`;
    };
    return {
      portfolio: () => setOrganizationId(""),
      client: (id) => setOrganizationId(id),
      clientOfStore: () => setConnectionId(""),
      store: (id, connection) => {
        if (id === organizationId) {
          if (connection) setConnectionId(connection);
          return;
        }
        router.push(
          urlWith((params) => {
            params.set("organizationId", id);
            if (connection) params.set("connectionId", connection);
            else params.delete("connectionId");
            params.delete("campaign");
          }),
        );
      },
      campaign: (id, itemId) =>
        router.push(
          urlWith((params) => {
            params.set("organizationId", id);
            params.set("campaign", itemId);
          }),
        ),
      closeCampaign: () =>
        router.push(
          urlWith((params) => {
            params.delete("campaign");
          }),
        ),
      openQuickActions: () =>
        router.push(
          urlWith((params) => {
            params.delete("campaign");
            params.set("acciones", "1");
          }),
        ),
      closeQuickActions: () =>
        router.push(
          urlWith((params) => {
            params.delete("acciones");
          }),
        ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, organizationId, router]);
}
