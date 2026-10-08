import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function contexto(method: string, url: string, authorization?: string): ExecutionContext {
  const req = { method, originalUrl: url, headers: authorization ? { authorization } : {} };
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const guard = new JwtAuthGuard(reflector);
  const superCanActivate = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate');

  beforeEach(() => superCanActivate.mockReset().mockResolvedValue(false));

  it('deja pasar GET anónimo al catálogo de espacios aunque traiga slash final y query', async () => {
    await expect(guard.canActivate(contexto('GET', '/api/v1/espacios-comunes///?page=1'))).resolves.toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('exige JWT en reservas aunque cuelguen de espacios', async () => {
    await expect(guard.canActivate(contexto('GET', '/api/v1/espacios-comunes/5/reservas/'))).resolves.toBe(false);
    expect(superCanActivate).toHaveBeenCalledTimes(1);
  });

  it('exige JWT en métodos de escritura sobre espacios', async () => {
    await expect(guard.canActivate(contexto('POST', '/api/v1/espacios-comunes'))).resolves.toBe(false);
    expect(superCanActivate).toHaveBeenCalledTimes(1);
  });

  it('con token inválido en catálogo público cae a anónimo en vez de 401', async () => {
    superCanActivate.mockRejectedValue(new Error('jwt expired'));
    await expect(guard.canActivate(contexto('GET', '/api/espacios/', 'Bearer x'))).resolves.toBe(true);
  });
});
