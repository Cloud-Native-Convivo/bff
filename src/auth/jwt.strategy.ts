import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { IdentityMapper } from './identity-mapper';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly mapper: IdentityMapper,
  ) {
    const issuer = config.getOrThrow<string>('entratIssuer');
    const audience = config.getOrThrow<string>('entratApiClientId');
    const jwksUri = config.getOrThrow<string>('entratJwksUri');

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
      audience,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: Record<string, unknown>): Promise<UsuarioAutenticado> {
    if (!payload || typeof payload.oid !== 'string') {
      throw new UnauthorizedException('Token inválido: falta oid');
    }
    return this.mapper.toUsuario(payload);
  }
}
