import {
  All,
  Controller,
  Get,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { AsyncMutationService } from './async-mutation.service';
import { Roles } from '../authorization/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

const GASTOS_PREFIX = '/api/gastos';

@Controller('gastos')
export class GastosProxyController {
  constructor(
    private readonly proxy: ProxyService,
    private readonly asyncMutation: AsyncMutationService,
  ) {}

  @Get('*path')
  async listar(
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

  @Roles('admin', 'administrador', 'conserje', 'comite')
  @All('*path')
  async forward(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    if (req.method === 'GET') {
      return this.listar(req, user);
    }
    const job = await this.asyncMutation.despachar('GASTOS', `${req.method}_GASTO`, req, user);
    res.status(HttpStatus.ACCEPTED);
    res.setHeader('Location', job.status_url);
    res.setHeader('Retry-After', '2');
    return job;
  }
}
