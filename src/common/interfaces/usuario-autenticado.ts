export type Rol = 'administrador' | 'conserje' | 'comite';

/**
 * Identidad del usuario autenticado, normalizada a partir del JWT
 * validado de Microsoft Entra ID.
 */
export interface UsuarioAutenticado {
  oid: string;
  name?: string;
  preferredUsername?: string;
  correo?: string;
  claims: Record<string, unknown>;
  roles: Rol[];
}
