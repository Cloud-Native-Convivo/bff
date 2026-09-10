import type { AppConfig } from './app-config.interface';

export const configuration = (): AppConfig => {
  const tenantId = process.env.ENTRA_TENANT_ID ?? '';
  const claimMap = parseClaimMap(process.env.CLAIM_MAPEO);
  const cognitoUserPoolId =
    process.env.COGNITO_USER_POOL_ID ?? 'us-east-1_jmLnvOaUx';
  const cognitoAppClientId =
    process.env.COGNITO_APP_CLIENT_ID ?? '597noe991s5ebj8ab2blpvkjm0';
  const cognitoRegion = process.env.COGNITO_REGION ?? 'us-east-1';
  const cognitoIssuer =
    process.env.COGNITO_ISSUER ??
    `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`;
  const cognitoJwksUri =
    process.env.COGNITO_JWKS_URI ??
    `${cognitoIssuer}/.well-known/jwks.json`;

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigins: splitList(process.env.CORS_ORIGINS),
    globalPrefix: process.env.GLOBAL_PREFIX ?? 'api',
    serviceName: process.env.SERVICE_NAME ?? 'convivo-bff',
    entratTenantId: tenantId,
    entratApiClientId:
      process.env.ENTRA_API_CLIENT_ID ??
      '528af346-c37c-40a0-9f7e-30162de3c027',
    entratIssuer:
      process.env.ENTRA_ISSUER ??
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
    entratJwksUri:
      process.env.ENTRA_JWKS_URI ??
      `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cognitoUserPoolId,
    cognitoAppClientId,
    cognitoIssuer,
    cognitoJwksUri,
    claimDeRol: process.env.CLAIM_DE_ROL ?? 'roles',
    claimSeparador: process.env.CLAIM_SEPARADOR ?? ',',
    claimMap,
    gastosComunesUrl:
      process.env.GASTOS_COMUNES_URL ?? 'http://localhost:8083',
    espaciosComunesUrl:
      process.env.ESPACIOS_COMUNES_URL ?? 'http://localhost:8082',
    proxyTimeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS ?? '2000', 10),
    rabbitmqEnabled: (process.env.RABBITMQ_ENABLED ?? 'false') === 'true',
    rabbitmqUrls: process.env.RABBITMQ_URLS ?? 'amqp://localhost:5672',
    rabbitmqExchange: process.env.RABBITMQ_EXCHANGE ?? 'convivo',
  };
};

function splitList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseClaimMap(value?: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of splitList(value)) {
    const [from, to] = entry.split('=');
    if (from && to) {
      map[from.trim()] = to.trim();
    }
  }
  return map;
}
