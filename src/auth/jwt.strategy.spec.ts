import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { IdentityMapper } from './identity-mapper';
import { JwtCognitoStrategy } from './jwt-cognito.strategy';
import { JwtStrategy } from './jwt.strategy';

const valores: Record<string, string> = {
  entratIssuer: 'https://login.microsoftonline.com/tid/v2.0',
  entratTenantId: 'tid',
  entratApiClientId: 'api://cliente-1',
  entratJwksUri: 'https://jwks/entra',
  cognitoIssuer: 'https://cognito/issuer',
  cognitoAppClientId: 'app-cliente',
  cognitoJwksUri: 'https://jwks/cognito',
};
const config = {
  get: (k: string) => valores[k],
  getOrThrow: (k: string) => valores[k],
} as unknown as ConfigService;
const mapper = new IdentityMapper(config);

describe('JwtStrategy (Entra ID)', () => {
  const estrategia = new JwtStrategy(config, mapper);

  it('acepta payload con oid o sub', async () => {
    await expect(estrategia.validate({ oid: 'o-1' })).resolves.toMatchObject({ sub: 'o-1' });
    await expect(estrategia.validate({ sub: 's-1' })).resolves.toMatchObject({ sub: 's-1' });
  });

  it('rechaza payload sin identificador', async () => {
    await expect(estrategia.validate({})).rejects.toThrow(UnauthorizedException);
    await expect(estrategia.validate(null as unknown as Record<string, unknown>)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('sin tenant solo acepta el issuer configurado', () => {
    const sinTenant = { ...config, get: () => undefined } as unknown as ConfigService;
    expect(() => new JwtStrategy(sinTenant, mapper)).not.toThrow();
  });
});

describe('JwtCognitoStrategy', () => {
  const estrategia = new JwtCognitoStrategy(config, mapper);

  it('acepta token del client_id configurado (aud o client_id)', async () => {
    await expect(estrategia.validate({ sub: 'c-1', aud: 'app-cliente' })).resolves.toMatchObject({
      sub: 'c-1',
      roles: ['residente'],
    });
    await expect(estrategia.validate({ sub: 'c-1', client_id: 'app-cliente' })).resolves.toBeDefined();
  });

  it('rechaza token de otro cliente o sin sub', async () => {
    await expect(estrategia.validate({ sub: 'c-1', aud: 'otro' })).rejects.toThrow(UnauthorizedException);
    await expect(estrategia.validate({ aud: 'app-cliente' })).rejects.toThrow(UnauthorizedException);
  });
});
