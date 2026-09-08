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
        jwksRequestsPerMinute: 5,
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
    const tokenClient = payload.aud ?? payload.client_id;
    if (tokenClient !== this.clientId) {
      throw new UnauthorizedException(
        'Token inválido: audiencia o client_id de Cognito no coincide',
      );
    }
    return this.mapper.toUsuarioCognito(payload);
  }
}
