import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { MessagingService } from '../messaging/messaging.service';
import { ProxyService } from './proxy.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

@Controller('v1/gastos')
export class GastosPdfProxyController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly proxy: ProxyService,
  ) {}

  @Post('solicitar-pdf')
  async solicitarPdf(
    @Body() body: { unidadId?: string; mes?: string },
    @Res({ passthrough: true }) res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    const ticketId = randomUUID();
    const unidadId = (user?.claims?.['custom:unidad'] as string) ?? (user?.claims?.unidad as string) ?? body?.unidadId ?? '301-A';
    const email = user?.correo ?? (user?.claims?.email as string) ?? 'residente@convivo.cl';
    const mes = body?.mes ?? 'Agosto 2026';
    const usuarioId = user?.sub ?? 'usr-anon';

    await this.messagingService.publishFanout('gastos.pdf.fanout', {
      ticket_id: ticketId,
      unidad_id: unidadId,
      email,
      mes,
      usuario_id: usuarioId,
      creado_en: new Date().toISOString(),
    });

    res.status(HttpStatus.ACCEPTED);
    res.setHeader('Location', `/api/v1/gastos/jobs/${ticketId}`);
    res.setHeader('Retry-After', '2');

    return {
      ticket_id: ticketId,
      estado: 'PENDIENTE',
      mensaje: 'Generación de comprobante PDF encolada exitosamente',
      download_url: `/api/v1/gastos/pdf/${ticketId}/descargar`,
    };
  }

  @Get('pdf/:ticketId/descargar')
  async descargarPdf(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
    @Res() res: Response,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    const { data, headers } = await this.proxy.forwardGastosBinary(
      `/api/v1/gastos/pdf/${ticketId}/descargar`,
      req.headers,
      user,
    );

    res.setHeader('Content-Type', headers['content-type'] ?? 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      headers['content-disposition'] ?? `attachment; filename="gastos-comunes-${ticketId}.pdf"`,
    );
    res.setHeader('Content-Length', data.length);
    res.end(data);
  }
}
