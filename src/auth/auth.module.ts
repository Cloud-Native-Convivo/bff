import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtCognitoStrategy } from './jwt-cognito.strategy';
import { IdentityMapper } from './identity-mapper';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CognitoEmailService } from './cognito-email.service';

@Module({
  imports: [PassportModule],
  providers: [
    JwtStrategy,
    JwtCognitoStrategy,
    IdentityMapper,
    JwtAuthGuard,
    CognitoEmailService,
  ],
  exports: [IdentityMapper, JwtAuthGuard, CognitoEmailService],
})
export class AuthModule {}
