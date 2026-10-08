import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { HealthController } from '../health/health.controller';
import { EspaciosProxyController } from './espacios-proxy.controller';
import { GastosProxyController } from './gastos-proxy.controller';
import { PanelController } from './panel.controller';
import type { ProxyService } from './proxy.service';

const usuario = { sub: 'u-1', oid: 'u-1', roles: ['residente' as const], claims: {} };

function req(method: string, originalUrl: string, body: unknown = undefined): Request {
  return { method, originalUrl, body, headers: { authorization: 'Bearer t' } } as unknown as Request;
}

function proxyFalso() {
  return {
    forwardEspacios: jest.fn().mockResolvedValue('ok-espacios'),
    forwardGastos: jest.fn().mockResolvedValue('ok-gastos'),
    obtenerPanel: jest.fn().mockResolvedValue('ok-panel'),
  };
}

describe('EspaciosProxyController', () => {
  const proxy = proxyFalso();
  const controller = new EspaciosProxyController(proxy as unknown as ProxyService);

  beforeEach(() => proxy.forwardEspacios.mockClear());

  it('quita el prefijo v1 y separa la query', async () => {
    await expect(controller.listar(req('GET', '/api/v1/espacios-comunes/espacios/2?x=1'), usuario)).resolves.toBe(
      'ok-espacios',
    );
    expect(proxy.forwardEspacios).toHaveBeenCalledWith(
      'GET',
      '/espacios/2',
      'x=1',
      undefined,
      { authorization: 'Bearer t' },
      usuario,
    );
  });

  it('acepta el prefijo legacy /api/espacios y rutas sin prefijo', async () => {
    await controller.listar(req('GET', '/api/espacios/3'));
    expect(proxy.forwardEspacios.mock.calls[0].slice(1, 3)).toEqual(['/3', '']);
    await controller.listar(req('GET', '/otra/ruta'));
    expect(proxy.forwardEspacios.mock.calls[1][1]).toBe('/otra/ruta');
  });

  it.each([
    'crearReserva',
    'actualizarReserva',
    'modificarReserva',
    'eliminarReserva',
    'crearEspacio',
    'actualizarEspacio',
    'modificarEspacio',
    'eliminarEspacio',
  ] as const)('%s reenvía método, body y usuario', async (handler) => {
    const body = { a: 1 };
    await controller[handler](req('POST', '/api/v1/espacios-comunes/reservas', body), usuario);
    expect(proxy.forwardEspacios).toHaveBeenCalledWith('POST', '/reservas', '', body, expect.anything(), usuario);
  });
});

describe('GastosProxyController', () => {
  const proxy = proxyFalso();
  const controller = new GastosProxyController(proxy as unknown as ProxyService);

  it('quita /api/gastos y reenvía con query', async () => {
    await expect(controller.listar(req('GET', '/api/gastos/api/v1/gastos-comunes?page=1'), usuario)).resolves.toBe(
      'ok-gastos',
    );
    expect(proxy.forwardGastos).toHaveBeenCalledWith(
      'GET',
      '/api/v1/gastos-comunes',
      'page=1',
      undefined,
      expect.anything(),
      usuario,
    );
  });
});

describe('PanelController', () => {
  it('delega en obtenerPanel con headers y usuario', async () => {
    const proxy = proxyFalso();
    const controller = new PanelController(proxy as unknown as ProxyService);
    const r = req('GET', '/api/v1/panel');
    await expect(controller.obtenerPanel(r, usuario)).resolves.toBe('ok-panel');
    expect(proxy.obtenerPanel).toHaveBeenCalledWith(r.headers, usuario);
  });
});

describe('HealthController', () => {
  it('responde ok con el nombre configurado o el por defecto', () => {
    const con = new HealthController({ get: () => 'mi-bff' } as unknown as ConfigService).check();
    expect(con).toMatchObject({ status: 'ok', service: 'mi-bff' });
    expect(typeof con.uptime).toBe('number');
    expect(new HealthController({ get: () => undefined } as unknown as ConfigService).check().service).toBe(
      'convivo-bff',
    );
  });
});
