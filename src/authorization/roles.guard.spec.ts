import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contexto(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(requeridos: string[] | undefined): RolesGuard {
  return new RolesGuard({ getAllAndOverride: () => requeridos } as unknown as Reflector);
}

describe('RolesGuard', () => {
  it('sin @Roles no restringe', () => {
    expect(guard(undefined).canActivate(contexto({}))).toBe(true);
    expect(guard([]).canActivate(contexto({}))).toBe(true);
  });

  it('permite si el usuario tiene alguno de los roles requeridos', () => {
    const req = { user: { roles: ['residente', 'comite'] } };
    expect(guard(['administrador', 'comite']).canActivate(contexto(req))).toBe(true);
  });

  it('rechaza con 403 si el usuario no tiene el rol', () => {
    const req = { user: { roles: ['residente'] } };
    expect(() => guard(['administrador']).canActivate(contexto(req))).toThrow(ForbiddenException);
  });

  it('ignora X-Usuario-Roles del cliente (anti-spoofing)', () => {
    const req = { user: { roles: [] }, headers: { 'x-usuario-roles': 'administrador' } };
    expect(() => guard(['administrador']).canActivate(contexto(req))).toThrow(ForbiddenException);
  });

  it('rechaza si no hay usuario ni headers', () => {
    expect(() => guard(['residente']).canActivate(contexto({}))).toThrow(ForbiddenException);
  });
});
