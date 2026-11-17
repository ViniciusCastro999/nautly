/**
 * Controle de acesso por papel. Dados clínicos (prontuário, exames) só podem
 * ser vistos por quem atende: a recepção gerencia a agenda e o cadastro,
 * mas não acessa informação de saúde.
 */
export const ROLES = ["owner", "admin", "professional", "receptionist"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  professional: "Profissional",
  receptionist: "Recepção",
}

export type Permission =
  | "agenda:manage"
  | "clients:read"
  | "clients:write"
  | "clinical:read"
  | "clinical:write"
  | "settings:manage"
  | "audit:read"
  /** Financeiro: pagamentos e valores a receber. */
  | "finance:manage"

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    "agenda:manage",
    "clients:read",
    "clients:write",
    "clinical:read",
    "clinical:write",
    "settings:manage",
    "audit:read",
    "finance:manage",
  ],
  // Administrador da clínica: gestão, sem acesso a dados clínicos.
  admin: [
    "agenda:manage",
    "clients:read",
    "clients:write",
    "settings:manage",
    "audit:read",
    "finance:manage",
  ],
  professional: ["agenda:manage", "clients:read", "clients:write", "clinical:read", "clinical:write"],
  receptionist: ["agenda:manage", "clients:read", "clients:write", "finance:manage"],
}

export function can(role: Role, permission: Permission) {
  return PERMISSIONS[role].includes(permission)
}

export class ForbiddenError extends Error {
  constructor() {
    super("Você não tem permissão para esta ação.")
  }
}

export function assertCan(role: Role, permission: Permission) {
  if (!can(role, permission)) throw new ForbiddenError()
}
