import { All, Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
import { Roles } from '../authorization/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

const CONDOMINIOS_PREFIX = '/api/condominios';

@Controller('condominios')
export class CondominiosProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get()
  @Get('*path')
  async listar(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Roles('admin', 'administrador', 'conserje', 'comite')
  @All()
  @All('*path')
  async forward(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    const fullPath = req.originalUrl.split('?')[0];
    const path = fullPath.slice(CONDOMINIOS_PREFIX.length);
    const query = req.originalUrl.split('?')[1] ?? '';
    return this.proxy.forwardCondominios(
      req.method,
      path,
      query,
      req.body,
      req.headers,
      user,
    );
  }
}
