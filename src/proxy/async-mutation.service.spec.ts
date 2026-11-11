import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { AsyncMutationService } from './async-mutation.service';
import type { MessagingService } from '../messaging/messaging.service';
import type { CognitoEmailService } from '../auth/cognito-email.service';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { COLAS } from '../messaging/colas';

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

  it('responde 503 y no devuelve ticket si el broker rechaza la publicación (p. ej. 406)', async () => {
    mockMessaging.encolarComando = jest
      .fn()
      .mockRejectedValue(new Error("PRECONDITION_FAILED - inequivalent arg 'x-dead-letter-exchange'"));
    const intento = service.despachar('ESPACIOS', 'CREAR_ESPACIO', mockReq, mockUser);
    await expect(intento).rejects.toThrow(ServiceUnavailableException);
    await expect(intento).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 503, retryAfter: 5 }),
    });
  });

  it('el 503 por fallo de publicación no filtra el detalle interno de AMQP al cliente', async () => {
    mockMessaging.encolarComando = jest.fn().mockRejectedValue(new Error('PRECONDITION_FAILED secreto-interno'));
    const error = await service
      .despachar('ESPACIOS', 'CREAR_ESPACIO', mockReq, mockUser)
      .catch((e: ServiceUnavailableException) => e);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toMatch(
      /PRECONDITION|secreto-interno/,
    );
  });

  describe('ids de espacio en editar/eliminar', () => {
    const reqEspacio = (url: string, query: Record<string, unknown>) =>
      ({ method: 'PUT', originalUrl: url, query, body: { nombre: 'Quincho' }, headers: {} }) as unknown as Request;

    it.each(['ACTUALIZAR_ESPACIO', 'MODIFICAR_ESPACIO', 'ELIMINAR_ESPACIO'])(
      '%s envía espacio_id y condominio_id de primer nivel',
      async (accion) => {
        const req = reqEspacio('/api/v1/espacios-comunes/espacios/12?condominio_id=3', { condominio_id: '3' });
        await service.despachar('ESPACIOS', accion, req, mockUser);
        expect(mockMessaging.encolarComando).toHaveBeenCalledWith(
          'espacios_comandos_queue',
          expect.objectContaining({ accion, espacio_id: 12, condominio_id: 3 }),
        );
      },
    );

    it.each([
      ['sin condominio_id', '/api/v1/espacios-comunes/espacios/12', {}],
      ['condominio_id no numérico', '/api/v1/espacios-comunes/espacios/12?condominio_id=x', { condominio_id: 'x' }],
      ['sin id de espacio en la ruta', '/api/v1/espacios-comunes/espacios', { condominio_id: '3' }],
      ['id de espacio cero', '/api/v1/espacios-comunes/espacios/0', { condominio_id: '3' }],
    ])('400 y no encola: %s', async (_caso, url, query) => {
      await expect(
        service.despachar('ESPACIOS', 'ELIMINAR_ESPACIO', reqEspacio(url, query), mockUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockMessaging.encolarComando).not.toHaveBeenCalled();
    });

    it('CREAR_ESPACIO no agrega ids', async () => {
      await service.despachar('ESPACIOS', 'CREAR_ESPACIO', reqEspacio('/api/v1/espacios-comunes/espacios', {}), mockUser);
      const comando = (mockMessaging.encolarComando as jest.Mock).mock.calls[0][1];
      expect(comando).not.toHaveProperty('espacio_id');
      expect(comando).not.toHaveProperty('condominio_id');
    });
  });

  it('usa las constantes de colas.ts para cada módulo', async () => {
    await service.despachar('ESPACIOS', 'CREAR_ESPACIO', mockReq, mockUser);
    await service.despachar('GASTOS', 'CREAR_GASTO', mockReq, mockUser);
    const colas = (mockMessaging.encolarComando as jest.Mock).mock.calls.map((c) => c[0]);
    expect(colas).toEqual([COLAS.espaciosComandos.nombre, COLAS.gastosComandos.nombre]);
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
