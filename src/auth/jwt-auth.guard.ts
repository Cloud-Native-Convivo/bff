import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { firstValueFrom, isObservable } from 'rxjs';
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
 * El catálogo de espacios (`isPublicEspacioGet`) es público: si trae token
 * válido, resuelve identidad igual; si no trae token o el token es
 * inválido/expirado, deja pasar como anónimo en vez de devolver 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt-entra', 'jwt-cognito']) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const hasAuth = Boolean(req.headers?.authorization);
    const url = req.originalUrl ?? req.url ?? '';

    if (isPublicEspacioGet(req.method, url)) {
      if (hasAuth) {
        try {
          const res = super.canActivate(context);
          return isObservable(res) ? await firstValueFrom(res) : await res;
        } catch {
          return true;
        }
      }
      return true;
    }

    const res = super.canActivate(context);
    return isObservable(res) ? await firstValueFrom(res) : await res;
  }

  // DEBUG temporal: diagnostico del 401 "sesion expirada/invalida" -- Passport
  // no loguea por que rechazo el JWT (firma/issuer/audience/exp).
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err || !user) {
      const detalle = info as { message?: string; name?: string } | undefined;
      console.error('DEBUG JwtAuthGuard reject:', {
        err: err instanceof Error ? err.message : err,
        infoName: detalle?.name,
        infoMessage: detalle?.message ?? String(info),
      });
    }
    return super.handleRequest(err, user, info, context, status);
  }
}

