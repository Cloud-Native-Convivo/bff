import { ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { AsyncMutationService } from './async-mutation.service';
import type { MessagingService } from '../messaging/messaging.service';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

describe('AsyncMutationService', () => {
  let service: AsyncMutationService;
  let mockMessaging: jest.Mocked<Partial<MessagingService>>;

  const mockUser: UsuarioAutenticado = {
    sub: 'user-uuid-123',
    correo: 'test@convivo.cl',
    roles: ['residente'],
    claims: {},
  };

  const mockReq = {
    method: 'POST',
    originalUrl: '/api/v1/espacios-comunes/reservas',
    body: { espacio_id: 1, fecha_inicio: '2026-10-15T10:00:00Z' },
  } as unknown as Request;

  beforeEach(() => {
    mockMessaging = {
      isReady: jest.fn().mockReturnValue(true),
      encolarComando: jest.fn().mockResolvedValue(undefined),
    };
    service = new AsyncMutationService(mockMessaging as MessagingService);
  });

  it('debe encolar y retornar 202 con Location y ticket_id cuando broker está listo', async () => {
    const res = await service.despachar('ESPACIOS', 'CREAR_RESERVA', mockReq, mockUser);
    expect(res.ticket_id).toBeDefined();
    expect(res.estado).toBe('EN_COLA');
    expect(res.status_url).toContain('/api/v1/espacios-comunes/jobs/');
    expect(mockMessaging.encolarComando).toHaveBeenCalledWith(
      'espacios_comandos_queue',
      expect.objectContaining({
        ticket_id: res.ticket_id,
        modulo: 'ESPACIOS',
        accion: 'CREAR_RESERVA',
        usuario_id: 'user-uuid-123',
      }),
    );
  });

  it('debe arrojar ServiceUnavailableException (503) si broker no está conectado', async () => {
    mockMessaging.isReady = jest.fn().mockReturnValue(false);
    await expect(service.despachar('ESPACIOS', 'CREAR_RESERVA', mockReq, mockUser))
      .rejects.toThrow(ServiceUnavailableException);
  });
});
