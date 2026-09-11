export type Rol = 'residente' | 'propietario' | 'admin' | 'administrador' | 'conserje' | 'comite';

/**
 * Identidad del usuario autenticado, normalizada a partir del JWT
 * validado de Microsoft Entra ID o AWS Cognito.
 */
export interface UsuarioAutenticado {
  sub: string;
  oid?: string;
  name?: string;
  preferredUsername?: string;
  correo?: string;
  claims: Record<string, unknown>;
  roles: Rol[];
}

