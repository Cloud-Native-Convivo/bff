import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { GastosPdfProxyController } from './gastos-pdf-proxy.controller';
import { MessagingService } from '../messaging/messaging.service';
import { ProxyService } from './proxy.service';
import { CognitoEmailService } from '../auth/cognito-email.service';
import type { Request, Response } from 'express';

describe('GastosPdfProxyController', () => {
  let controller: GastosPdfProxyController;
  let messagingService: { publishFanout: jest.Mock };
  let proxyService: { forwardGastosBinary: jest.Mock };
  let cognitoEmailService: { obtenerEmail: jest.Mock };

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
    cognitoEmailService = {
      obtenerEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GastosPdfProxyController],
      providers: [
        { provide: MessagingService, useValue: messagingService },
        { provide: ProxyService, useValue: proxyService },
        { provide: CognitoEmailService, useValue: cognitoEmailService },
      ],
    }).compile();

    controller = module.get<GastosPdfProxyController>(GastosPdfProxyController);
  });

  it('debe responder 202 Accepted y publicar en exchange fanout al solicitar pdf (usuario Entra ID, email directo del claim)', async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const mockReq = { headers: {} } as Request;

    const user = {
      sub: 'user-1',
      correo: 'vecino@convivo.cl',
      roles: ['residente' as const],
      claims: { unidad: '301-A' },
    };

    const res = await controller.solicitarPdf(
      { unidadId: '301-A', mes: 'Agosto 2026' },
      mockReq,
      mockRes,
      user,
    );

    expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
    expect(res.estado).toBe('PENDIENTE');
    expect(res.ticket_id).toBeDefined();
    expect(cognitoEmailService.obtenerEmail).not.toHaveBeenCalled();
    expect(messagingService.publishFanout).toHaveBeenCalledWith(
      'gastos.pdf.fanout',
      expect.objectContaining({
        ticket_id: res.ticket_id,
        unidad_id: '301-A',
        email: 'vecino@convivo.cl',
      }),
    );
  });

  it('usuario Cognito (access token sin claim email): resuelve el email real via CognitoEmailService.GetUser', async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const mockReq = { headers: { authorization: 'Bearer token-crudo-cognito' } } as Request;

    cognitoEmailService.obtenerEmail.mockResolvedValue('residente-real@gmail.com');

    const user = {
      sub: 'cognito-sub-1',
      roles: ['residente' as const],
      claims: { token_use: 'access', client_id: 'app-client-1' },
    };

    const res = await controller.solicitarPdf({ unidadId: '301-A' }, mockReq, mockRes, user);

    expect(cognitoEmailService.obtenerEmail).toHaveBeenCalledWith('token-crudo-cognito', 'cognito-sub-1');
    expect(messagingService.publishFanout).toHaveBeenCalledWith(
      'gastos.pdf.fanout',
      expect.objectContaining({ ticket_id: res.ticket_id, email: 'residente-real@gmail.com' }),
    );
  });

  it('sin unidad en el token ni en el body responde 400 y no publica nada', async () => {
    const mockRes = { status: jest.fn().mockReturnThis(), setHeader: jest.fn().mockReturnThis() } as unknown as Response;
    const user = { sub: 'u-1', roles: ['residente' as const], claims: {} };

    await expect(
      controller.solicitarPdf({ mes: 'Noviembre 2026' }, { headers: {} } as Request, mockRes, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.solicitarPdf({ unidadId: '   ' }, { headers: {} } as Request, mockRes, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(messagingService.publishFanout).not.toHaveBeenCalled();
  });

  it('sin mes en el body no inyecta un mes fijo: el campo queda fuera del mensaje', async () => {
    const mockRes = { status: jest.fn().mockReturnThis(), setHeader: jest.fn().mockReturnThis() } as unknown as Response;
    const user = { sub: 'u-1', correo: 'a@b.cl', roles: ['residente' as const], claims: {} };

    await controller.solicitarPdf({ unidadId: 'Casa M202' }, { headers: {} } as Request, mockRes, user);

    const mensaje = messagingService.publishFanout.mock.calls[0][1] as Record<string, unknown>;
    expect(mensaje.mes).toBeUndefined();
    expect(mensaje.unidad_id).toBe('Casa M202');
    expect(mensaje.usuario_id).toBe('u-1');
    expect(JSON.stringify(mensaje)).not.toMatch(/Agosto 2026|301-A|usr-anon/);
  });

  it('usuario Cognito sin GetUser disponible: no inventa un correo, pero tampoco falla la solicitud', async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const mockReq = { headers: { authorization: 'Bearer token-crudo-cognito' } } as Request;

    cognitoEmailService.obtenerEmail.mockResolvedValue(undefined);

    const user = {
      sub: 'cognito-sub-2',
      roles: ['residente' as const],
      claims: { token_use: 'access', client_id: 'app-client-1' },
    };

    await controller.solicitarPdf({ unidadId: '301-A' }, mockReq, mockRes, user);

    const mensaje = messagingService.publishFanout.mock.calls[0][1] as Record<string, unknown>;
    expect(mensaje.email).toBeUndefined();
    expect(mensaje.unidad_id).toBe('301-A');
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
