import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

// Se registra el guard global aca (no en AppModule) a proposito: Nest agrega
// los providers propios del modulo raiz al contenedor ANTES de recorrer sus
// imports, asi que un APP_GUARD puesto directo en AppModule.providers se
// ejecutaria antes que el guard de auth (que si vive en un modulo importado,
// AuthModule) y request.user todavia no existiria -- RolesGuard vería roles
// vacios siempre. Al vivir este binding en un modulo importado DESPUES de
// AuthModule (ver app.module.ts), Nest lo ejecuta despues de JwtAuthGuard.
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthorizationModule {}
