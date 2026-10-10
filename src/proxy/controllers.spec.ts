import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { HealthController } from '../health/health.controller';
import { EspaciosProxyController } from './espacios-proxy.controller';
import { GastosProxyController } from './gastos-proxy.controller';
import { PanelController } from './panel.controller';
import type { ProxyService } from './proxy.service';
import type { AsyncMutationService } from './async-mutation.service';

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

function asyncMutationFalso() {
  return {
    despachar: jest.fn().mockResolvedValue({
      ticket_id: 'ticket-123',
      estado: 'EN_COLA',
      status_url: '/api/v1/espacios-comunes/jobs/ticket-123',
      creado_en: '2026-10-09T22:00:00Z',
    }),
  };
}

function resFalso() {
  const headers: Record<string, string> = {};
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    headers,
  } as unknown as Response;
}

describe('EspaciosProxyController', () => {
  const proxy = proxyFalso();
  const asyncMut = asyncMutationFalso();
  const controller = new EspaciosProxyController(
    proxy as unknown as ProxyService,
    asyncMut as unknown as AsyncMutationService,
  );

  beforeEach(() => {
    proxy.forwardEspacios.mockClear();
    asyncMut.despachar.mockClear();
  });

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
  ] as const)('%s despacha mutacion asincrona con 202 Accepted', async (handler) => {
    const body = { a: 1 };
    const res = resFalso();
    const r = req('POST', '/api/v1/espacios-comunes/reservas', body);
    const resultado = await controller[handler](r, res as unknown as Response, usuario);
    expect(resultado).toMatchObject({ ticket_id: 'ticket-123', estado: 'EN_COLA' });
    expect(asyncMut.despachar).toHaveBeenCalledWith('ESPACIOS', expect.any(String), r, usuario);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.setHeader).toHaveBeenCalledWith('Location', '/api/v1/espacios-comunes/jobs/ticket-123');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
  });
});

describe('GastosProxyController', () => {
  const proxy = proxyFalso();
  const asyncMut = asyncMutationFalso();
  const controller = new GastosProxyController(
    proxy as unknown as ProxyService,
    asyncMut as unknown as AsyncMutationService,
  );

  it('quita /api/gastos y reenvía con query en GET', async () => {
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

  it('despacha mutaciones no-GET hacia asyncMutation con 202 Accepted', async () => {
    const res = resFalso();
    const r = req('POST', '/api/gastos/api/v1/gastos-comunes', { monto: 50000 });
    const resultado = await controller.forward(r, res as unknown as Response, usuario);
    expect(resultado).toMatchObject({ ticket_id: 'ticket-123', estado: 'EN_COLA' });
    expect(asyncMut.despachar).toHaveBeenCalledWith('GASTOS', 'POST_GASTO', r, usuario);
    expect(res.status).toHaveBeenCalledWith(202);
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
