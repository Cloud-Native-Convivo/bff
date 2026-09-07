import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { ProxyModule } from './proxy/proxy.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CommonModule,
    HealthModule,
    ProxyModule,
    AuthModule,
    AuthorizationModule,
    MessagingModule,
  ],
})
export class AppModule {}
