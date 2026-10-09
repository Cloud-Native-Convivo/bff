import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { NEVER, of, throwError } from 'rxjs';
import type { EurekaDiscoveryService } from './eureka-discovery.service';
import { normalizarRutaEspacios, ProxyService, resolverRutaEspacios } from './proxy.service';

describe('normalizarRutaEspacios', () => {
  it.each([
    ['', '/espacios/'],
    ['/', '/espacios/'],
    ['/espacios', '/espacios/'],
    ['/reservas', '/reservas/'],
    ['/espacios/3', '/espacios/3'],
    ['/reservas/9', '/reservas/9'],
    ['/health', '/health'],
    ['/5', '/espacios/5'],
    ['5', '/espacios/5'],
  ])('%p -> %p', (entrada, esperado) => {
    expect(normalizarRutaEspacios(entrada)).toBe(esperado);
  });
});

describe('resolverRutaEspacios', () => {
  it('sin body igual reescribe /:id/reservas', () => {
    expect(resolverRutaEspacios('/api/v1/espacios-comunes/espacios/4/reservas/')).toBe('/reservas/');
  });
});

describe('ProxyService.forwardEspacios', () => {
  const request = jest.fn();
  const http = { request } as unknown as HttpService;
  const config = { get: () => undefined } as unknown as ConfigService;
  const eureka = {
    resolveServiceUrl: jest.fn().mockResolvedValue('http://ms-espacios:8082//'),
  } as unknown as EurekaDiscoveryService;
  const proxy = new ProxyService(http, config, eureka);

  beforeEach(() => request.mockReset().mockReturnValue(of({ data: { ok: true } })));

  it('normaliza la base y reescribe /:id/reservas inyectando espacio_id', async () => {
    const body: Record<string, unknown> = { fecha: '2026-10-10' };
    await expect(
      proxy.forwardEspacios('POST', '/api/v1/espacios-comunes/7/reservas', '', body),
    ).resolves.toEqual({ ok: true });

    const llamada = request.mock.calls[0][0];
    expect(llamada.url).toBe('http://ms-espacios:8082/api/v1/reservas/');
    expect(body.espacio_id).toBe(7);
  });

  it('mapea la raíz del catálogo a /espacios/ y conserva la query', async () => {
    await proxy.forwardEspacios('GET', '/api/v1/espacios-comunes', 'page=2');
    expect(request.mock.calls[0][0].url).toBe('http://ms-espacios:8082/api/v1/espacios/?page=2');
  });

  it('no duplica /api/v1 si la base ya lo trae', async () => {
    (eureka.resolveServiceUrl as jest.Mock).mockResolvedValueOnce('http://ms:8082/api/v1/');
    await proxy.forwardEspacios('GET', '/espacios', '');
    expect(request.mock.calls[0][0].url).toBe('http://ms:8082/api/v1/espacios/');
  });
});

describe('ProxyService: gastos, panel y headers', () => {
  const request = jest.fn();
  const http = { request } as unknown as HttpService;
  const config = { get: (k: string) => (k === 'proxyTimeoutMs' ? 50 : undefined) } as unknown as ConfigService;
  const eureka = { resolveServiceUrl: jest.fn().mockResolvedValue('http://ms-gastos:8083') } as unknown as EurekaDiscoveryService;
  const proxy = new ProxyService(http, config, eureka);
  const usuario = { sub: 'u-1', oid: 'u-1', roles: ['administrador' as const, 'comite' as const], claims: {} };

  beforeEach(() => request.mockReset().mockReturnValue(of({ data: [1] })));

  it('forwardGastos arma la URL y propaga authorization, content-type y correlación', async () => {
    await expect(
      proxy.forwardGastos(
        'GET',
        '/api/v1/gastos-comunes',
        'page=1',
        undefined,
        { authorization: 'Bearer t', 'content-type': ['application/json'], 'x-correlation-id': 'corr-1' },
        usuario,
      ),
    ).resolves.toEqual([1]);
    const llamada = request.mock.calls[0][0];
    expect(llamada.url).toBe('http://ms-gastos:8083/api/v1/gastos-comunes?page=1');
    expect(llamada.headers).toEqual({
      authorization: 'Bearer t',
      'content-type': 'application/json',
      'x-correlation-id': 'corr-1',
      'x-usuario-sub': 'u-1',
      'x-usuario-roles': 'administrador,comite',
    });
  });

  it('descarta x-usuario-* enviados por el cliente (anti-spoofing)', async () => {
    const spoof = { 'x-usuario-sub': 'otro', 'x-usuario-roles': 'administrador' };
    await proxy.forwardGastos('GET', '/x', '', undefined, spoof);
    await proxy.forwardGastos('GET', '/x', '', undefined, spoof, { ...usuario, roles: [] });
    const [anon, sinRol] = request.mock.calls.map((c) => c[0].headers);
    expect(anon['x-usuario-sub']).toBe('anonimo');
    expect(anon['x-usuario-roles']).toBe('');
    expect(sinRol['x-usuario-sub']).toBe('u-1');
    expect(sinRol['x-usuario-roles']).toBe('');
  });

  it('genera correlación si falta y marca anónimo sin usuario', async () => {
    await proxy.forwardGastos('GET', '/x', '');
    const headers = request.mock.calls[0][0].headers;
    expect(headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-usuario-sub']).toBe('anonimo');
  });

  it('un error real del downstream se propaga tal cual', async () => {
    const error = new Error('404 del microservicio');
    request.mockReturnValue(throwError(() => error));
    await expect(proxy.forwardGastos('GET', '/x', '')).rejects.toBe(error);
  });

  it('timeout del circuit breaker se traduce a 503', async () => {
    request.mockReturnValue(NEVER);
    await expect(proxy.forwardGastos('GET', '/lento', '')).rejects.toThrow(ServiceUnavailableException);
  });

  it('obtenerPanel agrega reservas y gastos, aislando fallos', async () => {
    request.mockReturnValueOnce(of({ data: ['r'] })).mockReturnValueOnce(throwError(() => new Error('caído')));
    const panel = await proxy.obtenerPanel({}, usuario);
    expect(panel.reservas).toEqual(['r']);
    expect(panel.gastos).toBeNull();
    expect(panel.errores).toEqual(['gastos-comunes: caído']);
  });

  it('obtenerPanel informa error desconocido si no es Error', async () => {
    // Instancia propia: los fallos de tests previos abren el breaker de gastos (umbral 50%).
    const aislado = new ProxyService(http, config, eureka);
    request.mockReturnValue(throwError(() => 'texto'));
    const panel = await aislado.obtenerPanel({});
    expect(panel.errores).toEqual(['espacios-comunes: error desconocido', 'gastos-comunes: error desconocido']);
  });
});
