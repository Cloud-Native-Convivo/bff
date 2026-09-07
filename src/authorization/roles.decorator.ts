import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../common/interfaces/usuario-autenticado';

export const ROLES_KEY = 'roles';

/**
 * Declara los roles permitidos para un handler o controlador.
 * Ejemplo: `@Roles('administrador')`
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
