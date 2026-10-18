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

  it('purga las entradas vencidas de la cache en el siguiente guardado', async () => {
    jest.useFakeTimers();
    mockSend.mockResolvedValue({ UserAttributes: [{ Name: 'email', Value: 'x@convivo.cl' }] });
    const service = new CognitoEmailService(config());

    await service.obtenerEmail('t1', 'sub-expirado');
    jest.advanceTimersByTime(6 * 60 * 1000); // pasa el TTL de 5 minutos
    await service.obtenerEmail('t2', 'sub-nuevo');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = (service as any).cache as Map<string, unknown>;
    expect(cache.has('sub-expirado')).toBe(false);
    expect(cache.has('sub-nuevo')).toBe(true);
    jest.useRealTimers();
  });

  it('limita la cache a un maximo de entradas, descartando la mas antigua al llenarse', async () => {
    mockSend.mockImplementation(async (comando: { AccessToken: string }) => ({
      UserAttributes: [{ Name: 'email', Value: `${comando.AccessToken}@convivo.cl` }],
    }));
    const service = new CognitoEmailService(config());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = (service as any).cache as Map<string, unknown>;

    for (let i = 0; i < 1000; i++) {
      await service.obtenerEmail(`token-${i}`, `sub-${i}`);
    }
    expect(cache.size).toBe(1000);

    await service.obtenerEmail('token-1000', 'sub-1000');

    expect(cache.size).toBe(1000);
    expect(cache.has('sub-0')).toBe(false);
    expect(cache.has('sub-1000')).toBe(true);
  });
});
