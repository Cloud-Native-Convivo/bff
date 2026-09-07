import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioAutenticado, Rol } from '../common/interfaces/usuario-autenticado';
import { ROLES_KEY } from './roles.decorator';

/**
 * Exige que el usuario autenticado tenga al menos uno de los roles
 * declarados con @Roles(...). Sin @Roles, no restringe (guarda global de auth
 * libre + proxy).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: UsuarioAutenticado;
    }>();
    const roles = request.user?.roles ?? [];

    if (required.some((rol) => roles.includes(rol))) {
      return true;
    }

    throw new ForbiddenException('No tiene permisos para esta operación');
  }
}
