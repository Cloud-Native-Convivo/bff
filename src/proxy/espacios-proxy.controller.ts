import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { AsyncMutationService } from './async-mutation.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { Roles } from '../authorization/roles.decorator';

const ESPACIOS_V1_PREFIX = '/api/v1/espacios-comunes';
const ESPACIOS_LEGACY_PREFIX = '/api/espacios';

// Reservas: el propio residente crea/gestiona las suyas, sin rol especial.
const RUTAS_RESERVAS = ['reservas', 'reservas/*path', ':id/reservas'];
// Todo lo demás (alta en la raíz, /espacios y cualquier otra ruta).
const RUTAS_ESPACIOS = ['', '*path'];

@Controller('v1/espacios-comunes')
export class EspaciosProxyController {
  constructor(
    private readonly proxy: ProxyService,
    private readonly asyncMutation: AsyncMutationService,
  ) {}

  @Get(['', '*path'])
  async listar(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Post(RUTAS_RESERVAS)
  @HttpCode(HttpStatus.ACCEPTED)
  async crearReserva(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('CREAR_RESERVA', req, res, user);
  }

  @Put(RUTAS_RESERVAS)
  @HttpCode(HttpStatus.ACCEPTED)
  async actualizarReserva(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('ACTUALIZAR_RESERVA', req, res, user);
  }

  @Patch(RUTAS_RESERVAS)
  @HttpCode(HttpStatus.ACCEPTED)
  async modificarReserva(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('MODIFICAR_RESERVA', req, res, user);
  }

  @Delete(RUTAS_RESERVAS)
  @HttpCode(HttpStatus.ACCEPTED)
  async eliminarReserva(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('ELIMINAR_RESERVA', req, res, user);
  }

  // Las rutas de espacios deben registrarse después de las de reservas:
  // '*path' también matchea 'reservas', y Express usa la primera ruta
  // registrada que matchee método + path.
  @Roles('admin', 'administrador', 'conserje')
  @Post(RUTAS_ESPACIOS)
  @HttpCode(HttpStatus.ACCEPTED)
  async crearEspacio(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('CREAR_ESPACIO', req, res, user);
  }

  @Roles('admin', 'administrador', 'conserje')
  @Put(RUTAS_ESPACIOS)
  @HttpCode(HttpStatus.ACCEPTED)
  async actualizarEspacio(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('ACTUALIZAR_ESPACIO', req, res, user);
  }

  @Roles('admin', 'administrador', 'conserje')
  @Patch(RUTAS_ESPACIOS)
  @HttpCode(HttpStatus.ACCEPTED)
  async modificarEspacio(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('MODIFICAR_ESPACIO', req, res, user);
  }

  @Roles('admin', 'administrador', 'conserje')
  @Delete(RUTAS_ESPACIOS)
  @HttpCode(HttpStatus.ACCEPTED)
  async eliminarEspacio(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.despacharMutacion('ELIMINAR_ESPACIO', req, res, user);
  }

  private async despacharMutacion(
    accion: string,
    req: Request,
    res: Response,
    user?: UsuarioAutenticado,
  ) {
    const job = await this.asyncMutation.despachar('ESPACIOS', accion, req, user);
    res.status(HttpStatus.ACCEPTED);
    res.setHeader('Location', job.status_url);
    res.setHeader('Retry-After', '2');
    return job;
  }

  private async forward(req: Request, user?: UsuarioAutenticado) {
    const fullPath = req.originalUrl.split('?')[0];
    let path = fullPath;
    if (fullPath.startsWith(ESPACIOS_V1_PREFIX)) {
      path = fullPath.slice(ESPACIOS_V1_PREFIX.length);
    } else if (fullPath.startsWith(ESPACIOS_LEGACY_PREFIX)) {
      path = fullPath.slice(ESPACIOS_LEGACY_PREFIX.length);
    }
    const query = req.originalUrl.split('?')[1] ?? '';
    return this.proxy.forwardEspacios(
      req.method,
      path,
      query,
      req.body,
      req.headers,
      user,
    );
  }
}
