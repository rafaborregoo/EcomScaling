/**
 * Qué puede hacer cada rol del cliente. Refleja lo que comprueba la API: la
 * guarda de escritura (`apps/api/src/org-access-guard.ts`) para Solo lectura y
 * los chequeos owner/manager de cada servicio. Si cambia uno, cambia esto.
 */

export const MEMBER_ROLES = ["owner", "manager", "member", "readonly"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Propietario",
  manager: "Gestor",
  member: "Colaborador",
  readonly: "Solo lectura",
};

export const ROLE_OPTIONS = MEMBER_ROLES.map((value) => ({ value, label: ROLE_LABEL[value] }));

type Row = { action: string; roles: Record<MemberRole, boolean> };
const roles = (owner: boolean, manager: boolean, member: boolean, readonly: boolean) => ({
  owner,
  manager,
  member,
  readonly,
});

export const ROLE_MATRIX: Array<{ group: string; rows: Row[] }> = [
  {
    group: "Ver",
    rows: [
      { action: "Ver cifras, informes, tareas y conversaciones", roles: roles(true, true, true, true) },
      { action: "Preguntar al copiloto y descargar informes", roles: roles(true, true, true, true) },
    ],
  },
  {
    group: "Trabajar",
    rows: [
      { action: "Crear y comentar tareas, escribir al consultor", roles: roles(true, true, true, false) },
      { action: "Crear campañas y aprobar propuestas de la IA", roles: roles(true, true, false, false) },
    ],
  },
  {
    group: "Configurar",
    rows: [
      { action: "Costes, objetivos y alertas", roles: roles(true, true, false, false) },
      { action: "Conectar y desconectar integraciones", roles: roles(true, true, false, false) },
      { action: "Invitar personas y cambiar roles", roles: roles(true, true, false, false) },
    ],
  },
  {
    group: "Cuenta",
    rows: [
      { action: "Plan, facturas y saldo del copiloto", roles: roles(true, false, false, false) },
      { action: "Qué puede hacer el consultor y exigir 2FA", roles: roles(true, false, false, false) },
      { action: "Dar la propiedad, traspasarla o eliminar la cuenta", roles: roles(true, false, false, false) },
    ],
  },
];
