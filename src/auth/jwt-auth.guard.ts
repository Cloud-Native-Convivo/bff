import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { PUBLIC_KEY } from './public.decorator';

function isPublicEspacioGet(method: string, url: string): boolean {
  if (method !== 'GET') return false;
  const path = url.split('?')[0].replace(/\/+$/, '');
  return (
    path === '/api/v1/espacios-comunes' ||
    path === '/api/v1/espacios-comunes/espacios' ||
    path.startsWith('/api/v1/espacios-comunes/espacios/') ||
    path === '/api/espacios' ||
    path.startsWith('/api/espacios/')
  );
}

/**
 * Guard global de autenticación dual (Entra ID + Cognito).
 * Valida el Access/ID Token JWT mediante las estrategias Passport
 * 'jwt-entra' y 'jwt-cognito'. Las rutas marcadas con @IsPublic() se omiten.
 * Permite consulta anónima pública del catálogo de espacios solo si no se
 * envía cabecera de autorización.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt-entra', 'jwt-cognito']) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const hasAuth = Boolean(req.headers?.authorization);
    const url = req.originalUrl ?? req.url ?? '';

    if (!hasAuth && isPublicEspacioGet(req.method, url)) {
      return true;
    }

    return super.canActivate(context);
  }
}

