import type { Request } from 'express';
import { JobsProxyController } from './jobs-proxy.controller';
import type { ProxyService } from './proxy.service';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

describe('JobsProxyController', () => {
  let controller: JobsProxyController;
  let mockProxy: jest.Mocked<Partial<ProxyService>>;

  const mockUser: UsuarioAutenticado = {
    sub: 'user-1',
    roles: ['residente'],
    claims: {},
  };

  const mockReq = {
    headers: { authorization: 'Bearer test-token' },
  } as unknown as Request;

  beforeEach(() => {
    mockProxy = {
      forwardEspacios: jest.fn().mockResolvedValue({ ticket_id: 'ticket-1', estado: 'COMPLETADO' }),
      forwardGastos: jest.fn().mockResolvedValue({ ticket_id: 'ticket-2', estado: 'PROCESANDO' }),
    };
    controller = new JobsProxyController(mockProxy as ProxyService);
  });

  it('debe reenviar consulta de job de espacios al microservicio correspondiente', async () => {
    const res = await controller.consultarJobEspacios('ticket-1', mockReq, mockUser);
    expect(res).toEqual({ ticket_id: 'ticket-1', estado: 'COMPLETADO' });
    expect(mockProxy.forwardEspacios).toHaveBeenCalledWith(
      'GET',
      '/jobs/ticket-1',
      '',
      undefined,
      mockReq.headers,
      mockUser,
    );
  });

  it('debe reenviar consulta de job de gastos al microservicio correspondiente', async () => {
    const res = await controller.consultarJobGastos('ticket-2', mockReq, mockUser);
    expect(res).toEqual({ ticket_id: 'ticket-2', estado: 'PROCESANDO' });
    expect(mockProxy.forwardGastos).toHaveBeenCalledWith(
      'GET',
      '/jobs/ticket-2',
      '',
      undefined,
      mockReq.headers,
      mockUser,
    );
  });
});
