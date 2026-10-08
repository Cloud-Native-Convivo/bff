import type { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { MessagingService } from './messaging.service';

jest.mock('amqplib', () => ({ connect: jest.fn() }));
const connect = amqp.connect as unknown as jest.Mock;

function crearCanal() {
  return {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn(),
    sendToQueue: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

function crearConexion(canal: ReturnType<typeof crearCanal>) {
  const handlers: Record<string, (arg?: unknown) => void> = {};
  return {
    handlers,
    createChannel: jest.fn().mockResolvedValue(canal),
    on: jest.fn((evento: string, fn: (arg?: unknown) => void) => {
      handlers[evento] = fn;
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

function servicio(config: Record<string, unknown>): MessagingService {
  return new MessagingService({ get: (k: string) => config[k] } as unknown as ConfigService);
}

async function conectado() {
  const canal = crearCanal();
  const conexion = crearConexion(canal);
  connect.mockResolvedValue(conexion);
  const s = servicio({ rabbitmqEnabled: true, rabbitmqUrls: 'amqp://rabbit', rabbitmqExchange: 'ex' });
  await s.onModuleInit();
  await new Promise((r) => setImmediate(r));
  return { s, canal, conexion };
}

describe('MessagingService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    connect.mockReset();
  });

  afterEach(() => jest.useRealTimers());

  it('deshabilitado no conecta y publish/sendToQueue no fallan', async () => {
    const s = servicio({ rabbitmqEnabled: false });
    await s.onModuleInit();
    expect(connect).not.toHaveBeenCalled();
    expect(s.isReady()).toBe(false);
    await expect(s.publish('ex', 'rk', { a: 1 })).resolves.toBeUndefined();
    await expect(s.sendToQueue('cola', 'texto')).resolves.toBeUndefined();
  });

  it('conecta, declara exchange y publica JSON persistente', async () => {
    const { s, canal } = await conectado();
    expect(connect).toHaveBeenCalledWith('amqp://rabbit');
    expect(canal.prefetch).toHaveBeenCalledWith(10);
    expect(s.isReady()).toBe(true);

    await s.publish('', 'reserva.creada', { id: 1 });
    expect(canal.publish).toHaveBeenCalledWith(
      'ex',
      'reserva.creada',
      Buffer.from('{"id":1}'),
      expect.objectContaining({ persistent: true }),
    );

    await s.sendToQueue('cola', 'hola', { priority: 5 });
    expect(canal.assertQueue).toHaveBeenCalledWith('cola', { durable: true });
    expect(canal.sendToQueue).toHaveBeenCalledWith(
      'cola',
      Buffer.from('hola'),
      expect.objectContaining({ priority: 5 }),
    );
  });

  it('errores del canal al publicar se registran sin lanzar', async () => {
    const { s, canal } = await conectado();
    canal.assertExchange.mockRejectedValueOnce(new Error('canal cerrado'));
    canal.assertQueue.mockRejectedValueOnce(new Error('canal cerrado'));
    await expect(s.publish('ex', 'rk', 'x')).resolves.toBeUndefined();
    await expect(s.sendToQueue('cola', 'x')).resolves.toBeUndefined();
  });

  it('si el broker no responde, reintenta a los 10s', async () => {
    connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const s = servicio({ rabbitmqEnabled: true });
    await s.onModuleInit();
    await new Promise((r) => setImmediate(r));
    expect(s.isReady()).toBe(false);

    const canal = crearCanal();
    connect.mockResolvedValueOnce(crearConexion(canal));
    jest.advanceTimersByTime(10000);
    await new Promise((r) => setImmediate(r));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(s.isReady()).toBe(true);
    await s.onModuleDestroy();
  });

  it('al cerrarse la conexión queda no lista y programa reconexión', async () => {
    const { s, conexion } = await conectado();
    conexion.handlers.error(new Error('heartbeat'));
    conexion.handlers.close();
    expect(s.isReady()).toBe(false);
    await s.onModuleDestroy();
  });

  it('onModuleDestroy cierra canal y conexión, y tolera errores al cerrar', async () => {
    const { s, canal, conexion } = await conectado();
    await s.onModuleDestroy();
    expect(canal.close).toHaveBeenCalled();
    expect(conexion.close).toHaveBeenCalled();

    const otro = await conectado();
    otro.canal.close.mockRejectedValueOnce(new Error('ya cerrado'));
    await expect(otro.s.onModuleDestroy()).resolves.toBeUndefined();
  });
});
