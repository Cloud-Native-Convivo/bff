import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProxyService } from './proxy.service';
import { Roles } from '../authorization/roles.decorator';

const GASTOS_PREFIX = '/api/gastos';

@Controller('gastos')
@Roles('admin', 'conserje', 'comite')
export class GastosProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  async forward(@Req() req: Request) {
    const fullPath = req.originalUrl.split('?')[0];
    const path = fullPath.slice(GASTOS_PREFIX.length);
    const query = req.originalUrl.split('?')[1] ?? '';
    return this.proxy.forwardGastos(
      req.method,
      path,
      query,
      req.body,
      req.headers,
    );
  }
}
