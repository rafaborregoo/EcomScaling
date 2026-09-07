"use client";

import { Badge, Card } from "@/components/ui";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";

/**
 * Quién lleva esta cuenta, y qué enciende eso.
 *
 * Chats es la conversación con el consultor humano, así que sin consultor
 * asignado el módulo está apagado. No hay interruptor: se enciende solo al
 * asignar uno, y así no puede quedarse apagado con consultor puesto. Lo que sí
 * hacía falta es que en algún sitio ponga por qué está apagado -- un módulo
 * gris sin explicación se lee como una avería.
 */
export function ConsultantStatusSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const { consultant, resolved } = useAssignedConsultant(organizationId);

  // Sin resolver no se pinta: decir "no tienes consultor" y corregirlo medio
  // segundo después es peor que tardar medio segundo.
  if (!resolved) return null;

  return (
    <Card
      title="Tu consultor"
      actions={
        <Badge tone={consultant ? "success" : "neutral"}>
          {consultant ? "Asignado" : "Sin asignar"}
        </Badge>
      }
    >
      {consultant ? (
        <p className="text-sm">
          <strong className="font-semibold">
            {consultant.full_name ?? "Tu consultor"}
          </strong>{" "}
          lleva esta cuenta. El módulo <strong>Chats</strong> es vuestra
          conversación, y está activo.
        </p>
      ) : (
        <p className="text-sm">
          Todavía no tienes un consultor asignado, así que el módulo{" "}
          <strong>Chats</strong> está desactivado: no habría nadie al otro lado.
          Se activa solo en cuanto te asignen uno. Mientras tanto, el Consultor
          IA responde sobre tu tienda desde el botón de abajo a la derecha.
        </p>
      )}
    </Card>
  );
}
