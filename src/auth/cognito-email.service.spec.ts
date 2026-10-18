import { Logger } from '@nestjs/common';
import { CognitoEmailService } from './cognito-email.service';
import type { ConfigService } from '@nestjs/config';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetUserCommand: jest.fn().mockImplementation((input) => input),
}));

function config(): ConfigService {
  return { get: () => 'us-east-1' } as unknown as ConfigService;
}

describe('CognitoEmailService', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('devuelve el email desde GetUser y lo cachea por sub', async () => {
    mockSend.mockResolvedValue({ UserAttributes: [{ Name: 'email', Value: 'ana@convivo.cl' }] });
    const service = new CognitoEmailService(config());

    const primero = await service.obtenerEmail('token-1', 'sub-1');
    const segundo = await service.obtenerEmail('token-2', 'sub-1');

    expect(primero).toBe('ana@convivo.cl');
    expect(segundo).toBe('ana@convivo.cl');
    expect(mockSend).toHaveBeenCalledTimes(1); // la segunda llamada usa la caché
  });

  it('si GetUser falla, devuelve undefined, deja un warning en el log y no lanza (la reserva se crea igual)', async () => {
    mockSend.mockRejectedValue(new Error('NotAuthorizedException'));
    const service = new CognitoEmailService(config());
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const email = await service.obtenerEmail('token-vencido', 'sub-2');

    expect(email).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sub-2'));
    warnSpy.mockRestore();
  });

  it('devuelve undefined si la respuesta no trae el atributo email', async () => {
    mockSend.mockResolvedValue({ UserAttributes: [{ Name: 'sub', Value: 'sub-3' }] });
    const service = new CognitoEmailService(config());

    expect(await service.obtenerEmail('token-3', 'sub-3')).toBeUndefined();
  });

  it('si GetUser no responde en 2s, hace timeout, devuelve undefined con warning (la reserva se encola igual)', async () => {
    jest.useFakeTimers();
    mockSend.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const service = new CognitoEmailService(config());
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const promesaEmail = service.obtenerEmail('token-lento', 'sub-4');
    await jest.advanceTimersByTimeAsync(2000);
    const email = await promesaEmail;

    expect(email).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sub-4'));
    warnSpy.mockRestore();
    jest.useRealTimers();
  });
});
