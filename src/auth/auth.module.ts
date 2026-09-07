import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './jwt.strategy';
import { IdentityMapper } from './identity-mapper';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [PassportModule],
  providers: [
    JwtStrategy,
    IdentityMapper,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [IdentityMapper],
})
export class AuthModule {}
