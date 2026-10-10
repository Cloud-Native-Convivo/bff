import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { GastosPdfProxyController } from './gastos-pdf-proxy.controller';
import { MessagingService } from '../messaging/messaging.service';
import { ProxyService } from './proxy.service';
import type { Response } from 'express';

describe('GastosPdfProxyController', () => {
  let controller: GastosPdfProxyController;
  let messagingService: { publishFanout: jest.Mock };
  let proxyService: { forwardGastosBinary: jest.Mock };

  beforeEach(async () => {
    messagingService = {
      publishFanout: jest.fn().mockResolvedValue(undefined),
    };
    proxyService = {
      forwardGastosBinary: jest.fn().mockResolvedValue({
        data: Buffer.from('%PDF-1.4 test'),
        headers: { 'content-type': 'application/pdf' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GastosPdfProxyController],
      providers: [
        { provide: MessagingService, useValue: messagingService },
        { provide: ProxyService, useValue: proxyService },
      ],
    }).compile();

    controller = module.get<GastosPdfProxyController>(GastosPdfProxyController);
  });

  it('debe responder 202 Accepted y publicar en exchange fanout al solicitar pdf', async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    } as unknown as Response;

    const user = {
      sub: 'user-1',
      correo: 'vecino@convivo.cl',
      roles: ['residente' as const],
      claims: { unidad: '301-A' },
    };

    const res = await controller.solicitarPdf(
      { unidadId: '301-A', mes: 'Agosto 2026' },
      mockRes,
      user,
    );

    expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
    expect(res.estado).toBe('PENDIENTE');
    expect(res.ticket_id).toBeDefined();
    expect(messagingService.publishFanout).toHaveBeenCalledWith(
      'gastos.pdf.fanout',
      expect.objectContaining({
        ticket_id: res.ticket_id,
        unidad_id: '301-A',
        email: 'vecino@convivo.cl',
      }),
    );
  });

  it('debe descargar binario del pdf usando forwardGastosBinary', async () => {
    const mockRes = {
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn(),
    } as unknown as Response;

    await controller.descargarPdf(
      'ticket-123',
      { headers: {} } as any,
      mockRes,
      undefined,
    );

    expect(proxyService.forwardGastosBinary).toHaveBeenCalledWith(
      '/api/v1/gastos/pdf/ticket-123/descargar',
      {},
      undefined,
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockRes.end).toHaveBeenCalled();
  });
});
