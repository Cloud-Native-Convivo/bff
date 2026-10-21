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
const TIMEOUT_GET_USER_MS = 2000;
const MAX_CACHE_ENTRADAS = 1000;

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
      const resultado = await this.conTimeout(
        this.cliente.send(new GetUserCommand({ AccessToken: accessToken })),
      );
      const email = resultado.UserAttributes?.find((a) => a.Name === 'email')?.Value;
      if (email) {
        this.guardarEnCache(sub, email);
      }
      return email;
    } catch (error) {
      this.logger.warn(`No se pudo obtener el email de Cognito para sub=${sub}: ${(error as Error).message}`);
      return undefined;
    }
  }

  private conTimeout<T>(promesa: Promise<T>): Promise<T> {
    let temporizador: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      temporizador = setTimeout(
        () => reject(new Error(`Timeout de ${TIMEOUT_GET_USER_MS}ms esperando a Cognito GetUser`)),
        TIMEOUT_GET_USER_MS,
      );
    });
    return Promise.race([promesa, timeout]).finally(() => clearTimeout(temporizador));
  }

  /** Borra entradas vencidas y, si se llega al máximo, la más antigua (orden de inserción del Map). */
  private guardarEnCache(sub: string, email: string): void {
    const ahora = Date.now();
    for (const [clave, entrada] of this.cache) {
      if (entrada.expiraEn <= ahora) {
        this.cache.delete(clave);
      }
    }

    if (this.cache.size >= MAX_CACHE_ENTRADAS) {
      const masAntigua = this.cache.keys().next().value;
      if (masAntigua !== undefined) {
        this.cache.delete(masAntigua);
      }
    }

    this.cache.set(sub, { email, expiraEn: ahora + TTL_CACHE_MS });
  }
}
