import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

/**
 * Inyecta el usuario autenticado (definido por JwtStrategy) en un handler.
 * Uso: `@UsuarioActual() usuario: UsuarioAutenticado`
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>();
    return request.user;
  },
);
