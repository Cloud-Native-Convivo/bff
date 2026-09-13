import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { IdentityMapper } from './identity-mapper';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt-entra') {
  constructor(
    config: ConfigService,
    private readonly mapper: IdentityMapper,
  ) {
    const issuer = config.getOrThrow<string>('entratIssuer');
    const tenantId = config.get<string>('entratTenantId') ?? '';
    const audience = config.getOrThrow<string>('entratApiClientId');
    const jwksUri = config.getOrThrow<string>('entratJwksUri');

    const cleanAudience = audience.replace(/^api:\/\//, '');
    const audiences = [
      cleanAudience,
      `api://${cleanAudience}`,
      '8c375036-6298-414a-bc3f-eb0f8fbdf26c',
    ];

    const issuers = [
      issuer,
      tenantId ? `https://sts.windows.net/${tenantId}/` : undefined,
    ].filter(Boolean) as string[];

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
      issuer: issuers,
      audience: audiences,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: Record<string, unknown>): Promise<UsuarioAutenticado> {
    if (!payload || (typeof payload.oid !== 'string' && typeof payload.sub !== 'string')) {
      throw new UnauthorizedException('Token inválido: falta oid o sub');
    }
    return this.mapper.toUsuario(payload);
  }
}
