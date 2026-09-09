import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

/**
 * Agregador del panel del residente (RF-T.7): reservas + gastos comunes
 * en una sola llamada, autenticado (guard global JwtAuthGuard).
 */
@Controller('v1/panel')
export class PanelController {
  constructor(private readonly proxy: ProxyService) {}

  @Get()
  async obtenerPanel(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.proxy.obtenerPanel(req.headers, user);
  }
}
