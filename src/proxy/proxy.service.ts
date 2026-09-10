import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig } from 'axios';
import CircuitBreaker from 'opossum';
import { lastValueFrom } from 'rxjs';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Servicio de reenvío (reverse proxy) del BFF hacia los microservicios.
 * En esta etapa solo se usa para Gastos Comunes.
 */
@Injectable()
export class ProxyService {
  private readonly gastosBreaker: CircuitBreaker<[AxiosRequestConfig], unknown>;
  private readonly espaciosBreaker: CircuitBreaker<[AxiosRequestConfig], unknown>;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 2000;
    const baseOptions: CircuitBreaker.Options = {
      timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 15000,
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
    headers?: Record<string, string | string[] | undefined>,
    user?: UsuarioAutenticado,
  ): Promise<unknown> {
    const baseUrl = this.config.get<string>('gastosComunesUrl') ?? '';
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
    headers?: Record<string, string | string[] | undefined>,
    user?: UsuarioAutenticado,
  ): Promise<unknown> {
    let baseUrl =
      this.config.get<string>('espaciosComunesUrl') ?? 'http://localhost:8082';
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }

    let targetPath = path;
    if (targetPath.startsWith('/api/v1/espacios-comunes')) {
      targetPath = targetPath.slice('/api/v1/espacios-comunes'.length);
    }

    // Soporte para ruta RESTful /:id/reservas (especificada en api_gateway.tf / mvp.md)
    const idReservasMatch = targetPath.match(/^\/?(?:espacios\/)?(\d+)\/reservas\/?$/);
    if (idReservasMatch) {
      targetPath = '/reservas/';
      const espacioId = parseInt(idReservasMatch[1], 10);
      if (body && typeof body === 'object') {
        (body as Record<string, unknown>).espacio_id = espacioId;
      }
    }

    if (
      !targetPath.startsWith('/espacios') &&
      !targetPath.startsWith('/reservas') &&
      !targetPath.startsWith('/health')
    ) {
      if (targetPath === '' || targetPath === '/') {
        targetPath = '/espacios/';
      } else {
        targetPath = `/espacios${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`;
      }
    } else if (targetPath === '/espacios') {
      targetPath = '/espacios/';
    } else if (targetPath === '/reservas') {
      targetPath = '/reservas/';
    }

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
   * Agrega reservas (Espacios Comunes) y gastos comunes del usuario actual
   * para el panel del residente (RF-T.7). Cada llamada downstream se
   * aísla: si un microservicio falla, el otro igual responde y el error
   * queda reportado en `errores` en vez de tumbar el endpoint completo.
   */
  async obtenerPanel(
    headers: Record<string, string | string[] | undefined>,
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
    headers?: Record<string, string | string[] | undefined>,
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

    forward['x-usuario-sub'] =
      user?.sub ?? asString(source['x-usuario-sub']) ?? 'anonimo';
    forward['x-usuario-roles'] =
      user?.roles.join(',') ?? asString(source['x-usuario-roles']) ?? '';

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
