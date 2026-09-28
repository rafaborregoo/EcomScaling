export type CallTaskOwner = "cliente" | "consultor";

export function resolveCallTaskOwnership(
  owner: unknown,
  consultantUserId: string,
) {
  const normalizedOwner: CallTaskOwner =
    owner === "consultor" ? "consultor" : "cliente";

  return {
    owner: normalizedOwner,
    isVisibleToClient: normalizedOwner === "cliente",
    assignedTo: normalizedOwner === "consultor" ? consultantUserId : null,
  };
}
