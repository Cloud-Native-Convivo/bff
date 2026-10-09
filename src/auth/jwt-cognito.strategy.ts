import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { IdentityMapper } from './identity-mapper';

@Injectable()
export class JwtCognitoStrategy extends PassportStrategy(Strategy, 'jwt-cognito') {
  private readonly clientId: string;

  constructor(
    config: ConfigService,
    private readonly mapper: IdentityMapper,
  ) {
    const issuer = config.getOrThrow<string>('cognitoIssuer');
    const clientId = config.getOrThrow<string>('cognitoAppClientId');
    const jwksUri = config.getOrThrow<string>('cognitoJwksUri');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 50,
        jwksUri,
      }),
      issuer,
      algorithms: ['RS256'],
    });

    this.clientId = clientId;
  }

  async validate(payload: Record<string, unknown>): Promise<UsuarioAutenticado> {
    if (!payload || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Token inválido: falta sub de Cognito');
    }
    // Solo access tokens: el ID token es para que el front sepa quién es el usuario,
    // no para autorizar llamadas a la API. Cognito marca cada uno en `token_use`
    // y el access token trae `client_id` (el ID token trae `aud` en su lugar).
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException(
        'Token inválido: se requiere un access token de Cognito',
      );
    }
    if (payload.client_id !== this.clientId) {
      throw new UnauthorizedException(
        'Token inválido: client_id de Cognito no coincide',
      );
    }
    return this.mapper.toUsuarioCognito(payload);
  }
}
