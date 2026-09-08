import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

const ESPACIOS_V1_PREFIX = '/api/v1/espacios-comunes';
const ESPACIOS_LEGACY_PREFIX = '/api/espacios';

@Controller('v1/espacios-comunes')
export class EspaciosProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All(['', '*path'])
  async forward(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
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
