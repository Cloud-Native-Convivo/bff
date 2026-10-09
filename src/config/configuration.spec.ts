import { configuration } from './configuration';

describe('configuration', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  function conEntorno(env: Record<string, string | undefined>) {
    process.env = {
      ENTRA_TENANT_ID: 'mock-tenant',
      ENTRA_API_CLIENT_ID: env.ENTRA_AUDIENCE ? undefined : 'mock-client',
      COGNITO_APP_CLIENT_ID: 'mock-cognito-client',
      ...env,
    } as NodeJS.ProcessEnv;
    return configuration();
  }

  it('usa valores por defecto sin variables de entorno', () => {
    const c = conEntorno({});
    expect(c.port).toBe(3000);
    expect(c.nodeEnv).toBe('development');
    expect(c.corsOrigins).toEqual([]);
    expect(c.claimMap).toEqual({});
    expect(c.rabbitmqEnabled).toBe(false);
    expect(c.proxyTimeoutMs).toBe(2000);
    expect(c.cognitoIssuer).toBe('https://cognito-idp.us-east-1.amazonaws.com/');
    expect(c.cognitoJwksUri).toBe(`${c.cognitoIssuer}/.well-known/jwks.json`);
    expect(c.eurekaUrl).toBe('http://admin:admin123@localhost:8761/eureka');
  });

  it('ENTRA_ISSUER/ENTRA_JWKS_URI vacías (docker-compose) caen al tenant', () => {
    const c = conEntorno({ ENTRA_TENANT_ID: 'tid', ENTRA_ISSUER: '', ENTRA_JWKS_URI: '' });
    expect(c.entratIssuer).toBe('https://login.microsoftonline.com/tid/v2.0');
    expect(c.entratJwksUri).toBe('https://login.microsoftonline.com/tid/discovery/v2.0/keys');
  });

  it('lee variables explícitas, listas y mapeo de claims', () => {
    const c = conEntorno({
      PORT: '4000',
      CORS_ORIGINS: 'http://a.cl, http://b.cl ,',
      CLAIM_MAPEO: 'Convivo.Admin=administrador, invalido, =x',
      ENTRA_TENANT_ID: 'tid',
      ENTRA_AUDIENCE: 'aud-1',
      RABBITMQ_ENABLED: 'true',
      PROXY_TIMEOUT_MS: '500',
      EUREKA_URL: 'http://eureka-directo/eureka',
      COGNITO_ISSUER: 'https://issuer',
      COGNITO_JWKS_URI: 'https://jwks',
    });
    expect(c.port).toBe(4000);
    expect(c.corsOrigins).toEqual(['http://a.cl', 'http://b.cl']);
    expect(c.claimMap).toEqual({ 'Convivo.Admin': 'administrador' });
    expect(c.entratApiClientId).toBe('aud-1');
    expect(c.entratIssuer).toBe('https://login.microsoftonline.com/tid/v2.0');
    expect(c.entratJwksUri).toBe('https://login.microsoftonline.com/tid/discovery/v2.0/keys');
    expect(c.rabbitmqEnabled).toBe(true);
    expect(c.proxyTimeoutMs).toBe(500);
    expect(c.eurekaUrl).toBe('http://eureka-directo/eureka');
    expect(c.cognitoIssuer).toBe('https://issuer');
    expect(c.cognitoJwksUri).toBe('https://jwks');
  });

  it('en producción exige EUREKA_PASSWORD (fail-closed)', () => {
    expect(() => conEntorno({ NODE_ENV: 'production' })).toThrow(/EUREKA_PASSWORD/);
  });

  it('en producción arma la URL de Eureka con las credenciales dadas', () => {
    const c = conEntorno({
      NODE_ENV: 'production',
      EUREKA_USER: 'u',
      EUREKA_PASSWORD: 'p',
      EUREKA_HOST: 'eureka:8761',
    });
    expect(c.eurekaUrl).toBe('http://u:p@eureka:8761/eureka');
  });
});
