import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
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
  constructor(private readonly proxy: ProxyService) {}

  @Get(['', '*path'])
  async listar(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Post(RUTAS_RESERVAS)
  async crearReserva(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Put(RUTAS_RESERVAS)
  async actualizarReserva(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Patch(RUTAS_RESERVAS)
  async modificarReserva(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Delete(RUTAS_RESERVAS)
  async eliminarReserva(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  // Las rutas de espacios deben registrarse después de las de reservas:
  // '*path' también matchea 'reservas', y Express usa la primera ruta
  // registrada que matchee método + path.
  @Roles('admin', 'administrador', 'conserje')
  @Post(RUTAS_ESPACIOS)
  async crearEspacio(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Roles('admin', 'administrador', 'conserje')
  @Put(RUTAS_ESPACIOS)
  async actualizarEspacio(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Roles('admin', 'administrador', 'conserje')
  @Patch(RUTAS_ESPACIOS)
  async modificarEspacio(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Roles('admin', 'administrador', 'conserje')
  @Delete(RUTAS_ESPACIOS)
  async eliminarEspacio(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
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
