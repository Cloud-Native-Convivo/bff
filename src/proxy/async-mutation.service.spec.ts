import { ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { AsyncMutationService } from './async-mutation.service';
import type { MessagingService } from '../messaging/messaging.service';
import type { CognitoEmailService } from '../auth/cognito-email.service';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

describe('AsyncMutationService', () => {
  let service: AsyncMutationService;
  let mockMessaging: jest.Mocked<Partial<MessagingService>>;
  let mockCognitoEmail: jest.Mocked<Partial<CognitoEmailService>>;

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
    headers: {},
  } as unknown as Request;

  beforeEach(() => {
    mockMessaging = {
      isReady: jest.fn().mockReturnValue(true),
      encolarComando: jest.fn().mockResolvedValue(undefined),
    };
    mockCognitoEmail = {
      obtenerEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new AsyncMutationService(
      mockMessaging as MessagingService,
      mockCognitoEmail as CognitoEmailService,
    );
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

describe('AsyncMutationService — email en CREAR_RESERVA', () => {
  let service: AsyncMutationService;
  let mockMessaging: jest.Mocked<Partial<MessagingService>>;
  let mockCognitoEmail: jest.Mocked<Partial<CognitoEmailService>>;

  const mockUserCognito: UsuarioAutenticado = {
    sub: 'residente-1',
    roles: ['residente'],
    claims: { token_use: 'access', client_id: 'cliente-cognito' },
  };

  const mockReqConBearer = {
    method: 'POST',
    originalUrl: '/api/v1/espacios-comunes/reservas',
    body: { espacio_id: 1, fecha_inicio: '2026-10-15T10:00:00Z' },
    headers: { authorization: 'Bearer token-crudo' },
  } as unknown as Request;

  beforeEach(() => {
    mockMessaging = {
      isReady: jest.fn().mockReturnValue(true),
      encolarComando: jest.fn().mockResolvedValue(undefined),
    };
    mockCognitoEmail = {
      obtenerEmail: jest.fn().mockResolvedValue('residente@convivo.cl'),
    };
    service = new AsyncMutationService(
      mockMessaging as MessagingService,
      mockCognitoEmail as CognitoEmailService,
    );
  });

  it('agrega usuario_email al comando CREAR_RESERVA cuando el usuario viene de Cognito', async () => {
    await service.despachar('ESPACIOS', 'CREAR_RESERVA', mockReqConBearer, mockUserCognito);

    expect(mockCognitoEmail.obtenerEmail).toHaveBeenCalledWith('token-crudo', 'residente-1');
    expect(mockMessaging.encolarComando).toHaveBeenCalledWith(
      'espacios_comandos_queue',
      expect.objectContaining({ usuario_email: 'residente@convivo.cl' }),
    );
  });

  it('no llama a Cognito para acciones que no son CREAR_RESERVA', async () => {
    await service.despachar('ESPACIOS', 'CANCELAR_RESERVA', mockReqConBearer, mockUserCognito);
    expect(mockCognitoEmail.obtenerEmail).not.toHaveBeenCalled();
  });

  it('no falla ni bloquea la reserva si Cognito no devuelve email', async () => {
    mockCognitoEmail.obtenerEmail = jest.fn().mockResolvedValue(undefined);
    const res = await service.despachar('ESPACIOS', 'CREAR_RESERVA', mockReqConBearer, mockUserCognito);
    expect(res.estado).toBe('EN_COLA');
    expect(mockMessaging.encolarComando).toHaveBeenCalledWith(
      'espacios_comandos_queue',
      expect.not.objectContaining({ usuario_email: expect.anything() }),
    );
  });

  it('no llama a Cognito para un usuario de Entra ID (admin)', async () => {
    const mockUserEntra: UsuarioAutenticado = { sub: 'admin-1', roles: ['administrador'], claims: { oid: 'admin-1' } };
    await service.despachar('ESPACIOS', 'CREAR_RESERVA', mockReqConBearer, mockUserEntra);
    expect(mockCognitoEmail.obtenerEmail).not.toHaveBeenCalled();
  });
});
