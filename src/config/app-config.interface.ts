export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  globalPrefix: string;
  serviceName: string;
  entratTenantId: string;
  entratApiClientId: string;
  entratIssuer: string;
  entratJwksUri: string;
  cognitoUserPoolId: string;
  cognitoAppClientId: string;
  cognitoIssuer: string;
  cognitoJwksUri: string;
  claimDeRol: string;
  claimSeparador: string;
  claimMap: Record<string, string>;
  gastosComunesUrl: string;
  espaciosComunesUrl: string;
  proxyTimeoutMs: number;
  rabbitmqEnabled: boolean;
  rabbitmqUrls: string;
  rabbitmqExchange: string;
}

