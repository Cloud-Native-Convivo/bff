import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig } from 'axios';
import { isAxiosError } from 'axios';
import CircuitBreaker from 'opossum';
import { lastValueFrom } from 'rxjs';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { stripTrailingSlashes } from '../common/strip-trailing-slashes';
import { EurekaDiscoveryService } from './eureka-discovery.service';

const CORRELATION_HEADER = 'x-correlation-id';

type HeadersEntrantes = Record<string, string | string[] | undefined>;

const PREFIJO_ESPACIOS_BFF = '/api/v1/espacios-comunes';

/**
 * Traduce la ruta pública del BFF a la ruta del microservicio de Espacios
 * Comunes. La ruta RESTful /:id/reservas (api_gateway.tf / ERS.md) se
 * reescribe a /reservas/ inyectando espacio_id en el body.
 */
export function resolverRutaEspacios(path: string, body?: unknown): string {
  const ruta = path.startsWith(PREFIJO_ESPACIOS_BFF) ? path.slice(PREFIJO_ESPACIOS_BFF.length) : path;

  const idReservasMatch = /^\/?(?:espacios\/)?(\d+)\/reservas\/?$/.exec(ruta);
  if (idReservasMatch) {
    if (body && typeof body === 'object') {
      (body as Record<string, unknown>).espacio_id = Number.parseInt(idReservasMatch[1], 10);
    }
    return '/reservas/';
  }
  return normalizarRutaEspacios(ruta);
}

/** Antepone /espacios a rutas sin recurso conocido y agrega el slash final que exige FastAPI. */
export function normalizarRutaEspacios(ruta: string): string {
  if (ruta === '' || ruta === '/' || ruta === '/espacios') return '/espacios/';
  if (ruta === '/reservas') return '/reservas/';
  const recursoConocido = ['/espacios', '/reservas', '/health'].some((p) => ruta.startsWith(p));
  if (recursoConocido) return ruta;
  return ruta.startsWith('/') ? `/espacios${ruta}` : `/espacios/${ruta}`;
}

/**
 * Servicio de reenvío (reverse proxy) del BFF hacia los microservicios.
 * En esta etapa solo se usa para Gastos Comunes.
 */
@Injectable()
export class ProxyService {
  private readonly gastosBreaker: CircuitBreaker<[AxiosRequestConfig], unknown>;
  private readonly espaciosBreaker: CircuitBreaker<[AxiosRequestConfig], unknown>;
  private readonly condominiosBreaker: CircuitBreaker<[AxiosRequestConfig], unknown>;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly eureka: EurekaDiscoveryService,
  ) {
    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 2000;
    const baseOptions: CircuitBreaker.Options = {
      timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 15000,
      // Un 401/403/404 es un rechazo válido del downstream (token o dato
      // invalido), no una falla de disponibilidad -- sin esto, Opossum los
      // cuenta como error, abre el circuito, y esconde el 401 real detras
      // de un 503 para TODOS los usuarios durante el resetTimeout.
      errorFilter: (err: unknown) =>
        isAxiosError(err) &&
        typeof err.response?.status === 'number' &&
        err.response.status >= 400 &&
        err.response.status < 500,
    };

    const doRequest = (requestConfig: AxiosRequestConfig) =>
      lastValueFrom(this.http.request(requestConfig));

    this.gastosBreaker = new CircuitBreaker(doRequest, {
      ...baseOptions,
      name: 'gastos-comunes',
    });
    this.espaciosBreaker = new CircuitBreaker(doRequest, {
      ...baseOptions,
      name: 'espacios-comunes',
    });
    this.condominiosBreaker = new CircuitBreaker(doRequest, {
      ...baseOptions,
      name: 'condominios',
    });
  }

  /**
   * Reenvía la solicitud del cliente a la URL base del microservicio
   * de Gastos Comunes, conservando path, query, método HTTP y los headers
   * relevantes (Autorización, Content-Type y correlación).
   *
   * @param headers Headers del request entrante (ya validado el JWT).
   */
  async forwardGastos(
    method: string,
    path: string,
    query: string,
    body?: unknown,
    headers?: HeadersEntrantes,
    user?: UsuarioAutenticado,
  ): Promise<unknown> {
    const fallbackUrl = this.config.get<string>('gastosComunesUrl') ?? 'http://localhost:8083';
    const baseUrl = await this.eureka.resolveServiceUrl('MS-GASTOS-COMUNES', fallbackUrl);
    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 2000;
    const suffix = query ? `?${query}` : '';
    const url = `${baseUrl}${path}${suffix}`;

    try {
      const { data } = (await this.gastosBreaker.fire({
        method,
        url,
        data: body,
        timeout,
        headers: this.buildForwardHeaders(headers, user),
      })) as { data: unknown };

      return data;
    } catch (error) {
      throw this.toServiceError(error, 'gastos-comunes');
    }
  }

  async forwardGastosBinary(
    path: string,
    headers?: HeadersEntrantes,
    user?: UsuarioAutenticado,
  ): Promise<{ data: Buffer; headers: Record<string, string> }> {
    const fallbackUrl = this.config.get<string>('gastosComunesUrl') ?? 'http://localhost:8083';
    const baseUrl = await this.eureka.resolveServiceUrl('MS-GASTOS-COMUNES', fallbackUrl);
    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 5000;
    const url = `${baseUrl}${path}`;

    try {
      const response = (await this.gastosBreaker.fire({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout,
        headers: this.buildForwardHeaders(headers, user),
      })) as { data: ArrayBuffer; headers: Record<string, string> };

      return { data: Buffer.from(response.data), headers: response.headers };
    } catch (error) {
      throw this.toServiceError(error, 'gastos-comunes');
    }
  }

  /**
   * Reenvía la solicitud del cliente a la URL base del microservicio
   * de Espacios Comunes, conservando path, query, método HTTP y los headers
   * relevantes (Autorización, Content-Type y correlación).
   */
  async forwardEspacios(
    method: string,
    path: string,
    query: string,
    body?: unknown,
    headers?: HeadersEntrantes,
    user?: UsuarioAutenticado,
  ): Promise<unknown> {
    const fallbackUrl =
      this.config.get<string>('espaciosComunesUrl') ?? 'http://localhost:8082';
    let baseUrl = await this.eureka.resolveServiceUrl('MS-ESPACIOS-COMUNES', fallbackUrl);
    baseUrl = stripTrailingSlashes(baseUrl);
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }

    const targetPath = resolverRutaEspacios(path, body);

    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 2000;
    const suffix = query ? `?${query}` : '';
    const url = `${baseUrl}${targetPath}${suffix}`;

    try {
      const { data } = (await this.espaciosBreaker.fire({
        method,
        url,
        data: body,
        timeout,
        headers: this.buildForwardHeaders(headers, user),
      })) as { data: unknown };

      return data;
    } catch (error) {
      throw this.toServiceError(error, 'espacios-comunes');
    }
  }

  /**
   * Reenvía la solicitud del cliente a la URL base del microservicio
   * de Condominios, conservando path, query, método HTTP y los headers
   * relevantes (Autorización, Content-Type y correlación).
   */
  async forwardCondominios(
    method: string,
    path: string,
    query: string,
    body?: unknown,
    headers?: HeadersEntrantes,
    user?: UsuarioAutenticado,
  ): Promise<unknown> {
    const fallbackUrl = this.config.get<string>('condominiosUrl') ?? 'http://localhost:8084';
    const baseUrl = await this.eureka.resolveServiceUrl('MS-CONDOMINIOS', fallbackUrl);
    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 2000;
    const suffix = query ? `?${query}` : '';
    // ms-condominios usa /condominios como prefijo
    const url = `${baseUrl}/condominios${path}${suffix}`;

    try {
      const { data } = (await this.condominiosBreaker.fire({
        method,
        url,
        data: body,
        timeout,
        headers: this.buildForwardHeaders(headers, user),
      })) as { data: unknown };

      return data;
    } catch (error) {
      throw this.toServiceError(error, 'condominios');
    }
  }

  /**
   * Agrega reservas (Espacios Comunes) y gastos comunes del usuario actual
   * para el panel del residente (RF-T.7). Cada llamada downstream se
   * aísla: si un microservicio falla, el otro igual responde y el error
   * queda reportado en `errores` en vez de tumbar el endpoint completo.
   */
  async obtenerPanel(
    headers: HeadersEntrantes,
    user?: UsuarioAutenticado,
  ): Promise<{ reservas: unknown; gastos: unknown; errores: string[] }> {
    const errores: string[] = [];

    // forwardGastos no reescribe el path (a diferencia de forwardEspacios):
    // hay que pasarle la ruta real del microservicio (@RequestMapping de
    // GastoComunController), no un alias corto.
    const [reservas, gastos] = await Promise.all([
      this.forwardEspacios('GET', '/reservas', '', undefined, headers, user).catch(
        (error) => {
          errores.push(`espacios-comunes: ${extractErrorMessage(error)}`);
          return null;
        },
      ),
      this.forwardGastos('GET', '/api/v1/gastos-comunes', '', undefined, headers, user).catch(
        (error) => {
          errores.push(`gastos-comunes: ${extractErrorMessage(error)}`);
          return null;
        },
      ),
    ]);

    return { reservas, gastos, errores };
  }

  /**
   * Traduce un error del circuit breaker a 503 controlado (Fallback).
   * Si el error viene del breaker (abierto o timeout, CircuitBreaker.isOurError)
   * se devuelve ServiceUnavailableException; si viene del propio microservicio
   * downstream (p. ej. un 404/400 real), se propaga tal cual.
   */
  private toServiceError(error: unknown, servicio: string): Error {
    if (error instanceof Error && CircuitBreaker.isOurError(error)) {
      return new ServiceUnavailableException(
        `Servicio ${servicio} no disponible temporalmente`,
      );
    }
    return error as Error;
  }

  /**
   * Selecciona los headers que se propagan al microservicio downstream.
   * Si el cliente no envió un identificador de correlación, se genera uno.
   * Inyecta identidad del usuario autenticado (x-usuario-sub y x-usuario-roles).
   */
  private buildForwardHeaders(
    headers?: HeadersEntrantes,
    user?: UsuarioAutenticado,
  ): Record<string, string> {
    const forward: Record<string, string> = {};
    const source = headers ?? {};

    // Authorization se propaga tal cual: el BFF ya validó el JWT y el
    // microservicio recibe el mismo Access Token.
    if (source['authorization']) {
      forward['authorization'] = asString(source['authorization']) as string;
    }

    if (source['content-type']) {
      forward['content-type'] = asString(source['content-type']) as string;
    }

    forward[CORRELATION_HEADER] =
      asString(source[CORRELATION_HEADER]) ?? newCorrelationId();

    // Identidad solo desde el JWT validado: los x-usuario-* que mande el
    // cliente se descartan (los microservicios confían en estos headers).
    forward['x-usuario-sub'] = user?.sub || 'anonimo';
    forward['x-usuario-roles'] = user?.roles?.join(',') ?? '';

    return forward;
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function newCorrelationId(): string {
  return crypto.randomUUID();
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'error desconocido';
}
