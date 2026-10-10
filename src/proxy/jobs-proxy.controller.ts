import { Controller, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

@Controller('v1')
export class JobsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get('espacios-comunes/jobs/:ticketId')
  async consultarJobEspacios(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.proxy.forwardEspacios(
      'GET',
      `/jobs/${ticketId}`,
      '',
      undefined,
      req.headers,
      user,
    );
  }

  @Get('gastos/jobs/:ticketId')
  async consultarJobGastos(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.proxy.forwardGastos(
      'GET',
      `/jobs/${ticketId}`,
      '',
      undefined,
      req.headers,
      user,
    );
  }
}
