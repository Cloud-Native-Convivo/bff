import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

interface EntradaCache {
  email: string;
  expiraEn: number;
}

const TTL_CACHE_MS = 5 * 60 * 1000;

/**
 * El access token de Cognito nunca trae el claim `email` (solo el ID token
 * lo trae, sin importar el scope OAuth pedido) — por eso este servicio
 * resuelve el email con GetUser contra el propio access token, en vez de
 * leerlo del JWT ya decodificado.
 */
@Injectable()
export class CognitoEmailService {
  private readonly logger = new Logger(CognitoEmailService.name);
  private readonly cliente: CognitoIdentityProviderClient;
  private readonly cache = new Map<string, EntradaCache>();

  constructor(config: ConfigService) {
    this.cliente = new CognitoIdentityProviderClient({
      region: config.get<string>('cognitoRegion') ?? 'us-east-1',
    });
  }

  async obtenerEmail(accessToken: string, sub: string): Promise<string | undefined> {
    const cacheado = this.cache.get(sub);
    if (cacheado && cacheado.expiraEn > Date.now()) {
      return cacheado.email;
    }

    try {
      const resultado = await this.cliente.send(new GetUserCommand({ AccessToken: accessToken }));
      const email = resultado.UserAttributes?.find((a) => a.Name === 'email')?.Value;
      if (email) {
        this.cache.set(sub, { email, expiraEn: Date.now() + TTL_CACHE_MS });
      }
      return email;
    } catch (error) {
      this.logger.warn(`No se pudo obtener el email de Cognito para sub=${sub}: ${(error as Error).message}`);
      return undefined;
    }
  }
}
