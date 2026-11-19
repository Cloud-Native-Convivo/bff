import {
  All,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { AsyncMutationService } from './async-mutation.service';
import { Roles } from '../authorization/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { Rol, UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

const GASTOS_PREFIX = '/api/gastos';
const GASTOS_V1 = 'api/v1/gastos-comunes';
const ROLES_MUTACION: Rol[] = ['admin', 'administrador', 'conserje', 'comite'];

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

  // ms-gastos-comunes solo conoce estas cuatro acciones (ComandoGastosConsumer).
  @Roles(...ROLES_MUTACION)
  @Post(GASTOS_V1)
  @HttpCode(HttpStatus.ACCEPTED)
  async registrarGasto(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('REGISTRAR_GASTO', req, res, user);
  }

  @Roles(...ROLES_MUTACION)
  @Put(`${GASTOS_V1}/:id`)
  @HttpCode(HttpStatus.ACCEPTED)
  async actualizarGasto(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('ACTUALIZAR_GASTO', req, res, user);
  }

  @Roles(...ROLES_MUTACION)
  @Delete(`${GASTOS_V1}/:id`)
  @HttpCode(HttpStatus.ACCEPTED)
  async eliminarGasto(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('ELIMINAR_GASTO', req, res, user);
  }

  @Roles(...ROLES_MUTACION)
  @Post(`${GASTOS_V1}/:id/pagos`)
  @HttpCode(HttpStatus.ACCEPTED)
  async registrarPago(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('REGISTRAR_PAGO', req, res, user);
  }

  // Cualquier otra mutación no tiene handler en el consumidor: se rechaza sin encolar.
  @All('*path')
  mutacionNoSoportada(): never {
    throw new NotFoundException('Operación de gastos comunes no soportada');
  }

  private async despacharMutacion(
    accion: string,
    req: Request,
    res: Response,
    user?: UsuarioAutenticado,
  ) {
    const job = await this.asyncMutation.despachar('GASTOS', accion, req, user);
    res.status(HttpStatus.ACCEPTED);
    res.setHeader('Location', job.status_url);
    res.setHeader('Retry-After', '2');
    return job;
  }
}
