import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
import { Roles } from '../authorization/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

const GASTOS_PREFIX = '/api/gastos';

@Controller('gastos')
@Roles('admin', 'administrador', 'conserje', 'comite')
export class GastosProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  async forward(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    const fullPath = req.originalUrl.split('?')[0];
    const path = fullPath.slice(GASTOS_PREFIX.length);
    const query = req.originalUrl.split('?')[1] ?? '';
    return this.proxy.forwardGastos(
      req.method,
      path,
      query,
      req.body,
      req.headers,
      user,
    );
  }
}
